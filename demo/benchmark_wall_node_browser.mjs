// #803: real pointer-to-paint measurements, including validation and DOM work.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { launch, finish, check } from './serve.mjs';
import { wallNodeFixture, NODE_CASES } from './performance/wall-node-fixture.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
const initial = wallNodeFixture();
initial.spaces[0].view_box = [-1.4, -0.2, 6.5, 2.5];
const { page, browser } = await launch({ width: 1440, height: 1000 });
let writeCount = 0;
await page.exposeFunction('nodeBenchmarkWire', m => {
  if (m.type === 'houseplan/config/get') return { config: initial, rev: 1, can_write: true, wall_node_move_api: 1 };
  if (m.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (m.type === 'houseplan/wall/node_move') {
    const source = initial.spaces[0], nodes = structuralWallNodes(source);
    const node = nodes.find(n => n.point.every((v, i) => Math.abs(v - m.intent.point[i]) < 1e-9));
    const candidate = applyNodeMove(prepareNodeMove(source, node, nodes, m.intent.split_ids), m.intent.target, m.intent.axis);
    assert.equal(candidate.ok, true); writeCount++;
    return { config: commitWallSegmentModel({ ...initial, spaces: [candidate.space] }).config, rev: 2, ok: true };
  }
  return null;
});
await page.evaluate(() => {
  const oldCard = window.__card, hass = window.__mkHass(), old = hass.callWS.bind(hass);
  hass.devices = {}; hass.entities = {}; hass.states = {};
  hass.callWS = async m => m.type.endsWith('registry/list') ? [] : (await window.nodeBenchmarkWire(m)) ?? old(m);
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
  oldCard.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'nodes-large');
console.log('200-room fixture adopted');
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
console.log('Select ready');
await page.waitForFunction(() => window.__card.renderRoot.querySelector('.hp-node-handle'));
const screen = p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('.hp-node-handle').ownerSVGElement;
  const q = svg.createSVGPoint(); q.x = p[0] * 1000; q.y = p[1] * 1000;
  const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
await page.evaluate(() => {
  window.__nodeProfile = { moves: [], tasks: [], start: 0, last: 0, pending: false, down: [], upValidationCpuMs: 0, upToWireMs: 0 };
  new PerformanceObserver(list => window.__nodeProfile.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))))
    .observe({ type: 'longtask', buffered: false });
  window.__card.renderRoot.addEventListener('pointermove', e => {
    if (!window.__card._editorRuntime.nodeMove.dragging) return;
    const p = window.__nodeProfile; p.last = performance.now(); p.pending = true;
    window.__card.updateComplete.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      p.moves.push(performance.now() - p.last); p.pending = false;
    })));
  }, { capture: true });
  window.__card.renderRoot.addEventListener('pointerdown', () => {
    const start = performance.now(); queueMicrotask(() => window.__nodeProfile.down.push(performance.now() - start));
  }, { capture: true });
  // Measurement-only wrappers call the exact original production callbacks,
  // with the same arguments/result. No candidate, input or geometry is faked.
  const port = window.__card._editorRuntime.nodeMove.port, validate = port.validate, write = port.write;
  port.validate = (...args) => { const start = performance.now(); const result = validate(...args);
    if (args[2]) window.__nodeProfile.upValidationCpuMs += performance.now() - start; return result; };
  port.write = (...args) => { const profile = window.__nodeProfile;
    const before = window.__card.hass.callWS.bind(window.__card.hass);
    window.__card.hass.callWS = m => { if (m.type === 'houseplan/wall/node_move') profile.upToWireMs = performance.now() - profile.upStart;
      return before(m); };
    return write(...args);
  };
  window.__card.renderRoot.addEventListener('pointerup', () => { window.__nodeProfile.upStart = performance.now(); }, { capture: true });
});
const warmups = Number(process.env.HP_NODE_WARMUPS || 3), series = Number(process.env.HP_NODE_SERIES || 20);
const moves = Number(process.env.HP_NODE_MOVES || 120), results = [], cold = [];
for (let s = -warmups; s < series; s++) {
  const test = NODE_CASES[(s + warmups) % NODE_CASES.length], start = await screen(test.point);
  console.log('begin', s, test.name, start);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), true, `${test.name} pointer captured`);
  await page.evaluate(() => { const p = window.__nodeProfile; p.moves = []; p.tasks = []; p.start = performance.now(); });
  for (let i = 0; i < moves; i++) {
    const at = await screen(test.raw(i + s * 11 + 200)); await page.mouse.move(at.x, at.y);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const result = await page.evaluate(() => {
    const p = window.__nodeProfile, stop = performance.now();
    const editor = window.__card._editorRuntime.nodeMove;
    return { latencies: p.moves, tasks: p.tasks.filter(t => t.start >= p.start && t.start <= stop), duration: stop - p.start,
      visible: !!editor.preview, invalid: editor.invalid, target: editor.session?.target,
      node: editor.session?.plan.node.point, axis: editor.session?.axis };
  });
  assert.equal(result.visible, true, `${test.name} actual changed candidate ${JSON.stringify(result)}`);
  assert.equal(result.invalid, null, `${test.name} validated candidate`);
  await page.keyboard.press('Escape'); await page.mouse.up();
  if (s === -warmups) cold.push(...result.latencies);
  if (s >= 0) { results.push({ kind: test.name, ...result }); console.log('series', s, test.name, result.latencies.length, Math.max(0, ...result.tasks.map(t => t.duration))); }
}
assert.equal(writeCount, 0, 'cancelled series never wrote');
const commitCase = NODE_CASES[0], commitStart = await screen(commitCase.point), commitTarget = await screen(commitCase.raw(230));
await page.mouse.move(commitStart.x, commitStart.y); await page.mouse.down(); await page.mouse.move(commitTarget.x, commitTarget.y);
await page.mouse.up();
await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && !window.__card._editorRuntime.nodeMove.dragging, { timeout: 60000 });
assert.equal(writeCount, 1, 'valid release reaches the real writer exactly once');
const terminal = await page.evaluate(() => ({ pointerDownCpuMs: window.__nodeProfile.down,
  pointerupValidationCpuMs: window.__nodeProfile.upValidationCpuMs, pointerupToWireMs: window.__nodeProfile.upToWireMs }));
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)] || 0;
const latencies = results.flatMap(r => r.latencies);
const report = { viewport: [1440, 1000], dpr: 1, roomCount: 200, warmups, series, moves,
  fixtureFingerprint: createHash('sha256').update(JSON.stringify(initial)).digest('hex'),
  pointerToPaintMs: { p50: quantile(latencies, .5), p95: quantile(latencies, .95), max: Math.max(0, ...latencies) },
  coldFirstGesturePointerToPaintMs: { p50: quantile(cold, .5), p95: quantile(cold, .95), max: Math.max(0, ...cold) },
  pointerDownCpuMs: { first: terminal.pointerDownCpuMs[0], p95: quantile(terminal.pointerDownCpuMs, .95), max: Math.max(...terminal.pointerDownCpuMs) },
  pointerupValidationCpuMs: terminal.pointerupValidationCpuMs,
  pointerupToWireMs: terminal.pointerupToWireMs,
  longTaskMaxMs: Math.max(0, ...results.flatMap(r => r.tasks.map(t => t.duration))),
  longTaskCountP95: quantile(results.map(r => r.tasks.length), .95),
  longTaskTotalP95Ms: quantile(results.map(r => r.tasks.reduce((sum, t) => sum + t.duration, 0)), .95) };
check('node drag single long task <=150ms', report.longTaskMaxMs <= 150);
check('node drag p95 long task count <=3', report.longTaskCountP95 <= 3);
check('node drag p95 long task total <=300ms', report.longTaskTotalP95Ms <= 300);
await finish(browser, report);
