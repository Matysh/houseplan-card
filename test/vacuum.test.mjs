import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  solveAffine, applyAffine, affineResidual, readVacTelemetry, autoCalibrate,
  thinPath, pushTrailPoint, isVacMoving, isVacSourceState, vacMapIdFromAttrs,
  vacMapIdWithFallback, areaCentroid, normalizeVacPath, resolveCurrentVacPath,
  trimVacPathTarget, smoothVacPath, VAC_TRAIL_SMOOTH_RADIUS_CM,
  parseVacSourceCandidate, resolveVacSource,
  vacCalibrationResidualCm, vacRoomNameMatchCount, VAC_CALIBRATION_WARN_CM,
} from '../test-build/vacuum.js';

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
    rooms: { 16: { name: 'Kitchen', cx: 23000, cy: 22500, x0: 20000, y0: 20000, x1: 26000, y1: 25000 } },
    map_name: '0',
  });
  assert.deepEqual(t.pos, { x: 25500, y: 24800, a: 271 });
  assert.deepEqual(t.path, [[[25000, 24000], [25100, 24100]]]);
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

test('readVacTelemetry: Tasshack room centres come as plain x/y', () => {
  // shape captured from a live Dreame X50 Master (dacha, 2026-07-31)
  const t = readVacTelemetry({
    vacuum_position: { x: 1399, y: -55, a: 181 },
    rooms: { 2: { room_id: 2, name: 'Кладовка', x0: 800, y0: -2000, x1: 4200, y1: 300, x: 2575, y: -825 } },
  });
  assert.equal(t.rooms[0].name, 'Кладовка');
  // Explicit x/y is the calibration anchor; bbox is independently retained.
  assert.equal(t.rooms[0].cx, 2575);
  assert.deepEqual(
    [t.rooms[0].x0, t.rooms[0].y0, t.rooms[0].x1, t.rooms[0].y1],
    [800, -2000, 4200, 300],
  );
  const t2 = readVacTelemetry({ vacuum_position: { x: 0, y: 0 }, rooms: { 2: { name: 'Кладовка', x: 2575, y: -825 } } });
  assert.equal(t2.rooms[0].cx, 2575);
});

test('readVacTelemetry keeps XCME subpath gaps and Valetudo outline geometry', () => {
  const t = readVacTelemetry({
    vacuum_position: { x: 5, y: 6 },
    path: { path: [
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      [{ x: 10, y: 10 }, { x: 11, y: 11 }, { x: null, y: 2 }],
    ] },
    rooms: {
      l: { name: 'L', outline: [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4], [0, 0]] },
    },
  });
  assert.deepEqual(t.path, [
    [[0, 0], [1, 1]],
    [[10, 10], [11, 11]],
  ]);
  assert.deepEqual(
    [t.rooms[0].x0, t.rooms[0].y0, t.rooms[0].x1, t.rooms[0].y1],
    [0, 0, 4, 4],
  );
  assert.ok(Math.abs(t.rooms[0].cx - 1.3571428571428572) < 1e-12);
  assert.ok(Math.abs(t.rooms[0].cy - 1.3571428571428572) < 1e-12);
});

test('room anchor priority never mixes fields from different tiers', () => {
  const t = readVacTelemetry({
    vacuum_position: { x: 0, y: 0 },
    rooms: [{
      id: 1, name: 'Atomic pair', cx: 999,
      center: { x: 20, y: 30 }, x: 40, y: 50,
      outline: [[0, 0], [10, 0], [10, 10], [0, 10]],
    }],
  });
  assert.deepEqual([t.rooms[0].cx, t.rooms[0].cy], [20, 30]);
});

test('bbox centre is the final calibration-anchor fallback for bbox-only dialects', () => {
  const t = readVacTelemetry({
    vacuum_position: { x: 0, y: 0 },
    rooms: [{ id: 1, name: 'BBox only', x0: 100, y0: 80, x1: 0, y1: -20 }],
  });
  assert.equal(t.rooms.length, 1);
  assert.deepEqual(t.rooms[0], {
    id: '1', name: 'BBox only', cx: 50, cy: 30,
    x0: 0, y0: -20, x1: 100, y1: 80,
  });
  const incomplete = readVacTelemetry({
    vacuum_position: { x: 0, y: 0 },
    rooms: [{ id: 2, name: 'Incomplete bbox', x0: 0, y0: 0, x1: 100 }],
  });
  assert.deepEqual(incomplete.rooms, []);
});

test('areaCentroid has deterministic closing, zero-area, invalid and butterfly behaviour', () => {
  assert.deepEqual(areaCentroid([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]), [1, 1]);
  assert.deepEqual(areaCentroid([[0, 0], [1, 0], [2, 0]]), [1, 0]);
  assert.equal(areaCentroid([[0, 0], [1, Number.NaN], [0, 1]]), null);
  assert.deepEqual(areaCentroid([[0, 0], [2, 2], [0, 2], [2, 0]]), [1, 1]);
});

test('normalizeVacPath filters before cap and distributes the exact 4000-point budget', () => {
  const many = [];
  for (let segment = 0; segment < 66; segment++) {
    const length = 70 + (segment % 3) * 10;
    many.push(Array.from({ length }, (_, point) => [segment, point]));
    many.push([[segment, 999]]); // singleton must not displace a drawable segment
  }
  const out = normalizeVacPath(many);
  assert.equal(out.length, 64);
  assert.equal(out.reduce((sum, segment) => sum + segment.length, 0), 4000);
  assert.equal(out[0][0][0], 2); // oldest two drawable segments were capped
  for (const segment of out) {
    const source = many.find((candidate) => candidate.length > 1 && candidate[0][0] === segment[0][0]);
    assert.deepEqual(segment[0], source[0]);
    assert.deepEqual(segment.at(-1), source.at(-1));
  }
});

test('normalizeVacPath uses largest remainder over internal points', () => {
  const lengths = [3002, 2002, 1002];
  const out = normalizeVacPath(lengths.map((length, segment) =>
    Array.from({ length }, (_, point) => [segment, point])));
  assert.deepEqual(out.map((segment) => segment.length), [1999, 1333, 668]);
  assert.equal(out.reduce((sum, segment) => sum + segment.length, 0), 4000);
});

test('normalizeVacPath largest-remainder ties prefer the older subpath', () => {
  const out = normalizeVacPath([0, 1, 2].map((segment) =>
    Array.from({ length: 10002 }, (_, point) => [segment, point])));
  assert.deepEqual(out.map((segment) => segment.length), [1334, 1333, 1333]);
  assert.equal(out.reduce((sum, segment) => sum + segment.length, 0), 4000);
});

test('resolveCurrentVacPath arbitrates only drawable sources and preserves gaps', () => {
  const server = { points: [[1, 1], [2, 2]] };
  assert.equal(resolveCurrentVacPath({ path: [[]] }, server, []).source, 'server');
  assert.equal(resolveCurrentVacPath({ path: [[[9, 9]]] }, server, []).source, 'server');
  assert.equal(resolveCurrentVacPath({ path: [[[NaN, 1], [2, Infinity]]] }, server, []).source, 'server');
  const integration = resolveCurrentVacPath({ path: [
    [[0, 0]], [[10, 10], [11, 11]], [[20, 20], [21, 21]],
  ] }, server, []);
  assert.equal(integration.source, 'integration');
  assert.deepEqual(integration.path, [
    [[10, 10], [11, 11]], [[20, 20], [21, 21]],
  ]);
  assert.deepEqual(trimVacPathTarget([[[0, 0], [1, 1]], [[5, 5], [6, 6], [7, 7]]]), [
    [[0, 0], [1, 1]], [[5, 5], [6, 6]],
  ]);
});

test('smoothVacPath rounds corners within 17.5 cm and preserves exact endpoints', () => {
  const gridPitch = 100;
  const cellCm = 5;
  const radius = (VAC_TRAIL_SMOOTH_RADIUS_CM / cellCm) * gridPitch;
  const source = [[[0, 0], [900, 0], [900, 500], [1400, 650]]];
  const [commands] = smoothVacPath(source, radius);
  assert.deepEqual(commands[0], { kind: 'move', point: source[0][0] });
  assert.deepEqual(commands.at(-1), { kind: 'line', point: source[0].at(-1) });
  assert.equal(commands.filter((command) => command.kind === 'quadratic').length, 2);

  const distanceToSegment = (point, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const denominator = dx * dx + dy * dy;
    const t = denominator ? Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator)) : 0;
    return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
  };
  const distanceToSource = (point) => Math.min(...source[0].slice(1).map(
    (end, index) => distanceToSegment(point, source[0][index], end),
  ));
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    if (command.kind !== 'quadratic') continue;
    const start = commands[index - 1].point;
    for (let sample = 0; sample <= 100; sample++) {
      const t = sample / 100, u = 1 - t;
      const point = [
        u * u * start[0] + 2 * u * t * command.control[0] + t * t * command.point[0],
        u * u * start[1] + 2 * u * t * command.control[1] + t * t * command.point[1],
      ];
      const deviationCm = (distanceToSource(point) / gridPitch) * cellCm;
      assert.ok(deviationCm <= VAC_TRAIL_SMOOTH_RADIUS_CM + 1e-9,
        `curve deviated by ${deviationCm} cm`);
    }
  }
});

test('smoothVacPath preserves subpath gaps and bounds short uneven corners', () => {
  const path = [
    [[0, 0], [2, 0], [2, 1000]],
    [[5000, 5000], [5010, 5000], [5010, 5001], [6000, 5001]],
  ];
  const result = smoothVacPath(path, 100);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((segment) => segment[0]), [
    { kind: 'move', point: [0, 0] },
    { kind: 'move', point: [5000, 5000] },
  ]);
  assert.deepEqual(result.map((segment) => segment.at(-1).point), [[2, 1000], [6000, 5001]]);
  const firstCurve = result[0].find((command) => command.kind === 'quadratic');
  assert.deepEqual(firstCurve.point, [2, 1]);
});

test('smoothVacPath fails closed for degenerate, non-finite and reversal input', () => {
  assert.deepEqual(smoothVacPath([], 10), []);
  assert.deepEqual(smoothVacPath([[[0, 0]]], 10), []);
  assert.deepEqual(smoothVacPath([[[0, 0], [1, 1]]], 0), []);
  assert.deepEqual(smoothVacPath([[[0, 0], [NaN, 1], [2, 2]]], 10), []);
  const duplicate = smoothVacPath([[[0, 0], [0, 0], [10, 0]]], 10);
  assert.deepEqual(duplicate, [[
    { kind: 'move', point: [0, 0] },
    { kind: 'line', point: [10, 0] },
  ]]);
  const reversal = smoothVacPath([[[0, 0], [10, 0], [0, 0]]], 10)[0];
  assert.equal(reversal.some((command) => command.kind === 'quadratic'), false);
  assert.equal(JSON.stringify(reversal).includes('null'), false);
});

test('smoothVacPath stays linear and finite at the 64/4000 path budget', () => {
  const path = Array.from({ length: 64 }, (_, segment) => {
    const length = segment < 32 ? 63 : 62;
    return Array.from({ length }, (_, point) => [segment * 1000 + point, point % 2]);
  });
  const pointCount = path.reduce((sum, segment) => sum + segment.length, 0);
  assert.equal(pointCount, 4000);
  const result = smoothVacPath(path, 17.5);
  const commandCount = result.reduce((sum, segment) => sum + segment.length, 0);
  assert.equal(result.length, 64);
  assert.ok(commandCount <= pointCount * 2);
  assert.equal(JSON.stringify(result).includes('null'), false);
});

test('parseVacSourceCandidate is deterministic and explains XCME/camera capability', () => {
  const positioned = parseVacSourceCandidate('camera.map', {
    attributes: { friendly_name: 'Map', vacuum_position: { x: 1, y: 2 }, rooms: {} },
  }, { platform: 'xiaomi_cloud_map_extractor' });
  assert.equal(positioned.category, 'compatible');
  assert.equal(positioned.score, 300);
  const xcme = parseVacSourceCandidate('camera.map', { attributes: {} }, {
    platform: 'xiaomi_cloud_map_extractor',
  });
  assert.equal(xcme.category, 'known_xcme_incomplete');
  assert.equal(parseVacSourceCandidate('sensor.position', {
    attributes: { position: '(1, 2, 3)' },
  }), null);
});

test('resolveVacSource is sticky, order-independent and never auto-selects global cameras', () => {
  const a = parseVacSourceCandidate('camera.a', {
    attributes: { vacuum_position: { x: 1, y: 2 } },
  }, { platform: 'demo' });
  const z = parseVacSourceCandidate('camera.z', {
    attributes: { vacuum_position: { x: 3, y: 4 } },
  }, { platform: 'demo' });
  const vacuum = parseVacSourceCandidate('vacuum.self', {
    attributes: { vacuum_position: { x: 5, y: 6 } },
  }, { platform: 'demo' });
  const statuses = {
    'camera.a': 'ok', 'camera.z': 'ok', 'camera.saved': 'missing', 'vacuum.self': 'ok',
  };
  const first = resolveVacSource(null, ['camera.z', 'camera.a'], [z, a], statuses);
  const reordered = resolveVacSource(null, ['camera.a', 'camera.z'], [a, z], statuses);
  assert.equal(first.entityId, 'camera.a');
  assert.equal(reordered.entityId, 'camera.a');
  assert.equal(resolveVacSource(null, ['vacuum.self', 'camera.z'], [vacuum, z], statuses).entityId, 'camera.z');
  assert.equal(resolveVacSource(null, [], [a], statuses).entityId, null);
  const sticky = resolveVacSource('camera.saved', ['camera.a'], [a], statuses);
  assert.deepEqual(
    { entityId: sticky.entityId, status: sticky.status, pinned: sticky.pinned },
    { entityId: 'camera.saved', status: 'missing', pinned: true },
  );
  assert.equal(resolveVacSource('camera.unknown', [], [], {}).status, 'unverified');
  for (const status of ['disabled', 'unavailable', 'unverified', 'unsupported']) {
    const result = resolveVacSource('camera.saved', ['camera.a'], [a], {
      ...statuses, 'camera.saved': status,
    });
    assert.equal(result.entityId, 'camera.saved');
    assert.equal(result.status, status);
  }
});

test('vacRoomNameMatchCount uses calibration canonicalisation and unique room names', () => {
  const rooms = [
    { id: '1', name: 'Living Room', cx: 0, cy: 0 },
    { id: '2', name: 'living_room', cx: 1, cy: 1 },
    { id: '3', name: 'Kitchen.', cx: 2, cy: 2 },
    { id: '4', name: 'Bedroom', cx: 3, cy: 3 },
  ];
  assert.equal(vacRoomNameMatchCount(rooms, ['Living-room', 'Kitchen', 'Office']), 2);
});

test('calibration warning threshold is expressed in physical centimetres', () => {
  assert.equal(vacCalibrationResidualCm(8, 10, 50), 40);
  assert.equal(vacCalibrationResidualCm(8.01, 10, 50) > VAC_CALIBRATION_WARN_CM, true);
  assert.equal(vacCalibrationResidualCm(1, 0, 5), Infinity);
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

test('fitMatrix/fitFromMatrix round-trip, mirror and quarters', async () => {
  const { fitMatrix, fitFromMatrix, initialFit, reanchorFit } = await import('../test-build/vacuum.js');
  for (const rot of [0, 90, 180, 270]) for (const mir of [false, true]) {
    const p = { ox: 123.4, oy: -55.5, s: 0.083, rot, mir };
    const q = fitFromMatrix(fitMatrix(p));
    assert.equal(q.rot, rot, `rot ${rot} mir ${mir}`);
    assert.equal(q.mir, mir);
    assert.ok(Math.abs(q.s - p.s) < 1e-9 && Math.abs(q.ox - p.ox) < 1e-9 && Math.abs(q.oy - p.oy) < 1e-9);
  }
  // the real X50 matrix shape: X forward, Y flipped == mir + 180? decompose sanity
  const q = fitFromMatrix([0.08, 0, 590, 0, -0.08, 677]);
  assert.equal(q.mir, true);
  // initialFit centres the map bbox on the canvas
  const rooms = [{ id: '1', name: 'A', cx: 500, cy: 500, x0: 0, y0: 0, x1: 1000, y1: 1000 }];
  const f = initialFit(rooms, [0, 0, 1000, 1000]);
  const m = fitMatrix(f);
  const c = applyAffine(m, 500, 500);
  assert.ok(Math.abs(c[0] - 500) < 1e-6 && Math.abs(c[1] - 500) < 1e-6);
  assert.ok(Math.abs(1000 * f.s - 600) < 1e-6); // 60% of the canvas
  assert.equal(f.mir, true);
  // reanchor keeps the chosen source point fixed through a rotation
  const p2 = { ...f, rot: 90 };
  const r2 = reanchorFit(p2, f, 500, 500);
  const c2 = applyAffine(fitMatrix(r2), 500, 500);
  assert.ok(Math.abs(c2[0] - c[0]) < 1e-6 && Math.abs(c2[1] - c[1]) < 1e-6);
});

// HP-1540-02: the map-id contract, mirrored by trails.py resolve_map_id —
// the first value that is not null/undefined wins; zero and '' are valid ids.
test('vacMapIdFromAttrs: first NOT-nullish value wins, zero survives', () => {
  assert.equal(vacMapIdFromAttrs({ map_index: 0 }), '0');
  assert.equal(vacMapIdFromAttrs({ map_index: '0' }), '0');
  assert.equal(vacMapIdFromAttrs({ map_name: '', selected_map: 'Floor' }), '');
  assert.equal(vacMapIdFromAttrs({ map_name: 'A', map_index: 0 }), 'A');
  assert.equal(vacMapIdFromAttrs({ current_map: 2 }), '2');
  assert.equal(vacMapIdFromAttrs({ selected_map: 'Vac' }), 'Vac');
  assert.equal(vacMapIdFromAttrs({}), 'default');
});

// HP-1541-01: the vacuum-entity fallback half of the contract. Truthiness
// here turned selected_map: 0 into 'default' while the server recorder
// stored the trail under '0' — reloads never showed the saved run.
test('vacMapIdWithFallback: selected_map 0 / "0" / "" survive, nullish falls back', () => {
  assert.equal(vacMapIdWithFallback('default', 0), '0');
  assert.equal(vacMapIdWithFallback('default', '0'), '0');
  assert.equal(vacMapIdWithFallback('default', ''), '');
  assert.equal(vacMapIdWithFallback('default', 'Vac'), 'Vac');
  assert.equal(vacMapIdWithFallback('default', null), 'default');
  assert.equal(vacMapIdWithFallback('default', undefined), 'default');
  assert.equal(vacMapIdWithFallback('1', 0), '1'); // telemetry wins over fallback
});

// HP-1541-01 cross-runtime contract: for the same inputs the card-side chain
// (vacMapIdFromAttrs -> vacMapIdWithFallback) must yield exactly what
// trails.py resolve_map_id stores. Mirrored by
// tests_backend/test_trail_recorder.py::test_map_id_contract_first_not_none_wins.
test('map-id contract: frontend chain matches backend resolve_map_id', () => {
  const chain = (srcAttrs, vacSel) => vacMapIdWithFallback(vacMapIdFromAttrs(srcAttrs), vacSel);
  assert.equal(chain({}, 0), '0');
  assert.equal(chain({}, '0'), '0');
  assert.equal(chain({}, ''), '');
  assert.equal(chain({}, 'Vac'), 'Vac');
  assert.equal(chain({}, undefined), 'default');
  assert.equal(chain({ map_index: 0 }, 'Vac'), '0'); // source wins over vacuum
});

test('map-id shared fixture ignores changing vacuum_json_id nonce', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('./fixtures/vacuum-attrs/map-id.json', import.meta.url), 'utf8',
  ));
  for (const row of fixture) {
    const got = vacMapIdWithFallback(vacMapIdFromAttrs(row.source), row.vacuum.selected_map);
    assert.equal(got, row.expected, JSON.stringify(row));
  }
  assert.equal(fixture.at(-2).expected, fixture.at(-1).expected);
});

test('readVacTelemetry keeps numeric zero map_index as map id (HP-1540-02)', () => {
  const t = readVacTelemetry({ vacuum_position: { x: 1, y: 2 }, map_index: 0 });
  assert.equal(t.mapId, '0');
});
