import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enqueueSerializedWrite,
  optimisticAttempt,
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

// The rollback of an optimistic attempt moved to the identity owner (#500):
// see test/config-adoption.test.mjs (#439/#442 cases live there now).
test('optimisticAttempt snapshots the previous body by value (#439)', () => {
  const fingerprint = (value) => JSON.stringify(value);
  const previous = { settings: { enabled: true } };
  const attempted = { settings: { enabled: false } };
  const attempt = optimisticAttempt(previous, attempted, 'server-fingerprint', 7, fingerprint);
  assert.deepEqual(attempt.previous, previous);
  assert.notEqual(attempt.previous, previous, 'the rollback snapshot is isolated from later mutations');
  assert.equal(attempt.previousFingerprint, 'server-fingerprint');
  assert.equal(attempt.revision, 7);
  assert.equal(attempt.attempted, attempted);
  assert.equal(attempt.attemptedFingerprint, fingerprint(attempted));
});

// #842 К4/К5: the deferred write an immediate write superseded is re-armed
// once, only after its own rollback, and reads the live value when it runs —
// never a candidate captured in advance.
test('#842 a superseded deferred write is restored once, only on rollback, and reads the queue turn’s value', async () => {
  const { supersedeDeferredWrite } = await import('../test-build/config-adoption.js');
  let chain = Promise.resolve();
  let live = 'independent edit';
  const sent = [];
  let armed = false;
  let arms = 0;
  const deferred = Object.assign(() => { armed = true; arms += 1; }, {
    pending: () => armed,
    cancel: () => { armed = false; },
  });
  const fire = () => {
    armed = false;
    chain = enqueueSerializedWrite(chain, async () => { sent.push(live); });
    return chain;
  };

  deferred();
  const restore = supersedeDeferredWrite(deferred);
  assert.equal(armed, false, 'the immediate write carries the pending content');
  restore(true);
  restore(true);
  assert.equal(arms, 2, 'one re-arm, however often the failure path runs');
  live = 'edited after the rejection';
  await fire();
  assert.deepEqual(sent, ['edited after the rejection'], 'the restored write sends the live value of its turn');

  const notPending = supersedeDeferredWrite(deferred);
  notPending(true);
  assert.equal(arms, 2, 'nothing was pending — nothing is armed');

  deferred();
  const conflict = supersedeDeferredWrite(deferred);
  conflict(false);
  assert.equal(armed, false, 'no rollback (conflict, newer adoption) — no restoration');
});
