/**
 * #314 anonymised dense-plan fixture.
 *
 * It preserves the structural shape of the owner's report without names,
 * markers, layout, or original coordinates: 13 rooms, 44 catalogue walls,
 * 24 intentional partitions, and one pre-existing two-point draft.  The last
 * object is known debt and must remain the only invariant finding before and
 * after drawing another room.
 */
import { WALL_KEY_PITCH } from './wall-key.mjs';

export function makeV8DraftRegressionFixture() {
  const step = WALL_KEY_PITCH;
  const point = (x, y) => [x * step, y * step];
  const segmentIds = new Map();
  const wallSegments = [];
  const keyOf = (a, b) => {
    const left = `${a[0]},${a[1]}`;
    const right = `${b[0]},${b[1]}`;
    return left < right ? `${left}|${right}` : `${right}|${left}`;
  };
  const wallId = (a, b) => {
    const key = keyOf(a, b);
    let id = segmentIds.get(key);
    if (!id) {
      id = `wall-314-${String(wallSegments.length + 1).padStart(3, '0')}`;
      segmentIds.set(key, id);
      wallSegments.push({ id, a: [...a], b: [...b], cm: 15 });
    }
    return id;
  };

  const rooms = Array.from({ length: 13 }, (_, index) => {
    const x0 = 4 + index * 12;
    const x1 = x0 + 12;
    const y0 = 4;
    const y1 = 16;
    const poly = [point(x0, y0), point(x1, y0), point(x1, y1)];
    // Four split top edges make the catalogue population exactly 44 while
    // keeping all rooms valid and non-overlapping.
    if (index < 4) poly.push(point(x0 + 6, y1));
    poly.push(point(x0, y1));
    return {
      id: `room-314-${String(index + 1).padStart(2, '0')}`,
      name: `Room ${index + 1}`,
      poly,
      wall_ids: poly.map((a, edge) => wallId(a, poly[(edge + 1) % poly.length])),
    };
  });

  const partitions = Array.from({ length: 24 }, (_, index) => {
    const row = Math.floor(index / 8);
    const x = 4 + (index % 8) * 18;
    const y = 28 + row * 8;
    return {
      id: `partition-314-${String(index + 1).padStart(2, '0')}`,
      a: point(x, y),
      b: point(x + 8, y + 2),
      cm: 15 + (index % 3) * 5,
    };
  });

  if (wallSegments.length !== 44) {
    throw new Error(`fixture catalogue drifted: expected 44, got ${wallSegments.length}`);
  }

  return {
    model_version: 8,
    spaces: [{
      id: 'space-314-dense',
      title: 'Dense regression fixture',
      cell_cm: 5,
      view_box: [0, 0, 400, 400],
      rooms,
      wall_segments: wallSegments,
      partitions,
      room_drafts: [{
        id: 'draft-314-known-debt',
        points: [point(4, 56), point(14, 64)],
        segments: [{ id: 'wall-314-known-draft', cm: 15 }],
      }],
    }],
    markers: [],
    settings: {},
  };
}
