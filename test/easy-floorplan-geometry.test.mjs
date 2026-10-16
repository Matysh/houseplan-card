import assert from 'node:assert/strict';
import test from 'node:test';
import { makeIds, readFloorGeometry, frameForEasy, projectFloorGeometry } from '../scripts/sh3d-convert/easy-geometry.mjs';
import { modernDocument } from '../scripts/sh3d-convert/output.mjs';

const wall = (id, x1, y1, x2, y2, thickness = 8) => ({ id, x1, y1, x2, y2, thickness });
const room = (id, x1, y1, x2, y2) => ({ id, name: id,
  points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }] });
const prepare = floor => {
  const ids = makeIds('test'), notes = [];
  const geometry = readFloorGeometry(floor, { ids, cmPerUnit: 1, notes });
  const frame = frameForEasy({}, [floor], [geometry], 1);
  const projected = projectFloorGeometry(geometry, frame, ids);
  const space = { id: 'test', title: 'Test', cell_cm: frame.cellCm,
    rooms: projected.rooms.map(r => ({ id: r.id, name: r.source.name, poly: r.poly })),
    walls: projected.walls, partitions: projected.partitions };
  return { ...modernDocument(space), geometry, frame, notes };
};

test('#937 AC2 explicit T-junction: wall end meets the MIDDLE of another source wall', () => {
  const floor = { areas: [room('left', 0, 0, 5, 5), room('right', 5, 0, 10, 5)], walls: [
    wall('top', 0, 0, 10, 0), wall('bottom', 0, 5, 10, 5),
    wall('left', 0, 0, 0, 5), wall('right', 10, 0, 10, 5), wall('middle', 5, 0, 5, 5),
  ] };
  const result = prepare(floor), space = result.document.payload.config.spaces[0];
  assert.equal(result.geometry.walls.length, 7, 'top and bottom split at actual T junctions');
  assert.equal(space.wall_segments.length, 7);
  const t = result.frame.point([5, 0]);
  const close = p => Math.hypot(p[0] - t[0], p[1] - t[1]) < 1e-8;
  assert.equal(space.wall_segments.filter(s => close(s.a) || close(s.b)).length, 3);
  const owners = new Map(space.wall_segments.map(s => [s.id, 0]));
  for (const r of space.rooms) {
    assert.equal(r.wall_ids.length, r.poly.length);
    for (const id of r.wall_ids) owners.set(id, owners.get(id) + 1);
  }
  assert.equal([...owners.values()].filter(n => n === 2).length, 1, 'one shared middle carrier');
  assert.ok([...owners.values()].every(n => n === 1 || n === 2));
  assert.equal(space.partitions?.length ?? 0, 0, 'no doubled contour masonry');
});

test('#937 source T topology also survives in a wall-only floor without fictitious rooms', () => {
  const result = prepare({ walls: [wall('top', 0, 0, 10, 0), wall('stem', 5, 0, 5, 5)] });
  const space = result.document.payload.config.spaces[0];
  assert.equal(space.rooms.length, 0);
  assert.equal(space.wall_segments.length, 0);
  assert.equal(space.partitions.length, 3);
  const t = result.frame.point([5, 0]);
  assert.equal(space.partitions.filter(p => [p.a, p.b].some(v => Math.hypot(v[0] - t[0], v[1] - t[1]) < 1e-8)).length, 3);
});

test('#937 a partly contour-covered wall keeps both independent remainders; empty boundaries stay zero', () => {
  const result = prepare({ areas: [room('room', 2, 0, 8, 5)], walls: [wall('long', 0, 0, 10, 0)] });
  const space = result.document.payload.config.spaces[0];
  assert.equal(space.partitions.length, 2);
  assert.equal(space.wall_segments.filter(s => s.cm > 0).length, 1);
  assert.equal(space.wall_segments.filter(s => s.cm === 0).length, 3);
  const total = [...space.partitions, ...space.wall_segments.filter(s => s.cm > 0)]
    .reduce((sum, s) => sum + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), 0);
  assert.ok(Math.abs(total - 10 * result.frame.scale) < 1e-8);
});

test('#937 rectangle sideWalls materialize once, conflicting overlays and crossed polygons refuse', () => {
  const r = { ...room('room', 0, 0, 10, 5), sideWalls: { top: 'wall', right: 'divider' } };
  const result = prepare({ areas: [r], walls: [wall('same-top', 0, 0, 10, 0)] });
  assert.equal(result.document.payload.config.spaces[0].wall_segments.filter(s => s.cm > 0).length, 1);
  assert.throws(() => prepare({ walls: [wall('a', 0, 0, 10, 0, 8), wall('b', 5, 0, 12, 0, 4)] }), /b/);
  assert.throws(() => prepare({ areas: [{ id: 'crossed', points: [
    { x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 5, y: 0 },
  ] }] }));
});

test('#937 shared frame preserves floor offsets and XY proportions, and includes furniture outside rooms', () => {
  const floors = [{ areas: [room('a', 0, 0, 10, 5)] },
    { areas: [room('b', 100, 0, 110, 5)], furniture: [{ id: 'sofa', x: 120, y: 10, w: 10, h: 4, angle: 90 }] }];
  const geometry = floors.map((f, i) => readFloorGeometry(f, { ids: makeIds(`f${i}`), cmPerUnit: 1, notes: [] }));
  const frame = frameForEasy({}, floors, geometry, 1);
  const a = frame.point([0, 0]), b = frame.point([100, 0]);
  assert.ok(Math.abs((b[0] - a[0]) - 100 * frame.scale) < 1e-8);
  const p = geometry[0].rooms[0].poly.map(frame.point);
  assert.ok(Math.abs((p[1][0] - p[0][0]) / (p[2][1] - p[1][1]) - 2) < 1e-7);
  assert.ok(frame.point([122, 15])[0] <= frame.viewBox[0] + frame.viewBox[2]);
});
