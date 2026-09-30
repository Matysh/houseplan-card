import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DeviceHitIndex, DevicePointerOwnerLatch, deviceHitScrollSources, deviceLayerMutated,
  observeDeviceHitGeometryScroll, pointInDeviceCapsule, resolveDeviceHitOwner,
} from '../test-build/device-hit-owner.js';

const candidate = (id, x, y, width = 12, height = 12, floorRadius = 22) => ({
  id,
  center: { x, y },
  painted: {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
  },
  floorRadius,
});

test('#564 a visible core wins the neighbour invisible 44px floor', () => {
  const left = candidate('left', 100, 100);
  const right = candidate('right', 112, 100);
  assert.equal(resolveDeviceHitOwner([right, left], { x: 100, y: 100 })?.id, 'left');
  assert.equal(resolveDeviceHitOwner([left, right], { x: 112, y: 100 })?.id, 'right');
});

test('#564 painted overlap and floor-only overlap use the nearest core', () => {
  const left = candidate('left', 100, 100, 16, 16);
  const right = candidate('right', 112, 100, 16, 16);
  assert.equal(resolveDeviceHitOwner([right, left], { x: 105, y: 100 })?.id, 'left');
  assert.equal(resolveDeviceHitOwner([left, right], { x: 107, y: 100 })?.id, 'right');

  const separatedLeft = candidate('left', 100, 100);
  const separatedRight = candidate('right', 130, 100);
  assert.equal(resolveDeviceHitOwner([separatedRight, separatedLeft], { x: 113, y: 100 })?.id, 'left');
  assert.equal(resolveDeviceHitOwner([separatedLeft, separatedRight], { x: 117, y: 100 })?.id, 'right');
});

test('#564 a capsule does not own invisible bbox corners', () => {
  const horizontal = candidate('pill', 100, 100, 40, 12);
  assert.equal(pointInDeviceCapsule({ x: 100, y: 100 }, horizontal.painted), true);
  assert.equal(pointInDeviceCapsule({ x: 119, y: 105 }, horizontal.painted), false);
  assert.equal(pointInDeviceCapsule({ x: 118, y: 100 }, horizontal.painted), true);
});

test('#564 tie-break is stable and independent of candidate/DOM order', () => {
  const a = candidate('a', 90, 100);
  const b = candidate('b', 110, 100);
  assert.equal(resolveDeviceHitOwner([b, a], { x: 100, y: 100 })?.id, 'a');
  assert.equal(resolveDeviceHitOwner([a, b], { x: 100, y: 100 })?.id, 'a');
  const sameA = candidate('a', 100, 100);
  const sameB = candidate('b', 100, 100);
  assert.equal(resolveDeviceHitOwner([sameB, sameA], { x: 100, y: 100 })?.id, 'a');
});

test('#564 spatial index resolves transformed screen coordinates locally', () => {
  const many = Array.from({ length: 200 }, (_, index) =>
    candidate(`d${String(index).padStart(3, '0')}`, 1000 + index * 60, 800));
  const target = candidate('target', 312.5, 487.25, 48, 16);
  const index = new DeviceHitIndex([...many, target]);
  assert.equal(index.resolve({ x: 330, y: 487.25 })?.id, 'target');
  assert.equal(index.resolve({ x: -500, y: -500 }), null);
});

test('#564 pointer owner is held through release and consumed by click', () => {
  const latch = new DevicePointerOwnerLatch();
  latch.begin(7, 'left');
  assert.equal(latch.owner(7), 'left');
  assert.equal(latch.release(7), 'left');
  assert.equal(latch.owner(7), null);
  assert.equal(latch.consumeClick(7), 'left');
  assert.equal(latch.consumeClick(7), null);

  latch.begin(8, 'right');
  assert.equal(latch.cancel(8), 'right');
  assert.equal(latch.release(8), null);
  latch.clear();
});

test('#613 scroll observation crosses shadow hosts and tears down exactly once', () => {
  const target = (fields = {}) => Object.assign(new EventTarget(), fields);
  const viewport = new EventTarget();
  const win = target({ visualViewport: viewport });
  const document = target({
    nodeType: 9, parentElement: null, ownerDocument: null, defaultView: win,
    getRootNode() { return this; },
  });
  const body = target({
    nodeType: 1, assignedSlot: null, parentElement: null, ownerDocument: document,
    getRootNode: () => document,
  });
  const dashboardScroller = target({
    nodeType: 1, assignedSlot: null, parentElement: body, ownerDocument: document,
    getRootNode: () => document,
  });
  const dashboardHost = target({
    nodeType: 1, assignedSlot: null, parentElement: dashboardScroller,
    ownerDocument: document, getRootNode: () => document,
  });
  const dashboardRoot = { nodeType: 11, host: dashboardHost };
  const shadowScroller = target({
    nodeType: 1, assignedSlot: null, parentElement: null, ownerDocument: document,
    getRootNode: () => dashboardRoot,
  });
  const card = target({
    nodeType: 1, assignedSlot: null, parentElement: shadowScroller,
    ownerDocument: document, getRootNode: () => dashboardRoot,
  });

  assert.deepEqual(deviceHitScrollSources(card), [
    card, shadowScroller, dashboardHost, dashboardScroller, body, document, win,
  ]);

  let invalidations = 0;
  const disconnect = observeDeviceHitGeometryScroll(card, () => { invalidations += 1; });
  shadowScroller.dispatchEvent(new Event('scroll'));
  dashboardScroller.dispatchEvent(new Event('scroll'));
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(invalidations, 3);

  disconnect();
  disconnect();
  shadowScroller.dispatchEvent(new Event('scroll'));
  dashboardScroller.dispatchEvent(new Event('scroll'));
  viewport.dispatchEvent(new Event('scroll'));
  assert.equal(invalidations, 3);

  const reconnect = observeDeviceHitGeometryScroll(card, () => { invalidations += 1; });
  dashboardScroller.dispatchEvent(new Event('scroll'));
  assert.equal(invalidations, 4);
  reconnect();
});

// #694: an instrumented element counts every selector query run against it.
// `device` answers `.devlayer, .devlayer *`; `holdsDevice` answers the subtree
// query for `.devlayer` below it.
const probeNode = (name, { device = false, holdsDevice = false } = {}) => ({
  name,
  nodeType: 1,
  queries: 0,
  matches(selector) {
    assert.equal(selector, '.devlayer, .devlayer *');
    this.queries += 1;
    return device;
  },
  querySelector(selector) {
    assert.equal(selector, '.devlayer');
    this.queries += 1;
    return holdsDevice ? {} : null;
  },
});
const record = (target, addedNodes = [], removedNodes = []) => ({ target, addedNodes, removedNodes });

test('#694 AC1 a batch into one subtree queries each node at most once', () => {
  const stage = probeNode('stage');
  const children = Array.from({ length: 40 }, (_, index) => probeNode(`child-${index}`));
  const text = { nodeType: 3, name: 'text' };
  const records = [
    ...children.map((child) => record(stage, [child])),
    ...children.map((child) => record(child)),
    record(stage, [text], [children[0]]),
  ];
  const synced = [];
  assert.equal(deviceLayerMutated(records, (node) => synced.push(node.name)), false);
  // matches + querySelector: one check is two queries, never more.
  assert.equal(stage.queries, 2, 'the shared record target is checked once per batch');
  for (const child of children) assert.equal(child.queries, 2, `${child.name} is checked once`);
  assert.deepEqual(synced, [...children.map((child) => child.name), 'text'],
    'every added node still reaches the pointer-hover sync, in record order');
});

test('#694 AC1 the first device-layer hit ends the queries, not the hover sync', () => {
  const stage = probeNode('stage');
  const devlayer = probeNode('devlayer', { device: true });
  const later = Array.from({ length: 12 }, (_, index) => probeNode(`later-${index}`));
  const added = later.map((_, index) => probeNode(`added-${index}`));
  const records = [
    record(stage),
    record(devlayer),
    ...later.map((target, index) => record(target, [added[index]], [probeNode('gone')])),
  ];
  const synced = [];
  assert.equal(deviceLayerMutated(records, (node) => synced.push(node.name)), true);
  assert.equal(stage.queries, 2);
  assert.equal(devlayer.queries, 1, 'a match needs no subtree query');
  for (const node of [...later, ...added]) {
    assert.equal(node.queries, 0, `${node.name} is not queried after the first hit`);
  }
  assert.deepEqual(synced, added.map((node) => node.name),
    'added nodes after the hit still reach the pointer-hover sync');
});

test('#694 AC1 a device layer is still found in targets, added and removed nodes', () => {
  const plain = () => probeNode('plain');
  const none = () => {};
  assert.equal(deviceLayerMutated([record(plain(), [plain()], [plain()])], none), false);
  assert.equal(deviceLayerMutated([record(plain()), record(probeNode('dev', { device: true }))], none), true);
  assert.equal(deviceLayerMutated([record(plain(), [probeNode('floor', { holdsDevice: true })])], none), true);
  assert.equal(deviceLayerMutated([record(plain(), [], [probeNode('old', { holdsDevice: true })])], none), true);
  assert.equal(deviceLayerMutated([record({ nodeType: 3 }, [{ nodeType: 3 }])], none), false);
});
