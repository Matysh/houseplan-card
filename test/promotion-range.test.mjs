// #703: граница проверенного материала для гейтов диапазона на `dev` и `main`.
// Stable-промоушен — пуш в `main` SHA, уже судимого на `dev`. До #703 база
// бралась по прогонам одной `main` (прошлый stable), и вся бета-линия судилась
// заново по сегодняшним правилам: run 36468413524 предъявил 55 «новых» записей
// в смоках, появившихся до #629.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RELEASE_TAG, baseSummary, judgedShas, mergeRunPayloads, pickRangeBase, releaseTaggedShas,
} from '../scripts/classify-base.mjs';
import { addedLinesByFile } from '../scripts/no-new-any.mjs';
import { findNewPrivateWriteViolations, isGatedPath } from '../scripts/no-new-private-writes.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/classify-base.mjs', import.meta.url));
const SMOKE = 'demo/smoke_probe.mjs';
const run = (sha, conclusion) => ({ head_sha: sha, status: 'completed', conclusion });

/**
 * Бета-линия поверх прошлого stable: две записи в приватное состояние смока
 * появились в бетах (до правила), три prerelease-тега, кандидат промоушена.
 */
function betaLine(dir) {
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'dev');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'tag.gpgSign', 'false');
  mkdirSync(join(dir, 'demo'));
  const lines = ['// смок-проба', 'const c = document.querySelector("houseplan-card");'];
  const commit = (message, extra) => {
    if (extra) lines.push(extra);
    writeFileSync(join(dir, SMOKE), `${lines.join('\n')}\n`);
    writeFileSync(join(dir, 'notes.txt'), `${message}\n`);
    git('add', '-A');
    git('commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  const stable = commit('stable v1.0.0');
  git('tag', '-a', 'v1.0.0', '-m', 'v1.0.0');
  const beta1 = commit('beta 1', 'c._layout = {};');
  git('tag', '-a', 'v1.1.0-beta.1', '-m', 'beta 1');
  const beta2 = commit('beta 2', 'c._serverCfg = { spaces: [] };');
  git('tag', '-a', 'v1.1.0-beta.2', '-m', 'beta 2');
  const beta3 = commit('beta 3');
  git('tag', 'v1.1.0-beta.3'); // лёгкий тег тоже считается
  git('tag', 'wip-not-a-release'); // а этот — нет
  const candidate = commit('release: promote v1.1.0');
  return { dir, git, commit, stable, beta1, beta2, beta3, candidate };
}

/** Фикстура живёт ровно столько, сколько тело теста (#646). */
function withBetaLine(body) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-promotion-'));
  try {
    body(betaLine(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Прогнать CLI режима range в фикстуре и прочитать выбранную базу. */
function rangeBase(fx, head, runsByBranch, fallback) {
  const files = Object.entries(runsByBranch).map(([branch, runs]) => {
    const file = join(fx.dir, `runs-${branch}.json`);
    writeFileSync(file, JSON.stringify({ workflow_runs: runs }));
    return `--runs=${file}`;
  });
  const out = join(fx.dir, 'out.txt');
  writeFileSync(out, '');
  const result = spawnSync(process.execPath, [
    SCRIPT, `--head=${head}`, '--mode=range', '--name=range_base', `--fallback=${fallback}`, ...files,
  ], { cwd: fx.dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(out, 'utf8');
  return { base: /range_base=([0-9a-f]*)\n/.exec(output)?.[1], summary: result.stdout };
}

/** Тот же суд, что `no-new-private-writes --base --head`, но над фикстурой. */
function privateWrites(fx, base, head) {
  const diff = fx.git('diff', '--unified=0', '--no-color', `${base}...${head}`, '--', 'demo');
  const files = [];
  for (const [path, addedLines] of addedLinesByFile(diff)) {
    if (!isGatedPath(path) || !addedLines.size) continue;
    files.push({ path, text: fx.git('show', `${head}:${path}`), addedLines, movedLines: new Set() });
  }
  return findNewPrivateWriteViolations({ files });
}

test('#703 AC1: промоушен проверенного SHA в main — пустой диапазон и ноль нарушений', () => {
  withBetaLine((fx) => {
    // Фикстура не пустая: от прошлого stable гейт находит обе старые записи.
    // Ровно так судил main до #703.
    assert.equal(privateWrites(fx, fx.stable, fx.candidate).length, 2);
    const main = [run(fx.stable, 'success')];
    const dev = [run(fx.beta1, 'success'), run(fx.beta2, 'failure'),
      run(fx.beta3, 'success'), run(fx.candidate, 'success')];
    const { base, summary } = rangeBase(fx, fx.candidate, { dev, main }, fx.stable);
    assert.equal(base, fx.candidate, 'успешный Validate того же SHA на dev — граница');
    assert.match(summary, /#703/);
    assert.equal(privateWrites(fx, base, fx.candidate).length, 0);
    // Тот же SHA, та же граница на dev: один вердикт на одно дерево.
    assert.equal(rangeBase(fx, fx.candidate, { dev, main }, fx.beta3).base, fx.candidate);
  });
});

test('#703 AC1: без прогонов dev в окне API граница — последний тег релиза, а не прошлый stable', () => {
  withBetaLine((fx) => {
    const { base, summary } = rangeBase(fx, fx.candidate, { main: [run(fx.stable, 'success')] }, fx.stable);
    assert.equal(base, fx.beta3, 'лёгкий тег v1.1.0-beta.3 — опубликованный материал');
    assert.match(summary, /опубликованный тег релиза/);
    assert.equal(privateWrites(fx, base, fx.candidate).length, 0);
  });
});

test('#703 AC2: новое нарушение после границы красное — hotfix на main и пуш в dev', () => {
  withBetaLine((fx) => {
    const hotfix = fx.commit('hotfix', "c._tool = 'wall';");
    const main = [run(fx.stable, 'success'), run(fx.candidate, 'success')];
    const dev = [run(fx.candidate, 'success')];
    const onMain = rangeBase(fx, hotfix, { dev, main }, fx.candidate);
    assert.equal(onMain.base, fx.candidate);
    const found = privateWrites(fx, onMain.base, hotfix);
    assert.equal(found.length, 1);
    assert.equal(found[0].field, '_tool');
    const onDev = rangeBase(fx, hotfix, { dev, main }, fx.candidate);
    assert.equal(privateWrites(fx, onDev.base, hotfix).length, 1);
  });
});

test('#703 AC2: SHA с упавшим прогоном судится заново тем же диапазоном, а не пустым', () => {
  withBetaLine((fx) => {
    const bad = fx.commit('новая запись', 'c._mode = "edit";');
    // Прогон этого SHA упал на гейте. Перезапуск не имеет права стать зелёным
    // оттого, что SHA «уже судили».
    const dev = [run(fx.candidate, 'success'), run(bad, 'failure')];
    const { base } = rangeBase(fx, bad, { dev, main: [] }, fx.candidate);
    assert.equal(base, fx.candidate);
    assert.equal(privateWrites(fx, base, bad).length, 1);
  });
});

test('#703: HEAD засчитывает только успех или тег; предки — любой завершённый суд или тег', () => {
  const judged = judgedShas({ workflow_runs: [run('h', 'failure'), run('p', 'failure')] });
  assert.equal(pickRangeBase({
    candidates: ['p', 'q'], green: judged, head: 'h', headGreen: new Set(), fallback: 'before',
  }).base, 'p', 'упавший HEAD не граница; упавший предок — граница (#388)');
  const proven = pickRangeBase({
    candidates: ['p'], green: judged, head: 'h', headGreen: new Set(['h']), fallback: 'before',
  });
  assert.deepEqual([proven.base, proven.reason, proven.proven], ['h', 'head-proven', true]);
  assert.equal(pickRangeBase({
    candidates: ['p'], green: new Set(), head: 'h', tagged: new Set(['h']), fallback: 'before',
  }).base, 'h', 'опубликованный HEAD уже прошёл Validate на точном SHA (§8)');
  const tag = pickRangeBase({
    candidates: ['p', 't', 'q'], green: new Set(['q']), tagged: new Set(['t']), head: 'h',
  });
  assert.deepEqual([tag.base, tag.reason, tag.skipped], ['t', 'release-tag', 1]);
  // Прежние вызовы без новых полей ведут себя как до #703.
  assert.equal(pickRangeBase({ candidates: ['a'], green: new Set(), fallback: 'b' }).base, 'b');
  assert.match(baseSummary(tag, { head: 'hhhhhhhh', mode: 'range' }).join('\n'), /тег релиза/);
  assert.match(baseSummary(proven, { head: 'hhhhhhhh', mode: 'range' }).join('\n'), /диапазон пуст/);
});

test('#703: теги релиза и слияние прогонов двух веток', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const c = 'c'.repeat(40);
  const tags = releaseTaggedShas([
    `v1.2.3 ${a} `, // лёгкий: коммит — второе поле
    `v1.3.0-beta.2 ${'9'.repeat(40)} ${b}`, // аннотированный: третье
    `v2.0.0-rc.1 ${c}`,
    `v1.3.0-beta.0 ${'d'.repeat(40)}`, // beta.0 не бывает
    `wip ${'e'.repeat(40)}`,
    '',
  ].join('\n'));
  assert.deepEqual([...tags].sort(), [a, b, c]);
  assert.ok(RELEASE_TAG.test('v1.79.0-beta.1'));
  assert.equal(RELEASE_TAG.test('v1.79.0-beta'), false);
  const merged = mergeRunPayloads([{ workflow_runs: [run('x', 'success')] }, null, 'мусор',
    { workflow_runs: [run('y', 'failure')] }]);
  assert.deepEqual([...judgedShas(merged)].sort(), ['x', 'y']);
});
