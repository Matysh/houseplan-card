import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REVIEWS_INDEX_PATH, UPSTREAM_WINS, planStop, rebaseRegenerating } from '../scripts/rebase-generated.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';
import { PATCH_ID_EXCLUDES } from '../scripts/merge-candidate.mjs';
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
    { action: 'resolve', index: true, upstream: [], extra: [], conflicts: [REVIEWS_INDEX_PATH] });
  const mixed = planStop([REVIEWS_INDEX_PATH, 'src/x.ts']);
  assert.equal(mixed.action, 'abort');
  assert.equal(mixed.reason, 'manual');
  assert.deepEqual(mixed.manual, ['src/x.ts']);
  assert.deepEqual(mixed.conflicts, [REVIEWS_INDEX_PATH, 'src/x.ts'], 'в перечне отказа — все пути, индекс тоже');
  assert.equal(planStop(['docs/reviews/CODE-REVIEW-9-r1.md']).action, 'abort', 'документ ревью — не генерируемый файл');
  assert.equal(planStop(['docs/reviews/sub/INDEX.md']).action, 'abort', 'другой INDEX.md — не индекс ревью');
  assert.deepEqual(planStop([]), { action: 'abort', reason: 'no-conflicts', manual: [], conflicts: [] });
  const bundle = planStop(['dist/a.js', REVIEWS_INDEX_PATH], { extra: (p) => p.startsWith('dist/') });
  assert.deepEqual(bundle, { action: 'resolve', index: true, upstream: [], extra: ['dist/a.js'], conflicts: ['dist/a.js', REVIEWS_INDEX_PATH] });
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

const INVENTORY_811 = 'docs/testing-notes/mutation-browser-guards.md';
function inventoryText811({ paint = [], paintBefore = [], lifecycle = [], reason = 'Pixels' } = {}) {
  const groups = new Map([
    ['Paint', [...paintBefore, 'paint-base', ...Array.from({ length: 5 }, (_, i) => `paint-context-${i}`), ...paint]], ['Harness', ['harness-base']],
    ['Pointer', ['pointer-base']], ['Layout', ['layout-base']],
    ['Lifecycle', ['lifecycle-base', ...lifecycle]],
  ]);
  return ['# Inventory fixture', 'The guideline is `200`.', '',
    '| Category | Count | Why a browser is still required |', '| --- | ---: | --- |',
    ...[...groups].map(([name, ids]) => `| ${name} | ${ids.length} | ${name === 'Paint' ? reason : name} |`),
    `| **Total** | **${[...groups.values()].flat().length} / 200** | Guideline |`, '',
    '## Reviewed per-mutant inventory', '',
    ...[...groups].flatMap(([name, ids]) => [`### ${name}`, '', `${name} reason retained.`, '',
      ...ids.map((id) => `- \`${id}\``), '']),
  ].join('\n');
}

function inventoryScenario811(t, { conflict = true, semantic = false, duplicate = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-rebase-inventory-811-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'dev');
  mkdirSync(join(root, 'docs/testing-notes'), { recursive: true });
  const file = join(root, INVENTORY_811);
  writeFileSync(file, inventoryText811());
  commitAll(root, 'base');
  git(root, 'checkout', '-q', '-b', 'issue/811-test');
  writeFileSync(file, inventoryText811({
    ...(conflict ? { lifecycle: ['branch-id'] } : { paint: ['branch-id'] }),
    reason: semantic ? 'Branch reason' : 'Pixels',
  }));
  commitAll(root, 'task inventory');
  const before = git(root, 'rev-parse', 'HEAD');
  const beforeText = readFileSync(file, 'utf8');
  git(root, 'checkout', '-q', 'dev');
  writeFileSync(file, inventoryText811({
    ...(conflict ? { paint: ['dev-id', 'second-dev-id'] } : { paintBefore: [duplicate ? 'branch-id' : 'dev-id'] }),
    reason: semantic ? 'Dev reason' : 'Pixels',
  }));
  commitAll(root, 'parallel inventory');
  git(root, 'checkout', '-q', 'issue/811-test');
  return { root, file, before, beforeText };
}

test('#811 AC6: numeric inventory conflicts preserve both ID lists and handwritten reasons', (t) => {
  const { root, file } = inventoryScenario811(t);
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.stops > 0, 'actual conflicting rebase, not just a pure parser fixture');
  assert.equal(readFileSync(file, 'utf8'), inventoryText811({ paint: ['dev-id', 'second-dev-id'], lifecycle: ['branch-id'] }));
  assert.equal(git(root, 'status', '--porcelain'), '');
  const tip = git(root, 'rev-parse', 'HEAD');
  const repeated = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV });
  assert.equal(repeated.ok, true);
  assert.equal(git(root, 'rev-parse', 'HEAD'), tip, 'repeated run is a no-op');
});

test('#811 AC6: silently merged equal totals are recomputed in a separate numeric-only commit', (t) => {
  const { root, file } = inventoryScenario811(t, { conflict: false });
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stops, 0, 'same Total on both branches merges without a Git conflict');
  assert.equal(readFileSync(file, 'utf8'), inventoryText811({ paintBefore: ['dev-id'], paint: ['branch-id'] }));
  assert.equal(git(root, 'rev-list', '--count', 'dev..HEAD'), '2', 'task commit plus a separate derived-count commit');
  assert.deepEqual(git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split('\n'), [INVENTORY_811]);
  const diff = git(root, 'diff', 'HEAD^', 'HEAD', '--', INVENTORY_811);
  assert.match(diff, /-\| \*\*Total\*\* \| \*\*11 \/ 200\*\*/);
  assert.match(diff, /\+\| \*\*Total\*\* \| \*\*12 \/ 200\*\*/);
  assert.doesNotMatch(diff, /^[+-]- `/m, 'ID lines were never rewritten');
});

for (const [name, options] of [
  ['semantic reason conflict', { semantic: true }],
  ['duplicate ID after a clean textual merge', { conflict: false, duplicate: true }],
]) test(`#811 AC6: ${name} refuses and restores the original HEAD and tree`, (t) => {
  const { root, file, before, beforeText } = inventoryScenario811(t, options);
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.ok(result.conflicts.includes(INVENTORY_811));
  assert.ok(result.manual.includes(INVENTORY_811));
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(readFileSync(file, 'utf8'), beforeText);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.equal(existsSync(join(root, '.git/rebase-merge')), false);
});

test('#811 AC6: a refused numeric-only commit restores the clean start and preserves untracked files', (t) => {
  const { root, file, before, beforeText } = inventoryScenario811(t, { conflict: false });
  const untracked = join(root, 'keep-untracked.txt');
  writeFileSync(untracked, 'owner data\n');
  const hook = join(root, '.git/hooks/pre-commit');
  writeFileSync(hook, '#!/bin/sh\necho "fixture refuses derived commit" >&2\nexit 1\n', { mode: 0o755 });
  assert.throws(() => rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV }), /fixture refuses derived commit/);
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(readFileSync(file, 'utf8'), beforeText);
  assert.equal(readFileSync(untracked, 'utf8'), 'owner data\n');
  assert.equal(git(root, 'status', '--porcelain'), '?? keep-untracked.txt');
});

test('#811 AC6: a dirty tracked tree is refused without overwriting its staged or unstaged content', (t) => {
  const { root, file, before } = inventoryScenario811(t);
  writeFileSync(file, readFileSync(file, 'utf8') + '\nUncommitted owner prose.\n');
  git(root, 'add', '--', INVENTORY_811);
  writeFileSync(file, readFileSync(file, 'utf8') + '\nMore unstaged prose.\n');
  const text = readFileSync(file, 'utf8');
  const staged = git(root, 'show', `:${INVENTORY_811}`);
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'dirty-worktree');
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(readFileSync(file, 'utf8'), text);
  assert.equal(git(root, 'show', `:${INVENTORY_811}`), staged);
});

for (const introducedByDev of [false, true]) test(`#811 AC6: ${introducedByDev ? 'rebased' : 'initial'} inventory symlink refuses without touching its target`, (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hp-rebase-inventory-link-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = join(root, 'repo');
  mkdirSync(join(work, 'docs/testing-notes'), { recursive: true });
  git(work, 'init', '-q', '-b', 'dev');
  const file = join(work, INVENTORY_811);
  const sentinel = join(root, 'outside-inventory.md');
  const stale = inventoryText811().replace('| Paint | 6 |', '| Paint | 5 |');
  writeFileSync(sentinel, stale);
  if (introducedByDev) writeFileSync(file, inventoryText811());
  else symlinkSync(sentinel, file);
  commitAll(work, 'base');
  git(work, 'checkout', '-q', '-b', 'issue/811-link');
  writeFileSync(join(work, 'task.txt'), 'task content\n');
  commitAll(work, 'task');
  const before = git(work, 'rev-parse', 'HEAD');
  const beforeEntry = git(work, 'ls-files', '--stage', '--', INVENTORY_811);
  if (introducedByDev) {
    git(work, 'checkout', '-q', 'dev');
    rmSync(file);
    symlinkSync(sentinel, file);
    commitAll(work, 'dev replaces inventory with a link');
    git(work, 'checkout', '-q', 'issue/811-link');
  }
  const result = rebaseRegenerating({ onto: 'dev', cwd: work, env: ENV });
  assert.equal(result.ok, false);
  assert.match(result.output, /regular file/);
  assert.equal(git(work, 'rev-parse', 'HEAD'), before);
  assert.equal(git(work, 'ls-files', '--stage', '--', INVENTORY_811), beforeEntry);
  assert.equal(git(work, 'status', '--porcelain'), '');
  assert.equal(readFileSync(sentinel, 'utf8'), stale, 'no write may follow the inventory symlink');
});

// ---------- проводка в process.yml: свидетели и настоящий bash ----------

const WORKFLOW = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
const REBASE_STEP = '      - name: Привести ветку к dev\n';
const rebaseStep = () => WORKFLOW.slice(
  WORKFLOW.indexOf(REBASE_STEP),
  WORKFLOW.indexOf('      - name: Зафиксировать SHA материала ревью'),
);

test('#643 process.yml: шаг «Привести ветку к dev» ребейзит помощником из dev и сохраняет прежние гарантии', () => {
  const step = rebaseStep();
  assert.ok(step.length > 0, 'шаг найден');
  assert.doesNotMatch(step, /^\s+if ! git rebase origin\/dev/m, 'голого git rebase больше нет');
  // #765: помощник — из снимка dev подготовки, не из отставшей ветки.
  assert.match(step, /TOOLS: \$\{\{ steps\.tools\.outputs\.dir \}\}/, 'помощник — из снимка dev, не из отставшей ветки');
  assert.doesNotMatch(step, /git archive/, 'своего извлечения нет — один снимок на заход');
  assert.match(step, /files=\$\(node "\$TOOLS\/scripts\/rebase-generated\.mjs" --onto=origin\/dev\) \|\| code=\$\?/);
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

/** Исполнить ребейзную часть шага как есть — shell шага, как у раннера (#766). */
function runStepRebase(work) {
  const step = rebaseStep();
  const body = step.slice(step.indexOf('        run: |\n') + '        run: |\n'.length)
    .split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
  const from = body.indexOf('code=0\nfiles=$(node "$TOOLS/scripts/rebase-generated.mjs"');
  const to = body.indexOf('# #657 (1б): индекс ревью в ветке');
  assert.ok(from >= 0 && to > from, 'ребейзная часть шага найдена');
  const temp = mkdtempSync(join(tmpdir(), 'hp-runner-'));
  try {
    const output = join(temp, 'output');
    writeFileSync(output, '');
    // #765: снимок dev подготовки (его шаг исполняет process-prepare-tools.test.mjs).
    const tools = join(temp, 'dev-tools');
    mkdirSync(tools);
    const archive = execFileSync('git', ['archive', 'origin/dev', 'scripts'], { cwd: work, env: ENV, maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', tools], { input: archive });
    const script = `${body.slice(from, to)}\necho REBASED\n`;
    const r = runStep(findStep(WORKFLOW, REBASE_STEP, '_process.yml'), script, {
      cwd: work, encoding: 'utf8', env: { ...ENV, RUNNER_TEMP: temp, GITHUB_OUTPUT: output, BRANCH: 'issue/9-fix', TOOLS: tools },
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

// ---------- #698: ченджлог объединяется, база метрик берётся из dev ----------

function sharedFilesScenario({ baselineConflict = false, alsoCode = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-rebase-698-'));
  const work = join(root, 'work');
  mkdirSync(join(work, 'docs'), { recursive: true });
  mkdirSync(join(work, 'scripts'), { recursive: true });
  git(root, 'init', '-q', '-b', 'dev', work);
  copyFileSync(fileURLToPath(new URL('../.gitattributes', import.meta.url)), join(work, '.gitattributes'));
  const log = (lines) => writeFileSync(join(work, 'docs', 'CHANGELOG.md'), `# Changelog\n\n## Unreleased\n\n${lines.join('\n')}\n\n## 1.0.0\n\n- first\n`);
  const baseline = (hostRefs) => writeFileSync(join(work, 'scripts', 'monolith-baseline.json'), `${JSON.stringify({ delegates: 1, hostRefs }, null, 2)}\n`);
  log([]); baseline(100);
  writeFileSync(join(work, 'a.mjs'), 'export const a = 1;\n');
  commitAll(work, 'base');
  git(work, 'checkout', '-q', '-b', 'issue/9-x');
  log(['- task nine']);
  if (baselineConflict) baseline(95);
  if (alsoCode) writeFileSync(join(work, 'a.mjs'), 'export const a = 9;\n');
  commitAll(work, 'task');
  git(work, 'checkout', '-q', 'dev');
  log(['- task eight']);
  if (baselineConflict) baseline(103);
  if (alsoCode) writeFileSync(join(work, 'a.mjs'), 'export const a = 8;\n');
  commitAll(work, 'neighbour');
  git(work, 'checkout', '-q', 'issue/9-x');
  return { root, work };
}

test('#698: записи ченджлога двух задач объединяются при ребейзе, конфликта нет', (t) => {
  const { root, work } = sharedFilesScenario();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = rebaseRegenerating({ onto: 'dev', cwd: work, env: ENV });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stops, 0, 'union — это не остановка ребейза');
  const text = readFileSync(join(work, 'docs', 'CHANGELOG.md'), 'utf8');
  assert.match(text, /- task eight\n- task nine\n/, 'обе записи в Unreleased, сторона dev первой');
  assert.doesNotMatch(text, /^(<<<<<<<|=======|>>>>>>>)/m);
});

test('#698: конфликт в базе метрик монолита решается в пользу dev', (t) => {
  const { root, work } = sharedFilesScenario({ baselineConflict: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = rebaseRegenerating({ onto: 'dev', cwd: work, env: ENV });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.resolved, ['scripts/monolith-baseline.json ← dev']);
  assert.equal(JSON.parse(readFileSync(join(work, 'scripts', 'monolith-baseline.json'), 'utf8')).hostRefs, 103);
  assert.match(readFileSync(join(work, 'docs', 'CHANGELOG.md'), 'utf8'), /- task nine/);
  assert.deepEqual(UPSTREAM_WINS, ['scripts/monolith-baseline.json']);
});

test('#698: база метрик вместе с конфликтом в коде — прежний отказ с перечнем', (t) => {
  const { root, work } = sharedFilesScenario({ baselineConflict: true, alsoCode: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = git(work, 'rev-parse', 'HEAD');
  const result = rebaseRegenerating({ onto: 'dev', cwd: work, env: ENV });
  assert.equal(result.ok, false);
  assert.deepEqual(result.manual, ['a.mjs']);
  assert.deepEqual(result.conflicts, ['a.mjs', 'scripts/monolith-baseline.json']);
  assert.equal(git(work, 'rev-parse', 'HEAD'), before, 'ребейз отменён, HEAD как был');
});

test('#698: patch-id кандидата не видит того, что ребейз сливает сам', () => {
  for (const path of ['docs/reviews', 'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md', 'scripts/monolith-baseline.json']) {
    assert.ok(PATCH_ID_EXCLUDES.includes(`:!${path}`), path);
  }
  const attrs = readFileSync(fileURLToPath(new URL('../.gitattributes', import.meta.url)), 'utf8');
  assert.match(attrs, /^docs\/CHANGELOG\.md merge=union$/m);
  assert.match(attrs, /^docs\/CHANGELOG\.ru\.md merge=union$/m);
});

// ---------- #705: отказ push стража ребейза разбирает код слияния ----------
//
// Прежде любой ненулевой push приведённой ветки печатал «ветка изменилась во
// время ребейза», хотя GitHub мог отказать сам — например, коммиту, меняющему
// `.github/workflows/`, от токена без права на workflow (#700). Шаг исполняется
// как есть, на настоящем bash; git подменён: push отвечает заданным stderr.

const FAKE_TOKEN_705 = 'ghs_' + 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2';
const refusalStderr = (reason) => `To https://github.com/o/r\n ! [remote rejected] HEAD -> issue/9-fix (${reason})\n`
  + `error: failed to push some refs to 'https://x-access-token:${FAKE_TOKEN_705}@github.com/o/r'\n`;

function runStepPush(pushStderr) {
  const step = rebaseStep();
  const body = step.slice(step.indexOf('        run: |\n') + '        run: |\n'.length)
    .split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
  const from = body.indexOf('push_err="$RUNNER_TEMP/rebase-push.stderr"');
  const to = body.indexOf('# #539: ссылка на стороне GitHub');
  assert.ok(from >= 0 && to > from, 'push-часть шага найдена');
  const context = { repository: 'o/r', server_url: 'https://github.com', run_id: '42' };
  const block = body.slice(from, to).replace(/\$\{\{ github\.(\w+) \}\}/g, (_, key) => context[key]);
  const temp = mkdtempSync(join(tmpdir(), 'hp-runner-705-'));
  try {
    const bin = join(temp, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'git'), [
      '#!/bin/sh',
      'case "$1" in',
      '  push) cat "$FAKE_PUSH_STDERR" >&2; exit 1 ;;',
      `  rev-parse) echo ${'c'.repeat(40)}; exit 0 ;;`,
      'esac',
      'echo "unexpected git $*" >&2; exit 97',
      '',
    ].join('\n'), { mode: 0o755 });
    writeFileSync(join(temp, 'push.stderr'), pushStderr);
    const output = join(temp, 'output');
    writeFileSync(output, '');
    // #730: сводка шага, куда код слияния пишет причину отказа.
    const summary = join(temp, 'summary.md');
    writeFileSync(summary, '');
    const script = `TOOLS=${JSON.stringify(resolve(SCRIPTS, '..'))}\nbefore=${'b'.repeat(40)}\n${block}\necho PUSHED\n`;
    const r = runStep(findStep(WORKFLOW, REBASE_STEP, '_process.yml'), script, {
      encoding: 'utf8',
      env: {
        ...ENV, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: temp, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
        BRANCH: 'issue/9-fix', NUM: '9', TOKEN: FAKE_TOKEN_705, FAKE_PUSH_STDERR: join(temp, 'push.stderr'),
      },
    });
    const commentPath = join(temp, 'push-refusal.md');
    return {
      status: r.status, stdout: r.stdout, stderr: r.stderr,
      output: readFileSync(output, 'utf8').replaceAll(temp, '$RUNNER_TEMP'),
      summary: readFileSync(summary, 'utf8'),
      comment: existsSync(commentPath) ? readFileSync(commentPath, 'utf8') : null,
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test('#705 process.yml: push ребейза отклонён по праву на workflow — refused=workflow, комментарий готов, ревью не идёт', (t) => {
  if (!hasBash()) { t.skip('bash/tar недоступны'); return; }
  const r = runStepPush(refusalStderr('refusing to allow a Personal Access Token to create or update workflow `.github/workflows/validate.yml` without `workflow` scope'));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /PUSHED/, 'шаг закончился на отказе');
  assert.equal(r.output, 'refused=workflow\nrefusal_comment=$RUNNER_TEMP/push-refusal.md\n');
  assert.match(r.stdout, /::warning::GitHub не принял push ребейза issue\/9-fix/);
  assert.doesNotMatch(r.stdout, /изменилась во время ребейза/, 'не #312');
  assert.match(r.comment, /^\*\*Ревью не запускалось: кандидат меняет workflow-файл, токен конвейера не может его опубликовать: ребейз и push делает автор, либо владелец выдаёт право/);
  assert.match(r.comment, /`\.github\/workflows\/validate\.yml`/);
  assert.match(r.comment, /\[Прогон конвейера\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/42\)/);
  assert.match(r.stderr, /refusing to allow a Personal Access Token/, 'ответ git — в журнале');
  // #730 AC2: причина и ответ git — ещё и в сводке шага.
  assert.match(r.summary, /^### git push в `issue\/9-fix` отклонён: workflow \(#723\)\n\nРебейз ветки на dev не опубликован в `issue\/9-fix`\. GitHub отклонил push по праву на workflow/);
  assert.match(r.summary, /Файлы: `\.github\/workflows\/validate\.yml`\./);
  assert.match(r.summary, /Ответ git:\n\n```\n[\s\S]*refusing to allow a Personal Access Token[\s\S]*\n```\n$/);
  for (const text of [r.stdout, r.stderr, r.comment, r.summary]) assert.ok(!text.includes(FAKE_TOKEN_705), 'токен вырезан');
});

test('#705 process.yml: устаревший lease — прежняя ошибка «ветка изменилась», прочий отказ GitHub — своя', (t) => {
  if (!hasBash()) { t.skip('bash/tar недоступны'); return; }
  const stale = runStepPush(` ! [rejected]        HEAD -> issue/9-fix (stale info)\nerror: failed to push some refs to 'https://github.com/o/r'\n`);
  assert.equal(stale.status, 1);
  assert.match(stale.stdout, /::error::ветка issue\/9-fix изменилась во время ребейза — прогон прерван/);
  assert.equal(stale.output, '');
  assert.equal(stale.comment, null);
  assert.equal(stale.summary, '', '#730: устаревший lease сводку об отказе GitHub не пишет');
  assert.match(stale.stderr, /\(stale info\)/, 'ответ git — в журнале');

  const hook = runStepPush(refusalStderr('protected branch hook declined'));
  assert.equal(hook.status, 1);
  assert.match(hook.stdout, /::error::GitHub отклонил push ребейза issue\/9-fix \(remote-rejected\) — это не изменение ветки автором/);
  assert.doesNotMatch(hook.stdout, /изменилась во время ребейза/);
  assert.equal(hook.output, '');
  assert.match(hook.stderr, /protected branch hook declined/);
  // #730 AC2: прочий отказ GitHub — тоже в сводке, с причиной и без токена.
  assert.match(hook.summary, /^### git push в `issue\/9-fix` отклонён: remote-rejected \(#723\)$/m);
  assert.ok(hook.summary.includes('Причина, которую назвал GitHub: «protected branch hook declined»'), hook.summary);
  assert.ok(!hook.stderr.includes(FAKE_TOKEN_705) && !hook.stdout.includes(FAKE_TOKEN_705) && !hook.summary.includes(FAKE_TOKEN_705));
});

test('#705 process.yml: отказ по праву на workflow возвращает задачу в S6 без ревью и без Validate на неопубликованном ребейзе', () => {
  const at = (marker) => { const i = WORKFLOW.indexOf(marker); assert.ok(i > 0, `нет «${marker}»`); return i; };
  const step = rebaseStep();
  assert.match(step, /"HEAD:refs\/heads\/\$BRANCH" 2> "\$push_err"; then/, 'stderr push идёт в разбор, а не мимо');
  assert.match(step, /kind=\$\(node "\$TOOLS\/scripts\/merge-candidate\.mjs" --push-refusal="\$push_err"/, 'разбор — кодом слияния из снимка dev (#765)');
  const back = WORKFLOW.slice(at('      - name: "Push ребейза отклонён по праву на workflow — вернуть автору без ревью (#705)"\n'),
    at('      - name: Validate на материале\n'));
  assert.match(back, /if: steps\.rebase\.outputs\.refused == 'workflow'\n/);
  assert.match(back, /--body-file "\$COMMENT"/);
  assert.match(back, /COMMENT: \$\{\{ steps\.rebase\.outputs\.refusal_comment \}\}/);
  assert.match(back, /--add-label S6-in-progress --remove-label S7-code-review/);
  // материал, reuse и гейт не берут локальный ребейз, которого нет на ветке
  for (const [name, id] of [['Зафиксировать SHA материала ревью', 'material'], ['"Зелёный вердикт прошлого захода применим без ревью (#499)"', 'reuse'], ['Validate на материале', 'gate']]) {
    const block = WORKFLOW.slice(at(`      - name: ${name}\n`));
    assert.match(block.slice(0, block.indexOf('\n        run:')), new RegExp(`id: ${id}\\n        if: steps\\.rebase\\.outputs\\.conflict != 'true' && steps\\.rebase\\.outputs\\.refused == ''`), id);
  }
});

test('#705: замыкание импортов кода слияния не выходит из scripts/ — страж ребейза берёт его архивом из dev', () => {
  for (const file of importClosure(join(SCRIPTS, 'merge-candidate.mjs'))) assert.ok(file.startsWith(SCRIPTS), `${file} вне scripts/`);
});
