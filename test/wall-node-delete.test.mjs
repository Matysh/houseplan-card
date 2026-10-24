import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyNodeDelete } from '../test-build/wall-node-delete.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { buildNodePreview } from '../test-build/wall-node-preview.js';
import { increasedViolations, junctionLimitViolations } from '../test-build/junction-limits.js';
const cases = JSON.parse(readFileSync(new URL('./fixtures/1045-wall-node-delete.json', import.meta.url)));

test('#1045 shared ordinary deletion/refusal fixtures preserve the frozen source and every physical field', () => {
  for (const item of cases) {
    const before = structuredClone(item.space), result = applyNodeDelete(item.space, { point: item.point });
    assert.deepEqual(item.space, before, item.name + ': immutable');
    assert.equal(result.ok, item.ok, item.name);
    if (!result.ok) { assert.equal(result.reason, item.reason, item.name); continue; }
    assert.equal(result.retained, 'a', item.name);
    assert.equal(result.removed, 'b', item.name);
    assert.equal(result.space.partitions.length, 1, item.name);
    assert.deepEqual([result.space.partitions[0].a, result.space.partitions[0].b], item.span, item.name);
    assert.deepEqual(result.space.partitions[0].future, before.partitions.find(w => w.id === 'a').future);
    if (item.hostT) {
      assert.deepEqual(result.space.openings[0], { ...before.openings[0], host: { ...before.openings[0].host, id: 'a', t: item.hostT } });
    }
    const cfg = commitWallSegmentModel({ model_version: 10, spaces: [result.space] }).config;
    assert.equal(buildNodePreview(cfg.spaces[0]).safe, true, item.name + ': actual physical geometry');
    assert.deepEqual(increasedViolations(junctionLimitViolations(cfg, 'f'), junctionLimitViolations({ spaces: [before] }, 'f')), []);
    if (result.space.partitions[0].future) {
      result.space.partitions[0].future.a = 'changed after return';
      assert.deepEqual(item.space, before, item.name + ': returned nested attributes never alias the before snapshot');
    }
  }
});

test('#1045 room corner, collinear breakpoint and two coincident owners use all canonical rings', () => {
  for (const rooms of [
    [{ id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]], area_id: 'area', future: { keep: true } }],
    [{ id: 'r', poly: [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1]] }],
    [{ id: 'r', poly: [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1]] },
      { id: 's', poly: [[2, 0], [1, 0], [0, 0], [0, -1], [2, -1]], area_id: 'other' }],
  ]) {
    const cfg = commitWallSegmentModel({ spaces: [{ id: 'f', rooms, cell_cm: 5 }], markers: [{ id: 'kept' }], settings: {} }).config;
    const source = cfg.spaces[0], frozen = structuredClone(cfg), result = applyNodeDelete(source, { point: [1, 0] });
    assert.equal(result.ok, true);
    assert.deepEqual(cfg, frozen);
    const next = commitWallSegmentModel({ ...cfg, spaces: [result.space] }).config;
    assert.equal(next.spaces[0].wall_segments.length, source.wall_segments.length - 1);
    for (const [i, room] of next.spaces[0].rooms.entries()) {
      assert.equal(room.poly.length, source.rooms[i].poly.length - 1);
      assert.equal(room.wall_ids.length, room.poly.length);
      assert.deepEqual({ ...room, poly: [], wall_ids: [] }, { ...source.rooms[i], poly: [], wall_ids: [] });
      assert.equal(room.poly.some(p => p[0] === 1 && p[1] === 0), false);
    }
    assert.deepEqual(next.markers, cfg.markers);
    assert.equal(buildNodePreview(next.spaces[0]).safe, true);
    assert.deepEqual(increasedViolations(junctionLimitViolations(next, 'f'), junctionLimitViolations(cfg, 'f')), []);
  }
});

test('#1045 structural neighbours, ownership, finite coordinates and full attributes are fail closed', () => {
  const base = structuredClone(cases[0].space);
  for (const point of [[NaN, 0], [Infinity, 0], [5001, 0], [true, 0], [1], null])
    assert.equal(applyNodeDelete(base, { point }).ok, false);
  assert.equal(applyNodeDelete(base, { point: [1, 0], candidate: base }).ok, false);
  const crossing = structuredClone(base);
  crossing.partitions.push({ id: 'x', a: [.5, -.5], b: [.5, .5], cm: 0 });
  assert.equal(applyNodeDelete(crossing, { point: [1, 0] }).ok, false, 'do not erase a nearer structural junction');
  for (const future of [null, [], {}, 'different', false]) {
    const source = structuredClone(base); source.partitions[0].future = future;
    assert.equal(applyNodeDelete(source, { point: [1, 0] }).ok, false);
  }
  const room = commitWallSegmentModel({ spaces: [{ id: 'f', rooms: [{ id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] }] }).config.spaces[0];
  room.rooms[0].wall_ids[1] = 'forged';
  assert.equal(applyNodeDelete(room, { point: [1, 0] }).ok, false);
  for (const [poly, point] of [
    [[[0, 0], [1, 0], [0, 1]], [1, 0]],
    [[[0, 0], [2, 0], [2, 2], [1, 1], [0, 2]], [2, 0]],
  ]) {
    const source = commitWallSegmentModel({ spaces: [{ id: 'f', rooms: [{ id: 'r', poly }] }] }).config.spaces[0];
    const before = structuredClone(source);
    assert.equal(applyNodeDelete(source, { point }).ok, false, 'collapsed/self-touching candidate is never adopted');
    assert.deepEqual(source, before);
  }
});
