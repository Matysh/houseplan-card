import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVacPath, pushTrailPoint, thinPath } from '../test-build/vacuum.js';
import {
  VacuumPathGeometryCache, simplifyOrderedPath, VAC_RENDER_POINT_BUDGET,
  isVacuumPathMaterial, ownVacuumPathInput,
} from '../test-build/vacuum-path-geometry.js';
import { selectVacuumTrail, vacuumTrailMaterial } from '../test-build/vacuum-trail-material.js';
import { vacuumTrailSvg } from '../test-build/vacuum-trail-render.js';
import { recordLocalVacuumPosition } from '../test-build/vacuum-local-trail.js';

test('#872 local reserve splits unknown periods and physical teleports, keeps short-stop history', () => {
  const s = { trail: [], paths: [], material: [], version: -1, gap: false, lastPos: null };
  for (let i = 0; i < 4; i++) recordLocalVacuumPosition(s, [i, 0], i * 1000, [i, 0]);
  const before = s.material;
  s.gap = true;
  recordLocalVacuumPosition(s, [1000, 0], 5000, [1000, 0]);
  assert.deepEqual(s.paths, [[[0, 0], [1, 0], [2, 0], [3, 0]], []]);
  assert.deepEqual(before, [[[0, 0], [1, 0], [2, 0]]]);
  assert.equal(selectVacuumTrail(null, null, s.material, 1).allowTip, false);
  recordLocalVacuumPosition(s, [1001, 0], 6000, [1001, 0]);
  recordLocalVacuumPosition(s, [1002, 0], 7000, [1002, 0]);
  recordLocalVacuumPosition(s, null, 8000);
  assert.deepEqual(s.paths[1], [[1000, 0], [1001, 0], [1002, 0]]);
  s.gap = true;
  recordLocalVacuumPosition(s, [1003, 0], 9000, [1003, 0]);
  recordLocalVacuumPosition(s, [99999, 0], 10000, [99999, 0]);
  assert.equal(s.paths.length, 4);
  assert.deepEqual(s.paths[2], [[1003, 0]]);
});

test('#872 invalid affine never serializes NaN; missing physical scale keeps exact original samples', () => {
  const raw = [[[0, 0], [0.5, 0], [1, 0]]];
  const invalid = vacuumTrailSvg(new VacuumPathGeometryCache(), raw, [NaN, 0, 0, 0, 1, 0], 5, 20000);
  assert.equal(invalid.d, '');
  const noScale = vacuumTrailSvg(new VacuumPathGeometryCache(), raw, [1, 0, 0, 0, 1, 0], 0, 20000);
  assert.equal(noScale.count, 3);
  assert.equal(noScale.d, 'M 0 0 L 0.5 0 L 1 0');
});

test('#872 complete simplified+smoothed curve stays within 17.5 physical cm of original finite segments', () => {
  const original = [Array.from({length: 601}, (_, i) => [i, Math.sin(i) * 1.5]),
    [[0, 0], [0, 200], [10, 200], [10, 0]], [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]];
  for (const points of original) {
    const d = vacuumTrailSvg(new VacuumPathGeometryCache(), [points], [1, 0, 0, 0, 1, 0], 1, 20000).d;
    const tokens = d.split(/\s+/);
    let previous;
    for (let i = 0; i < tokens.length;) {
      const kind = tokens[i++];
      if (kind === 'M') { previous = [+tokens[i++], +tokens[i++]]; continue; }
      const first = [+tokens[i++], +tokens[i++]];
      const end = kind === 'Q' ? [+tokens[i++], +tokens[i++]] : first;
      for (let step = 0; step <= 100; step++) {
        const t = step / 100, u = 1 - t;
        const p = kind === 'Q' ? [u*u*previous[0]+2*u*t*first[0]+t*t*end[0],
          u*u*previous[1]+2*u*t*first[1]+t*t*end[1]] : [u*previous[0]+t*end[0], u*previous[1]+t*end[1]];
        const error = Math.min(...points.slice(1).map((b, n) => segmentDistance(p, points[n], b)));
        assert.ok(error <= 17.5 + 1e-9, `total error ${error}`);
      }
      previous = end;
    }
  }
});

test('#872 witnessed 601-point out-and-back and dense sampled-away corner survive', () => {
  let trail = [];
  for (let i = 0; i <= 300; i++) trail = pushTrailPoint(trail, [i, 0], 40);
  for (let i = 299; i >= 0; i--) trail = pushTrailPoint(trail, [i, 0], 40);
  assert.equal(trail.length, 601);
  assert.ok(thinPath(trail, 40).some(([x]) => x === 300));
  const dense = Array.from({ length: 5000 }, (_, i) => [i, 0]);
  dense[2402] = [2402, 1000];
  assert.deepEqual(normalizeVacPath(dense)[0], dense);
});

test('#872 boolean/string/nonfinite gaps are literal, repeated visits stay ordered', () => {
  for (const invalid of [[true, 1], ['1', 1], [NaN, 1], [Infinity, 1], null]) {
    assert.deepEqual(normalizeVacPath([[0, 0], [1, 1], invalid, [100, 100], [101, 101]]), [
      [[0, 0], [1, 1]], [[100, 100], [101, 101]],
    ]);
  }
  assert.deepEqual(normalizeVacPath([[0, 0], [1, 0], [0, 0]])[0], [[0, 0], [1, 0], [0, 0]]);
});

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

test('#872 finite-segment/temporal certificate and protected U-turns, not infinite RDP line', () => {
  const paths = [
    [[0, 0], [100, 0], [0, 0]], [[0, 0], [100, 0], [99, 1], [0, 1]],
    [[0, 0], [0, 100], [100, 100], [100, 0]],
    Array.from({ length: 3000 }, (_, i) => [i, Math.sin(i) * 0.5]),
  ];
  for (const original of paths) {
    const reduced = simplifyOrderedPath(original, 2);
    assert.deepEqual(reduced[0], original[0]);
    assert.deepEqual(reduced.at(-1), original.at(-1));
    let first = 0;
    for (let j = 1; j < reduced.length; j++) {
      const end = original.indexOf(reduced[j], first + 1);
      assert.ok(end > first);
      for (let i = first; i <= end; i++) assert.ok(segmentDistance(original[i], reduced[j - 1], reduced[j]) <= 2 + 1e-9);
      first = end;
    }
  }
  assert.deepEqual(simplifyOrderedPath(paths[0], 2), paths[0]);
  assert.ok(simplifyOrderedPath(paths[1], 2).includes(paths[1][1]));
});

test('#872 physical scale is after affine; mm/cm/m, mirror and shear do not change the result', () => {
  const cache = new VacuumPathGeometryCache();
  const physical = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]];
  let expected;
  for (const factor of [0.001, 0.1, 1, 10, 1000]) {
    const raw = normalizeVacPath(physical.map(([x, y]) => [x * factor, y * factor]));
    const matrix = [2 / factor, 0.5 / factor, 10, 0, -2 / factor, 20];
    const geometry = cache.resolve(raw, matrix, 0.5, 20000);
    assert.ok(geometry.physicalVerified);
    if (expected) assert.deepEqual(geometry.path, expected);
    else expected = geometry.path;
  }
});

test('#872 100k adversarial turns: bounded honest prefix, no index sampler or invented tail bridge', () => {
  const raw = normalizeVacPath(Array.from({ length: 100000 }, (_, i) => [i % 2, i]));
  const cache = new VacuumPathGeometryCache();
  const frame = cache.resolve(raw, [100, 0, 0, 0, 100, 0], 1, VAC_RENDER_POINT_BUDGET);
  assert.equal(frame.renderedPoints, 20000);
  assert.equal(frame.rawPoints, 100000);
  assert.equal(frame.limited, true);
  assert.deepEqual(frame.path[0].at(-1), [100, 1999900]);
  assert.equal(cache.resolve(raw, [100, 0, 0, 0, 100, 0], 1, 20000), frame);
  assert.equal(cache.computations, 1);
});

test('#872 source authority, native endpoints and untrusted singleton gap forbid puck connector', () => {
  const raw = { m: { current: { path_format: 2, paths: [[[0, 0], [10, 10]]],
    points: [[99, 99], [100, 100]], quality: { source: 'native', reason: 'stale' } } } };
  const book = vacuumTrailMaterial(raw);
  const result = selectVacuumTrail({ path: [[[999, 999], [1000, 1000]]] }, book.m.current, [[1, 1], [2, 2]], 2);
  assert.deepEqual(result.path, [[[0, 0], [10, 10]]]);
  assert.equal(result.native, true);
  assert.equal(result.reason, 'stale');
  const gap = selectVacuumTrail(null, { path_format: 2, paths: [[[0, 0], [1, 1]], [[100, 100]]],
    quality: { source: 'positions' } }, [], 2);
  assert.equal(gap.allowTip, false);
  assert.deepEqual(selectVacuumTrail(null, null, [[0, 0], [1, 1]], 2).path, []);
  assert.equal(selectVacuumTrail(null, null, [[0, 0], [1, 1]], 1).source, 'local');
});

test('#872 ownership cache does not trust a shallow freeze and keeps raw attribute shape', () => {
  const raw = Object.freeze({ path: [[0, 0], [1, 1]], source: { note: 'public-shape' } });
  assert.equal(isVacuumPathMaterial(raw), false);
  const owned = ownVacuumPathInput(raw);
  assert.deepEqual(owned, raw);
  assert.notEqual(owned.path, raw.path);
  raw.path[0][0] = 99;
  assert.equal(owned.path[0][0], 0);
  assert.equal(ownVacuumPathInput(raw), owned);
  assert.ok(Object.isFrozen(owned.path[0]));
  assert.deepEqual(ownVacuumPathInput(new Array(10000000)), []);
});

test('#872 four 100k robots and five clients share material and warm geometry without repeated raw work', () => {
  const raw = Object.fromEntries(Array.from({length: 4}, (_, i) => [String(i), {current: {
    path_format: 2, paths: [Array.from({length: 100000}, (_, n) => [n % 2, n])],
    quality: {source: 'native', reason: 'ok'},
  }}]));
  const cache = new VacuumPathGeometryCache(), clients = Array.from({length: 5}, () => vacuumTrailMaterial(raw));
  const started = performance.now();
  const warm = [];
  for (let client = 0; client < 5; client++) {
    let budget = 20000;
    const frames = Object.keys(raw).map(id => {
      assert.equal(clients[client][id].current.paths, clients[0][id].current.paths);
      const path = selectVacuumTrail(null, clients[client][id].current, [], 2).path;
      const frame = vacuumTrailSvg(cache, path, [100,0,0,0,100,0], 1, budget);
      budget -= frame.count;
      assert.ok(frame.limited);
      return frame;
    });
    if (client === 0) warm.push(...frames);
    else frames.forEach((frame, i) => assert.equal(frame, warm[i]));
    assert.equal(budget, 0);
  }
  assert.equal(cache.computations, 4);
  for (let idle = 0; idle < 100; idle++) {
    const path = selectVacuumTrail(null, clients[0]['0'].current, [], 2).path;
    assert.equal(vacuumTrailSvg(cache, path, [100,0,0,0,100,0], 1, 20000), warm[0]);
  }
  assert.equal(cache.computations, 4);
  console.log(JSON.stringify({workload: '4x100k, 5 clients, 100 idle frames',
    computations: cache.computations, elapsedMs: +(performance.now()-started).toFixed(2)}));
});

test('#872 SVG uses exact endpoint text and cached commands, not unconditional one decimal', () => {
  const cache = new VacuumPathGeometryCache();
  const raw = normalizeVacPath([[0.000123456789, 0], [1.23456789, 2.1234567]]);
  const frame = vacuumTrailSvg(cache, raw, [1, 0, 0, 0, 1, 0], 1000, 20);
  assert.equal(frame.d, 'M 0.000123456789 0 L 1.23456789 2.1234567');
  assert.equal(vacuumTrailSvg(cache, raw, [1, 0, 0, 0, 1, 0], 1000, 20), frame);
});
