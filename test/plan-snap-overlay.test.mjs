import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlanSnapGeometry,
  findSharedRoomSnapSegment,
  resolvePlanSnap,
} from '../test-build/plan-snap-overlay.js';

const space = (patch = {}) => ({ rooms: [], room_drafts: [], partitions: [], ...patch });
const closePoint = (actual, expected, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual[0] - expected[0]) <= epsilon, `${actual[0]} != ${expected[0]}`);
  assert.ok(Math.abs(actual[1] - expected[1]) <= epsilon, `${actual[1]} != ${expected[1]}`);
};

test('collector includes room rectangles, polygons, saved drafts and partitions', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({
      rooms: [
        { id: 'rect', x: 0, y: 0, w: 100, h: 50 },
        { id: 'poly', poly: [[200, 0], [250, 0], [225, 50]] },
      ],
      room_drafts: [{
        id: 'saved', points: [[0, 100], [50, 100], [50, 150]], segments: [{ cm: 15 }, { cm: 15 }],
      }],
      partitions: [{ id: 'partition', a: [100, 100], b: [150, 100], cm: 10 }],
    }),
  });
  assert.equal(geometry.segments.length, 10);
  assert.ok(geometry.endpoints.some((entry) => entry.point[0] === 0 && entry.point[1] === 100));
  assert.ok(geometry.endpoints.some((entry) => entry.point[0] === 150 && entry.point[1] === 100));
});

test('coincident endpoints and axes are deduplicated independently of direction', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({
      partitions: [
        { id: 'a', a: [0, 0], b: [100, 0], cm: 10 },
        { id: 'b', a: [100, 0], b: [0, 0], cm: 10 },
        { id: 'c', a: [100, 0], b: [100, 100], cm: 10 },
      ],
    }),
  });
  assert.equal(geometry.segments.length, 2);
  assert.equal(geometry.endpoints.length, 3);
});

test('active draft and degenerate inputs are excluded', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({
      room_drafts: [
        { id: 'active', points: [[0, 0], [100, 0]], segments: [{ cm: 15 }] },
        { id: 'saved', points: [[0, 10], [100, 10]], segments: [{ cm: 15 }] },
      ],
      partitions: [{ id: 'zero', a: [20, 20], b: [20, 20], cm: 10 }],
    }),
    activeDraftId: 'active',
  });
  assert.equal(geometry.segments.length, 1);
  assert.equal(geometry.segments[0].sourceId, 'saved:0');
});

test('room cuts leave solid intervals but do not create cut-boundary endpoints', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({ rooms: [{ id: 'room', x: 0, y: 0, w: 100, h: 100 }] }),
    roomCuts: [[30, 0, 70, 0], [0, 60, 0, 100]],
  });
  assert.ok(geometry.segments.some((segment) => segment.a[0] === 0 && segment.b[0] === 30));
  assert.ok(geometry.segments.some((segment) => segment.a[0] === 70 && segment.b[0] === 100));
  assert.ok(!geometry.endpoints.some((entry) => entry.point[0] === 30 && entry.point[1] === 0));
  assert.ok(!geometry.endpoints.some((entry) => entry.point[0] === 70 && entry.point[1] === 0));
  assert.ok(geometry.endpoints.some((entry) => entry.point[0] === 0 && entry.point[1] === 100),
    'an original endpoint remains when another solid wall still meets it');
});

test('shared-room interval contains endpoints and interior wall-bound points only on one edge', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({ rooms: [{ id: 'room', x: 0, y: 0, w: 100, h: 100 }] }),
  });
  assert.ok(findSharedRoomSnapSegment(geometry, [0, 0], [100, 0]));
  assert.ok(findSharedRoomSnapSegment(geometry, [0, 0], [40, 0]));
  assert.ok(findSharedRoomSnapSegment(geometry, [20, 0], [80, 0]));
  assert.equal(findSharedRoomSnapSegment(geometry, [0, 0], [100, 100]), null,
    'different room edges never imply an auto-closing wall');
  assert.equal(findSharedRoomSnapSegment(geometry, [40, 0], [40, 0]), null,
    'one point cannot define a closing interval');
  assert.equal(findSharedRoomSnapSegment(geometry, [-1, 0], [40, 0], 0.001), null,
    'collinearity outside the closed segment is insufficient');
});

test('shared-room interval respects cuts and rejects draft or partition-only axes', () => {
  const cut = buildPlanSnapGeometry({
    space: space({ rooms: [{ id: 'room', x: 0, y: 0, w: 100, h: 100 }] }),
    roomCuts: [[40, 0, 60, 0]],
  });
  assert.ok(findSharedRoomSnapSegment(cut, [0, 0], [30, 0]));
  assert.equal(findSharedRoomSnapSegment(cut, [0, 0], [100, 0]), null,
    'opening or open-span cuts split eligibility');

  const independent = buildPlanSnapGeometry({
    space: space({
      room_drafts: [{ id: 'draft', points: [[0, 10], [100, 10]], segments: [{ cm: 15 }] }],
      partitions: [{ id: 'partition', a: [0, 20], b: [100, 20], cm: 15 }],
    }),
  });
  assert.equal(findSharedRoomSnapSegment(independent, [0, 10], [100, 10]), null);
  assert.equal(findSharedRoomSnapSegment(independent, [0, 20], [100, 20]), null);
});

test('a completed room remains the authority for a coincident deduplicated axis', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({
      rooms: [{ id: 'room', x: 0, y: 0, w: 100, h: 100 }],
      partitions: [{ id: 'partition', a: [100, 0], b: [0, 0], cm: 15 }],
    }),
  });
  const shared = findSharedRoomSnapSegment(geometry, [0, 0], [100, 0]);
  assert.equal(shared?.sourceKind, 'room');
});

test('endpoint wins over a closer line and tie resolution is stable', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({
      partitions: [
        { id: 'endpoint', a: [0, 0], b: [100, 0], cm: 10 },
        { id: 'closer-line', a: [8, -100], b: [8, 100], cm: 10 },
      ],
    }),
  });
  const endpoint = resolvePlanSnap(geometry, [7, 1], { tolerance: 12, gridStep: 10 });
  assert.equal(endpoint?.kind, 'endpoint');
  closePoint(endpoint.point, [0, 0]);

  const tie = buildPlanSnapGeometry({
    space: space({ partitions: [
      { id: 'right', a: [10, 0], b: [10, 100], cm: 10 },
      { id: 'left', a: [-10, 0], b: [-10, 100], cm: 10 },
    ] }),
  });
  const first = resolvePlanSnap(tie, [0, 50], { tolerance: 12, gridStep: 10 });
  const second = resolvePlanSnap({
    segments: [...tie.segments].reverse(), endpoints: [...tie.endpoints].reverse(),
  }, [0, 50], { tolerance: 12, gridStep: 10 });
  assert.equal(first?.key, second?.key);
});

test('line projection stays wall-bound and quantizes along horizontal, vertical and diagonal axes', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({ partitions: [
      { id: 'horizontal', a: [0, 0], b: [100, 0], cm: 10 },
      { id: 'vertical', a: [200, 0], b: [200, 100], cm: 10 },
      { id: 'diagonal', a: [300, 0], b: [400, 100], cm: 10 },
    ] }),
  });
  closePoint(resolvePlanSnap(geometry, [44, 5], { tolerance: 8, gridStep: 10 }).point, [40, 0]);
  closePoint(resolvePlanSnap(geometry, [205, 44], { tolerance: 8, gridStep: 10 }).point, [200, 40]);
  const diagonal = resolvePlanSnap(geometry, [337, 43], { tolerance: 8, gridStep: 10 });
  assert.equal(diagonal.kind, 'line');
  closePoint(diagonal.point, [342.42640687119285, 42.426406871192846]);
});

test('current anchor is excluded while an explicit closure endpoint remains available', () => {
  const geometry = buildPlanSnapGeometry({
    space: space({ partitions: [{ id: 'wall', a: [0, 0], b: [100, 0], cm: 10 }] }),
  });
  assert.equal(resolvePlanSnap(geometry, [0, 0], {
    tolerance: 12, gridStep: 10, excludePoints: [[0, 0]],
  }), null);
  const closure = resolvePlanSnap(geometry, [2, 98], {
    tolerance: 12,
    gridStep: 10,
    excludePoints: [[100, 100]],
    extraEndpoints: [{ point: [0, 100], key: 'closure' }],
  });
  assert.equal(closure?.kind, 'endpoint');
  closePoint(closure.point, [0, 100]);
});
