import test from 'node:test';
import assert from 'node:assert/strict';
import { ledDeliveryVerdict } from '../demo/helpers/led-state-delivery.mjs';
import { DAYCYCLE_FIXTURE, PAN_STEPS, SAMPLE_ROUNDS, RATIO_CEILING, pairedMeasurementReport } from '../demo/helpers/daycycle-measurement.mjs';

const expected = { id: 'quality', fill: '#75c52a', alpha: '0.5503' };
const delivery = (active = true) => ({ before: { fields: [] }, wheel: { at: 0, trusted: true, coarseObserved: true },
  deliveredAt: active ? 10 : 250, coarseAtDelivery: active, state: 'on',
  frame: { at: active ? 30 : 280, coarse: active, state: 'on',
    fields: [{ ...expected, visible: true, retained: 48, painted: active ? 24 : 48, correct24: active }] } });

test('#863 LED oracle rejects wrong/missing new active field, RGB/brightness and late lease', () => {
  assert.equal(ledDeliveryVerdict(delivery(), expected), true);
  for (const edit of [r => { r.frame.fields = []; }, r => { r.frame.fields.push(r.frame.fields[0]); },
    r => { r.frame.fields[0].id = 'overlap'; }, r => { r.frame.fields[0].retained = 24; },
    r => { r.frame.fields[0].painted = 48; }, r => { r.frame.fields[0].correct24 = false; },
    r => { r.frame.fields[0].visible = false; }, r => { r.frame.fields[0].fill = '#e14623'; },
    r => { r.frame.fields[0].alpha = '0.3'; }, r => { r.wheel.trusted = false; },
    r => { r.wheel.coarseObserved = false; }, r => { r.coarseAtDelivery = false; },
    r => { r.frame.coarse = false; }, r => { r.frame.state = 'off'; },
    r => { r.frame.at = -1; }, r => { r.before.fields = [{ id: expected.id }]; },
    r => { r.error = 'no active frame'; }, r => { delete r.frame; }]) {
    const row = delivery(); edit(row); assert.equal(ledDeliveryVerdict(row, expected), false, JSON.stringify(row));
  }
  assert.equal(ledDeliveryVerdict(delivery(false), expected), false, 'settled cannot prove active');
  assert.equal(ledDeliveryVerdict(delivery(false), expected, 'settled'), true);
  assert.equal(ledDeliveryVerdict(delivery(false), expected, 'unknown'), false);
  const stuck = delivery(false); stuck.frame.fields[0].painted = 24;
  assert.equal(ledDeliveryVerdict(stuck, expected, 'settled'), false, 'full48 restoration remains required');
});

const input = () => ({ materialSha: 'a'.repeat(40), materialClean: true, fixture: DAYCYCLE_FIXTURE,
  environment: { ok: true, actual: { version: '151', mode: 'headless-shell', resolvedExecutable: '/pinned' },
    expected: { version: '151' }, playwright: { pinned: '1.62', installed: '1.62' } },
  ...Object.fromEntries([['staticSamples', 'static'], ['dayCycleSamples', 'daynight']].map(([key, mode]) => [key,
    Array.from({ length: SAMPLE_ROUNDS }, (_, round) => ({ mode, round, order: round * 2 + (mode === 'static' ? 0 : 1),
      steps: PAN_STEPS, ready: { ok: true, mode }, startedAt: 1, endedAt: 11, wallMs: 10,
      ms: mode === 'static' ? 1 : 1.5, tasks: 1, rasterTasks: [{ ts: 100, dur: mode === 'static' ? 1000 : 1500 }] }))])) });

test('#863 raster proof retains all pairs and rejects incomplete/unready/wrong environment material', () => {
  const row = input(), report = pairedMeasurementReport(row);
  assert.equal(report.measurementValid, true); assert.equal(report.rasterRatioWithinBudget, true);
  assert.deepEqual(report.pairedRatios, [1.5, 1.5, 1.5]); assert.equal(report.ratio, 1.5);
  assert.equal(report.staticSamples, row.staticSamples, 'no trimming/discarding raw samples');
  assert.equal(report.ceiling, 2);
  for (const edit of [r => { r.staticSamples.pop(); }, r => { r.dayCycleSamples[0].ready.ok = false; },
    r => { r.dayCycleSamples[0].ready.mode = 'static'; }, r => { r.staticSamples[0].order = 1; },
    r => { r.staticSamples[0].steps--; }, r => { r.staticSamples[0].wallMs = 0; },
    r => { r.staticSamples[0].endedAt = 999; }, r => { r.staticSamples[0].ms = 2; },
    r => { r.staticSamples[0].wallMs = Infinity; r.staticSamples[0].endedAt = Infinity; },
    r => { r.staticSamples[0].rasterTasks = []; }, r => { r.staticSamples[0].rasterTasks = 'bad'; },
    r => { r.staticSamples[0].rasterTasks[0].dur = -1; }, r => { r.staticSamples[0].tasks = 0; },
    r => { r.staticSamples[0] = null; }, r => { r.environment.actual.version = 'foreign'; },
    r => { r.environment.ok = false; }, r => { r.environment.playwright.installed = 'foreign'; },
    r => { delete r.environment.actual.resolvedExecutable; }, r => { r.materialSha = 'unknown'; },
    r => { r.materialClean = false; }, r => { r.schema = 2; }, r => { r.fixture = 'cheap'; },
    r => { r.ceiling = RATIO_CEILING + 1; }]) {
    const bad = input(); edit(bad); const rejected = pairedMeasurementReport(bad);
    assert.equal(rejected.measurementValid, false, JSON.stringify(bad));
    assert.equal(rejected.rasterRatioWithinBudget, false); assert.ok(rejected.problems.length);
  }
});

test('#863 raster median does not turn systematic ratio above 2 into PASS', () => {
  const bad = input();
  for (const row of bad.dayCycleSamples) { row.ms = 2.01; row.rasterTasks[0].dur = 2010; }
  const report = pairedMeasurementReport(bad);
  assert.equal(report.measurementValid, true); assert.equal(report.ratio, 2.01);
  assert.equal(report.rasterRatioWithinBudget, false);
  assert.equal(report.dayCycleSamples.length, SAMPLE_ROUNDS);
});
