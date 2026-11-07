import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { EditorRuntimeLoader, safeRuntimeDiagnostic } from '../test-build/editor-runtime-loader.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function countAnyTypes(text) {
  const source = ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true);
  let count = 0;
  const visit = node => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) count++;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

test('#1307 type census ignores prose and counts real any annotations', () => {
  assert.equal(countAnyTypes('// any\n/** any */\nconst any = "any"; type Named = { any: string };'), 0);
  assert.equal(countAnyTypes('let value: any; type Items = Array<any>; const cast = value as any;'), 3);
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

test('runtime diagnostics expose only allowlisted metadata', () => {
  const secrets = [
    'space.private_identifier|abc123',
    'https://private.invalid/iso.js?token=secret-value',
    new Error('sensor.private_identifier\nhttps://private.invalid/?auth=secret'),
  ];
  for (const secret of secrets) {
    const diagnostic = safeRuntimeDiagnostic('structural', secret, true);
    assert.deepEqual(diagnostic, {
      kind: 'structural', fingerprint: 'redacted', terminal: true,
    });
    assert.ok(Object.isFrozen(diagnostic));
    assert.doesNotMatch(JSON.stringify(diagnostic), /private|sensor\.|https?:|token|auth|secret/i);
  }
  assert.deepEqual(safeRuntimeDiagnostic('runtime-load', 'abc123', false), {
    kind: 'runtime-load', fingerprint: 'abc123', terminal: false,
  });
});
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
    (total, source) => total + countAnyTypes(source), 0,
  );
  // #1307: the accepted source has 993 AnyKeyword nodes. Comments, strings and
  // property names cannot spend the type budget; additional any types still fail.
  assert.ok(anyCount <= 993, `src any type count grew from 993 to ${anyCount}`);
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

test('a render reconcile never starts another cycle after a network failure (#757 AC3)', async () => {
  let cycles = 0;
  let online = false;
  const failures = [];
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'same',
    load: async (attempt) => {
      if (attempt === 0) cycles++;
      if (!online) throw new Error('net::ERR_FAILED');
      return { fingerprint: 'same', create: () => 'runtime' };
    },
    install: () => {},
    failed: (error, info) => failures.push(info.terminal),
  });

  assert.equal(await loader.ensure('reconcile'), false, 'a surface waiting for the runtime starts the first cycle');
  assert.equal(cycles, 1);
  assert.equal(loader.state, 'idle', 'the failure stays non-terminal');
  for (let render = 0; render < 5; render++) assert.equal(await loader.ensure('reconcile'), false);
  online = true;
  assert.equal(await loader.ensure('reconcile'), false, 'a render after the network is back is still not an intent');
  assert.equal(cycles, 1, 'no render started a cycle of its own');
  assert.deepEqual(failures, [false], 'one failure, one notice');

  online = false;
  assert.equal(await loader.ensure(), false, 'an explicit intent starts a fresh cycle');
  assert.equal(cycles, 2);
  assert.equal(await loader.ensure('reconcile'), false, 'and its failure waits for the next intent again');
  assert.equal(cycles, 2);

  online = true;
  const explicit = loader.ensure();
  assert.equal(loader.ensure('reconcile'), explicit, 'a render joins the explicit cycle in flight');
  assert.equal(await explicit, true);
  assert.equal(cycles, 3);
  assert.equal(await loader.ensure('reconcile'), true, 'ready answers a render too');
});

test('a render reconcile after a terminal failure stays terminal (#757 AC3)', async () => {
  let loads = 0;
  const loader = new EditorRuntimeLoader({
    expectedFingerprint: 'entry',
    load: async () => { loads++; return { fingerprint: 'other', create: () => 'foreign' }; },
    install: () => {},
  });
  assert.equal(await loader.ensure('reconcile'), false);
  assert.equal(loader.state, 'failed');
  assert.equal(await loader.ensure('reconcile'), false);
  assert.equal(await loader.ensure(), false);
  assert.equal(loads, 2, 'one cycle of two attempts, never another import');
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

test('user-facing card loaders route their toast through lazyLoadFailureMessage (#353 AC5)', async () => {
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
  assert.equal(callbacks.length, 4,
    'editor, onboarding, PDF and hidden isometric runtimes all declare failed callbacks');
  let forwardedCallbacks = 0;
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
    if (forwards) forwardedCallbacks++;
  }
  assert.equal(forwardedCallbacks, 3,
    'editor, onboarding and PDF are user-facing; all must forward terminality to the toast');
});
const parse = path => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
  path.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
const walk = (node, visit) => { visit(node); ts.forEachChild(node, child => walk(child, visit)); };
const removed = new Set([
  '_physicalDrag', '_physicalRotate', '_physicalLastTap', '_physicalPickCycle',
  '_physicalDown', '_physicalMove', '_physicalUp', '_cancelPhysicalGesture',
  '_physicalRotateDown', '_physicalRotateMove', '_physicalRotateUp', '_physicalRegisterTap',
  '_bdDrag', '_bdBase', '_bdRect', '_bdParams', '_bdActive', '_bdMovable', '_bdMoved', '_bdLive',
  '_bdApply', '_bdStart', '_bdMove', '_bdMoveNow', '_bdReset', '_bdUp', '_renderBackdropFrame',
]);

test('#861 gesture owners replace state, delegates and port members, not just their forwarding bodies', () => {
  for (const file of ['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts']) {
    walk(parse(file), node => {
      if (ts.isPropertyAccessExpression(node)) assert.ok(!removed.has(node.name.text), `${file}: ${node.name.text}`);
      if (ts.isClassElement(node) || ts.isTypeElement(node))
        assert.ok(!removed.has(node.name?.getText().replace(/^['"]|['"]$/g, '')), `${file}: old declaration ${node.name?.getText()}`);
    });
  }
});

test('#861 both owners have bounded purpose ports and no card/HostPort value dependency', () => {
  for (const [file, port, count] of [
    ['src/physical-body-gesture.ts', 'PhysicalBodyGesturePort', 13],
    ['src/backdrop-frame-gesture.ts', 'BackdropFrameGesturePort', 16],
  ]) {
    const source = parse(file);
    const declaration = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === port);
    assert.equal(declaration.members.length, count);
    assert.ok(declaration.members.length <= 16);
    walk(source, node => {
      if (ts.isImportDeclaration(node)) assert.ok(!/houseplan-(?:card|editor-runtime)/.test(node.moduleSpecifier.text));
      if (ts.isIdentifier(node)) assert.notEqual(node.text, 'HouseplanEditorHostPort');
      assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword);
    });
  }
});

test('#861 owner modules remain editor-lazy and callers cannot retain the removed aliases', () => {
  const card = parse('src/houseplan-card.ts');
  for (const node of card.statements.filter(ts.isImportDeclaration)) {
    if (!node.importClause?.isTypeOnly)
      assert.ok(!/(?:physical-body|backdrop-frame)-gesture/.test(node.moduleSpecifier.text));
  }
  const files = ['src/live-editor.ts', 'src/live-interaction-runtime.ts', 'src/version-recovery-card.ts',
    ...['demo', 'test'].flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.mjs')).map(name => join(dir, name)))];
  for (const file of files) walk(parse(file), node => {
    if (ts.isPropertyAccessExpression(node)) assert.ok(!removed.has(node.name.text), `${file}: ${node.name.text}`);
    if (ts.isPropertyAssignment(node)) assert.ok(!removed.has(node.name.getText().replace(/^['"]|['"]$/g, '')), `${file}: obsolete owner fixture`);
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression))
      assert.ok(!removed.has(node.argumentExpression.text), `${file}: ${node.argumentExpression.text}`);
  });
});

test('#1344 preload deduplicates code without installing or showing loading UI', async () => {
  const pending = deferred(), states = [], failures = [], loads = [];
  let creates = 0, installs = 0, language = 'ru';
  const prepared = [];
  const module = { fingerprint: 'same', prepare: async (quiet = false) => { prepared.push([language, quiet]); },
    create: () => { creates++; return {}; } };
  const loader = new EditorRuntimeLoader({ expectedFingerprint: 'same',
    load: (attempt, fresh) => { loads.push([attempt, fresh]); return pending.promise; },
    install: () => installs++, stateChanged: s => states.push(s), failed: e => failures.push(e) });
  const one = loader.preload(), two = loader.preload();
  await Promise.resolve();
  assert.equal(loader.state, 'idle');
  assert.equal(creates, 0);
  assert.deepEqual(states, []);
  pending.resolve(module);
  assert.deepEqual(await Promise.all([one, two]), [true, true]);
  assert.equal(installs, 0);
  assert.deepEqual(failures, []);
  language = 'en';
  assert.equal(await loader.ensure(), true);
  assert.deepEqual(prepared, [['ru', true], ['en', false]]);
  assert.equal(creates, 1);
  assert.equal(installs, 1);
  assert.equal(loads.length, 1);
  assert.deepEqual(states, ['loading', 'ready']);
});

test('#1344 failed hover preserves two real explicit attempts using fresh URLs', async () => {
  const loads = [], failures = [];
  let installs = 0;
  const loader = new EditorRuntimeLoader({ expectedFingerprint: 'same',
    load: async (attempt, fresh) => {
      loads.push([attempt, !!fresh]);
      if (loads.length <= 2) throw Error('Network failed');
      return { fingerprint: 'same', create: () => ({}) };
    }, install: () => installs++, failed: e => failures.push(e) });
  assert.equal(await loader.preload(), false);
  assert.equal(loader.state, 'idle');
  assert.deepEqual(failures, []);
  assert.equal(await loader.ensure(), true);
  assert.deepEqual(loads, [[0, false], [0, true], [1, false]]);
  assert.equal(installs, 1);
  assert.deepEqual(failures, []);
});

test('#1344 click during rejected preload starts a fresh explicit cycle', async () => {
  const pending = deferred(), loads = [];
  const loader = new EditorRuntimeLoader({ expectedFingerprint: 'same',
    load: (attempt, fresh) => {
      loads.push([attempt, !!fresh]);
      return loads.length === 1 ? pending.promise
        : Promise.resolve({ fingerprint: 'same', create: () => ({}) });
    }, install: () => {} });
  const hover = loader.preload();
  await Promise.resolve();
  const click = loader.ensure();
  pending.reject(Error('Connection lost'));
  assert.equal(await hover, false);
  assert.equal(await click, true);
  assert.deepEqual(loads, [[0, false], [0, true]]);
});

test('#1344 preload fingerprint and synchronous failures are silent and recoverable', async () => {
  let calls = 0, creates = 0, failures = 0;
  const loader = new EditorRuntimeLoader({ expectedFingerprint: 'same',
    load: () => {
      calls++;
      if (calls === 1) throw Error('synchronous failure');
      return Promise.resolve({ fingerprint: calls === 2 ? 'other' : 'same', create: () => { creates++; return {}; } });
    }, install: () => {}, failed: () => failures++ });
  assert.equal(await loader.preload(), false);
  assert.equal(await loader.preload(), false);
  assert.equal(loader.state, 'idle');
  assert.equal(creates, 0);
  assert.equal(failures, 0);
  assert.equal(await loader.ensure(), true);
  assert.equal(creates, 1);
  assert.equal(failures, 0);
});

 test('#1344 failed dependency preparation retains verified code and its dictionary cache', async () => {
  let loads = 0, prepares = 0, installs = 0;
  const module = { fingerprint: 'same', prepare: async quiet => {
    prepares++; if (quiet) throw Error('dictionary import failed');
  }, create: () => ({}) };
  const loader = new EditorRuntimeLoader({ expectedFingerprint: 'same',
    load: async () => { loads++; return module; }, install: () => installs++ });
  assert.equal(await loader.preload(), false);
  assert.equal(await loader.preload(), false);
  assert.equal(loader.state, 'idle'); assert.equal(installs, 0);
  assert.equal(await loader.ensure(), true);
  assert.equal(loads, 1); assert.equal(prepares, 2); assert.equal(installs, 1);
});
