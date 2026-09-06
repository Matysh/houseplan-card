import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rebaseOnDev, splitConflicts } from '../scripts/rebase-on-dev.mjs';

// #479 AC5: конфликт только в бандле решается пересборкой, конфликт в src/**
// останавливает ребейз, не тронув дерево. Сценарий — настоящий git в temp.

// Личность коммитера нужна и скрипту (rebase, amend), не только тесту.
Object.assign(process.env, {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
});
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

// Фальшивая сборка: dist/a.js = 'built:' + содержимое src/x.ts.
const SYNC = [process.execPath, '-e',
  "const fs=require('fs');fs.writeFileSync('dist/a.js','built:'+fs.readFileSync('src/x.ts','utf8'))"];

function repo({ conflictInSrc }) {
  const root = mkdtempSync(join(tmpdir(), 'hp-rebase-'));
  const origin = join(root, 'origin.git'); const work = join(root, 'work');
  git(root, 'init', '--bare', '-q', '-b', 'dev', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  mkdirSync(join(work, 'dist')); mkdirSync(join(work, 'src'));
  writeFileSync(join(work, 'src/x.ts'), 'base\n');
  writeFileSync(join(work, 'src/y.ts'), 'y0\n');
  writeFileSync(join(work, 'dist/a.js'), 'built:base\n');
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'base'); git(work, 'push', '-q', '-u', 'origin', 'dev');
  // Ветка задачи: правит src/x.ts (или src/y.ts) и бандл.
  git(work, 'checkout', '-q', '-b', 'issue/1-x');
  writeFileSync(join(work, conflictInSrc ? 'src/y.ts' : 'src/x.ts'), 'branch\n');
  writeFileSync(join(work, 'dist/a.js'), 'built:branch\n');
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'feat: branch');
  // dev уходит вперёд: другой файл (или тот же y.ts) и тот же бандл.
  git(work, 'checkout', '-q', 'dev');
  writeFileSync(join(work, conflictInSrc ? 'src/y.ts' : 'src/z.ts'), 'dev\n');
  writeFileSync(join(work, 'dist/a.js'), 'built:dev\n');
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'dev moves'); git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', 'issue/1-x');
  return { root, work };
}

test('splitConflicts делит пути на сгенерированные и ручные (#479)', () => {
  const { generated, manual } = splitConflicts([
    'dist/houseplan-card.js', 'custom_components/houseplan/frontend/houseplan-assets.json',
    'src/houseplan-card.ts', 'custom_components/houseplan/const.py', '',
  ]);
  assert.deepEqual(generated, ['dist/houseplan-card.js', 'custom_components/houseplan/frontend/houseplan-assets.json']);
  assert.deepEqual(manual, ['src/houseplan-card.ts', 'custom_components/houseplan/const.py']);
});

test('конфликт только в бандле: ребейз доведён, бандл пересобран и зааменден (#479 AC5)', () => {
  const { root, work } = repo({ conflictInSrc: false });
  try {
    const result = rebaseOnDev({ cwd: work, syncCommand: SYNC, log: () => {} });
    assert.equal(result.rebased, true);
    assert.equal(result.resolved.length, 1);
    assert.equal(result.rebuilt, true);
    assert.equal(git(work, 'status', '--porcelain'), '');
    assert.equal(git(work, 'rev-list', '--count', 'origin/dev..HEAD'), '1', 'один коммит ветки поверх dev');
    assert.equal(git(work, 'rev-list', '--count', 'HEAD..origin/dev'), '0', 'dev полностью под веткой');
    assert.equal(readFileSync(join(work, 'dist/a.js'), 'utf8'), 'built:branch\n', 'бандл собран из src ветки, а не dev');
    assert.equal(readFileSync(join(work, 'src/z.ts'), 'utf8'), 'dev\n', 'правка dev на месте');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('конфликт в src/**: ребейз отменён, дерево и HEAD как были (#479 AC5)', () => {
  const { root, work } = repo({ conflictInSrc: true });
  try {
    const before = git(work, 'rev-parse', 'HEAD');
    assert.throws(() => rebaseOnDev({ cwd: work, syncCommand: SYNC, log: () => {} }), /src\/y\.ts/);
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
    const result = rebaseOnDev({ cwd: work, dryRun: true, syncCommand: SYNC, log: (l) => lines.push(l) });
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
    assert.throws(() => rebaseOnDev({ cwd: work, syncCommand: SYNC, log: () => {} }), /не чистое/);
    git(work, 'checkout', '-q', '--', 'src/x.ts');
    git(work, 'checkout', '-q', 'dev');
    assert.throws(() => rebaseOnDev({ cwd: work, syncCommand: SYNC, log: () => {} }), /ветка dev/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
