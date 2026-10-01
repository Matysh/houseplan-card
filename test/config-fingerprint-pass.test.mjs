import assert from 'node:assert/strict';
import test from 'node:test';

import { ConfigFingerprintPass } from '../test-build/config-fingerprint-pass.js';

/** A builder that counts how often the fingerprint is walked. */
const counter = () => {
  const built = { count: 0 };
  return { built, build: () => { built.count += 1; return `fingerprint-${built.count}`; } };
};

test('#725 AC2: 50 reads inside one pass build the fingerprint once', () => {
  const pass = new ConfigFingerprintPass();
  const { built, build } = counter();
  const config = { spaces: [] };
  pass.begin();
  const values = Array.from({ length: 50 }, () => pass.read(3, config, build));
  pass.end();
  assert.equal(built.count, 1);
  assert.deepEqual(new Set(values), new Set(['fingerprint-1']), 'every read gets the same fingerprint');
});

test('#725 AC2: an epoch change inside the pass builds again', () => {
  const pass = new ConfigFingerprintPass();
  const { built, build } = counter();
  const config = { spaces: [] };
  pass.begin();
  pass.read(3, config, build);
  pass.read(3, config, build);
  // willUpdate bumps `_cfgEpoch` after its first `_model` read.
  assert.equal(pass.read(4, config, build), 'fingerprint-2');
  pass.read(4, config, build);
  pass.end();
  assert.equal(built.count, 2);
});

test('#725 AC2: a new config object or a new spaces array inside the pass builds again', () => {
  const pass = new ConfigFingerprintPass();
  const { built, build } = counter();
  const config = { spaces: [] };
  pass.begin();
  pass.read(3, config, build);
  const replaced = { spaces: config.spaces };
  pass.read(3, replaced, build);
  pass.read(3, replaced, build);
  assert.equal(built.count, 2, 'a replaced config object');
  replaced.spaces = [{ id: 'floor-2' }];
  pass.read(3, replaced, build);
  pass.read(3, replaced, build);
  assert.equal(built.count, 3, 'a replaced spaces array');
  pass.read(3, null, build);
  pass.read(3, null, build);
  assert.equal(built.count, 4, 'no config at all');
  pass.end();
});

test('#725 AC2: reads outside a pass build on every read', () => {
  const pass = new ConfigFingerprintPass();
  const { built, build } = counter();
  const config = { spaces: [] };
  for (let i = 0; i < 5; i++) pass.read(3, config, build);
  assert.equal(built.count, 5, 'before the first pass: handlers, timers');
  pass.begin();
  pass.read(3, config, build);
  pass.read(3, config, build);
  pass.end();
  assert.equal(built.count, 6);
  assert.equal(pass.read(3, config, build), 'fingerprint-7', 'after end() the remembered value is not used');
  pass.read(3, config, build);
  assert.equal(built.count, 8, 'updated() and later handlers see an in-place mutation (HP-1454-04)');
});

test('#725 AC2: a new pass forgets the previous one', () => {
  const pass = new ConfigFingerprintPass();
  const { built, build } = counter();
  const config = { spaces: [] };
  pass.begin();
  pass.read(3, config, build);
  pass.begin();
  pass.read(3, config, build);
  pass.end();
  assert.equal(built.count, 2, 'an in-place edit between passes is seen by the next pass');
});

test('#725 AC2: a pass that never reaches end() closes itself in a microtask', async () => {
  const pass = new ConfigFingerprintPass();
  const { built, build } = counter();
  const config = { spaces: [] };
  pass.begin(); // willUpdate() threw: Lit never calls render()
  pass.read(3, config, build);
  await null;
  pass.read(3, config, build);
  pass.read(3, config, build);
  assert.equal(built.count, 3, 'a handler after the failed update builds on every read');

  pass.begin();
  pass.end(); // pass A rendered normally; its microtask is still queued
  let builtInsideB = -1;
  queueMicrotask(() => {
    const before = built.count;
    pass.read(3, config, build);
    pass.read(3, config, build);
    builtInsideB = built.count - before;
  });
  pass.begin(); // pass B opens before A's microtask runs
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(builtInsideB, 1, "A's microtask leaves pass B open");
  pass.read(3, config, build);
  pass.read(3, config, build);
  assert.equal(built.count, 6, "B's own microtask closes B");
});
