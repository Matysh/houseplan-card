// #834 AC1/3/4/5: native Select drag on a connected, anonymised 8-room floor.
// Public pointer/keyboard input and an acknowledged fake-HA wire own all edits.
// Timing wrappers only observe/delegate production methods; no gesture/config writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launch, finish, requirePinnedBrowser } from './serve.mjs';
import { installNodePaintObserver } from './helpers/node-paint-observer.mjs';
import { calibrateNodeInputClock, settleNodeInputLedger } from './helpers/node-input-ledger.mjs';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

requirePinnedBrowser('#834 connected-floor node regression and performance');
const fixtureText = readFileSync(new URL('../test/fixtures/834-node-connected.json', import.meta.url), 'utf8');
const fixture = JSON.parse(fixtureText);
fixture.settings.filter_seeded = true; // no unrelated first-run device-filter write
const initial = commitWallSegmentModel(fixture).config;
const origin = [-401 / 240, 928 / 240];
const upper = [-401 / 240, 725 / 240];
const output = process.argv.find(v => v.startsWith('--output='))?.slice(9)
  || 'artifacts/834-node/connected.json';
const viewport = { width: 1280, height: 1000 };
const budgets = { mainThreadP95Ms: 50, inputToPaintP95Ms: 100, longTaskMaxMs: 150 };
const quantiles = values => {
  const sorted = values.slice().sort((a, b) => a - b);
  return { count: sorted.length, median: sorted[Math.ceil(sorted.length * .5) - 1] || 0,
    p95: sorted[Math.ceil(sorted.length * .95) - 1] || 0, max: sorted.at(-1) || 0 };
};
assert.deepEqual([initial.spaces[0].rooms.length, initial.spaces[0].wall_segments.length,
  initial.spaces[0].openings.length], [8, 30, 14], 'connected fixture is not a reduced or disconnected benchmark');
let server = structuredClone(initial), revision = 1;
const writes = [];
const { page, browser } = await launch(viewport, 1);
const report = { issue: 834, fixtureSha256: createHash('sha256').update(fixtureText).digest('hex'),
  counts: { rooms: 8, walls: 30, openings: 14 }, viewport, dpr: 1, node: process.version,
  chromium: browser.version(), budgets, warmupGestures: 3, measuredGestures: 5,
  latencyDefinition: 'Per submitted native input to a post-paint opportunity of the latest candidate. The same RAF-phase observer uses next RAF after a synchronous RAF producer, second RAF after a task/microtask producer. Unconditional two-RAF is retained separately. Superseded inputs are labelled, not claimed rendered.',
  clockDefinition: 'Before each mouse-down, three independent native CDP probes calibrate epoch to native monotonic time; their conservative minimum offset is fixed before all 60 measured inputs are dispatched. Raw probes and immutable source clocks are retained.',
  raw: [], failures: [] };
mkdirSync(dirname(output), { recursive: true });
try {
  report.bundleFingerprint = await page.evaluate(() => globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__);
  await page.exposeFunction('connectedNodeWire', message => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision,
      can_write: true, wall_node_move_api: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type !== 'houseplan/wall/node_move') return null;
    assert.equal(message.expected_rev, revision, 'wire revision must match');
    const source = message.direction === 'undo' ? message.before_space : server.spaces[0];
    const nodes = structuralWallNodes(source);
    const node = nodes.find(n => Math.hypot(...n.point.map((v, i) => v - message.intent.point[i])) < 1e-8);
    assert.ok(node, 'wire intent names a real structural node');
    const next = applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids),
      message.intent.target, message.intent.axis);
    assert.equal(next.ok, true, 'structural wire validation');
    server = commitWallSegmentModel({ ...server, spaces: [message.direction === 'undo' ? source : next.space] }).config;
    writes.push(structuredClone(message));
    return { config: structuredClone(server), rev: ++revision, ok: true };
  });
  await page.evaluate(() => {
    const hass = window.__mkHass(), original = hass.callWS.bind(hass);
    hass.devices = {}; hass.entities = {}; hass.states = {};
    hass.callWS = async message => message.type.endsWith('registry/list') ? []
      : (await window.connectedNodeWire(message)) ?? original(message);
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
    window.__card.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
  });
  await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'connected-floor');
  await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
  await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
  const settle = () => page.evaluate(() => window.__hpTest.settled());
  const screen = points => page.evaluate(points => {
    const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), matrix = svg.getScreenCTM();
    return points.map(p => { const q = svg.createSVGPoint(); q.x = p[0] * 1000; q.y = p[1] * 1000;
      const out = q.matrixTransform(matrix); return { x: out.x, y: out.y }; });
  }, points);
  const move = async point => { const [p] = await screen([point]); await page.mouse.move(p.x, p.y); };
  const down = async () => { await move(origin); await page.mouse.down();
    assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), true, 'native node capture'); };
  const cancel = async () => { await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
    assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), false);
    assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('[data-hp-node-live], .hp-node-source').length), 0); };
  const [center] = await screen([[origin[0] + .45, origin[1] - .3]]);
  await page.mouse.move(center.x, center.y); await page.mouse.wheel(0, -400); await settle();

  await page.evaluate(installNodePaintObserver);
  await page.evaluate(() => {
    const editor = window.__card._editorRuntime.nodeMove;
    const perf = window.__connectedNodePerf = { active: null, gestures: [], validateCalls: 0, pending: [] };
    document.addEventListener('pointermove', event => {
      if (!perf.active || !editor.dragging || event.buttons !== 1 || event.timeStamp < perf.active.started) return;
      // One immutable clock per delivered input; later events never overwrite it.
      const delivered = event.getCoalescedEvents?.() || [];
      for (const input of delivered.length ? delivered : [event]) {
        const entry = { id: perf.active.events.length, eventTime: input.timeStamp, dispatched: performance.now(),
          x: input.clientX, y: input.clientY, browserCoalesced: delivered.length > 1 };
        perf.active.events.push(entry); perf.pending.push(entry);
      }
    }, true);
    const originalValidate = editor.port.validate;
    editor.port.validate = function (...args) { // private-ok: #834 observer delegates the real proof and only counts calls; it cannot make an unsafe candidate valid.
      perf.validateCalls++; return originalValidate.apply(this, args);
    };
    const originalFlush = editor.flushMove;
    assertFunction(originalFlush, 'flushMove');
    editor.flushMove = function (...args) { // private-ok: #834 measures the complete production candidate/proof/paint method without replacing inputs or outputs.
      const batch = perf.pending.splice(0), gesture = perf.active, calls = perf.validateCalls;
      const began = performance.now();
      try { return originalFlush.apply(this, args); }
      finally {
        if (gesture && batch.length) {
          const sample = { began, mainThreadMs: performance.now() - began,
            validateCalls: perf.validateCalls - calls, events: batch.map(e => e.id),
            target: this.session?.target?.slice(), invalid: this.invalid };
          gesture.samples.push(sample);
          // Same phase-aware observer runs against the historical microtask
          // implementation. A compositor presentation timestamp is not claimed.
          window.__hpNodePaintObserver.measure(measurement => {
            Object.assign(sample, measurement);
            for (const [index, event] of batch.entries()) {
              Object.assign(event, measurement);
              event.inputToPaintMs = measurement.paintOpportunity - event.eventTime;
              event.coalesced = index < batch.length - 1;
            }
          });
        }
      }
    };
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const gesture = perf.gestures.find(g => entry.startTime >= g.started
          && entry.startTime <= (g.ended ?? Infinity));
        if (gesture) gesture.longTasks.push({ start: entry.startTime, ms: entry.duration });
      }
    });
    observer.observe({ type: 'longtask', buffered: false });
    function assertFunction(value, name) { if (typeof value !== 'function') throw new Error(`missing measured owner ${name}`); }
  });

  // Cold and warm traces have identical input cadence/geometry on one machine.
  // CDP dispatches native mouse events independently every 16 ms, not after a
  // measured callback/rAF has finished. Awaiting all replies happens at the end.
  const cdp = await page.context().newCDPSession(page);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  report.browserTimeOrigin = timeOrigin;
  for (let gesture = 0; gesture < 8; gesture++) {
    const clockCalibration = await calibrateNodeInputClock(page, cdp, timeOrigin);
    await down();
    await page.evaluate(index => {
      const perf = window.__connectedNodePerf;
      const value = { index, kind: index < 3 ? 'warmup' : 'measured', started: performance.now(), events: [], samples: [], longTasks: [] };
      perf.pending = []; perf.active = value; perf.gestures.push(value);
    }, gesture);
    const targets = Array.from({ length: 60 }, (_, index) => index < 48
      ? [origin[0], origin[1] + (index + 1) / 240]
      : [upper[0], upper[1] - (index - 47) / 240]);
    const positions = await screen(targets), pending = [], inputs = [];
    for (const position of positions) {
      // Explicit epoch timestamps retain all 60 input clocks even when the
      // browser coalesces native moves before JS (demo.local is not secure, so
      // getCoalescedEvents need not be exposed). CDP's epoch-to-native offset
      // was independently calibrated before mouse-down, never from this stream.
      const epoch = Date.now(); inputs.push(Object.freeze({ id: inputs.length, epochMs: epoch,
        eventTime: epoch - timeOrigin + clockCalibration.offsetMs, ...position }));
      pending.push(cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position,
        buttons: 1, pointerType: 'mouse', timestamp: epoch / 1000 }));
      await delay(16);
    }
    await Promise.all(pending);
    await page.waitForFunction(() => {
      const g = window.__connectedNodePerf.active;
      return g.events.length > 0 && g.events.every(e => e.paintOpportunity !== undefined);
    });
    const raw = await page.evaluate(() => {
      const perf = window.__connectedNodePerf, g = perf.active;
      g.ended = performance.now(); perf.active = null; return structuredClone(g);
    });
    raw.clockCalibration = clockCalibration; raw.sourceInputs = inputs;
    report.raw.push(raw); // preserve failed clocks/observations too
    const ledger = settleNodeInputLedger(inputs, raw.events);
    raw.inputs = ledger.inputs; raw.sourceMatches = ledger.matchedObservations;
    raw.unmatchedObservations = ledger.unmatchedObservations;
    assert.equal(raw.inputs.length, 60, 'all 60 separately dispatched inputs retain their immutable clocks');
    console.log('connected node gesture', { index: gesture, submitted: inputs.length, delivered: raw.events.length,
      candidates: raw.samples.length, proofs: raw.samples.filter(s => s.validateCalls > 0).length,
      unmatched: raw.unmatchedObservations.length, clockOffsetMs: clockCalibration.offsetMs,
      mainThread: quantiles(raw.samples.map(s => s.mainThreadMs)), inputToPaint: quantiles(raw.inputs.map(e => e.inputToPaintMs)) });
    assert.ok(raw.samples.length > 0 && raw.samples.some(s => s.validateCalls > 0), 'counter observed production proof');
    assert.ok(raw.samples.every(s => s.producerWasRaf), 'native move candidates are resolved inside the real animation frame');
    if (raw.kind === 'measured' && raw.samples.filter(s => s.validateCalls > 0).length < 10)
      report.failures.push(`gesture ${gesture}: fewer than ten complete heavy candidates (coalesced-away workload)`);
    assert.ok(raw.samples.some(s => s.invalid) && raw.samples.some(s => !s.invalid), 'valid and unsafe-neighbour paths measured');
    assert.ok(raw.events.every(e => e.inputToPaintMs >= 0 && e.eventTime <= e.dispatched + 1)
      && raw.inputs.every(e => Number.isFinite(e.inputToPaintMs) && e.inputToPaintMs >= 0), 'every input retains a valid browser-clock paint latency');
    await cancel();
  }
  const measured = report.raw.filter(g => g.kind === 'measured');
  report.coldFirst = report.raw[0];
  report.mainThread = quantiles(measured.flatMap(g => g.samples.map(s => s.mainThreadMs)));
  report.inputToPaint = quantiles(measured.flatMap(g => g.inputs.map(e => e.inputToPaintMs)));
  report.firstRafDiagnostic = quantiles(measured.flatMap(g => g.inputs.map(e => e.firstRafMs)));
  report.twoRafDiagnostic = quantiles(measured.flatMap(g => g.inputs.map(e => e.twoRafMs)));
  report.longTasks = quantiles(measured.flatMap(g => g.longTasks.map(s => s.ms)));
  report.validateCalls = measured.reduce((n, g) => n + g.samples.reduce((sum, s) => sum + s.validateCalls, 0), 0);
  report.coalescedInputs = measured.flatMap(g => g.inputs).filter(e => e.coalesced).length;
  assert.equal(writes.length, 0, 'performance gestures never persist');

  // Previously alternating red/green neighbours must display real masonry,
  // with the visible handle at the intended node rather than a stale preview.
  const beforePreview = await page.screenshot({ animations: 'disabled' });
  report.neighbours = [];
  await down();
  for (const cm of [53, 54, 59, 60]) {
    const target = [origin[0], origin[1] + cm / 240];
    await move(target); await settle();
    if (cm === 54) await page.evaluate(async () => {
      const card = window.__card;
      card.hass = { ...card.hass, states: { ...card.hass.states,
        'sensor.connected_smoke_tick': { entity_id: 'sensor.connected_smoke_tick', state: '1', attributes: {} } } };
      card.requestUpdate(); await card.updateComplete; await window.__hpTest.settled();
    });
    const visible = await page.evaluate(target => {
      const card = window.__card, root = card.renderRoot, editor = card._editorRuntime.nodeMove;
      const layer = root.querySelector('[data-hp-node-live="2"] .hp-node-layer');
      const handle = layer?.querySelector('circle.hp-node-handle');
      const wall = root.querySelector('[data-hp-node-live="2"] .wallbodies path');
      const probe = new DOMPoint((target[0] - 85 / 240) / 2 * 1000, (target[1] + 928 / 240) / 2 * 1000);
      return { invalid: editor.invalid, warnings: layer?.querySelectorAll('text').length,
        actual: handle && [+handle.getAttribute('cx') / 1000, +handle.getAttribute('cy') / 1000],
        wallPathLength: wall?.getAttribute('d')?.length || 0, ownerCount: root.querySelectorAll('[data-hp-node-live="2"]').length,
        masonryAtMovedMidpoint: [...root.querySelectorAll('[data-hp-node-live="2"] .wallbodies path')].some(path => path.isPointInFill(probe)),
        sourceVisible: !!root.querySelector('.hp-node-source'), target };
    }, target);
    assert.equal(visible.invalid, null, `+${cm} cm remains safe`);
    assert.equal(visible.warnings, 0); assert.equal(visible.ownerCount, 1); assert.equal(visible.sourceVisible, true);
    assert.ok(visible.wallPathLength > 100, 'candidate contains production masonry, not just a handle');
    assert.equal(visible.masonryAtMovedMidpoint, true, 'new wall body covers the moved edge, where the old wall did not');
    assert.ok(visible.actual.every((v, i) => Math.abs(v - target[i]) < 1e-8), 'latest native target is actually displayed');
    const [probe] = await screen([[(target[0] - 85 / 240) / 2, (target[1] + 928 / 240) / 2]]);
    const afterPreview = await page.screenshot({ animations: 'disabled' });
    const pixelDelta = await page.evaluate(async ({ frames, probe }) => {
      const samples = await Promise.all(frames.map(async encoded => {
        const image = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type: 'image/png' }));
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return [...ctx.getImageData(Math.round(probe.x) - 3, Math.round(probe.y) - 3, 7, 7).data];
      }));
      return samples[0].reduce((sum, value, index) => sum + (index % 4 === 3 ? 0 : Math.abs(value - samples[1][index])), 0) / (49 * 3);
    }, { frames: [beforePreview, afterPreview].map(frame => frame.toString('base64')), probe });
    assert.ok(pixelDelta > 3, `+${cm} cm new masonry produces visible pixels outside the old wall (${pixelDelta})`);
    report.neighbours.push({ cm, target, pixelDelta, invalid: visible.invalid });
  }
  const [same] = await screen([[origin[0], origin[1] + 60 / 240]]);
  const callsBefore = await page.evaluate(() => window.__connectedNodePerf.validateCalls);
  for (let n = 0; n < 12; n++) await page.mouse.move(same.x + (n % 2 ? .02 : -.02), same.y);
  await settle();
  assert.equal(await page.evaluate(() => window.__connectedNodePerf.validateCalls), callsBefore,
    'repeated snapped position reuses its proof rather than rebuilding geometry');
  assert.deepEqual(await page.evaluate(() => window.__card._serverCfg), initial, 'preview leaves the authoritative plan untouched');
  await page.mouse.up();
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 1);
  assert.equal(writes.length, 1, 'one gesture is one acknowledged write and one history command');
  assert.ok(Math.abs(writes[0].intent.target[1] - (origin[1] + 60 / 240)) < 1e-8, 'release saves the displayed last target');
  const accepted = structuredClone(server);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 0);
  assert.deepEqual(server, initial, 'Undo restores exact catalogue and openings');
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 1);
  assert.deepEqual(server, accepted, 'Redo restores the accepted geometry');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 0);
  const beforeInvalid = writes.length;
  await down(); await move([origin[0], origin[1] + 59 / 240]); await settle();
  assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.invalid), null);
  await move(upper); await page.mouse.up(); // do not settle: release must flush the pending invalid input
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.dragging);
  assert.equal(writes.length, beforeInvalid, 'invalid last release cannot save the older valid candidate');
  assert.deepEqual(server, initial); assert.equal(await page.evaluate(() => window.__card._geometryHistory.size), 0);

  report.pass = !report.failures.length && report.mainThread.p95 <= budgets.mainThreadP95Ms
    && report.inputToPaint.p95 <= budgets.inputToPaintP95Ms && report.longTasks.max <= budgets.longTaskMaxMs;
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 834, output, fixtureSha256: report.fixtureSha256, chromium: report.chromium,
    mainThread: report.mainThread, inputToPaint: report.inputToPaint, longTasks: report.longTasks,
    validateCalls: report.validateCalls, coalescedInputs: report.coalescedInputs, budgets, failures: report.failures, pass: report.pass }, null, 2));
  assert.ok(report.pass, '#834 native connected-floor performance budgets');
  await finish(browser, { writes: writes.length, rawReport: output });
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
