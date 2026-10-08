import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as clipping from 'polyclip-ts';
import { buildNodePreview, nodePreviewJunctionGeometry } from '../test-build/wall-node-preview.js';
import { withWallBooleanBaseline } from '../test-build/wall-boolean-cache.js';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';
import { wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { geometryArea } from '../test-build/physical-geometry.js';
import { junctionLimitViolations } from '../test-build/junction-limits.js';
import { GRID_STEP_N, GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes, structuralNodeWalls } from '../test-build/wall-node-move.js';
import { canonicalizeConfigGeometryInPlace } from '../test-build/coordinate-canonicalization.js';

const area = geometry => geometryArea(geometry || []);
const sameMaterial = (actual, expected, label) => {
  const changed = area(clipping.difference(actual, expected)) + area(clipping.difference(expected, actual));
  assert.ok(changed <= Math.max(1, area(expected)) * 1e-9, `${label}: symmetric difference ${changed}`);
};

const connected = JSON.parse(readFileSync(new URL('./fixtures/834-node-connected.json', import.meta.url)));
const argumentsFor = preview => [preview.model.rooms, preview.input.walls, preview.input.openCuts,
  preview.input.roomOpenings, GRID_STEP_N, preview.input.cellCm, GRID_PITCH, NORM_W, preview.input.physicalBodies];

test('834 invocation-local exterior inputs retain canonical mapped and plain-bound geometry', () => {
  const prepared = buildNodePreview(connected.spaces[0]), args = argumentsFor(prepared);
  const expected = wallBodiesGeometry(...args);
  const actual = wallBodiesGeometry(...args, { reuseExterior: true });
  assert.equal(actual.status, expected.status);
  for (const key of ['geom', 'roomGeom', 'paperGeom']) sameMaterial(actual[key], expected[key], key);
  assert.deepEqual(actual.multiWallNodes, expected.multiWallNodes, 'ownership/topology order is unchanged');
});

test('834 Select operations keep 100 connected positions and strict proof identical to ordinary View', () => {
  const space = connected.spaces[0], frozen = structuredClone(space);
  const nodes = structuralWallNodes(space), point = [-401 / 240, 928 / 240];
  const node = nodes.find(n => n.point.every((v, i) => Math.abs(v - point[i]) < 1e-8));
  const plan = prepareNodeMove(space, node, nodes, {});
  const booleans = new WallBooleanBaseline();
  withWallBooleanBaseline(booleans, true, () => buildNodePreview(space));
  for (let offset = 1; offset <= 100; offset++) {
    const result = applyNodeMove(plan, [point[0], point[1] + offset / 240], null);
    assert.ok(result.ok); canonicalizeConfigGeometryInPlace({ spaces: [result.space] });
    const before = structuredClone(result.space);
    const actual = withWallBooleanBaseline(booleans, false, () => buildNodePreview(result.space));
    const expected = { ...actual, geometry: wallBodiesGeometry(...argumentsFor(actual)), renderRoomContours: new Map() };
    assert.equal(actual.geometry.status, expected.geometry.status, `${offset}: strict status`);
    for (const key of ['geom', 'roomGeom', 'paperGeom']) {
      sameMaterial(actual.geometry[key], expected.geometry[key], `${offset}/${key}`);
      assert.deepEqual(actual.geometry[key].map(p => p.length).sort((a, b) => a - b),
        expected.geometry[key].map(p => p.length).sort((a, b) => a - b), `${offset}/${key}: canonical holes/components`);
    }
    const cfg = { spaces: [result.space] }, walls = structuralNodeWalls(result.space);
    const historicalProof = nodePreviewJunctionGeometry(expected);
    delete historicalProof.subtractRoomMasonry;
    const expectedProof = junctionLimitViolations(cfg, result.space.id, walls, historicalProof);
    const actualProof = junctionLimitViolations(cfg, result.space.id, walls, nodePreviewJunctionGeometry(actual));
    assert.deepEqual(actualProof.map(({ actual, ...v }) => v), expectedProof.map(({ actual, ...v }) => v), `${offset}: guards`);
    for (let n = 0; n < actualProof.length; n++) assert.ok(Math.abs(actualProof[n].actual - expectedProof[n].actual) < 1e-5);
    assert.deepEqual(result.space, before, 'candidate unchanged');
  }
  assert.deepEqual(space, frozen, 'frozen baseline unchanged');
});
