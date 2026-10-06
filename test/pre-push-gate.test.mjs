import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  candidateRefs, gateEnv, gateMode, isDocsOrGeneratedOnly, parsePushLines, planHook, runHook,
} from '../scripts/pre-push-gate.mjs';

// #633. pre-push-gate был единственным нетестированным гейтом и включался
// только по HP_PREPUSH_GATE=1. Теперь хук сам гонит gate:small для веток issue/*
// с исполняемым диффом; эти тесты держат решение хука (чистая planHook), его
// код выхода (runHook) и настоящую связку .githooks/pre-push → gate-small на
// временном репозитории: красный набор обязан остановить push (AC1).

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const ZERO = '0'.repeat(40);
const line = (local, sha, remote, remoteSha = ZERO) => `${local} ${sha} ${remote} ${remoteSha}`;

test('строки pre-push разбираются, пустые отбрасываются (#633)', () => {
  const refs = parsePushLines(`${line('refs/heads/issue/1-x', A, 'refs/heads/issue/1-x')}\n\n  \n`);
  assert.deepEqual(refs, [{ localRef: 'refs/heads/issue/1-x', localSha: A, remoteRef: 'refs/heads/issue/1-x', remoteSha: ZERO }]);
  assert.deepEqual(parsePushLines(''), []);
  assert.deepEqual(parsePushLines(undefined), []);
});

test('HP_PREPUSH_GATE: 0 выключает, 1 форсирует, иначе — по умолчанию (#633)', () => {
  for (const off of ['0', 'off', 'false', 'no', ' 0 ']) assert.equal(gateMode({ HP_PREPUSH_GATE: off }), 'off', off);
  for (const on of ['1', 'on', 'true', 'yes']) assert.equal(gateMode({ HP_PREPUSH_GATE: on }), 'force', on);
  assert.equal(gateMode({}), 'default');
  assert.equal(gateMode({ HP_PREPUSH_GATE: '' }), 'default');
});

test('кандидаты — ветки issue/*, не теги и не удаления; force — любая ветка (#633)', () => {
  const refs = parsePushLines([
    line('refs/heads/issue/1-x', A, 'refs/heads/issue/1-x'),
    line('refs/heads/dev', A, 'refs/heads/dev'),
    line('refs/tags/v1', A, 'refs/tags/v1'),
    line('(delete)', ZERO, 'refs/heads/issue/2-y', B),
  ].join('\n'));
  assert.deepEqual(candidateRefs(refs, 'default').map((r) => r.remoteRef), ['refs/heads/issue/1-x']);
  assert.deepEqual(candidateRefs(refs, 'force').map((r) => r.remoteRef), ['refs/heads/issue/1-x', 'refs/heads/dev']);
});

test('только класс C/D — «нечего проверять»; хоть один исполняемый файл — проверять (#633)', () => {
  assert.equal(isDocsOrGeneratedOnly(['docs/reviews/CODE-REVIEW-1-r1.md', 'dist/houseplan-card.js']), true);
  assert.equal(isDocsOrGeneratedOnly(['docs/TESTING.md', 'scripts/x.mjs']), false);
  assert.equal(isDocsOrGeneratedOnly(['docs/TESTING.md', 'unknown.bin']), false, 'неизвестный класс — не «документация»');
  assert.equal(isDocsOrGeneratedOnly([]), false);
});

const plan = (overrides = {}) => planHook({
  mode: 'default',
  refs: parsePushLines(line('refs/heads/issue/1-x', A, 'refs/heads/issue/1-x')),
  headSha: A,
  mergeBase: () => B,
  changedFiles: () => ['scripts/x.mjs'],
  ...overrides,
});

test('planHook: исполняемый дифф ветки issue/* на HEAD — прогон с базой merge-base (#633)', () => {
  assert.deepEqual(
    { action: plan().action, base: plan().base, ref: plan().ref },
    { action: 'run', base: B, ref: 'refs/heads/issue/1-x' },
  );
});

test('planHook: пропуски названы причиной (#633)', () => {
  assert.equal(plan({ mode: 'off' }).action, 'skip');
  assert.match(plan({ mode: 'off' }).reason, /HP_PREPUSH_GATE=0/);
  const dev = plan({ refs: parsePushLines(line('refs/heads/dev', A, 'refs/heads/dev')) });
  assert.equal(dev.action, 'skip');
  assert.match(dev.reason, /нет веток issue/);
  const docs = plan({ changedFiles: () => ['docs/reviews/CODE-REVIEW-1-r1.md'] });
  assert.equal(docs.action, 'skip');
  assert.match(docs.reason, /только класс C\/D/);
  assert.equal(plan({ changedFiles: () => [] }).action, 'skip');
});

test('planHook: force гонит и документацию, и не-issue ветку (#633)', () => {
  assert.equal(plan({ mode: 'force', changedFiles: () => ['docs/x.md'] }).action, 'run');
  assert.equal(plan({ mode: 'force', refs: parsePushLines(line('refs/heads/dev', A, 'refs/heads/dev')) }).action, 'run');
});

test('planHook: без merge-base или диффа — прогон против origin/dev, а не пропуск (#633)', () => {
  const noBase = plan({ mergeBase: () => null });
  assert.equal(noBase.action, 'run');
  assert.equal(noBase.base, 'origin/dev');
  assert.equal(plan({ changedFiles: () => null }).action, 'run');
});

test('planHook: пушится не HEAD — отказ, а не зелёный вердикт чужому дереву (#633)', () => {
  const foreign = plan({ headSha: B });
  assert.equal(foreign.action, 'reject');
  assert.match(foreign.reason, /не HEAD/);
  assert.match(foreign.reason, /HP_PREPUSH_GATE=0/);
  // Не-HEAD ветка с одними документами не мешает: её нечего проверять.
  assert.equal(plan({ headSha: B, changedFiles: () => ['docs/x.md'] }).action, 'skip');
});

const fakeGit = (head = A) => (args) => {
  if (args[0] === 'rev-parse') return head;
  if (args[0] === 'merge-base') return B;
  if (args[0] === 'diff') return 'scripts/x.mjs\n';
  return null;
};

test('runHook: красный gate:small — код 1, зелёный — 0, отказ не запускает набор (#633)', () => {
  const stdin = line('refs/heads/issue/1-x', A, 'refs/heads/issue/1-x');
  const calls = [];
  const log = () => {};
  assert.equal(runHook({ stdin, env: {}, log, git: fakeGit(), runGate: (base) => { calls.push(base); return 1; } }), 1);
  assert.equal(runHook({ stdin, env: {}, log, git: fakeGit(), runGate: (base) => { calls.push(base); return 0; } }), 0);
  assert.deepEqual(calls, [B, B]);
  assert.equal(runHook({ stdin, env: {}, log, git: fakeGit(B), runGate: () => { throw new Error('не должен запускаться'); } }), 1);
  assert.equal(runHook({ stdin, env: { HP_PREPUSH_GATE: '0' }, log, git: fakeGit(), runGate: () => { throw new Error('выключен'); } }), 0);
});

test('gateEnv снимает все GIT_*: набор не должен писать в репозиторий хука (#633)', () => {
  const env = gateEnv({ GIT_DIR: '/repo/.git', GIT_CONFIG_PARAMETERS: "'credential.helper'='x'", git_work_tree: 'w', PATH: '/bin', HP_X: '1' });
  assert.deepEqual(env, { PATH: '/bin', HP_X: '1' });
});

// ---- настоящая связка хука ------------------------------------------------

const REPO = fileURLToPath(new URL('..', import.meta.url));
const HOOK = '.githooks/pre-push';

/**
 * Локальные модули, которые подтягивает `source`: статические `import`/`export
 * … from`, `import './x'`, `import('./x')` литералом и чтения
 * `new URL('./x', import.meta.url)`.
 */
const LOCAL_REFS = [
  /^\s*(?:import|export)\s+(?:[\w\s{},*$]|\/\/[^\n]*)*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/gm,
  /^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm,
  /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  /\bnew URL\(\s*['"](\.{1,2}\/[^'"]+)['"],\s*import\.meta\.url\s*\)/g,
];

/**
 * Всё, что исполняет хук в `root` (#766): сам хук, скрипты, которые он зовёт
 * по пути `$repo_root/scripts/…`, и транзитивное замыкание их локальных
 * импортов. Прежде список вёлся руками и отставал от импортов: #737 уронил
 * Validate новым `model-usage.mjs`, которого в нём не было. `gate-small.mjs`,
 * который pre-push-gate запускает процессом, сюда не входит — его заглушку
 * пишет тест.
 */
function hookFiles(root) {
  const entries = [...new Set([...readFileSync(join(root, HOOK), 'utf8').matchAll(/\$repo_root\/(scripts\/[\w.-]+\.mjs)/g)]
    .map((m) => m[1]))];
  const seen = new Set();
  const visit = (file) => {
    const rel = relative(root, file).split(sep).join('/');
    assert.ok(!rel.startsWith('..'), `${rel}: модуль хука вне репозитория`);
    if (seen.has(rel)) return;
    assert.ok(existsSync(file), `${rel}: модуль хука не найден`);
    seen.add(rel);
    if (!/\.m?js$/.test(file)) return;
    const source = readFileSync(file, 'utf8');
    for (const pattern of LOCAL_REFS) {
      for (const m of source.matchAll(pattern)) visit(resolve(dirname(file), m[1]));
    }
  };
  for (const entry of entries) visit(join(root, entry));
  return { entries, files: [HOOK, ...[...seen].sort()] };
}
const HOOK_FILES = hookFiles(REPO).files;

test('#766: файлы fixture хука — из дерева импортов; новый транзитивный импорт попадает сам', () => {
  const { entries, files } = hookFiles(REPO);
  assert.deepEqual(entries, ['process-gate', 'pre-push-gate'].map((name) => `scripts/${name}.mjs`), 'скрипты, которые хук зовёт по пути');
  // Свидетели прежних провалов: #729 (process-gate тянет review-doc-guard) и #737.
  // Имена без литерала `scripts/…`: такой литерал check-inputs читает как
  // данные-лист и дальше импорты модуля для job frontend не обходит.
  for (const name of ['review-doc-guard', 'process-track', 'change-risk', 'model-usage', 'bundle-tree']) {
    assert.ok(files.includes(`scripts/${name}.mjs`), `${name}.mjs в fixture хука`);
  }
  assert.ok(!files.includes('scripts/gate-small.mjs'), 'набор gate:small тест подменяет заглушкой');

  // Копия дерева хука; в глубину цепочки (pre-push-gate → process-gate →
  // review-doc-guard → model-usage) добавлен новый модуль с собственным импортом.
  const root = mkdtempSync(join(tmpdir(), 'hp-766-hook-'));
  try {
    for (const file of files) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      copyFileSync(join(REPO, file), join(root, file));
    }
    const usage = join(root, 'scripts', 'model-usage.mjs');
    writeFileSync(usage, `import { deeper } from './zz-766-new.mjs';
${readFileSync(usage, 'utf8')}`);
    writeFileSync(join(root, 'scripts/zz-766-new.mjs'), [
      "export { deeper } from './zz-766-deeper.mjs';",
      "export const lazy = () => import('./zz-766-lazy.mjs');",
      "export const data = new URL('./zz-766-data.json', import.meta.url);",
      '',
    ].join('\n'));
    for (const name of ['zz-766-deeper.mjs', 'zz-766-lazy.mjs']) writeFileSync(join(root, 'scripts', name), 'export const deeper = 1;\n');
    writeFileSync(join(root, 'scripts/zz-766-data.json'), '{}\n');
    const derived = hookFiles(root).files;
    assert.deepEqual(derived.filter((file) => !files.includes(file)),
      ['scripts/zz-766-data.json', 'scripts/zz-766-deeper.mjs', 'scripts/zz-766-lazy.mjs', 'scripts/zz-766-new.mjs']);
    // Импорт без файла — громкий отказ, а не тихо короче список.
    rmSync(join(root, 'scripts/zz-766-lazy.mjs'));
    assert.throws(() => hookFiles(root), /zz-766-lazy\.mjs: модуль хука не найден/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// Заглушка набора: код выхода и журнал вызовов задаёт тест.
const GATE_STUB = `import { appendFileSync } from 'node:fs';
const leaked = Object.keys(process.env).filter((key) => /^GIT_/i.test(key)).sort().join(',');
if (process.env.HP_TEST_GATE_LOG) appendFileSync(process.env.HP_TEST_GATE_LOG, process.argv.slice(2).join(' ') + ' env:' + leaked + '\\n');
process.exit(Number(process.env.HP_TEST_GATE_EXIT ?? 0));
`;

test('настоящий .githooks/pre-push: красный gate:small останавливает push ветки issue/* (#633 AC1)', (t) => {
  if (spawnSync('git', ['--version']).status !== 0) { t.skip('git недоступен'); return; }
  const root = mkdtempSync(join(tmpdir(), 'hp-prepush-'));
  const dir = join(root, 'work');
  const origin = join(root, 'origin.git');
  const gateLog = join(root, 'gate.log');
  // gh без учётных данных: статус issue (п.8) проверяет CI, здесь он не нужен и
  // не должен ходить в сеть.
  // Свои GIT_* тест тоже не наследует: запущенный из хука (gate:small внутри
  // pre-push), он иначе писал бы в репозиторий хука, а не во временный.
  const env = { ...gateEnv(process.env), GH_TOKEN: '', GITHUB_TOKEN: '', GH_CONFIG_DIR: join(root, 'gh'), HP_TEST_GATE_LOG: gateLog };
  delete env.HP_PREPUSH_GATE;
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const write = (rel, text) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  const commit = (message) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', message);
  };
  const push = (branch, extraEnv = {}) => spawnSync('git',
    ['-C', dir, '-c', 'core.hooksPath=.githooks', 'push', '-q', 'origin', branch],
    { encoding: 'utf8', env: { ...env, ...extraEnv } });
  const remoteHas = (branch) => git('ls-remote', 'origin', `refs/heads/${branch}`) !== '';
  const gateCalls = () => (existsSync(gateLog) ? readFileSync(gateLog, 'utf8').split('\n').filter(Boolean) : []);

  try {
    mkdirSync(dir, { recursive: true });
    assert.equal(spawnSync('git', ['init', '-q', '--bare', origin], { env }).status, 0);
    git('init', '-q', '-b', 'dev');
    for (const file of HOOK_FILES) {
      mkdirSync(join(dir, file, '..'), { recursive: true });
      copyFileSync(join(REPO, file), join(dir, file));
    }
    chmodSync(join(dir, '.githooks/pre-push'), 0o755);
    write('scripts/gate-small.mjs', GATE_STUB);
    commit('Base');
    git('remote', 'add', 'origin', origin);
    git('push', '-q', '--no-verify', 'origin', 'dev');
    git('fetch', '-q', 'origin');
    const base = git('rev-parse', 'HEAD');

    git('checkout', '-q', '-b', 'issue/1-x');
    write('scripts/x.mjs', 'export const x = 1;\n');
    commit('Add x\n\nIssue: #1\nUser-Visible: no');

    const red = push('issue/1-x', { HP_TEST_GATE_EXIT: '1' });
    assert.notEqual(red.status, 0, `красный набор пропустил push:\n${red.stderr}`);
    assert.match(red.stderr, /gate:small красный/);
    assert.equal(remoteHas('issue/1-x'), false, 'ветка не должна была доехать');
    // Один прогон, от merge-base с origin/dev, и ни одной переменной git: хук
    // выставляет GIT_DIR, и без gateEnv юниты набора писали бы в этот репозиторий.
    assert.deepEqual(gateCalls(), [`--base=${base} env:`], 'набор гонится один раз, от merge-base, без GIT_*');

    const green = push('issue/1-x', { HP_TEST_GATE_EXIT: '0' });
    assert.equal(green.status, 0, green.stderr);
    assert.equal(remoteHas('issue/1-x'), true);
    assert.equal(gateCalls().length, 2);

    write('scripts/y.mjs', 'export const y = 1;\n');
    commit('Add y\n\nIssue: #1\nUser-Visible: no');
    const off = push('issue/1-x', { HP_TEST_GATE_EXIT: '1', HP_PREPUSH_GATE: '0' });
    assert.equal(off.status, 0, `HP_PREPUSH_GATE=0 не выключил набор:\n${off.stderr}`);
    assert.match(off.stderr, /HP_PREPUSH_GATE=0/);
    assert.equal(gateCalls().length, 2, 'выключенный набор не запускается');

    git('checkout', '-q', '-b', 'issue/2-docs', 'dev');
    write('docs/reviews/CODE-REVIEW-2-r1.md', '# review\n');
    commit('docs: review document for #2');
    const docs = push('issue/2-docs', { HP_TEST_GATE_EXIT: '1' });
    assert.equal(docs.status, 0, `дифф класса C не должен гнать набор:\n${docs.stderr}`);
    assert.match(docs.stderr, /только класс C\/D/);
    assert.equal(gateCalls().length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
