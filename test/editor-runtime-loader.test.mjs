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

test('lazy runtime event handlers keep the runtime receiver', () => {
  const runtime = readFileSync(join(repoRoot, 'src', 'houseplan-editor-runtime.ts'), 'utf8');
  const bareHandlers = [...runtime.matchAll(/@[a-zA-Z-]+=\$\{this\.(_[A-Za-z0-9]+)\}/g)]
    .map((match) => match[1]);
  assert.deepEqual(
    bareHandlers,
    [],
    `Lit binds bare listeners to the host element, not the lazy runtime: ${bareHandlers.join(', ')}`,
  );
});

test('documentation capture materializes the complete bundle tree', () => {
  const capture = readFileSync(join(repoRoot, 'demo', 'docs', 'capture.mjs'), 'utf8');
  assert.match(capture, /import ['"]\.\.\/\.\.\/scripts\/bundle-sync\.mjs['"]/);
  assert.doesNotMatch(capture, /copyFileSync\(BUNDLE,\s*DEMO_BUNDLE\)/);
});

test('network failure re-arms the loader for the next explicit intent (#353 AC1)', async () => {
  const attempts = [];
  const failures = [];
  let cycles = 0;
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'same',
    load: async (attempt) => {
      if (attempt === 0) cycles++;
      attempts.push(attempt);
      if (cycles < 3) throw new Error('net::ERR_INTERNET_DISCONNECTED');
      return { fingerprint: 'same', create: () => 'runtime' };
    },
    install: () => {},
    failed: (error, info) => failures.push({ error: String(error), terminal: info.terminal }),
  });

  assert.equal(await loader.ensure(), false);
  assert.equal(loader.state, 'idle', 'a network failure must not be terminal');
  assert.deepEqual(attempts, [0, 1]);

  assert.equal(await loader.ensure(), false, 'second press runs a fresh cycle');
  assert.deepEqual(attempts, [0, 1, 0, 1]);
  assert.equal(failures.length, 2, 'every failed cycle is reported');
  assert.ok(failures.every((failure) => failure.terminal === false));

  assert.equal(await loader.ensure(), true, 'third press succeeds');
  assert.equal(loader.state, 'ready');
  assert.equal(failures.length, 2);
});

test('fingerprint mismatch on either attempt is terminal (#353 AC2)', async () => {
  const attempts = [];
  const failures = [];
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'entry',
    load: async (attempt) => {
      attempts.push(attempt);
      if (attempt === 0) return { fingerprint: 'other', create: () => 'foreign' };
      throw new Error('net::ERR_FAILED');
    },
    install: () => {},
    failed: (error, info) => failures.push(info.terminal),
  });

  assert.equal(await loader.ensure(), false);
  assert.equal(loader.state, 'failed', 'a foreign build was observed — only a refresh helps');
  assert.deepEqual(failures, [true]);
  assert.equal(await loader.ensure(), false);
  assert.deepEqual(attempts, [0, 1], 'terminal failure never imports again');
});

test('lazy failure toast wording follows terminality (#353 AC5)', async () => {
  const { lazyLoadFailureMessage } = await import('../test-build/editor-runtime-loader.js');
  const t = (key) => `<${key}>`;
  assert.equal(
    lazyLoadFailureMessage(t, { terminal: true }),
    '<editor.load_failed> <editor.refresh_advice>',
  );
  assert.equal(
    lazyLoadFailureMessage(t, { terminal: false }),
    '<editor.load_failed> <editor.retry_advice>',
  );
});

test('both card loaders route their toast through lazyLoadFailureMessage (#353 AC5)', async () => {
  const ts = (await import('typescript')).default;
  const source = readFileSync(join(repoRoot, 'src', 'houseplan-card.ts'), 'utf8');
  const file = ts.createSourceFile(
    'houseplan-card.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
  const callbacks = [];
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)
        && node.name.getText(file) === 'failed'
        && ts.isArrowFunction(node.initializer)) {
      callbacks.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.equal(callbacks.length, 2, 'editor and onboarding loaders both declare failed callbacks');
  for (const callback of callbacks) {
    assert.equal(callback.parameters.length, 2, 'the failure info parameter must be declared');
    const infoName = callback.parameters[1].name.getText(file);
    let forwards = false;
    const inspect = (node) => {
      if (ts.isCallExpression(node)
          && node.expression.getText(file) === 'lazyLoadFailureMessage'
          && node.arguments.length === 2
          && node.arguments[1].getText(file) === infoName) {
        forwards = true;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(callback.body);
    assert.ok(
      forwards,
      'the failed callback must forward its info argument into lazyLoadFailureMessage — '
        + 'a hardcoded terminality would show the wrong advice',
    );
  }
});
