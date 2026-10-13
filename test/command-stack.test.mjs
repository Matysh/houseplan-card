import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandStack } from '../test-build/command-stack.js';

test('keeps fifty named commands and drops the oldest', () => {
  const stack = new CommandStack(50);
  for (let i = 0; i < 55; i++) stack.push({ name: `step ${i}`, before: i, after: i + 1 });
  assert.equal(stack.size, 50);
  assert.equal(stack.undoName, 'step 54');
  for (let i = 54; i >= 5; i--) assert.equal(stack.undo()?.name, `step ${i}`);
  assert.equal(stack.canUndo, false);
});

test('undo and redo preserve names and a new branch clears redo', () => {
  const stack = new CommandStack(50);
  stack.push({ name: 'Resize room', before: { x: 0 }, after: { x: 1 } });
  stack.push({ name: 'Add opening', before: { x: 1 }, after: { x: 2 } });
  assert.equal(stack.undo()?.name, 'Add opening');
  assert.equal(stack.redoName, 'Add opening');
  assert.equal(stack.redo()?.name, 'Add opening');
  assert.equal(stack.undo()?.name, 'Add opening');
  stack.push({ name: 'Split room', before: { x: 1 }, after: { x: 3 } });
  assert.equal(stack.canRedo, false);
  assert.equal(stack.undoName, 'Split room');
});

test('the configured history cannot be weakened below thirty commands', () => {
  const stack = new CommandStack(1);
  for (let i = 0; i < 35; i++) stack.push({ name: String(i), before: i, after: i + 1 });
  assert.equal(stack.size, 30);
});

test('selective invalidation removes matching undo and redo without clearing neighbours', () => {
  const stack = new CommandStack(50);
  stack.push({ name: 'lamp', before: { deviceId: 'lamp' }, after: { deviceId: 'lamp' } });
  stack.push({ name: 'sensor', before: { deviceId: 'sensor' }, after: { deviceId: 'sensor' } });
  stack.push({ name: 'lock', before: { deviceId: 'lock' }, after: { deviceId: 'lock' } });
  assert.equal(stack.undo()?.name, 'lock');

  assert.equal(
    stack.removeWhere(({ before }) => before.deviceId === 'sensor'),
    1,
  );
  assert.equal(stack.undoName, 'lamp');
  assert.equal(stack.redoName, 'lock');
  assert.equal(stack.canUndo, true);
  assert.equal(stack.canRedo, true);

  assert.equal(stack.removeWhere(({ after }) => after.deviceId === 'lock'), 1);
  assert.equal(stack.canRedo, false);
  assert.equal(stack.undo()?.name, 'lamp');
});

test('#843 peek and confirm move the cursor only over the very next command', () => {
  const stack = new CommandStack(50);
  const room = { name: 'Add room', before: 0, after: 1 }, node = { name: 'Move wall node', before: 1, after: 2 };
  stack.push(room); stack.push(node);
  assert.equal(stack.peekUndo(), node); assert.equal(stack.size, 2, 'peek does not move the cursor');
  assert.equal(stack.confirmUndo(room), false, 'a command that is not next is never moved');
  assert.equal(stack.confirmUndo(node), true);
  assert.deepEqual([stack.undoName, stack.redoName, stack.peekRedo()], ['Add room', 'Move wall node', node]);
  const newer = { name: 'Split room', before: 1, after: 3 };
  stack.push(newer);
  assert.equal(stack.confirmRedo(node), false, 'a newer branch is not displaced');
  assert.deepEqual([stack.undoName, stack.canRedo, stack.size], ['Split room', false, 2]);
  assert.equal(stack.confirmUndo(newer), true); assert.equal(stack.confirmRedo(newer), true);
  assert.equal(stack.peekUndo(), newer);
});

// ---------------------------------------------------------------- #883
// One ordinary history attempt (`src/geometry-history-step.ts`) over the real
// CommandStack: the cursor moves only on success, a temporary refusal keeps the
// exact command, an unfit one removes exactly that object. Only `apply` (the
// runtime snapshot restore and its verdicts) is substituted.
const { runOrdinaryHistory } = await import('../test-build/geometry-history-step.js');
const attempt = (stack, direction, apply) => {
  const toasts = [], applied = [];
  const outcome = runOrdinaryHistory({
    stack, apply: state => { applied.push(state); return apply(state); },
    text: (key, params) => (params ? `${key}${JSON.stringify(params)}` : key), toast: text => toasts.push(text),
  }, direction);
  return { outcome, toasts, applied };
};
/** Both directions bottom → top, read through the public cursor and put back exactly. */
const contents = stack => {
  const undo = [], redo = [];
  while (stack.canUndo) undo.unshift(stack.undo());
  for (let i = 0; i < undo.length; i++) stack.redo();
  while (stack.canRedo) redo.unshift(stack.redo());
  for (let i = 0; i < redo.length; i++) stack.undo();
  return { undo, redo };
};
const wall = (floor, n) => ({ name: 'Add wall', before: { floor, n }, after: { floor, n: n + 1 } });
const removed = (direction, reason) => `history.removed_${direction}{"name":"Add wall","reason":"history.reason_${reason}"}`;

for (const reason of ['space', 'state', 'geometry']) {
  test(`#883 AC2 unfit Undo (${reason}) removes exactly that object; same-named neighbours, floors and the redo branch keep their order`, () => {
    const stack = new CommandStack(50);
    const [a, b, c, d] = [wall('f1', 0), wall('f2', 0), wall('f1', 1), wall('f1', 2)];
    for (const command of [a, b, c, d]) stack.push(command);
    assert.equal(attempt(stack, 'undo', () => true).outcome, true);
    const refused = attempt(stack, 'undo', () => reason);
    assert.equal(refused.outcome, reason);
    assert.deepEqual(refused.applied, [c.before], 'one attempt on the exact next command');
    assert.deepEqual(refused.toasts, [removed('undo', reason)], 'one toast, no false «Undone»');
    const left = contents(stack);
    assert.ok(left.undo.length === 2 && left.undo[0] === a && left.undo[1] === b, 'neighbours with the same name stay, in order');
    assert.ok(left.redo.length === 1 && left.redo[0] === d, 'the refused command never enters Redo');
    assert.deepEqual(attempt(stack, 'undo', () => true).applied, [b.before], 'the next press applies the neighbour');
  });
}
test('#883 AC2 unfit Redo is symmetric: only that object leaves the redo branch and never enters Undo', () => {
  const stack = new CommandStack(50);
  const [a, b, c, d] = [wall('f1', 0), wall('f2', 0), wall('f1', 1), wall('f1', 2)];
  for (const command of [a, b, c, d]) stack.push(command);
  for (let i = 0; i < 3; i++) attempt(stack, 'undo', () => true);
  const refused = attempt(stack, 'redo', () => 'geometry');
  assert.deepEqual([refused.applied, refused.toasts], [[b.after], [removed('redo', 'geometry')]]);
  const left = contents(stack);
  assert.ok(left.undo.length === 1 && left.undo[0] === a);
  assert.ok(left.redo.length === 2 && left.redo[0] === d && left.redo[1] === c, 'the redo branch keeps its order');
  assert.deepEqual(attempt(stack, 'redo', () => true).applied, [c.after]);
});
for (const [outcome, toast] of [['pinned', 'history.space_pinned'], ['retry', 'history.unavailable']]) {
  test(`#883 AC1 a temporary refusal (${outcome}) keeps the exact command and both stacks; the retry applies exactly it`, () => {
    const stack = new CommandStack(50);
    const [a, b, c] = [wall('f1', 0), wall('f2', 0), wall('f2', 1)];
    for (const command of [a, b, c]) stack.push(command);
    attempt(stack, 'undo', () => true);
    for (const direction of ['undo', 'redo']) {
      const refused = attempt(stack, direction, () => outcome);
      assert.deepEqual([refused.outcome, refused.toasts], [outcome, [toast]], direction);
      const kept = contents(stack);
      assert.ok(kept.undo.length === 2 && kept.undo[0] === a && kept.undo[1] === b && kept.redo.length === 1 && kept.redo[0] === c, direction);
    }
    assert.deepEqual(attempt(stack, 'undo', () => true).applied, [b.before], 'Undo retries exactly the refused command');
    assert.deepEqual(attempt(stack, 'redo', () => true).applied, [b.after]);
  });
}
test('#883 AC5 an exception while applying is temporary: the command stays and no success is announced', () => {
  const stack = new CommandStack(50);
  const a = wall('f1', 0); stack.push(a);
  const refused = attempt(stack, 'undo', () => { throw new TypeError('unexpected'); });
  assert.deepEqual([refused.outcome, refused.toasts], ['retry', ['history.unavailable']]);
  assert.equal(stack.peekUndo(), a); assert.equal(stack.canRedo, false);
});
test('#883 AC5 a newer command or a clear during the attempt is never displaced or undone', () => {
  for (const outcome of [true, 'geometry']) {
    const stack = new CommandStack(50);
    const [a, b, c, newer] = [wall('f1', 0), wall('f1', 1), wall('f1', 2), { name: 'Split room', before: 2, after: 3 }];
    for (const command of [a, b, c]) stack.push(command);
    attempt(stack, 'undo', () => true);
    assert.equal(stack.peekRedo(), c);
    attempt(stack, 'undo', () => { stack.push(newer); return outcome; });
    const left = contents(stack);
    assert.ok(left.undo.length === 2 && left.undo[0] === a && left.undo[1] === newer, `${outcome}: the newer top stays, the attempted one left`);
    assert.equal(left.redo.length, 0, `${outcome}: the old redo branch is not restored`);
  }
  const stack = new CommandStack(50);
  stack.push(wall('f1', 0)); stack.push(wall('f1', 1));
  attempt(stack, 'undo', () => { stack.clear(); return 'state'; });
  assert.deepEqual([stack.canUndo, stack.canRedo], [false, false], 'a clear (external adoption) is not undone');
});
test('#883 AC4 success moves exactly one command per press with its named toast', () => {
  const stack = new CommandStack(50);
  const [a, b] = [wall('f1', 0), { name: 'Add line', before: 'x', after: 'y' }];
  stack.push(a); stack.push(b);
  const undo = attempt(stack, 'undo', () => true);
  assert.deepEqual([undo.outcome, undo.toasts, stack.undoName, stack.redoName], [true, ['history.undone{"name":"Add line"}'], 'Add wall', 'Add line']);
  const redo = attempt(stack, 'redo', () => true);
  assert.deepEqual([redo.toasts, stack.undoName, stack.canRedo], [['history.redone{"name":"Add line"}'], 'Add line', false]);
  assert.equal(attempt(new CommandStack(50), 'undo', () => true).outcome, null, 'nothing to undo: no attempt, no toast');
});
