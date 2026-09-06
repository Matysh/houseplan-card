import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  checkOptimizeGeometry,
  prepareSpacePhysicalGeometryInputs,
  spacePhysicalGeometryFingerprint,
} from '../test-build/plan-geometry-preflight.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { wallBodiesGeometry, wallBodiesUnionPath } from '../test-build/wall-thickness.js';
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

const build = (input) => wallBodiesGeometry(
  input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
  input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
  input.physicalBodies,
);

test('#278 anonymized regression degrades one boolean merge instead of losing all masonry', () => {
  assert.match(fixture.provenance, /Minimized and anonymized/);
  assert.doesNotMatch(JSON.stringify(fixture), /Дет|Кабин|Холл|этаж/i);
  const input = prepare(fixture.config);
  const geometry = build(input);
  assert.equal(geometry.status, 'degraded-extra');
  assert.equal(geometry.degradedExtraCount, 1);
  assert.equal(geometry.components.length, 2);
  assert.ok(geometry.components.every((component) => component.geom.length > 0));

  const projected = wallBodiesUnionPath(
    input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
    input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
    input.physicalBodies,
  );
  assert.ok(projected, 'render-safe projection remains drawable');
  assert.equal(projected.status, 'degraded-extra');
  assert.equal(projected.paths.length, 2);
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
  assert.ok(projections.every((projection) => projection?.status === 'degraded-extra'));
  assert.deepEqual(
    projections[0].paths.map((component) => component.d).sort(),
    projections[1].paths.map((component) => component.d).sort(),
  );
});

test('#278 Optimize and model-invariants use the same strict structural result', () => {
  const preflight = checkOptimizeGeometry(fixture.config);
  assert.equal(preflight.ok, false);
  assert.equal(preflight.failures[0].reason, 'wall-degraded-extra');
  const violations = checkPhysicalGeometry(fixture.config);
  assert.deepEqual(violations, [{
    invariant: 'physical_geometry', kind: 'physical_geometry', owner: 'space[1]',
    reference: 'wall-degraded-extra',
    detail: 'canonical wall geometry is not safe for a write',
  }]);
  assert.doesNotMatch(JSON.stringify(violations), /Wall union regression|r1|r2/);
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
  assert.match(source, /if \(configChanged\)[\s\S]{0,300}_pendingPhysicalWrites\.clear\(\)/,
    'an external baseline must invalidate pending local approvals');
});
