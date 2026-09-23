import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverConfigWriteConflict } from '../test-build/config-write-conflict.js';

test('#612 AC1: a View conflict reloads without an editor runtime or exception', async () => {
  const events = [];

  assert.doesNotThrow(() => recoverConfigWriteConflict(null, () => {
    events.push('reload');
  }));

  assert.deepEqual(events, ['reload']);
});

test('#612: an editor conflict cancels its draft before reloading', () => {
  const events = [];
  recoverConfigWriteConflict(
    { _cancelPath: () => events.push('cancel') },
    () => { events.push('reload'); },
  );

  assert.deepEqual(events, ['cancel', 'reload']);
});
