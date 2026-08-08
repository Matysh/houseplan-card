import test from 'node:test';
import assert from 'node:assert/strict';
import {
  norm360, planSunAngle, sunDirOnPlan, dayPhase,
  isExteriorWall, windowWallInfo, windowLit,
  rayLength, rayQuad, clipToRoom, computeSunRays,
  rayAlpha, rayColor, RAY_MAX_ALPHA,
  raysVisible, rayPeakAlpha, RAY_ELEVATION_MIN, RAY_FADE_MS,
  RAY_LENGTH_K, RAY_FADE_END, rayStops, RAY_MIN_COS,
  rimStops, rimPeakAlpha, rayRimEdges, RIM_MAX_ALPHA, RIM_COLOR,
  SKY_SNAP_DEG, skyNeedsSnap, skyElevation,
  northDegOf, bgModeOf, sunRaysOn, sunStateOf,
} from '../test-build/sun.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---- the test house: two rooms sharing the x=500 wall, windows on all four
// outer walls plus one on the shared (interior) wall --------------------
const ROOMS = [
  { id: 'r1', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
  { id: 'r2', poly: [[500, 100], [800, 100], [800, 500], [500, 500]] },
];
const WIN = {
  north: { id: 'wN', x: 300, y: 100, angle: 0, length: 60 },
  south: { id: 'wS', x: 300, y: 500, angle: 0, length: 60 },
  west: { id: 'wW', x: 100, y: 300, angle: 90, length: 60 },
  east: { id: 'wE', x: 800, y: 300, angle: 90, length: 60 },
  inner: { id: 'wI', x: 500, y: 300, angle: 90, length: 60 },
};
const ALL = Object.values(WIN);

test('planSunAngle: plain subtraction, wraps around the circle (359→0)', () => {
  assert.equal(planSunAngle(180, 0), 180);
  assert.equal(planSunAngle(0, 1), 359);
  assert.equal(planSunAngle(359, 359), 0);
  assert.equal(planSunAngle(10, 350), 20);
  assert.equal(norm360(-90), 270);
  assert.equal(norm360(720), 0);
});

test('sunDirOnPlan: compass points map to canvas vectors (y grows down)', () => {
  const cases = [
    [0, [0, -1]],   // north = canvas up
    [90, [1, 0]],   // east = right
    [180, [0, 1]],  // south = down
    [270, [-1, 0]], // west = left
  ];
  for (const [az, [x, y]] of cases) {
    const d = sunDirOnPlan(az, 0);
    assert.ok(near(d[0], x, 1e-12) && near(d[1], y, 1e-12), `az ${az}`);
  }
  // rotating the compass rotates the whole sky: east sun, north_deg=90 → up
  const d = sunDirOnPlan(90, 90);
  assert.ok(near(d[0], 0, 1e-12) && near(d[1], -1, 1e-12));
});

test('dayPhase: night is dark and dim, noon is white, sunrise is warm', () => {
  const night = dayPhase(-20);
  const dawn = dayPhase(2);
  const noon = dayPhase(60);
  assert.equal(night.bg, '#070c14');
  assert.equal(noon.bg, '#ffffff');
  assert.notEqual(dawn.bg, night.bg);
  assert.notEqual(dawn.bg, noon.bg);
  assert.ok(near(night.planDim, 0.1));
  assert.equal(noon.planDim, 0);
  assert.ok(dawn.planDim > 0 && dawn.planDim < 0.1);
  assert.equal(night.warmth, 1);
  assert.equal(noon.warmth, 0);
  assert.ok(near(dawn.warmth, 0.8));
  // garbage elevation never throws and stays inside the palette
  assert.ok(dayPhase(NaN).bg.startsWith('#'));
});

test('windowWallInfo: exterior windows on all four sides get outward normals', () => {
  const n = windowWallInfo(WIN.north, ROOMS);
  const s = windowWallInfo(WIN.south, ROOMS);
  const w = windowWallInfo(WIN.west, ROOMS);
  const e = windowWallInfo(WIN.east, ROOMS);
  assert.deepEqual(n.roomId, 'r1');
  assert.ok(near(n.normal[0], 0, 1e-12) && near(n.normal[1], -1, 1e-12));
  assert.ok(near(s.normal[0], 0, 1e-12) && near(s.normal[1], 1, 1e-12));
  assert.ok(near(w.normal[0], -1, 1e-12) && near(w.normal[1], 0, 1e-12));
  assert.equal(w.roomId, 'r1');
  assert.ok(near(e.normal[0], 1, 1e-12) && near(e.normal[1], 0, 1e-12));
  assert.equal(e.roomId, 'r2');
});

test('windowWallInfo: interior and orphan windows never participate', () => {
  assert.equal(windowWallInfo(WIN.inner, ROOMS), null); // shared wall
  assert.equal(windowWallInfo({ x: 300, y: 300, angle: 0 }, ROOMS), null); // mid-room
  assert.equal(windowWallInfo({ x: 950, y: 950, angle: 0 }, ROOMS), null); // nowhere
});

test('isExteriorWall probes the outer side', () => {
  assert.ok(isExteriorWall([300, 100], [0, -1], ROOMS));
  assert.ok(!isExteriorWall([500, 300], [1, 0], ROOMS)); // r2 is outside r1 here
});

test('windowLit: above the horizon, facing the sun, and NOT along the wall', () => {
  const east = [1, 0];
  assert.ok(windowLit(east, sunDirOnPlan(90, 0), 10));
  assert.ok(!windowLit(east, sunDirOnPlan(270, 0), 10)); // sun behind the house
  assert.ok(!windowLit(east, sunDirOnPlan(90, 0), 0));   // sunset moment
  assert.ok(!windowLit(east, sunDirOnPlan(90, 0), -5));  // night
  // DEV-EB173-01: a sun sliding ALONG the wall lights nothing. The dot product
  // is the cosine of the incidence angle: for this wall it is exactly sin(az).
  assert.equal(RAY_MIN_COS, 0.05);
  const cos = (az) => Math.sin((az * Math.PI) / 180);
  assert.ok(cos(2) < RAY_MIN_COS && !windowLit(east, sunDirOnPlan(2, 0), 40));
  assert.ok(cos(4) > RAY_MIN_COS && windowLit(east, sunDirOnPlan(4, 0), 40));
  // ~87.1° of incidence, i.e. the sun ~2.9° clear of the wall's own plane
  assert.ok(near((Math.acos(RAY_MIN_COS) * 180) / Math.PI, 87.13, 0.01));
});

test('rayLength: 30% shorter than v1.56 (owner 2026-08-04), same shape', () => {
  // the old curve, kept here so the -30% stays a fact and not a memory
  const before = (e) => 0.8 + 1.7 * Math.pow(1 - Math.min(90, Math.max(0, e)) / 90, 1.6);
  assert.equal(RAY_LENGTH_K, 0.7);
  assert.ok(near(rayLength(0), 1.75, 1e-9));   // was 2.5
  assert.ok(near(rayLength(90), 0.56, 1e-9));  // was 0.8
  for (const e of [-5, 0, 3, 10, 30, 45, 60, 89, 90, 120]) {
    assert.ok(near(rayLength(e), before(e) * 0.7, 1e-12), 'exactly 70% at ' + e);
  }
  // the shape survives: a low sun still reaches much further than a high one
  assert.ok(rayLength(10) > rayLength(30));
  assert.ok(rayLength(30) > rayLength(60));
  assert.ok(near(rayLength(-5), 1.75, 1e-9)); // clamped
});

test('rayStops: the shaft is fully dissolved BEFORE its own far edge', () => {
  const stops = rayStops();
  assert.ok(near(stops[0][0], 0) && near(stops[0][1], 1), 'brightest at the glass');
  assert.equal(RAY_FADE_END, 0.85);
  // offsets are sorted, alphas never rise, and the tail is a hard zero
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i][0] > stops[i - 1][0] || stops[i][0] === 1, 'offsets ascend');
    assert.ok(stops[i][1] <= stops[i - 1][1], 'alpha never brightens inward');
  }
  assert.ok(near(stops[stops.length - 1][0], 1), 'the gradient spans the FULL wedge');
  for (const [off, k] of stops) {
    if (off >= RAY_FADE_END) assert.equal(k, 0, 'nothing left at/after ' + RAY_FADE_END);
    else assert.ok(k > 0, 'still lit at ' + off);
  }
  // half gone well before the middle — the eye must not find a straight edge
  const half = stops.find(([, k]) => k <= 0.5);
  assert.ok(half[0] <= 0.65, 'past half-dark by two thirds of the way');
});

// ---- the rim (owner 2026-08-04, docs/SUN.md «The rim») -----------------

test('rimStops: the rim dies on exactly the same curve as the fill', () => {
  const rim = rimStops();
  // «ровно по той же кривой и тому же порогу» — identity, not a copy that can
  // drift: if the fill's easing is ever retuned the outline follows it.
  assert.deepEqual(rim, rayStops());
  assert.ok(near(rim[0][0], 0) && near(rim[0][1], 1), 'brightest at the glass');
  assert.ok(near(rim[rim.length - 1][0], 1), 'spans the FULL wedge, like the fill');
  for (let i = 1; i < rim.length; i++) {
    assert.ok(rim[i][0] > rim[i - 1][0] || rim[i][0] === 1, 'offsets ascend');
    assert.ok(rim[i][1] <= rim[i - 1][1], 'the rim never brightens inward');
  }
  for (const [off, k] of rim) {
    if (off >= RAY_FADE_END) assert.equal(k, 0, 'no rim at/after ' + RAY_FADE_END);
    else assert.ok(k > 0, 'still drawn at ' + off);
  }
  // black, and visible on paper without becoming an ink contour on a dark scene
  assert.equal(RIM_COLOR, '#000000');
  assert.ok(RIM_MAX_ALPHA >= 0.35 && RIM_MAX_ALPHA <= 0.5, 'the owner\'s 0.35..0.5 window');
  assert.ok(near(rimPeakAlpha(), RIM_MAX_ALPHA));
});

test('rayRimEdges: the two SIDE edges only, cut exactly like the wedge', () => {
  // a west window in r1, a western sun square into it — the wedge stays well
  // inside the room, so both sides are whole
  const [ray] = computeSunRays(ROOMS, [WIN.west], 270, 60, 0);
  assert.ok(ray, 'the west window is lit');
  const edges = rayRimEdges(ray);
  assert.equal(edges.length, 2, 'one line per side, no more');
  const far = (s) => [s[0] + ray.dir[0] * ray.len, s[1] + ray.dir[1] * ray.len];
  const same = (p, q) => near(p[0], q[0], 1e-6) && near(p[1], q[1], 1e-6);
  const has = (s, t) => edges.some(([p, q]) => (same(p, s) && same(q, t)) || (same(p, t) && same(q, s)));
  assert.ok(has(ray.a, far(ray.a)), 'the side from a runs the full reach');
  assert.ok(has(ray.b, far(ray.b)), 'the side from b runs the full reach');
  // never the glass (a-b) and never the far edge: every rim segment is
  // parallel to the ray, and both of them are the full length
  for (const [p, q] of edges) {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const L = Math.hypot(dx, dy);
    assert.ok(near(L, ray.len, 1e-6), 'a whole side, not a wall of the room');
    assert.ok(near((dx / L) * ray.dir[1] - (dy / L) * ray.dir[0], 0, 1e-9), 'parallel to the ray');
  }
  // ...and the glass edge is NOT among them, however you orient it
  assert.ok(!has(ray.a, ray.b), 'the pane of glass is not a rim');
  assert.ok(!has(far(ray.a), far(ray.b)), 'the far edge is not a rim either');
});

test('rayRimEdges: a room that cuts the shaft cuts the rim with it', () => {
  // the same window in a room only 30 units deep — the wedge (~46 long at 60°)
  // hits the far wall, and both rims must stop on it, not carry on in mid-air
  const narrow = [{ id: 'n1', poly: [[100, 100], [130, 100], [130, 500], [100, 500]] }];
  const [ray] = computeSunRays(narrow, [WIN.west], 270, 60, 0);
  assert.ok(ray && ray.len > 30, 'the wedge really is longer than the room');
  const edges = rayRimEdges(ray);
  assert.equal(edges.length, 2);
  for (const [p, q] of edges) {
    assert.ok(near(Math.hypot(q[0] - p[0], q[1] - p[1]), 30, 1e-6), 'clipped to the room');
    assert.ok(Math.max(p[0], q[0]) <= 130 + 1e-6, 'nothing past the far wall');
  }
  // and the shortened rim still starts at the glass
  assert.ok(edges.some(([p]) => near(p[0], 100, 1e-6) && near(p[1], 270, 1e-6)));
  assert.ok(edges.some(([p]) => near(p[0], 100, 1e-6) && near(p[1], 330, 1e-6)));
});

test('rayRimEdges: collinear splinters merge, an empty wedge draws nothing', () => {
  const [ray] = computeSunRays(ROOMS, [WIN.west], 270, 60, 0);
  // polyclip readily splits a side at a touching vertex; the rim must still be
  // ONE line per side, not a string of them
  const poly = ray.polys[0];
  const split = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    split.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
  }
  assert.equal(split.length, 8, 'every edge of the wedge is now two');
  const cut = { ...ray, polys: [split] };
  const merged = rayRimEdges(cut);
  assert.equal(merged.length, 2, 'still one line per side, not four');
  for (const [p, q] of merged) {
    assert.ok(near(Math.hypot(q[0] - p[0], q[1] - p[1]), ray.len, 1e-6), 'the whole side');
  }
  // a wedge clipped away to nothing has no rim at all
  assert.deepEqual(rayRimEdges({ ...ray, polys: [] }), []);
});

test('skyNeedsSnap / skyElevation: glide with the sun, jump when we were away', () => {
  assert.equal(SKY_SNAP_DEG, 3);
  assert.equal(skyNeedsSnap(null, 12), true);        // nothing painted yet
  assert.equal(skyNeedsSnap(NaN, 12), true);
  assert.equal(skyNeedsSnap(12, 12), false);
  assert.equal(skyNeedsSnap(12, 13), false);         // a real 4-minute sun step
  assert.equal(skyNeedsSnap(12, 14.9), false);
  assert.equal(skyNeedsSnap(12, 15), true);          // ~12 minutes unwatched
  assert.equal(skyNeedsSnap(12, 9), true);           // and in both directions
  assert.equal(skyElevation(12.3456), 12.3);
  assert.equal(skyElevation(-0.04), -0);
  assert.equal(skyElevation('nonsense'), 0);
});

test('rayQuad: an honest parallelogram, both sides exactly `len` (DEV-EB173-01)', () => {
  // «Не надо размывать их боковые грани» — the sides are hard lines, so the
  // only thing that may dissolve a shaft is the gradient. That gradient runs
  // along the wall's NORMAL (see SunRay.normal/depth), and ITS iso-alpha lines
  // are parallel to the wall — which is exactly where an equal extrusion of
  // both ends puts the far edge. So the wedge is a plain parallelogram again
  // and every side is the full, promised reach.
  const a = [100, 100];
  const b = [100, 200];            // a window along +y
  const len = 300;
  for (const deg of [0, 20, 45, 70, -35, -60]) {
    const rad = (deg * Math.PI) / 180;
    const dir = [Math.cos(rad), Math.sin(rad)];   // oblique sun in most cases
    const q = rayQuad(a, b, dir, len);
    assert.equal(q.length, 4);
    // the near edge is still the window itself
    assert.deepEqual(q[0], [100, 100]);
    assert.deepEqual(q[1], [100, 200]);
    for (const [near0, far] of [[q[0], q[3]], [q[1], q[2]]]) {
      const ex = far[0] - near0[0];
      const ey = far[1] - near0[1];
      // both sides run exactly along the ray — razor-sharp, never splayed
      assert.ok(Math.abs(ex * dir[1] - ey * dir[0]) < 1e-9, 'side parallel to the ray at ' + deg);
      assert.ok(ex * dir[0] + ey * dir[1] > 0, 'side runs away from the glass');
      // ...and each is the FULL reach: the 30 % cut is a fact on every side,
      // at every sun angle (the old skewed quad made one side 88 % longer)
      assert.ok(near(Math.hypot(ex, ey), len, 1e-9), 'side is exactly len at ' + deg);
    }
    // the far edge is parallel to the wall — the gradient's last iso-alpha line
    const fx = q[2][0] - q[3][0];
    const fy = q[2][1] - q[3][1];
    const sx = b[0] - a[0];
    const sy = b[1] - a[1];
    assert.ok(Math.abs(fx * sy - fy * sx) < 1e-6, 'far edge parallel to the wall at ' + deg);
  }
  // head-on sun: the classic parallelogram, unchanged
  const straight = rayQuad(a, b, [1, 0], len);
  assert.deepEqual(straight, [[100, 100], [100, 200], [400, 200], [400, 100]]);
});

test('rayQuad + clipToRoom: the wedge is cut by the room outline', () => {
  const quad = rayQuad([100, 270], [100, 330], [1, 0], 1000); // way past the wall
  const clipped = clipToRoom(quad, ROOMS[0].poly);
  assert.equal(clipped.length, 1);
  for (const [x, y] of clipped[0]) {
    assert.ok(x >= 100 - 1e-6 && x <= 500 + 1e-6, 'x inside the room');
    assert.ok(y >= 100 - 1e-6 && y <= 500 + 1e-6, 'y inside the room');
  }
  assert.ok(clipped[0].some(([x]) => near(x, 500, 1e-6)), 'reaches the far wall, not past it');
  // a wedge fully outside the room clips to nothing
  assert.equal(clipToRoom(rayQuad([900, 900], [960, 900], [0, 1], 50), ROOMS[0].poly).length, 0);
});

test('computeSunRays: morning east sun lights ONLY the east window', () => {
  const rays = computeSunRays(ROOMS, ALL, 90, 5, 0);
  assert.deepEqual(rays.map((r) => r.openingId), ['wE']);
  assert.equal(rays[0].roomId, 'r2');
  // light travels AWAY from the sun: westward into the room
  assert.ok(near(rays[0].dir[0], -1, 1e-12) && near(rays[0].dir[1], 0, 1e-12));
  for (const [x, y] of rays[0].polys[0]) {
    assert.ok(x >= 500 - 1e-6 && x <= 800 + 1e-6 && y >= 100 - 1e-6 && y <= 500 + 1e-6);
  }
});

test('computeSunRays: noon south sun → south window, short wedge', () => {
  const rays = computeSunRays(ROOMS, ALL, 180, 60, 0);
  assert.deepEqual(rays.map((r) => r.openingId), ['wS']);
  assert.ok(near(rays[0].len, rayLength(60) * 60, 1e-9));
  assert.ok(rays[0].len < computeSunRays(ROOMS, ALL, 90, 5, 0)[0].len);
});

test('computeSunRays: evening west sun → west window', () => {
  const rays = computeSunRays(ROOMS, ALL, 270, 4, 0);
  assert.deepEqual(rays.map((r) => r.openingId), ['wW']);
});

test('computeSunRays: a thick-wall ray starts at both room-side opening corners', () => {
  const win = { id: 'wW', x: 100, y: 300, angle: 90, length: 80 };
  const inner = {
    r1: [[110, 110], [490, 110], [490, 490], [110, 490]],
  };
  // Oblique sunlight is intentional: the source must remain the full inner
  // aperture instead of shrinking or sliding away from either jamb corner.
  const [ray] = computeSunRays(ROOMS, [win], 240, 60, 0, inner, { wW: 20 });
  assert.ok(ray, 'the west window is lit');
  assert.ok(near(ray.a[0], 110) && near(ray.a[1], 260), 'first inner corner');
  assert.ok(near(ray.b[0], 110) && near(ray.b[1], 340), 'second inner corner');
  assert.ok(near(Math.hypot(ray.b[0] - ray.a[0], ray.b[1] - ray.a[1]), 80), 'full opening width');
  for (const poly of ray.polys) for (const [x, y] of poly) {
    assert.ok(x >= 110 - 1e-6 && x <= 490 + 1e-6, 'clipped to the clean-floor contour');
    assert.ok(y >= 110 - 1e-6 && y <= 490 + 1e-6, 'clipped to the clean-floor contour');
  }
});

test('grazing sun: the auditor\'s repro, fixed by a normal-axis fade (DEV-EB173-01)', () => {
  // The report's browser probe: a WEST window 80 render units long, elevation
  // 90 (so the nominal reach is 0.56 · 80 = 44.8 — «на 30 % короче»), azimuth
  // 190 at north_deg 0, i.e. the light enters the glass but travels only 10°
  // off the wall's own direction. It measured sides of 5.408 and 84.192
  // (ratio 15.57, the long one 31 % LONGER than the pre-cut 64) and source
  // offsets of ±0.879 — one end of the glass already fully transparent,
  // because rayStops() is dead from 0.85 on.
  const win = { id: 'wW', x: 100, y: 300, angle: 90, length: 80 };
  const rays = computeSunRays(ROOMS, [win], 190, 90, 0);
  assert.equal(rays.length, 1);
  const r = rays[0];
  assert.ok(near(r.dir[0], 0.17365, 1e-5) && near(r.dir[1], -0.98481, 1e-5));
  assert.ok(near(r.len, 44.8, 1e-9), 'nominal reach is the 70 % one');

  // 1) EQUAL sides, each exactly the nominal reach
  const q = rayQuad([r.a[0], r.a[1]], [r.b[0], r.b[1]], r.dir, r.len);
  const side = (p0, p1) => Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const sides = [side(q[0], q[3]), side(q[1], q[2])];
  assert.ok(near(sides[0], sides[1], 1e-9), 'sides equal (was a ratio of 15.57)');
  for (const l of sides) assert.ok(near(l, 44.8, 1e-9), 'each side is 44.8 (was 5.41 / 84.19)');

  // 2) the fade axis is the INWARD wall normal, len · cos(incidence) long
  assert.ok(near(r.normal[0], 1, 1e-12) && near(r.normal[1], 0, 1e-12));
  const cos = r.dir[0] * r.normal[0] + r.dir[1] * r.normal[1];
  assert.ok(near(cos, 0.17365, 1e-5), 'a 10°-off-the-wall sun');
  assert.ok(near(r.depth, 44.8 * cos, 1e-9));
  assert.ok(near(r.depth, 7.7794, 1e-4));

  // 3) offsets along THAT axis: the whole pane of glass at 0 (peak alpha at
  // BOTH ends — the probe's ±0.879 is gone), the far edge exactly at 1
  const mx = (r.a[0] + r.b[0]) / 2;
  const my = (r.a[1] + r.b[1]) / 2;
  const off = (p) => ((p[0] - mx) * r.normal[0] + (p[1] - my) * r.normal[1]) / r.depth;
  assert.ok(near(off(r.a), 0, 1e-12) && near(off(r.b), 0, 1e-12), 'glass all at peak alpha');
  assert.ok(near(off(q[2]), 1, 1e-12) && near(off(q[3]), 1, 1e-12), 'far edge on the last iso-alpha line');

  // 4) ...and the offset of any point is exactly how far ITS ray has run
  for (const u of [0, 0.25, 0.5, 0.85, 1]) {
    for (const src of [r.a, r.b, [r.a[0], r.a[1] + 17]]) {
      const p = [src[0] + r.dir[0] * r.len * u, src[1] + r.dir[1] * r.len * u];
      assert.ok(near(off(p), u, 1e-9), 'offset = travelled / len at u=' + u);
    }
  }
  // 5) nothing drawn past the gradient, on the clipped geometry too
  for (const poly of r.polys) for (const p of poly) {
    assert.ok(off(p) >= -1e-6 && off(p) <= 1 + 1e-6, 'inside the gradient');
  }
});

test('grazing sun: below RAY_MIN_COS a window casts nothing at all', () => {
  // azimuth 182° at north_deg 0 puts the sun 2° off the west wall's plane:
  // cos = sin(2°) = 0.035 < RAY_MIN_COS. 186° (0.105) still lights it.
  const win = { id: 'wW', x: 100, y: 300, angle: 90, length: 80 };
  assert.deepEqual(computeSunRays(ROOMS, [win], 182, 90, 0), []);
  assert.equal(computeSunRays(ROOMS, [win], 186, 90, 0).length, 1);
  // the surviving wedge is never thinner than 5 % of its own reach
  const r = computeSunRays(ROOMS, [win], 186, 90, 0)[0];
  assert.ok(r.depth >= r.len * RAY_MIN_COS);
});

test('computeSunRays: night → nothing at all', () => {
  assert.deepEqual(computeSunRays(ROOMS, ALL, 90, 0, 0), []);
  assert.deepEqual(computeSunRays(ROOMS, ALL, 90, -10, 0), []);
});

test('computeSunRays: rotating the compass swings the light to another window', () => {
  // the same morning east sun, but the plan is rotated 90°: what the canvas
  // shows as "up" is now east → the NORTH-drawn window faces the sun
  const rays = computeSunRays(ROOMS, ALL, 90, 5, 90);
  assert.deepEqual(rays.map((r) => r.openingId), ['wN']);
  // and the interior window still never lights up whatever the compass says
  for (const nd of [0, 45, 90, 180, 270]) {
    for (const az of [0, 90, 180, 270]) {
      assert.ok(!computeSunRays(ROOMS, ALL, az, 5, nd).some((r) => r.openingId === 'wI'));
    }
  }
});

test('rayAlpha: nothing below 3°, full strength above (owner 2026-08-03)', () => {
  // the old gradual ramp-in is gone: it is a threshold, not a fade
  assert.equal(rayAlpha(-3), 0);
  assert.equal(rayAlpha(0), 0);
  assert.equal(rayAlpha(1), 0);
  assert.equal(rayAlpha(2.99), 0);
  assert.ok(near(rayAlpha(3), RAY_MAX_ALPHA));   // exactly at the threshold: on
  assert.ok(near(rayAlpha(3.1), RAY_MAX_ALPHA));
  assert.ok(near(rayAlpha(30), RAY_MAX_ALPHA));
  assert.ok(near(rayAlpha(89), RAY_MAX_ALPHA));  // no elevation shaping at all
});

test('raysVisible / rayPeakAlpha: the threshold and fixed ceiling', () => {
  assert.equal(RAY_ELEVATION_MIN, 3);
  assert.equal(RAY_FADE_MS, 2000); // «ровно 2 секунды», mirrored in styles.ts
  assert.equal(raysVisible(2.9), false);
  assert.equal(raysVisible(3), true);
  assert.equal(raysVisible(45), true);
  assert.equal(raysVisible(-10), false);
  // the peak is fixed: weather does not participate in sunlight rendering
  assert.ok(near(rayPeakAlpha(), RAY_MAX_ALPHA));
});

test('RAY_MAX_ALPHA is the brighter 0.3 ceiling (owner 2026-08-03)', () => {
  assert.equal(RAY_MAX_ALPHA, 0.3);
});

test('rayColor: warm at the horizon, neutral by day', () => {
  assert.equal(rayColor(1), '#ff9a45');
  assert.equal(rayColor(0), '#ffe9c2');
  assert.notEqual(rayColor(0.5), rayColor(0));
});

test('northDegOf: space override wins, strict int 0–359, null = inert', () => {
  assert.equal(northDegOf({ north_deg: 90 }, {}), 90);
  assert.equal(northDegOf({ north_deg: 90 }, { north_deg: 0 }), 0); // 0 is a value, not "unset"
  assert.equal(northDegOf({}, { north_deg: 359 }), 359);
  assert.equal(northDegOf({}, {}), null);
  assert.equal(northDegOf(null, undefined), null);
  for (const bad of [360, -1, 1.5, '90', true, NaN]) {
    assert.equal(northDegOf({ north_deg: bad }, {}), null, String(bad));
  }
  // a garbage override falls back to the valid global
  assert.equal(northDegOf({ north_deg: 45 }, { north_deg: 999 }), 45);
});

test('bgModeOf: inherit chain with a static fallback', () => {
  assert.equal(bgModeOf({}, {}), 'static');
  assert.equal(bgModeOf({ bg_mode: 'daynight' }, {}), 'daynight');
  assert.equal(bgModeOf({ bg_mode: 'daynight' }, { bg_mode: 'static' }), 'static');
  assert.equal(bgModeOf({}, { bg_mode: 'daynight' }), 'daynight');
  assert.equal(bgModeOf({ bg_mode: 'disco' }, {}), 'static');
});

test('sunRaysOn: default OFF, per-space tri-state inherit', () => {
  assert.equal(sunRaysOn({}, {}), false);
  assert.equal(sunRaysOn({ sun_rays: true }, {}), true);
  assert.equal(sunRaysOn({ sun_rays: true }, { sun_rays: false }), false);
  assert.equal(sunRaysOn({}, { sun_rays: true }), true);
  assert.equal(sunRaysOn({ sun_rays: true }, { sun_rays: null }), true); // null = inherit
  assert.equal(sunRaysOn({ sun_rays: 'yes' }, {}), false);
});

test('sunStateOf: hass shapes, garbage-safe', () => {
  assert.deepEqual(
    sunStateOf({ states: { 'sun.sun': { attributes: { azimuth: 120.5, elevation: -3 } } } }),
    { azimuth: 120.5, elevation: -3 },
  );
  assert.equal(sunStateOf({ states: {} }), null);
  assert.equal(sunStateOf({ states: { 'sun.sun': { attributes: { azimuth: 'x', elevation: 1 } } } }), null);
  assert.equal(sunStateOf(null), null);
});
