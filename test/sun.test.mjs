import test from 'node:test';
import assert from 'node:assert/strict';
import {
  norm360, planSunAngle, sunDirOnPlan, dayPhase,
  isExteriorWall, windowWallInfo, windowLit,
  rayLength, rayQuad, clipToRoom, computeSunRays,
  rayAlpha, rayColor, cloudFactor, RAY_MAX_ALPHA,
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

test('rayLength: longest at the horizon, shortest at noon, monotonic', () => {
  assert.ok(near(rayLength(0), 2.5, 1e-9));
  assert.ok(near(rayLength(90), 0.8, 1e-9));
  assert.ok(rayLength(10) > rayLength(30));
  assert.ok(rayLength(30) > rayLength(60));
  assert.ok(near(rayLength(-5), 2.5, 1e-9)); // clamped
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

test('rayAlpha: capped, ramps in near the horizon, scaled by clouds', () => {
  assert.equal(rayAlpha(0), 0);
  assert.equal(rayAlpha(-3), 0);
  assert.ok(near(rayAlpha(1), RAY_MAX_ALPHA / 2));
  assert.ok(near(rayAlpha(30), RAY_MAX_ALPHA));
  assert.ok(near(rayAlpha(30, 0.25), RAY_MAX_ALPHA * 0.25));
  assert.equal(rayAlpha(30, 0), 0);
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
