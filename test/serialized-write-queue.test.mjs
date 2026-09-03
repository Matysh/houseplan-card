import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enqueueSerializedWrite,
  optimisticAttempt,
  rollbackOptimistic,
} from '../test-build/serialized-write-queue.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('a queued config write reads edits made while the previous write is in flight (#224)', async () => {
  const firstStarted = deferred();
  const releaseFirst = deferred();
  let localConfig = 'first';
  const observed = [];
  let chain = Promise.resolve();

  const enqueue = () => {
    chain = enqueueSerializedWrite(chain, async () => {
      observed.push(localConfig);
      if (observed.length === 1) {
        firstStarted.resolve();
        await releaseFirst.promise;
      }
    });
    return chain;
  };

  const first = enqueue();
  await firstStarted.promise;
  localConfig = 'second';
  const second = enqueue();
  localConfig = 'latest edit during await';

  assert.deepEqual(observed, ['first'], 'the second write waits its turn');
  releaseFirst.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(observed, ['first', 'latest edit during await']);
});

test('a failed write does not poison the next queued edit (#224)', async () => {
  const seen = [];
  const failed = enqueueSerializedWrite(Promise.resolve(), async () => {
    seen.push('failed');
    throw new Error('offline');
  });
  const recovered = enqueueSerializedWrite(failed, async () => { seen.push('recovered'); });

  await assert.rejects(failed, /offline/);
  await recovered;
  assert.deepEqual(seen, ['failed', 'recovered']);
});

test('a rejected optimistic write restores only its own candidate (#439)', () => {
  const fingerprint = (value) => JSON.stringify(value);
  const previous = { settings: { enabled: true } };
  const attempted = { settings: { enabled: false } };
  const attempt = optimisticAttempt(previous, attempted, 'server-fingerprint', 7, fingerprint);
  let updates = 0;
  const host = {
    _serverCfg: attempted,
    _cfgRev: 7,
    _cfgContentFingerprint: fingerprint(attempted),
    requestUpdate: () => { updates += 1; },
  };

  assert.equal(rollbackOptimistic(host, attempt, fingerprint), true);
  assert.deepEqual(host._serverCfg, previous);
  assert.notEqual(host._serverCfg, previous, 'the rollback snapshot is isolated from later mutations');
  assert.equal(host._cfgContentFingerprint, 'server-fingerprint');
  assert.equal(updates, 1);
});

test('a conflict reload or newer mutation wins over a rejected candidate (#439)', () => {
  const fingerprint = (value) => JSON.stringify(value);
  const previous = { settings: { value: 'server-before' } };
  const attempted = { settings: { value: 'draft' } };
  const attempt = optimisticAttempt(previous, attempted, 'before', 3, fingerprint);
  const authoritative = { settings: { value: 'server-after' } };
  let updates = 0;
  const host = {
    _serverCfg: authoritative,
    _cfgRev: 4,
    _cfgContentFingerprint: fingerprint(authoritative),
    requestUpdate: () => { updates += 1; },
  };

  assert.equal(rollbackOptimistic(host, attempt, fingerprint), false);
  assert.equal(host._serverCfg, authoritative);
  assert.equal(updates, 0);

  host._cfgRev = 3;
  host._serverCfg = { settings: { value: 'newer-local-edit' } };
  assert.equal(rollbackOptimistic(host, attempt, fingerprint), false);
  assert.equal(host._serverCfg.settings.value, 'newer-local-edit');
  assert.equal(updates, 0);
});
