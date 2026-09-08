import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MAX_ATTEMPTS, commentFor, decideMerge, mergeCandidate, realOps } from '../scripts/merge-candidate.mjs';

// #492 §4 / §8.4: слияние точного кандидата. Таблица решений — на чистой
// функции; последовательность операций — на фальшивых git/gh; эксперимент
// аудита «20 → 40» — на настоящем git в temp-репозитории.

test('§8.4 таблица решений decideMerge', () => {
  assert.deepEqual(decideMerge({ fresh: false }), { action: 'reject-stale', to: 'S6-in-progress' });
  assert.deepEqual(decideMerge({ fresh: true, conflict: true }), { action: 'conflict', to: 'S6-in-progress' });
  // dev не двигался — fast-forward с lease
  assert.deepEqual(decideMerge({ fresh: true, devMoved: false }), { action: 'fast-forward', to: 'S8-merged' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: false, leaseRejected: true }), { action: 'retry' });
  // dev двигался: сначала patch-id, потом Validate, потом push с lease
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: false }), { action: 'rereview', to: 'S7-code-review' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: null }), { action: 'validate' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'missing' }), { action: 'validation-missing', to: 'S6-in-progress' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'red' }), { action: 'validation-red', to: 'S6-in-progress' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green' }), { action: 'push', to: 'S8-merged' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: 1 }), { action: 'retry' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: 2 }), { action: 'retry' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: MAX_ATTEMPTS }), { action: 'give-up', to: 'S6-in-progress' });
  // ни один исход не ведёт в S8 без зелёного Validate при движении dev
  for (const validate of [null, 'missing', 'red']) {
    assert.notEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate }).to, 'S8-merged', String(validate));
  }
  assert.equal(MAX_ATTEMPTS, 3);
});

test('каждый исход, меняющий метку, объясняется комментарием; успех — одной строкой', () => {
  const ctx = { material: 'a'.repeat(40), actual: 'b'.repeat(40), candidate: 'c'.repeat(40), devNow: 'd'.repeat(40), branch: 'issue/1-x', runUrl: 'https://run', attempt: 3 };
  for (const action of ['reject-stale', 'conflict', 'rereview', 'validation-red', 'validation-missing', 'give-up']) {
    const body = commentFor(action, ctx);
    assert.ok(body.length > 80, action);
    assert.match(body, /S6-in-progress|S7-code-review/, action);
  }
  assert.match(commentFor('push', ctx), /^материал `aaaaaaaa` · dev@`dddddddd` → кандидат `cccccccc` · Validate https:\/\/run зелёный · слито$/);
  assert.match(commentFor('fast-forward', ctx), /dev не двигался · слито$/);
  assert.equal(commentFor('validate', ctx), '');
});

/**
 * Фальшивые git/gh: `base` — merge-base материала с dev, `devTips` — вершины
 * dev по порядку (следующая после каждого отклонённого lease), ответы
 * Validate — по порядку кандидатов.
 */
function fakeOps({ base = 'dev0', devTips = ['dev0'], validate = [], leaseRejects = 0, patchIds = {}, branchTip, material, conflictOnce = false }) {
  const calls = [];
  let devIndex = 0;
  let validateIndex = 0;
  let rejects = leaseRejects;
  let conflict = conflictOnce;
  const dev = () => devTips[Math.min(devIndex, devTips.length - 1)];
  return {
    calls,
    fetch: (...refs) => { calls.push(['fetch', ...refs]); },
    revParse: (ref) => {
      if (ref === 'origin/dev') return dev();
      if (ref.startsWith('origin/issue')) return branchTip;
      if (ref.endsWith('^')) return material;
      return ref;
    },
    mergeBase: () => base,
    diffNames: () => [],
    patchId: (from, to) => patchIds[`${from}..${to}`] || 'same',
    rebaseOnto: (tip, onto) => {
      calls.push(['rebase', tip, onto]);
      if (conflict) { conflict = false; return null; }
      return `cand-${tip}-on-${dev()}`;
    },
    pushWithLease: (sha, ref, expected) => {
      calls.push(['push', sha, ref, expected]);
      if (ref === 'dev' && rejects > 0) { rejects -= 1; devIndex += 1; return false; }
      return true;
    },
    waitValidate: async (sha) => {
      calls.push(['validate', sha]);
      const result = validate[Math.min(validateIndex, validate.length - 1)] || 'green';
      validateIndex += 1;
      return { result, url: `https://run/${sha}` };
    },
    comment: (issue, body) => { calls.push(['comment', body.split('\n')[0]]); },
    log: () => {},
  };
}

test('dev не двигался: push кандидата как есть, с lease на текущий dev', async () => {
  const ops = fakeOps({ devTips: ['dev0'], branchTip: 'mat', material: 'mat' });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'fast-forward');
  assert.equal(r.merged, true);
  assert.deepEqual(ops.calls.filter((c) => c[0] === 'push'), [['push', 'mat', 'dev', 'dev0']]);
  assert.ok(!ops.calls.some((c) => c[0] === 'validate'), 'без движения dev Validate не ждётся');
});

test('эксперимент аудита: dev двигался, ребейз чистый, patch-id равен — Validate ОБЯЗАТЕЛЕН до push', async () => {
  const ops = fakeOps({ devTips: ['dev1'], branchTip: 'mat', material: 'mat' });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'push');
  assert.equal(r.merged, true);
  const order = ops.calls.map((c) => c[0]);
  const validateAt = order.indexOf('validate');
  const devPushAt = ops.calls.findIndex((c) => c[0] === 'push' && c[2] === 'dev');
  assert.ok(validateAt >= 0 && validateAt < devPushAt, `Validate (${validateAt}) раньше push в dev (${devPushAt})`);
  // кандидат сначала опубликован в ветку (от этого push стартует Validate)
  assert.deepEqual(ops.calls.find((c) => c[0] === 'push'), ['push', 'cand-mat-on-dev1', 'issue/1-x', 'mat']);
  assert.deepEqual(ops.calls.find((c) => c[0] === 'push' && c[2] === 'dev'), ['push', 'cand-mat-on-dev1', 'dev', 'dev1']);
});

test('красный Validate на кандидате — S6, без push в dev', async () => {
  const ops = fakeOps({ devTips: ['dev1'], branchTip: 'mat', material: 'mat', validate: ['red'] });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'validation-red');
  assert.equal(r.to, 'S6-in-progress');
  assert.equal(r.merged, false);
  assert.ok(!ops.calls.some((c) => c[0] === 'push' && c[2] === 'dev'));
});

test('patch-id изменился при ребейзе — S7-code-review, без Validate и без push в dev', async () => {
  const ops = fakeOps({ devTips: ['dev1'], branchTip: 'mat', material: 'mat', patchIds: { 'dev0..mat': 'p1', 'dev1..cand-mat-on-dev1': 'p2' } });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'rereview');
  assert.equal(r.to, 'S7-code-review');
  assert.ok(!ops.calls.some((c) => c[0] === 'validate'));
  assert.ok(!ops.calls.some((c) => c[0] === 'push' && c[2] === 'dev'));
});

test('dev ушёл снова после Validate: lease отклонён → новая попытка; трижды → S6', async () => {
  const twice = fakeOps({ devTips: ['dev1', 'dev2', 'dev3'], branchTip: 'mat', material: 'mat', leaseRejects: 2 });
  const ok = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops: twice });
  assert.equal(ok.action, 'push');
  assert.equal(twice.calls.filter((c) => c[0] === 'validate').length, 3, 'каждый новый кандидат проверен заново');
  assert.equal(twice.calls.filter((c) => c[0] === 'push' && c[2] === 'dev').length, 3);

  const always = fakeOps({ devTips: ['dev1', 'dev2', 'dev3', 'dev4'], branchTip: 'mat', material: 'mat', leaseRejects: 99 });
  const giveUp = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops: always });
  assert.equal(giveUp.action, 'give-up');
  assert.equal(giveUp.to, 'S6-in-progress');
  assert.equal(giveUp.merged, false);
});

test('ветка уехала после материала — #312, без ребейза и push', async () => {
  const ops = fakeOps({ devTips: ['dev0'], branchTip: 'other', material: 'mat' });
  ops.revParse = (ref) => (ref === 'origin/dev' ? 'dev0' : ref.startsWith('origin/issue') ? 'other' : ref.endsWith('^') ? 'zzz' : ref);
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'reject-stale');
  assert.ok(!ops.calls.some((c) => c[0] === 'push' || c[0] === 'rebase'));
});

test('конфликт при ребейзе — S6 с инструкцией, без push', async () => {
  const ops = fakeOps({ devTips: ['dev1'], branchTip: 'mat', material: 'mat', conflictOnce: true });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'conflict');
  assert.ok(!ops.calls.some((c) => c[0] === 'push'));
});

// --- настоящий git: «20 → 40» -----------------------------------------------

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

test('на настоящем git: чистый ребейз с равным patch-id и изменённым поведением идёт через Validate, не мимо', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-merge-'));
  try {
    const bare = join(dir, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare]);
    const work = join(dir, 'work');
    execFileSync('git', ['clone', '-q', bare, work]);
    const cfg = ['-c', 'user.name=t', '-c', 'user.email=t@x'];
    const commit = (msg) => execFileSync('git', ['-C', work, ...cfg, 'commit', '-q', '-am', msg]);
    writeFileSync(join(work, 'a.mjs'), 'export const a = 20;\n');
    writeFileSync(join(work, 'b.mjs'), 'export const b = 1;\n');
    git(work, 'add', '.');
    commit('base');
    git(work, 'branch', '-M', 'dev');
    git(work, 'push', '-q', '-u', 'origin', 'dev');
    // ветка задачи: b = a * 2 (проверено ревью при a = 20 → 40)
    git(work, 'checkout', '-q', '-b', 'issue/7-double');
    writeFileSync(join(work, 'b.mjs'), "import { a } from './a.mjs';\nexport const b = a * 2;\n");
    commit('double');
    const material = git(work, 'rev-parse', 'HEAD');
    git(work, 'push', '-q', '-u', 'origin', 'issue/7-double');
    // dev уходит вперёд: a = 40 — другой файл, конфликта нет, поведение b: 40 → 80
    git(work, 'checkout', '-q', 'dev');
    writeFileSync(join(work, 'a.mjs'), 'export const a = 40;\n');
    commit('a is 40 now');
    git(work, 'push', '-q', 'origin', 'dev');

    const calls = [];
    const ops = realOps({ repo: 'x/y', token: 'none' });
    ops.pushWithLease = (sha, ref, expected) => {
      calls.push(['push', ref, expected]);
      const r = spawnSync('git', ['-C', work, 'push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, 'origin', `${sha}:refs/heads/${ref}`], { encoding: 'utf8' });
      return r.status === 0;
    };
    ops.waitValidate = async (sha) => { calls.push(['validate', sha]); return { result: 'green', url: 'https://run/1' }; };
    ops.comment = (issue, body) => { calls.push(['comment', body.slice(0, 40)]); };
    ops.log = () => {};
    const inWork = (fn) => (...args) => { const cwd = process.cwd(); process.chdir(work); try { return fn(...args); } finally { process.chdir(cwd); } };
    for (const name of ['fetch', 'revParse', 'mergeBase', 'diffNames', 'patchId', 'rebaseOnto']) ops[name] = inWork(ops[name]);

    const r = await mergeCandidate({ branch: 'issue/7-double', material, issue: 7, ops });
    assert.equal(r.action, 'push', JSON.stringify(calls));
    const validateAt = calls.findIndex((c) => c[0] === 'validate');
    const devPushAt = calls.findIndex((c) => c[0] === 'push' && c[1] === 'dev');
    assert.ok(validateAt >= 0 && validateAt < devPushAt, 'без Validate кандидат в dev не уходит');
    const devTip = git(work, 'rev-parse', 'origin/dev');
    assert.equal(devTip, r.candidate, 'в dev ровно проверенный кандидат');
    assert.match(git(work, 'show', `${devTip}:a.mjs`), /a = 40/);
    assert.match(git(work, 'show', `${devTip}:b.mjs`), /a \* 2/);
    // lease: dev ждали на вершине «a is 40 now»
    const lease = calls.find((c) => c[0] === 'push' && c[1] === 'dev')[2];
    assert.equal(lease, git(work, 'rev-parse', `${devTip}^`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
