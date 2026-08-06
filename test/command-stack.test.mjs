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
