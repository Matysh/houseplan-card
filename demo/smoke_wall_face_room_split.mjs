/** #874: composite closure through native Walls clicks, room Save and HA writes.
 * Seed construction uses test-build (compile tsconfig.test.json before running).
 */
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual as equal } from 'node:util';
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { setWallThickness } from '../test-build/wall-thickness.js';
import { polygonArea, distToSegment } from '../test-build/logic.js';
import { checkReferences, checkWallKeys, checkMixedRoleRecords,
  checkHiddenObstacles, checkPhysicalGeometry } from '../scripts/model-invariants.mjs';

const fixture = JSON.parse(readFileSync(new URL('../test/fixtures/874-room-closure.json', import.meta.url)));
function seed({ added = false, duplicate = false, oldCm = 25, newCm = 15, opening = false } = {}) {
  const rooms = [{ id: 'parent', name: 'Parent', area: 'synthetic-parent',
    settings: { name_size: 1.2 }, poly: fixture.parent },
  { id: 'neighbor', name: 'Neighbor', area: null, poly: fixture.neighbor }];
  let walls = [];
  for (const room of rooms) room.poly.forEach((a, i) => {
    walls = setWallThickness(walls, a, room.poly[(i + 1) % room.poly.length], 30, 1 / 240, 1);
  });
  const old = { ...fixture.oldWall, cm: oldCm }, fresh = { ...fixture.addedWall, cm: newCm };
  const openingX = opening === 'residual' ? -.2 : .5;
  const config = commitWallSegmentModel({ settings: {}, markers: [{ id: 'virtual-parent', binding: 'virtual', room_id: 'parent',
    name: 'Synthetic marker', space: 'closure', x: -.5, y: -2 }], spaces: [{
    id: 'closure', title: 'Closure', cell_cm: 1.5, view_box: [-3.2, -3, 4.8, 4.5],
    rooms, walls, partitions: [...added ? [old, fresh] : [old],
      { id: 'unrelated-coincident', a: [-2.95, -2.2], b: [-2.95, -1.8], cm: 30 }],
    openings: opening ? [{ id: 'retained-opening', type: 'window', x: openingX,
      y: old.a[1], length: .1, angle: 0,
      host: { kind: 'partition', id: old.id, t: (old.a[0] - openingX) / (old.a[0] - old.b[0]) },
      contact: 'binary_sensor.synthetic', future_field: { keep: true } }] : [],
  }, { id: 'other-floor', title: 'Other', cell_cm: 8, rooms: [], wall_segments: [],
    partitions: [{ id: 'unrelated', a: [0, 0], b: [1, 0], cm: 15 }] }] }).config;
  if (duplicate) config.spaces[0].wall_segments.push(structuredClone(config.spaces[0].wall_segments[0]));
  return config;
}
const geometry = config => ({ markers: config.markers, spaces: config.spaces });
const results = {};
let lastBrowser;
async function scenario(name, config, body) {
  if (process.env.HP_CLOSURE_SCENARIO && !name.includes(process.env.HP_CLOSURE_SCENARIO)) return;
  console.log(`SCENARIO ${name}`);
  const { browser, page } = await launch({ width: 1600, height: 1100 });
  lastBrowser = browser;
  page.setDefaultTimeout(10000);
  try {
    await page.evaluate(async config => {
      await window.__hpTest.setServerConfig(config);
      await window.__hpTest.setLayout({ 'virtual-parent': { s: 'closure', x: -.5, y: -2 } });
      await window.__hpTest.switchSpace('closure');
      await window.__hpTest.setMode('plan');
      await window.__hpTest.setTool('draw');
      await new Promise(resolve => setTimeout(resolve, 500));
      await window.__hpTest.settled();
      const card = window.__card, fallback = card.hass.callWS.bind(card.hass);
      const state = { saved: structuredClone(card._serverCfg), rev: card._cfgRev, writes: 0, rejected: 0, external: false };
      card.hass = { ...card.hass, callWS: async message => {
        if (message.type === 'houseplan/config/get') {
          if (state.external) {
            const response = await fallback(message);
            state.saved = structuredClone(response.config); state.rev = response.rev;
            return response;
          }
          return { config: structuredClone(state.saved), rev: state.rev, can_write: true };
        }
        if (message.type !== 'houseplan/config/set') return fallback(message);
        for (const oldSpace of state.saved.spaces) for (const opening of oldSpace.openings || []) {
          const next = message.config.spaces.find(s => s.id === oldSpace.id)?.openings?.find(o => o.id === opening.id);
          if (opening.host?.kind === 'partition' && next
              && (next.host?.kind !== 'partition' || next.host.id !== opening.host.id)) {
            state.rejected++;
            throw Object.assign(new Error('surviving partition opening cannot change its host'), { code: 'invalid_format' });
          }
        }
        state.saved = structuredClone(message.config); state.writes++;
        return { ok: true, rev: ++state.rev };
      } };
      window.__closureSmoke = state;
    }, config);
    const output = await body(page);
    results[name] = output;
    for (const [key, value] of Object.entries(output)) check(`${name}: ${key}`, value);
  } catch (error) {
    console.error(error.stack || error.message);
    console.error(await page.evaluate(() => ({ toast: window.__card._toast,
      batch: window.__card._wallFaceBatch, path: window.__card._path, roomDialog: window.__card._roomDialog })));
    results[name] = { completed: false };
    check(`${name}: completed`, false);
  } finally { await browser.close(); }
}
async function click(page, point) {
  const screen = await page.evaluate(point => {
    const card = window.__card, rect = card.renderRoot.querySelector('.stage').getBoundingClientRect(), view = card._view;
    return { x: rect.left + (point[0] * 1000 - view.x) / view.w * rect.width,
      y: rect.top + (point[1] * 1000 - view.y) / view.h * rect.height };
  }, point);
  await page.mouse.click(screen.x, screen.y);
  await page.evaluate(() => window.__hpTest.settled());
}
async function draw(page) {
  await click(page, fixture.addedWall.a);
  await click(page, fixture.addedWall.b);
  await settle(page);
}
const dialog = page => page.locator('[data-hp="dialog"][data-kind="room"]');
async function save(page) {
  await dialog(page).waitFor({ state: 'visible' });
  await dialog(page).locator('#room-name').fill('Child');
  await dialog(page).locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  await settle(page);
}
async function settle(page) {
  await page.waitForTimeout(800);
  await page.waitForFunction(() => window.__card._writesPending === 0);
  await page.evaluate(() => window.__hpTest.settled());
}
const snapshot = page => page.evaluate(() => ({ config: structuredClone(window.__card._serverCfg),
  history: window.__card._geometryHistory.size, dialog: window.__card._roomDialog,
  batch: !!window.__card._wallFaceBatch, path: window.__card._path.length,
  layout: structuredClone(window.__card._layout), server: structuredClone(window.__closureSmoke) }));
const validIds = space => {
  const catalog = new Set(space.wall_segments.map(w => w.id));
  const ids = [...space.wall_segments, ...space.partitions || []].map(w => w.id);
  return new Set(ids).size === ids.length && space.rooms.every(r => r.poly.length === r.wall_ids.length
    && r.wall_ids.every(id => catalog.has(id)));
};

await scenario('Native reported drawing and Undo Redo', seed(), async page => {
  await draw(page);
  const before = await snapshot(page);
  await save(page);
  const after = await snapshot(page), space = after.config.spaces[0];
  const parent = space.rooms.find(r => r.id === 'parent'), child = space.rooms.find(r => r.name === 'Child');
  const violations = [...checkReferences({ config: after.config, layout: after.layout }),
    ...checkWallKeys(after.config), ...checkMixedRoleRecords(after.config),
    ...checkHiddenObstacles(after.config), ...checkPhysicalGeometry(after.config)];
  if (violations.length) console.error('Model invariants after native Save', violations);
  const covers = (w, a, b) => {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
    return [a, b].every(p => Math.abs((p[0] - w.a[0]) * dy - (p[1] - w.a[1]) * dx) < 1e-8);
  };
  const out = {
    smallerRoomCreated: !!child && space.rooms.length === 3 && polygonArea(parent.poly) > polygonArea(child.poly),
    areaConserved: !!child && Math.abs(polygonArea(parent.poly) + polygonArea(child.poly) - polygonArea(fixture.parent)) < 1e-8,
    parentBindingRetained: parent.area === 'synthetic-parent' && equal(parent.settings, before.config.spaces[0].rooms[0].settings),
    positionsAndOtherFloorRetained: equal(after.layout, before.layout) && equal(after.config.markers, before.config.markers)
      && equal(after.config.spaces[1], before.config.spaces[1]),
    neighborGeometryRetained: (() => {
      const old = before.config.spaces[0].rooms[1].poly, next = space.rooms.find(r => r.id === 'neighbor').poly;
      return Math.abs(polygonArea(old) - polygonArea(next)) < 1e-9 && next.every(p => old.some((a, i) =>
        distToSegment(p, [...a, ...old[(i + 1) % old.length]]) < 1e-9))
        && old.every(p => next.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9));
    })(),
    originalCarrier25cm: space.wall_segments.some(w => covers(w, fixture.oldWall.a, fixture.oldWall.b) && w.cm === 25),
    newCut15cm: space.wall_segments.some(w => Math.abs(w.a[0] - .125) < 1e-8 && Math.abs(w.b[0] - .125) < 1e-8 && w.cm === 15),
    residualCarrierRetained: (space.partitions || []).some(w => w.id === 'old-carrier' && w.cm === 25),
    unrelatedCarrierRetained: equal(space.partitions.find(w => w.id === 'unrelated-coincident'),
      before.config.spaces[0].partitions.find(w => w.id === 'unrelated-coincident')),
    savedOnceAndAtomicHistory: after.server.writes === before.server.writes + 1 && after.history === before.history + 1,
    canonicalIdsValid: validIds(space), dialogClosed: !after.dialog && !after.batch,
    persistedGeometry: equal(geometry(after.server.saved), geometry(after.config)),
    modelInvariantsAfterSave: violations.length === 0,
  };
  const historyButton = icon => page.locator('[data-hp="toolbar"][data-kind="plan"] button')
    .filter({ has: page.locator(`ha-icon[icon="mdi:${icon}-variant"]`) });
  await historyButton('undo').click(); await settle(page);
  out.undoRestoresExactGeometry = equal(geometry((await snapshot(page)).config), geometry(before.config));
  await historyButton('redo').click(); await settle(page);
  out.redoRestoresExactGeometry = equal(geometry((await snapshot(page)).config), geometry(after.config));
  // A new instance reads durable state through the real config/get lifecycle.
  await page.evaluate(() => {
    const old = window.__card, next = document.createElement('houseplan-card');
    next.setConfig({ type: 'custom:houseplan-card' }); next.hass = old.hass;
    old.replaceWith(next); window.__card = next;
  });
  await page.waitForFunction(() => window.__card._serverCfg?.spaces?.[0]?.rooms?.length === 3);
  out.coldCardReadsExactSavedGeometry = equal(geometry((await snapshot(page)).config), geometry(after.config));
  return out;
});

for (const [cm, newCm] of [[0, 15], [25, 15], [25, 0]]) await scenario(`Existing composite with ${cm}/${newCm}cm carriers`, seed({ added: true, oldCm: cm, newCm }), async page => {
  await click(page, [.5, -.8]);
  await save(page);
  const after = await snapshot(page), space = after.config.spaces[0];
  return { created: space.rooms.length === 3 && !after.dialog,
    sourceCmPreserved: space.wall_segments.some(w => w.cm === cm && Math.abs(w.a[1] - fixture.oldWall.a[1]) < 1e-8
      && Math.abs(w.b[1] - fixture.oldWall.a[1]) < 1e-8 && w.a[0] >= .12 && w.b[0] >= .12),
    cutCmPreserved: space.wall_segments.some(w => w.cm === newCm && Math.abs(w.a[0] - fixture.addedWall.a[0]) < 1e-8
      && Math.abs(w.b[0] - fixture.addedWall.a[0]) < 1e-8),
    identitiesValid: validIds(space) };
});

await scenario('Cancel native new drawing retains saved walls', seed(), async page => {
  await draw(page);
  const before = await snapshot(page);
  await page.evaluate(() => window.__hpTest.close(window.__card.renderRoot.querySelector('[data-hp="dialog"][data-kind="room"]'), { via: 'cancel' }));
  await settle(page);
  const after = await snapshot(page);
  return { wallsAndParentRetained: equal(geometry(after.config), geometry(before.config)),
    noWriteOrHistory: after.server.writes === before.server.writes && after.history === before.history, closed: !after.dialog };
});

for (const via of ['cancel', 'x', 'escape', 'keep']) await scenario(`Cancel ${via}`, seed({ added: true }), async page => {
  const before = await snapshot(page);
  await click(page, [.5, -.8]);
  await dialog(page).waitFor({ state: 'visible' });
  if (via === 'keep') await dialog(page).locator('[data-hp="dialog-confirm"]').filter({ hasText: 'Keep as walls' }).click();
  else await page.evaluate(via => window.__hpTest.close(window.__card.renderRoot.querySelector('[data-hp="dialog"][data-kind="room"]'), { via }), via);
  await settle(page);
  const after = await snapshot(page);
  return { noGeometryWrite: equal(geometry(after.config), geometry(before.config)) && after.server.writes === before.server.writes,
    noHistoryEntry: after.history === before.history, closed: !after.dialog };
});

await scenario('Synchronous refusal does not leave inert Save', seed({ added: true, duplicate: true }), async page => {
  const before = await snapshot(page);
  await click(page, [.5, -.8]); await save(page);
  const after = await snapshot(page);
  await click(page, [.5, -.8]);
  const retry = await snapshot(page);
  return { geometryRolledBack: equal(geometry(after.config), geometry(before.config)),
    noWriteOrHistory: after.server.writes === before.server.writes && after.history === before.history,
    noInertDialog: !after.dialog && !after.batch && !after.path,
    explicitClickOffersFreshDraft: retry.dialog && retry.batch };
});

await scenario('Asynchronous forbidden opening host preserves original', seed({ added: true, opening: true }), async page => {
  const before = await snapshot(page);
  await click(page, [.5, -.8]); await save(page);
  const after = await snapshot(page);
  return { backendRefused: after.server.rejected === 1,
    noGhostRoomOrLostOpening: equal(geometry(after.config), geometry(before.config)),
    noAcceptedWriteOrHistory: after.server.writes === 0 && after.history === before.history,
    dialogClosed: !after.dialog && !after.batch };
});

await scenario('Residual opening remains on its original carrier', seed({ added: true, opening: 'residual' }), async page => {
  const before = await snapshot(page);
  await click(page, [.5, -.8]); await save(page);
  const after = await snapshot(page), opening = after.config.spaces[0].openings[0], old = before.config.spaces[0].openings[0];
  const { host: oldHost, ...oldFields } = old, { host, ...fields } = opening;
  return { acceptedRoom: after.config.spaces[0].rooms.length === 3 && after.server.writes === 1,
    openingPreserved: equal(fields, oldFields) && host.kind === oldHost.kind && host.id === oldHost.id,
    identityValid: validIds(after.config.spaces[0]) };
});

await scenario('Stale proposal refuses changed geometry', seed({ added: true }), async page => {
  await click(page, [.5, -.8]);
  const changed = (await snapshot(page)).config;
  changed.spaces[0].partitions.push({ id: 'changed-while-naming', a: [-2, -2], b: [-1, -2], cm: 15 });
  await page.evaluate(config => { window.__closureSmoke.external = true; return window.__hpTest.setServerConfig(config); }, changed);
  await settle(page);
  const before = await snapshot(page);
  if (before.dialog) await save(page);
  const after = await snapshot(page);
  return { newerGeometryNotOverwritten: equal(geometry(after.config), geometry(changed)),
    noExtraWriteOrHistory: after.server.writes === before.server.writes && after.history === before.history,
    noStaleForm: !after.dialog && !after.batch };
});

await scenario('Apply-time stale geometry race refuses before mutation', seed({ added: true }), async page => {
  await click(page, [.5, -.8]);
  // Unlike the preceding public reload, this negative probe retains the live
  // form to witness the TOCTOU barrier independently of reload cancellation.
  await page.evaluate(() => {
    window.__card._curSpaceCfg.partitions.push({ id: 'injected-race', a: [-2, -2], b: [-1, -2], cm: 15 }); // private-ok: fault injection retains an old proposal while changing its geometry; no happy-path UI is bypassed.
    window.__card._cfgEpoch++; // private-ok: make the injected changed geometry visible to the normal model getter, without replacing the proposal.
  });
  const before = await snapshot(page);
  await save(page);
  const after = await snapshot(page);
  return { geometryNotOverwritten: equal(geometry(after.config), geometry(before.config)),
    noWriteOrHistory: after.server.writes === before.server.writes && after.history === before.history,
    refusedFormClosed: !after.dialog && !after.batch };
});

await finish(lastBrowser, results);
