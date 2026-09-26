import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rebaseOnDev, splitConflicts } from '../scripts/rebase-on-dev.mjs';
import { buildIndex } from '../scripts/reviews-index.mjs';

// #479 AC5: конфликт только в бандле решается пересборкой, конфликт в src/**
// останавливает ребейз, не тронув дерево. Сценарий — настоящий git в temp.

// Личность коммитера нужна и скрипту (rebase, amend), не только тесту. Заодно
// временный репозиторий изолируется от пользовательского git config (#496): на
// Windows с глобальным `core.autocrlf=true` checkout давал `dev\r\n` вместо
// `dev\n`, и тест краснел на переводе строки, а не на ребейзе. Менять глобальный
// конфиг владельца ради теста нельзя — конфиг передаётся окружением.
// #643: GIT_* родителя снимаются целиком (урок #633) — запущенный из pre-push
// хука тест иначе унаследует GIT_DIR и ребейзит репозиторий хука.
for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) delete process.env[key];
Object.assign(process.env, {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
  GIT_CONFIG_KEY_1: 'core.eol', GIT_CONFIG_VALUE_1: 'lf',
});
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();


function repo({ conflictInSrc, reviews = false }) {
  const root = mkdtempSync(join(tmpdir(), 'hp-rebase-'));
  const origin = join(root, 'origin.git'); const work = join(root, 'work');
  git(root, 'init', '--bare', '-q', '-b', 'dev', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  mkdirSync(join(work, 'dist')); mkdirSync(join(work, 'src'));
  writeFileSync(join(work, 'src/x.ts'), 'base\n');
  writeFileSync(join(work, 'src/y.ts'), 'y0\n');
  writeFileSync(join(work, 'dist/a.js'), 'built:base\n');
  if (reviews) review(work, 1);
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'base'); git(work, 'push', '-q', '-u', 'origin', 'dev');
  // Ветка задачи: правит src/x.ts (или src/y.ts) и бандл.
  git(work, 'checkout', '-q', '-b', 'issue/1-x');
  writeFileSync(join(work, conflictInSrc ? 'src/y.ts' : 'src/x.ts'), 'branch\n');
  writeFileSync(join(work, 'dist/a.js'), 'built:branch\n');
  if (reviews) review(work, 9);
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'feat: branch');
  // dev уходит вперёд: другой файл (или тот же y.ts) и тот же бандл.
  git(work, 'checkout', '-q', 'dev');
  writeFileSync(join(work, conflictInSrc ? 'src/y.ts' : 'src/z.ts'), 'dev\n');
  writeFileSync(join(work, 'dist/a.js'), 'built:dev\n');
  if (reviews) review(work, 8);
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'dev moves'); git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', 'issue/1-x');
  return { root, work };
}

// Документ ревью задачи N и индекс, пересобранный по каталогу, — как коммитит конвейер.
function review(work, n) {
  const dir = join(work, 'docs', 'reviews');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `CODE-REVIEW-${n}-r1.md`), `# CODE-REVIEW-${n}-r1\nВердикт: **зелёный** · High: 0 · Medium: 0\n`);
  writeFileSync(join(dir, 'INDEX.md'), buildIndex(dir));
}

test('splitConflicts делит пути на сгенерированные и ручные (#479)', () => {
  const { generated, manual } = splitConflicts([
    'dist/houseplan-card.js', 'custom_components/houseplan/frontend/houseplan-assets.json',
    'src/houseplan-card.ts', 'custom_components/houseplan/const.py', '',
  ]);
  assert.deepEqual(generated, ['dist/houseplan-card.js', 'custom_components/houseplan/frontend/houseplan-assets.json']);
  assert.deepEqual(manual, ['src/houseplan-card.ts', 'custom_components/houseplan/const.py']);
  // #643: индекс ревью — генерируемый путь рядом с бандлом, прочие docs — нет.
  assert.deepEqual(splitConflicts(['docs/reviews/INDEX.md', 'docs/reviews/CODE-REVIEW-9-r1.md']),
    { generated: [], regenerated: ['docs/reviews/INDEX.md'], manual: ['docs/reviews/CODE-REVIEW-9-r1.md'] });
});

test('#643 AC3/#657: бандл и INDEX.md конфликтуют в одном коммите — бандл = версия dev, индекс = пересборка каталога', () => {
  const { root, work } = repo({ conflictInSrc: false, reviews: true });
  try {
    const result = rebaseOnDev({ cwd: work, log: () => {} });
    assert.equal(result.rebased, true);
    assert.ok(result.resolved.includes('docs/reviews/INDEX.md ← пересборка'), JSON.stringify(result.resolved));
    assert.ok(result.resolved.some((r) => r.startsWith('dist/a.js')), 'бандл решён в той же остановке');
    assert.equal(git(work, 'status', '--porcelain'), '');
    assert.equal(git(work, 'rev-list', '--count', 'HEAD..origin/dev'), '0');
    const index = git(work, 'show', 'HEAD:docs/reviews/INDEX.md') + '\n';
    assert.equal(index, buildIndex(join(work, 'docs', 'reviews')), 'индекс = пересборка, не версия dev и не ветки');
    assert.match(index, /CODE-REVIEW-8-r1\.md/);
    assert.match(index, /CODE-REVIEW-9-r1\.md/);
    assert.equal(readFileSync(join(work, 'dist/a.js'), 'utf8'), 'built:dev\n', '#657: бандл ветки не пересобирается');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('конфликт только в бандле: ребейз доведён, бандл = версия dev, без пересборки и амендинга (#479 AC5, #657)', () => {
  const { root, work } = repo({ conflictInSrc: false });
  try {
    const result = rebaseOnDev({ cwd: work, log: () => {} });
    assert.equal(result.rebased, true);
    assert.equal(result.resolved.length, 1);
    assert.equal('rebuilt' in result, false, 'пересборки в ветке больше нет');
    assert.equal(git(work, 'status', '--porcelain'), '');
    assert.equal(git(work, 'rev-list', '--count', 'origin/dev..HEAD'), '1', 'один коммит ветки поверх dev');
    assert.equal(git(work, 'rev-list', '--count', 'HEAD..origin/dev'), '0', 'dev полностью под веткой');
    assert.equal(readFileSync(join(work, 'dist/a.js'), 'utf8'), 'built:dev\n', 'бандл — версия dev, ветка его не несёт (#657)');
    assert.equal(git(work, 'diff', '--name-only', 'origin/dev', 'HEAD', '--', 'dist'), '', 'бандл ветки совпал с dev');
    assert.equal(readFileSync(join(work, 'src/z.ts'), 'utf8'), 'dev\n', 'правка dev на месте');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('конфликт в src/**: ребейз отменён, дерево и HEAD как были (#479 AC5)', () => {
  const { root, work } = repo({ conflictInSrc: true });
  try {
    const before = git(work, 'rev-parse', 'HEAD');
    assert.throws(() => rebaseOnDev({ cwd: work, log: () => {} }), /src\/y\.ts/);
    assert.equal(git(work, 'rev-parse', 'HEAD'), before);
    assert.equal(git(work, 'status', '--porcelain'), '');
    assert.equal(readFileSync(join(work, 'src/y.ts'), 'utf8'), 'branch\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('--dry-run предсказывает конфликт по бандлу и не трогает дерево (#479)', () => {
  const { root, work } = repo({ conflictInSrc: false });
  try {
    const before = git(work, 'rev-parse', 'HEAD');
    const lines = [];
    const result = rebaseOnDev({ cwd: work, dryRun: true, log: (l) => lines.push(l) });
    assert.equal(result.rebased, false);
    assert.deepEqual(result.predicted.generated, ['dist/a.js']);
    assert.equal(git(work, 'rev-parse', 'HEAD'), before);
    assert.ok(lines.some((l) => l.includes('dry-run')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('грязное дерево и ветка dev отвергаются до любого действия (#479)', () => {
  const { root, work } = repo({ conflictInSrc: false });
  try {
    writeFileSync(join(work, 'src/x.ts'), 'dirty\n');
    assert.throws(() => rebaseOnDev({ cwd: work, log: () => {} }), /не чистое/);
    git(work, 'checkout', '-q', '--', 'src/x.ts');
    git(work, 'checkout', '-q', 'dev');
    assert.throws(() => rebaseOnDev({ cwd: work, log: () => {} }), /ветка dev/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
