// #657 (решение 2б): бандл меняет только релизный кандидат; сверка копий —
// только там, где бандл меняется или объявлен кандидат; стенд dev — из артефакта.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BUNDLE_RELEASE_ONLY_ERROR, BUNDLE_RELEASE_ONLY_SINCE, BUNDLE_ROOTS, bundleCommitErrors,
  assertCommittedBundleFresh, committedBundleMustMatch, isBundlePath, isCandidateSubject, releaseTrailers,
} from '../scripts/bundle-policy.mjs';
import { validateCommitMessage } from '../scripts/validate-commit-provenance.mjs';
import { GENERATED_ROOTS } from '../scripts/rebase-on-dev.mjs';

const POLICY = fileURLToPath(new URL('../scripts/bundle-policy.mjs', import.meta.url));
const TREE = fileURLToPath(new URL('../scripts/bundle-tree.mjs', import.meta.url));
const WORK = 'feat: x\n\nIssue: #657\nUser-Visible: no\n';
const RELEASE = 'Release v1.79.0-beta.1 candidate\n\nIssue: #657\nUser-Visible: yes\nRelease: v1.79.0-beta.1\n';

test('#657 пути бандла — один источник для политики и ребейза', () => {
  assert.deepEqual([...BUNDLE_ROOTS], ['dist/', 'custom_components/houseplan/frontend/']);
  assert.equal(GENERATED_ROOTS, BUNDLE_ROOTS, 'rebase-on-dev читает корни отсюда');
  assert.equal(isBundlePath('dist/houseplan-card.js'), true);
  assert.equal(isBundlePath('custom_components\\houseplan\\frontend\\houseplan-assets.json'), true);
  assert.equal(isBundlePath('custom_components/houseplan/const.py'), false);
  assert.equal(isBundlePath('demo/srv/assets/houseplan-card.js'), false, 'копия стенда не коммитится вовсе (#255)');
  assert.equal(isBundlePath('distribution.md'), false);
});

test('#657 правило коммита: бандл — только с трейлером Release', () => {
  assert.deepEqual(bundleCommitErrors(WORK, ['src/a.ts', 'dist/houseplan-card.js']), [BUNDLE_RELEASE_ONLY_ERROR]);
  assert.deepEqual(bundleCommitErrors(WORK, ['custom_components/houseplan/frontend/houseplan-assets.json']), [BUNDLE_RELEASE_ONLY_ERROR]);
  assert.deepEqual(bundleCommitErrors(RELEASE, ['dist/houseplan-card.js']), []);
  assert.deepEqual(bundleCommitErrors(WORK, ['src/a.ts', 'docs/x.md']), [], 'без путей бандла правило молчит');
  assert.deepEqual(bundleCommitErrors('feat\n\nRelease: v1\nIssue: #1\n', ['dist/a.js']), [],
    'трейлер в терминальном блоке, в любом месте блока');
  assert.deepEqual(bundleCommitErrors('feat\n\nRelease: v1 mentioned in prose\n\nIssue: #1\n', ['dist/a.js']),
    [BUNDLE_RELEASE_ONLY_ERROR], 'строка вне терминального блока трейлером не считается');
  assert.deepEqual(releaseTrailers(`${RELEASE}# Please enter the commit message\n`), ['v1.79.0-beta.1']);
});

test('#657 история до правила не переписывается: дата автора раньше порога не судится', () => {
  const before = new Date(Date.parse(BUNDLE_RELEASE_ONLY_SINCE) - 1000).toISOString();
  const after = new Date(Date.parse(BUNDLE_RELEASE_ONLY_SINCE) + 1000).toISOString();
  assert.deepEqual(bundleCommitErrors(WORK, ['dist/a.js'], { authorDate: before }), []);
  assert.deepEqual(bundleCommitErrors(WORK, ['dist/a.js'], { authorDate: after }), [BUNDLE_RELEASE_ONLY_ERROR]);
  assert.deepEqual(bundleCommitErrors(WORK, ['dist/a.js']), [BUNDLE_RELEASE_ONLY_ERROR], 'хук: даты нет — судится всегда');
});

test('#657 правило исполняет validate-commit-provenance — и хук, и история', () => {
  assert.ok(validateCommitMessage(WORK, ['dist/houseplan-card.js']).includes(BUNDLE_RELEASE_ONLY_ERROR));
  assert.ok(!validateCommitMessage(RELEASE, ['dist/houseplan-card.js', 'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md'])
    .includes(BUNDLE_RELEASE_ONLY_ERROR));
  assert.ok(!validateCommitMessage(WORK, ['dist/houseplan-card.js'], { authorDate: '2026-09-20T10:00:00+03:00' })
    .includes(BUNDLE_RELEASE_ONLY_ERROR), 'коммит до порога проходит по-старому');
});

test('#657 сверка копий: коммит меняет бандл или объявлен кандидатом', () => {
  assert.equal(committedBundleMustMatch({ subject: 'feat: x', files: ['src/a.ts'] }), false);
  assert.equal(committedBundleMustMatch({ subject: 'chore(golden): эталоны', files: ['demo/golden/baselines/a.png'] }), false,
    'приёмка эталонов несёт Release:, но бандл не трогает — после хотфиксов к кандидату сверяться не может');
  assert.equal(committedBundleMustMatch({ subject: 'Release v1.79.0-beta.1 candidate', files: ['package.json'] }), true,
    'кандидат, в котором бандл забыли пересобрать, всё равно сверяется');
  assert.equal(committedBundleMustMatch({ subject: 'x', files: ['custom_components/houseplan/frontend/houseplan-card.js'] }), true);
  assert.equal(isCandidateSubject('Release v1.78.0 candidate'), true);
  assert.equal(isCandidateSubject('Prepare v1.77.0-beta.5'), true, 'форма из истории беты 1.77');
  assert.equal(isCandidateSubject('docs: Release v1 notes'), false);
});

test('#657 публикация беты: закоммиченный бандл обязан быть собран из публикуемого дерева', () => {
  assert.equal(assertCommittedBundleFresh({ fingerprint: 'a'.repeat(64) }, 'a'.repeat(64)), 'a'.repeat(64));
  assert.throws(() => assertCommittedBundleFresh({ fingerprint: 'a'.repeat(64) }, 'b'.repeat(64)),
    /Committed bundle is stale.*bundle:release/);
  assert.throws(() => assertCommittedBundleFresh({}, 'b'.repeat(64)), /stale/);
  // Проводка: проверку вызывает сам оркестратор публикации, а не только Validate.
  const source = readFileSync(fileURLToPath(new URL('../scripts/release-prerelease.mjs', import.meta.url)), 'utf8');
  assert.match(source, /assertCommittedBundleFresh\(manifest, sourceFingerprint\(root\)\)/);
});

// --- CLI на настоящем git-репозитории ---------------------------------------
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
}).trim();
const sha = (text) => execFileSync(process.execPath, ['-e',
  "process.stdout.write(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))", text], { encoding: 'utf8' });

function writeBundle(root, dir, card) {
  mkdirSync(join(root, dir), { recursive: true });
  const panel = 'panel';
  writeFileSync(join(root, dir, 'houseplan-card.js'), card);
  writeFileSync(join(root, dir, 'houseplan-panel.js'), panel);
  const files = [
    { path: 'houseplan-card.js', sha256: sha(card), rawBytes: card.length, gzipBytes: 1, isEntry: true, imports: [], dynamicImports: [] },
    { path: 'houseplan-panel.js', sha256: sha(panel), rawBytes: panel.length, gzipBytes: 1, isEntry: true, imports: [], dynamicImports: [] },
  ];
  writeFileSync(join(root, dir, 'houseplan-assets.json'), `${JSON.stringify({
    schema: 1, fingerprint: 'f'.repeat(64), entry: 'houseplan-card.js', panelEntry: 'houseplan-panel.js',
    initialViewFiles: ['houseplan-card.js'], initialViewGzipBytes: 1,
    initialPanelFiles: ['houseplan-panel.js'], initialPanelGzipBytes: 1,
    initialPanelOnlyFiles: ['houseplan-panel.js'], initialPanelOnlyGzipBytes: 1, files,
  })}\n`);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hp-bundle-policy-'));
  mkdirSync(join(root, 'scripts'));
  for (const [from, name] of [[POLICY, 'bundle-policy.mjs'], [TREE, 'bundle-tree.mjs']]) {
    writeFileSync(join(root, 'scripts', name), readFileSync(from));
  }
  git(root, 'init', '-q', '-b', 'dev');
  writeBundle(root, 'dist', 'card v1');
  writeBundle(root, 'custom_components/houseplan/frontend', 'card v1');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', RELEASE);
  return root;
}
const cli = (root, ...args) => spawnSync(process.execPath, ['scripts/bundle-policy.mjs', ...args], { cwd: root, encoding: 'utf8' });

test('#657 CLI --verify: кандидат сверяет копии, обычный коммит — только свежую сборку', () => {
  const root = fixture();
  try {
    assert.equal(cli(root, '--must-match').status, 0, 'кандидат');
    assert.equal(cli(root, '--verify', 'HEAD').status, 0, 'копии кандидата равны');
    writeFileSync(join(root, 'src.ts'), 'change');
    git(root, 'add', 'src.ts');
    git(root, 'commit', '-q', '-m', WORK);
    writeBundle(root, 'dist', 'card v2');
    assert.equal(cli(root, '--must-match').status, 1, 'обычный коммит сверять не обязан');
    const work = cli(root, '--verify', 'HEAD');
    assert.equal(work.status, 0, work.stderr);
    assert.match(work.stdout, /закоммиченная копия не сверяется/);
    git(root, 'commit', '-q', '--allow-empty', '-m', 'Release v1.79.0-beta.2 candidate\n\nIssue: #657\nUser-Visible: no\nRelease: v1.79.0-beta.2\n');
    const stale = cli(root, '--verify', 'HEAD');
    assert.notEqual(stale.status, 0, 'кандидат без пересобранного бандла — отказ');
    assert.match(stale.stderr, /bundle asset differs|manifests differ/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#657 CLI --clean возвращает бандл к закоммиченному и убирает новые чанки', () => {
  const root = fixture();
  try {
    writeBundle(root, 'dist', 'card rebuilt');
    mkdirSync(join(root, 'dist/houseplan-assets'), { recursive: true });
    writeFileSync(join(root, 'dist/houseplan-assets/new-HASH.js'), 'chunk');
    writeFileSync(join(root, 'notes.txt'), 'keep me');
    const run = cli(root, '--clean');
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(root, 'dist/houseplan-card.js'), 'utf8'), 'card v1');
    assert.equal(git(root, 'status', '--porcelain', '--', 'dist', 'custom_components'), '');
    assert.equal(readFileSync(join(root, 'notes.txt'), 'utf8'), 'keep me', 'вне корней бандла ничего не трогается');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
