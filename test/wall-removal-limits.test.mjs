import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/geometry-commit-harness.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { removesOnlyLimitSegments, checkSegmentLengths } from '../test-build/junction-limits.js';
import { CommandStack } from '../test-build/command-stack.js';

function source(current = true) {
  const config = { model_version: 10, spaces: [{ id: 'f', cell_cm: 5, rooms: [], partitions: [
    { id: 'long', a: [24 / 240, 24 / 240], b: [44 / 240, 24 / 240], cm: 20 },
    { id: 'short', a: [44 / 240, 24 / 240], b: [46 / 240, 24 / 240], cm: 20, future: { keep: 1 } },
  ] }], markers: [], settings: {} };
  return current ? commitWallSegmentModel(config).config : config;
}

for (const current of [false, true]) for (const id of ['long', 'short'])
test(`#1258 ${current ? 'graph' : 'legacy'} real commit deletes ${id} without touching its neighbour; Undo/Redo is exact`, () => {
  const h = harness(source(current)), proto = Object.getPrototypeOf(h.runtime);
  h.host._layout = {}; h.host._geometryHistory = new CommandStack();
  h.host._canCommitSpace = () => true; h.host._loadOk = true;
  h.host._maybeRebuildDevices = () => {}; h.runtime._showGeometrySpace = () => {};
  h.runtime._recordGeometry = proto._recordGeometry;
  const before = h.runtime._geometrySnapshot('f');
  const expected = commitWallSegmentModel(source(current)).config;
  const neighbour = expected.spaces[0].partitions.find(p => p.id !== id);
  h.host._serverCfg.spaces[0].partitions = h.host._serverCfg.spaces[0].partitions.filter(p => p.id !== id);
  assert.equal(h.runtime._commitPhysicalGeometry('Delete wall', before, [], true,
    { kind: 'partitions', ids: [id] }), true, JSON.stringify(h.toasts));
  const after = structuredClone(h.host._serverCfg);
  assert.deepEqual(after.spaces[0].partitions, [neighbour]);
  const command = h.host._geometryHistory.peekUndo();
  assert.ok(command);
  assert.equal(h.runtime._applyGeometryState(command.before), true);
  assert.deepEqual(h.host._serverCfg, expected);
  assert.equal(h.runtime._applyGeometryState(command.after), true);
  assert.deepEqual(h.host._serverCfg, after);
});

test('#1258 exact physical subset cannot exempt changed, inserted or rekeyed walls or a changed grid', () => {
  const before = source().spaces[0].partitions, survivor = before[1];
  assert.equal(checkSegmentLengths(before, 5, 1 / 240).length, 0);
  assert.equal(checkSegmentLengths([survivor], 5, 1 / 240)[0].rule, 'length');
  assert.equal(removesOnlyLimitSegments(before, [survivor], 5, 5), true);
  for (const change of [p => p.a[0] += 1 / 240, p => p.cm = 25, p => p.id = 'new']) {
    const next = structuredClone(survivor); change(next);
    assert.equal(removesOnlyLimitSegments(before, [next], 5, 5), false);
  }
  assert.equal(removesOnlyLimitSegments(before, [survivor, survivor], 5, 5), false);
  assert.equal(removesOnlyLimitSegments(before, [survivor], 5, 4), false);
  const h = harness(source()), next = structuredClone(h.host._serverCfg);
  next.spaces[0].partitions[1].b[0] -= 1 / 240;
  assert.ok(h.runtime._junctionLimitsIntroduced(next, h.host._serverCfg, 'f').some(v => v.rule === 'length'));
});

test('#1258 a proved removal still refuses non-length limits and physical failure', () => {
  const h = harness(source()), before = h.runtime._geometrySnapshot('f');
  h.host._serverCfg.spaces[0].partitions = h.host._serverCfg.spaces[0].partitions.slice(1);
  const real = h.host._junctionLimitViolations;
  h.host._junctionLimitViolations = (config, id, geometry, rooms) => [
    ...real(config, id, geometry, rooms),
    ...(geometry ? [{ rule: 'distance', subject: 'witness', actual: 2, limit: 5 }] : []),
  ];
  assert.equal(h.runtime._commitPhysicalGeometry('Delete wall', before, [], true,
    { kind: 'partitions', ids: ['long'] }), false);
  assert.deepEqual(h.toasts, ['junction.limit_distance']);
  assert.deepEqual(h.host._serverCfg, source());
  assert.equal(h.history.length, 0);
});
