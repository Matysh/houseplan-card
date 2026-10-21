// #996: authored synthetic room; never a private support export. Both suites
// consume candidates from the same production deletion/face/identity stages.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../../test-build/space-geometry.js';
import { wallIntervals, materializeWallIntervals, applyWallThicknessToNewRoom } from '../../test-build/wall-thickness.js';
import { planRoomDeletion, parameterOnPartition } from '../../test-build/room-deletion.js';
import { reconcileCoincidentPartitions } from '../../test-build/coincident-partitions.js';
import { selectWallFaceLineage, settleWallFaceLineage } from '../../test-build/wall-face-lineage.js';

export function roomOpeningHostFixture(type = 'window', reverse = false) {
  const source = JSON.parse(readFileSync(new URL('../fixtures/996-room-opening-host.json', import.meta.url), 'utf8'));
  const initialSpace = source.spaces[0];
  for (const wall of initialSpace.wall_segments) wall.cm = 15;
  const north = initialSpace.wall_segments.find(w => w.a[1] === 0.2 && w.b[1] === 0.2 && Math.max(w.a[0], w.b[0]) === 0.8);
  initialSpace.openings = [{ id: 'opening', type, x: 0.4, y: 0.2, angle: 0, length: 0.1,
    contact: 'binary_sensor.synthetic_contact', ...(type === 'door' ? { lock: 'lock.synthetic_lock', flip_h: true, flip_v: true } : {}),
    host: { kind: 'wall', id: north.id, t: parameterOnPartition([0.4, 0.2], north) },
  }];
  const before = commitWallSegmentModel(source).config;
  const kept = structuredClone(before), space = kept.spaces[0], model = spaceModels(kept)[0];
  const intervals = wallIntervals(model.rooms, space.walls, [], GRID_STEP_N, 5, GRID_PITCH, NORM_W);
  const plan = planRoomDeletion(intervals.filter(i => i.roomId === 'room'), model.partitions,
    space.openings.map(o => ({ ...o, x: o.x * NORM_W, y: o.y * NORM_W })), GRID_PITCH * 0.02);
  const walls = materializeWallIntervals(model.rooms, space.walls, [], GRID_STEP_N, 5, GRID_PITCH, NORM_W);
  const targets = new Map();
  space.partitions = plan.materialize.map(({ interval }) => {
    const a = interval.a.map(v => v / NORM_W), b = interval.b.map(v => v / NORM_W);
    const wall = space.wall_segments.find(w => [a, b].every(p => [w.a, w.b].some(q => p.every((v, i) => Math.abs(v - q[i]) < 1e-9))));
    const partition = { id: wall.id, a, b, cm: interval.cm };
    targets.set(interval.key, partition);
    return partition;
  });
  for (const opening of space.openings) {
    const target = targets.get(plan.openingIntervals.get(opening.id));
    if (reverse) [target.a, target.b] = [target.b, target.a];
    opening.host = { kind: 'partition', id: target.id, t: parameterOnPartition([opening.x, opening.y], target) };
  }
  space.rooms = space.rooms.filter(r => r.id !== 'room');
  space.walls = walls;
  const deleted = commitWallSegmentModel(kept).config;

  const next = structuredClone(deleted), target = next.spaces[0], originalRoom = before.spaces[0].rooms[0];
  const oldModel = spaceModels(next)[0];
  const room = { ...structuredClone(originalRoom), id: 'recreated', name: 'Recreated',
    wall_ids: selectWallFaceLineage(originalRoom.poly.map(p => p.map(v => v * NORM_W)), oldModel.partitions,
      new Set(), GRID_PITCH * 0.0002) };
  target.rooms.push(room);
  target.walls = applyWallThicknessToNewRoom(target.walls, spaceModels(next)[0].rooms, room.id,
    15, GRID_STEP_N, [], NORM_W);
  const reconciled = reconcileCoincidentPartitions(target, spaceModels(next)[0], target.walls, [], {
    pitch: GRID_STEP_N, cellCm: 5, gridPitch: GRID_PITCH, coordScale: NORM_W, allowCoincidentPartitions: true,
  });
  for (const key of ['walls', 'partitions', 'openings']) {
    if (reconciled[key].length) target[key] = reconciled[key]; else delete target[key];
  }
  room.wall_ids = settleWallFaceLineage(room.wall_ids, new Set((target.partitions || []).map(p => p.id)));
  return { before, deleted, recreated: commitWallSegmentModel(next).config };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(roomOpeningHostFixture(process.argv[2], process.argv[3] === 'reverse')));
}
