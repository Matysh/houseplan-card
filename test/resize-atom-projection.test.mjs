import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareResizeAtomProjection as prepare, applyResizeAtomProjection as apply,
  projectResizeAtomCatalogue as atoms, projectResizeAtomConsumers as consumers,
  prepareResizeAtomContext as context } from '../test-build/resize-atom-projection.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { checkSpacePhysicalGeometry } from '../test-build/plan-geometry-preflight.js';
import { junctionLimitViolations, increasedViolations } from '../test-build/junction-limits.js';

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const contour = [[0, 0], [10, 0], [10, 10], [0, 10]];
const stored = [[0, 0], [4, 0], [10, 0], [10, 3], [10, 7], [10, 10], [5, 10], [0, 10]];
const target = [[0, 0], [12, 0], [12, 10], [0, 10]];
const expected = [[0, 0], [4, 0], [12, 0], [12, 3], [12, 7], [12, 10], [5, 10], [0, 10]];

test('#832 projection preserves structural order and fixed/translated breakpoints', () => {
  const source = freeze(structuredClone(stored)), shape = freeze(structuredClone(contour));
  const projection = freeze(prepare(source, shape, 1e-9));
  assert.ok(projection);
  assert.deepEqual(apply(projection, freeze(structuredClone(target))), expected);
  assert.deepEqual(apply(projection, shape), stored, 'no-op does not simplify atoms');
  assert.deepEqual(apply(projection, target), expected, 'repeat has no accumulated mutation');
  assert.deepEqual(source, stored); assert.deepEqual(shape, contour);
});

test('#832 ring start and reversed physical orientation preserve correspondence', () => {
  for (const reverse of [false, true]) for (let start = 0; start < stored.length; start++) {
    const old = reverse ? [...stored].reverse() : [...stored];
    const shape = reverse ? [...contour].reverse() : contour;
    const next = reverse ? [...target].reverse() : target;
    const want = reverse ? [...expected].reverse() : expected;
    const rotate = x => [...x.slice(start), ...x.slice(0, start)];
    const projection = prepare(rotate(old), shape, 1e-9);
    assert.ok(projection); assert.deepEqual(apply(projection, next), rotate(want));
  }
});

test('#832 missing/ambiguous/noncollinear/reversed source and crossed breakpoint refuse', () => {
  assert.equal(prepare(stored, [[1, 0], ...contour.slice(1)], 1e-9), null);
  assert.equal(prepare([...stored, stored[0]], contour, 1e-9), null);
  assert.equal(prepare(stored, [...contour].reverse(), 1e-9), null);
  const bent = structuredClone(stored); bent[1][1] = 0.01;
  assert.equal(prepare(bent, contour, 1e-9), null);
  const p = prepare(stored, contour, 1e-9);
  assert.equal(apply(p, [[0, 0], [3, 0], [3, 10], [0, 10]]), null, 'fixed breakpoint cannot be crossed');
  assert.equal(apply(p, contour.slice(1)), null);
  const nonfinite = structuredClone(target); nonfinite[0][0] = NaN;
  assert.equal(apply(p, nonfinite), null);
});

const ownersFixture = (cm = 20) => {
  const poly = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];
  const ids = ['left', 'right', 'outer-right', 'bottom', 'outer-left'];
  const catalog = new Map(ids.map((id, i) => [id, { a: poly[i], b: poly[(i + 1) % poly.length], cm }]));
  const updates = new Map([['left', { a: [0, 0], b: [6, 0] }], ['right', { a: [6, 0], b: [10, 0] }]]);
  return { room: { id: 'fixed', poly, wall_ids: ids }, catalog, updates };
};
const sharedFixture = () => {
  const left = { id: 'left', poly: structuredClone(stored), wall_ids: [] };
  const right = { id: 'right', poly: [[10, 0], [20, 0], [20, 10], [10, 10], [10, 7], [10, 3]], wall_ids: [] };
  const catalogue = new Map();
  for (const room of [left, right]) for (let i = 0; i < room.poly.length; i++) {
    const a = room.poly[i], b = room.poly[(i + 1) % room.poly.length];
    const key = [JSON.stringify(a), JSON.stringify(b)].sort().join(':');
    if (!catalogue.has(key)) catalogue.set(key, { a, b, cm: i % 2 ? 0 : 20 });
    room.wall_ids.push(key);
  }
  return { rooms: [left, right], catalogue, targets: new Map([
    ['left', structuredClone(expected)], ['right', right.poly.map(p => [p[0] === 10 ? 12 : p[0], p[1]])],
  ]) };
};
test('#832 both shared owners agree by original atom identity and opposite orientation', () => {
  const { rooms, catalogue, targets } = sharedFixture(); freeze(rooms);
  const before = JSON.stringify([...catalogue]), result = atoms(rooms, targets, catalogue, 1e-9);
  assert.ok(result); assert.equal(result.size, catalogue.size);
  for (const room of rooms) for (let i = 0; i < room.poly.length; i++) {
    const id = room.wall_ids[i], old = catalogue.get(id), next = result.get(id), target = targets.get(room.id);
    const forward = JSON.stringify(old.a) === JSON.stringify(room.poly[i]);
    assert.deepEqual(forward ? next.a : next.b, target[i]);
    assert.deepEqual(forward ? next.b : next.a, target[(i + 1) % target.length]);
    assert.equal(catalogue.get(id).cm, old.cm, 'zero/mixed thickness is untouched');
  }
  assert.equal(JSON.stringify([...catalogue]), before); assert.deepEqual(rooms[0].poly, stored);
});
test('#832 atom catalogue rejects conflicting owners and missing/misaligned identity', () => {
  const { rooms, catalogue, targets } = sharedFixture();
  const conflicting = new Map(targets); conflicting.set('right', targets.get('right').map(p => [p[0] + 1, p[1]]));
  assert.equal(atoms(rooms, conflicting, catalogue, 1e-9), null, 'shared atom cannot have two proposals');
  assert.equal(atoms([{ ...rooms[0], wall_ids: rooms[0].wall_ids.slice(1) }], targets, catalogue, 1e-9), null);
  const missing = new Map(catalogue); missing.delete(rooms[0].wall_ids[0]);
  assert.equal(atoms(rooms, targets, missing, 1e-9), null);
  const swapped = { ...rooms[0], wall_ids: [...rooms[0].wall_ids].reverse() };
  assert.equal(atoms([swapped], targets, catalogue, 1e-9), null, 'never positional fallback');
});
test('#832 consumer sync changes only a derived collinear node, including cm zero', () => {
  for (const cm of [0, 20]) for (const reverse of [false, true]) {
    const { room, catalog, updates } = ownersFixture(cm);
    if (reverse) for (const [id, item] of catalog) {
      catalog.set(id, { a: item.b, b: item.a, cm });
      if (updates.has(id)) { const u = updates.get(id); updates.set(id, { a: u.b, b: u.a }); }
    }
    const before = JSON.stringify(room), result = consumers([freeze(room)], catalog, updates, new Set(), 1e-9);
    assert.ok(result); assert.deepEqual(result.get('fixed'), [[0, 0], [6, 0], [10, 0], [10, 10], [0, 10]]);
    assert.equal(JSON.stringify(room), before);
    assert.deepEqual(consumers([room], catalog, new Map(), new Set(), 1e-9), new Map(), 'unrelated owner has no update');
  }
});

test('#832 consumers reject authored corners, thickness boundaries and inconsistent IDs', () => {
  const { room, catalog, updates } = ownersFixture();
  const inconsistent = new Map(updates); inconsistent.delete('right');
  assert.equal(consumers([room], catalog, inconsistent, new Set(), 1e-9), null);
  const missing = new Map(catalog); missing.delete('left');
  assert.equal(consumers([room], missing, updates, new Set(), 1e-9), null);
  assert.equal(consumers([{ ...room, wall_ids: room.wall_ids.slice(1) }], catalog, updates, new Set(), 1e-9), null);
  const mixed = new Map(catalog); mixed.set('left', { ...mixed.get('left'), cm: 30 });
  assert.equal(consumers([room], mixed, updates, new Set(), 1e-9), null, 'physical thickness breakpoint is immutable');
  const cornerMove = new Map([['left', { a: [-1, 0], b: [5, 0] }], ['outer-left', { a: [0, 10], b: [-1, 0] }]]);
  assert.equal(consumers([room], catalog, cornerMove, new Set(), 1e-9), null, 'third-room corner cannot join Resize');
  const outside = new Map([['left', { a: [0, 0], b: [11, 0] }], ['right', { a: [11, 0], b: [10, 0] }]]);
  assert.equal(consumers([room], catalog, outside, new Set(), 1e-9), null);
});

test('#832 gesture index copies only changed-ID consumers and rejects duplicate catalogue IDs', () => {
  const { room, catalog } = ownersFixture();
  const rooms = [room, { ...structuredClone(room), id: 'same-ids' },
    { ...structuredClone(room), id: 'unrelated', wall_ids: room.wall_ids.map(id => `other-${id}`) }];
  const segments = [...catalog].map(([id, s]) => ({ id, ...s }));
  const c = context(rooms, segments, ['fixed']);
  assert.ok(c); assert.deepEqual(c.consumers.map(r => r.id), ['fixed', 'same-ids']);
  assert.equal(c.rooms.size, 0); assert.equal(c.catalogue.size, segments.length);
  const saved = structuredClone(c.consumers);
  room.poly[0][0] = 100; segments[0].b[0] = 200;
  assert.deepEqual(c.consumers, saved); assert.deepEqual(c.catalogue.get('left').a, [0, 0]);
  assert.deepEqual(c.catalogue.get('left').b, [5, 0], 'catalogue points are frozen copies, not source references');
  assert.equal(context(rooms, [...segments, segments[0]], ['fixed']), null);
  assert.deepEqual(context(rooms, [], []), { rooms: new Map(), catalogue: new Map(), consumers: [] }, 'legacy no-catalog path');
});

test('#832 coherent atom candidate passes full final proof; stale consumer adds a short seam', () => {
  const baseline = commitWallSegmentModel({ spaces: [{ id: 'proof', cell_cm: 1, rooms: [
    { id: 'left', poly: [[0, 0], [.5, 0], [.5, 1], [0, 1]] },
    { id: 'right', poly: [[.5, 0], [1, 0], [1, 1], [.5, 1]] },
    { id: 'fixed', poly: [[0, 1], [1, 1], [1, 2], [0, 2]], extension: { untouched: true } },
  ] }] }).config;
  const source = baseline.spaces[0], catalogue = new Map(source.wall_segments.map(s => [s.id, s]));
  const dx = 2 / 240, shift = p => [p[0] === .5 ? p[0] + dx : p[0], p[1]];
  const targets = new Map(source.rooms.filter(r => r.id !== 'fixed').map(r => [r.id, r.poly.map(shift)]));
  const updates = atoms(freeze(structuredClone(source.rooms)), targets, catalogue, 1e-9);
  assert.ok(updates);
  const candidate = structuredClone(baseline), space = candidate.spaces[0];
  space.wall_segments.forEach(s => { if (updates.has(s.id)) Object.assign(s, updates.get(s.id)); });
  space.rooms.forEach(r => { if (targets.has(r.id)) r.poly = targets.get(r.id); });
  const limits = config => junctionLimitViolations(config, 'proof', config.spaces[0].wall_segments);
  const stale = commitWallSegmentModel(candidate).config;
  assert.ok(increasedViolations(limits(stale), limits(baseline)).some(v => v.rule === 'distance'));
  const ownerPolys = consumers(source.rooms, catalogue, updates, new Set(['left', 'right']), 1e-9);
  assert.ok(ownerPolys);
  space.rooms.forEach(r => { if (ownerPolys.has(r.id)) r.poly = ownerPolys.get(r.id); });
  // Independent expected contour: only the original x=.5 seam translates.
  assert.deepEqual(space.rooms.map(r => r.poly), source.rooms.map(r => r.poly.map(shift)));
  const committed = commitWallSegmentModel(candidate).config;
  assert.equal(checkSpacePhysicalGeometry(baseline, 'proof').ok, true);
  assert.equal(checkSpacePhysicalGeometry(candidate, 'proof').ok, true);
  assert.equal(checkSpacePhysicalGeometry(committed, 'proof').ok, true);
  assert.deepEqual(increasedViolations(limits(committed), limits(baseline)), []);
  assert.deepEqual(committed.spaces[0].wall_segments.map(s => [s.id, s.cm]), source.wall_segments.map(s => [s.id, s.cm]));
  assert.deepEqual(committed.spaces[0].rooms.find(r => r.id === 'fixed').extension, { untouched: true });
});
