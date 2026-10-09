// #803: synthetic before/during/after/cancel pixel oracles for shared/T/X/zero.
import assert from 'node:assert/strict';
import { launch, finish } from './serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
const wall = (id, a, b, cm = 25) => ({ id, a, b, cm });
const config = (partitions, rooms = []) => {
  const cfg = commitWallSegmentModel({ spaces: [{ id: 'topology', title: 'Topology',
    view_box: [0, 0, 1, 1], rooms, partitions, zero_wall_style: 'dashed', future: { intact: true } }], markers: [],
    settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
  for (const wall of cfg.spaces[0].wall_segments) wall.cm = 25;
  return commitWallSegmentModel(cfg).config;
};
const scenarios = [
  { name: 'shared', cfg: config([], [
    { id: 'one', name: 'One', poly: [[.1, .1], [.5, .1], [.5, .5], [.1, .5]] },
    { id: 'two', name: 'Two', poly: [[.5, .1], [.9, .1], [.9, .5], [.5, .5]] },
  ]), point: [.5, .1], target: [.65, .1], old: [.5, .3], changed: [.575, .3] },
  { name: 'T', cfg: config([wall('h', [.1, .4], [.9, .4]), wall('b', [.4, .4], [.4, .8])]),
    point: [.4, .4], target: [.6, .4], old: [.4, .6], changed: [.5, .6] },
  { name: 'X', cfg: config([wall('h', [.1, .5], [.9, .5]), wall('v', [.4, .2], [.4, .8])]),
    point: [.4, .5], target: [.6, .5], old: [.4, .35], changed: [.5, .35] },
  { name: 'zero', cfg: config([wall('zero', [.2, .2], [.8, .2], 0)]),
    point: [.2, .2], target: [.25, .4], old: [.4, .2], changed: [.525, .3] },
];
let server, revision = 1, capability = true, canWrite = true, refused = false, writes = 0;
const { page, browser } = await launch({ width: 1180, height: 920 });
await page.exposeFunction('topologyWire', message => {
  if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision, can_write: canWrite,
    ...(capability ? { wall_node_move_api: 1 } : {}) };
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (message.type !== 'houseplan/wall/node_move') return null;
  assert.equal(message.expected_rev, revision);
  if (refused) throw new Error('backend refused');
  const source = message.direction === 'undo' ? message.before_space : server.spaces[0];
  const nodes = structuralWallNodes(source), node = nodes.find(n => Math.hypot(n.point[0] - message.intent.point[0], n.point[1] - message.intent.point[1]) < 1e-8);
  const moved = applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids), message.intent.target, message.intent.axis);
  assert.equal(moved.ok, true);
  server = commitWallSegmentModel({ ...server, spaces: [message.direction === 'undo' ? source : moved.space] }).config;
  writes++;
  return { config: structuredClone(server), rev: ++revision, ok: true };
});
const mount = async cfg => {
  server = structuredClone(cfg); revision++;
  await page.evaluate(() => {
    const hass = window.__mkHass(), old = hass.callWS.bind(hass);
    const subscribe = hass.connection.subscribeEvents.bind(hass.connection);
    hass.connection = { ...hass.connection, subscribeEvents: async (callback, type) => {
      if (type !== 'houseplan_config_updated') return subscribe(callback, type);
      window.__nodeServerEvent = callback;
      return () => { if (window.__nodeServerEvent === callback) window.__nodeServerEvent = null; };
    } };
    hass.devices = {}; hass.entities = {}; hass.states = {};
    hass.callWS = async m => m.type.endsWith('registry/list') ? [] : (await window.topologyWire(m)) ?? old(m);
    const card = document.createElement('houseplan-card'); card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
    window.__card.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
  });
  await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'topology');
  await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
  await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
};
const screen = p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
  q.x = p[0] * 1000; q.y = p[1] * 1000; const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
const drag = async (point, target) => {
  const start = await screen(point), end = await screen(target);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.preview !== null);
};
const idle = () => page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && !window.__card._editorRuntime.nodeMove.dragging);
const pixels = async (frame, probes) => page.evaluate(async ({ frame, probes }) => {
  const image = await createImageBitmap(new Blob([Uint8Array.from(atob(frame), c => c.charCodeAt(0))], { type: 'image/png' }));
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
  return probes.map(p => [...ctx.getImageData(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5).data]);
}, { frame: frame.toString('base64'), probes });
const difference = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
for (const scenario of scenarios) {
  await mount(scenario.cfg);
  const probes = () => Promise.all([scenario.old, scenario.changed, [.85, .85]].map(screen));
  const end = await screen(scenario.target); await page.mouse.move(end.x, end.y);
  const before = await pixels(await page.screenshot({ animations: 'disabled' }), await probes());
  await drag(scenario.point, scenario.target);
  const ghost = await pixels(await page.screenshot({ animations: 'disabled' }), await probes());
  assert.deepEqual(await page.evaluate(() => window.__card._serverCfg), scenario.cfg, 'preview never enters config');
  if (scenario.name === 'zero') assert.equal(await page.evaluate(() =>
    window.__card.renderRoot.querySelector('.zero-wall:not([data-hp-node-live] .zero-wall)').style.opacity), '0');
  await page.keyboard.press('Escape'); await page.mouse.up(); await idle();
  const cancel = await pixels(await page.screenshot({ animations: 'disabled' }), await probes());
  assert.ok(difference(before[0], cancel[0]) < 1, `${scenario.name}: Esc restores original pixels`);
  assert.ok(difference(before[2], ghost[2]) < 1, `${scenario.name}: unaffected pixels exact`);
  await drag(scenario.point, scenario.target);
  const preview = await page.evaluate(() => structuredClone(window.__card._editorRuntime.nodeMove.preview.sp));
  await page.mouse.up(); await idle();
  assert.deepEqual(server.spaces[0].partitions, preview.partitions);
  assert.deepEqual(server.spaces[0].rooms, preview.rooms);
  const after = await pixels(await page.screenshot({ animations: 'disabled' }), await probes());
  if (scenario.name !== 'zero') {
    assert.ok(difference(before[0], ghost[0]) > 5, `${scenario.name}: old wall translucent`);
    assert.ok(difference(ghost[0], after[0]) > 2, `${scenario.name}: source ghost retires on commit`);
    assert.ok(difference(ghost[1], after[1]) > 2, `${scenario.name}: candidate translucent before commit`);
  }
  await page.keyboard.press('Control+z'); await idle(); assert.deepEqual(server, scenario.cfg);
  await page.keyboard.press('Control+Shift+z'); await idle();
  const accepted = structuredClone(server);
  mkdirSync('artifacts/803-node', { recursive: true });
  writeFileSync(`artifacts/803-node/${scenario.name}-committed.json`, JSON.stringify(accepted));
  await mount(accepted); assert.deepEqual(await page.evaluate(() => window.__card._serverCfg), accepted, 'reload exact');
  if (scenario.name === 'shared') {
    const planBodies = await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('.wallbody-fill')].map(p => p.getAttribute('d')));
    assert.ok(planBodies.length > 0);
    await page.evaluate(() => window.__hpTest.setMode('view'));
    assert.deepEqual(await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('.wallbody-fill')].map(p => p.getAttribute('d'))), planBodies,
      'committed Plan and View use the same physical wall body');
    await page.evaluate(() => {
      const card = document.createElement('houseplan-space-card'); card.id = 'node-static';
      card.setConfig({ type: 'custom:houseplan-space-card', space: 'topology', title: '' });
      card.hass = window.__card.hass; document.body.appendChild(card);
    });
    await page.waitForFunction(() => document.querySelector('#node-static')?.renderRoot.querySelector('.hp-static-stage svg'));
    assert.deepEqual(await page.evaluate(() => document.querySelector('#node-static')._snap.config), accepted,
      'static renderer adopts exact committed IDs/polygons/hosts');
    assert.equal(await page.evaluate(() => document.querySelector('#node-static').renderRoot.querySelectorAll('.hp-node-handle').length), 0);
    await page.evaluate(() => document.querySelector('#node-static').remove());
    await mount({ ...accepted, settings: { ...accepted.settings, volumetric_view: true } });
    await page.evaluate(() => window.__hpTest.setMode('view'));
    await page.waitForFunction(() => window.__card.renderRoot.querySelector('.stage.projection-iso .iso-wall-top'));
    assert.deepEqual(await page.evaluate(() => window.__card._serverCfg.spaces), accepted.spaces,
      '2.5D draws committed geometry, without modifying its carrier');
    assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('.hp-node-handle').length), 0);
    console.log('committed shared node: Plan/View body parity + static exact model + real 2.5D walls passed');
  }
  console.log(`${scenario.name}: before/during/after/cancel + Undo/Redo/reload passed`);
}
// 100 repeated terminals, including accepted moves and Undo. Only a bounded
// current-snapshot graph may be retained; live DOM/masks/sessions all retire.
const cycle = scenarios[3]; await mount(cycle.cfg);
const graphSize = await page.evaluate(() => window.__card._editorRuntime.nodeMove.cache.nodes.length);
for (let i = 0; i < 100; i++) {
  await drag(cycle.point, cycle.target);
  if (i % 2) { await page.mouse.up(); await idle(); await page.keyboard.press('Control+z'); await idle(); }
  else { await page.keyboard.press('Escape'); await page.mouse.up(); await idle(); }
  const state = await page.evaluate(() => {
    const e = window.__card._editorRuntime.nodeMove;
    return [e.liveRoots.length, e.touched.size, e.session, e.cache?.nodes.length || 0];
  });
  assert.deepEqual(state.slice(0, 3), [0, 0, null]); assert.ok(state[3] <= graphSize);
}
assert.deepEqual(server, cycle.cfg);
console.log('100 cancel/commit cycles: live roots/masks/session retired; cache bounded');
// Actual captured mouse + DOM lifecycle/input terminals. The second touch is
// dispatched (not a trusted OS touch); capture loss is the browser's own event.
for (const terminal of ['pointercancel', 'lostcapture', 'second-pointer', 'pagehide', 'tool', 'mode', 'floor', 'disconnect', 'revision', 'acl']) {
  const cfg = structuredClone(cycle.cfg);
  if (terminal === 'floor') cfg.spaces.push({ ...structuredClone(cfg.spaces[0]), id: 'other', title: 'Other' });
  await mount(cfg); await drag(cycle.point, cycle.target);
  const countBefore = writes, revisionBefore = revision;
  if (terminal === 'revision' || terminal === 'acl') {
    revision++;
    if (terminal === 'acl') canWrite = false;
    else server.spaces[0].future.external = 'preserved';
    await page.evaluate(rev => window.__nodeServerEvent({ event_type: 'houseplan_config_updated', data: { rev } }), revision);
    await page.waitForFunction(rev => window.__card._cfgRev === rev, revision);
  } else await page.evaluate(async terminal => {
    const card = window.__card, stage = card._stageEl, pointer = card._editorRuntime.nodeMove.activePointerId;
    if (terminal === 'pointercancel') stage.dispatchEvent(new PointerEvent('pointercancel', { pointerId: pointer, bubbles: true, composed: true }));
    if (terminal === 'lostcapture') stage.releasePointerCapture(pointer);
    if (terminal === 'second-pointer') stage.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: pointer + 1, pointerType: 'touch', isPrimary: false, bubbles: true, composed: true }));
    if (terminal === 'pagehide') window.dispatchEvent(new PageTransitionEvent('pagehide'));
    if (terminal === 'tool') await window.__hpTest.setTool('resize');
    if (terminal === 'mode') await window.__hpTest.setMode('view');
    if (terminal === 'floor') await window.__hpTest.switchSpace('other');
    if (terminal === 'disconnect') { const host = card.parentNode; card.remove(); host.appendChild(card); }
  }, terminal);
  await page.mouse.move(950, 700); await page.mouse.up();
  await page.evaluate(() => window.__hpTest.settled());
  assert.equal(writes, countBefore, `${terminal}: no write from terminal or tail`);
  assert.equal(revision, revisionBefore + Number(terminal === 'revision' || terminal === 'acl'));
  assert.equal(await page.evaluate(() => window.__card._geometryHistory.size), 0, `${terminal}: no history`);
  assert.equal(await page.evaluate(() => !!window.__card._editorRuntime?.nodeMove?.dragging), false);
  assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('[data-hp-node-live]').length), 0);
  assert.deepEqual(server, terminal === 'revision' ? { ...cfg, spaces: [{ ...cfg.spaces[0], future: { intact: true, external: 'preserved' } }] } : cfg);
  canWrite = true;
}
console.log('10 lifecycle/context terminals: no capture tail write/history, external data preserved');
// X plus an extra endpoint is intentionally unsupported, with a localized
// reason and no capture/preview/history/server mutation.
const unsupported = config([wall('h', [.1, .5], [.9, .5]), wall('v', [.5, .1], [.5, .9]), wall('extra', [.5, .5], [.8, .8])]);
await mount(unsupported);
const unsupportedStart = await screen([.5, .5]), unsupportedWrites = writes;
await page.mouse.move(unsupportedStart.x, unsupportedStart.y); await page.mouse.down();
assert.equal(await page.evaluate(() => !!window.__card._editorRuntime.nodeMove.dragging), false);
assert.equal(await page.evaluate(() => window.__card._stageEl.hasPointerCapture(1)), false);
await page.mouse.up(); await page.evaluate(() => window.__hpTest.settled());
assert.equal(await page.evaluate(() => window.__card._toast),
  'This complex through-junction cannot be moved. T and X junctions without extra branches are supported.');
assert.equal(writes, unsupportedWrites); assert.deepEqual(server, unsupported);
assert.equal(await page.evaluate(() => window.__card._geometryHistory.size), 0);
assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('[data-hp-node-live]').length), 0);
// Legacy input remains legacy on read/hover/preview/cancel; only its isolated
// gesture snapshot materializes IDs. JSON export/import also retains unknowns.
const legacy = structuredClone(cycle.cfg); delete legacy.spaces[0].wall_segments;
await mount(legacy); const legacyBefore = await page.evaluate(() => structuredClone(window.__card._serverCfg));
const legacyWrites = writes; await drag(cycle.point, cycle.target);
await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.mouse.up();
assert.deepEqual(await page.evaluate(() => window.__card._serverCfg), legacyBefore);
assert.deepEqual(server, legacy); assert.equal(writes, legacyWrites);
await mount(JSON.parse(JSON.stringify(legacy))); assert.deepEqual(server, legacy);
console.log('unsupported X+branch and legacy preview/cancel/import guards passed');
await mount(cycle.cfg);
// Undo during drag cancels the gesture, not the older completed command.
await drag(cycle.point, cycle.target); await page.keyboard.press('Control+z'); await page.mouse.up(); await idle();
assert.deepEqual(server, cycle.cfg);
capability = false; await mount(cycle.cfg);
const count = writes, start = await screen(cycle.point); await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.up();
assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), false); assert.equal(writes, count);
capability = true; refused = true; await mount(cycle.cfg); await drag(cycle.point, cycle.target); await page.mouse.up(); await idle();
assert.deepEqual(server, cycle.cfg); assert.equal(await page.evaluate(() => window.__card._geometryHistory.size), 0);
refused = false; await mount(cycle.cfg);
for (const mode of ['view', 'devices', 'decor']) { // decor is the Background editor's internal mode
  await page.evaluate(async mode => { await window.__hpTest.setMode(mode); }, mode);
  assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('.hp-node-handle').length), 0,
    `${mode}: no wall-node handles`);
}
await finish(browser, { scenarios: scenarios.length, cycles: 100, writes });
