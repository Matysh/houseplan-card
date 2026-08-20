import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAB_DRAG_THRESHOLD_PX, applySpaceOrder, canStartTabDrag, markersNeedingPlacement,
  passedDragThreshold, reorderSpaceIds,
} from '../test-build/space-order.js';

const ctx = (over = {}) => ({
  canEdit: true, kiosk: false, mode: 'plan', pointerType: 'mouse',
  spaceCount: 3, fixedFloor: false, ...over,
});

// --- AC5: где перетаскивание вообще включается -------------------------------

test('issue 220 tab drag is available to an editor with a mouse', () => {
  assert.equal(canStartTabDrag(ctx()), true);
  assert.equal(canStartTabDrag(ctx({ mode: 'devices' })), true);
  assert.equal(canStartTabDrag(ctx({ mode: 'decor' })), true);
});

test('issue 220 tab drag is not exposed to touch, View, kiosk or a fixed floor', () => {
  // Touch is excluded by product decision, not by omission: the same tabs
  // switch spaces in View, where a tap must stay a tap.
  assert.equal(canStartTabDrag(ctx({ pointerType: 'touch' })), false);
  assert.equal(canStartTabDrag(ctx({ pointerType: 'pen' })), false);
  assert.equal(canStartTabDrag(ctx({ mode: 'view' })), false);
  assert.equal(canStartTabDrag(ctx({ kiosk: true })), false);
  assert.equal(canStartTabDrag(ctx({ canEdit: false })), false);
  assert.equal(canStartTabDrag(ctx({ fixedFloor: true })), false);
  assert.equal(canStartTabDrag(ctx({ spaceCount: 1 })), false);
});

test('issue 220 a click stays a click until the pointer really travels', () => {
  assert.equal(passedDragThreshold(0, 0), false);
  assert.equal(passedDragThreshold(TAB_DRAG_THRESHOLD_PX - 1, 0), false);
  assert.equal(passedDragThreshold(TAB_DRAG_THRESHOLD_PX, 0), true);
  assert.equal(passedDragThreshold(0, TAB_DRAG_THRESHOLD_PX), true);
});

// --- AC1: сама перестановка --------------------------------------------------

test('issue 220 a tab lands where it was dropped and the rest keep their order', () => {
  assert.deepEqual(reorderSpaceIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(reorderSpaceIds(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a']);
  assert.deepEqual(reorderSpaceIds(['a', 'b', 'c'], 'b', 'b'), ['a', 'b', 'c']);
  assert.deepEqual(reorderSpaceIds(['a', 'b', 'c'], 'b', 'zz'), ['a', 'b', 'c']);
});

test('issue 220 stored spaces follow the new order', () => {
  const spaces = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(applySpaceOrder(spaces, ['c', 'a', 'b']).map((s) => s.id), ['c', 'a', 'b']);
  // an id the order does not mention keeps its tail position instead of moving
  assert.deepEqual(
    applySpaceOrder([...spaces, { id: 'd' }], ['c', 'a', 'b']).map((s) => s.id),
    ['c', 'a', 'b', 'd'],
  );
});

// --- AC3: маркеры не двигаются ----------------------------------------------

test('issue 220 only order-dependent markers are pinned, and to where they are now', () => {
  const markers = [
    { id: 'dangling' },                                   // no space, no area
    { id: 'by-area', area: 'kitchen' },                   // area names a space
    { id: 'explicit', space: 'f2' },                      // already explicit
    { id: 'area-unknown', area: 'nowhere' },              // area names nothing
    { id: 'gone', removed: true },                        // tombstone
  ];
  const pinned = markersNeedingPlacement(markers, { kitchen: 'f1' }, 'f1');
  assert.deepEqual(pinned, [
    { id: 'dangling', space: 'f1' },
    { id: 'area-unknown', space: 'f1' },
  ]);
});

test('issue 220 pinning writes the space the marker has before the reorder', () => {
  // The fallback is the FIRST space of the current order. If the write used
  // the order after the move, the marker would follow the reorder — the very
  // thing this pinning exists to prevent.
  const markers = [{ id: 'dangling' }];
  assert.deepEqual(markersNeedingPlacement(markers, {}, 'garden'), [
    { id: 'dangling', space: 'garden' },
  ]);
  assert.deepEqual(markersNeedingPlacement(markers, {}, ''), []);
});
