import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { difference } from 'polyclip-ts';

import {
  checkOptimizeGeometry,
  prepareSpacePhysicalGeometryInputs,
  spacePhysicalGeometryFingerprint,
} from '../test-build/plan-geometry-preflight.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { wallBodiesGeometry, wallBodiesUnionPath } from '../test-build/wall-thickness.js';
import { geometryArea, pointInPhysicalGeometry } from '../test-build/physical-geometry.js';
import { checkPhysicalGeometry } from '../scripts/model-invariants.mjs';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/278-wall-union-isolation.json', import.meta.url), 'utf8',
));

const prepare = (config) => {
  const raw = config.spaces[0];
  const model = spaceModels(config)[0];
  return prepareSpacePhysicalGeometryInputs(raw, model);
};

const build = (input, operations = {}) => wallBodiesGeometry(
  input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
  input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
  input.physicalBodies, operations,
);

// #834 repairs the historical floating-tail shell failure. Its true material
// is a horizontal 30-cm bar plus a 20-cm stem, not an inherently unsafe plan.
const expectedT = [[[[-1670.833333, -270.833333], [2404.166667, -270.833333],
  [2404.166667, -145.833333], [287.5 + 125 / 3, -145.833333],
  [287.5 + 125 / 3, 1266.666667], [287.5 - 125 / 3, 1266.666667],
  [287.5 - 125 / 3, -145.833333], [-1670.833333, -145.833333], [-1670.833333, -270.833333]]]];
const corruptColumn = { id: 'deliberately-unbuildable', shape: 'rect', center: [NaN, 0], cm: 30, angle: 0 };

test('#278/#834 historical floating-tail regression builds the independently specified T masonry', () => {
  assert.match(fixture.provenance, /Minimized and anonymized/);
  assert.doesNotMatch(JSON.stringify(fixture), /Дет|Кабин|Холл|этаж/i);
  const input = prepare(fixture.config);
  const geometry = build(input);
  assert.equal(geometry.status, 'ok');
  assert.equal(geometry.degradedExtraCount, 0);
  assert.equal(geometry.components.length, 1);
  assert.ok(geometry.components.every((component) => component.geom.length > 0));
  assert.deepEqual(geometry.geom.map(polygon => polygon.length), [1], 'one connected T without phantom holes');
  const expectedArea = 4075 * 125 + (250 / 3) * 1412.5;
  assert.ok(Math.abs(geometryArea(geometry.geom) - expectedArea) < .02,
    'area error is bounded by the 1e-6 render-coordinate quantum times the perimeter');
  assert.ok(geometryArea(difference(geometry.geom, expectedT)) < .02, 'no added floor or exterior masonry');
  assert.ok(geometryArea(difference(expectedT, geometry.geom)) < .02, 'neither T arm is lost');
  for (const point of [[-1000, -200], [2000, -200], [287.5, 800]])
    assert.equal(pointInPhysicalGeometry(point, geometry.geom), true);
  for (const point of [[0, 800], [600, 800], [-1700, -200]])
    assert.equal(pointInPhysicalGeometry(point, geometry.geom), false);

  const projected = wallBodiesUnionPath(
    input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
    input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
    input.physicalBodies,
  );
  assert.ok(projected, 'render-safe projection remains drawable');
  assert.equal(projected.status, 'ok');
  assert.equal(projected.paths.length, 1);
  assert.ok(projected.paths.every((component) => component.d.length > 20));
});

test('#278 component set is deterministic under room and wall permutations', () => {
  const variants = [
    fixture.config,
    { ...fixture.config, spaces: [{
      ...fixture.config.spaces[0],
      rooms: [...fixture.config.spaces[0].rooms].reverse(),
      walls: [...fixture.config.spaces[0].walls].reverse(),
    }] },
  ];
  const projections = variants.map((config) => {
    const input = prepare(config);
    return wallBodiesUnionPath(
      input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
      input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
      input.physicalBodies,
    );
  });
  assert.ok(projections.every((projection) => projection?.status === 'ok'));
  assert.deepEqual(
    projections[0].paths.map((component) => component.d).sort(),
    projections[1].paths.map((component) => component.d).sort(),
  );
});

test('#278 Optimize and model-invariants use the same strict structural result', () => {
  const preflight = checkOptimizeGeometry(fixture.config);
  assert.equal(preflight.ok, true, 'the repaired historical boolean failure is no longer a rejection');
  assert.deepEqual(checkPhysicalGeometry(fixture.config), []);
  // Deliberately malformed data, not a normal user plan: an unbuildable
  // independent body still reaches the real fail-closed production guards.
  const corrupted = structuredClone(fixture.config);
  corrupted.spaces[0].wall_columns = [corruptColumn];
  const refused = checkOptimizeGeometry(corrupted);
  assert.equal(refused.ok, false);
  assert.equal(refused.failures[0].reason, 'wall-degraded-extra');
  const violations = checkPhysicalGeometry(corrupted);
  assert.deepEqual(violations, [{
    invariant: 'physical_geometry', kind: 'physical_geometry', owner: 'space[1]',
    reference: 'wall-degraded-extra',
    detail: 'canonical wall geometry is not safe for a write',
  }]);
  assert.doesNotMatch(JSON.stringify(violations), /Wall union regression|r1|r2/);
});

test('#278 two valid retained components still render while a failed merge remains forbidden for writes', () => {
  const config = structuredClone(fixture.config);
  config.spaces[0].partitions = [{ id: 'retained', a: [3, 0], b: [3.1, 0], cm: 20 }];
  const input = prepare(config);
  const operations = { mergeExtra: () => { throw new Error('deterministic independent-body merge failure'); } };
  const geometry = build(input, operations);
  assert.equal(geometry.status, 'degraded-extra');
  assert.equal(geometry.degradedExtraCount, 1);
  assert.equal(geometry.components.length, 2);
  assert.ok(geometry.components.every(component => component.geom.length > 0));
  assert.equal(pointInPhysicalGeometry([287.5, 800], geometry.components[0].geom), true, 'core is retained');
  assert.equal(pointInPhysicalGeometry([3050, 0], geometry.components[1].geom), true, 'failed valid body is retained');
  const projected = wallBodiesUnionPath(input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
    input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale, input.physicalBodies, operations);
  assert.equal(projected.status, 'degraded-extra');
  assert.equal(projected.paths.length, 2);
  assert.ok(projected.paths.every(component => component.d.length > 20));
  const refused = checkOptimizeGeometry(config, {
    wallPass: (...args) => wallBodiesGeometry(...args, operations),
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.failures[0].reason, 'wall-degraded-extra');
});

test('#278 physical fingerprint ignores decor but covers every strict writer field', () => {
  const raw = fixture.config.spaces[0];
  const baseline = spacePhysicalGeometryFingerprint(raw);
  assert.equal(spacePhysicalGeometryFingerprint({ ...raw, title: 'Else', decor: [{ id: 'd' }] }), baseline);
  for (const field of [
    'rooms', 'walls', 'open_spans', 'openings', 'partitions', 'wall_columns',
  ]) {
    const changed = { ...raw, [field]: [...(raw[field] || []), { id: `changed-${field}` }] };
    assert.notEqual(spacePhysicalGeometryFingerprint(changed), baseline, field);
  }
});

test('#278 production source routes physical writers through one barrier and decor around it', () => {
  const source = readHouseplanProductionSource();
  for (const historyKey of [
    'column_add', 'physical_edit', 'physical_delete',
    'physical_move', 'resize_room', 'wall_thickness',
    'move_opening', 'delete_opening', 'merge_rooms',
  ]) {
    // The pattern tolerates a line break after the opening parenthesis: a
    // wrapped call must not slip past the barrier check (CODE-REVIEW-313-r1).
    assert.match(source,
      new RegExp(`_commitPhysicalGeometry\\(\\s*this\\._t\\('history\\.${historyKey}'`), historyKey);
  }
  const runtime = readFileSync(
    new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8',
  );
  assert.match(runtime,
    /commitWallChainSegmentGeometry\(this, this\.host\._t\('history\.wall_segment'/,
    'an intermediate wall append uses its dedicated bounded physical barrier');
  // #313 introduced a second thickness commit point (independent masonry).
  // BOTH must go through the barrier: replacing either with _recordGeometry
  // reduces the count and reddens this line.
  assert.equal(
    (source.match(/_commitPhysicalGeometry\(\s*this\._t\('history\.wall_thickness'/g) || []).length,
    2, 'both thickness writers route through the common barrier');
  assert.match(source, /_commitPhysicalGeometry\([\s\S]{0,160}history\.edit_opening/);
  assert.match(source, /_commitPhysicalGeometry\([\s\S]{0,160}history\.split_room/);
  assert.match(source, /_recordGeometry\(this\._t\('history\.decor_edit'/);
  assert.doesNotMatch(source, /_commitPhysicalGeometry\(this\._t\('history\.decor_/);
  assert.match(source, /this\._rszSpaceCandidateRenderable\(preview\.space, preview\.sp\)/);
  assert.match(source, /this\._checkSpacePhysicalGeometry\(candidate, spaceId\)\.ok/);
  assert.match(source,
    /if \(physicalChanged\)[\s\S]{0,2500}_pendingPhysicalWrites\.set\((?:state|target)\.spaceId/,
    'physical Undo/Redo must retain the deferred-write barrier');
  // #500: the baseline replacement hook lives with the identity owner; the
  // clear runs inside the config-replace hook passed to adoptResponses.
  const adoption = readFileSync(new URL('../src/config-adoption.ts', import.meta.url), 'utf8');
  assert.match(adoption, /adoptResponses\(cfgResp \?\? \{\}, layResp,\s*\(\) => \{[\s\S]{0,400}_pendingPhysicalWrites\.clear\(\)/,
    'an external baseline must invalidate pending local approvals');
});
