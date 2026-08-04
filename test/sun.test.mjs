import test from 'node:test';
import assert from 'node:assert/strict';
import {
  norm360, planSunAngle, sunDirOnPlan, dayPhase,
  isExteriorWall, windowWallInfo, windowLit,
  rayLength, rayQuad, clipToRoom, computeSunRays,
  rayAlpha, rayColor, cloudFactor, RAY_MAX_ALPHA,
  raysVisible, rayPeakAlpha, RAY_ELEVATION_MIN, RAY_FADE_MS,
  RAY_LENGTH_K, RAY_FADE_END, rayStops, raySoftness,
  SKY_SNAP_DEG, skyNeedsSnap, skyElevation,
  northDegOf, bgModeOf, sunRaysOn, weatherEntityOf, sunStateOf,
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

test('windowLit: above the horizon AND facing the sun', () => {
  const east = [1, 0];
  assert.ok(windowLit(east, sunDirOnPlan(90, 0), 10));
  assert.ok(!windowLit(east, sunDirOnPlan(270, 0), 10)); // sun behind the house
  assert.ok(!windowLit(east, sunDirOnPlan(90, 0), 0));   // sunset moment
  assert.ok(!windowLit(east, sunDirOnPlan(90, 0), -5));  // night
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

test('raySoftness: a feather proportional to the shaft, clamped both ends', () => {
  assert.equal(raySoftness(0), 3);          // a stub of a wedge still gets a kerb
  assert.ok(near(raySoftness(100), 7, 1e-9));
  assert.ok(near(raySoftness(200), 14, 1e-9));
  assert.equal(raySoftness(1e6), 18);       // never a smear across the plan
  assert.ok(raySoftness(200) > raySoftness(100));
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
  // clouds still scale it, rain still kills it
  assert.ok(near(rayAlpha(30, 0.25), RAY_MAX_ALPHA * 0.25));
  assert.equal(rayAlpha(30, 0), 0);
});

test('raysVisible / rayPeakAlpha: the threshold and the cloud-only ceiling', () => {
  assert.equal(RAY_ELEVATION_MIN, 3);
  assert.equal(RAY_FADE_MS, 2000); // «ровно 2 секунды», mirrored in styles.ts
  assert.equal(raysVisible(2.9), false);
  assert.equal(raysVisible(3), true);
  assert.equal(raysVisible(45), true);
  assert.equal(raysVisible(-10), false);
  // the peak is what the gradient uses while the layer fades — cloud only
  assert.ok(near(rayPeakAlpha(), RAY_MAX_ALPHA));
  assert.ok(near(rayPeakAlpha(1), RAY_MAX_ALPHA));
  assert.ok(near(rayPeakAlpha(0.4), RAY_MAX_ALPHA * 0.4));
  assert.equal(rayPeakAlpha(0), 0);
});

test('RAY_MAX_ALPHA is the brighter 0.3 ceiling (owner 2026-08-03)', () => {
  assert.equal(RAY_MAX_ALPHA, 0.3);
});

test('rayColor: warm at the horizon, neutral by day', () => {
  assert.equal(rayColor(1), '#ff9a45');
  assert.equal(rayColor(0), '#ffe9c2');
  assert.notEqual(rayColor(0.5), rayColor(0));
});

test('cloudFactor: the state map, garbage-safe', () => {
  assert.equal(cloudFactor('sunny'), 1);
  assert.equal(cloudFactor('clear-night'), 1);
  assert.equal(cloudFactor('partlycloudy'), 0.7);
  assert.equal(cloudFactor('cloudy'), 0.4);
  assert.equal(cloudFactor('overcast'), 0.25);
  assert.equal(cloudFactor('fog'), 0.25);
  assert.equal(cloudFactor('rainy'), 0);
  assert.equal(cloudFactor('pouring'), 0);
  assert.equal(cloudFactor('snowy'), 0);
  assert.equal(cloudFactor('lightning-rainy'), 0);
  assert.equal(cloudFactor('unknown'), 1);
  assert.equal(cloudFactor('unavailable'), 1);
  assert.equal(cloudFactor(null), 1);
  assert.equal(cloudFactor(undefined), 1);
  assert.equal(cloudFactor('CLOUDY'), 0.4);
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

test('weatherEntityOf / sunStateOf: strings and hass shapes, garbage-safe', () => {
  assert.equal(weatherEntityOf({ weather_entity: 'weather.home' }), 'weather.home');
  assert.equal(weatherEntityOf({ weather_entity: '  ' }), null);
  assert.equal(weatherEntityOf({}), null);
  assert.deepEqual(
    sunStateOf({ states: { 'sun.sun': { attributes: { azimuth: 120.5, elevation: -3 } } } }),
    { azimuth: 120.5, elevation: -3 },
  );
  assert.equal(sunStateOf({ states: {} }), null);
  assert.equal(sunStateOf({ states: { 'sun.sun': { attributes: { azimuth: 'x', elevation: 1 } } } }), null);
  assert.equal(sunStateOf(null), null);
});
