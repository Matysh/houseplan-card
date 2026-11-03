import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, fixture, square } from './helpers/geometry-commit-harness.mjs';
import { commitWallSegmentModel, WallSegmentModelError } from '../test-build/wall-segment-model.js';
import { commitGraphEditResult } from '../test-build/graph-edit-intent.js';
import { WallNodeEditor } from '../test-build/wall-node-editor.js';
import { normalizeLegacyGeometryInPlace } from '../test-build/geometry-cleanup.js';

const column = () => ({ id: 'column', shape: 'square', center: [1, 1], cm: 20, angle: 0 });
const invalid = [NaN, Infinity, -Infinity, null, '', 'invalid', undefined];
for (const field of ['x', 'y', 'cm', 'angle']) for (const [i, value] of invalid.entries()) {
  if ((field === 'angle' || field === 'cm') && value == null) continue; // legacy defaults
  test(`#1230 refuses raw ${field}/${i} before cloning without saving or history`, () => {
    const h = harness(), beforeConfig = structuredClone(h.host._serverCfg);
    const before = h.runtime._geometrySnapshot('f'), candidate = column();
    if (field === 'x' || field === 'y') candidate.center[field === 'x' ? 0 : 1] = value;
    else candidate[field] = value;
    h.host._serverCfg.spaces[0].wall_columns = [candidate];
    let saves = 0; h.runtime._saveConfig = () => { saves++; };
    assert.equal(h.runtime._commitPhysicalGeometry('column', before), false);
    assert.deepEqual(h.host._serverCfg, beforeConfig);
    assert.deepEqual(h.history, []);
    assert.equal(h.host._pendingPhysicalWrites.size, 0);
    assert.equal(saves, 0);
  });
}

for (const version of [9, 11]) test(`#1230 structural preparation rejects nonfinite columns on model${version}`, () => {
  const input = version === 11 ? fixture() : { model_version: 9, spaces: [square('f')], markers: [], settings: {} };
  input.spaces[0].wall_columns = [{ ...column(), center: [NaN, 0] }];
  const original = structuredClone(input);
  assert.throws(() => commitWallSegmentModel(input), WallSegmentModelError);
  assert.deepEqual(input, original);
});

test('#1230 rejected column omits node hover handles through the model error contract', () => {
  const config = fixture();config.spaces[0].wall_columns = [{ ...column(), center: [NaN, 0] }];
  const before = structuredClone(config);
  const editor = Object.assign(Object.create(WallNodeEditor.prototype), {
    port: { context: () => ({ space: 'f' }), config: () => config }, cache: null,
  });
  assert.equal(editor.nodes(), null);
  assert.deepEqual(config, before);
});

test('#1230 repairable legacy column numbers retain the existing #842 normalization', () => {
  const cfg = fixture();cfg.spaces[0].wall_columns = [
    { id: 'old', shape: 'square', center: ['0.5', 0.2], angle: null, custom: 'kept' },
  ];
  const prepared = commitWallSegmentModel(cfg).config;
  normalizeLegacyGeometryInPlace(prepared);
  assert.deepEqual(prepared.spaces[0].wall_columns, [
    { id: 'old', shape: 'square', center: [0.5, 0.2], cm: 15, angle: 0, custom: 'kept' },
  ]);
  assert.equal(typeof cfg.spaces[0].wall_columns[0].center[0], 'string');
});

test('#1230 direct graph edit cannot launder NaN to null', () => {
  const before = fixture().spaces[0], draft = structuredClone(before);
  draft.wall_columns = [{ ...column(), center: [NaN, 0] }];
  assert.throws(() => commitGraphEditResult(before, draft, { kind: 'metadata' }));
  assert.ok(Number.isNaN(draft.wall_columns[0].center[0]));
});

for (const prepared of [false, true]) test(`#1230 refuses a sparse column center (prepared=${prepared})`, () => {
  const h = harness(), original = structuredClone(h.host._serverCfg);
  const before = h.runtime._geometrySnapshot('f');
  const center = [1, 1]; delete center[0];
  h.host._serverCfg.spaces[0].wall_columns = [{ ...column(), center }];
  assert.equal(h.runtime._commitPhysicalGeometry('column', before, [], true,
    prepared ? { kind: 'prepared', base: before.plan_graph } : { kind: 'metadata' }), false);
  assert.deepEqual(h.host._serverCfg, original);
  assert.deepEqual(h.history, []);
});

for (const shape of ['square', 'circle']) test(`#1230 valid ${shape} columns retain exact input and opaque metadata`, () => {
  const h = harness(), before = h.runtime._geometrySnapshot('f');
  const candidate = { ...column(), shape, center: [0.987654321, 1], custom: { label: 'keep', unset: null } };
  if (shape === 'circle') delete candidate.angle;
  h.host._serverCfg.spaces[0].wall_columns = [candidate];
  assert.equal(h.runtime._commitPhysicalGeometry('column', before), true);
  assert.deepEqual(h.host._serverCfg.spaces[0].wall_columns, [candidate]);
  assert.equal(h.history.length, 1);
});
