import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  polygonSegments, splitAtIntersections, visibilityPolygon,
} from '../test-build/light-visibility.js';
import { isInteriorLightOpeningType } from '../test-build/logic.js';

const RAD = 100;

test('interior light crosses only the explicit physical opening allowlist', () => {
  assert.equal(isInteriorLightOpeningType('door'), true);
  assert.equal(isInteriorLightOpeningType('gate'), true);
  assert.equal(isInteriorLightOpeningType('passage'), true);
  assert.equal(isInteriorLightOpeningType('window'), false);
  assert.equal(isInteriorLightOpeningType('future-opening'), false);
});
/** Distance the lamp actually reaches at `angleDeg`, per the returned ring. */
const reachAt = (ring, source, angleDeg) => {
  const wanted = (angleDeg * Math.PI) / 180;
  let best = null;
  let bestDelta = Infinity;
  for (const point of ring) {
    const angle = Math.atan2(point[1] - source[1], point[0] - source[0]);
    let delta = Math.abs(angle - wanted);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    if (delta < bestDelta) { bestDelta = delta; best = point; }
  }
  return best ? Math.hypot(best[0] - source[0], best[1] - source[1]) : 0;
};

test('an empty plan lights the full radius in every direction', () => {
  const source = [0, 0];
  const ring = visibilityPolygon(source, RAD, []);
  assert.ok(ring.length >= 12);
  for (const degrees of [0, 37, 90, 180, -120]) {
    assert.ok(Math.abs(reachAt(ring, source, degrees) - RAD) < RAD * 0.01);
  }
});

test('a wall stops the light at the wall and leaves the other side lit', () => {
  const source = [0, 0];
  // vertical wall at x = 30, from y = -50 to y = 50
  const ring = visibilityPolygon(source, RAD, [[30, -50, 30, 50]]);
  assert.ok(Math.abs(reachAt(ring, source, 0) - 30) < 1, 'blocked ahead');
  assert.ok(reachAt(ring, source, 180) > RAD * 0.98, 'free behind');
});

test('a doorway in a wall lets a beam through and only through', () => {
  const source = [0, 0];
  // same wall, but split into two pieces: the gap is y in (-10, 10)
  const ring = visibilityPolygon(source, RAD, [
    [30, -50, 30, -10],
    [30, 10, 30, 50],
  ]);
  assert.ok(reachAt(ring, source, 0) > RAD * 0.98, 'through the gap');
  assert.ok(Math.abs(reachAt(ring, source, 30) - 30 / Math.cos(Math.PI / 6)) < 2,
    'blocked where the wall is');
});

test('a column casts a shadow whose edges are the rays that graze it', () => {
  const source = [0, 0];
  const column = [[40, -5], [50, -5], [50, 5], [40, 5]];
  const ring = visibilityPolygon(source, RAD, polygonSegments(column));
  assert.ok(Math.abs(reachAt(ring, source, 0) - 40) < 1, 'stops at the column');
  // Just outside the shadow the light is free again: the column subtends
  // atan(5/40) ~ 7.1 degrees, so 12 degrees off-axis is lit to the radius.
  assert.ok(reachAt(ring, source, 12) > RAD * 0.98, 'lit beside the column');
});

test('an occluder outside the radius changes nothing', () => {
  const source = [0, 0];
  const ring = visibilityPolygon(source, RAD, [[300, -50, 300, 50]]);
  for (const degrees of [0, 45, 90]) {
    assert.ok(Math.abs(reachAt(ring, source, degrees) - RAD) < RAD * 0.01);
  }
});

test('a source on an opaque edge is rejected instead of deleting the wall', () => {
  const source = [0, 0];
  const ring = visibilityPolygon(source, RAD, [[-50, 0, 50, 0]]);
  assert.deepEqual(ring, []);
});

test('the angular seam at pi does not cut a wedge out of the visible region', () => {
  const source = [25, 12];
  const room = [[0, 0], [40, 0], [40, 30], [0, 30]];
  const wall = [15, 12, 15, 30];
  const ring = visibilityPolygon(source, 40, [...polygonSegments(room), wall]);
  const area = Math.abs(ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
  assert.ok(area > 925, `the -x seam must not lose a full angular wedge (${area})`);
});

test('a corner made by two crossing barriers is lit right up to the corner', () => {
  const source = [0, 0];
  // A wall face running through another one — a junction of two wall bodies.
  // The inner corner is at (40, 25), off the sweep's own arc angles, so only
  // splitting can put a ray on it; the lamp sits below-left and sees it.
  const crossing = [[40, -100, 40, 100], [-100, 25, 100, 25]];
  const cut = splitAtIntersections(crossing);
  assert.equal(cut.length, 4, 'both barriers are split at the crossing');
  const naive = visibilityPolygon(source, 200, crossing);
  const exact = visibilityPolygon(source, 200, cut);
  const corner = (ring) => ring.some(([x, y]) => Math.abs(x - 40) < 0.01 && Math.abs(y - 25) < 0.01);
  assert.equal(corner(naive), false, 'unsplit barriers leave the corner unsampled');
  assert.equal(corner(exact), true, 'after the split the corner itself is a vertex');
});

test('splitAtIntersections leaves barriers that only touch end to end alone', () => {
  const chain = [[0, 0, 10, 0], [10, 0, 10, 10]];
  assert.deepEqual(splitAtIntersections(chain), chain);
  // Collinear overlap is not a crossing: nothing to split.
  const collinear = [[0, 0, 10, 0], [4, 0, 14, 0]];
  assert.deepEqual(splitAtIntersections(collinear), collinear);
});

test('polygonSegments closes the ring and drops zero-length edges', () => {
  const segments = polygonSegments([[0, 0], [10, 0], [10, 0], [10, 10]]);
  assert.equal(segments.length, 3);
  assert.deepEqual(segments[segments.length - 1], [10, 10, 0, 0]);
});
