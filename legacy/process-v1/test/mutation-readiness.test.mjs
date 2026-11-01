import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkMutationRegistry, registryProblems } from '../scripts/mutation-registry-check.mjs';
import { freezeMutationRange } from '../scripts/mutation-readiness-input.mjs';
import { preparationProblems } from '../scripts/mutation-preparation.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const inventory = 'The guideline is `200`.\n\n| Category | Count | Why |\n| --- | ---: | --- |\n| Static | 0 | no browsers |\n| **Total** | **0 / 200** | total |\n\n## Reviewed per-mutant inventory\n### Static\n';
const definition = (over = {}) => ({ id: 'alpha', because: 'static fixture', guard: 'node --test test/oracle.test.mjs',
  patches: [{ file: 'src/a.ts', find: 'before', replace: 'after' }], ...over });
const sources = { 'src/a.ts': 'before', 'test/oracle.test.mjs': 'throw new Error("execution forbidden");',
  'docs/testing-notes/mutation-browser-guards.md': inventory };

test('#854 static schema/targets/anchors/commands reject broken definitions and cache reads', () => {
  const run = (mutants, data = sources) => {
    let reads = 0;
    const log = [];
    const code = checkMutationRegistry(mutants, { read: (path) => { reads++; return data[path] ?? null; }, log: (line) => log.push(line) });
    return { code, reads, log: log.join('\n') };
  };
  const valid = run([definition(), definition({ id: 'beta' })]);
  assert.equal(valid.code, 0, valid.log);
  assert.equal(valid.reads, 3, 'one read per shared source, not per definition');
  assert.match(valid.log, /execution=0 caught=unknown/);
  for (const [mutants, data, message] of [
    [[definition(), definition()], sources, /duplicate id/],
    [[definition({ patches: [] })], sources, /nonempty patches/],
    [[definition({ patches: [{ file: '../outside', find: 'x', replace: 'y' }] })], sources, /unsafe target/],
    [[definition()], { ...sources, 'src/a.ts': null }, /target missing/],
    [[definition()], { ...sources, 'src/a.ts': 'absent' }, /якорь найден 0/],
    [[definition()], { ...sources, 'src/a.ts': 'before before' }, /якорь найден 2/],
    [[definition({ guard: '' })], sources, /missing guard/],
    [[definition({ oracle: 'unknown' })], sources, /unknown mutation oracle/],
    [[definition({ guard: 'node test/missing.mjs' })], sources, /guard file missing/],
    [[definition({ guard: 'node --test --test-name-pattern=never test/oracle.test.mjs' })], sources, /не совпадает/],
  ]) {
    const result = run(mutants, data);
    assert.equal(result.code, 2, result.log);
    assert.match(result.log, message);
  }
  assert.deepEqual(registryProblems(null), ['registry must be an array']);
});

test('#854 readiness shares #830 preparation and rejects missing declared input/fix step', () => {
  const read = (path) => path === 'demo/smoke.mjs' ? 'import "../test-build/src/model.js";' : null;
  assert.match(preparationProblems('node demo/smoke.mjs', read, ['demo/smoke.mjs'])[0], /without tsc/);
  assert.deepEqual(preparationProblems('npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node demo/smoke.mjs', read, ['demo/smoke.mjs']), []);
  assert.deepEqual(preparationProblems('node --test demo/smoke.mjs', read, ['demo/smoke.mjs']), [], 'nightly harness handles short Node guards');
  assert.match(preparationProblems('node scripts/x-guard.mjs', read, ['test/declared-missing.mjs'])[0], /declared guard input/);
  assert.match(preparationProblems('npx tsc -p tsconfig.test.json && node demo/smoke.mjs', read, ['demo/smoke.mjs']).join('\n'), /fix-test-build/);
});

test('#854 immutable changed context refuses unreadable/stale/dirty material before selection', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40);
  const git = (args) => args[0] === 'diff' ? { status: 0 } : { status: 0, stdout: (args[2].startsWith('base') ? a : b) + '\n' };
  assert.deepEqual(freezeMutationRange('base..HEAD', '.', git), { range: a + '..' + b, materialSha: b });
  assert.throws(() => freezeMutationRange('unknown..HEAD', '.', () => ({ status: 1 })), /could not be read/);
  assert.throws(() => freezeMutationRange('HEAD', '.', git), /base\.\.material/);
  assert.throws(() => freezeMutationRange('base..other', '.', (args) => args[2]?.startsWith('other') ? { status: 0, stdout: a } : git(args)), /checkout/);
  assert.throws(() => freezeMutationRange('base..HEAD', '.', (args) => args[0] === 'diff' ? { status: 1 } : git(args)), /registry differs/);
  assert.throws(() => freezeMutationRange('base..HEAD', '.', (args) => args[0] === 'diff' && args.length === 4 ? { status: 1 } : git(args)), /tracked inputs differ/);
});

test('#854 real CLI defaults to static: poisoned oracle/patch are never executed; missing base registry is not empty PASS', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-readiness-854-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'));
  for (const name of readdirSync(join(ROOT, 'scripts')).filter((name) => name.endsWith('.mjs') && name !== 'mutation-registry.mjs'))
    copyFileSync(join(ROOT, 'scripts', name), join(dir, 'scripts', name));
  for (const [path, content] of Object.entries(sources)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name))),
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8' }).trim();
  const run = (...args) => spawnSync(process.execPath, [join(dir, 'scripts/mutation-gate.mjs'), ...args], { cwd: dir, env, encoding: 'utf8' });
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'base without registry'); const base = git('rev-parse', 'HEAD');
  // Prevent the old legacy fallback from being used as a valid declaration module.
  git('rm', '--cached', 'scripts/mutation-gate.mjs'); git('commit', '-qm', 'no legacy registry'); const absent = git('rev-parse', 'HEAD');
  writeFileSync(join(dir, 'scripts/mutation-registry.mjs'), 'export const MUTANTS = ' + JSON.stringify([definition()]) + ';');
  git('add', '.'); git('commit', '-qm', 'new declaration');
  const result = run('--id=alpha');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /execution=0 caught=unknown/);
  assert.equal(readFileSync(join(dir, 'src/a.ts'), 'utf8'), 'before', 'patch was not applied');
  assert.equal(existsSync(join(dir, 'artifacts/mutation-ledger')), false);
  const missing = run('--check', '--changed=' + absent + '..HEAD');
  assert.equal(missing.status, 2, missing.stdout + missing.stderr);
  assert.match(missing.stderr, /пустой PASS запрещён/);
  const unknown = run('--check', '--changed=' + '0'.repeat(40) + '..HEAD');
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /could not be read/);
  const unchanged = run('--check', '--changed=HEAD..HEAD');
  assert.equal(unchanged.status, 0, unchanged.stdout + unchanged.stderr);
  assert.match(unchanged.stdout, /гонять нечего/);
  const ledger = join(dir, 'caught.json');
  writeFileSync(ledger, 'prior-proof-must-stay-exact');
  const staticLedger = run('--check', '--changed=HEAD..HEAD', '--ledger=' + ledger);
  assert.equal(staticLedger.status, 0);
  assert.equal(readFileSync(ledger, 'utf8'), 'prior-proof-must-stay-exact');
  assert.ok(base);
});

test('#854 actual retired workflow step fails safely without a runner side effect', { skip: process.platform === 'win32' }, () => {
  const source = readFileSync(join(ROOT, '.github/workflows/validate.yml'), 'utf8');
  const step = findStep(source, { name: 'Development mutation execution retired' });
  const result = runStep(step, step.run);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /not caught evidence/);
});
