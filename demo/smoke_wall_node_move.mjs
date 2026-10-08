// #803: real browser pointers, visible intermediate preview, cancellation and
// shared Undo/Redo. Fake HA answers are a wire boundary, not a gesture override.
import assert from 'node:assert/strict';
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';

const initial = commitWallSegmentModel({ spaces: [{ id: 'node-floor', title: 'Nodes', view_box: [0, 0, 1, 1],
  rooms: [{ id: 'room', name: 'Room', area: null, poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
  partitions: [{ id: 'wall', a: [0.2, 0.4], b: [0.6, 0.4], cm: 25 }],
  openings: [{ id: 'door', type: 'door', x: 0.5, y: 0.4, angle: 0, length: 0.06,
    host: { kind: 'partition', id: 'wall', t: 0.75 }, flip_h: true }],
}], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
let server = structuredClone(initial), revision = 1;
const writes = [];
const { page, browser } = await launch({ width: 1180, height: 920 });
await page.exposeFunction('nodeWire', async message => {
  if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision, can_write: true, wall_node_move_api: 1 };
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (message.type !== 'houseplan/wall/node_move') return null;
  assert.equal(message.expected_rev, revision);
  const source = message.direction === 'undo' ? message.before_space : server.spaces[0];
  const nodes = structuralWallNodes(source);
  const node = nodes.find(n => Math.hypot(n.point[0] - message.intent.point[0], n.point[1] - message.intent.point[1]) < 1e-8);
  const result = applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids), message.intent.target, message.intent.axis);
  assert.equal(result.ok, true);
  if (message.direction === 'undo') server = commitWallSegmentModel({ ...server, spaces: [source] }).config;
  else server = commitWallSegmentModel({ ...server, spaces: [result.space] }).config;
  writes.push(structuredClone(message));
  return { config: structuredClone(server), rev: ++revision, ok: true };
});
await page.evaluate(async () => {
  const previous = window.__card, hass = window.__mkHass(), old = hass.callWS.bind(hass);
  hass.devices = {}; hass.entities = {}; hass.states = {};
  hass.callWS = async m => m.type.endsWith('registry/list') ? [] : (await window.nodeWire(m)) ?? old(m);
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'Node test', language: 'en' });
  previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'node-floor');
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
const screen = async p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('.hp-node-handle').ownerSVGElement;
  const q = svg.createSVGPoint(); q.x = p[0] * 1000; q.y = p[1] * 1000;
  const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
const inspect = () => page.evaluate(() => ({
  state: window.__card.renderRoot.querySelector('[data-hp-node-live="2"] .hp-node-layer')?.dataset.hpNodeState,
  config: structuredClone(window.__card._serverCfg), size: window.__card._geometryHistory.size,
  capture: window.__card._stageEl.hasPointerCapture(window.__card._editorRuntime.nodeMove.activePointerId ?? -1),
  mask: window.__card.renderRoot.querySelector('.wallbodies')?.style.mask,
  preview: structuredClone(window.__card._editorRuntime.nodeMove.preview?.sp),
}));
const start = await screen([0.2, 0.4]), target = await screen([0.25, 0.55]);
const baselineFrame = await page.screenshot();
const durableState = () => page.evaluate(() => ({
  cache: localStorage.getItem('houseplan_card_cfg_v1'), epoch: window.__card._cfgEpoch,
  revision: window.__card._cfgRev, pending: window.__card._saveConfigDebounced.pending(),
  physicalWrites: [...window.__card._pendingPhysicalWrites],
}));
const durableBefore = await durableState();
await page.mouse.move(start.x, start.y); await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 6 });
await page.waitForFunction(() => window.__card.renderRoot.querySelector('[data-hp-node-live="2"] .hp-node-layer')?.dataset.hpNodeState === 'preview');
let during = await inspect();
check('captured owning real pointer', during.capture);
check('authoritative config is isolated while dragging', JSON.stringify(during.config), JSON.stringify(initial));
check('no history or writes while dragging', [during.size, writes.length], [0, 0]);
check('old physical body is locally removed', during.mask?.includes('hp-node-old-walls-mask'));
check('new node actually follows pointer', during.preview.partitions[0].a[1] > 0.5);
await page.waitForTimeout(1200); // beyond the ordinary config-save debounce
check('held preview never enters cache/recovery/epoch/pending writers', await durableState(), durableBefore);
check('held preview remains unsaved', [writes.length, (await inspect()).config], [0, initial]);
await page.keyboard.press('Escape'); await page.mouse.move(target.x + 30, target.y + 30); await page.mouse.up();
await page.evaluate(async () => { await window.__card.updateComplete; });
check('Esc and trailing move/up create no writes', writes.length, 0);
check('Esc restores original config and history', [(await inspect()).config, (await inspect()).size], [initial, 0]);
check('cancel releases the pointer', (await inspect()).capture, false);

// A new deliberate pointer sequence re-arms after the cancelled tail.
await page.mouse.move(start.x, start.y); await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 6 });
await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.preview !== null);
during = await inspect();
const ghostFrame = await page.screenshot();
const mid = during.preview.partitions[0].a.map((v, i) => (v + [0.6, 0.4][i]) / 2);
const points = await Promise.all([[0.32, 0.4], mid, [0.5, 0.75]].map(screen));
await page.mouse.up();
await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 1,
  { timeout: 10000 }).catch(async error => { console.error('node release diagnostics', await inspect(), writes); throw error; });
check('one accepted move is one atomic node write', writes.length, 1);
check('toolbar Undo becomes enabled for the accepted node command', await page.evaluate(() =>
  window.__card.renderRoot.querySelector('[data-hp="toolbar"] ha-icon[icon="mdi:undo-variant"]').closest('button').disabled), false);
check('committed geometry equals the visible preview', server.spaces[0].partitions, during.preview.partitions);
check('fixed-end door distance preserved', Math.abs(Math.hypot(server.spaces[0].openings[0].x - 0.6,
  server.spaces[0].openings[0].y - 0.4) - 0.1) < 1e-8);
const committedFrame = await page.screenshot();
const pixels = await page.evaluate(async ({ frames, points }) => {
  return Promise.all(frames.map(async encoded => {
    const image = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return points.map(p => { const data = ctx.getImageData(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5).data;
      return [0, 1, 2].map(c => Array.from({ length: 25 }, (_, i) => data[i * 4 + c]).reduce((a, b) => a + b) / 25); });
  }));
}, { frames: [baselineFrame, ghostFrame, committedFrame].map(f => f.toString('base64')), points });
const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
console.log('node raster probes', JSON.stringify({ points, pixels }));
check('raster: original affected wall is a translucent source ghost', delta(pixels[0][0], pixels[1][0]) > 8 && delta(pixels[1][0], pixels[2][0]) > 5);
check('raster: new physical wall is translucent, not an opaque copy', pixels[1][1].reduce((a, b) => a + b) > pixels[2][1].reduce((a, b) => a + b) + 8);
check('raster: unaffected floor pixels stay unchanged', delta(pixels[0][2], pixels[1][2]) < 2 && delta(pixels[1][2], pixels[2][2]) < 2);
const beforeIdleEsc = structuredClone(server), beforeIdleRevision = revision;
await page.keyboard.press('Escape'); await page.evaluate(() => window.__hpTest.settled());
check('Esc after accepted commit leaves geometry, revision and history intact',
  [server, revision, writes.length, (await inspect()).size], [beforeIdleEsc, beforeIdleRevision, 1, 1]);
await page.waitForFunction(() => !window.__card._modeTransitionBusy);
// Real keyboard activation has no new pointerdown. A retired node click-tail
// must not swallow this unrelated header button (nor the next toolbar action).
await page.locator('houseplan-card').locator('[data-hp="mode-tab"][data-mode="plan"]').focus();
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__card._mode === 'plan');
await page.evaluate(() => window.__hpTest.setTool('select'));
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
await page.keyboard.press('Control+z');
await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 0);
check('Undo restores exact starting catalogue/openings', server, initial);
await page.keyboard.press('Control+Shift+z');
await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 1);
check('Redo uses the same server-owned operation', writes.map(w => w.direction), ['apply', 'undo', 'apply']);
const accepted = structuredClone(server), count = writes.length;
const movedStart = await screen(server.spaces[0].partitions[0].a), valid = await screen([0.27, 0.54]), collapsed = await screen([0.6, 0.4]);
await page.mouse.move(movedStart.x, movedStart.y); await page.mouse.down();
await page.mouse.move(valid.x, valid.y); await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.preview !== null);
await page.mouse.move(collapsed.x, collapsed.y); await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.invalid !== null);
await page.mouse.up(); await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.dragging);
check('invalid last release never saves the older valid candidate', [writes.length, server], [count, accepted]);
check('invalid release creates no history entry', (await inspect()).size, 1);
const acceptedRevision = revision;
await page.keyboard.press('Escape'); await page.evaluate(() => window.__hpTest.settled());
check('idle Esc after accepted move/Redo is not Undo and makes no write',
  [writes.length, server, revision, (await inspect()).size], [count, accepted, acceptedRevision, 1]);

// #834 / CANVAS §5: a Select press owns the presented camera even though its
// capture guard consumes pointerdown before the ordinary stage handler.
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
const cameraBaseline = await inspect(), cameraWrites = writes.length;
const cameraNode = await screen(server.spaces[0].partitions[0].a);
await page.mouse.move(cameraNode.x, cameraNode.y);
await page.evaluate(() => {
  const card = window.__card, stage = card._stageEl;
  const snapshot = () => {
    const matrix = card.renderRoot.querySelector('svg.plan-svg').getScreenCTM();
    return { active: card._cameraTransition.active, zoom: card._zoom, view: { ...card._view },
      ctm: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] };
  };
  const witness = window.__nodeCameraWitness = { snapshot, before: null, transition: null };
  // Observe native input without driving any production controller. The wheel
  // promise resolves after the stage's existing wheel handler, not after its
  // animation, so there is no guessed sleep before the following mouse press.
  witness.wheel = new Promise(resolve => stage.addEventListener('wheel', resolve, { once: true }));
  document.addEventListener('pointerdown', event => {
    if (!event.composedPath().includes(stage)) return;
    witness.before = snapshot();
    witness.transition = structuredClone(card._cameraTransition.state);
  }, { capture: true, once: true });
});
await page.mouse.wheel(0, -120);
await page.evaluate(() => window.__nodeCameraWitness.wheel.then(() => undefined));
await page.mouse.down();
const cameraDown = await page.evaluate(() => {
  const { before, transition, snapshot } = window.__nodeCameraWitness;
  return { before, after: snapshot(), transition, dragging: window.__card._editorRuntime.nodeMove.dragging };
});
assert.ok(cameraDown.before?.active && cameraDown.transition?.reason === 'wheel'
  && cameraDown.before.zoom !== cameraDown.transition.to.zoom,
  'native node press must witness a running wheel transition, not an already settled camera');
check('node capture freezes a running wheel transition', [cameraDown.dragging, cameraDown.after.active], [true, false]);
const frozenCamera = { ...cameraDown.before, active: false };
check('node capture keeps the exact presented camera instead of jumping to the target', cameraDown.after, frozenCamera);
const cameraFrames = await page.evaluate(async () => {
  const witness = window.__nodeCameraWitness, frames = [];
  const deadline = witness.transition.startedAt + witness.transition.duration;
  do {
    await new Promise(requestAnimationFrame);
    frames.push(witness.snapshot());
  } while (performance.now() <= deadline || frames.length < 3);
  return frames;
});
check('retired zoom frames cannot move the captured viewport', cameraFrames.every(frame =>
  JSON.stringify(frame) === JSON.stringify(frozenCamera)));
const cameraTarget = await screen([0.27, 0.54]);
await page.mouse.move(cameraTarget.x, cameraTarget.y);
await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.preview !== null);
check('native node movement keeps the frozen camera', await page.evaluate(() => window.__nodeCameraWitness.snapshot()), frozenCamera);
await page.keyboard.press('Escape'); await page.mouse.up();
await page.evaluate(() => window.__hpTest.settled());
check('Esc after interrupted zoom leaves geometry and history unchanged',
  [(await inspect()).config, (await inspect()).size, writes.length], [cameraBaseline.config, cameraBaseline.size, cameraWrites]);
await page.evaluate(() => { delete window.__nodeCameraWitness; });
await finish(browser, { writes: writes.length });
