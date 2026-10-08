import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { union, difference } from 'polyclip-ts';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
import { buildNodePreview } from '../test-build/wall-node-preview.js';
import { canonicalizeConfigGeometryInPlace } from '../test-build/coordinate-canonicalization.js';
import { canonicalComputedWallGeometry, unionWallShellGeometry } from '../test-build/wall-shell-union.js';
import { geometryArea, pointInPhysicalGeometry } from '../test-build/physical-geometry.js';
import { wallKey } from '../test-build/wall-thickness.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/834-node-connected.json', import.meta.url), 'utf8'));
const point = [-401 / 240, 928 / 240];
const planFor = space => {
  const nodes = structuralWallNodes(space);
  const node = nodes.find(n => Math.hypot(n.point[0] - point[0], n.point[1] - point[1]) < 1e-9);
  assert.ok(node?.supported);
  return prepareNodeMove(space, node, nodes);
};
const move = (plan, tick) => {
  const result = applyNodeMove(plan, [point[0], (928 + tick) / 240], null);
  assert.equal(result.ok, true, `structural delta at step ${tick}`);
  canonicalizeConfigGeometryInPlace({ spaces: [result.space] });
  return result.space;
};

test('#834 connected floor: all 100 legal adjacent positions build complete masonry', () => {
  const before = structuredClone(fixture.spaces[0]), frozen = JSON.stringify(before), plan = planFor(before);
  assert.deepEqual([before.rooms.length, before.wall_segments.length, before.openings.length], [8, 30, 14]);
  assert.equal(buildNodePreview(before).geometry.status, 'ok');
  for (let tick = 1; tick <= 100; tick++) {
    const candidate = move(plan, tick), preview = buildNodePreview(candidate);
    assert.equal(preview.geometry.status, 'ok', `step ${tick}; beta.9 refused 5/6/54..59 and other neighbours`);
    assert.equal(preview.geometry.degradedExtraCount, 0);
    assert.equal(preview.safe, true);
    // Independent spatial oracles: floors stay holes and the unchanged left
    // wall remains masonry. Rendering a filled polygon is not a valid repair.
    assert.equal(pointInPhysicalGeometry([-1000, 3500], preview.geometry.geom), false, 'room 7 floor');
    assert.equal(pointInPhysicalGeometry([400, 3500], preview.geometry.geom), false, 'room 8 floor');
    assert.equal(pointInPhysicalGeometry([-1670, 3500], preview.geometry.geom), true, 'room 7 left masonry');
    for (const opening of preview.input.openings) {
      assert.equal(pointInPhysicalGeometry([opening.rx, opening.ry], preview.geometry.geom), false,
        `${opening.id} keeps its physical cut`);
    }
  }
  assert.equal(JSON.stringify(before), frozen, 'neither retries nor candidates edit the frozen source');
});

test('#834 reduced two-room witness needs neither openings nor device state', () => {
  const whole = fixture.spaces[0], rooms = structuredClone([whole.rooms[6], whole.rooms[7]]);
  const ids = new Set(rooms.flatMap(room => room.wall_ids));
  const wall_segments = structuredClone(whole.wall_segments.filter(wall => ids.has(wall.id)));
  const before = { id: 'two-rooms', cell_cm: 1, rooms, wall_segments,
    walls: wall_segments.map(wall => ({ a: wall.a, b: wall.b, cm: wall.cm, key: wallKey(wall.a, wall.b, 1 / 240) })),
    openings: [] };
  assert.equal(wall_segments.length, 9);
  const plan = planFor(before);
  for (const tick of [4, 5, 6, 7, 53, 54, 55, 59, 60]) {
    const preview = buildNodePreview(move(plan, tick));
    assert.equal(preview.geometry.status, 'ok', `two-room step ${tick}`);
    assert.equal(pointInPhysicalGeometry([-1000, 3500], preview.geometry.geom), false);
    assert.equal(pointInPhysicalGeometry([400, 3500], preview.geometry.geom), false);
  }
  assert.deepEqual(applyNodeMove(plan, [-85 / 240, 928 / 240], null), { ok: false, reason: 'invalid' },
    'collapsing the lower wall still fails before boolean construction');
});

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
test('#834 canonical computed operands preserve holes, components and exact healthy unions', () => {
  const body = union(difference(rect(0, 0, 10, 10), rect(2, 2, 6, 6)), rect(20, 0, 2, 2));
  const shell = difference(rect(-1, -1, 12, 12), rect(0, 0, 10, 10));
  const frozen = structuredClone([body, shell]);
  assert.deepEqual(unionWallShellGeometry(body, shell, 1000), union(body, shell), 'healthy path stays exact');
  let attempts = 0;
  const retried = unionWallShellGeometry(body, shell, 1000, (...operands) => {
    if (++attempts === 1) throw new Error('simulated clipping failure');
    return union(...operands);
  });
  assert.equal(attempts, 2, 'only one retry');
  assert.equal(pointInPhysicalGeometry([5, 5], retried), false, 'the recovered union keeps the floor hole');
  assert.equal(pointInPhysicalGeometry([21, 1], retried), true, 'the recovered union keeps the independent component');
  assert.ok(Math.abs(geometryArea(retried) - geometryArea(union(body, shell))) < 1e-9);
  for (const scale of [1, 1000]) {
    const canonical = canonicalComputedWallGeometry(body, scale);
    assert.deepEqual(canonical.map(polygon => polygon.length), body.map(polygon => polygon.length));
    assert.equal(pointInPhysicalGeometry([5, 5], canonical), false);
    assert.equal(pointInPhysicalGeometry([21, 1], canonical), true);
    assert.ok(Math.abs(geometryArea(canonical) - 68) < 1e-9);
  }
  assert.deepEqual([body, shell], frozen);
});

test('#834 retry refuses disappearing holes, merged components, invalid rings and non-finite data', () => {
  const quantum = 1e-6;
  const tinyHole = [[...rect(0, 0, 1, 1), ...rect(.1, .1, quantum / 4, quantum / 4)]];
  assert.throws(() => canonicalComputedWallGeometry(tinyHole, 1000), /collapsed boolean ring/);
  const tinyGap = [...rect(0, 0, 1, 1), ...rect(1 + quantum / 4, 0, 1, 1)].map(ring => [ring]);
  assert.throws(() => canonicalComputedWallGeometry(tinyGap, 1000), /changed boolean topology/);
  assert.throws(() => canonicalComputedWallGeometry([[[[0, 0], [1, 0], [1, 1], [0, 1]]]], 1000), /open boolean ring/);
  assert.throws(() => canonicalComputedWallGeometry([[[[0, 0], [1, 0], [Infinity, 1], [0, 0]]]], 1000), /non-finite/);
  assert.throws(() => canonicalComputedWallGeometry([rect(0, 0, 1, 1)], Number.MIN_VALUE), /invalid boolean scale/);
  assert.throws(() => canonicalComputedWallGeometry([rect(0, 0, 1, 1)], 1e-300), /non-finite canonical/);
  assert.throws(() => canonicalComputedWallGeometry([[[[0, 0], [1, 0, 2], [1, 1], [0, 0]]]], 1000), /invalid boolean point/);
  const failure = new Error('clipping cannot build this geometry');
  let attempts = 0;
  assert.throws(() => unionWallShellGeometry([rect(0, 0, 1, 1)], [rect(2, 0, 1, 1)], 1000,
    () => { attempts++; throw failure; }), error => error === failure,
  'a failed retry remains the original failure, never an accepted empty body');
  assert.equal(attempts, 2);
});

test('#834 retry cannot erase certified separation between different operands', () => {
  const quantum = 1e-6, body = [rect(0, 0, 1, 1)], failure = new Error('original clipping failure');
  const nearby = [rect(1 + quantum / 4, 0, 1, 1)], frozen = structuredClone([body, nearby]);
  assert.equal(union(body, nearby).length, 2, 'independent exact oracle: the original components are disjoint');
  let attempts = 0;
  assert.throws(() => unionWallShellGeometry(body, nearby, 1000, (...operands) => {
    if (++attempts === 1) throw failure;
    return union(...operands);
  }), error => error === failure, 'lost certified separation retains the original failure');
  assert.equal(attempts, 1, 'the unproved repair never reaches a second merge');
  assert.deepEqual([body, nearby], frozen);
  for (const [x, components] of [[1 + quantum * 3, 2], [.5, 1]]) {
    attempts = 0;
    const repaired = unionWallShellGeometry(body, [rect(x, 0, 1, 1)], 1000, (...operands) => {
      if (++attempts === 1) throw failure;
      return union(...operands);
    });
    assert.equal(attempts, 2);
    assert.equal(repaired.length, components, 'a retained gap or genuine overlap keeps the expected connectivity');
  }
});
