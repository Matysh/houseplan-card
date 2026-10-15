// #506: the summary chunk's code is cached per page, its runtime is per host.
import assert from 'node:assert/strict';
import test from 'node:test';

import { SummaryRuntimeLoader } from '../test-build/summary-runtime-loader.js';
import { ViewRuntimeBoundary } from '../test-build/view-runtime-boundary.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

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
  const readyA = loader.create(hostA);
  const readyB = loader.create(hostB);
  assert.ok(readyA, 'warm create returns the runtime synchronously');
  assert.ok(readyB);
  assert.notEqual(readyA, readyB, 'no runtime instance is shared between hosts');
  assert.equal(readyA.host, hostA);
  assert.equal(readyB.host, hostB);
  assert.equal(loads, 1, 'the code was loaded once for the page');
});

test('#506 AC2: concurrent cold mounts share one import but not one instance', async () => {
  const pending = deferred();
  let loads = 0;
  const loader = new SummaryRuntimeLoader(() => { loads++; return pending.promise; });
  const first = loader.ensure();
  const second = loader.ensure();
  assert.equal(loads, 1);
  assert.equal(loader.create({ id: 'cold' }), null, 'no runtime before the import lands');
  pending.resolve((host) => new Runtime(host));
  const [factoryA, factoryB] = await Promise.all([first, second]);
  assert.equal(factoryA, factoryB, 'concurrent callers receive the same immutable code');
  const seen = [loader.create({ id: 'a' }), loader.create({ id: 'b' })];
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0], seen[1]);
  assert.deepEqual(seen.map((runtime) => runtime.host.id), ['a', 'b']);
  assert.equal(loader.warm, true);
});

test('#506 AC2: the current boundary retires a cold attempt and reconnect installs once', async () => {
  const pending = deferred();
  const loader = new SummaryRuntimeLoader(() => pending.promise);
  const host = { id: 'reconnecting' };
  const seen = [];
  const owner = {};
  const boundary = new ViewRuntimeBoundary(host, loader, {
    owner: () => owner, current: claim => claim === owner,
    install: runtime => seen.push(runtime), changed: () => {},
  });
  boundary.connect();
  const first = boundary.ensure();
  boundary.disconnect();
  boundary.connect();
  const second = boundary.ensure();
  pending.resolve((h) => new Runtime(h));
  assert.equal(await first, false, 'the retired generation never installs');
  assert.equal(await second, true);
  assert.equal(seen.length, 1, 'the live boundary installs exactly once');
  assert.equal(seen[0].host, host);
  boundary.disconnect();
  assert.equal(seen.length, 1, 'disconnect never constructs another runtime');
});

test('#506 AC2: a failed import is forgotten so the next ensure may retry', async () => {
  const attempts = [];
  const loader = new SummaryRuntimeLoader(() => {
    const attempt = deferred();
    attempts.push(attempt);
    return attempt.promise;
  });
  const first = loader.ensure();
  attempts[0].reject(new Error('network'));
  await assert.rejects(first, /network/);
  assert.equal(loader.create({ id: 'first' }), null);
  assert.equal(loader.warm, false, 'a failure is not cached as the page state');

  const second = loader.ensure();
  assert.equal(attempts.length, 2, 'the next ensure starts a fresh import');
  attempts[1].resolve((host) => new Runtime(host));
  await second;
  assert.equal(loader.create({ id: 'second' }).host.id, 'second');
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
