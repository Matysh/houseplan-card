import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EditorRuntimeLoader } from '../test-build/editor-runtime-loader.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

test('editor runtime loader deduplicates concurrent intent and installs atomically', async () => {
  const pending = deferred();
  const states = [];
  const installed = [];
  let loads = 0;
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'same',
    load: async () => { loads++; return pending.promise; },
    install: (runtime) => installed.push(runtime),
    stateChanged: (state) => states.push(state),
  });

  const first = loader.ensure();
  const second = loader.ensure();
  assert.equal(loads, 1);
  assert.equal(loader.state, 'loading');
  assert.equal(installed.length, 0);

  pending.resolve({ fingerprint: 'same', create: () => ({ ready: true }) });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(loads, 1);
  assert.deepEqual(installed, [{ ready: true }]);
  assert.deepEqual(states, ['loading', 'ready']);
});

test('editor runtime loader retries the first failure exactly once', async () => {
  const attempts = [];
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'same',
    load: async (attempt) => {
      attempts.push(attempt);
      if (attempt === 0) throw new Error('404');
      return { fingerprint: 'same', create: () => 'runtime' };
    },
    install: () => {},
  });

  assert.equal(await loader.ensure(), true);
  assert.deepEqual(attempts, [0, 1]);
  assert.equal(await loader.ensure(), true);
  assert.deepEqual(attempts, [0, 1], 'a ready loader never imports again');
});

test('fingerprint mismatch fails closed after one retry and remains terminal', async () => {
  const attempts = [];
  const installed = [];
  const failures = [];
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'entry',
    load: async (attempt) => {
      attempts.push(attempt);
      return { fingerprint: 'other', create: () => 'mixed-runtime' };
    },
    install: (runtime) => installed.push(runtime),
    failed: (error) => failures.push(String(error)),
  });

  assert.equal(await loader.ensure(), false);
  assert.deepEqual(attempts, [0, 1]);
  assert.deepEqual(installed, []);
  assert.equal(loader.state, 'failed');
  assert.match(failures[0], /fingerprint mismatch/);

  assert.equal(await loader.ensure(), false);
  assert.deepEqual(attempts, [0, 1], 'terminal failure requires a page refresh');
});

test('lazy runtime boundary keeps the eager entry independent and does not grow any usage', () => {
  const card = readFileSync(join(repoRoot, 'src', 'houseplan-card.ts'), 'utf8');
  assert.doesNotMatch(
    card,
    /^import(?!\s+type\b)[^;]*houseplan-editor-runtime[^;]*;/m,
    'the eager card must not statically import the editor runtime',
  );
  const sources = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else if (/\.ts$/.test(name)) sources.push(readFileSync(path, 'utf8'));
    }
  };
  visit(join(repoRoot, 'src'));
  const anyCount = sources.reduce(
    (total, source) => total + (source.match(/\bany\b/g)?.length || 0), 0,
  );
  assert.ok(anyCount <= 1123, `src any count grew from 1123 to ${anyCount}`);
});

test('source type references stay portable across build hosts', () => {
  const sources = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else if (/\.ts$/.test(name)) sources.push(readFileSync(path, 'utf8'));
    }
  };
  visit(join(repoRoot, 'src'));
  assert.doesNotMatch(
    sources.join('\n'),
    /import\(["'][A-Za-z]:[\\/]/,
    'type imports must not capture an absolute Windows workspace path',
  );
});
