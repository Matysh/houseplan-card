import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveInitialSpace, settleBestEffort } from '../test-build/initial-load.js';

test('initial space follows hash, saved, default and first live precedence', () => {
  const base = { spaceIds: ['home', 'upstairs'] };
  assert.deepEqual(resolveInitialSpace({
    ...base, hashSpace: 'upstairs', savedSpace: 'home', defaultSpace: 'home',
  }), { id: 'upstairs', source: 'hash' });
  assert.deepEqual(resolveInitialSpace({
    ...base, hashSpace: 'stale', savedSpace: 'upstairs', defaultSpace: 'home',
  }), { id: 'upstairs', source: 'saved' });
  assert.deepEqual(resolveInitialSpace({
    ...base, hashSpace: 'stale', savedSpace: 'gone', defaultSpace: 'upstairs',
  }), { id: 'upstairs', source: 'default' });
  assert.deepEqual(resolveInitialSpace({
    ...base, hashSpace: 'stale', savedSpace: 'gone', defaultSpace: 'missing',
  }), { id: 'home', source: 'first' });
});

test('legacy current id is not a cold-start persistence source', () => {
  assert.deepEqual(resolveInitialSpace({
    spaceIds: ['home', 'f1'], currentSpace: 'f1', preserveCurrent: false,
  }), { id: 'home', source: 'first' });
  assert.deepEqual(resolveInitialSpace({
    spaceIds: ['home', 'upstairs'], currentSpace: 'f1', preserveCurrent: true,
  }), { id: 'home', source: 'first' });
});

test('a new explicit hash wins once, then adopted navigation is preserved', () => {
  assert.deepEqual(resolveInitialSpace({
    spaceIds: ['home', 'upstairs'], currentSpace: 'upstairs', preserveCurrent: true,
    savedSpace: 'home', defaultSpace: 'home',
  }), { id: 'upstairs', source: 'current' });
  assert.deepEqual(resolveInitialSpace({
    spaceIds: ['home', 'upstairs'], hashSpace: 'home', currentSpace: 'upstairs',
    preserveCurrent: true, savedSpace: 'upstairs',
  }), { id: 'home', source: 'hash' });
  assert.deepEqual(resolveInitialSpace({
    spaceIds: ['home', 'upstairs'], hashSpace: 'home', acceptHash: false,
    currentSpace: 'upstairs', preserveCurrent: true, savedSpace: 'home',
  }), { id: 'upstairs', source: 'current' });
});

test('empty model has no invented selection', () => {
  assert.deepEqual(resolveInitialSpace({
    spaceIds: [], hashSpace: 'home', savedSpace: 'home', defaultSpace: 'home',
  }), { id: null, source: 'none' });
});

test('best-effort optional work starts every attempt and contains rejections', async () => {
  const calls = [];
  const results = await settleBestEffort([
    async () => { calls.push('config'); throw new Error('unauthorized'); },
    () => { calls.push('trail'); throw new Error('sync rejection'); },
    async () => { calls.push('layout'); return 'subscribed'; },
  ]);
  assert.deepEqual(calls, ['config', 'trail', 'layout']);
  assert.deepEqual(results.map((result) => result.status), ['rejected', 'rejected', 'fulfilled']);
  assert.equal(results[2].status === 'fulfilled' ? results[2].value : null, 'subscribed');
});
