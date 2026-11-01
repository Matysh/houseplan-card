import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compareMeasurements, frozenBaseline, measureFrontend, POLICY, renderMetrics } from '../lib/metrics.mjs';
import { runMeasurements } from '../catalog/measure.mjs';
import { releaseReadiness } from '../lib/release.mjs';

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
  const r = compareMeasurements(candidate, base, base); assert.equal(r.ready, true); assert.equal(r.needsMeasurement, true); assert.equal(r.primary[0].status, 'missing');
  const absent = compareMeasurements(candidate, null, base);
  assert.equal(absent.requiresDecision, false); assert.equal(absent.needsMeasurement, true);
  assert.ok(absent.primary.every(row => row.status === 'missing'));
});
test('size measurement counts actual delivered files once and only initial closure for View', () => {
  const entries = new Map([['frontend/houseplan-assets.json', Buffer.from(JSON.stringify({ initialViewFiles: ['main.js'] }))], ['frontend/main.js', Buffer.from('main')], ['frontend/lazy.js', Buffer.from('lazy')], ['manifest.json', Buffer.from('{}')]]);
  const r = measureFrontend(entries, 1000); assert.equal(r.files.length, 3); assert.equal(r.size_metrics.zip_bytes, 1000);
  assert.ok(r.size_metrics.frontend_all_files_gzip_bytes > r.size_metrics.initial_view_gzip_bytes);
  entries.delete('frontend/main.js'); assert.throws(() => measureFrontend(entries, 1000));
});

// Tiny stored ZIP fixture: real bytes consumed by measureZip, without Python or product builds.
function zipFixture(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name), bytes = Buffer.from(text);
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(bytes.length, 18); h.writeUInt32LE(bytes.length, 22); h.writeUInt16LE(nameBytes.length, 26);
    local.push(h, nameBytes, bytes);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(bytes.length, 20); c.writeUInt32LE(bytes.length, 24); c.writeUInt16LE(nameBytes.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nameBytes); offset += h.length + nameBytes.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

function measurementFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'measurement-diagnostic-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'artifacts', 'process-next'); mkdirSync(output, { recursive: true }); mkdirSync(join(root, 'demo'));
  writeFileSync(join(root, 'demo', 'benchmark_large_house.mjs'), '// fixture benchmark');
  const zip = join(output, 'houseplan.zip'), sourceSha = 'a'.repeat(40);
  writeFileSync(zip, zipFixture([['frontend/houseplan-assets.json', JSON.stringify({ fingerprint: 'fixture-build', initialViewFiles: ['main.js'] })], ['frontend/main.js', 'fixture frontend']]));
  writeFileSync(join(output, 'package.json'), JSON.stringify({ zip, sourceSha, version: '1.99.0-beta.1' }));
  const performance = { sourceSha, buildFingerprint: 'fixture-build', profile: 'fixture', fixture: 'fixture', samples: 7, warmups: 1,
    runtime: { platform: process.platform }, rows: Array.from({ length: 7 }, () => ({ firstStableRenderMs: 100, spaceSwitchMs: 50, panZoomMs: 3, stateUpdateMs: 10 })) };
  const executeBenchmark = ({ performancePath }) => writeFileSync(performancePath, JSON.stringify(performance));
  return { root, output, sourceSha, performance, executeBenchmark };
}

test('failed benchmark produces a diagnostic report with actual sizes and no stale timing', t => {
  const f = measurementFixture(t);
  writeFileSync(join(f.output, 'performance.json'), JSON.stringify(f.performance));
  const result = runMeasurements({ ...f, executeBenchmark: () => { throw Error('Chromium unavailable'); } });
  assert.equal(result.evidenceStatus, 'incomplete');
  assert.ok(result.measurement.size_metrics.zip_bytes > 0);
  assert.deepEqual(result.measurement.timing_metrics, {});
  assert.ok(result.comparison.primary.filter(row => row.unit === 'ms').every(row => row.status === 'missing'));
  assert.match(renderMetrics(result.comparison), /Chromium unavailable/);
  assert.equal(JSON.parse(readFileSync(join(f.output, 'metrics.json'))).evidenceStatus, 'incomplete');
  assert.equal(releaseReadiness({ kind: 'beta', sha: f.sourceSha, runner: { ready: true, sha: f.sourceSha, event: 'beta' }, metrics: result.comparison }).ready, true);
});

test('a missing or nonfinite timing series does not discard other measured values', t => {
  const f = measurementFixture(t);
  f.performance.rows[2].panZoomMs = null;
  const result = runMeasurements(f);
  assert.equal(result.evidenceStatus, 'incomplete');
  assert.equal(result.measurement.timing_metrics.panZoomMs, undefined);
  assert.equal(result.measurement.timing_metrics.firstStableRenderMs.median, 100);
  assert.equal(result.comparison.primary.find(row => row.key === 'panZoomMs').status, 'missing');
});

test('foreign SHA or build fingerprint stays invalid evidence and never becomes a reference snapshot', t => {
  for (const field of ['sourceSha', 'buildFingerprint']) {
    const f = measurementFixture(t); f.performance[field] = 'foreign';
    writeFileSync(join(f.output, 'measurement.json'), JSON.stringify({ source_sha: 'stale' }));
    const result = runMeasurements(f);
    assert.equal(result.evidenceStatus, 'invalid');
    assert.equal(result.measurement, null);
    assert.equal(existsSync(join(f.output, 'measurement.json')), false);
    assert.ok(result.comparison.primary.every(row => row.status === 'missing'));
    assert.match(renderMetrics(result.comparison), /invalid/);
    assert.equal(result.comparison.requiresDecision, false);
    assert.equal(JSON.parse(readFileSync(join(f.output, 'metrics.json'))).evidenceStatus, 'invalid');
  }
});

test('complete collection still records all seven actual metrics', t => {
  const f = measurementFixture(t), result = runMeasurements(f);
  assert.equal(result.evidenceStatus, 'complete');
  assert.equal(result.measurement.measurement_status, 'complete');
  assert.equal(Object.keys(result.measurement.timing_metrics).length, 4);
  assert.equal(result.comparison.primary.length, 7);
});
