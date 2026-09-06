import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { finalizeWallChainSpace } from '../test-build/writer-fixed-point.js';
import {
  captureMarkerRoomReferences, restoreMarkerRoomReferences, rewriteMarkerRoomReferences,
} from '../test-build/room-reference-transaction.js';
import { optimizePlans, PLAN_MODEL_VERSION } from '../test-build/plan-optimizer.js';
import { geometryOpenCuts } from '../test-build/plan-geometry-preflight.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import {
  GRID_PITCH, GRID_STEP_N, spaceModels,
} from '../test-build/space-geometry.js';

const NORM_W = 1000;
const clone = (value) => structuredClone(value);
const configOf = (space, markers = []) => ({
  model_version: PLAN_MODEL_VERSION,
  spaces: [space], markers, settings: {},
});
const finish = (config, seedIds) => {
  const model = spaceModels(config)[0];
  const raw = config.spaces[0];
  const result = finalizeWallChainSpace(
    raw, model, geometryOpenCuts(raw, model), seedIds,
    {
      pitch: GRID_STEP_N,
      cellCm: Number(raw.cell_cm) > 0 ? Number(raw.cell_cm) : 5,
      gridPitch: GRID_PITCH,
      coordScale: NORM_W,
    },
  );
  const committed = commitWallSegmentModel({ ...config, spaces: [result.space] }).config;
  return { config: committed, report: result.report };
};

test('#477 finishes a two/three-segment collinear chain at the Optimize fixed point', () => {
  for (const count of [2, 3]) {
    const partitions = Array.from({ length: count }, (_, index) => ({
      id: `chain-${index}`,
      a: [index / count, 0.5], b: [(index + 1) / count, 0.5], cm: 15,
    }));
    const input = configOf({
      id: 'chain', cell_cm: 5, rooms: [], partitions,
    });
    const before = clone(input);
    const result = finish(input, partitions.map((partition) => partition.id));
    assert.deepEqual(input, before, 'the finalizer must not mutate the live candidate');
    assert.equal(result.report.partitionsMerged, count - 1);
    assert.equal(result.config.spaces[0].partitions.length, 1);
    assert.deepEqual(result.config.spaces[0].partitions[0], {
      id: 'chain-0', a: [0, 0.5], b: [1, 0.5], cm: 15,
    });
    const optimized = optimizePlans(result.config, {});
    assert.equal(optimized.changed, false);
    assert.deepEqual(optimized.config, result.config);
  }
});

test('#477 seed scope merges the touched chain but leaves unrelated historical seams alone', () => {
  const input = configOf({
    id: 'bounded', cell_cm: 5, rooms: [], partitions: [
      { id: 'old-a', a: [0, 0.1], b: [0.25, 0.1], cm: 15 },
      { id: 'old-b', a: [0.25, 0.1], b: [0.5, 0.1], cm: 15 },
      { id: 'new-a', a: [0, 0.8], b: [0.25, 0.8], cm: 20 },
      { id: 'new-b', a: [0.25, 0.8], b: [0.5, 0.8], cm: 20 },
    ],
  });
  const result = finish(input, ['new-a', 'new-b']);
  assert.equal(result.report.partitionsMerged, 1);
  assert.deepEqual(result.config.spaces[0].partitions.map((partition) => partition.id),
    ['old-a', 'old-b', 'new-a']);
});

test('#477 a missing writer seed cannot reconcile unrelated coincident partitions', () => {
  const legacy = JSON.parse(readFileSync(
    new URL('./fixtures/276-coincident-partition.json', import.meta.url), 'utf8',
  ));
  const baseline = optimizePlans({ ...legacy, spaces: [{
    ...legacy.spaces[0], partitions: [], openings: [],
  }] }, {}).config;
  const input = clone(baseline);
  input.spaces[0].partitions = clone(legacy.spaces[0].partitions);
  input.spaces[0].openings = clone(legacy.spaces[0].openings);
  const before = clone(input.spaces[0]);

  const result = finish(input, ['writer-seed-that-no-longer-exists']);
  assert.equal(result.report.partitionsReconciled, 0);
  assert.deepEqual(result.config.spaces[0], before);
});

test('#477 finishes a positive coincident wall with opening rehost at the Optimize fixed point', () => {
  const legacy = JSON.parse(readFileSync(
    new URL('./fixtures/276-coincident-partition.json', import.meta.url), 'utf8',
  ));
  const baseline = optimizePlans({ ...legacy, spaces: [{
    ...legacy.spaces[0], partitions: [], openings: [],
  }] }, {}).config;
  const raw = baseline.spaces[0];
  raw.partitions = clone(legacy.spaces[0].partitions);
  raw.openings = clone(legacy.spaces[0].openings);
  const beforeOpening = clone(raw.openings[0]);

  const result = finish(baseline, ['redundant']);
  assert.equal(result.report.partitionsReconciled, 1);
  assert.equal(result.report.openingsRehosted, 1);
  assert.equal(result.config.spaces[0].partitions, undefined);
  const opening = result.config.spaces[0].openings[0];
  assert.equal(opening.host.kind, 'wall');
  assert.equal(opening.x, 121 / 240);
  assert.equal(opening.y, 0.5);
  assert.equal(opening.length, beforeOpening.length);
  assert.equal(opening.contact, beforeOpening.contact);
  assert.deepEqual(opening.future_field, beforeOpening.future_field);
  const optimized = optimizePlans(result.config, {});
  assert.equal(optimized.changed, false);
  assert.deepEqual(optimized.config, result.config);
});

test('#477 unsafe coincidence is fail-closed and byte-equivalent', () => {
  const legacy = JSON.parse(readFileSync(
    new URL('./fixtures/276-coincident-partition.json', import.meta.url), 'utf8',
  ));
  const current = optimizePlans({ ...legacy, spaces: [{
    ...legacy.spaces[0], partitions: [], openings: [],
  }] }, {}).config;
  const withCarrier = () => {
    const candidate = clone(current);
    candidate.spaces[0].partitions = clone(legacy.spaces[0].partitions);
    candidate.spaces[0].openings = clone(legacy.spaces[0].openings);
    return candidate;
  };
  const variants = [];
  const unknown = withCarrier();
  unknown.spaces[0].partitions[0].future_semantics = true;
  variants.push(unknown);
  const column = withCarrier();
  column.spaces[0].wall_columns = [{
    id: 'column', shape: 'circle', center: [121 / 240, 0.5], cm: 20,
  }];
  variants.push(column);
  const orphan = withCarrier();
  orphan.spaces[0].openings[0].host.t = 2;
  variants.push(orphan);

  for (const input of variants) {
    const before = clone(input.spaces[0]);
    const result = finish(input, ['redundant']);
    assert.equal(result.report.partitionsReconciled, 0);
    assert.deepEqual(result.config.spaces[0], before);
  }
});

test('#477 delete/merge rewrites direct and cross-space vacuum room references only', () => {
  const markers = [
    { id: 'direct', space: 's1', room_id: 'drop', hidden: true, future: { keep: 1 } },
    { id: 'vac', space: 's2', vacuum: {
      entity: 'vacuum.bot', segment_map: { 1: 'drop', 2: 'keep', 3: 'elsewhere' },
      calibration: { keep: true },
    } },
    { id: 'unrelated', space: 's1', room_id: 'keep', custom: 7 },
  ];
  const merged = rewriteMarkerRoomReferences(markers, {
    kind: 'merge', dropId: 'drop', keepId: 'keep',
  });
  assert.equal(merged.changed, 2);
  assert.equal(merged.markers[0].room_id, 'keep');
  assert.deepEqual(merged.markers[1].vacuum.segment_map,
    { 1: 'keep', 2: 'keep', 3: 'elsewhere' });
  assert.deepEqual(merged.markers[0].future, { keep: 1 });
  assert.deepEqual(merged.markers[1].vacuum.calibration, { keep: true });
  assert.deepEqual(merged.markers[2], markers[2]);

  const later = clone(merged.markers);
  later[0].future.keep = 2;
  later[1].vacuum.calibration.keep = 'later';
  restoreMarkerRoomReferences(later, merged.before);
  assert.equal(later[0].room_id, 'drop');
  assert.equal(later[0].future.keep, 2, 'unrelated later marker fields survive Undo');
  assert.deepEqual(later[1].vacuum.segment_map,
    { 1: 'drop', 2: 'keep', 3: 'elsewhere' });
  assert.equal(later[1].vacuum.calibration.keep, 'later');

  const deleted = rewriteMarkerRoomReferences(markers, { kind: 'delete', roomId: 'drop' });
  assert.equal('room_id' in deleted.markers[0], false);
  assert.deepEqual(deleted.markers[1].vacuum.segment_map,
    { 2: 'keep', 3: 'elsewhere' });
  assert.deepEqual(captureMarkerRoomReferences(markers, ['direct', 'vac']), deleted.before);

  const onlyMap = rewriteMarkerRoomReferences([{
    id: 'only-map', vacuum: { segment_map: { 9: 'drop' } },
  }], { kind: 'delete', roomId: 'drop' });
  assert.equal('vacuum' in onlyMap.markers[0], false);
});

test('#477 source contract routes every explicit chain finish through one finalizer', () => {
  const runtime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const transaction = readFileSync(new URL('../src/draft-live-commit.ts', import.meta.url), 'utf8');
  const finishTransaction = transaction.slice(
    transaction.indexOf('export function commitWallChainFinishGeometry'),
    transaction.indexOf('/** #461 bounded transaction'),
  );
  assert.match(runtime, /public _finishWallChain\(\): boolean[\s\S]*?_finalizeWallChainPartitions/);
  assert.match(runtime, /_finishWallChain\(\)[\s\S]{0,300}btn\.reset/);
  assert.match(runtime, /if \(!accepted\.length\)[\s\S]{0,300}_finalizeWallChainPartitions/);
  assert.match(runtime, /_keepClosedAsPartitions[\s\S]*?_finalizeWallChainPartitions/);
  assert.match(card, /_slideTo[\s\S]{0,500}_finishWallChain\(\)/);
  assert.match(card, /_onHashChange[\s\S]{0,500}_finishWallChain\(\)/);
  assert.match(card, /Escape releases the active wall chain[\s\S]{0,250}_finishWallChain\(\)/);
  assert.doesNotMatch(runtime, /_markupClick[\s\S]{0,1200}_finalizeWallChainPartitions/,
    'the latency-critical terminal click must not run the finalizer');
  assert.match(finishTransaction,
    /safe = wallModelOffGridValueCount[\s\S]{0,500}host\._checkSpacePhysicalGeometry/,
    'the finish candidate must be judged by the bounded production physical proof');
  assert.match(finishTransaction, /if \(!safe\) return rejectUnsafe\(runtime, before\);/);
  assert.ok(
    finishTransaction.indexOf('host._checkSpacePhysicalGeometry')
      < finishTransaction.indexOf('if (!safe) return rejectUnsafe(runtime, before);')
      &&
    finishTransaction.indexOf('if (!safe) return rejectUnsafe(runtime, before);')
      < finishTransaction.indexOf('adoptWallSegmentModelCandidateInPlace'),
    'the finish candidate must pass the physical guard before live adoption',
  );
});

test('#477 executable writer manifest rejects an unclassified geometry writer', () => {
  const manifest = JSON.parse(readFileSync(
    new URL('./fixtures/477-writer-fixed-point-writers.json', import.meta.url), 'utf8',
  ));
  assert.equal(manifest.schema, 1);
  const byOwner = new Map(manifest.cases.map((entry) => [entry.owner, entry]));
  assert.equal(byOwner.size, manifest.cases.length, 'writer owners must be unique');
  const repo = fileURLToPath(new URL('..', import.meta.url));
  for (const entry of manifest.cases) {
    assert.ok(entry.class && entry.witness, `incomplete manifest row: ${entry.owner}`);
    assert.equal(existsSync(`${repo}/${entry.witness}`), true, `missing witness: ${entry.witness}`);
  }

  const source = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile(
    'houseplan-editor-runtime.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
  const discovered = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(file);
      if (expression.endsWith('._commitPhysicalGeometry')
          || expression.endsWith('._recordGeometry')) {
        let owner = node.parent;
        while (owner && !ts.isMethodDeclaration(owner) && !ts.isPropertyDeclaration(owner)) {
          owner = owner.parent;
        }
        const name = owner?.name?.getText(file);
        if (name && name !== '_commitPhysicalGeometry') discovered.add(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.deepEqual(
    [...discovered].filter((owner) => !byOwner.has(owner)), [],
    'every new geometry writer must declare its fixed-point witness or exception',
  );
});
