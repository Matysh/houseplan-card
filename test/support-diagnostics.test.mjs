import test from 'node:test';
import assert from 'node:assert/strict';
import { supportPathSample, supportValueShape, vacuumSupportReasons } from '../test-build/support-diagnostics.js';
import { parseSupportCoverage, parseSupportPreview, supportResponseToken, supportPackageVersion, SUPPORT_COVERAGE_CATEGORIES } from '../test-build/support-feedback.js';

test('#942 exact version negotiation and closed coverage reject future/malformed data', () => {
  assert.equal(supportPackageVersion([1, 2]), 2);
  for (const legacy of [undefined, null, [1], ['2'], true]) assert.equal(supportPackageVersion(legacy), 1);
  const rows = SUPPORT_COVERAGE_CATEGORIES.map(category => ({ category, status: 'partial', reasons: ['missing_client'], observed: 0, total: 1 }));
  assert.deepEqual(parseSupportCoverage(rows), rows);
  for (const invalid of [null, rows.slice(1), [...rows.slice(1), rows[1]],
    rows.map(row => ({ ...row, arbitrary: 'secret' })), rows.map(row => ({ ...row, status: 'future' })),
    rows.map(row => ({ ...row, reasons: ['private provider exception'] })), rows.map(row => ({ ...row, observed: true }))]) {
    assert.throws(() => parseSupportCoverage(invalid));
  }
});

test('#942 source shape never sends readings, coerces bool coordinates, or joins path gaps', () => {
  assert.equal(supportValueShape('27.3456789'), 'numeric');
  assert.equal(supportValueShape('private sensor text'), 'text');
  assert.equal(supportValueShape({ name: 'private' }), 'non_scalar');
  assert.equal(supportValueShape(Infinity), 'missing');
  const budget = { points: 3, fragments: 3 };
  const sample = supportPathSample([[[0, 0], [1, 1], [false, 2], [3, 3]], [[4, 4]]], budget);
  assert.deepEqual(sample.fragments, [
    { fragment: 0, start: 0, end: 2, points: [[0, 0], [1, 1]] },
    { fragment: 0, start: 3, end: 4, points: [[3, 3]] },
  ]);
  assert.equal(sample.truncated, true);
  assert.equal(supportPathSample([[[8, 8]]], budget).kept_points, 0);
});

test('#942 #918 actual overlay planner distinguishes root/route mismatch from stopped cleaning', () => {
  const route = { id: 'r', source: 'camera.b', map_id: '1', space: 'floor', calibration: [1, 0, 0, 1, 0, 0] };
  const frame = { source: 'camera.a', telemetry: { pos: { x: 0, y: 0, a: null }, path: [], rooms: [], mapId: '1' },
    routes: [route], resolution: { kind: 'ready', route }, runtime: { moving: true, trail: [] },
    server: { current: { map_id: '1', path_format: 2, paths: [[[0, 0], [1, 1]]] } } };
  const device = { id: 'm', name: 'robot', space: 'floor', area: 'a', model: '', icon: '', entities: ['vacuum.robot'],
    marker: { id: 'm', binding: 'entity:vacuum.robot', vacuum: { source: 'camera.a', map_routes: [route] } } };
  const mismatch = vacuumSupportReasons(device, frame, 'floor', 'ok');
  assert.equal(mismatch.plan.currentRunMatches, false);
  assert.deepEqual(mismatch.reasons, ['run_source_mismatch']);
  const control = structuredClone(device); control.marker.vacuum.source = 'camera.b';
  assert.equal(vacuumSupportReasons(control, frame, 'floor', 'ok').plan.currentRunMatches, true);
  const stopped = structuredClone(frame); stopped.runtime.moving = false;
  assert.deepEqual(vacuumSupportReasons(control, stopped, 'floor', 'ok').reasons, ['stopped']);
  const pinned = structuredClone(frame); pinned.server.current.route_id = 'foreign-route';
  assert.deepEqual(vacuumSupportReasons(control, pinned, 'floor', 'ok').reasons, ['run_route_mismatch']);
  assert.ok(vacuumSupportReasons(control, frame, 'other-floor', 'ok').reasons.includes('foreign_space'));
  assert.ok(vacuumSupportReasons(control, undefined, 'floor', 'unavailable').reasons.includes('runtime_unavailable'));
});

test('#942 independent hidden/static/mode/live reasons remain an honest list', () => {
  const device = { hidden: true, marker: { display: 'static_icon', vacuum: { live: false, trail_mode: 'never' } } };
  const result = vacuumSupportReasons(device, undefined, 'floor', 'disabled');
  for (const reason of ['hidden', 'static_display', 'live_disabled', 'mode_never', 'source_disabled', 'runtime_unavailable']) {
    assert.ok(result.reasons.includes(reason), reason);
  }
});

test('#942 prepared preview preserves exact bytes and rejects a misleading version/coverage', () => {
  const coverage = SUPPORT_COVERAGE_CATEGORIES.map(category => ({ category, status: 'complete', reasons: [], observed: 1, total: 1 }));
  const text = JSON.stringify({ format: 'houseplan-support-package', version: 2, diagnostics: { coverage } }) + '\n';
  const payload = { text, size: Buffer.byteLength(text), expires_in: 600, spaces: 1,
    token: 'a'.repeat(48), sha256: 'b'.repeat(64), version: 2, format: 'houseplan-support-package', coverage };
  const preview = parseSupportPreview(payload, 2, 1000);
  assert.equal(preview.text, text);
  assert.equal(preview.expiresAt, 601000);
  for (const extra of [{ version: 1 }, { version: '2' }, { size: payload.size + 1 }, { expires_in: 601 },
    { coverage: coverage.slice(1) }, { text: text.replace('"complete"', '"partial"') }, { text: '{bad}\n' }]) {
    assert.throws(() => parseSupportPreview({ ...payload, ...extra }, 2));
    assert.equal(supportResponseToken({ ...payload, ...extra }), payload.token, 'allocated token remains discardable after malformed metadata');
  }
  assert.equal(supportResponseToken({ token: 'private' }), '');
});
