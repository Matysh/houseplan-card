import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { installDaycycleObservation, observeDaycycleFrames } from '../demo/helpers/daycycle-observation.mjs';
import { daycycleEnvironment, beginDaycycleLayers, daycycleLayerNodes,
  daycycleTraceObservation } from '../demo/helpers/daycycle-diagnostics.mjs';
import { analyzeDaycycleReport, compareDaycycleReports } from '../demo/helpers/daycycle-analysis.mjs';
import { pairedMeasurementReport, DAYCYCLE_FIXTURE } from '../demo/helpers/daycycle-measurement.mjs';

function pageFixture() {
  const listeners = new Map(), scheduled = [], marks = new Map();
  let now = 10, observer, writes = 0;
  const node = attributes => ({ attributes: new Map(Object.entries(attributes)),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute() { writes++; throw new Error('observer cannot write product DOM'); },
    addEventListener(type, fn, options) { assert.equal(options.passive, true); listeners.set(type, fn); },
    removeEventListener(type, fn) { assert.equal(listeners.get(type), fn); listeners.delete(type); } });
  const stage = node({}), paper = node({}), plan = node({ viewBox: '0 0 10 10', 'data-hp-live-viewbox': 'camera' }),
    outline = node({ viewBox: '0 0 100 100', 'data-hp-live-viewbox': 'floor' });
  const selectors = new Map([['.stage', stage], ['.hp-paperg', paper], ['.plan-svg', plan], ['.hp-paper-outline-svg', outline]]);
  const context = vm.createContext({
    window: { __card: { shadowRoot: { querySelector: selector => selectors.get(selector),
      querySelectorAll: () => [plan, outline] } } },
    performance: { now: () => now++, mark: name => marks.set(name, now++),
      getEntriesByName: name => [{ startTime: marks.get(name) }], clearMarks: name => marks.delete(name) },
    MutationObserver: class {
      constructor(fn) { observer = this; this.callback = fn; }
      observe(root, options) { assert.equal(options.attributeOldValue, true); this.connected = true; }
      disconnect() { this.connected = false; }
    }, requestAnimationFrame: fn => scheduled.push(fn),
  });
  vm.runInContext(`(${installDaycycleObservation.toString()})({marker:'own-clock-marker'})`, context);
  return { context, stage, plan, outline, listeners, scheduled, marks,
    get observer() { return observer; }, get writes() { return writes; } };
}

test('#1066 page observer retains actual native inputs and DOM values without writes or extra frames', async () => {
  const f = pageFixture();
  assert.equal(f.scheduled.length, 0, 'install schedules no rendering');
  const event = { type: 'pointermove', timeStamp: 12, clientX: 140, clientY: 90,
    buttons: 1, isTrusted: true, pointerId: 1, isPrimary: true };
  f.listeners.get('pointermove')(event);
  const promise = vm.runInContext(`(${observeDaycycleFrames.toString()})(1)`, f.context);
  assert.equal(f.scheduled.length, 1);
  f.scheduled.shift()(20);
  assert.equal(f.scheduled.length, 1, 'exactly the existing second frame');
  // Ordinary synthetic DOM input to the unchanged observer, not a patched renderer.
  f.outline.attributes.set('viewBox', '1 2 100 100');
  f.observer.callback([{ target: f.outline, attributeName: 'viewBox', oldValue: '0 0 100 100' }]);
  f.scheduled.shift()(40);
  await promise;
  assert.equal(f.scheduled.length, 0);
  const data = f.context.window.__hpDaycycleObservation.stop();
  assert.equal(data.pointers.length, 1);
  assert.equal(data.pointers[0].trusted, true);
  assert.deepEqual(Array.from(data.frames, row => row.raf), [1, 2]);
  assert.equal(data.frames[1].geometry.find(row => row.role === 'outline').attributes.viewBox, '1 2 100 100');
  assert.equal(data.mutations[0].oldValue, '0 0 100 100');
  assert.equal(data.mutations[0].valueAtDelivery, '1 2 100 100');
  assert.equal(f.writes, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.observer.connected, false);
  assert.equal(f.context.window.__hpDaycycleObservation, undefined);
  assert.equal(f.marks.size, 0);
});

test('#1066 mutation delivery preserves every oldValue instead of inventing write timestamps', () => {
  const f = pageFixture();
  f.plan.attributes.set('viewBox', '2 0 10 10');
  f.observer.callback([{ target: f.plan, attributeName: 'viewBox', oldValue: '0 0 10 10' },
    { target: f.plan, attributeName: 'viewBox', oldValue: '1 0 10 10' }]);
  const data = f.context.window.__hpDaycycleObservation.stop();
  assert.deepEqual(Array.from(data.mutations, row => row.oldValue), ['0 0 10 10', '1 0 10 10']);
  assert.equal(data.mutations[0].observedAt, data.mutations[1].observedAt);
  assert.equal(data.mutations[0].valueAtDelivery, '2 0 10 10');
});

test('#1066 trace alignment requires the real matching marker; missing CPU data stays unknown', () => {
  const page = { marker: 'own', markerAt: 10 };
  const aligned = daycycleTraceObservation([{ name: 'own', ts: 15000 }, { name: 'RasterTask', dur: 500 }], page, null);
  assert.equal(aligned.clockAlignment.traceOriginMicros, 5000);
  assert.match(aligned.rasterCpuClock, /^unavailable/);
  const missing = daycycleTraceObservation([{ name: 'other', ts: 1 }], page, null);
  assert.equal(missing.clockAlignment.status, 'unavailable');
  assert.equal(missing.clockAlignment.traceOriginMicros, null);
  const cpu = daycycleTraceObservation([{ name: 'RasterTask', tdur: 25 }], page, null);
  assert.equal(cpu.rasterCpuClock, 'tdur retained where provided');
});

test('#1066 GPU provenance is protocol data or an explicit unavailable result', async () => {
  let detached = 0;
  const gpu = { devices: [{ vendorId: 1, deviceId: 2 }], auxAttributes: { glRenderer: 'fixture' } };
  const session = { send: async command => { assert.equal(command, 'SystemInfo.getInfo'); return { gpu }; },
    detach: async () => { detached++; } };
  assert.deepEqual((await daycycleEnvironment({ newBrowserCDPSession: async () => session })).gpu.data, gpu);
  const unavailable = await daycycleEnvironment({ newBrowserCDPSession: async () => { throw new Error('unsupported'); } });
  assert.equal(unavailable.gpu.status, 'unavailable');
  assert.equal(unavailable.gpu.data, null);
  assert.match(unavailable.gpu.reason, /unsupported/);
  assert.equal(detached, 1);
  assert.ok(unavailable.resources.availableParallelism > 0);
});

test('#1066 LayerTree subscription preserves IDs, paints and receipt-clock boundary, then detaches', async () => {
  const listeners = new Map(), commands = [];
  const cdp = { on: (name, fn) => listeners.set(name, fn), off: name => listeners.delete(name),
    send: async name => { commands.push(name); } };
  const observation = await beginDaycycleLayers(cdp);
  listeners.get('LayerTree.layerTreeDidChange')({ layers: [{ layerId: '17', backendNodeId: 42, drawsContent: true }] });
  listeners.get('LayerTree.layerPainted')({ layerId: '17', clip: { x: 1, y: 2, width: 3, height: 4 } });
  const result = await observation.stop();
  assert.equal(result.status, 'available');
  assert.equal(result.events[0].layers[0].backendNodeId, 42);
  assert.equal(result.events[1].clip.width, 3);
  assert.match(result.clock, /Node.*receipt/);
  assert.equal(listeners.size, 0);
  assert.deepEqual(commands, ['LayerTree.enable', 'LayerTree.disable']);
});

test('#1066 absent LayerTree support is explicit and does not fabricate layer data', async () => {
  const cdp = { on() {}, off() {}, send: async () => { throw new Error('not supported'); } };
  const result = await (await beginDaycycleLayers(cdp)).stop();
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.events, []);
});

test('#1066 DOM backend identities bind named geometry and absent nodes without layout commands', async () => {
  const commands = [];
  const cdp = { async send(command, params) {
    commands.push(command);
    if (command === 'Runtime.evaluate') return { result: params.expression.includes('outline') ? {} : { objectId: 'node' } };
    if (command === 'DOM.describeNode') return { node: { backendNodeId: 42 } };
    if (command === 'Runtime.releaseObject') return {};
    throw new Error('unexpected command');
  } };
  const result = await daycycleLayerNodes(cdp);
  assert.equal(result.find(row => row.role === 'plan').backendNodeId, 42);
  assert.equal(result.find(row => row.role === 'outline').status, 'absent');
  assert.equal(commands.filter(name => name === 'Runtime.releaseObject').length, 3);
});

const legacyReport = () => pairedMeasurementReport({ materialSha: 'a'.repeat(40), materialClean: true,
  fixture: DAYCYCLE_FIXTURE,
  environment: { ok: true, actual: { version: '151', mode: 'headless-shell', resolvedExecutable: '/pinned' },
    expected: { version: '151' }, playwright: { pinned: '1.62', installed: '1.62' } },
  ...Object.fromEntries([['staticSamples', 'static'], ['dayCycleSamples', 'daynight']].map(([key, mode]) => [key,
    Array.from({ length: 3 }, (_, round) => ({ mode, round, order: round * 2 + (mode === 'static' ? 0 : 1),
      steps: 60, ready: { ok: true, mode }, startedAt: 1, endedAt: 11, wallMs: 10,
      ms: mode === 'static' ? 1 : 2.4, tasks: 1, rasterTasks: [{ ts: 100, dur: mode === 'static' ? 1000 : 2400 }] }))])) });

test('#1066 unavailable historical telemetry does not rehabilitate an original valid RED', () => {
  const input = legacyReport(), before = structuredClone(input);
  const summary = analyzeDaycycleReport(input);
  assert.equal(summary.originalVerdict.measurementValid, true);
  assert.equal(summary.originalVerdict.rasterRatioWithinBudget, false);
  assert.equal(summary.originalVerdict.ratio, 2.4);
  assert.ok(summary.samples.every(row => row.status === 'unavailable'));
  assert.deepEqual(input, before, 'all original samples and verdict remain untouched');
});

test('#1066 comparison refuses to call foreign source or absent tree matching', () => {
  const left = legacyReport(), right = legacyReport();
  right.materialSha = 'b'.repeat(40);
  const result = compareDaycycleReports(left, right);
  assert.equal(result.matching.source, false);
  assert.equal(result.matching.tree, false);
  assert.equal(result.matching.fixture, true);
  assert.equal(result.matching.chromium, true);
  assert.equal(result.left.originalVerdict.rasterRatioWithinBudget, false);
  assert.match(result.conclusion, /do not identify a cause/);
});

const observedReport = () => {
  const report = legacyReport();
  for (const row of [...report.staticSamples, ...report.dayCycleSamples]) {
    row.diagnostics = { page: { marker: 'own', markerAt: 1, stoppedAt: 3050, overheadMs: .2,
      pointers: Array.from({ length: 60 }, (_, step) => ({ type: 'pointermove', at: step * 50, buttons: 1, trusted: true })),
      frames: Array.from({ length: 120 }, (_, index) => ({ step: Math.floor(index / 2) + 1,
        raf: index % 2 + 1, timestamp: index * 25, geometry: [{ role: 'plan' }, { role: 'outline' }] })),
      mutations: Array.from({ length: 30 }, (_, index) => ({ role: 'outline', attribute: 'viewBox', observedAt: index * 100 })),
    }, clockAlignment: { status: 'available', traceOriginMicros: 0 }, rasterCpuClock: 'unavailable',
    layers: { status: 'available', events: [{ layers: [{ layerId: '7', backendNodeId: 9 }] }] },
    layerNodes: [{ role: 'outline', backendNodeId: 9 }] };
  }
  return report;
};

test('#1066 observed evidence reports input/refresh clocks and every task without claiming CPU or causality', () => {
  const report = observedReport(), before = structuredClone(report);
  const summary = analyzeDaycycleReport(report), row = summary.samples[0];
  assert.equal(row.status, 'observed');
  assert.equal(row.pointerMoves, 60);
  assert.equal(row.rafCallbacks, 120);
  assert.equal(row.cameraSnapshots, 60);
  assert.equal(row.inputIntervalMs.median, 50);
  assert.equal(row.rafIntervalMs.median, 25);
  assert.equal(row.outlineViewBoxWrites, 30);
  assert.equal(row.outlineWriteDeliveryIntervalMs.median, 100);
  assert.deepEqual(row.observedLayerIds, ['7']);
  assert.equal(row.layerNodes[0].backendNodeId, 9);
  assert.equal(row.temporalBins.reduce((sum, bin) => sum + bin.rasterTasksStartingInInterval, 0), 1);
  assert.equal(summary.originalVerdict.rasterRatioWithinBudget, false);
  assert.deepEqual(report, before);
});

test('#1066 absent trust, missing frames/geometry and clock provenance remain incomplete/unknown', () => {
  for (const edit of [r => { r.pointers[0].trusted = false; }, r => r.pointers.pop(),
    r => r.frames.pop(), r => { r.frames[1].geometry = []; }]) {
    const report = observedReport(); edit(report.dayCycleSamples[0].diagnostics.page);
    assert.equal(analyzeDaycycleReport(report).samples[3].status, 'incomplete');
  }
  const report = observedReport();
  report.staticSamples[0].diagnostics.clockAlignment = { status: 'unavailable' };
  assert.equal(analyzeDaycycleReport(report).samples[0].temporalBins, null);
});
