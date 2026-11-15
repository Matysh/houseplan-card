/** #1454: accepted View stays interactive during real module-Worker light work. */
import assert from 'node:assert/strict';
import { launch, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const fixture = makeLargeHouseFixture({ floors: 2, roomsPerFloor: 4, devices: 12,
  openings: 6, partitions: 2, columns: 1, decor: 2, stairs: 0 });
const contact = 'binary_sensor.light_refresh_door', cover = 'cover.light_refresh_gate';
const door = fixture.config.spaces[0].openings[0], gate = fixture.config.spaces[0].openings[1];
Object.assign(door, { type: 'door', contact });
Object.assign(gate, { type: 'gate', contact: cover });
for (const [id, state, attributes] of [[contact, 'off', { device_class: 'door' }],
  [cover, 'closed', { device_class: 'curtain', current_position: 0, supported_features: 11 }]]) {
  fixture.states[id] = { entity_id: id, state, attributes };
  fixture.entities[id] = { entity_id: id, platform: 'demo' };
}
fixture.config.markers.find(marker => marker.id === 'perf-device-0').tap_action = 'toggle';
const { page, browser } = await launch({ width: 1440, height: 1000 });
try {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async ({ fixture, contact, cover, doorId, gateId }) => {
    window.__card.remove(); localStorage.clear();
    customElements.get('houseplan-card')._warmBootReset();
    const NativeWorker = window.Worker;
    const probe = window.__lightRefresh = { armed: false, held: [], jobs: [], terminations: 0,
      releases: 0, replies: 0, lightReplies: [], violations: [], services: [], writes: 0 };
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        if (args[1]?.name === 'houseplan-floor') {
          this.floorWorker = true;
          if (args[1].type !== 'module') throw Error('floor worker is not a real module worker');
          this.lightIds = new Map();
          this.addEventListener('message', event => {
            probe.replies++;
            if (this.lightIds.has(event.data?.id)) probe.lightReplies.push({
              key: this.lightIds.get(event.data.id), error: !!event.data.error });
          });
        }
      }
      postMessage(message, ...rest) {
        if (this.floorWorker && message.job) {
          probe.jobs.push({ kind: message.job.kind, floor: message.job.input?.raw.id,
            light: message.job.light?.fingerprint });
          if (message.job.kind === 'light') this.lightIds.set(message.id, message.job.light.fingerprint);
          if (probe.armed && message.job.kind === 'light') {
            probe.held.push(() => { probe.releases++; super.postMessage(message, ...rest); });
            return;
          }
        }
        return super.postMessage(message, ...rest);
      }
      terminate() { if (this.floorWorker) probe.terminations++; return super.terminate(); }
    };
    probe.release = () => { for (const send of probe.held.splice(0)) send(); };
    const hass = { ...window.__mkHass(), user: { id: 'light-refresh-fixture', is_admin: false },
      devices: fixture.devices, entities: fixture.entities, areas: fixture.areas, states: fixture.states,
      services: { light: { toggle: {}, turn_on: {}, turn_off: {} }, homeassistant: { toggle: {} } },
      connection: { connected: true, subscribeEvents: async () => () => {}, subscribeMessage: async () => () => {} },
      callWS: async message => {
        if (message.type === 'houseplan/config/get') return { config: structuredClone(fixture.config), rev: 1, can_write: false };
        if (message.type === 'houseplan/layout/get') return { layout: structuredClone(fixture.layout), rev: 1 };
        if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
        if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities);
        if (/houseplan\/.*(?:set|save|delete)/.test(message.type)) probe.writes++;
        return { ok: true };
      }, callService: async (...args) => { probe.services.push(args); return {}; } };
    const card = document.createElement('houseplan-card'); window.__card = card;
    card.setConfig({ type: 'custom:houseplan-card', title: 'Light refresh witness', language: 'en' });
    document.getElementById('host').replaceChildren(card); card.hass = hass;
    probe.snapshot = () => {
      const root = card.renderRoot, stage = root.querySelector('.stage'), header = root.querySelector('.header-actions');
      return { floor: card._space, mode: root.querySelector('ha-card')?.dataset.hpMode,
        stageInert: !!stage?.closest('[inert]'), headerInert: !!header?.closest('[inert]'),
        passive: !!root.querySelector('[data-hp-cache-preview],[data-hp-floor-cache="pending"],[data-hp-floor-cache="preview"]'),
        status: !!root.querySelector('.editorloading[role="status"]'), holding: card._floorHolding,
        door: root.querySelector(`[data-hp="opening"][data-id="${doorId}"] .op-leaf`)?.style.transform,
        gate: root.querySelector(`[data-hp="opening"][data-id="${gateId}"] .op-leaf`)?.style.transform };
    };
    probe.tick = (open, position) => {
      card.hass = { ...card.hass, states: { ...card.hass.states,
        [contact]: { ...card.hass.states[contact], state: open ? 'on' : 'off' },
        [cover]: { ...card.hass.states[cover], state: position ? 'open' : 'closed',
          attributes: { ...card.hass.states[cover].attributes, current_position: position } } } };
    };
  }, { fixture, contact, cover, doorId: door.id, gateId: gate.id });
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => {
    const c = window.__card;
    return c._loadOk && !c._booting && !c._bootFading && c._continuity.state === 'steady'
      && c._floorPreparation?.diagnostic.readyCurrentFrame > 0 && !c._floorPreparation.pending
      && !!c.renderRoot.querySelector('.stage.mode-view .dev') && !c.renderRoot.querySelector('[data-hp-floor-cache]');
  });
  await ready(); await page.evaluate(() => window.__hpTest.settled());
  await page.waitForFunction(() => window.__card._floorPreparation.diagnostic.store.writes > 0);
  await frame();
  await page.evaluate(() => {
    const c = window.__card, p = window.__lightRefresh;
    if (!p.jobs.some(job => job.kind === 'geometry') || !p.replies) throw Error('actual module-worker positive missing');
    if (!c._stageEl || !c.renderRoot.querySelector('.header-actions') || !c._floorPreparedRooms
      || !c._physicalBodiesCache || !c._wallUnionCache || !c._cleanFloorCache.size)
      throw Error('ready structural-pool/DOM positive missing');
    p.base = { stage: c._stageEl, header: c.renderRoot.querySelector('.header-actions'),
      rooms: c._floorPreparedRooms, bodies: c._physicalBodiesCache, union: c._wallUnionCache,
      pools: [c._physicalBodiesPool, c._wallUnionPool, c._cleanFloorCache, c._isoGeometryCache]
        .map(pool => [pool, [...pool]]), view: JSON.stringify(c._view),
      writes: c._floorPreparation.diagnostic.store.writes,
      publications: c._floorPreparation.diagnostic.publicationAttempts,
      jobs: p.jobs.length, terminations: p.terminations,
      fallback: c._floorPreparation.diagnostic.scheduler.fallbackJobs };
    p.observer = new MutationObserver(() => {
      const state = p.snapshot();
      if (state.stageInert || state.headerInert || state.passive || state.status || state.holding) p.violations.push(state);
    });
    p.observer.observe(c.renderRoot, { subtree: true, childList: true, attributes: true });
    p.armed = true; p.tick(true, 35);
  });
  await page.waitForFunction(() => window.__lightRefresh.held.length > 0);
  await frame();
  const held = await page.evaluate(() => window.__lightRefresh.snapshot());
  console.log('held real light refresh', held);
  // Native input is attempted while the real job is held, not after settled()
  // has hidden the very blocked-input interval this regression must catch.
  let clickError = null;
  try { await page.locator('[data-hp="device"][data-entity="light.perf_0"]').click({ timeout: 1500 }); }
  catch (error) { clickError = error.message; }
  const services = await page.evaluate(() => window.__lightRefresh.services);
  assert.equal(clickError, null, 'ready View native device tap remains accepted during light refresh');
  assert.equal(services.length, 1, 'one native tap dispatches one current action');
  assert.equal(services[0][2].entity_id, 'light.perf_0');
  assert.equal(held.stageInert || held.headerInert || held.passive || held.status || held.holding, false,
    'light refresh never presents a navigation/loading surface');
  assert.equal(held.door, 'rotate(-90deg)', 'current contact state paints before light worker completion');
  for (let i = 0; i < 8; i++) {
    await page.evaluate(i => window.__lightRefresh.tick(i % 2 === 0, 10 + i * 10), i);
    await frame();
  }
  await page.evaluate(() => { window.__lightRefresh.tick(true, 80); window.__lightRefresh.armed = false; window.__lightRefresh.release(); });
  await page.waitForFunction(() => {
    const c = window.__card;
    return !c._floorPreparation.pending && c._lightBarrierCache?.value.fingerprint === c._floorCacheSelection().light.fingerprint;
  });
  await frame();
  const refreshed = await page.evaluate(() => {
    const c = window.__card, p = window.__lightRefresh, b = p.base;
    p.observer.disconnect();
    return { ...p.snapshot(), violations: p.violations, unchanged: c._stageEl === b.stage
      && c.renderRoot.querySelector('.header-actions') === b.header && c._floorPreparedRooms === b.rooms
      && c._physicalBodiesCache === b.bodies && c._wallUnionCache === b.union
      && b.pools.every(([pool, entries]) => pool.size === entries.length && entries.every(([key, value]) => pool.get(key) === value))
      && JSON.stringify(c._view) === b.view,
      storeWrites: c._floorPreparation.diagnostic.store.writes - b.writes,
      publications: c._floorPreparation.diagnostic.publicationAttempts - b.publications,
      lightJobs: p.jobs.slice(b.jobs).filter(job => job.kind === 'light').length,
      geometryJobs: p.jobs.slice(b.jobs).filter(job => job.kind === 'geometry').length,
      terminations: p.terminations - b.terminations,
      latestWorkerReply: p.lightReplies.some(reply => !reply.error && reply.key === c._floorCacheSelection().light.fingerprint),
      fallback: c._floorPreparation.diagnostic.scheduler.fallbackJobs - b.fallback,
      replies: p.replies, configWrites: p.writes };
  });
  console.log('latest burst refresh', refreshed);
  assert.deepEqual(refreshed.violations, [], 'no transient pending/inert/status scene during light-only frames');
  assert.equal(refreshed.unchanged, true, 'camera, DOM owners and every structural pool value remain identical');
  assert.equal(refreshed.door, 'rotate(-90deg)');
  assert.equal(Math.abs(Number.parseFloat(refreshed.gate.replace('rotate(', ''))), 8,
    'latest cover position=80 paints the gate at its independently known eight-degree pose');
  assert.equal(refreshed.storeWrites, 0, 'light-only work does not republish full IDB geometry');
  assert.equal(refreshed.publications, 0, 'no delayed full-publication attempt is queued by light-only work');
  assert.equal(refreshed.geometryJobs, 0);
  assert.equal(refreshed.terminations, 0, 'burst coalesces without terminating the active light worker');
  assert.ok(refreshed.lightJobs > 0 && refreshed.lightJobs <= 3, 'burst computes active and latest light work, not every intermediate state');
  assert.equal(refreshed.latestWorkerReply, true, 'latest installed light came from its actual worker response');
  assert.equal(refreshed.fallback, 0, 'background refresh does not silently recompute on main');
  assert.equal(refreshed.configWrites, 0);
  // A true floor navigation still fences an old light reply. It must not get
  // the interaction-preserving treatment reserved for the same structural owner.
  await page.evaluate(() => { const p = window.__lightRefresh; p.armed = true; p.tick(false, 0); });
  await page.waitForFunction(() => window.__lightRefresh.held.length > 0);
  await page.evaluate(id => window.__hpTest.switchSpace(id), fixture.config.spaces[1].id);
  await ready();
  await page.evaluate(() => { const p = window.__lightRefresh; p.armed = false; p.release(); });
  await frame();
  assert.equal(await page.evaluate(() => window.__card._floorPreparedRooms.frame.id), fixture.config.spaces[1].id);
  assert.equal(await page.locator(`[data-hp="opening"][data-id="${door.id}"]`).count(), 0, 'late old-floor light never resurrects the old scene');
  console.log('old light reply fenced after public navigation; OK');
} finally {
  await page.evaluate(() => { window.__lightRefresh?.observer?.disconnect(); window.__lightRefresh?.release(); }).catch(() => {});
  await finish(browser);
}
