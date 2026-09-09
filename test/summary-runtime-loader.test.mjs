// #506: the summary chunk's code is cached per page, its runtime is per host.
import assert from 'node:assert/strict';
import test from 'node:test';

import { SummaryRuntimeLoader } from '../test-build/summary-runtime-loader.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

const tick = () => new Promise((done) => setTimeout(done, 0));

class Runtime {
  constructor(host) { this.host = host; this.connected = 0; }
}

test('#506 AC1: a warm factory builds a distinct runtime for every host, synchronously', async () => {
  let loads = 0;
  const loader = new SummaryRuntimeLoader(async () => { loads++; return (host) => new Runtime(host); });
  assert.equal(loader.warm, false);
  assert.equal(loader.create({ id: 'cold' }), null, 'cold code cannot be created synchronously');

  await loader.ensure();
  assert.equal(loader.warm, true);
  const hostA = { id: 'a' };
  const hostB = { id: 'b' };
  const readyA = [];
  const readyB = [];
  loader.attach(hostA, (runtime) => readyA.push(runtime));
  loader.attach(hostB, (runtime) => readyB.push(runtime));
  assert.equal(readyA.length, 1, 'warm attach runs ready before returning');
  assert.equal(readyB.length, 1);
  assert.notEqual(readyA[0], readyB[0], 'no runtime instance is shared between hosts');
  assert.equal(readyA[0].host, hostA);
  assert.equal(readyB[0].host, hostB);
  assert.equal(loads, 1, 'the code was loaded once for the page');
});

test('#506 AC2: concurrent cold mounts share one import but not one instance', async () => {
  const pending = deferred();
  let loads = 0;
  const loader = new SummaryRuntimeLoader(() => { loads++; return pending.promise; });
  const seen = [];
  loader.attach({ id: 'a' }, (runtime) => seen.push(runtime));
  loader.attach({ id: 'b' }, (runtime) => seen.push(runtime));
  assert.equal(loads, 1);
  assert.equal(seen.length, 0, 'nothing is attached before the import lands');
  pending.resolve((host) => new Runtime(host));
  await tick();
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0], seen[1]);
  assert.deepEqual(seen.map((runtime) => runtime.host.id), ['a', 'b']);
  assert.equal(loader.warm, true);
});

test('#506 AC2: a cancelled attachment never reaches its host; a reconnect attaches once', async () => {
  const pending = deferred();
  const loader = new SummaryRuntimeLoader(() => pending.promise);
  const host = { id: 'reconnecting' };
  const stale = [];
  const fresh = [];
  const first = loader.attach(host, (runtime) => stale.push(runtime));
  first.cancel(); // disconnected while the chunk was still loading
  const second = loader.attach(host, (runtime) => fresh.push(runtime));
  pending.resolve((h) => new Runtime(h));
  await tick();
  assert.deepEqual(stale, [], 'the cancelled attempt must not run its side effects');
  assert.equal(fresh.length, 1, 'the live attempt attaches exactly once');
  assert.equal(fresh[0].host, host);
  second.cancel(); // cancelling a completed attachment is a no-op
  assert.equal(fresh.length, 1);
});

test('#506 AC2: a failed import is forgotten so the next attach may retry', async () => {
  const attempts = [];
  const loader = new SummaryRuntimeLoader(() => {
    const attempt = deferred();
    attempts.push(attempt);
    return attempt.promise;
  });
  const seen = [];
  loader.attach({ id: 'first' }, (runtime) => seen.push(runtime));
  attempts[0].reject(new Error('network'));
  await tick();
  assert.equal(seen.length, 0);
  assert.equal(loader.warm, false, 'a failure is not cached as the page state');

  loader.attach({ id: 'second' }, (runtime) => seen.push(runtime));
  assert.equal(attempts.length, 2, 'the next attach starts a fresh import');
  attempts[1].resolve((host) => new Runtime(host));
  await tick();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].host.id, 'second');
  assert.equal(loader.warm, true);
});

test('#506: ensure() rejects to its caller and a reset returns the page to cold', async () => {
  let fail = true;
  const loader = new SummaryRuntimeLoader(async () => {
    if (fail) throw new Error('chunk missing');
    return (host) => new Runtime(host);
  });
  await assert.rejects(loader.ensure(), /chunk missing/);
  fail = false;
  await loader.ensure();
  assert.equal(loader.warm, true);
  loader.reset();
  assert.equal(loader.warm, false);
  assert.equal(loader.create({}), null);
});
