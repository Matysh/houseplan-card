// #73: lifecycle frame-sequence contract. The last complete plan must remain
// visible across quick/long returns; recovery tokens may advance, pixels may
// not disappear or regress to an empty/default frame.
//
// #813 F14 (AC3/AC4): a frame's geometry and the entity states it paints come
// from one snapshot. Another client adds a door whose contact sensor the plan
// has never read; Home Assistant already reports it closed. Both cards must
// draw that door closed from the first frame that shows it — the old frame
// may stay on screen while the candidate is prepared, but never the new door
// with the previous frame's state projection (a missing door state is drawn
// open, and the 0.6 s leaf transition then "closes" a door nobody touched).
// Every presented frame is sampled together with the transition events; the
// matrix covers open/closed/missing/unknown/unavailable contacts, a real state
// change (which must still animate), the doors already on the plan, a space
// switch, a newer event while the candidate waits and a warm remount.
import { launch, check, checkAll, finish } from './serve.mjs';
import { makeVisualMatrixFixture } from './fixtures/visual-matrix.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const fixture = makeVisualMatrixFixture();
fixture.states['sun.sun'].attributes.azimuth = 0;
fixture.config.spaces[1].plan_url = '/api/houseplan/content/continuity.svg';
fixture.config.spaces[1].decor = [
  { id: 'continuity-axis', kind: 'line', x1: 0.08, y1: 0.52, x2: 0.92, y2: 0.52,
    color: '#5d6a73', opacity: 0.45, width_cm: 1, line_style: 'dashed' },
];

const result = await page.evaluate(async (visualFixture) => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitUntil = async (predicate, timeout = 3000) => {
    const start = performance.now();
    while (!predicate() && performance.now() - start < timeout) await sleep(20);
    return predicate();
  };
  const originalHass = card.hass;
  const originalCallWS = originalHass.callWS;
  const fixtureCallWS = async (message) => {
    if (message.type === 'houseplan/config/get') {
      return { config: visualFixture.config, rev: 73, can_write: true };
    }
    if (message.type === 'houseplan/layout/get') return { layout: visualFixture.layout, rev: 73 };
    if (message.type === 'config/device_registry/list') return Object.values(visualFixture.devices);
    if (message.type === 'config/entity_registry/list') return Object.values(visualFixture.entities);
    if (message.type === 'houseplan/content/sign') {
      return { urls: Object.fromEntries((message.paths || []).map((path) =>
        [path, '/assets/f1.svg?authSig=continuity'])) };
    }
    return originalCallWS.call(originalHass, message);
  };
  card._serverCfg = visualFixture.config;
  card._layout = visualFixture.layout;
  card._space = 'golden-lighting';
  // This fixture starts after a same-route space choice. #131 deliberately
  // refuses to treat the class initializer/current id as cold-start intent;
  // mark this injected selection as already adopted navigation so the reload
  // exercises continuity instead of cold-start precedence.
  card._navApplied = true;
  card._regSignature = '';
  card.hass = {
    ...card.hass,
    states: visualFixture.states,
    entities: visualFixture.entities,
    devices: visualFixture.devices,
    areas: visualFixture.areas,
    callWS: fixtureCallWS,
  };
  await card.updateComplete;
  card.requestUpdate();

  await waitUntil(() => !card._booting
    && root().querySelector('.stage')
    && root().querySelector('ha-card')?.dataset.frameFingerprint
    && root().querySelector('.glow-pools')
    && root().querySelector('.sunlayer')
    && root().querySelector('image[href*="authSig=continuity"]'));

  const stage = root().querySelector('.stage');
  const before = {
    rooms: stage.querySelectorAll('.room').length,
    viewBox: stage.querySelector('.zoomwrap > svg')?.getAttribute('viewBox'),
    fingerprint: root().querySelector('ha-card')?.dataset.frameFingerprint || '',
    snapshot: root().querySelector('ha-card')?.dataset.deviceSnapshotSequence || '',
    token: Number(root().querySelector('ha-card')?.dataset.continuityToken || 0),
  };
  out.hasCompleteBaseline = before.rooms > 0 && !!before.viewBox && !!before.fingerprint
    && !!before.snapshot;
  const fixtureLayers = {
    wallbody: !!stage.querySelector('.wallbody'),
    opening: !!stage.querySelector('.opening'),
    glow: !!stage.querySelector('.glow-pools'),
    sun: !!stage.querySelector('.sunlayer'),
    decor: !!stage.querySelector('.decorlayer'),
    backdrop: !!stage.querySelector('image[href*="authSig=continuity"]'),
    devices: stage.querySelectorAll('.dev').length > 0,
  };
  out.fixtureCoversCriticalLayers = Object.values(fixtureLayers).every(Boolean);
  out.fixtureLayerDiagnostics = fixtureLayers;

  // Exercise the production Document listener, not the card's private callback.
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(requestAnimationFrame);
  const afterQuick = root().querySelector('ha-card');
  out.quickReturnSteady = afterQuick?.dataset.continuityState === 'steady';
  out.quickReturnKeepsToken = Number(afterQuick?.dataset.continuityToken || 0) === before.token;

  // Long return may revalidate asynchronously. Sample every presented frame.
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  const samples = [];
  await new Promise((done) => {
    let left = 36;
    const sample = () => {
      const liveStage = root().querySelector('.stage');
      const zoom = liveStage?.querySelector('.zoomwrap');
      const computed = zoom ? getComputedStyle(zoom) : null;
      const host = root().querySelector('ha-card');
      const svg = liveStage?.querySelector('.zoomwrap > svg');
      const stageRect = liveStage?.getBoundingClientRect();
      const svgRect = svg?.getBoundingClientRect();
      samples.push({
        rooms: liveStage?.querySelectorAll('.room').length || 0,
        viewBox: liveStage?.querySelector('.zoomwrap > svg')?.getAttribute('viewBox') || '',
        visible: !!computed && computed.display !== 'none' && computed.visibility !== 'hidden',
        overlay: !!root().querySelector('.recoveryoverlay'),
        state: host?.dataset.continuityState || '',
        token: Number(host?.dataset.continuityToken || 0),
        fingerprint: host?.dataset.frameFingerprint || '',
        snapshot: host?.dataset.deviceSnapshotSequence || '',
        href: liveStage?.querySelector('image')?.getAttribute('href') || '',
        blend: liveStage?.querySelector('.glow-pools')?.getAttribute('data-blend') || '',
        stageBox: stageRect ? [stageRect.x, stageRect.y, stageRect.width, stageRect.height] : [],
        svgBox: svgRect ? [svgRect.x, svgRect.y, svgRect.width, svgRect.height] : [],
      });
      if (--left > 0) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });
  out.longReturnNeverHidesPlan = samples.every((sample) => sample.visible);
  out.longReturnNeverEmptiesPlan = samples.every((sample) => sample.rooms > 0);
  out.longReturnKeepsViewport = samples.every((sample) => sample.viewBox === before.viewBox);
  out.staleFrameNeedsNoOverlay = samples.every((sample) => !sample.overlay);
  out.noLegacyResumeClass = !root().querySelector('.stage.hpresume');
  out.productionAttributesPresent = samples.every((sample) => !!sample.state);
  out.longResumeAdvancesToken = samples.some((sample) => sample.token > before.token);
  out.frameSamplerHasRequiredFacts = samples.every((sample) => sample.fingerprint
    && sample.snapshot && sample.href.includes('authSig=continuity')
    && ['screen', 'normal'].includes(sample.blend)
    && sample.stageBox.length === 4 && sample.svgBox.length === 4);

  await waitUntil(() => root().querySelector('ha-card')?.dataset.continuityState === 'steady');
  out.longResumeEndsSteady = root().querySelector('ha-card')?.dataset.continuityState === 'steady'
    && !root().querySelector('.recoveryoverlay');

  const trace = card.houseplanContinuityTrace?.() || [];
  out.traceIsBoundedAndRedacted = trace.length > 0 && trace.length <= 80
    && !JSON.stringify(trace).includes('/api/houseplan/content/');
  out.productionListenerReachedController = trace.some((event) =>
    event.event === 'candidate-start' && event.reason === 'pageshow');
  return out;
}, fixture);

for (const [name, value] of Object.entries(result)) {
  if (name !== 'fixtureLayerDiagnostics') check(name, value);
}

const second = await launch({ width: 900, height: 900 }, 1);
const doors = await second.page.evaluate(async () => {
  const out = {};
  const T = window.__hpTest;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // longer than the longest leaf transition (0.6 s)
  const settle = async () => { for (let i = 0; i < 10; i++) await frame(); await sleep(900); };
  const waitUntil = async (predicate, ms = 6000) => {
    const deadline = performance.now() + ms;
    while (!predicate() && performance.now() < deadline) await sleep(16);
    return !!predicate();
  };
  let card = window.__card;
  const wall = { id: 'hp813-wall', a: [0.15, 0.3], b: [0.85, 0.3], cm: 15 };
  const door = (id, t, contact) => ({
    id, type: 'door', length: 0.06, contact, host: { kind: 'partition', id: wall.id, t },
  });
  const contact = (name) => `binary_sensor.hp813_${name}`;
  /** Known to the registry and to HA, read by no opening, no room and no marker. */
  const sensor = (name, state) => window.__addRegistryEntity(contact(name), null, state);
  const withSpace = (cfg, id, edit) => {
    const space = cfg.spaces.find((item) => item.id === id);
    space.cell_cm = 5;
    space.settings = { ...(space.settings || {}), show_borders: true, hide_openings: false };
    space.partitions = [{ ...wall }];
    edit(space);
    return cfg;
  };

  sensor('old', 'off');
  sensor('garden', 'off');
  await T.setServerConfig((cfg) => {
    withSpace(cfg, 'f1', (space) => { space.openings = [door('hp813-old', 0.12, contact('old'))]; });
    withSpace(cfg, 'garden', (space) => { space.openings = [door('hp813-garden', 0.5, contact('garden'))]; });
  });
  const host = document.createElement('div');
  host.style.width = '600px';
  document.body.appendChild(host);
  const spaceCard = () => {
    const el = document.createElement('houseplan-space-card');
    el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
    return el;
  };
  let el = spaceCard();
  const tick = () => {
    card.hass = window.__mkHass();
    el.hass = card.hass;
  };
  tick();
  host.appendChild(el);
  const roots = () => [['space', el.renderRoot], ['main', card.renderRoot]].filter(([, root]) => root);
  /** Leaf angle of every door the card draws; null while the stage is veiled. */
  const doorsOf = (root) => {
    const stage = root.querySelector('.stage, .hp-static-stage');
    if (!stage || getComputedStyle(stage).visibility === 'hidden') return null;
    return Object.fromEntries([...root.querySelectorAll('[data-hp="opening"]')].map((node) => {
      const leaf = node.querySelector('.op-leaf');
      const matrix = leaf ? getComputedStyle(leaf).transform : 'none';
      const [a, b] = matrix.startsWith('matrix(') ? matrix.slice(7, -1).split(',').map(Number) : [1, 0];
      return [node.dataset.id, Math.round(Math.atan2(b, a) * 180 / Math.PI)];
    }));
  };
  const look = () => Object.fromEntries(roots().map(([name, root]) => [name, doorsOf(root)]));
  const drawn = (name, id) => look()[name]?.[id] !== undefined;
  /**
   * Every presented frame from now until the doors settle, plus the leaf
   * transitions that started on the watched doors. `onFrame` may act inside a
   * frame (the newer-event case).
   */
  const watch = (ids, onFrame = null) => {
    const frames = [];
    const ran = [];
    const listening = new AbortController();
    const listen = new Set();
    const attach = () => {
      for (const [name, root] of roots()) {
        if (listen.has(root)) continue;
        listen.add(root);
        root.addEventListener('transitionrun', (event) => {
          const owner = event.target.closest?.('[data-hp="opening"]');
          if (owner && ids.includes(owner.dataset.id)) {
            ran.push(`${name}:${owner.dataset.id}:${event.propertyName}`);
          }
        }, { signal: listening.signal });
      }
    };
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        attach();
        frames.push(look());
        onFrame?.(frames.at(-1));
        await frame();
      }
    })();
    return {
      async stop() {
        await settle();
        sampling = false;
        await sampler;
        listening.abort();
        const final = look();
        const wrong = new Set();
        const split = new Set();
        const existing = new Set();
        for (const [name, seen] of Object.entries(final)) {
          for (const id of ids) {
            if (seen?.[id] === undefined) wrong.add(`${name}:${id} never drawn`);
          }
        }
        for (const sample of frames) {
          for (const [name, seen] of Object.entries(sample)) {
            if (!seen) continue;
            const present = ids.filter((id) => seen[id] !== undefined);
            if (present.length && present.length !== ids.length) split.add(`${name}: ${present.join(',')}`);
            for (const id of present) {
              if (seen[id] !== final[name]?.[id]) wrong.add(`${name}:${id} ${seen[id]}° before ${final[name]?.[id]}°`);
            }
            const old = seen['hp813-old'];
            if (old !== undefined && final[name]?.['hp813-old'] !== undefined && old !== final[name]['hp813-old']) {
              existing.add(`${name}:hp813-old ${old}°`);
            }
          }
        }
        // The first few wrong frames are the evidence; the rest repeat them.
        return {
          ran: [...new Set(ran)], wrong: [...wrong].slice(0, 6), split: [...split], existing: [...existing],
          frames: frames.length, final,
        };
      },
    };
  };
  await waitUntil(() => drawn('space', 'hp813-old') && drawn('main', 'hp813-old'));
  await settle();
  const pushDoors = (doors) => T.setServerConfig((cfg) => withSpace(cfg, 'f1', (space) => {
    space.openings = [...space.openings, ...doors];
  }));
  const report = {};

  // AC3: a closed sensor the old snapshot never held.
  sensor('closed', 'off');
  tick();
  await settle();
  out.newContactAbsentFromTheOldProjection = !el._renderDeviceSnapshot?.entityIds.includes(contact('closed'))
    && !card._renderDeviceSnapshot?.entityIds.includes(contact('closed'));
  let watching = watch(['hp813-closed']);
  await pushDoors([door('hp813-closed', 0.3, contact('closed'))]);
  report.closed = await watching.stop();
  out.newClosedDoorClosedFromItsFirstFrame = report.closed.wrong;
  out.newClosedDoorNeverAnimates = report.closed.ran;
  out.newClosedDoorSettlesClosed = report.closed.final.space?.['hp813-closed'] === 0
    && report.closed.final.main?.['hp813-closed'] === 0;
  out.existingDoorUntouchedByTheNewOne = report.closed.existing;

  // AC4: an open sensor, a missing one, unknown and unavailable — each drawn
  // with its existing meaning from the first frame (doors: open by default).
  sensor('open', 'on');
  sensor('unknown', 'unknown');
  sensor('unavailable', 'unavailable');
  tick();
  await settle();
  const states = ['hp813-open', 'hp813-missing', 'hp813-unknown', 'hp813-unavailable'];
  watching = watch(states);
  await pushDoors([
    door('hp813-open', 0.45, contact('open')),
    door('hp813-missing', 0.55, contact('missing')),
    door('hp813-unknown', 0.65, contact('unknown')),
    door('hp813-unavailable', 0.75, contact('unavailable')),
  ]);
  report.states = await watching.stop();
  out.newDoorsShowTheirStateFromTheFirstFrame = report.states.wrong;
  out.newDoorsAppearTogether = report.states.split;
  out.newDoorsNeverAnimate = report.states.ran;
  out.newDoorsKeepTheExistingStateMeaning = ['space', 'main'].every((name) =>
    states.every((id) => report.states.final[name]?.[id] === -90))
    || JSON.stringify(report.states.final);
  out.existingDoorUntouchedByStateMatrix = report.states.existing;

  // AC4: a real change of an opening already on the plan still animates.
  const setContact = (name, state) => {
    const id = contact(name);
    card.hass = { ...card.hass, states: { ...card.hass.states,
      [id]: { ...card.hass.states[id], state } } };
    el.hass = card.hass;
  };
  watching = watch(['hp813-closed']);
  setContact('closed', 'on');
  report.opened = await watching.stop();
  out.realOpeningAnimatesInBothCards = ['space', 'main'].every((name) =>
    report.opened.ran.includes(`${name}:hp813-closed:transform`)) || JSON.stringify(report.opened.ran);
  out.realOpeningEndsOpen = report.opened.final.space?.['hp813-closed'] === -90
    && report.opened.final.main?.['hp813-closed'] === -90;
  watching = watch(['hp813-closed']);
  setContact('closed', 'off');
  report.reclosed = await watching.stop();
  out.realClosingAnimatesInBothCards = ['space', 'main'].every((name) =>
    report.reclosed.ran.includes(`${name}:hp813-closed:transform`)) || JSON.stringify(report.reclosed.ran);
  out.realClosingEndsClosed = report.reclosed.final.space?.['hp813-closed'] === 0
    && report.reclosed.final.main?.['hp813-closed'] === 0;

  // AC4: a newer config event while the first candidate waits for its paint
  // barrier. The second push leaves inside the very frame that first shows the
  // door of the first one.
  sensor('first', 'off');
  sensor('second', 'off');
  tick();
  await settle();
  const base = structuredClone(card._serverCfg);
  const first = withSpace(structuredClone(base), 'f1', (space) => {
    space.openings = [...space.openings, door('hp813-first', 0.85, contact('first'))];
  });
  const newer = withSpace(structuredClone(first), 'f1', (space) => {
    space.openings = [...space.openings, door('hp813-second', 0.92, contact('second'))];
  });
  let pushedNewer = false;
  watching = watch(['hp813-first'], (sample) => {
    if (pushedNewer || sample.space?.['hp813-first'] === undefined) return;
    pushedNewer = true;
    window.__pushServerConfig(newer);
  });
  window.__pushServerConfig(first);
  await waitUntil(() => drawn('space', 'hp813-second') && drawn('main', 'hp813-second'));
  report.newer = await watching.stop();
  out.newerEventReachedTheWaitingCandidate = pushedNewer;
  out.newerEventNeverRepaintsTheDoorOpen = report.newer.wrong;
  out.newerEventNeverAnimatesTheDoor = report.newer.ran;
  out.newerEventSettlesOnTheNewestPlan = drawn('space', 'hp813-second') && drawn('main', 'hp813-second')
    && look().space['hp813-second'] === 0 && look().main['hp813-second'] === 0;

  // AC4: a space switch of the same static card (setConfig) to a floor whose
  // door the previous projection never held.
  watching = watch(['hp813-garden']);
  const switched = el;
  switched.setConfig({ type: 'custom:houseplan-space-card', space: 'garden', show_button: false });
  await waitUntil(() => drawn('space', 'hp813-garden'));
  report.garden = await watching.stop();
  out.spaceSwitchShowsTheDoorClosed = report.garden.wrong.filter((line) => line.startsWith('space:'));
  out.spaceSwitchNeverAnimates = report.garden.ran;
  out.spaceSwitchSettlesClosed = report.garden.final.space?.['hp813-garden'] === 0;
  switched.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
  await waitUntil(() => drawn('space', 'hp813-old'));
  await settle();

  // AC4: warm remount — both cards are rebuilt while another client adds a
  // door; the new instances start from the cached plan and then read the new one.
  sensor('remount', 'off');
  tick();
  await settle();
  const before = structuredClone(card._serverCfg);
  el.remove();
  card.remove();
  window.__pushServerConfig(withSpace(before, 'f1', (space) => {
    space.openings = [...space.openings, door('hp813-remount', 0.2, contact('remount'))];
  }));
  const mainHost = document.getElementById('host');
  card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
  el = spaceCard();
  watching = watch(['hp813-remount']);
  mainHost.appendChild(card);
  host.appendChild(el);
  tick();
  window.__card = card;
  await waitUntil(() => drawn('space', 'hp813-remount') && drawn('main', 'hp813-remount'), 9000);
  report.remount = await watching.stop();
  out.warmRemountShowsTheNewDoorClosed = report.remount.wrong;
  out.warmRemountNeverAnimatesTheDoor = report.remount.ran;
  out.warmRemountSettlesClosed = report.remount.final.space?.['hp813-remount'] === 0
    && report.remount.final.main?.['hp813-remount'] === 0;
  out.framesSampledEveryTime = Object.values(report).every((entry) => entry.frames >= 8)
    || JSON.stringify(Object.fromEntries(Object.entries(report).map(([key, entry]) => [key, entry.frames])));
  host.remove();
  return out;
});
await second.browser.close();
checkAll(doors, {
  newClosedDoorClosedFromItsFirstFrame: [], newClosedDoorNeverAnimates: [], existingDoorUntouchedByTheNewOne: [],
  newDoorsShowTheirStateFromTheFirstFrame: [], newDoorsAppearTogether: [], newDoorsNeverAnimate: [],
  existingDoorUntouchedByStateMatrix: [], newerEventNeverRepaintsTheDoorOpen: [], newerEventNeverAnimatesTheDoor: [],
  spaceSwitchShowsTheDoorClosed: [], spaceSwitchNeverAnimates: [], warmRemountShowsTheNewDoorClosed: [],
  warmRemountNeverAnimatesTheDoor: [],
});
await finish(browser, { ...result, doors });
