// #803: 200 real, thick-walled rooms, not repeated identical pointer positions.
import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
import { wallKey } from '../../test-build/wall-thickness.js';
import { GRID_STEP_N } from '../../test-build/canvas-constants.js';
export function wallNodeFixture() {
  const rooms = [], walls = [];
  for (let i = 0; i < 200; i++) {
    const x = (i === 1 ? 40 : (i % 20) * 60) * GRID_STEP_N, y = Math.floor(i / 20) * 50 * GRID_STEP_N;
    const poly = [[x, y], [x + 40 * GRID_STEP_N, y], [x + 40 * GRID_STEP_N, y + 30 * GRID_STEP_N], [x, y + 30 * GRID_STEP_N]];
    // An adjoining trapezoid exposes a movable shared corner, not a T whose
    // two nearby alignment magnets cover its entire short carrier at fit zoom.
    if (i === 1) poly[1][1] += 10 * GRID_STEP_N;
    rooms.push({ id: `room-${i}`, name: `Room ${i}`, area: null, poly });
    for (let j = 0; j < 4; j++) {
      const a = poly[j], b = poly[(j + 1) % 4];
      walls.push({ key: wallKey(a, b, GRID_STEP_N), a, b, cm: 25 });
    }
  }
  return commitWallSegmentModel({ spaces: [{ id: 'nodes-large', title: '200 rooms', view_box: [-0.1, -0.1, 5.2, 2.2],
    rooms, walls, partitions: [
      { id: 'free', a: [-0.25, 0.3], b: [-0.25, 0.7], cm: 15 },
      { id: 'diagonal', a: [-0.8, 0.1], b: [-0.4, 0.3], cm: 25 },
      { id: 't-carrier', a: [-1.2, 0.9], b: [-0.2, 0.9], cm: 15 },
      { id: 't-branch', a: [-0.8, 0.9], b: [-0.8, 1.3], cm: 25 },
      { id: 'x-h', a: [-1.2, 1.7], b: [-0.2, 1.7], cm: 25 },
      { id: 'x-v', a: [-0.8, 1.4], b: [-0.8, 2], cm: 15 },
    ], openings: [] }], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
}
export const NODE_CASES = [
  { name: 'free', point: [-0.25, 0.3], raw: i => [-0.25 + (i % 127) / 2400, 0.32 + (i % 131) / 1600] },
  { name: 'corner', point: [0, 0], raw: i => [-((i % 127) + 1) / 2400, ((i % 131) + 1) / 2400] },
  { name: 'diagonal', point: [-0.8, 0.1], raw: i => [-0.7 + (i % 127) / 2400, 0.15 + (i % 127) / 4800 + 0.0001] },
  { name: 'shared', point: [40 * GRID_STEP_N, 0], raw: i => [40 * GRID_STEP_N + 0.01 + (i % 127) / 2400, 0.0001] },
  { name: 'T', point: [-0.8, 0.9], raw: i => [-0.6 + (i % 127) / 2400, 0.901] },
  { name: 'X', point: [-0.8, 1.7], raw: i => [-0.6 + (i % 127) / 2400, 1.701] },
];
