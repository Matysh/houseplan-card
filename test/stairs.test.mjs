import assert from 'node:assert/strict';
import test from 'node:test';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import {
  cachedStairRenderGeometry,
  floorAreaMinusStairs,
  geometryAreaMinusStairs,
  geometryMinusStairsSteps,
  isStair,
  stairFootprintGeometry,
  stairFootprintsTouching,
  stairRenderGeometry,
} from '../test-build/stairs.js';
import { geometryArea } from '../test-build/physical-geometry.js';
import { difference } from 'polyclip-ts';
import {
  convertStairKind,
  defaultStair,
  snapStairToStairs,
  stairPhysicalSizeCm,
  stairTargetState,
} from '../test-build/stairs-editor-model.js';

const straight = (extra = {}) => ({
  id: 'straight', kind: 'straight', x: 0.5, y: 0.5, angle: 0,
  direction: 'forward', length: 0.24, width: 0.1,
  target_space_id: 'upper', ...extra,
});

const spiral = (extra = {}) => ({
  id: 'spiral', kind: 'spiral', x: 0.5, y: 0.5, angle: 0,
  direction: 'clockwise', radius: 0.1,
  target_space_id: 'upper', ...extra,
});

test('#663 validates the discriminated stair model and preserves future fields', () => {
  assert.equal(isStair({ ...straight(), future: { keep: true } }), true);
  assert.equal(isStair({ ...straight(), direction: 'clockwise' }), false);
  assert.equal(isStair({ ...straight(), width: 0 }), false);
  assert.equal(isStair({ ...spiral(), direction: 'backward' }), false);
  assert.equal(isStair({ ...spiral(), radius: Number.NaN }), false);
  assert.equal(isStair({ ...spiral(), radius: 5001 }), false);
  assert.equal(isStair({ ...straight(), angle: 361 }), false);
});

test('#663 default physical sizes and type conversion are predictable', () => {
  const first = defaultStair('straight', 500, 400, 5, 'a');
  assert.equal(first.kind, 'straight');
  assert.deepEqual(stairPhysicalSizeCm(first, 5).map(Math.round), [240, 100]);
  first.target_space_id = 'upper';
  const round = convertStairKind(first, 'spiral');
  assert.equal(round.kind, 'spiral');
  assert.equal(Math.round(stairPhysicalSizeCm(round, 5)[0]), 120);
  const restored = convertStairKind(round, 'straight');
  assert.equal(restored.kind, 'straight');
  assert.deepEqual(stairPhysicalSizeCm(restored, 5).map(Math.round), [240, 240]);
  assert.equal(restored.target_space_id, 'upper');
});

test('#663 straight stair treads keep exact 30 cm intervals and top remainder', () => {
  const geometry = stairRenderGeometry(straight(), 5);
  assert.equal(geometry.treads.length, 9);
  for (let index = 1; index < geometry.treads.length; index++) {
    assert.equal(geometry.treads[index].a[0] - geometry.treads[index - 1].a[0], 25);
  }
  assert.equal(geometry.treads[0].a[0], 405, 'first line is 30 cm after the lower edge');
  assert.equal(geometry.treads.at(-1).a[0], 605, 'the short remainder stays before the top edge');
  assert.deepEqual(
    geometry.treads.map((line) => line.b[1] - line.a[1]),
    Array(9).fill(100),
  );
  const zoomed = stairRenderGeometry(straight(), 5, 500);
  assert.equal(zoomed.treads.length, geometry.treads.length,
    'zoom changes only pixels, never the physical tread count');
  assert.equal(zoomed.treads[1].a[0] - zoomed.treads[0].a[0], 12.5,
    'the same 30 cm interval scales with the symbol, not with viewport zoom');

  const backward = stairRenderGeometry(straight({ direction: 'backward' }), 5);
  assert.equal(backward.treads.length, geometry.treads.length);
  for (let index = 1; index < backward.treads.length; index++) {
    assert.equal(backward.treads[index].a[0] - backward.treads[index - 1].a[0], -25);
  }
  assert.equal(backward.treads[0].a[0], 595,
    'backward starts its full intervals at the opposite lower edge');
  assert.equal(backward.treads.at(-1).a[0], 395,
    'the short remainder stays before the backward top edge');
});

test('#663 spiral stair uses one turn with 30 cm travel-line spacing', () => {
  const geometry = stairRenderGeometry(spiral({ angle: 30 }), 5);
  assert.equal(geometry.treads.length, 16);
  const center = geometry.center;
  const angles = geometry.treads.map((line) => Math.atan2(
    line.b[1] - center[1], line.b[0] - center[0],
  ));
  const unwrapped = angles.reduce((result, angle) => {
    let value = angle;
    while (result.length && value <= result.at(-1)) value += Math.PI * 2;
    result.push(value);
    return result;
  }, []);
  const expected = 25 / (100 * 2 / 3);
  for (let index = 1; index < unwrapped.length; index++) {
    assert.ok(Math.abs((unwrapped[index] - unwrapped[index - 1]) - expected) < 1e-10);
  }
  const reverse = stairRenderGeometry(spiral({ direction: 'counterclockwise' }), 5);
  assert.ok(reverse.treads[1].b[1] < reverse.treads[0].b[1]);
});

test('#663 cached render geometry survives live repaints and invalidates on transform', () => {
  const item = straight();
  const first = cachedStairRenderGeometry(item, 5);
  const second = cachedStairRenderGeometry(item, 5);
  assert.equal(second, first, 'unchanged stair reuses the dense render geometry');
  item.angle = 45;
  const changed = cachedStairRenderGeometry(item, 5);
  assert.notEqual(changed, first, 'in-place edits cannot leave a stale cache entry');
});

test('#663 stair magnet covers rectangle/rectangle, rectangle/circle and circle/circle footprints', () => {
  const rect = straight({ id: 'rect', x: 0.5, y: 0.5, length: 0.2, width: 0.1 });
  const circle = spiral({ id: 'circle', x: 0.5, y: 0.5, radius: 0.08 });
  const movingRect = straight({ id: 'moving-rect', length: 0.2, width: 0.1 });
  const movingCircle = spiral({ id: 'moving-circle', radius: 0.08 });

  assert.deepEqual(snapStairToStairs(movingRect, [704, 500], [rect], 10), [700, 500]);
  assert.deepEqual(snapStairToStairs(movingCircle, [686, 500], [rect], 10), [680, 500]);
  assert.deepEqual(snapStairToStairs(movingRect, [686, 500], [circle], 10), [680, 500]);
  assert.deepEqual(snapStairToStairs(movingCircle, [664, 500], [circle], 10), [660, 500]);
  assert.deepEqual(snapStairToStairs(movingCircle, [700, 500], [circle], 10), [700, 500]);
  assert.deepEqual(circle, spiral({ id: 'circle', x: 0.5, y: 0.5, radius: 0.08 }));
});

test('#663 area removes only stair overlap and never becomes negative', () => {
  const floor = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  assert.equal(floorAreaMinusStairs(floor, [straight()]), 976_000);
  assert.equal(floorAreaMinusStairs(floor, [straight({ x: 0.95, length: 0.2, width: 0.2 })]), 970_000);
  const circular = floorAreaMinusStairs(floor, [spiral()]);
  assert.ok(Math.abs(circular - (1_000_000 - Math.PI * 10_000)) < 60,
    '64-segment circle remains physically accurate');
  const source = [[[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]];
  assert.equal(geometryAreaMinusStairs(source, [straight({ length: 2, width: 2 })]), 0);
});

test('#663 dense stair subtraction yields between bounded polygon batches', () => {
  const source = [[[[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]]];
  const stairs = Array.from({ length: 5 }, (_, index) => straight({
    id: `stair-${index}`, x: 0.15 + index * 0.16, length: 0.1, width: 0.1,
  }));
  const steps = geometryMinusStairsSteps(source, stairs, 1000, 2);
  assert.equal(steps.next().done, false);
  assert.equal(steps.next().done, false);
  assert.equal(steps.next().done, false);
  const finished = steps.next();
  assert.equal(finished.done, true);
  assert.equal(geometryAreaMinusStairs(finished.value, []), 950_000);

  const denseSteps = geometryMinusStairsSteps(source, Array.from({ length: 49 }, (_, index) => (
    straight({ id: `dense-${index}` })
  )));
  let slices = 0;
  let denseStep = denseSteps.next();
  while (!denseStep.done) {
    slices += 1;
    denseStep = denseSteps.next();
  }
  assert.equal(slices, 3, 'the default keeps a 49-stair calculation out of one main-thread task');
});

test('#663 target states distinguish active, missing, self, deleted and fixed', () => {
  const spaces = new Set(['ground', 'upper']);
  assert.equal(stairTargetState(straight(), 'ground', spaces, false), 'active');
  assert.equal(stairTargetState(straight({ target_space_id: null }), 'ground', spaces, false), 'missing');
  assert.equal(stairTargetState(straight({ target_space_id: 'ground' }), 'ground', spaces, false), 'self');
  assert.equal(stairTargetState(straight({ target_space_id: 'gone' }), 'ground', spaces, false), 'deleted');
  assert.equal(stairTargetState(straight(), 'ground', spaces, true), 'fixed');
});

test('#663 Optimize preserves continuous authored stair transforms exactly', () => {
  const authored = straight({
    x: 0.123456789, y: -0.287654321, angle: 17.123456789,
    length: 0.234567891, width: 0.087654319,
  });
  const config = {
    model_version: 10,
    spaces: [{
      id: 'ground', title: 'Ground', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [], wall_segments: [], stairs: [authored],
    }, {
      id: 'upper', title: 'Upper', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [], wall_segments: [],
    }],
    markers: [], settings: {},
  };
  const result = optimizePlans(config, {});
  assert.deepEqual(result.config.spaces[0].stairs[0], authored);
});

test('#663 legacy-no-stairs-config never materializes an empty stair collection', () => {
  const legacy = {
    model_version: 10,
    spaces: [{
      id: 'legacy', title: 'Legacy', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [], wall_segments: [],
    }],
    markers: [], settings: {},
  };
  const before = structuredClone(legacy);
  const result = optimizePlans(legacy, {});
  assert.equal(Object.hasOwn(result.config.spaces[0], 'stairs'), false);
  assert.deepEqual(legacy, before, 'Optimize remains immutable for the caller');
});

// #669 AC2: the bounds filter must not change the subtraction it shortens.
const unfilteredArea = (source, stairs) => {
  const footprints = stairs.map((stair) => stairFootprintGeometry(stair));
  return Math.max(0, geometryArea(footprints.length ? difference(source, ...footprints) : source));
};

test('#669 AC2 stair area with the bounds filter equals the unfiltered subtraction', () => {
  const room = [[[[200, 200], [600, 200], [600, 600], [200, 600], [200, 200]]]];
  const stairs = [
    straight({ id: 'inside', x: 0.3, y: 0.3, length: 0.1, width: 0.05 }),
    straight({ id: 'rotated', x: 0.45, y: 0.45, angle: 45, length: 0.12, width: 0.04 }),
    straight({ id: 'edge', x: 0.6, y: 0.4, angle: 90, length: 0.1, width: 0.05 }),
    straight({ id: 'corner', x: 0.2, y: 0.2, angle: 135, length: 0.08, width: 0.05 }),
    spiral({ id: 'spiral-inside', x: 0.5, y: 0.3, radius: 0.04 }),
    spiral({ id: 'spiral-edge', x: 0.4, y: 0.6, radius: 0.05 }),
    straight({ id: 'overlap-a', x: 0.35, y: 0.5, length: 0.1, width: 0.06 }),
    straight({ id: 'overlap-b', x: 0.36, y: 0.52, angle: 90, length: 0.1, width: 0.06 }),
    straight({ id: 'far-a', x: 0.9, y: 0.9, length: 0.1, width: 0.05 }),
    spiral({ id: 'far-b', x: 0.05, y: 0.9, radius: 0.03 }),
  ];
  const expected = unfilteredArea(room, stairs);
  const actual = geometryAreaMinusStairs(room, stairs);
  assert.ok(Math.abs(actual - expected) <= expected * 1e-9, `${actual} vs ${expected}`);
  assert.ok(actual < 160_000, 'the touching stairs are subtracted');
});

test('#669 AC2 stairs whose bounds miss the room never reach polyclip', () => {
  const room = [[[[200, 200], [600, 200], [600, 600], [200, 600], [200, 200]]]];
  const stairs = [
    straight({ id: 'inside', x: 0.3, y: 0.3, length: 0.1, width: 0.05 }),
    spiral({ id: 'edge', x: 0.4, y: 0.6, radius: 0.05 }),
    straight({ id: 'far-a', x: 0.9, y: 0.9, length: 0.1, width: 0.05 }),
    spiral({ id: 'far-b', x: 0.05, y: 0.9, radius: 0.03 }),
  ];
  const touching = stairFootprintsTouching(room, stairs);
  assert.equal(touching.length, 2, 'only the inside and the edge stair are passed on');
  assert.deepEqual(stairFootprintsTouching([], stairs), [], 'an empty subject touches nothing');
});

test('#669 AC2 a maximum stair collection keeps the room area and passes a bounded subset', () => {
  const stairs = Array.from({ length: 250 }, (_, index) => {
    const common = { id: `grid-${index}`, x: 0.025 + (index % 25) * 0.039, y: 0.03 + Math.floor(index / 25) * 0.1,
      angle: (index % 8) * 45 };
    return index % 2 ? spiral({ ...common, radius: 0.05 }) : straight({ ...common, length: 0.12, width: 0.045 });
  });
  const room = [[[[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]]];
  const touching = stairFootprintsTouching(room, stairs);
  assert.ok(touching.length > 0 && touching.length < 50, `${touching.length} of 250 touch the room bounds`);
  const expected = unfilteredArea(room, stairs);
  const actual = geometryAreaMinusStairs(room, stairs);
  assert.ok(Math.abs(actual - expected) <= Math.max(expected, 1) * 1e-9, `${actual} vs ${expected}`);
});
