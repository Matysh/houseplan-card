import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { relativeDependencies, scanJavaScript } from '../scripts/relative-dependencies.mjs';
import { importClosure } from './helpers/import-closure.mjs';

test('#812 AC1/AC3: общий сканер находит поддержанные формы, не исполняя source', () => {
  const text = [
    '// import "./comment.mjs"; /* glob',
    'const quoted = "/* not a comment */";',
    'const url = "https://host//path";',
    'const fixture = `import "./fixture.mjs"; new URL("./fake-url.mjs", import.meta.url)`;',
    'const re = /import "[./]*ghost.mjs"/g;',
    'if (quoted) /[/*]/.test(quoted);',
    'const ratio = quoted.length / 2;',
    'import /* inline */ { a, b as renamed }',
    '  from "./static.mjs";',
    "import './side.mjs';",
    "export * as namespace from './reexport.mjs';",
    "export { a } from './named.mjs';",
    "import { from as value, 'quoted-name' as quotedName } from './named-strings.mjs';",
    "const dynamic = import /* inline */ ('./dynamic.mjs');",
    "const config = import('./config.json', { with: { type: 'json' } });",
    "const common = require('./common.cjs');",
    "const child = new URL( './worker.mjs', import.meta.url );",
    "const ignored = new URL('./document.md', import.meta.url);",
    "object.import('./method.mjs'); object.require('./method.cjs');",
    'const interpolated = `raw ${import("./expression.mjs")} still raw`;',
    "import './escaped\\u002emjs';",
    'throw new Error("scanner must never execute source");',
  ].join('\n');
  assert.deepEqual(relativeDependencies(text), [
    './static.mjs', './side.mjs', './reexport.mjs', './named.mjs', './named-strings.mjs', './dynamic.mjs',
    './config.json', './common.cjs', './worker.mjs', './expression.mjs', './escaped.mjs',
  ]);
  const scan = scanJavaScript(text);
  assert.equal(scan.withoutComments.length, text.length, 'offsets stable');
  assert.equal(scan.withoutComments.split('\n').length, text.split('\n').length, 'lines stable');
  assert.ok(scan.withoutComments.includes('"/* not a comment */"'));
  assert.ok(!scan.withoutComments.includes('./comment.mjs'));
  assert.deepEqual(relativeDependencies("/* import './no.mjs'; unterminated"), []);
});

const FILES = {
  'entry.mjs': [
    "import { execFileSync } from 'node:child_process';",
    "import { fileURLToPath } from 'node:url';",
    "import { answer } from './static.mjs';",
    "import './side.mjs';",
    "import { extra } from './reexport.mjs';",
    "const worker = new URL('./nested/worker.mjs', import.meta.url);",
    "const child = execFileSync(process.execPath, [fileURLToPath(worker)], { encoding: 'utf8' }).trim();",
    "console.log(JSON.stringify({ total: answer + extra + globalThis.side, child }));",
  ].join('\n'),
  'static.mjs': "import { n } from './nested/static-leaf.mjs'; export const answer = n;",
  'nested/static-leaf.mjs': 'export const n = 40;',
  'side.mjs': "import './nested/side-leaf.mjs';",
  'nested/side-leaf.mjs': 'globalThis.side = 1;',
  'reexport.mjs': "export { extra } from './nested/reexport-leaf.mjs';",
  'nested/reexport-leaf.mjs': 'export const extra = 1;',
  'nested/worker.mjs': "import { n } from './worker-leaf.mjs'; console.log(n);",
  'nested/worker-leaf.mjs': 'export const n = 42;',
};

function fixture(t, files = FILES) {
  const root = mkdtempSync(join(tmpdir(), 'hp-812-closure-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const path = join(root, 'source', file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

function copyClosure(root) {
  const source = join(root, 'source');
  const sandbox = join(root, 'sandbox');
  const files = importClosure(join(source, 'entry.mjs'));
  for (const file of files) {
    const target = join(sandbox, relative(source, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
  return { files, source, sandbox };
}

const run = (sandbox) => spawnSync(process.execPath, [join(sandbox, 'entry.mjs')], {
  cwd: sandbox, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' },
});

test('#812 AC3: sandbox выполняет transitive static/re-export/side-effect/script URL зависимости', (t) => {
  const { files, source, sandbox } = copyClosure(fixture(t));
  assert.deepEqual([...files].map((file) => relative(source, file).replaceAll('\\', '/')).sort(), Object.keys(FILES).sort());
  const result = run(sandbox);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { total: 42, child: '42' });
});

for (const edge of ['static', 'side', 'reexport', 'worker']) {
  test(`#812 AC3: удаление обязательного ${edge} transitive-модуля делает sandbox красным`, (t) => {
    const { sandbox } = copyClosure(fixture(t));
    rmSync(join(sandbox, 'nested', `${edge}-leaf.mjs`));
    const result = run(sandbox);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
    assert.match(result.stderr, new RegExp(`${edge}-leaf\\.mjs`));
  });
}

test('#812 AC3: циклы конечны, общий seen допускает несколько entry, пропавший source — ошибка', (t) => {
  const root = fixture(t, {
    'entry.mjs': "import './b.mjs';",
    'b.mjs': "export * from './entry.mjs';",
    'next.mjs': "import './b.mjs';",
    'broken.mjs': "import './missing.mjs';",
  });
  const source = join(root, 'source');
  const seen = importClosure(join(source, 'entry.mjs'));
  assert.equal(seen.size, 2);
  assert.equal(importClosure(join(source, 'next.mjs'), seen), seen);
  assert.equal(seen.size, 3);
  assert.throws(() => importClosure(join(source, 'broken.mjs')), /ENOENT.*missing\.mjs/);
});

test('#812 AC3: четыре workflow harness подключены к одному helper', () => {
  for (const name of ['process-track', 'publish-push-refusal', 'rebase-generated', 'ship-review']) {
    const text = readFileSync(new URL(`./${name}.test.mjs`, import.meta.url), 'utf8');
    assert.ok(relativeDependencies(text).includes('./helpers/import-closure.mjs'), name);
    assert.doesNotMatch(text, /function importClosure\(/, `${name}: локальной копии нет`);
  }
});
