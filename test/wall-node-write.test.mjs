import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeFloorFingerprint, writeWallNode } from '../test-build/wall-node-write.js';
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), resolve: v => resolve(v) }; };
const cfg = () => ({ model_version: 10, spaces: [{ id: 'f', rooms: [] }, { id: 'g', rooms: [] }], markers: [], settings: {} });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
/** The card's deferred write: `flush()` runs a pending call now; re-arming counts. */
function deferredWrite(fn) {
  let armed = false;
  const write = () => { armed = true; write.arms++; };
  write.arms = 0;
  write.pending = () => armed;
  write.flush = () => { if (!armed) return; armed = false; fn(); };
  return write;
}
function setup() {
  const writes = [], adopted = [], host = { _serverCfg: cfg(), _cfgRev: 3, _cfgEpoch: 0,
    _writeChain: Promise.resolve(), reloads: 0, snapshots: 0, updates: 0,
    _saveConfigDebounced: { pending: () => false, flush() {} },
    _cacheSnapshot() { host.snapshots++; }, requestUpdate() { host.updates++; },
    async _reloadRejectedPhysicalWrite() { host.reloads++; },
    hass: { async callWS(message) { writes.push(message); return { config: cfg(), rev: host._cfgRev + 1 }; } },
    _adoption: { adoptionEpoch: 0, stageConfigCandidate(c) { adopted.push(c); },
      acceptConfigWrite(c, response) { host._serverCfg = c; host._cfgRev = response.rev; } },
  };
  const history = { beforeSpace: host._serverCfg.spaces[0], intent: { point: [0, 0], target: [.1, .2], axis: null, split_ids: {} }, direction: 'apply' };
  // What the command (or the gesture) started from: this epoch and this floor.
  const basis = () => ({ epoch: host._adoption.adoptionEpoch, space: 'f', floor: nodeFloorFingerprint(host._serverCfg.spaces[0]) });
  /** The card's own config/set on the same chain: accepted, revision +1, epoch unchanged. */
  const ownWrite = (gate = Promise.resolve(), fail = null) => {
    host._writeChain = host._writeChain.catch(() => {}).then(async () => {
      await gate; writes.push({ type: 'houseplan/config/set', expected_rev: host._cfgRev });
      if (fail) throw fail;
      host._adoption.acceptConfigWrite(structuredClone(host._serverCfg), { rev: host._cfgRev + 1 });
    });
  };
  return { host, history, writes, adopted, basis, ownWrite };
}
const nodeWrites = s => s.writes.filter(m => m.type === 'houseplan/wall/node_move');
test('node writes wait for pending config and never send a provisional candidate', async () => {
  const s = setup(), pending = deferred(); let flushed = false;
  s.host._saveConfigDebounced = { pending: () => !flushed, flush() { flushed = true; s.host._writeChain = pending.promise; } };
  const done = writeWallNode(s.host, s.history, s.basis());
  assert.equal(flushed, true); assert.equal(s.writes.length, 0); assert.equal(s.adopted.length, 0);
  pending.resolve(); await done;
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0].type, 'houseplan/wall/node_move');
  assert.equal('config' in s.writes[0], false); assert.equal('before_space' in s.writes[0], false);
  assert.equal(s.host.snapshots, 1);
});
// #843: the former single case «a queued writer changing body/revision invalidates
// the frozen node operation» is split: an own accepted write advances the expected
// revision; a foreign adoption or a changed target floor still invalidates.
for (const direction of ['apply', 'undo']) for (const when of ['waiting Save', 'Save in flight']) {
  test(`#843 AC2/AC7 ${direction}: own accepted write (${when}) is one node request with the revision after it`, async () => {
    const s = setup(), gate = deferred(); s.history.direction = direction;
    const start = s.basis();
    s.host._serverCfg.settings.theme = 'dark'; // own presentation edit, not the target floor
    s.host._saveConfigDebounced = deferredWrite(() => s.ownWrite(gate.promise));
    s.host._saveConfigDebounced();
    if (when === 'Save in flight') s.host._saveConfigDebounced.flush();
    const done = writeWallNode(s.host, s.history, start);
    await settle(); assert.equal(nodeWrites(s).length, 0, 'the node request waits for the own write');
    gate.resolve(); await done;
    assert.deepEqual(s.writes.map(m => [m.type, m.expected_rev]),
      [['houseplan/config/set', 3], ['houseplan/wall/node_move', 4]]);
    assert.equal(nodeWrites(s)[0].direction, direction);
    assert.equal(s.host.reloads, 0); assert.equal(s.adopted.length, 1);
  });
}
for (const [label, change] of [
  ['foreign adoption', s => { s.host._adoption.adoptionEpoch++; s.host._cfgRev++; }],
  ['own write changed the target floor', s => {
    s.host._serverCfg.spaces[0].rooms.push({ id: 'renamed' });
    s.host._adoption.acceptConfigWrite(structuredClone(s.host._serverCfg), { rev: s.host._cfgRev + 1 });
  }],
]) test(`#843: ${label} while queued still invalidates the frozen node operation`, async () => {
  const s = setup(), pending = deferred(), start = s.basis(); s.host._writeChain = pending.promise;
  const done = writeWallNode(s.host, s.history, start);
  change(s); pending.resolve();
  await assert.rejects(done, /stale-node-snapshot/);
  assert.equal(nodeWrites(s).length, 0); assert.equal(s.adopted.length, 0); assert.equal(s.host.reloads, 1);
});
test('#843 AC2(в): a failed own write refuses without a request or reload; the next attempt re-sends it first', async () => {
  const s = setup(), start = s.basis(); let fail = Object.assign(new Error('network'), { code: 'timeout' });
  s.host._serverCfg.settings.theme = 'dark';
  s.host._saveConfigDebounced = deferredWrite(() => s.ownWrite(Promise.resolve(), fail));
  s.host._saveConfigDebounced();
  await assert.rejects(writeWallNode(s.host, s.history, start), /node-own-queue/);
  assert.equal(nodeWrites(s).length, 0, 'an unsent own edit is never overtaken');
  assert.equal(s.host.reloads, 0, 'no reload replaces the unsent local edit');
  assert.equal(s.host._serverCfg.settings.theme, 'dark');
  fail = null; // the next attempt
  await writeWallNode(s.host, s.history, start);
  assert.equal(s.host._saveConfigDebounced.arms, 2, 'the failed own write was re-armed');
  assert.deepEqual(s.writes.map(m => [m.type, m.expected_rev]), [
    ['houseplan/config/set', 3], ['houseplan/config/set', 3], ['houseplan/wall/node_move', 4]]);
});
test('late node response cannot replace a newer server adoption or unsaved local edit', async () => {
  for (const changed of ['revision', 'local']) {
    const s = setup(), pending = deferred();
    s.host.hass.callWS = async m => { s.writes.push(m); return pending.promise; };
    const done = writeWallNode(s.host, s.history, s.basis()); await settle();
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
  await assert.rejects(writeWallNode(s.host, s.history, s.basis()), /conflict/);
  assert.deepEqual(s.writes[0].before_space, s.history.beforeSpace);
  assert.equal(s.adopted.length, 0); assert.equal(s.host.snapshots, 0);
  s.host.hass.callWS = async m => { s.writes.push(m); return { config: cfg(), rev: 4 }; };
  await writeWallNode(s.host, s.history, s.basis());
  assert.equal(s.writes.length, 2); assert.equal(s.adopted.length, 1);
});
