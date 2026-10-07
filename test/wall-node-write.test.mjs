import test from 'node:test';
import assert from 'node:assert/strict';
import { writeWallNode } from '../test-build/wall-node-write.js';
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), resolve: v => resolve(v) }; };
const cfg = () => ({ model_version: 10, spaces: [{ id: 'f', rooms: [] }], markers: [], settings: {} });
function setup() {
  const writes = [], adopted = [], host = { _serverCfg: cfg(), _cfgRev: 3, _cfgEpoch: 0,
    _writeChain: Promise.resolve(), reloads: 0, snapshots: 0, updates: 0,
    _saveConfigDebounced: { pending: () => false, flush() {} },
    _cacheSnapshot() { host.snapshots++; }, requestUpdate() { host.updates++; },
    async _reloadRejectedPhysicalWrite() { host.reloads++; },
    hass: { async callWS(message) { writes.push(message); return { config: cfg(), rev: 4 }; } },
    _adoption: { stageConfigCandidate(c) { adopted.push(c); }, acceptConfigWrite(c, response) { host._serverCfg = c; host._cfgRev = response.rev; } },
  };
  const history = { beforeSpace: host._serverCfg.spaces[0], intent: { point: [0, 0], target: [.1, .2], axis: null, split_ids: {} }, direction: 'apply' };
  return { host, history, writes, adopted };
}
test('node writes wait for pending config and never send a provisional candidate', async () => {
  const s = setup(), pending = deferred(); let flushed = false;
  s.host._saveConfigDebounced = { pending: () => true, flush() { flushed = true; s.host._writeChain = pending.promise; } };
  const done = writeWallNode(s.host, s.history, 3);
  assert.equal(flushed, true); assert.equal(s.writes.length, 0); assert.equal(s.adopted.length, 0);
  pending.resolve(); await done;
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0].type, 'houseplan/wall/node_move');
  assert.equal('config' in s.writes[0], false); assert.equal('before_space' in s.writes[0], false);
  assert.equal(s.host.snapshots, 1);
});
test('a queued ordinary writer changing body/revision invalidates the frozen node operation', async () => {
  const s = setup(), pending = deferred(); s.host._writeChain = pending.promise;
  const done = writeWallNode(s.host, s.history, 3);
  s.host._cfgRev++; pending.resolve();
  await assert.rejects(done, /stale-node-snapshot/);
  assert.equal(s.writes.length, 0); assert.equal(s.adopted.length, 0); assert.equal(s.host.reloads, 1);
});
test('late node response cannot replace a newer server adoption or unsaved local edit', async () => {
  for (const changed of ['revision', 'local']) {
    const s = setup(), pending = deferred();
    s.host.hass.callWS = async m => { s.writes.push(m); return pending.promise; };
    const done = writeWallNode(s.host, s.history, 3); await Promise.resolve();
    if (changed === 'revision') s.host._cfgRev = 5;
    else s.host._serverCfg.settings.newer = true;
    const live = structuredClone(s.host._serverCfg);
    pending.resolve({ config: cfg(), rev: 4 });
    await assert.rejects(done, /superseded-node-response/);
    assert.deepEqual(s.host._serverCfg, live); assert.equal(s.adopted.length, 0); assert.equal(s.host.reloads, 1);
  }
});
test('Undo carries only its inverse proof and a refused write cannot poison the queue', async () => {
  const s = setup(); s.history.direction = 'undo';
  s.host.hass.callWS = async m => { s.writes.push(m); throw new Error('conflict'); };
  await assert.rejects(writeWallNode(s.host, s.history, 3), /conflict/);
  assert.deepEqual(s.writes[0].before_space, s.history.beforeSpace);
  assert.equal(s.adopted.length, 0); assert.equal(s.host.snapshots, 0);
  s.host.hass.callWS = async m => { s.writes.push(m); return { config: cfg(), rev: 4 }; };
  await writeWallNode(s.host, s.history, 3);
  assert.equal(s.writes.length, 2); assert.equal(s.adopted.length, 1);
});
