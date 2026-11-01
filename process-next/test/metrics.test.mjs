import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMeasurements, frozenBaseline, measureFrontend, POLICY, renderMetrics } from '../lib/metrics.mjs';

function records() { const base = frozenBaseline(); return { base, candidate: structuredClone(base) }; }
test('frozen anchor stays byte-identical and is diagnostic only', () => {
  const { base, candidate } = records(); candidate.size_metrics.zip_bytes *= 2;
  const recent = structuredClone(candidate), r = compareMeasurements(candidate, recent, base);
  assert.equal(r.requiresDecision, false); assert.equal(r.diagnostic[0].status, 'regression'); assert.equal(r.diagnostic[0].blocks, false);
});
test('a size stops publication only beyond both the relative and absolute tolerances', () => {
  const { base, candidate } = records(); const key = 'initial_view_gzip_bytes'; base.size_metrics[key] = 10000;
  for (const [delta, expected] of [[1000, false], [8192, false], [8193, true]]) {
    candidate.size_metrics[key] = base.size_metrics[key] + delta;
    assert.equal(compareMeasurements(candidate, base, base).requiresDecision, expected);
  }
  base.size_metrics[key] = 1e6; candidate.size_metrics[key] = 1050000;
  assert.equal(compareMeasurements(candidate, base, base).requiresDecision, false);
});
test('equal conditions and repeated timing regression require an owner decision', () => {
  const { base, candidate } = records(); candidate.timing_metrics.firstStableRenderMs.samples = Array(7).fill(1200);
  const r = compareMeasurements(candidate, base, base); assert.equal(r.requiresDecision, true); assert.equal(r.needsMeasurement, false);
  assert.match(renderMetrics(r), /решение владельца/);
});
test('one timing outlier cannot stop publication and inconsistent halves ask for measurement', () => {
  const { base, candidate } = records(); candidate.timing_metrics.firstStableRenderMs.samples[0] = 5000;
  assert.equal(compareMeasurements(candidate, base, base).requiresDecision, false);
  candidate.timing_metrics.firstStableRenderMs.samples = [960, 960, 960, 1200, 1200, 1200, 1200];
  const r = compareMeasurements(candidate, base, base); assert.equal(r.requiresDecision, false); assert.equal(r.needsMeasurement, true);
});
test('different host, incomplete timing and missing size are never reported as a valid green comparison', () => {
  const { base, candidate } = records(); candidate.host.cpu = 'another CPU';
  assert.equal(compareMeasurements(candidate, base, base).needsMeasurement, true);
  candidate.host = base.host; candidate.timing_metrics.spaceSwitchMs.samples = [1]; delete candidate.size_metrics.zip_bytes;
  const r = compareMeasurements(candidate, base, base); assert.equal(r.ready, false); assert.equal(r.primary[0].status, 'missing');
});
test('size measurement counts actual delivered files once and only initial closure for View', () => {
  const entries = new Map([['frontend/houseplan-assets.json', Buffer.from(JSON.stringify({ initialViewFiles: ['main.js'] }))], ['frontend/main.js', Buffer.from('main')], ['frontend/lazy.js', Buffer.from('lazy')], ['manifest.json', Buffer.from('{}')]]);
  const r = measureFrontend(entries, 1000); assert.equal(r.files.length, 3); assert.equal(r.size_metrics.zip_bytes, 1000);
  assert.ok(r.size_metrics.frontend_all_files_gzip_bytes > r.size_metrics.initial_view_gzip_bytes);
  entries.delete('frontend/main.js'); assert.throws(() => measureFrontend(entries, 1000));
});
