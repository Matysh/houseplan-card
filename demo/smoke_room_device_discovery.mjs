/** #879: native Save, actual discovery, DOM dots and recorded server writes. */
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

function seed(kind) {
  const rooms = [{ id: 'living', name: 'Living', area: 'living_room',
    poly: [[.05, .1], [.45, .1], [.45, .45], [.05, .45]] }];
  if (kind === 'ordinary') rooms.push({ id: 'unbound', name: 'Unbound', area: null,
    poly: [[.55, .15], [.9, .15], [.9, .45], [.55, .45]] });
  const partitions = kind === 'ordinary' ? [] : [
    { id: 'top', a: [.55, .15], b: [.9, .15], cm: 15 },
    { id: 'right', a: [.9, .15], b: [.9, .45], cm: 15 },
    { id: 'bottom', a: [.9, .45], b: [.55, .45], cm: 15 },
    ...kind === 'multi' ? [{ id: 'middle', a: [.55, .3], b: [.9, .3], cm: 15 }] : [],
  ];
  return commitWallSegmentModel({ settings: { filter_seeded: true,
    known_devices: ['d_light1', 'd_lamp', 'd_tv', 'd_temp'], new_device_ids: ['d_temp', 'd_leak'] },
    markers: [], spaces: [{ id: 'f1', title: 'Floor', cell_cm: 10,
      view_box: [0, 0, 1, 1], rooms, partitions }] }).config;
}
async function click(page, point) {
  const p = await page.evaluate(point => {
    const c = window.__card, rect = c.renderRoot.querySelector('.stage').getBoundingClientRect(), v = c._view;
    return { x: rect.left + (point[0] * 1000 - v.x) / v.w * rect.width,
      y: rect.top + (point[1] * 1000 - v.y) / v.h * rect.height };
  }, point);
  await page.mouse.click(p.x, p.y);
  await page.evaluate(() => window.__hpTest.settled());
}
const dialog = page => page.locator('[data-hp="dialog"][data-kind="room"]');
async function save(page, area, name = 'Created kitchen') {
  await dialog(page).waitFor({ state: 'visible' });
  await dialog(page).locator('#room-name').fill(name);
  await dialog(page).locator('#room-area').selectOption(area);
  await dialog(page).locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
}
async function settled(page) {
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => window.__card._writesPending === 0);
  await page.evaluate(() => window.__hpTest.settled());
}
const results = {};
let lastBrowser;
async function scenario(name, kind, body) {
  if (process.env.HP_ROOM_DISCOVERY_CASE && name !== process.env.HP_ROOM_DISCOVERY_CASE) return;
  const { page, browser } = await launch({ width: 1500, height: 1000 }); lastBrowser = browser;
  page.setDefaultTimeout(10000);
  try {
    await page.evaluate(async config => {
      await window.__hpTest.setServerConfig(config); await window.__hpTest.setLayout({});
      await window.__hpTest.setMode('plan');
      const c = window.__card, h = c.hass;
      c.hass = { ...h, entities: { ...h.entities, 'light.kitchen_group': {
        entity_id: 'light.kitchen_group', platform: 'group', area_id: 'kitchen' } },
      states: { ...h.states, 'light.kitchen_group': { state: 'on', attributes: {
        friendly_name: 'Kitchen group', entity_id: ['light.ceiling'] } } } };
      await window.__hpTest.settled();
    }, seed(kind));
    await settled(page);
    await page.evaluate(() => {
      const c = window.__card, fallback = c.hass.callWS.bind(c.hass);
      const state = { saved: structuredClone(c._serverCfg), rev: c._cfgRev, sets: [],
        delay: false, reject: false, layoutReject: false, pending: false };
      c.hass = { ...c.hass, callWS: async message => {
        if (message.type === 'houseplan/config/get') return {
          config: structuredClone(state.saved), rev: state.rev, can_write: true };
        if (message.type === 'houseplan/layout/update' && state.layoutReject) throw new Error('layout offline');
        if (message.type !== 'houseplan/config/set') return fallback(message);
        const candidate = structuredClone(message.config); state.sets.push(candidate);
        if (candidate.spaces[0].rooms.some(r => r.area === 'kitchen')) {
          if (state.delay) {
            state.pending = true; await new Promise(resolve => { state.release = resolve; }); state.pending = false;
          }
          if (state.reject) throw Object.assign(new Error('conflict probe'), { code: 'conflict' });
        }
        state.saved = candidate; return { ok: true, rev: ++state.rev };
      } };
      window.__discoverySmoke = state;
    });
    await page.evaluate(kind => window.__hpTest.setTool(kind === 'ordinary' ? 'split' : 'draw'), kind);
    await page.waitForTimeout(400);
    for (const point of kind === 'ordinary' ? [[.7, .35], [.7, .15], [.7, .45]]
      : [[.55, .45], [.55, .15]]) await click(page, point);
    await dialog(page).waitFor({ state: 'visible' });
    const out = await body(page); results[name] = out;
    for (const [key, value] of Object.entries(out)) check(name + ': ' + key, value);
  } catch (error) {
    console.error(name, error.stack || error.message);
    console.error(await page.evaluate(() => ({ toast: window.__card._toast,
      path: window.__card._path, batch: window.__card._wallFaceBatch })));
    results[name] = { completed: false }; check(name + ': completed', false);
  } finally { await browser.close(); }
}
const outcome = page => page.evaluate(() => {
  const c = window.__card, state = window.__discoverySmoke;
  return {
    roomCreated: c._curSpaceCfg.rooms.some(r => r.name === 'Created kitchen' && r.area === 'kitchen'),
    deviceVisible: !!c.renderRoot.querySelector('[data-hp="device"][data-id="d_kettle"]'),
    devicePlaced: !!c._layout.d_kettle,
    noNewDot: !c.renderRoot.querySelector('[data-hp="device"][data-id="d_kettle"] .newdot'),
    notNew: !c._serverCfg.settings.new_device_ids.includes('d_kettle'),
    groupNotNew: c._devices.some(d => d.id === 'lg_light.kitchen_group')
      && !c._serverCfg.settings.new_device_ids.includes('lg_light.kitchen_group'),
    acceptedKnown: state.saved.settings.known_devices.includes('d_kettle')
      && state.saved.settings.known_devices.includes('lg_light.kitchen_group'),
    atomicPayload: state.sets.some(cf => cf.spaces[0].rooms.some(r => r.area === 'kitchen')
      && cf.settings.known_devices.includes('d_kettle')),
    oldAttentionRetained: c._serverCfg.settings.new_device_ids.includes('d_temp')
      && c._serverCfg.settings.new_device_ids.includes('d_leak'),
  };
});
for (const kind of ['batch', 'ordinary', 'multi']) await scenario(kind, kind, async page => {
  await save(page, 'kitchen');
  if (kind === 'multi') await save(page, 'bedroom', 'Created bedroom');
  await settled(page);
  const out = await outcome(page);
  if (kind === 'multi') out.secondRoomQuiet = await page.evaluate(() => {
    const c = window.__card;
    return c._curSpaceCfg.rooms.some(r => r.area === 'bedroom')
      && c._serverCfg.settings.known_devices.includes('d_window')
      && !c._serverCfg.settings.new_device_ids.includes('d_window');
  });
  await page.evaluate(() => window.__hpTest.setMode('devices'));
  await page.locator('[data-tool="device-inbox"]').click();
  const row = page.locator('.device-inbox-row[data-binding="device:d_kettle"]');
  out.catalogNotNew = await row.count() === 1 && await row.locator('.device-inbox-new').count() === 0;
  return out;
});
await scenario('cancel', 'batch', async page => {
  await page.evaluate(() => window.__hpTest.close(undefined, { via: 'cancel' })); await settled(page);
  return page.evaluate(() => ({ notAcknowledged: !window.__discoverySmoke.saved.settings.known_devices.includes('d_kettle'),
    noRoom: !window.__card._curSpaceCfg.rooms.some(r => r.area === 'kitchen') }));
});
await scenario('undo-before-write', 'batch', async page => {
  await dialog(page).locator('#room-name').fill('Created kitchen');
  await dialog(page).locator('#room-area').selectOption('kitchen');
  // Deterministic negative probe: execute real button handlers in one task,
  // before the 500ms config debounce, not after Playwright's actionability waits.
  await page.evaluate(async () => {
    const root = window.__card.renderRoot;
    root.querySelector('.dialog-action-commit [data-hp="dialog-confirm"]').click();
    await window.__card.updateComplete;
    root.querySelector('[data-hp="toolbar"][data-kind="plan"] ha-icon[icon="mdi:undo-variant"]')
      .closest('button').click();
  });
  await settled(page);
  return page.evaluate(() => ({
    noSavedRoom: !window.__discoverySmoke.saved.spaces[0].rooms.some(r => r.area === 'kitchen'),
    notAcknowledged: !window.__discoverySmoke.saved.settings.known_devices.includes('d_kettle')
      && !window.__card._serverCfg.settings.known_devices.includes('d_kettle'),
  }));
});
await scenario('reject', 'batch', async page => {
  await page.evaluate(() => { window.__discoverySmoke.reject = true; });
  await save(page, 'kitchen'); await settled(page);
  const out = await page.evaluate(() => ({
    noSavedRoom: !window.__discoverySmoke.saved.spaces[0].rooms.some(r => r.area === 'kitchen'),
    notAcknowledged: !window.__discoverySmoke.saved.settings.known_devices.includes('d_kettle')
      && !window.__card._serverCfg.settings.known_devices.includes('d_kettle'),
    oldMarksRetained: window.__card._serverCfg.settings.new_device_ids.includes('d_temp') }));
  await page.evaluate(() => { window.__discoverySmoke.reject = false; });
  // A rejected physical write rolls back the closing segment as well as the room.
  await click(page, [.55, .45]); await click(page, [.55, .15]);
  await save(page, 'kitchen'); await settled(page);
  out.retryQuiet = (await outcome(page)).notNew;
  return out;
});
await scenario('delayed', 'batch', async page => {
  await page.evaluate(() => { window.__discoverySmoke.delay = true; }); await save(page, 'kitchen');
  await page.waitForFunction(() => window.__discoverySmoke.pending);
  const out = await page.evaluate(async () => {
    const c = window.__card, h = c.hass;
    const firstQuiet = !c._serverCfg.settings.new_device_ids.includes('d_kettle')
      && !c.renderRoot.querySelector('[data-id="d_kettle"] .newdot');
    c.hass = { ...h, devices: { ...h.devices, late_kitchen: { id: 'late_kitchen', name: 'Late plug',
      model: 'Smart Plug', area_id: 'kitchen', identifiers: [['demo', 'late']] } },
      entities: { ...h.entities, 'switch.late_kitchen': { entity_id: 'switch.late_kitchen', device_id: 'late_kitchen', platform: 'demo' } },
      states: { ...h.states, 'switch.late_kitchen': { state: 'off', attributes: { friendly_name: 'Late plug' } } } };
    await window.__hpTest.settled();
    const lateFlagged = c._serverCfg.settings.new_device_ids.includes('late_kitchen')
      && !!c.renderRoot.querySelector('[data-id="late_kitchen"] .newdot');
    window.__discoverySmoke.delay = false; window.__discoverySmoke.release();
    return { firstQuiet, lateFlagged };
  });
  await settled(page);
  out.persistedBoth = await page.evaluate(() => window.__discoverySmoke.saved.settings.known_devices.includes('d_kettle')
    && window.__discoverySmoke.saved.settings.new_device_ids.includes('late_kitchen'));
  return out;
});
await scenario('reload-layout-failure', 'batch', async page => {
  await page.evaluate(() => { window.__discoverySmoke.layoutReject = true; });
  await save(page, 'kitchen'); await settled(page);
  return page.evaluate(async () => {
    const c = window.__card;
    await c._reloadConfigOnly(true); // authoritative read; facade has no reload-only operation
    await window.__hpTest.settled();
    const reloadQuiet = !c._serverCfg.settings.new_device_ids.includes('d_kettle');
    const sets = window.__discoverySmoke.sets.length;
    const second = document.createElement('houseplan-card');
    second.setConfig({ ...c._config }); second.hass = { ...c.hass,
      callWS: async msg => msg.type === 'houseplan/config/get'
        ? { config: structuredClone(window.__discoverySmoke.saved), rev: window.__discoverySmoke.rev, can_write: false }
        : c.hass.callWS(msg) };
    document.body.append(second); await new Promise(resolve => setTimeout(resolve, 900)); await second.updateComplete;
    const secondQuiet = second._loadOk && second._devices.some(d => d.id === 'd_kettle')
      && !second.renderRoot.querySelector('[data-id="d_kettle"] .newdot');
    const readerNoWrites = window.__discoverySmoke.sets.length === sets;
    second.remove();
    return { reloadQuiet, secondQuiet, readerNoWrites,
      durableBaseline: window.__discoverySmoke.saved.settings.known_devices.includes('d_kettle') };
  });
});
await finish(lastBrowser, results);
