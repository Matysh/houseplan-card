import test from 'node:test';
import assert from 'node:assert/strict';
import { solveAffine, applyAffine, affineResidual, readVacTelemetry, autoCalibrate, thinPath, pushTrailPoint, isVacMoving, isVacSourceState } from '../test-build/vacuum.js';

test('solveAffine recovers rotation+scale+mirror+offset exactly', () => {
  // target = mirror-X, rotate 90°, scale 0.02, offset (300, 400)
  const f = ([x, y]) => [300 + 0.02 * y, 400 + 0.02 * x];
  const src = [[1000, 2000], [8000, 2500], [3000, 9000], [7000, 7000]];
  const m = solveAffine(src.map((p) => [p, f(p)]));
  assert.ok(m);
  for (const p of [[5000, 5000], [0, 0], [12000, 3000]]) {
    const got = applyAffine(m, p[0], p[1]);
    const want = f(p);
    assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) < 1e-6, String(p));
  }
  assert.ok(affineResidual(m, src.map((p) => [p, f(p)])) < 1e-6);
});

test('solveAffine rejects degenerate input', () => {
  assert.equal(solveAffine([[[0, 0], [0, 0]], [[1, 1], [1, 1]]]), null); // 2 pairs
  // collinear
  assert.equal(solveAffine([[[0, 0], [0, 0]], [[1, 0], [1, 0]], [[2, 0], [2, 0]]]), null);
  assert.equal(solveAffine([[[0, NaN], [0, 0]], [[1, 0], [1, 0]], [[2, 3], [2, 0]]]), null);
});

test('readVacTelemetry: Map Extractor shape', () => {
  const t = readVacTelemetry({
    vacuum_position: { x: 25500, y: 24800, a: 271 },
    path: [{ x: 25000, y: 24000 }, { x: 25100, y: 24100 }],
    rooms: { 16: { name: 'Kitchen', x0: 20000, y0: 20000, x1: 26000, y1: 25000 } },
    map_name: '0',
  });
  assert.deepEqual(t.pos, { x: 25500, y: 24800, a: 271 });
  assert.deepEqual(t.path, [[25000, 24000], [25100, 24100]]);
  assert.equal(t.rooms[0].name, 'Kitchen');
  assert.equal(t.rooms[0].cx, 23000);
  assert.equal(t.mapId, '0');
});

test('readVacTelemetry: Valetudo/Tasshack shapes + junk safety', () => {
  const t = readVacTelemetry({ robot_position: { x: '120', y: '340', angle: '90' }, rooms: [{ id: 7, name: 'Спальня', cx: 10, cy: 20 }] });
  assert.deepEqual(t.pos, { x: 120, y: 340, a: 90 });
  assert.equal(t.rooms[0].id, '7');
  assert.equal(readVacTelemetry({ vacuum_position: { x: 'nope', y: 1 } }), null);
  assert.equal(readVacTelemetry({}), null);
  assert.equal(readVacTelemetry(null), null);
  assert.ok(isVacSourceState({ attributes: { vacuum_position: { x: 1, y: 2 } } }));
  assert.ok(!isVacSourceState({ attributes: { battery: 1 } }));
});

test('autoCalibrate matches by name and solves', () => {
  const f = ([x, y]) => [0.01 * x + 100, -0.01 * y + 900];
  const vac = [
    { id: '1', name: 'Kitchen', cx: 1000, cy: 2000 },
    { id: '2', name: 'Bed Room', cx: 9000, cy: 2500 },
    { id: '3', name: 'office', cx: 3000, cy: 8000 },
    { id: '4', name: 'Garage', cx: 5000, cy: 5000 }, // no plan match
  ];
  const plan = [
    { name: 'kitchen', cx: f([1000, 2000])[0], cy: f([1000, 2000])[1] },
    { name: 'BEDROOM', cx: f([9000, 2500])[0], cy: f([9000, 2500])[1] },
    { name: 'Office', cx: f([3000, 8000])[0], cy: f([3000, 8000])[1] },
  ];
  const r = autoCalibrate(vac, plan);
  assert.ok(r);
  assert.deepEqual(r.matched, ['Kitchen', 'Bed Room', 'office']);
  assert.ok(r.residual < 1e-6);
  // two matches only -> null
  assert.equal(autoCalibrate(vac.slice(0, 2), plan.slice(0, 2)), null);
});

test('thinPath keeps corners, drops straight-line noise', () => {
  const pts = [];
  for (let i = 0; i <= 100; i++) pts.push([i, 0]);
  for (let i = 1; i <= 100; i++) pts.push([100, i]);
  const out = thinPath(pts, 0.5);
  assert.ok(out.length <= 5, String(out.length));
  assert.deepEqual(out[0], [0, 0]);
  assert.deepEqual(out[out.length - 1], [100, 100]);
  assert.ok(out.some((p) => p[0] === 100 && p[1] === 0)); // the corner survives
});

test('pushTrailPoint dedups and respects the cap', () => {
  let buf = [];
  for (let i = 0; i < 3000; i++) buf = pushTrailPoint(buf, [i, (i * 7) % 13], 0.5);
  assert.ok(buf.length <= 600, String(buf.length));
  buf = pushTrailPoint(buf, buf[buf.length - 1], 0.5); // dup ignored
  assert.ok(buf.length <= 600);
});

test('isVacMoving', () => {
  assert.ok(isVacMoving('cleaning'));
  assert.ok(isVacMoving('returning'));
  assert.ok(!isVacMoving('docked'));
  assert.ok(!isVacMoving('idle'));
  assert.ok(!isVacMoving(undefined));
});
