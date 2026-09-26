import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REVIEWS_INDEX_PATH, planStop, rebaseRegenerating } from '../scripts/rebase-generated.mjs';
import { buildIndex } from '../scripts/reviews-index.mjs';

// #643: doc-коммит ветки задачи конфликтует с dev только в генерируемом
// `docs/reviews/INDEX.md` — ребейз решает это пересборкой; любой другой
// конфликт — прежний отказ с перечнем. Сценарии — настоящий git во временных
// репозиториях.
//
// Окружение git — без единой GIT_* переменной родителя (урок #633): тест,
// запущенный из pre-push хука, иначе унаследует GIT_DIR и будет ребейзить
// репозиторий хука, а не временный. Личность и переводы строк — своим
// окружением, глобальный конфиг владельца не трогается (#496).
const cleanGitEnv = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
  GIT_CONFIG_KEY_1: 'core.eol', GIT_CONFIG_VALUE_1: 'lf',
});
const ENV = cleanGitEnv();
if (process.platform === 'win32') delete ENV.GIT_CONFIG_GLOBAL;
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const REVIEWS = 'docs/reviews';
const doc = (work, name, verdict = 'зелёный') => writeFileSync(join(work, REVIEWS, name), `# ${name}\nВердикт: **${verdict}** · High: 0 · Medium: 0\n`);
const reindex = (work) => writeFileSync(join(work, REVIEWS_INDEX_PATH), buildIndex(join(work, REVIEWS)));
const commitAll = (work, msg) => { git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', msg); };

/**
 * dev: base (документ #1 + индекс) → документ #8 со своим индексом.
 * ветка issue/9-fix от base: правка кода → документ #9 со своим индексом.
 * `shared` — вдобавок оба doc-коммита правят один и тот же обычный файл.
 */
const SCRIPTS = fileURLToPath(new URL('../scripts/', import.meta.url));

/**
 * Замыкание модуля: относительные импорты и скрипты, которые он запускает по
 * `new URL('./x.mjs', import.meta.url)` (генератор индекса), — рекурсивно.
 */
function importClosure(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const text = readFileSync(entry, 'utf8');
  const specs = [
    ...text.matchAll(/^import[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm),
    ...text.matchAll(/new URL\('(\.{1,2}\/[^']+\.mjs)', import\.meta\.url\)/g),
  ].map((m) => m[1]);
  for (const spec of specs) importClosure(resolve(dirname(entry), spec), seen);
  return seen;
}

function scenario({ shared = false, tools = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-rebase-gen-'));
  const origin = join(root, 'origin.git'); const work = join(root, 'work');
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  mkdirSync(join(work, REVIEWS), { recursive: true });
  writeFileSync(join(work, 'a.mjs'), 'export const a = 20;\n');
  writeFileSync(join(work, 'shared.txt'), 'base\n');
  doc(work, 'CODE-REVIEW-1-r1.md');
  reindex(work);
  if (tools) {
    // Шаг конвейера берёт помощника из dev: dev временного репозитория несёт
    // его вместе с замыканием импортов.
    mkdirSync(join(work, 'scripts'));
    for (const file of importClosure(join(SCRIPTS, 'rebase-generated.mjs'))) {
      // 'broken' — dev без зависимости помощника: Node упадёт на импорте с кодом 1.
      if (tools === 'broken' && file.endsWith('spawn-portable.mjs')) continue;
      copyFileSync(file, join(work, 'scripts', file.slice(SCRIPTS.length)));
    }
  }
  commitAll(work, 'base');
  git(work, 'push', '-q', '-u', 'origin', 'dev');

  git(work, 'checkout', '-q', '-b', 'issue/9-fix');
  writeFileSync(join(work, 'a.mjs'), 'export const a = 21;\n');
  commitAll(work, 'fix');
  doc(work, 'CODE-REVIEW-9-r1.md');
  reindex(work);
  if (shared) writeFileSync(join(work, 'shared.txt'), 'branch\n');
  commitAll(work, 'docs: review document for #9');
  const branchIndex = readFileSync(join(work, REVIEWS_INDEX_PATH), 'utf8');

  git(work, 'checkout', '-q', 'dev');
  doc(work, 'CODE-REVIEW-8-r1.md', 'жёлтый');
  reindex(work);
  if (shared) writeFileSync(join(work, 'shared.txt'), 'dev\n');
  commitAll(work, 'docs: review document for #8');
  git(work, 'push', '-q', 'origin', 'dev');
  const devIndex = readFileSync(join(work, REVIEWS_INDEX_PATH), 'utf8');
  git(work, 'checkout', '-q', 'issue/9-fix');
  return { root, work, branchIndex, devIndex };
}

test('#643 planStop: разрешается только набор, где ВСЕ конфликты — индекс или объявленные вызывающим', () => {
  assert.deepEqual(planStop([REVIEWS_INDEX_PATH, '', ` ${REVIEWS_INDEX_PATH}`]),
    { action: 'resolve', index: true, extra: [], conflicts: [REVIEWS_INDEX_PATH] });
  const mixed = planStop([REVIEWS_INDEX_PATH, 'src/x.ts']);
  assert.equal(mixed.action, 'abort');
  assert.equal(mixed.reason, 'manual');
  assert.deepEqual(mixed.manual, ['src/x.ts']);
  assert.deepEqual(mixed.conflicts, [REVIEWS_INDEX_PATH, 'src/x.ts'], 'в перечне отказа — все пути, индекс тоже');
  assert.equal(planStop(['docs/reviews/CODE-REVIEW-9-r1.md']).action, 'abort', 'документ ревью — не генерируемый файл');
  assert.equal(planStop(['docs/reviews/sub/INDEX.md']).action, 'abort', 'другой INDEX.md — не индекс ревью');
  assert.deepEqual(planStop([]), { action: 'abort', reason: 'no-conflicts', manual: [], conflicts: [] });
  const bundle = planStop(['dist/a.js', REVIEWS_INDEX_PATH], { extra: (p) => p.startsWith('dist/') });
  assert.deepEqual(bundle, { action: 'resolve', index: true, extra: ['dist/a.js'], conflicts: ['dist/a.js', REVIEWS_INDEX_PATH] });
});

test('#643 AC1: конфликт только в INDEX.md — ребейз проходит, индекс равен пересборке каталога', () => {
  const { root, work, branchIndex, devIndex } = scenario();
  try {
    const result = rebaseRegenerating({ onto: 'origin/dev', cwd: work, env: ENV });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(result.stops >= 1, 'конфликт действительно был — иначе тест ничего не доказывает');
    assert.ok(result.resolved.includes(`${REVIEWS_INDEX_PATH} ← пересборка`));
    assert.equal(git(work, 'status', '--porcelain'), '');
    assert.equal(git(work, 'rev-list', '--count', 'HEAD..origin/dev'), '0', 'dev целиком под веткой');
    assert.equal(git(work, 'rev-list', '--count', 'origin/dev..HEAD'), '2', 'оба коммита ветки на месте');
    const index = git(work, 'show', `HEAD:${REVIEWS_INDEX_PATH}`) + '\n';
    assert.equal(index, buildIndex(join(work, REVIEWS)), 'индекс = пересборка по каталогу');
    assert.notEqual(index, devIndex, 'не версия dev');
    assert.notEqual(index, branchIndex, 'не версия ветки');
    assert.match(index, /CODE-REVIEW-8-r1\.md/);
    assert.match(index, /CODE-REVIEW-9-r1\.md/);
    assert.match(git(work, 'show', 'HEAD:a.mjs'), /a = 21/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#643 AC2: INDEX.md вместе с другим файлом — отказ с обоими путями, дерево и HEAD как были', () => {
  const { root, work } = scenario({ shared: true });
  try {
    const before = git(work, 'rev-parse', 'HEAD');
    const result = rebaseRegenerating({ onto: 'origin/dev', cwd: work, env: ENV });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'manual');
    assert.deepEqual(result.conflicts, [REVIEWS_INDEX_PATH, 'shared.txt']);
    assert.deepEqual(result.manual, ['shared.txt']);
    assert.equal(git(work, 'rev-parse', 'HEAD'), before);
    assert.equal(git(work, 'status', '--porcelain'), '');
    assert.equal(existsSync(join(work, '.git', 'rebase-merge')), false, 'ребейз отменён, не брошен');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#643: индекс-коммит, ставший пустым после пересборки, пропускается, а не останавливает ребейз', () => {
  const { root, work } = scenario();
  try {
    // Индекс-коммит поверх doc-коммита: шапка старого генератора. После
    // ребейза пересборка совпадает с индексом предыдущего коммита.
    const path = join(work, REVIEWS_INDEX_PATH);
    writeFileSync(path, readFileSync(path, 'utf8').replace('Генерируется', 'Сгенерирован старым генератором'));
    commitAll(work, 'docs(reviews): индекс после сдвига каталога (#9)');
    const result = rebaseRegenerating({ onto: 'origin/dev', cwd: work, env: ENV });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.stops, 2);
    assert.equal(git(work, 'rev-list', '--count', 'origin/dev..HEAD'), '2', 'пустой индекс-коммит отброшен');
    assert.equal(git(work, 'show', `HEAD:${REVIEWS_INDEX_PATH}`) + '\n', buildIndex(join(work, REVIEWS)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#643: сбой пересборки посреди ребейза отменяет ребейз, а не оставляет дерево в полуребейзе', () => {
  const { root, work } = scenario();
  try {
    const before = git(work, 'rev-parse', 'HEAD');
    assert.throws(() => rebaseRegenerating({
      onto: 'origin/dev', cwd: work, env: ENV, rebuildIndex: () => { throw new Error('генератор упал'); },
    }), /генератор упал/);
    assert.equal(git(work, 'rev-parse', 'HEAD'), before);
    assert.equal(git(work, 'status', '--porcelain'), '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#643 CLI: отказ — код 3 и по строке на конфликтующий путь в stdout', () => {
  const { root, work } = scenario({ shared: true });
  try {
    const script = fileURLToPath(new URL('../scripts/rebase-generated.mjs', import.meta.url));
    let failure;
    try {
      execFileSync(process.execPath, [script, '--onto=origin/dev'],
        { cwd: work, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) { failure = error; }
    assert.ok(failure, 'отказ — ненулевой код');
    assert.equal(failure.status, 3, 'не 1: единицей Node выходит сам на сбое');
    assert.equal(failure.stdout, `${REVIEWS_INDEX_PATH}\nshared.txt\n`);
    assert.match(failure.stderr, /конфликт вне генерируемых путей — shared\.txt/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------- проводка в process.yml: свидетели и настоящий bash ----------

const WORKFLOW = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
const rebaseStep = () => WORKFLOW.slice(
  WORKFLOW.indexOf('      - name: Привести ветку к dev\n'),
  WORKFLOW.indexOf('      - name: Зафиксировать SHA материала ревью'),
);

test('#643 process.yml: шаг «Привести ветку к dev» ребейзит помощником из dev и сохраняет прежние гарантии', () => {
  const step = rebaseStep();
  assert.ok(step.length > 0, 'шаг найден');
  assert.doesNotMatch(step, /^\s+if ! git rebase origin\/dev/m, 'голого git rebase больше нет');
  assert.match(step, /git archive origin\/dev scripts \| tar -x -C "\$tools"/, 'помощник — из dev, не из отставшей ветки');
  assert.match(step, /files=\$\(node "\$tools\/scripts\/rebase-generated\.mjs" --onto=origin\/dev\) \|\| code=\$\?/);
  assert.match(step, /if \[ "\$code" -ne 0 \] && \[ "\$code" -ne 3 \]; then/, 'сбой помощника — не конфликт');
  assert.match(step, /echo 'conflict=true'\n\s+echo 'conflicts<<EOF_FILES'/, 'выход conflict/conflicts на месте');
  // Порядок: ребейз → push с lease → ожидание ссылки. Индекс в ветке задачи
  // не пересобирается (#657, 1б): его догоняет слияние кандидата в dev.
  assert.doesNotMatch(step, /--commit-if-stale/);
  const order = ['rebase-generated.mjs', '--force-with-lease="refs/heads/$BRANCH:$before"', 'if [ "$seen" = "$after" ]; then settled=true'];
  const at = order.map((needle) => step.indexOf(needle));
  assert.ok(at.every((i) => i >= 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'порядок шагов сохранён');
});

test('#643: замыкание импортов помощника не выходит из scripts/ — архива scripts достаточно', () => {
  const closure = importClosure(join(SCRIPTS, 'rebase-generated.mjs'));
  assert.ok(closure.has(join(SCRIPTS, 'reviews-index.mjs')), 'генератор индекса в замыкании');
  for (const file of closure) {
    assert.ok(file.startsWith(SCRIPTS), `${file} вне scripts/`);
  }
});

/** Исполнить ребейзную часть шага как есть (bash -eo pipefail, как у Actions). */
function runStepRebase(work) {
  const step = rebaseStep();
  const body = step.slice(step.indexOf('        run: |\n') + '        run: |\n'.length)
    .split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
  const from = body.indexOf('tools="$RUNNER_TEMP/rebase-tools"');
  const to = body.indexOf('# #657 (1б): индекс ревью в ветке');
  assert.ok(from >= 0 && to > from, 'ребейзная часть шага найдена');
  const temp = mkdtempSync(join(tmpdir(), 'hp-runner-'));
  try {
    const output = join(temp, 'output');
    writeFileSync(output, '');
    const script = `${body.slice(from, to)}\necho REBASED\n`;
    const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
      cwd: work, encoding: 'utf8', env: { ...ENV, RUNNER_TEMP: temp, GITHUB_OUTPUT: output, BRANCH: 'issue/9-fix' },
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, output: readFileSync(output, 'utf8') };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

const hasBash = () => process.platform !== 'win32' && spawnSync('bash', ['--version']).status === 0
  && spawnSync('tar', ['--version']).status === 0;

test('#643 process.yml на настоящем bash: конфликт только в индексе — ветка приведена, conflict не выставлен', (t) => {
  if (!hasBash()) { t.skip('bash/tar недоступны'); return; }
  const { root, work } = scenario({ tools: true });
  try {
    const r = runStepRebase(work);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /REBASED/);
    assert.equal(r.output, '', 'conflict не выставлен');
    assert.equal(git(work, 'rev-list', '--count', 'HEAD..origin/dev'), '0');
    assert.equal(git(work, 'show', `HEAD:${REVIEWS_INDEX_PATH}`) + '\n', buildIndex(join(work, REVIEWS)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#643 process.yml на настоящем bash: индекс + другой файл — conflict=true и оба пути в conflicts', (t) => {
  if (!hasBash()) { t.skip('bash/tar недоступны'); return; }
  const { root, work } = scenario({ tools: true, shared: true });
  try {
    const before = git(work, 'rev-parse', 'HEAD');
    const r = runStepRebase(work);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /REBASED/, 'шаг завершился на отказе');
    assert.equal(r.output, `conflict=true\nconflicts<<EOF_FILES\n${REVIEWS_INDEX_PATH}\nshared.txt\nEOF_FILES\n`);
    assert.equal(git(work, 'rev-parse', 'HEAD'), before);
    assert.equal(git(work, 'status', '--porcelain'), '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#643 process.yml на настоящем bash: сбой помощника (Node вышел с 1) — ошибка шага, а не conflict', (t) => {
  if (!hasBash()) { t.skip('bash/tar недоступны'); return; }
  const { root, work } = scenario({ tools: 'broken' });
  try {
    const r = runStepRebase(work);
    assert.equal(r.status, 1);
    assert.equal(r.output, '', 'сбой не выдаётся за конфликт ветки');
    assert.match(r.stdout, /::error::помощник ребейза упал/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
