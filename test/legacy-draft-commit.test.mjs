import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/geometry-commit-harness.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const input = () => ({ model_version: 9, spaces: [{ id: 'f', rooms: [], wall_segments: [], partitions: [],
  custom: { keep: 'opaque', optional: null },
  room_drafts: [{ id: 'draft', points: [[.1,.1],[.3,.1],[.3,.3]],
    segments: [{ id: 'legacy-edge-a', cm: 21 }, { id: 'legacy-edge-b', cm: 22 }] }],
}], markers: [], settings: {} });

test('#1233 first physical write materializes legacy drafts once without reintroducing their carrier', () => {
  const h = harness(input()), before = h.runtime._geometrySnapshot('f');
  h.host._serverCfg.spaces[0].partitions.push({ id: 'new', a: [.5,.5], b: [.7,.5], cm: 15 });
  let sent;
  h.runtime._saveConfig = () => { sent = structuredClone(h.host._serverCfg); };
  assert.equal(h.runtime._commitPhysicalGeometry('Draw', before, [], true,
    { kind: 'partitions', ids: ['new'] }), true, JSON.stringify(h.toasts));
  assert.equal(sent.model_version, 11);
  const sp = h.host._serverCfg.spaces[0];
  assert.equal('room_drafts' in sp, false);
  assert.equal('room_drafts' in sent.spaces[0], false);
  assert.equal(sp.plan_graph.edges.length, 3);
  assert.deepEqual(sp.partitions.map(p => [p.id,p.cm]).sort(), [['legacy-edge-a',21],['legacy-edge-b',22],['new',15]]);
  assert.deepEqual(sp.custom, input().spaces[0].custom);
  assert.deepEqual(commitWallSegmentModel(sent).config, sent);
  const reload = harness(sent), nextBefore = reload.runtime._geometrySnapshot('f');
  reload.host._serverCfg.spaces[0].partitions.push({ id: 'later', a: [.5,.7], b: [.7,.7], cm: 16 });
  assert.equal(reload.runtime._commitPhysicalGeometry('Draw', nextBefore, [], true,
    { kind: 'partitions', ids: ['later'] }), true);
  assert.equal(reload.host._serverCfg.spaces[0].partitions.length, 4);
  assert.equal('room_drafts' in reload.host._serverCfg.spaces[0], false);
});

test('#1233 failed first physical write keeps the raw legacy carrier and creates no history', () => {
  const original = input(), h = harness(original), before = h.runtime._geometrySnapshot('f');
  h.host._serverCfg.spaces[0].partitions.push({ id: 'new', a: [.5,.5], b: [.7,.5], cm: 15 });
  h.host._checkSpacePhysicalGeometry = () => ({ ok: false });
  let writes = 0; h.runtime._saveConfig = () => { writes++; };
  assert.equal(h.runtime._commitPhysicalGeometry('Draw', before, [], true,
    { kind: 'partitions', ids: ['new'] }), false);
  assert.deepEqual(h.host._serverCfg, original);
  assert.deepEqual(h.history, []); assert.equal(writes, 0);
});
