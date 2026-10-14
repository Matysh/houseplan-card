// #873: equal-spacing magnet of the device editor — the pure resolver.
//
// The card rounds a dragged marker with `_devicePlacementForCanvas`;
// `place` below repeats that formula verbatim and
// converts the stored point back to render units the way `_livePos` does, so
// the numbers here are the numbers the card stores. Coordinates are plan units
// (1000 per original square); every AC point is a grid node (ТЗ, «Критерии»).
// Screen scales are the measured grid cell sizes of the spec: 0.81 / 2.44 /
// 19.5 CSS px at zoom 1/3, 1 and 8.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPACING_R_IN, SPACING_R_OUT, SpacingMagnet, spacingMarkers, spacingRows, spacingTargets,
} from '../test-build/device-spacing.js';
import { GRID_PITCH, NORM_W, clampCanvasN } from '../test-build/space-geometry.js';

const place = (x, y) => {
  const g = GRID_PITCH;
  const gx = Math.round(x / g) * g;
  const gy = Math.round(y / g) * g;
  const p = { s: 'f', x: clampCanvasN(gx / NORM_W), y: clampCanvasN(gy / NORM_W) };
  return { p, x: p.x * NORM_W, y: p.y * NORM_W };
};
/** A marker exactly where the card would draw a stored node. */
const at = (x, y) => { const q = place(x, y); return { x: q.x, y: q.y }; };
const ZOOM = { third: 0.81 / GRID_PITCH, one: 2.44 / GRID_PITCH, eight: 19.5 / GRID_PITCH };
const drawn = (p) => ({ x: p.x * NORM_W, y: p.y * NORM_W });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const magnet = (markers) => new SpacingMagnet(markers, place, 10);
/** Drop a marker with the raw point `dx`,`dy` CSS px from `target`. */
const drop = (m, target, dxPx, dyPx = 0, px = ZOOM.one) => drawn(m.resolve(
  target.x + dxPx / px, target.y + dyPx / px, px, px,
));
const gaps = (m) => m.hint.map((t) => ({ axis: t.axis, gaps: t.gaps.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].map(Math.round)) }));

test('#873 AC1 a row continues by its own step — right, then the fourth, then the other end', () => {
  const A = at(100, 200), B = at(150, 200);
  let m = magnet([A, B]);
  const C = drop(m, { x: 200, y: 200 }, 4);
  assert.ok(near(C.x, 200) && near(C.y, 200), `C stored at ${JSON.stringify(C)}`);
  assert.ok(near(C.x - B.x, B.x - A.x, 1e-6), 'B–C equals A–B');
  m = magnet([A, B, C]);
  const D = drop(m, { x: 250, y: 200 }, 4);
  assert.ok(near(D.x, 250) && near(D.y, 200), `D stored at ${JSON.stringify(D)}`);
  assert.ok(near(D.x - C.x, B.x - A.x, 1e-6), 'C–D repeats the reference A–B');
  const left = drop(magnet([A, B]), { x: 50, y: 200 }, -4);
  assert.ok(near(left.x, 50) && near(left.y, 200), `left end at ${JSON.stringify(left)}`);
});

test('#873 AC1 vertical rows follow the same rule along y', () => {
  const A = at(200, 100), B = at(200, 150);
  const m = magnet([A, B]);
  const C = drop(m, { x: 200, y: 200 }, 0, 4);
  assert.ok(near(C.x, 200) && near(C.y, 200), `C stored at ${JSON.stringify(C)}`);
  const top = drop(magnet([A, B]), { x: 200, y: 50 }, 0, -4);
  assert.ok(near(top.x, 200) && near(top.y, 50));
});

test('#873 AC1 without the magnet the same pointer lands on a neighbouring node (dev behaviour)', () => {
  // 4 px at zoom 1 is 1.6 grid cells: plain rounding is two nodes off.
  const raw = place(200 + 4 / ZOOM.one, 200);
  assert.ok(Math.abs(raw.x - 200) > GRID_PITCH, `plain rounding gives ${raw.x}`);
});

test('#873 AC2 what is not a row gives no target', () => {
  const none = (name, markers) => assert.deepEqual(spacingTargets(markers, place), [], name);
  none('diagonal', [at(100, 200), at(150, 250)]);
  none('one node apart is another line', [at(100, 200), at(150, 200 + GRID_PITCH)]);
  none('uneven chain 50/75', [at(100, 200), at(150, 200), at(225, 200)]);
  none('coincident centres', [at(100, 200), at(100, 200), at(150, 200)]);
  none('outsider closer than 2d past the end', [at(100, 200), at(150, 200), at(237.5, 200)]);
  none('outsider exactly 2d past the end', [at(100, 200), at(150, 200), at(250, 200)]);
  none('a row off the grid', [{ x: 100.5, y: 200 }, { x: 150.5, y: 200 }]);
});

test('#873 AC2 targets exist at both ends, past a far outsider, and only on the canvas', () => {
  const pts = (markers) => spacingTargets(markers, place).map((t) => [Math.round(t.x), Math.round(t.y)]);
  assert.deepEqual(pts([at(100, 200), at(150, 200)]), [[50, 200], [200, 200]]);
  assert.deepEqual(pts([at(100, 200), at(150, 200), at(800, 200)]), [[50, 200], [200, 200]]);
  // the canvas ends at ±5 000 000 units: the right target of this row is past it
  assert.deepEqual(pts([at(4_999_925, 200), at(4_999_975, 200)]), [[4_999_875, 200]]);
});

test('#873 AC2 participants: drawn markers of the space, minus the moving one', () => {
  const devices = [
    { id: 'moving', space: 'f' },
    { id: 'plain', space: 'f' },
    { id: 'virtual', space: 'f', virtual: true },
    { id: 'unavailable', space: 'f', bindingStatus: { kind: 'unavailable' } },
    { id: 'hidden', space: 'f', hidden: true },
    { id: 'disabled', space: 'f', bindingStatus: { kind: 'ha_disabled' } },
    { id: 'led', space: 'f' },
    { id: 'upstairs', space: 'u' },
  ];
  const ids = [];
  spacingMarkers(devices, devices[0], new Set(['led']), (d) => { ids.push(d.id); return { x: 0, y: 0 }; });
  assert.deepEqual(ids, ['plain', 'virtual', 'unavailable']);
});

test('#873 AC2 a hidden marker cannot make a row', () => {
  const devices = [
    { id: 'C', space: 'f' }, { id: 'A', space: 'f', hidden: true }, { id: 'B', space: 'f' },
  ];
  const pos = { A: at(100, 200), B: at(150, 200), C: at(300, 400) };
  const markers = spacingMarkers(devices, devices[0], new Set(), (d) => pos[d.id]);
  const C = drop(magnet(markers), { x: 200, y: 200 }, 4);
  assert.ok(!near(C.x, 200), 'no row, no pull');
});

test('#873 AC3 the nearest target in CSS px wins; equal distances go to the stable key', () => {
  // one line: targets 50, 200 (row 100–150) and 350, 500 (row 400–450)
  const line = [at(100, 200), at(150, 200), at(400, 200), at(450, 200)];
  const px = 5 / 75; // 75 units = 5 px
  const nearer = drawn(magnet(line).resolve(265, 200, px, px));
  assert.ok(near(nearer.x, 200), `the nearer target wins, got ${nearer.x}`);
  const tie = drawn(magnet(line).resolve(275, 200, px, px));
  assert.ok(near(tie.x, 200), `a tie on one line goes to the lower position, got ${tie.x}`);
  // h target (200,200) and v target (250,200) of the row x=250, 25 units = 5 px each
  const axes = [at(250, 300), at(250, 250), at(100, 200), at(150, 200)];
  const both = drawn(magnet(axes).resolve(225, 200, 0.2, 0.2));
  assert.ok(near(both.x, 200), `a tie between axes goes to the h row, got ${both.x}`);
});

test('#873 AC3 the order of the markers does not change the result', () => {
  const markers = [at(100, 200), at(150, 200), at(200, 100), at(200, 150), at(600, 600), at(650, 600)];
  const reference = (() => {
    const m = magnet(markers);
    return JSON.stringify([drop(m, { x: 200, y: 200 }, 3, 2), gaps(m)]);
  })();
  let seed = 873;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 25; i++) {
    const shuffled = [...markers].sort(() => rnd() - 0.5);
    const m = magnet(shuffled);
    assert.equal(JSON.stringify([drop(m, { x: 200, y: 200 }, 3, 2), gaps(m)]), reference);
  }
});

test('#873 AC3 a held target stays until the release radius: no flicker between two', () => {
  // h target T1 (200,200); v row x = 200 + 10 nodes → target T2 10 nodes right of T1.
  const x2 = 200 + 10 * GRID_PITCH;
  const markers = [at(100, 200), at(150, 200), at(x2, 300), at(x2, 250)];
  const px = ZOOM.third; // 10 nodes ≈ 8.1 px: inside the hold radius
  const T2 = place(x2, 200).x;
  const span = (T2 - 200) * px;
  assert.ok(span < SPACING_R_OUT && span > SPACING_R_IN / 2, `targets ${span.toFixed(2)} px apart`);
  const m = magnet(markers);
  const series = [];
  for (let step = 0; step <= 16; step++) {
    const offPx = (span * step) / 16; // from T1 over to T2, every point within r_out of T1
    series.push(Math.round(drawn(m.resolve(200 + offPx / px, 200, px, px)).x));
  }
  assert.deepEqual([...new Set(series)], [200], `held T1 all the way, got ${series.join(',')}`);
  // past the release radius the other target takes over, and holds on the way back
  const away = Math.round(drawn(m.resolve(200 + (SPACING_R_OUT + 1) / px, 200, px, px)).x);
  assert.equal(away, Math.round(T2));
  const back = Math.round(drawn(m.resolve(200 + 1 / px, 200, px, px)).x);
  assert.equal(back, Math.round(T2), 'T2 is held while within its release radius');
});

test('#873 AC4 the hint names the reference and the new gap; the reference stays A–B', () => {
  const A = at(100, 200), B = at(150, 200), C = at(200, 200);
  const mC = magnet([A, B]);
  drop(mC, { x: 200, y: 200 }, 4);
  assert.deepEqual(gaps(mC), [{ axis: 'h', gaps: [[100, 150], [150, 200]] }]);
  const mLeft = magnet([A, B]);
  drop(mLeft, { x: 50, y: 200 }, -4);
  assert.deepEqual(gaps(mLeft), [{ axis: 'h', gaps: [[100, 150], [50, 100]] }]);
  const mD = magnet([A, B, C]);
  drop(mD, { x: 250, y: 200 }, 4);
  assert.deepEqual(gaps(mD), [{ axis: 'h', gaps: [[100, 150], [200, 250]] }], 'for D: A–B and C–D, not B–C');
  drop(mD, { x: 250, y: 200 }, 40);
  assert.deepEqual(mD.hint, [], 'away from the target there is no hint');
});

test('#873 AC4 the hint follows the final point: no capture, but the grid lands on the target', () => {
  const m = magnet([at(100, 200), at(150, 200)]);
  // zoom 8: 8 px is outside r_in, inside half a 19.5-px cell — the grid itself brings it there
  const p = drop(m, { x: 200, y: 200 }, 8, 0, ZOOM.eight);
  assert.ok(near(p.x, 200), `grid point ${p.x}`);
  assert.equal(m.hint.length, 1, 'shown because the final point is the target');
  drop(m, { x: 200, y: 200 }, 12, 0, ZOOM.eight);
  assert.equal(m.hint.length, 0, '12 px: the next node, no hint');
});

test('#873 AC4 a point that continues an h and a v row shows both', () => {
  const m = magnet([at(100, 200), at(150, 200), at(200, 100), at(200, 150)]);
  drop(m, { x: 200, y: 200 }, 2, 2);
  assert.deepEqual(m.hint.map((t) => t.axis), ['h', 'v']);
});

test('#873 AC4 drawing: both gaps one length, lines from centre to centre past the shells', () => {
  const m = new SpacingMagnet([at(100, 200), at(150, 200), at(200, 100), at(200, 150)], place, 20);
  drop(m, { x: 200, y: 200 }, 0, 0, ZOOM.eight);
  const fmt = (d) => `${(d / 100).toFixed(2)} m`;
  const rows = spacingRows(m, fmt);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.text, fmt(50));
    assert.equal(row.gaps.length, 2);
    const off = 20 + 12 / ZOOM.eight;
    for (const gap of row.gaps) {
      // row frame: x along, y across — `M a y0-k V y0+k M a y0 H b M b y0-k V y0+k`
      const n = gap.d.match(/-?[\d.e+-]+/g).map(Number);
      assert.ok(near(n[4], 200 - off, 1e-6), `dimension line ${off.toFixed(2)} off the axis`);
      assert.ok(n[0] === n[3] && n[6] === n[5], 'ticks at both centres');
    }
    const ends = row.gaps.map((gap) => { const n = gap.d.match(/-?[\d.e+-]+/g).map(Number); return [n[3], n[5]]; });
    assert.deepEqual(ends.map((e) => e.map(Math.round)), [[100, 150], [150, 200]]);
    assert.equal(row.fits, true, '50 units at zoom 8 is 234 px');
  }
  // 50 units at zoom 1 is 29 px: the label does not fit — hidden on both gaps of the row
  drop(m, { x: 200, y: 200 }, 0, 0, ZOOM.one);
  assert.deepEqual(spacingRows(m, fmt).map((row) => row.fits), [false, false]);
  assert.deepEqual(spacingRows(null, fmt), []);
});

test('#873 AC5 the pull is the same in CSS px at every zoom', () => {
  for (const [name, px] of Object.entries(ZOOM)) {
    const m = magnet([at(100, 200), at(150, 200)]);
    const hit = drop(m, { x: 200, y: 200 }, 4, 0, px);
    assert.ok(near(hit.x, 200), `${name}: 4 px is captured, got ${hit.x}`);
    assert.ok(near(hit.x - 150, 50, 1e-6), `${name}: the stored step is d`);
    const miss = drop(magnet([at(100, 200), at(150, 200)]), { x: 200, y: 200 }, 12, 0, px);
    assert.ok(!near(miss.x, 200), `${name}: 12 px is not captured, got ${miss.x}`);
  }
});

test('#873 AC7 one index per gesture; a move visits at most 2N targets, never pairs', () => {
  const N = 2000;
  const markers = [];
  // 40 × 50 lattice of nodes, 12 nodes apart: every line is one long row
  for (let i = 0; i < N; i++) markers.push(at((i % 40) * 50, Math.floor(i / 40) * 50));
  const m = magnet(markers);
  const targets = spacingTargets(markers, place).length;
  assert.ok(targets > 0 && targets <= 2 * N, `${targets} targets`);
  for (let i = 0; i < 100; i++) m.resolve(17 + i * 3.1, 23 + i * 1.7, ZOOM.one, ZOOM.one);
  assert.equal(m.builds, 1, 'the index is built once for 100 moves');
  assert.equal(m.queries, 100);
  assert.ok(m.visited / m.queries <= 2 * N, `${m.visited / m.queries} visited per move`);
  assert.equal(m.visited, 100 * targets, 'one pass over the ready targets per move');
});
