// Manual RED reproducer, not a registered CI test or an accepted failure.
// After compiling tsconfig.test.json:
//   node docs/testing/issue1226/repros/legacy-contour.mjs
// Expected current defect: legacy succeeds; migrated room subtraction throws.
import assert from 'node:assert/strict';
import { commitWallSegmentModel } from '../../../../test-build/wall-segment-model.js';
import { spaceModels } from '../../../../test-build/space-geometry.js';
import { innerContourForRoom, wallBodiesGeometry } from '../../../../test-build/wall-thickness.js';

// Normalized coordinates; NORM_W=1000 render units. One lattice cell is
// 1/240 normalized units =1000/240 render units =1 cm on this space.
const raw = { model_version: 7, spaces: [{ id: 'wall-union-regression',
  title: 'Wall union regression', cell_cm: 1, view_box: [0, 0, 1, 1],
  rooms: [{ id: 'r1', poly: [
    [-1.670833333, 1.266666667], [-1.670833333, -0.208333333],
    [0.2875, -0.208333333], [0.2875, 1.266666667],
  ] }], walls: [{ key: '-0.691667,-0.208333@0.0000', cm: 30,
    a: [-1.670833333, -0.208333333], b: [0.2875, -0.208333333] }],
}], markers: [], settings: {} };
function inputs(config) {
  const model = spaceModels(config)[0], walls = config.spaces[0].walls;
  const geometry = wallBodiesGeometry(model.rooms, walls, [], [], 1 / 240, 1, 1000 / 240, 1000);
  const contour = () => innerContourForRoom(model.rooms, 'r1', walls, [],
    1 / 240, 1, 1000 / 240, 1000, geometry.roomGeom, geometry.multiWallNodes);
  return { geometry, contour };
}
const legacy = inputs(raw);
assert.equal(legacy.geometry.status, 'ok');
assert.ok(legacy.contour()?.length >= 3);
const current = commitWallSegmentModel(raw).config;
const migrated = inputs(current);
assert.equal(current.model_version, 11);
assert.equal(migrated.geometry.status, 'ok');
console.log(JSON.stringify({ legacyContour: 'ok', currentMasonry: 'ok',
  currentRooms: current.spaces[0].rooms, currentWalls: current.spaces[0].walls }));
// Intentionally uncaught: a valid masonry result must not make room rendering
// throw. Keeping exit1 prevents this diagnostic being mistaken for a PASS.
migrated.contour();
