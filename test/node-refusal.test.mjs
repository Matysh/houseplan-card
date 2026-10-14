import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandStack } from '../test-build/command-stack.js';
import { runNodeHistory, nodeHistoryRefusal } from '../test-build/wall-node-history.js';
import { nodeDragRefusalKey } from '../test-build/wall-node-refusal.js';
import { readFileSync } from 'node:fs';

test('#891 AC3 exact proof codes remove only the captured node command; backend/unknown/incompatible do not', async () => {
  for (const code of ['node_move_backend_unavailable', 'node_move_new_unknown', 'timeout',
    'wall_model_client_outdated', 'stale-node-snapshot', 'node_move_invalid',
    'node_move_opening_blocked', 'invalid_partition_opening_host', 'junction_limit_length']) {
    const stack = new CommandStack(), node = { nodeMove: { beforeSpace: { id: 'f' }, intent: {}, direction: 'undo' } };
    const neighbour = { name: 'same', before: node, after: node }, command = { name: 'same', before: node, after: node };
    stack.push(neighbour); stack.push(command);
    const toasts = [], newer = { name: 'same', before: { spaceId: 'f' }, after: { spaceId: 'f' } };
    await runNodeHistory({ enabled: () => true, api: () => true, epoch: () => 1, stack: () => stack,
      canShow: () => true, show: () => assert.fail('failed operation cannot show a floor'),
      write: async () => { stack.push(newer); throw { code }; }, text: key => key, toast: text => toasts.push(text) }, 'undo');
    const unfit = nodeHistoryRefusal({ code }, false) === 'outdated';
    assert.deepEqual(stack.commands(), unfit ? [neighbour, newer] : [neighbour, command, newer], code);
    assert.equal(stack.canRedo, false, code);
    assert.equal(toasts.length, 1, code);
  }
});
test('#891 AC5 pinned node Undo and Redo send nothing and use the same honest fixed-floor message', async () => {
  for (const direction of ['undo', 'redo']) {
    const stack = new CommandStack(), state = { nodeMove: { beforeSpace: { id: 'f' }, intent: {}, direction: 'undo' } };
    const command = { name: 'node', before: state, after: state }; stack.push(command);
    if (direction === 'redo') stack.undo();
    const toasts = [];
    await runNodeHistory({ enabled: () => true, api: () => true, epoch: () => 1, stack: () => stack,
      canShow: () => false, show: () => assert.fail('pinned floor'), write: () => assert.fail('pinned WS'),
      text: key => key, toast: text => toasts.push(text) }, direction);
    assert.deepEqual(toasts, ['history.space_pinned']);
    assert.equal(direction === 'undo' ? stack.peekUndo() : stack.peekRedo(), command);
  }
  for (const locale of ['en', 'ru']) {
    const text = JSON.parse(readFileSync(new URL(`../src/i18n/${locale}.json`, import.meta.url)))['history.unavailable'];
    assert.doesNotMatch(text, /Undo|Отмена/i, 'temporary Redo is not called Undo');
  }
});
test('#891 drag reasons distinguish transport/conflict/proof and do not assume unknown node_move codes prove failure', () => {
  assert.equal(nodeDragRefusalKey({ code: 'conflict' }), 'node_move_write_conflict');
  for (const code of ['timeout', 'node_move_backend_unavailable', 'node_move_unknown'])
    assert.equal(nodeDragRefusalKey({ code }), 'node_move_write_unavailable');
  assert.equal(nodeDragRefusalKey({ code: 'node_move_invalid' }), 'node_move_invalid');
  assert.equal(nodeDragRefusalKey({ code: 'wall_model_client_outdated' }), 'node_move_update_required');
});
