import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForPriorConfigWrite } from '../test-build/prior-config-write.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

test('settled historical config refusal does not poison a new independent intent', async () => {
  const error = Object.assign(new Error('earlier refused save'), { code: 'forbidden' });
  const tail = Promise.reject(error);
  await assert.rejects(tail, e => e === error);
  const host = { _writeChain: tail, _writesPending: 0 };
  await waitForPriorConfigWrite(host);
  assert.equal(host._writeChain, tail, 'waiter must not replace or repair the shared queue');
  await assert.rejects(host._writeChain, e => e === error, 'original write result stays rejected');
  assert.equal(host._writesPending, 0);
});

test('a pending config refusal still aborts paired work even when its counter clears before rejection is observed', async () => {
  const pending = deferred(), error = new Error('current write refused');
  const host = { _writeChain: pending.promise, _writesPending: 1 };
  let pairedRequests = 0;
  const operation = waitForPriorConfigWrite(host).then(() => { pairedRequests++; });
  const refusal = assert.rejects(operation, e => e === error);
  host._writesPending = 0;
  pending.reject(error);
  await refusal;
  assert.equal(pairedRequests, 0);
  assert.equal(host._writeChain, pending.promise);
});

test('a new intent after the refused pending attempt can proceed without changing its queue result', async () => {
  const pending = deferred(), host = { _writeChain: pending.promise, _writesPending: 1 };
  const first = assert.rejects(waitForPriorConfigWrite(host), /refused/);
  pending.reject(new Error('refused'));
  await first;
  host._writesPending = 0;
  await waitForPriorConfigWrite(host);
  assert.equal(host._writeChain, pending.promise);
});

test('a successful pending config write is awaited before paired dispatch', async () => {
  const pending = deferred(), host = { _writeChain: pending.promise, _writesPending: 2 };
  let dispatched = false;
  const operation = waitForPriorConfigWrite(host).then(() => { dispatched = true; });
  await Promise.resolve();
  assert.equal(dispatched, false);
  pending.resolve();
  await operation;
  assert.equal(dispatched, true);
  assert.equal(host._writesPending, 2, 'only the queue owner decrements pending work');
  assert.equal(host._writeChain, pending.promise);
});
