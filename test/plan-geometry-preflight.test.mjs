import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkSpacePhysicalGeometry,
  checkOptimizeGeometry,
  prepareSpacePhysicalGeometryInputs,
  spacePhysicalGeometryFingerprint,
} from '../test-build/plan-geometry-preflight.js';
import { GRID_STEP_N, spaceModels } from '../test-build/space-geometry.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { wallKey } from '../test-build/wall-thickness.js';

const clone = (value) => structuredClone(value);
const room = (id = 'room') => ({
  id,
  poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
});
const wall = (cm = 20) => ({
  key: wallKey([0.1, 0.1], [0.9, 0.1], GRID_STEP_N),
  a: [0.1, 0.1], b: [0.9, 0.1], cm,
});
const base = (spaces) => ({ model_version: 6, spaces, markers: [], settings: {} });

test('Optimize geometry preflight covers the production input matrix without mutating config', () => {
  const config = base([
    {
      id: 'room-wall', title: 'Room wall', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [room()], walls: [wall()],
      openings: [{
        id: 'ordinary', type: 'door', x: 0.5, y: 0.1,
        angle: 0, length: 0.1,
      }],
    },
    {
      id: 'hosted', title: 'Hosted', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [room('host-room')], walls: [wall(18)],
      partitions: [{ id: 'partition', a: [0.1, 0.1], b: [0.9, 0.1], cm: 15 }],
      openings: [{
        id: 'hosted-opening', type: 'passage', x: 0, y: 0,
        angle: 0, length: 0.1,
        host: { kind: 'partition', id: 'partition', t: 0.5 },
      }],
    },
    {
      id: 'physical-only', title: 'Physical only', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [],
      partitions: [{ id: 'p', a: [0.1, 0.2], b: [0.8, 0.2], cm: 15 }],
      room_drafts: [{
        id: 'draft', points: [[0.1, 0.4], [0.8, 0.4]], segments: [{ cm: 12 }],
      }],
      wall_columns: [{ id: 'column', shape: 'square', center: [0.5, 0.6], cm: 20 }],
    },
    {
      id: 'image-only', title: 'Image only', view_box: [0, 0, 1, 1],
      plan_url: '/local/plan.png', rooms: [],
    },
    { id: 'empty', title: 'Empty', view_box: [0, 0, 1, 1], rooms: [] },
    { id: 'floor-only', title: 'Floor only', view_box: [0, 0, 1, 1], rooms: [room('floor')] },
  ]);
  const before = clone(config);

  const result = checkOptimizeGeometry(config);

  assert.deepEqual(config, before);
  assert.equal(result.fingerprint, contentFingerprint(config));
  assert.equal(result.ok, true);
  assert.deepEqual(result.spaces.map(({ spaceId, status }) => ({ spaceId, status })), [
    { spaceId: 'room-wall', status: 'ok' },
    { spaceId: 'hosted', status: 'ok' },
    { spaceId: 'physical-only', status: 'ok' },
    { spaceId: 'image-only', status: 'not-applicable' },
    { spaceId: 'empty', status: 'not-applicable' },
    { spaceId: 'floor-only', status: 'ok' },
  ]);
});

test('production preparation resolves ordinary and hosted openings once for masonry and bodies', () => {
  const raw = {
    id: 'parity', title: 'Parity', view_box: [0, 0, 1, 1], cell_cm: 5,
    rooms: [room()], walls: [wall()],
    partitions: [{ id: 'partition', a: [0.1, 0.1], b: [0.9, 0.1], cm: 15 }],
    openings: [
      { id: 'ordinary', type: 'door', x: 0.3, y: 0.1, angle: 0, length: 0.08 },
      {
        id: 'wall-hosted', type: 'window', x: 0.5, y: 0.1, angle: 0, length: 0.08,
        host: { kind: 'wall', id: 'wall-segment', t: 0.5 },
      },
      {
        id: 'hosted', type: 'passage', x: 0, y: 0, angle: 0, length: 0.08,
        host: { kind: 'partition', id: 'partition', t: 0.7 },
      },
      {
        id: 'orphan', type: 'door', x: 0.4, y: 0.4, angle: 0, length: 0.08,
        host: { kind: 'partition', id: 'missing', t: 0.5 },
      },
    ],
  };
  const model = spaceModels(base([raw]))[0];
  const input = prepareSpacePhysicalGeometryInputs(raw, model);

  assert.deepEqual(input.openings.map((opening) => opening.id), ['ordinary', 'wall-hosted', 'hosted']);
  assert.equal(input.partitionCuts.length, 1);
  assert.equal(input.roomOpenings.length, 3, 'wall hosts remain room cuts; coincident partition hosts cut masonry too');
  assert.ok(input.physicalBodies.length >= 2, 'partition and its opening jamb bodies are retained');
  assert.equal(input.wallKeyPitch, GRID_STEP_N);
  assert.equal(input.cellCm, 5);
});

test('null, exceptions and floor failure are bounded while successful empty geometry stays green', () => {
  const wallConfig = base([{
    id: 'wall-space', title: 'Wall space', view_box: [0, 0, 1, 1],
    rooms: [room()], walls: [wall()],
  }]);
  const floorConfig = base([{
    id: 'floor-space', title: 'Floor space', view_box: [0, 0, 1, 1], rooms: [room()],
  }]);

  const wallNull = checkOptimizeGeometry(wallConfig, { wallPass: () => null });
  assert.equal(wallNull.ok, false);
  assert.equal(wallNull.failures[0].reason, 'wall-null');

  const wallThrows = checkOptimizeGeometry(wallConfig, { wallPass: () => { throw new Error('secret'); } });
  assert.equal(wallThrows.failures[0].reason, 'wall-exception');
  assert.doesNotMatch(JSON.stringify(wallThrows), /secret/);

  const successfulEmpty = checkOptimizeGeometry(wallConfig, {
    wallPass: () => ({ geom: [], paperGeom: [], depthUnits: 0, openingIndex: null }),
    floorPass: () => { throw new Error('must not run'); },
  });
  assert.equal(successfulEmpty.ok, true);

  const floorNull = checkOptimizeGeometry(floorConfig, { floorPass: () => null });
  assert.equal(floorNull.failures[0].reason, 'floor-null');
  const floorThrows = checkOptimizeGeometry(floorConfig, {
    floorPass: () => { throw new Error('private floor detail'); },
  });
  assert.equal(floorThrows.failures[0].reason, 'floor-exception');
  assert.doesNotMatch(JSON.stringify(floorThrows), /private floor detail/);

  const prepareThrows = checkOptimizeGeometry(wallConfig, {
    prepareSpace: () => { throw new Error('private preparation detail'); },
  });
  assert.equal(prepareThrows.failures[0].reason, 'prepare-exception');
  assert.doesNotMatch(JSON.stringify(prepareThrows), /private preparation detail/);
});

test('#278 strict one-space barrier rejects degraded render-safe geometry', () => {
  const config = base([{
    id: 'strict', title: 'Strict', view_box: [0, 0, 1, 1],
    rooms: [room()], walls: [wall()],
  }]);
  const degraded = checkSpacePhysicalGeometry(config, 'strict', {
    wallPass: () => ({
      status: 'degraded-extra', geom: [], components: [], roomGeom: [], paperGeom: [],
      depthUnits: 0, openingIndex: null, degradedExtraCount: 1,
    }),
  });
  assert.equal(degraded.ok, false);
  assert.equal(degraded.reason, 'wall-degraded-extra');
  assert.equal(degraded.fingerprint, spacePhysicalGeometryFingerprint(config.spaces[0]));

  const failedCore = checkSpacePhysicalGeometry(config, 'strict', {
    wallPass: () => ({
      status: 'failed-core', geom: [], components: [], roomGeom: [], paperGeom: [],
      depthUnits: 0, openingIndex: null, degradedExtraCount: 0,
    }),
  });
  assert.equal(failedCore.reason, 'wall-failed-core');

  const missing = checkSpacePhysicalGeometry(config, 'missing');
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'prepare-exception');
});

test('one failed space blocks the ordered whole-plan result and uses safe display fallbacks', () => {
  const config = base([
    { id: 'good', title: ' Good floor ', view_box: [0, 0, 1, 1], rooms: [] },
    { id: 'bad-id', title: ' ', view_box: [0, 0, 1, 1], rooms: [room()] },
    { id: '', title: '', view_box: [0, 0, 1, 1], rooms: [room()] },
  ]);
  const result = checkOptimizeGeometry(config, {
    fallbackSpaceName: (index) => `Fallback ${index}`,
    floorPass: (rooms) => rooms[0]?.id === 'room' ? null : [],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.spaces.map((space) => space.displayName), [
    'Good floor', 'bad-id', 'Fallback 3',
  ]);
  assert.deepEqual(result.failures.map(({ spaceId, displayName, reason }) => ({
    spaceId, displayName, reason,
  })), [
    { spaceId: 'bad-id', displayName: 'bad-id', reason: 'floor-null' },
    { spaceId: '', displayName: 'Fallback 3', reason: 'floor-null' },
  ]);
});
