import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandStack } from '../test-build/command-stack.js';
import { runNodeHistory } from '../test-build/wall-node-history.js';
import { nodeFloorFingerprint, writeWallNode } from '../test-build/wall-node-write.js';
import { applyNodeDelete } from '../test-build/wall-node-delete.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';

const clone = value => structuredClone(value);
function setup() {
  const before = commitWallSegmentModel({ spaces: [{ id: 'f', rooms: [], partitions: [
    { id: 'a', a: [0, 0], b: [1, 0], cm: 0 }, { id: 'b', a: [1, 0], b: [2, 0], cm: 0 },
  ] }], markers: [], settings: {} }).config;
  const intent = { point: [1, 0] }, result = applyNodeDelete(before.spaces[0], intent);
  assert.equal(result.ok, true);
  const after = commitWallSegmentModel({ ...before, spaces: [result.space] }).config;
  const server = { config: clone(after), rev: 2, fail: null, gate: Promise.resolve() }, messages = [], staged = [], toasts = [];
  const host = { _serverCfg: clone(after), _cfgRev: 2, _cfgEpoch: 0, _writeChain: Promise.resolve(),
    _saveConfigDebounced: { pending: () => false, flush() {} }, _cacheSnapshot() {}, requestUpdate() {},
    async _reloadRejectedPhysicalWrite() {},
    _adoption: { adoptionEpoch: 0, stageConfigCandidate: cfg => staged.push(clone(cfg)),
      acceptConfigWrite(cfg, response) { host._serverCfg = cfg; host._cfgRev = response.rev; } },
    hass: { async callWS(message) {
      messages.push(clone(message)); await server.gate;
      if (server.fail) throw { code: server.fail };
      assert.equal(message.type, 'houseplan/wall/node_delete');
      assert.equal(message.expected_rev, server.rev);
      assert.equal('config' in message, false); assert.equal('candidate' in message, false);
      if (message.direction === 'undo') {
        const forward = applyNodeDelete(message.before_space, message.intent);
        assert.equal(forward.ok, true);
        assert.deepEqual(commitWallSegmentModel({ ...server.config, spaces: [forward.space] }).config, server.config);
        server.config = { ...server.config, spaces: [clone(message.before_space)] };
      } else {
        assert.equal('before_space' in message, false);
        const applied = applyNodeDelete(server.config.spaces[0], message.intent);
        assert.equal(applied.ok, true);
        server.config = commitWallSegmentModel({ ...server.config, spaces: [applied.space] }).config;
      }
      return { config: clone(server.config), rev: ++server.rev };
    } },
  };
  const stack = new CommandStack(50), command = { name: 'Delete wall node',
    before: { nodeMove: { kind: 'delete', beforeSpace: before.spaces[0], intent, direction: 'undo', floor: nodeFloorFingerprint(after.spaces[0]) } },
    after: { nodeMove: { kind: 'delete', beforeSpace: before.spaces[0], intent, direction: 'apply' } } };
  const neighbour = { name: 'Older step', before: {}, after: {} };
  stack.push(neighbour); stack.push(command);
  const port = { enabled: () => true, api: history => history.kind === 'delete', epoch: () => 0, stack: () => stack,
    canShow: () => true, show: id => assert.equal(id, 'f'),
    write: (history, basis) => writeWallNode(host, history, basis), text: key => key, toast: text => toasts.push(text) };
  return { before, after, host, server, stack, command, neighbour, messages, staged, toasts, port };
}

test('#1045 shared writer waits for acceptance, then exact Undo/Redo move the one common cursor', async () => {
  const s = setup(); let release;
  s.server.gate = new Promise(resolve => { release = resolve; });
  const undo = runNodeHistory(s.port, 'undo');
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(s.messages.length, 1);
  assert.equal(s.stack.peekUndo(), s.command);
  assert.deepEqual(s.host._serverCfg, s.after); assert.deepEqual(s.staged, []);
  release(); await undo;
  assert.deepEqual(s.host._serverCfg, s.before);
  assert.equal(s.stack.peekUndo(), s.neighbour); assert.equal(s.stack.peekRedo(), s.command);
  await runNodeHistory(s.port, 'redo');
  assert.deepEqual(s.host._serverCfg, s.after);
  assert.equal(s.stack.peekUndo(), s.command); assert.equal(s.stack.canRedo, false);
  assert.equal(s.messages.length, 2);
  assert.deepEqual(s.messages.map(m => m.expected_rev), [2, 3]);
});

test('#1045 every refused inverse preserves the command, both cursor identities and accepted config', async () => {
  for (const direction of ['undo', 'redo']) for (const code of [
    'conflict', 'node_delete_unsafe', 'node_delete_opening', 'node_delete_degree', 'junction_limit_length',
    'invalid_partition_opening_host', 'node_delete_backend_unavailable', 'unknown_command', 'timeout', 'future_unknown',
  ]) {
    const s = setup();
    if (direction === 'redo') await runNodeHistory(s.port, 'undo');
    const config = clone(s.host._serverCfg), commands = s.stack.commands(), undo = s.stack.peekUndo(), redo = s.stack.peekRedo();
    s.server.fail = code;
    await runNodeHistory(s.port, direction);
    assert.deepEqual(s.host._serverCfg, config, `${direction}/${code}`);
    assert.deepEqual(s.stack.commands(), commands, `${direction}/${code}`);
    assert.equal(s.stack.peekUndo(), undo); assert.equal(s.stack.peekRedo(), redo);
    assert.match(s.toasts.at(-1), /^node_delete_/);
    assert.doesNotMatch(s.toasts.at(-1), /node_move/);
  }
});

test('#1045 capability and writer refusal keep a Delete history command and send no request', async () => {
  const s = setup();
  await runNodeHistory({ ...s.port, api: () => false }, 'undo');
  assert.deepEqual(s.messages, []); assert.equal(s.stack.peekUndo(), s.command);
  assert.deepEqual(s.toasts, ['node_delete_update_required']);
  await runNodeHistory({ ...s.port, enabled: () => false }, 'undo');
  assert.deepEqual(s.messages, []); assert.equal(s.stack.peekUndo(), s.command);
});

test('#1045 a retired Delete intent cannot overtake an own queue or change data/history', async () => {
  for (const pending of [false, true]) {
    const s = setup(); let release, live = true;
    if (pending) s.host._writeChain = new Promise(resolve => { release = resolve; });
    else live = false;
    const basis = { epoch: 0, space: 'f', floor: nodeFloorFingerprint(s.host._serverCfg.spaces[0]) };
    const writing = writeWallNode(s.host, s.command.before.nodeMove, basis, { send: () => live, accept: () => true });
    const refusal = assert.rejects(writing, /stale-node-snapshot/);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.deepEqual(s.messages, []); live = false; release?.(); await refusal;
    assert.deepEqual(s.messages, []); assert.deepEqual(s.staged, []);
    assert.deepEqual(s.host._serverCfg, s.after); assert.equal(s.stack.peekUndo(), s.command);
  }
});

test('#1045 a reply from a replaced HA cannot enter config or reload the new authority', async () => {
  const s = setup(), context = new ConfigWriteContext(); let release, reloads = 0;
  s.host.hass = { ...s.host.hass, connection: { connected: true }, user: { id: 'writer' } };
  context.observe(s.host.hass); const claim = context.claim();
  const authority = () => context.current(claim, s.host.hass) && s.host.hass.connection.connected;
  s.server.gate = new Promise(resolve => { release = resolve; });
  s.host._reloadRejectedPhysicalWrite = async () => { reloads++; };
  const basis = { epoch: 0, space: 'f', floor: nodeFloorFingerprint(s.host._serverCfg.spaces[0]) };
  const writing = writeWallNode(s.host, s.command.before.nodeMove, basis, { send: authority, accept: authority });
  const refusal = assert.rejects(writing, /stale-node-snapshot/);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(s.messages.length, 1);
  s.host.hass = { ...s.host.hass, connection: { connected: true } }; context.observe(s.host.hass);
  release(); await refusal;
  assert.deepEqual(s.staged, []); assert.deepEqual(s.host._serverCfg, s.after);
  assert.equal(s.stack.peekUndo(), s.command); assert.equal(reloads, 0);
});

test('#1045 closing the sent intent keeps an accepted reply on the same HA connection', async () => {
  const s = setup(), context = new ConfigWriteContext(); let release, menuCurrent = true;
  s.host.hass = { ...s.host.hass, connection: { connected: true }, user: { id: 'writer' } };
  context.observe(s.host.hass); const claim = context.claim();
  const authority = () => context.current(claim, s.host.hass) && s.host.hass.connection.connected;
  s.server.gate = new Promise(resolve => { release = resolve; });
  const basis = { epoch: 0, space: 'f', floor: nodeFloorFingerprint(s.host._serverCfg.spaces[0]) };
  const writing = writeWallNode(s.host, s.command.before.nodeMove, basis,
    { send: () => authority() && menuCurrent, accept: authority });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(s.messages.length, 1); menuCurrent = false;
  s.host.hass = { ...s.host.hass }; context.observe(s.host.hass);
  release(); await writing;
  assert.deepEqual(s.host._serverCfg, s.before); assert.equal(s.staged.length, 1);
  assert.equal(s.host._cfgRev, 3);
});
