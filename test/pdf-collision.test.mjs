import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pdfBoxInsideRing, pdfBoxTouchesGeometry, pdfInflateBox, pdfSegmentTouchesBox,
  pdfSegmentTouchesGeometry,
} from '../test-build/pdf/pdf-collision.js';

const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index], [xj, yj] = ring[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const squareSolid = (point) => pointInRing(point, square);

test('collision boxes expand by the requested paper clearance', () => {
  assert.deepEqual(pdfInflateBox({ minX: 2, minY: 3, maxX: 7, maxY: 11 }, 1),
    { minX: 1, minY: 2, maxX: 8, maxY: 12 });
  assert.deepEqual(pdfInflateBox({ minX: 2, minY: 3, maxX: 7, maxY: 11 }, -1),
    { minX: 2, minY: 3, maxX: 7, maxY: 11 }, 'invalid clearance fails closed to zero growth');
});

test('box collision catches a thin diagonal between sparse sample points', () => {
  const diagonal = [[-1, 2], [11, 8], [11, 8.1], [-1, 2.1]];
  const inside = ([x, y]) => {
    let hit = false;
    for (let index = 0, previous = diagonal.length - 1;
      index < diagonal.length; previous = index++) {
      const [xi, yi] = diagonal[index], [xj, yj] = diagonal[previous];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  assert.equal(pdfBoxTouchesGeometry(
    { minX: 0, minY: 0, maxX: 10, maxY: 10 }, [diagonal], inside,
  ), true);
});

test('allowed extension start is symmetric on every outer and hole boundary', () => {
  const sides = [
    { start: [0, 5], outward: [-2, 5], inward: [2, 5] },
    { start: [10, 5], outward: [12, 5], inward: [8, 5] },
    { start: [5, 0], outward: [5, -2], inward: [5, 2] },
    { start: [5, 10], outward: [5, 12], inward: [5, 8] },
  ];
  for (const ring of [square, [...square].reverse()]) for (const side of sides) {
    assert.equal(pdfSegmentTouchesGeometry(
      side.start, side.outward, [ring], squareSolid, { allowStartBoundary: true },
    ), false, 'a dimension extension can leave any winding/face');
    assert.equal(pdfSegmentTouchesGeometry(
      side.start, side.inward, [ring], squareSolid, { allowStartBoundary: true },
    ), true, 'the same extension cannot enter masonry');
  }

  const outer = [[0, 0], [20, 0], [20, 20], [0, 20]];
  const hole = [[5, 5], [5, 15], [15, 15], [15, 5]];
  const donutSolid = (point) => pointInRing(point, outer) && !pointInRing(point, hole);
  const holeSides = [
    { start: [5, 10], hole: [7, 10], wall: [3, 10] },
    { start: [15, 10], hole: [13, 10], wall: [17, 10] },
    { start: [10, 5], hole: [10, 7], wall: [10, 3] },
    { start: [10, 15], hole: [10, 13], wall: [10, 17] },
  ];
  for (const side of holeSides) {
    assert.equal(pdfSegmentTouchesGeometry(
      side.start, side.hole, [outer, hole], donutSolid, { allowStartBoundary: true },
    ), false, 'an allowed start can leave a wall face into its opening');
    assert.equal(pdfSegmentTouchesGeometry(
      side.start, side.wall, [outer, hole], donutSolid, { allowStartBoundary: true },
    ), true, 'an extension cannot travel from an opening face into masonry');
  }
});

test('external dimension extension may leave its own stepped corner but never re-enter', () => {
  const step = [[0, 0], [10, 0], [10, 3], [12, 3], [12, 6], [10, 6], [10, 10], [0, 10]];
  const stepSolid = (point) => pointInRing(point, step);
  const ownExit = { allowStartExit: true };

  assert.equal(pdfSegmentTouchesGeometry(
    [10, 3], [14, 3], [step], stepSolid, ownExit,
  ), false, 'the source prefix may follow the incident facade step before reaching free space');
  assert.equal(pdfSegmentTouchesGeometry(
    [10, 3], [14, 3], [step], stepSolid, { allowStartBoundary: true },
  ), true, 'the ordinary strict start-boundary mode still rejects collinear overlap');
  assert.equal(pdfSegmentTouchesGeometry(
    [0, 5], [12, 5], [square], squareSolid, ownExit,
  ), false, 'the source prefix may cross its contiguous wall body once before exiting');
  assert.equal(pdfSegmentTouchesGeometry(
    [0, 5], [10, 5], [square], squareSolid, ownExit,
  ), true, 'a segment ending on the exit boundary never reaches a free interval');

  const foreignWall = [[13, 2], [15, 2], [15, 4], [13, 4]];
  const combinedSolid = (point) => stepSolid(point) || pointInRing(point, foreignWall);
  assert.equal(pdfSegmentTouchesGeometry(
    [10, 3], [16, 3], [step, foreignWall], combinedSolid, ownExit,
  ), true, 'a second wall after the first free interval remains a collision');
  const tangentWall = [[13, 3], [15, 4], [15, 5], [13, 4]];
  assert.equal(pdfSegmentTouchesGeometry(
    [10, 3], [16, 3], [step, tangentWall], combinedSolid, ownExit,
  ), true, 'a later point contact remains a collision even without a solid interval');
  assert.equal(pdfSegmentTouchesGeometry(
    [11, 4], [14, 4], [step], stepSolid, ownExit,
  ), true, 'only a segment starting at its source boundary receives the exception');
});

test('degenerate and invalid collision inputs fail deterministically', () => {
  const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  assert.equal(pdfSegmentTouchesBox([20, 20], [20, 20], box), false);
  assert.equal(pdfSegmentTouchesBox([5, 5], [5, 5], box), true);
  assert.equal(pdfSegmentTouchesBox([0, 5], [0, 5], box), true);
  assert.equal(pdfSegmentTouchesGeometry([20, 20], [20, 20], [square], squareSolid), false);
  assert.equal(pdfSegmentTouchesGeometry([5, 5], [5, 5], [square], squareSolid), true);
  assert.equal(pdfSegmentTouchesGeometry([Number.NaN, 0], [1, 1], [square], squareSolid), true);
  assert.equal(pdfBoxTouchesGeometry(box,
    [[[0, 0], [Number.POSITIVE_INFINITY, 0], [1, 1]]], () => false), true);
  assert.equal(pdfSegmentTouchesBox([20, 20], [21, 21],
    { minX: 10, minY: 0, maxX: 0, maxY: 10 }), true);

  const shortOverlap = [[0, 0], [1, 0], [1, -1], [0, -1]];
  assert.equal(pdfSegmentTouchesGeometry(
    [0, 0], [1e9, 0], [shortOverlap], () => false, { allowStartBoundary: true },
  ), true, 'every positive collinear overlap remains a collision, independent of query length');
});

test('segment intersections remain stable across coordinate scales', () => {
  for (const scale of [1e-6, 1, 1e6]) {
    const box = { minX: 0, minY: 0, maxX: 10 * scale, maxY: 10 * scale };
    assert.equal(pdfSegmentTouchesBox(
      [-2 * scale, 5 * scale], [12 * scale, 5 * scale], box,
    ), true);
    assert.equal(pdfSegmentTouchesBox(
      [-2 * scale, 12 * scale], [12 * scale, 12 * scale], box,
    ), false);
  }
});

test('inside-ring check rejects a box cut by a concave boundary', () => {
  const concave = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]];
  const inside = ([x, y]) => x > 0 && x < 10 && y > 0 && y < 10
    && !(x > 4 && x < 6 && y > 4);
  assert.equal(pdfBoxInsideRing(
    { minX: 3, minY: 3, maxX: 7, maxY: 5 }, concave, inside,
  ), false, 'all four corners alone are insufficient for a concave room');
  assert.equal(pdfBoxInsideRing(
    { minX: 1, minY: 1, maxX: 3, maxY: 3 }, concave, inside,
  ), true);
});
