// #885 AC6/AC8: a real mouse draws a rectangle whose third side ends exactly
// opposite its first corner by the alignment magnet, then drags a wall node so
// that one wall is straightened by the node's H magnet AND its end aligns with
// an off-grid parallel wall end. Hover/drag preview (rubber-band, length label,
// node guide, translucent candidate) and the saved geometry must be the same
// point. HA is a recording wire; node moves are applied by the real TS proof.
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';

const X0 = 0.7031; // an off-grid parallel wall end (1/240 grid)
const initial = commitWallSegmentModel({ spaces: [{ id: 'align-floor', title: 'Align', view_box: [0, 0, 1, 1],
  // An enclosing room frames the camera on the whole floor; its walls are far from every probe.
  rooms: [{ id: 'room', name: 'Room', area: null, poly: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]] }],
  openings: [], partitions: [
    // Corner N = (0.5, 0.72): w1 slanted, w2 vertical; `ref` ends at X0.
    { id: 'w1', a: [0.2, 0.7], b: [0.5, 0.72], cm: 20 },
    { id: 'w2', a: [0.5, 0.55], b: [0.5, 0.72], cm: 20 },
    { id: 'ref', a: [0.6, 0.9], b: [X0, 0.9], cm: 0 },
  ] }], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
let server = structuredClone(initial), revision = 1;
const writes = [];
const { page, browser } = await launch({ width: 1180, height: 920 });
await page.exposeFunction('alignWire', async message => {
  if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision, can_write: true, wall_node_move_api: 1 };
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (message.type === 'houseplan/config/set') {
    if (message.expected_rev !== revision) return { __error: { code: 'conflict', message: 'conflict' } };
    server = structuredClone(message.config); writes.push('config'); return { ok: true, rev: ++revision };
  }
  if (message.type !== 'houseplan/wall/node_move') return null;
  const source = message.direction === 'undo' ? message.before_space : server.spaces[0];
  const nodes = structuralWallNodes(source);
  const node = nodes.find(n => Math.hypot(n.point[0] - message.intent.point[0], n.point[1] - message.intent.point[1]) < 1e-8);
  const moved = node && applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids), message.intent.target, message.intent.axis);
  if (!moved?.ok) return { __error: { code: 'node_move_invalid', message: 'node_move_invalid' } };
  server = commitWallSegmentModel({ ...server, spaces: [moved.space] }).config;
  writes.push(`node:${JSON.stringify(message.intent.target)}`);
  return { config: structuredClone(server), rev: ++revision, ok: true };
});
await page.evaluate(async () => {
  const previous = window.__card, hass = window.__mkHass(), old = hass.callWS.bind(hass);
  hass.devices = {}; hass.entities = {}; hass.states = {};
  hass.callWS = async m => {
    if (m.type.endsWith('registry/list')) return [];
    const answer = await window.alignWire(m);
    if (answer?.__error) throw answer.__error;
    return answer ?? old(m);
  };
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'Align test', language: 'en' });
  previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'align-floor');
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('draw'); });
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card._tool === 'draw');

const screen = p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
  q.x = p[0] * 1000; q.y = p[1] * 1000; const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
const frames = () => page.evaluate(async () => {
  for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
  await window.__card.updateComplete;
});
const until = async (label, condition) => {
  for (let i = 0; i < 200; i++) { if (condition()) return; await page.waitForTimeout(25); }
  throw new Error(`timeout: ${label}`);
};

// ---- AC8 drawing: A → B → C, then the third side ends opposite A ----
const A = [0.2, 0.2], B = [0.6, 0.2], C = [0.6, 0.45], D = [A[0], C[1]];
for (const p of [A, B, C]) { const at = await screen(p); await page.mouse.click(at.x, at.y); await frames(); }
const path = await page.evaluate(() => window.__card._path);
check('three corners accepted', path.length === 3 && [A, B, C].every((p, i) =>
  Math.hypot(p[0] * 1000 - path[i][0], p[1] * 1000 - path[i][1]) < 1e-6));
const aligned = [path[0][0], path[2][1]]; // x of the first corner, y of the active anchor
// 7 CSS px right of the line x = A.x: inside the 8 px magnet, but the grid
// alone would land on another node.
const near = await screen(D), hover = { x: near.x + 7, y: near.y + 1 };
await page.mouse.move(hover.x, hover.y, { steps: 4 }); await frames();
const preview = await page.evaluate(([d]) => {
  const card = window.__card, root = card.renderRoot, anchor = card._path[card._path.length - 1];
  // The live gesture layer paints the rubber-band; a settled copy, if any, is transparent (#521).
  const visible = [...root.querySelectorAll('.active-axis')].filter(line => {
    for (let e = line; e?.nodeType === 1; e = e.parentElement) if (+getComputedStyle(e).opacity === 0) return false;
    return true;
  });
  return {
    cursor: card._cursorPt, gridAlone: card._editorRuntime._snapDrawPoint(card._editorRuntime._svgPoint(
      { clientX: d.x, clientY: d.y }), false),
    axisEnd: visible.map(line => [+line.getAttribute('x2'), +line.getAttribute('y2')]),
    label: root.querySelector('.measurelabel')?.textContent?.trim().replace(/\s+/g, ' '),
    expectedLabel: `${card._fmtLen(anchor, card._cursorPt)} · 180°`,
  };
}, [hover]);
check('precondition: without the magnet the grid would place another x', preview.gridAlone[0] !== aligned[0]);
check('hover preview point is exactly opposite the first corner', preview.cursor, aligned);
check('the one visible rubber-band ends at the aligned point', preview.axisEnd, [aligned]);
check('length label measures the aligned segment', preview.label, preview.expectedLabel);
await page.mouse.click(hover.x, hover.y); await frames();
check('click persists the previewed point', await page.evaluate(() => window.__card._path.at(-1)), preview.cursor);
const a = await screen(A); await page.mouse.click(a.x, a.y); await frames();
await until('rectangle saved', () => (server.spaces[0].partitions || []).length >= 7);
// The saved walls, not the client copy: the drawn sides are the partitions near C→D and D→A.
const close = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
const side = (p, q) => server.spaces[0].partitions.map(w => [w.a, w.b])
  .map(([s, e]) => (close(s, p) && close(e, q) ? [s, e] : close(e, p) && close(s, q) ? [e, s] : null)).find(Boolean);
const third = side(C, D), fourth = side(D, A), first = side(A, B);
check('saved third side ends exactly at the previewed point', third?.[1], preview.cursor.map(v => v / 1000));
check('saved third side is exactly horizontal', third?.[0][1] === third?.[1][1]);
check('fourth side closes strictly vertically onto the first corner',
  [fourth?.[0], fourth?.[1][0] === fourth?.[0][0], fourth?.[1][0] === first?.[0][0]], [third?.[1], true, true]);
await page.keyboard.press('Escape'); await frames();

// ---- AC6/AC8 node move: H magnet on y and alignment on x at once ----
await page.evaluate(async () => { await window.__hpTest.setTool('select'); });
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
const beforeNode = writes.length;
const N = await screen([0.5, 0.72]), aim = await screen([X0, 0.7]);
await page.mouse.move(N.x, N.y); await page.mouse.down();
await page.mouse.move(aim.x + 4, aim.y + 3, { steps: 8 });
await page.waitForFunction(() => window.__card._editorRuntime.nodeMove?.preview !== null);
await frames();
const drag = await page.evaluate(() => {
  const card = window.__card, node = card._editorRuntime.nodeMove, guide = card.renderRoot.querySelector('.hp-node-guide');
  return { w1: node.preview.sp.partitions.find(w => w.id === 'w1'), invalid: node.invalid,
    guideEnd: guide ? [+guide.getAttribute('x2'), +guide.getAttribute('y2')] : null };
});
check('drag preview: valid candidate', drag.invalid, null);
check('drag preview: w1 straight by the node H magnet and ending exactly at X0', drag.w1.b, [X0, 0.7]);
check('node guide ends at the previewed target', drag.guideEnd, [X0 * 1000, 0.7 * 1000]);
await page.mouse.up();
await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && !window.__card._editorRuntime.nodeMove.dragging,
  null, { timeout: 10000 });
await until('node move saved', () => writes.length > beforeNode);
check('one node write with the previewed target', writes.slice(beforeNode), [`node:${JSON.stringify([X0, 0.7])}`]);
const w1 = server.spaces[0].partitions.find(w => w.id === 'w1');
check('saved w1 equals the preview: exactly horizontal and aligned off the grid', [w1.a, w1.b], [drag.w1.a, drag.w1.b]);
check('both conditions hold exactly after release', [w1.a[1] === w1.b[1], w1.b[0]], [true, X0]);
await finish(browser, { writes });
