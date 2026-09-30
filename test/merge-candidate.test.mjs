import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_ATTEMPTS, MAX_COMMAND_OUTPUT_BYTES, PUSH_REFUSAL, PushRefusal, classifyPushRefusal, commentFor, decideMerge,
  describePushRefusal, mergeCandidate, realOps, redactSecrets, sh,
} from '../scripts/merge-candidate.mjs';
import { buildCiProof } from '../scripts/ci-proof.mjs';
import { buildIndex } from '../scripts/reviews-index.mjs';

// #643: сценарии на настоящем git ведут временные репозитории — GIT_* родителя
// (GIT_DIR из pre-push хука, урок #633) направили бы их в чужой репозиторий.
for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) delete process.env[key];
import { jobInstanceNames, validateJobs } from '../scripts/workflow-jobs.mjs';

// #622: имена и число экземпляров job — из validate.yml, не копией строк.
const WORKFLOW = validateJobs();

const mergeProofContext = (row, sha, tree) => {
  const proof = buildCiProof({
    candidateSha: sha, candidateTree: tree, runId: row.databaseId,
    attempt: row.attempt ?? 1, event: row.event,
    needs: {
      preflight: { result: 'success' },
      changes: { result: 'success', outputs: {
        heavy: 'false', mutants_requested: 'true', frontend: 'true',
        backend: 'false', integration: 'false',
      } },
      reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' },
      changed_mutants: { result: 'success' },
    },
  });
  const success = (name) => ({ name, conclusion: 'success' });
  return { proof, reuseRuns: new Map(), jobs: ['preflight', 'changes', 'reuse', 'frontend', 'changed_mutants']
    .flatMap((id) => jobInstanceNames(WORKFLOW.get(id)).map(success)) };
};

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
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'failed' }), { action: 'validation-red', to: 'S6-in-progress' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green' }), { action: 'push', to: 'S8-merged' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: 1 }), { action: 'retry' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: 2 }), { action: 'retry' });
  assert.deepEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: MAX_ATTEMPTS }), { action: 'give-up', to: 'S6-in-progress' });
  // ни один исход не ведёт в S8 без зелёного Validate при движении dev
  for (const validate of [null, 'missing', 'failed', 'pending', 'cancelled', 'stale']) {
    assert.notEqual(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate }).to, 'S8-merged', String(validate));
  }
  assert.equal(MAX_ATTEMPTS, 3);
});

test('каждый исход, меняющий метку, объясняется комментарием; успех — одной строкой', () => {
  const ctx = { material: 'a'.repeat(40), actual: 'b'.repeat(40), candidate: 'c'.repeat(40), devNow: 'd'.repeat(40), branch: 'issue/1-x', runUrl: 'https://run', attempt: 3 };
  for (const action of ['reject-stale', 'conflict', 'rereview', 'validation-red', 'validation-missing', 'give-up', 'push-refused-workflow', 'push-refused']) {
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
function fakeOps({ base = 'dev0', devTips = ['dev0'], validate = [], leaseRejects = 0, patchIds = {}, branchTip, material, conflictOnce = false, indexStale = false, deleteOk = true, refuse = null }) {
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
    freshIndex: (tip) => {
      calls.push(['index', tip]);
      return indexStale ? `idx-${tip}` : tip;
    },
    pushWithLease: (sha, ref, expected) => {
      calls.push(['push', sha, ref, expected]);
      // #705: отказ самого GitHub — так, как его бросает realOps.pushWithLease.
      if (refuse && refuse.ref === ref) throw new PushRefusal(ref, classifyPushRefusal(refuse.stderr), sha);
      if (ref === 'dev' && rejects > 0) { rejects -= 1; devIndex += 1; return false; }
      return true;
    },
    dispatchValidate: (ref) => { calls.push(['dispatch', ref]); },
    waitValidate: async (sha, options) => {
      calls.push(['validate', sha, options?.event]);
      const result = validate[Math.min(validateIndex, validate.length - 1)] || 'green';
      validateIndex += 1;
      return { result, url: `https://run/${sha}` };
    },
    comment: (issue, body) => { calls.push(['comment', body.split('\n')[0], body]); },
    deleteBranch: (ref, expected) => { calls.push(['delete', ref, expected]); return deleteOk; },
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

test('#657 r1 H1: dev не двигался — индекс пересобирается поверх материала, в dev уходит вершина с индексом', async () => {
  const ops = fakeOps({ devTips: ['dev0'], branchTip: 'mat', material: 'mat', indexStale: true });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'fast-forward');
  assert.equal(r.candidate, 'idx-mat');
  const indexAt = ops.calls.findIndex((c) => c[0] === 'index');
  const pushAt = ops.calls.findIndex((c) => c[0] === 'push');
  assert.ok(indexAt >= 0 && indexAt < pushAt, 'индекс пересобран до push');
  assert.deepEqual(ops.calls[pushAt], ['push', 'idx-mat', 'dev', 'dev0']);
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
  // кандидат сначала опубликован в ветку, затем на ней запрошен Validate с мутантами (#510)
  assert.deepEqual(ops.calls.find((c) => c[0] === 'push'), ['push', 'cand-mat-on-dev1', 'issue/1-x', 'mat']);
  const dispatchAt = order.indexOf('dispatch');
  assert.ok(dispatchAt > order.indexOf('push') && dispatchAt < validateAt, 'dispatch после пуша кандидата и до ожидания');
  assert.deepEqual(ops.calls[dispatchAt], ['dispatch', 'issue/1-x']);
  assert.deepEqual(ops.calls[validateAt], ['validate', 'cand-mat-on-dev1', 'workflow_dispatch'], 'ждём именно dispatch-прогон, не push');
  assert.deepEqual(ops.calls.find((c) => c[0] === 'push' && c[2] === 'dev'), ['push', 'cand-mat-on-dev1', 'dev', 'dev1']);
});

test('красный Validate на кандидате — S6, без push в dev', async () => {
  const ops = fakeOps({ devTips: ['dev1'], branchTip: 'mat', material: 'mat', validate: ['failed'] });
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
    ops.dispatchValidate = (ref) => { calls.push(['dispatch', ref]); };
    ops.waitValidate = async (sha) => { calls.push(['validate', sha]); return { result: 'green', url: 'https://run/1' }; };
    ops.comment = (issue, body) => { calls.push(['comment', body.slice(0, 40)]); };
    ops.log = () => {};
    const inWork = (fn) => (...args) => { const cwd = process.cwd(); process.chdir(work); try { return fn(...args); } finally { process.chdir(cwd); } };
    for (const name of ['fetch', 'revParse', 'mergeBase', 'diffNames', 'patchId', 'rebaseOnto', 'freshIndex']) ops[name] = inWork(ops[name]);

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

// ---------- #510 code review r2 M1: the real waitValidate, not a fake ----------

/** gh scripted by call: each `gh run list` answer is the next snapshot. */
function scriptedExec(snapshots) {
  let calls = 0;
  return {
    exec: (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'run' && args[1] === 'list') {
        const s = snapshots[Math.min(calls, snapshots.length - 1)];
        calls += 1;
        return { status: 0, stdout: JSON.stringify(s), stderr: '' };
      }
      throw new Error(`unexpected ${cmd} ${args.join(' ')}`);
    },
    calls: () => calls,
  };
}

test('#510 r2 M1: realOps.waitValidate ignores a cancelled dispatch and follows its replacement', async () => {
  const sha = 'c'.repeat(40);
  const tree = 'd'.repeat(40);
  const cancelled = { databaseId: 1, attempt: 1, status: 'completed', conclusion: 'cancelled', url: 'https://run/1', event: 'workflow_dispatch', headSha: sha };
  const push = { databaseId: 2, attempt: 1, status: 'completed', conclusion: 'success', url: 'https://run/2', event: 'push', headSha: sha };
  const replacement = { databaseId: 3, attempt: 1, status: 'completed', conclusion: 'success', url: 'https://run/3', event: 'workflow_dispatch', headSha: sha };
  const gh = scriptedExec([[cancelled, push], [cancelled, push], [replacement, cancelled, push]]);
  let clock = 0;
  const ops = realOps({
    repo: 'x/y', token: 'none', exec: gh.exec,
    sleep: async (ms) => { clock += ms; }, now: () => clock,
    candidateTree: async () => tree,
    proofContext: async (row) => row.databaseId === 3
      ? mergeProofContext(row, sha, tree) : { proof: null, jobs: [], reuseRuns: new Map() },
  });
  const r = await ops.waitValidate(sha, { event: 'workflow_dispatch' });
  assert.equal(r.result, 'green');
  assert.equal(r.url, 'https://run/3');
  assert.equal(gh.calls(), 3, 'kept polling past the cancelled run instead of returning red on the first answer');
});

test('#510 r2 M1: realOps.waitValidate with only a cancelled dispatch reports missing after the appear window, never red', async () => {
  const sha = 'c'.repeat(40);
  const tree = 'd'.repeat(40);
  const cancelled = { databaseId: 1, attempt: 1, status: 'completed', conclusion: 'cancelled', url: 'https://run/1', event: 'workflow_dispatch', headSha: sha };
  const gh = scriptedExec([[cancelled]]);
  let clock = 0;
  const ops = realOps({
    repo: 'x/y', token: 'none', exec: gh.exec,
    sleep: async (ms) => { clock += ms; }, now: () => clock,
    candidateTree: async () => tree,
    proofContext: async () => ({ proof: null, jobs: [], reuseRuns: new Map() }),
  });
  const r = await ops.waitValidate(sha, { event: 'workflow_dispatch' });
  assert.equal(r.result, 'missing');
});

test('#541: real merge waiter never accepts a successful dispatch without its proof artifact', async () => {
  const sha = 'c'.repeat(40);
  const tree = 'd'.repeat(40);
  const unproved = {
    databaseId: 4, attempt: 1, status: 'completed', conclusion: 'success',
    url: 'https://run/4', event: 'workflow_dispatch', headSha: sha,
  };
  const gh = scriptedExec([[unproved]]);
  let clock = 0;
  const ops = realOps({
    repo: 'x/y', token: 'none', exec: gh.exec,
    sleep: async (ms) => { clock += ms; }, now: () => clock,
    candidateTree: async () => tree,
    proofContext: async () => ({ proof: null, jobs: [], reuseRuns: new Map() }),
  });
  const result = await ops.waitValidate(sha, { event: 'workflow_dispatch' });
  assert.equal(result.result, 'missing');
});

// ---------- #516: the candidate carries its own review document; dev moves by other documents ----------

test('#516 AC1: dev moved only by review documents and the branch carries its own — patch-id equal, merge goes through Validate, not re-review', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-merge-516-'));
  try {
    const origin = join(dir, 'origin.git');
    const work = join(dir, 'work');
    execFileSync('git', ['init', '-q', '--bare', origin]);
    execFileSync('git', ['clone', '-q', origin, work]);
    const cfg = ['-c', 'user.name=t', '-c', 'user.email=t@x'];
    const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...cfg, ...args], { encoding: 'utf8' }).trim();
    const commit = (msg) => execFileSync('git', ['-C', work, ...cfg, 'commit', '-q', '-am', msg]);
    mkdirSync(join(work, 'docs', 'reviews'), { recursive: true });
    writeFileSync(join(work, 'a.mjs'), 'export const a = 20;\n');
    writeFileSync(join(work, 'docs', 'reviews', '.keep'), '');
    git(work, 'add', '.');
    commit('base');
    git(work, 'branch', '-M', 'dev');
    git(work, 'push', '-q', '-u', 'origin', 'dev');
    // ветка задачи: код + (позже) её собственный документ ревью
    git(work, 'checkout', '-q', '-b', 'issue/9-fix');
    writeFileSync(join(work, 'a.mjs'), 'export const a = 21;\n');
    commit('fix');
    const material = git(work, 'rev-parse', 'HEAD');
    writeFileSync(join(work, 'docs', 'reviews', 'CODE-REVIEW-9-r1.md'), '# CODE-REVIEW-9-r1\nVerdict: green\n');
    git(work, 'add', '.');
    commit('docs: review document for #9');
    git(work, 'push', '-q', '-u', 'origin', 'issue/9-fix');
    // dev двинулся чужим документом ревью — ровно то, что делает каждый паблиш конвейера
    git(work, 'checkout', '-q', 'dev');
    writeFileSync(join(work, 'docs', 'reviews', 'CODE-REVIEW-8-r2.md'), '# CODE-REVIEW-8-r2\n');
    git(work, 'add', '.');
    commit('docs: review document for #8');
    git(work, 'push', '-q', 'origin', 'dev');

    const calls = [];
    const ops = realOps({ repo: 'x/y', token: 'none', issue: 9 });
    ops.pushWithLease = (sha, ref, expected) => {
      calls.push(['push', ref, expected]);
      const r = spawnSync('git', ['-C', work, 'push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, 'origin', `${sha}:refs/heads/${ref}`], { encoding: 'utf8' });
      return r.status === 0;
    };
    ops.dispatchValidate = (ref) => { calls.push(['dispatch', ref]); };
    ops.waitValidate = async (sha) => { calls.push(['validate', sha]); return { result: 'green', url: 'https://run/1' }; };
    ops.comment = (issue, body) => { calls.push(['comment', body.slice(0, 60)]); };
    ops.log = () => {};
    const inWork = (fn) => (...args) => { const cwd = process.cwd(); process.chdir(work); try { return fn(...args); } finally { process.chdir(cwd); } };
    for (const name of ['fetch', 'revParse', 'mergeBase', 'diffNames', 'patchId', 'rebaseOnto', 'freshIndex']) ops[name] = inWork(ops[name]);

    const r = await mergeCandidate({ branch: 'issue/9-fix', material, issue: 9, ops });
    assert.equal(r.action, 'push', JSON.stringify(calls));
    assert.ok(calls.some((c) => c[0] === 'validate'), 'кандидат прошёл Validate');
    assert.ok(!calls.some((c) => c[0] === 'comment' && /patch-id/.test(c[1])), 'нет возврата «дифф изменился»');
    const devTip = git(work, 'rev-parse', 'origin/dev');
    assert.match(git(work, 'show', `${devTip}:a.mjs`), /a = 21/);
    assert.equal(git(work, 'cat-file', '-t', `${devTip}:docs/reviews/CODE-REVIEW-9-r1.md`), 'blob', 'документ раунда уехал вместе с кодом');
    assert.equal(git(work, 'cat-file', '-t', `${devTip}:docs/reviews/CODE-REVIEW-8-r2.md`), 'blob');
    // #635 r2 H1: кандидат после ребейза несёт свежий INDEX.md — оба документа
    // видны через индекс, коммит индекса — doc-коммит конвейера поверх материала.
    const index = git(work, 'show', `${devTip}:docs/reviews/INDEX.md`);
    assert.match(index, /CODE-REVIEW-8-r2\.md/);
    assert.match(index, /CODE-REVIEW-9-r1\.md/);
    assert.match(git(work, 'log', '-1', '--format=%s', devTip), /^docs\(reviews\): индекс после сдвига каталога \(#9\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- #643: doc-коммит ветки конфликтует с dev только в INDEX.md ----------

test('#643 AC1: dev сдвинулся документами ревью другой задачи, ветка несёт свой doc-коммит с INDEX — слияние через Validate, не S6', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-merge-643-'));
  try {
    const origin = join(dir, 'origin.git');
    const work = join(dir, 'work');
    execFileSync('git', ['init', '-q', '--bare', origin]);
    execFileSync('git', ['clone', '-q', origin, work]);
    const cfg = ['-c', 'user.name=t', '-c', 'user.email=t@x'];
    const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...cfg, ...args], { encoding: 'utf8' }).trim();
    const reviews = join(work, 'docs', 'reviews');
    // Как делает шаг публикации: документ раунда и индекс, пересобранный по каталогу, — одним коммитом.
    const publish = (name, msg) => {
      writeFileSync(join(reviews, name), `# ${name}\nВердикт: **зелёный** · High: 0 · Medium: 0\n`);
      writeFileSync(join(reviews, 'INDEX.md'), buildIndex(reviews));
      git(work, 'add', '-A');
      git(work, 'commit', '-q', '-m', msg);
    };
    mkdirSync(reviews, { recursive: true });
    writeFileSync(join(work, 'a.mjs'), 'export const a = 20;\n');
    git(work, 'add', '.');
    publish('CODE-REVIEW-1-r1.md', 'base');
    git(work, 'branch', '-M', 'dev');
    git(work, 'push', '-q', '-u', 'origin', 'dev');
    git(work, 'checkout', '-q', '-b', 'issue/9-fix');
    writeFileSync(join(work, 'a.mjs'), 'export const a = 21;\n');
    git(work, 'commit', '-q', '-am', 'fix');
    const material = git(work, 'rev-parse', 'HEAD');
    publish('CODE-REVIEW-9-r1.md', 'docs: review document for #9');
    git(work, 'push', '-q', '-u', 'origin', 'issue/9-fix');
    git(work, 'checkout', '-q', 'dev');
    publish('CODE-REVIEW-8-r2.md', 'docs: review document for #8');
    git(work, 'push', '-q', 'origin', 'dev');
    git(work, 'checkout', '-q', 'issue/9-fix');
    // Предусловие: обычный ребейз на этом дереве действительно конфликтует в индексе.
    const probe = spawnSync('git', ['-C', work, ...cfg, 'rebase', 'origin/dev'], { encoding: 'utf8' });
    assert.notEqual(probe.status, 0, 'без помощника doc-коммит конфликтует');
    assert.equal(git(work, 'diff', '--name-only', '--diff-filter=U'), 'docs/reviews/INDEX.md');
    git(work, 'rebase', '--abort');

    const calls = [];
    const ops = realOps({ repo: 'x/y', token: 'none', issue: 9 });
    ops.pushWithLease = (sha, ref, expected) => {
      calls.push(['push', ref, expected]);
      const r = spawnSync('git', ['-C', work, 'push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, 'origin', `${sha}:refs/heads/${ref}`], { encoding: 'utf8' });
      return r.status === 0;
    };
    ops.dispatchValidate = (ref) => { calls.push(['dispatch', ref]); };
    ops.waitValidate = async (sha) => { calls.push(['validate', sha]); return { result: 'green', url: 'https://run/1' }; };
    ops.comment = (issue, body) => { calls.push(['comment', body.slice(0, 60)]); };
    ops.log = () => {};
    const inWork = (fn) => (...args) => { const cwd = process.cwd(); process.chdir(work); try { return fn(...args); } finally { process.chdir(cwd); } };
    for (const name of ['fetch', 'revParse', 'mergeBase', 'diffNames', 'patchId', 'rebaseOnto', 'freshIndex']) ops[name] = inWork(ops[name]);

    const r = await mergeCandidate({ branch: 'issue/9-fix', material, issue: 9, ops });
    assert.equal(r.action, 'push', JSON.stringify(calls));
    assert.ok(!calls.some((c) => c[0] === 'comment' && /конфликтует/.test(c[1])), 'нет возврата в S6 «конфликтует с dev»');
    const validateAt = calls.findIndex((c) => c[0] === 'validate');
    const devPushAt = calls.findIndex((c) => c[0] === 'push' && c[1] === 'dev');
    assert.ok(validateAt >= 0 && validateAt < devPushAt, 'кандидат уходит в dev только после Validate');
    const devTip = git(work, 'rev-parse', 'origin/dev');
    assert.equal(devTip, r.candidate);
    const index = `${git(work, 'show', `${devTip}:docs/reviews/INDEX.md`)}\n`;
    git(work, 'checkout', '-q', devTip);
    assert.equal(index, buildIndex(reviews), 'индекс кандидата = пересборка каталога');
    assert.match(index, /CODE-REVIEW-8-r2\.md/);
    assert.match(index, /CODE-REVIEW-9-r1\.md/);
    assert.match(git(work, 'show', `${devTip}:a.mjs`), /a = 21/);
    // Личность конвейера на переписанных коммитах сохранена.
    assert.equal(git(work, 'log', '-1', '--format=%cn', devTip), 'claude[bot]');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #596: шаг слияния считает patch-id через `git diff` кандидата, а тот несёт три
// копии бандла — семь мегабайт у #594. С умолчанием spawnSync в 1 МиБ процесс
// убивался по ENOBUFS, `status` приходил `null`, и вывод обрезался посередине.
test('#596: вывод больше мегабайта доезжает целиком, а не обрывается по буферу', () => {
  const bytes = 3 * 1024 * 1024;
  const r = sh(process.execPath, ['-e', `process.stdout.write('x'.repeat(${bytes}))`]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.length, bytes);
  assert.ok(MAX_COMMAND_OUTPUT_BYTES > bytes, 'предел выбран с запасом над проверяемым объёмом');
});

// #596: вторая половина дефекта — сбой ЗАПУСКА выдавался за ненулевой код
// возврата, и в сообщение уезжал усечённый stdout. Огрызок диффа выглядит
// осмысленным и уводит разбор в сторону; причина обязана быть названа.
test('#596: сбой запуска называет причину, а не притворяется кодом возврата', () => {
  const r = sh('houseplan-no-such-command-596', []);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /houseplan-no-such-command-596 не выполнился: ENOENT/);
  assert.equal(r.stdout, '');
});

// #657 r1 H1: документ код-ревью уезжает в ветку без индекса (1б), dev не
// двигался — fast-forward. Индекс на голове dev обязан быть свежим, иначе
// `reviews-index --check` в Validate красит dev на первом же тихом слиянии.
test('#657 r1 H1 на настоящем git: fast-forward несёт свежий INDEX.md, --check на голове dev зелёный', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-merge-ff-index-'));
  try {
    const bare = join(dir, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare]);
    const work = join(dir, 'work');
    execFileSync('git', ['clone', '-q', bare, work]);
    const cfg = ['-c', 'user.name=t', '-c', 'user.email=t@x'];
    const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...cfg, ...args], { encoding: 'utf8' }).trim();
    const commit = (msg) => execFileSync('git', ['-C', work, ...cfg, 'commit', '-q', '-am', msg]);
    mkdirSync(join(work, 'docs', 'reviews'), { recursive: true });
    writeFileSync(join(work, 'a.mjs'), 'export const a = 20;\n');
    writeFileSync(join(work, 'docs', 'reviews', 'CODE-REVIEW-8-r1.md'), '# CODE-REVIEW-8-r1\n');
    writeFileSync(join(work, 'docs', 'reviews', 'INDEX.md'), buildIndex(join(work, 'docs', 'reviews')));
    git(work, 'add', '.');
    commit('base');
    git(work, 'branch', '-M', 'dev');
    git(work, 'push', '-q', '-u', 'origin', 'dev');
    git(work, 'checkout', '-q', '-b', 'issue/9-fix');
    writeFileSync(join(work, 'a.mjs'), 'export const a = 21;\n');
    commit('fix');
    const material = git(work, 'rev-parse', 'HEAD');
    // публикация документа в ветку задачи — без индекса (1б)
    writeFileSync(join(work, 'docs', 'reviews', 'CODE-REVIEW-9-r1.md'), '# CODE-REVIEW-9-r1\nVerdict: green\n');
    git(work, 'add', '.');
    commit('docs: review document for #9');
    git(work, 'push', '-q', '-u', 'origin', 'issue/9-fix');

    const calls = [];
    const ops = realOps({ repo: 'x/y', token: 'none', issue: 9 });
    ops.pushWithLease = (sha, ref, expected) => {
      calls.push(['push', ref, expected]);
      const r = spawnSync('git', ['-C', work, 'push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, 'origin', `${sha}:refs/heads/${ref}`], { encoding: 'utf8' });
      return r.status === 0;
    };
    ops.dispatchValidate = (ref) => { calls.push(['dispatch', ref]); };
    ops.waitValidate = async (sha) => { calls.push(['validate', sha]); return { result: 'green', url: 'https://run/1' }; };
    ops.comment = (issue, body) => { calls.push(['comment', body.slice(0, 60)]); };
    ops.log = () => {};
    const inWork = (fn) => (...args) => { const cwd = process.cwd(); process.chdir(work); try { return fn(...args); } finally { process.chdir(cwd); } };
    for (const name of ['fetch', 'revParse', 'mergeBase', 'diffNames', 'patchId', 'rebaseOnto', 'freshIndex']) ops[name] = inWork(ops[name]);

    const r = await mergeCandidate({ branch: 'issue/9-fix', material, issue: 9, ops });
    assert.equal(r.action, 'fast-forward', JSON.stringify(calls));
    git(work, 'fetch', '-q', 'origin');
    const devTip = git(work, 'rev-parse', 'origin/dev');
    assert.equal(devTip, r.candidate);
    assert.equal(git(work, 'merge-base', '--is-ancestor', material, devTip) , '', 'материал — предок головы dev: слияние fast-forward');
    const index = git(work, 'show', `${devTip}:docs/reviews/INDEX.md`);
    assert.match(index, /CODE-REVIEW-9-r1\.md/, 'документ раунда виден через индекс');
    assert.match(index, /CODE-REVIEW-8-r1\.md/);
    git(work, 'checkout', '-q', '--detach', devTip);
    const check = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/reviews-index.mjs', import.meta.url)), '--dir=docs/reviews', '--check'], { cwd: work, encoding: 'utf8' });
    assert.equal(check.status, 0, `reviews-index --check на голове dev: ${check.stdout}${check.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #696: треки show/ship сливаются по лёгкому Validate — dispatch без мутантов.
test('#696: realOps with mutants=false dispatches a light Validate and accepts a light proof', async () => {
  const sha = 'c'.repeat(40);
  const tree = 'd'.repeat(40);
  const dispatches = [];
  const light = { databaseId: 5, attempt: 1, status: 'completed', conclusion: 'success', url: 'https://run/5', event: 'workflow_dispatch', headSha: sha };
  const exec = (cmd, args) => {
    if (cmd === 'gh' && args[0] === 'workflow' && args[1] === 'run') { dispatches.push(args.join(' ')); return { status: 0, stdout: '', stderr: '' }; }
    if (cmd === 'gh' && args[0] === 'run' && args[1] === 'list') return { status: 0, stdout: JSON.stringify([light]), stderr: '' };
    throw new Error(`unexpected ${cmd} ${args.join(' ')}`);
  };
  let clock = 0;
  const lightProof = (row) => {
    const context = mergeProofContext(row, sha, tree);
    const proof = buildCiProof({
      candidateSha: sha, candidateTree: tree, runId: row.databaseId, attempt: 1, event: row.event,
      needs: {
        preflight: { result: 'success' },
        changes: { result: 'success', outputs: { heavy: 'false', mutants_requested: 'false', frontend: 'true', backend: 'false', integration: 'false' } },
        reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' }, changed_mutants: { result: 'skipped' },
      },
    });
    return { ...context, proof, jobs: context.jobs.filter((job) => !job.name.startsWith('Мутанты')) };
  };
  const opsLight = realOps({
    repo: 'x/y', token: 'none', exec, mutants: false,
    sleep: async (ms) => { clock += ms; }, now: () => clock,
    candidateTree: async () => tree, proofContext: async (row) => lightProof(row),
  });
  opsLight.dispatchValidate('issue/9-x');
  assert.match(dispatches.at(-1), /mutants=false/);
  assert.equal((await opsLight.waitValidate(sha, { event: 'workflow_dispatch' })).result, 'green');
  const opsFull = realOps({
    repo: 'x/y', token: 'none', exec,
    sleep: async (ms) => { clock += ms; }, now: () => clock,
    candidateTree: async () => tree, proofContext: async (row) => lightProof(row),
  });
  opsFull.dispatchValidate('issue/9-x');
  assert.match(dispatches.at(-1), /mutants=true/);
  assert.notEqual((await opsFull.waitValidate(sha, { event: 'workflow_dispatch' })).result, 'green',
    'track ask still refuses a proof without mutants');
});

test('#696: трек show/ship — слияние ждёт push-прогон кандидата, без второго dispatch', async () => {
  const ops = fakeOps({ base: 'dev0', devTips: ['dev1'], branchTip: 'mat', material: 'mat' });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops, mutants: false });
  assert.equal(r.action, 'push');
  assert.ok(!ops.calls.some((c) => c[0] === 'dispatch'), 'лёгкий Validate уже запущен push кандидата');
  assert.deepEqual(ops.calls.filter((c) => c[0] === 'validate'), [['validate', 'cand-mat-on-dev1', 'push']]);
});

test('#696: push-прогона на кандидате нет — лёгкий dispatch и ожидание его', async () => {
  const ops = fakeOps({ base: 'dev0', devTips: ['dev1'], branchTip: 'mat', material: 'mat', validate: ['missing', 'green'] });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops, mutants: false });
  assert.equal(r.action, 'push');
  assert.deepEqual(ops.calls.filter((c) => c[0] === 'dispatch' || c[0] === 'validate'), [
    ['validate', 'cand-mat-on-dev1', 'push'], ['dispatch', 'issue/1-x'], ['validate', 'cand-mat-on-dev1', 'workflow_dispatch'],
  ]);
});

test('#696: трек ask по-прежнему диспатчит Validate с мутантами и push-прогон не ждёт', async () => {
  const ops = fakeOps({ base: 'dev0', devTips: ['dev1'], branchTip: 'mat', material: 'mat' });
  await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.deepEqual(ops.calls.filter((c) => c[0] === 'dispatch' || c[0] === 'validate'), [
    ['dispatch', 'issue/1-x'], ['validate', 'cand-mat-on-dev1', 'workflow_dispatch'],
  ]);
});


test('#702: после fast-forward ветка задачи удаляется с lease на влитую вершину', async () => {
  const ops = fakeOps({ devTips: ['dev0'], branchTip: 'mat', material: 'mat', indexStale: true });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.merged, true);
  assert.deepEqual(ops.calls.filter((c) => c[0] === 'delete'), [['delete', 'issue/1-x', 'mat']],
    'вершина ветки — материал: индекс-коммит живёт только в dev');
  assert.match(ops.calls.find((c) => c[0] === 'comment')[1], /ветка `issue\/1-x` удалена/);
});

test('#702: после слияния кандидата удаляется ветка с его вершиной; неудачное слияние ветку не трогает', async () => {
  const ops = fakeOps({ base: 'dev0', devTips: ['dev1'], branchTip: 'mat', material: 'mat' });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'push');
  assert.deepEqual(ops.calls.filter((c) => c[0] === 'delete'), [['delete', 'issue/1-x', 'cand-mat-on-dev1']]);
  const red = fakeOps({ base: 'dev0', devTips: ['dev1'], branchTip: 'mat', material: 'mat', validate: ['failed'] });
  await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops: red });
  assert.deepEqual(red.calls.filter((c) => c[0] === 'delete'), [], 'красный Validate — ветка остаётся автору');
  const stale = fakeOps({ devTips: ['dev0'], branchTip: 'other', material: 'mat' });
  stale.revParse = (ref) => (ref === 'origin/dev' ? 'dev0' : ref.startsWith('origin/issue') ? 'other' : ref.endsWith('^') ? 'foreign' : ref);
  const rejected = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops: stale });
  assert.equal(rejected.action, 'reject-stale');
  assert.deepEqual(stale.calls.filter((c) => c[0] === 'delete'), [], '#312 — ветку не трогаем');
});

test('#702: сдвинутая вершина — ветка остаётся, слияние в силе', async () => {
  const ops = fakeOps({ devTips: ['dev0'], branchTip: 'mat', material: 'mat', deleteOk: false });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.merged, true);
  assert.match(ops.calls.find((c) => c[0] === 'comment')[1], /оставлена: её вершина сдвинулась после слияния/);
});

// ---------- #705: отказ push — три исхода, а не один «lease устарел» ----------
//
// #700 (runs 36484993494, 36487044060): GitHub не принял кандидата, менявшего
// `.github/workflows/`, от токена без права на workflow, а слияние по слову
// `rejected` выдало это за «ветка изменилась после материала (#312)» и не
// напечатало stderr. Тексты отказа — дословно те, что присылает GitHub.

const FAKE_TOKEN = 'ghs_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
const PUSH_URL = `https://x-access-token:${FAKE_TOKEN}@github.com/o/r`;
const failedTo = `error: failed to push some refs to '${PUSH_URL}'`;
const remoteRejected = (reason, ref = 'issue/700-x') => `To https://github.com/o/r\n ! [remote rejected] 0123abcd -> ${ref} (${reason})\n${failedTo}`;
const WORKFLOW_REFUSALS = {
  'classic и fine-grained PAT': 'refusing to allow a Personal Access Token to create or update workflow `.github/workflows/validate.yml` without `workflow` scope',
  'OAuth App': 'refusing to allow an OAuth App to create or update workflow `.github/workflows/validate.yml` without `workflow` scope',
  'GitHub App / GITHUB_TOKEN': 'refusing to allow a GitHub App to create or update workflow `.github/workflows/validate.yml` without `workflows` permission',
  'bot (прежняя форма)': 'refusing to allow a bot to create or update workflow `.github/workflows/validate.yml`',
  'integration (прежняя форма)': 'refusing to allow an integration to create or update .github/workflows/validate.yml',
};

test('#705 AC1: разбор отказа push различает устаревший lease, право на workflow и прочий отказ GitHub', () => {
  // устаревший lease — прежнее поведение (#312 / новая попытка)
  for (const reason of ['stale info', 'fetch first', 'non-fast-forward']) {
    const r = classifyPushRefusal(`To https://github.com/o/r\n ! [rejected]        0123abcd -> dev (${reason})\n${failedTo}`);
    assert.equal(r.kind, PUSH_REFUSAL.stale, reason);
    assert.equal(r.reason, reason);
  }
  // гонка lease на стороне сервера — тоже устаревший lease, а не отказ GitHub
  assert.equal(classifyPushRefusal(remoteRejected("cannot lock ref 'refs/heads/dev': is at 1111 but expected 2222", 'dev')).kind, PUSH_REFUSAL.stale);
  // отказ по праву на workflow — каждый вид токена
  for (const [who, reason] of Object.entries(WORKFLOW_REFUSALS)) {
    const r = classifyPushRefusal(remoteRejected(reason));
    assert.equal(r.kind, PUSH_REFUSAL.workflow, who);
    assert.deepEqual(r.files, ['.github/workflows/validate.yml'], who);
    assert.equal(r.reason, reason, who);
  }
  // прочий отказ GitHub — свой исход с причиной
  const hook = classifyPushRefusal(`remote: error: GH006: Protected branch update failed for refs/heads/dev.\n${remoteRejected('protected branch hook declined', 'dev')}`);
  assert.equal(hook.kind, PUSH_REFUSAL.remote);
  assert.equal(hook.reason, 'protected branch hook declined');
  assert.equal(classifyPushRefusal(remoteRejected('pre-receive hook declined')).kind, PUSH_REFUSAL.remote);
  // не отказ вовсе — сбой шага, как раньше
  assert.equal(classifyPushRefusal(`fatal: unable to access '${PUSH_URL}/': The requested URL returned error: 403`).kind, PUSH_REFUSAL.unknown);
  assert.equal(classifyPushRefusal('').kind, PUSH_REFUSAL.unknown);
  // решение: отказ GitHub ведёт в S6 своим исходом, а не в «ветка изменилась»
  assert.deepEqual(decideMerge({ fresh: true, refused: PUSH_REFUSAL.workflow }), { action: 'push-refused-workflow', to: 'S6-in-progress' });
  assert.deepEqual(decideMerge({ fresh: true, refused: PUSH_REFUSAL.remote }), { action: 'push-refused', to: 'S6-in-progress' });
});

test('#705 AC1: ответ git уходит в журнал без токенов и URL с учётными данными', () => {
  const pat = 'ghp_' + '0123456789abcdefghijABCDEFGHIJ012345';
  const fine = 'github_pat_' + '11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz';
  const oauth = 'gho_' + 'abcdefghij0123456789ABCDEFGHIJ012345';
  const text = [
    `fatal: unable to access 'https://x-access-token:${FAKE_TOKEN}@github.com/o/r/'`,
    `https://oauth2:${fine}@github.com/o/r and https://user:${pat}@example.com/x`,
    `token ${pat}, ${oauth}, ${fine}, ${FAKE_TOKEN}`,
    'Authorization: Bearer abc.def.ghi',
    'plain-secret-value in text',
  ].join('\n');
  const clean = redactSecrets(text, ['plain-secret-value']);
  for (const secret of [FAKE_TOKEN, pat, fine, oauth, 'abc.def.ghi', 'plain-secret-value', 'x-access-token:']) {
    assert.ok(!clean.includes(secret), `${secret.slice(0, 12)}… вырезан`);
  }
  assert.match(clean, /https:\/\/\*\*\*@github\.com\/o\/r\//, 'хост и путь остаются — по ним видно, куда шёл push');
  const refusal = classifyPushRefusal(remoteRejected(WORKFLOW_REFUSALS['classic и fine-grained PAT']), { secrets: [FAKE_TOKEN] });
  assert.ok(!refusal.stderr.includes(FAKE_TOKEN));
  assert.match(refusal.stderr, /! \[remote rejected\] 0123abcd -> issue\/700-x \(refusing to allow/, 'сам отказ в журнале целиком');
});

/** realOps с git, отвечающим на push заданным stderr. */
function refusingOps(stderr) {
  const logs = [];
  const pushes = [];
  const exec = (cmd, args) => {
    if (cmd === 'git' && args[0] === 'push') { pushes.push(args); return { status: 1, stdout: '', stderr }; }
    throw new Error(`unexpected ${cmd} ${args.join(' ')}`);
  };
  return { ops: realOps({ repo: 'o/r', token: FAKE_TOKEN, exec, log: (line) => logs.push(line) }), logs, pushes };
}

test('#705 AC1: realOps.pushWithLease — lease устарел → false, отказ GitHub → PushRefusal, stderr в журнале без токена', () => {
  const stale = refusingOps(`To https://github.com/o/r\n ! [rejected]        0123abcd -> dev (stale info)\n${failedTo}`);
  assert.equal(stale.ops.pushWithLease('0123abcd', 'dev', 'dev0'), false, 'прежнее поведение: новая попытка или #312');
  assert.match(stale.logs.join('\n'), /git push dev отклонён — stale \(stale info\):[\s\S]*\(stale info\)/);
  assert.ok(stale.pushes[0].includes(PUSH_URL), 'push идёт с токеном');

  const workflow = refusingOps(remoteRejected(WORKFLOW_REFUSALS['GitHub App / GITHUB_TOKEN']));
  assert.throws(() => workflow.ops.pushWithLease('0123abcd', 'issue/700-x', 'mat'), (error) => {
    assert.ok(error instanceof PushRefusal);
    assert.equal(error.refusal.kind, PUSH_REFUSAL.workflow);
    assert.equal(error.ref, 'issue/700-x');
    assert.equal(error.sha, '0123abcd');
    return true;
  });
  const journal = workflow.logs.join('\n');
  assert.match(journal, /refusing to allow a GitHub App to create or update workflow/, 'stderr напечатан');
  assert.ok(!journal.includes(FAKE_TOKEN), 'без токена');

  const other = refusingOps(remoteRejected('pre-receive hook declined', 'dev'));
  assert.throws(() => other.ops.pushWithLease('0123abcd', 'dev', 'dev0'), (error) => error.refusal?.kind === PUSH_REFUSAL.remote);

  const broken = refusingOps(`fatal: unable to access '${PUSH_URL}/': Could not resolve host: github.com`);
  assert.throws(() => broken.ops.pushWithLease('0123abcd', 'dev', 'dev0'), (error) => {
    assert.ok(!(error instanceof PushRefusal), 'сбой сети — сбой шага, а не исход');
    assert.ok(!error.message.includes(FAKE_TOKEN), 'текст ошибки уйдёт в issue — без токена');
    return true;
  });

  // удаление влитой ветки: только устаревший lease значит «вершина сдвинулась»
  assert.equal(refusingOps(' ! [rejected]        (delete) -> issue/1-x (stale info)').ops.deleteBranch('issue/1-x', 'mat'), false);
  assert.throws(() => refusingOps(remoteRejected('protected branch hook declined', 'issue/1-x')).ops.deleteBranch('issue/1-x', 'mat'),
    /remote-rejected/, 'правило ветки — не «вершина сдвинулась после слияния»');
});

test('#705 AC2: кандидат меняет workflow-файл — S6 с комментарием о праве, не #312; в dev ничего', async () => {
  const ops = fakeOps({ devTips: ['dev1'], branchTip: 'mat', material: 'mat',
    refuse: { ref: 'issue/1-x', stderr: remoteRejected(WORKFLOW_REFUSALS['classic и fine-grained PAT'], 'issue/1-x') } });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops, pipelineUrl: 'https://run/705' });
  assert.equal(r.action, 'push-refused-workflow');
  assert.equal(r.to, 'S6-in-progress');
  assert.equal(r.merged, false);
  assert.ok(!ops.calls.some((c) => c[0] === 'push' && c[2] === 'dev'), 'в dev не уходит');
  assert.ok(!ops.calls.some((c) => c[0] === 'validate' || c[0] === 'delete'));
  const comments = ops.calls.filter((c) => c[0] === 'comment');
  assert.equal(comments.length, 1);
  const body = comments[0][2];
  assert.match(body, /кандидат меняет workflow-файл, токен конвейера не может его опубликовать: ребейз и push делает автор, либо владелец выдаёт право/);
  assert.doesNotMatch(body, /ветка изменилась после проверенного материала/);
  assert.match(body, /`\.github\/workflows\/validate\.yml`/, 'файл назван');
  assert.match(body, /вердикт в силе/);
  assert.match(body, /```\n[\s\S]*refusing to allow a Personal Access Token[\s\S]*```/, 'ответ GitHub в комментарии');
  assert.ok(!body.includes(FAKE_TOKEN), 'без токена');
  assert.match(body, /\[Прогон конвейера\]\(https:\/\/run\/705\)/);
});

test('#705 AC2: прочий отказ GitHub на push в dev — свой исход в S6, без повторных попыток', async () => {
  const ops = fakeOps({ devTips: ['dev0'], branchTip: 'mat', material: 'mat',
    refuse: { ref: 'dev', stderr: remoteRejected('protected branch hook declined', 'dev') } });
  const r = await mergeCandidate({ branch: 'issue/1-x', material: 'mat', issue: 1, ops });
  assert.equal(r.action, 'push-refused');
  assert.equal(r.to, 'S6-in-progress');
  assert.equal(ops.calls.filter((c) => c[0] === 'push').length, 1, 'отказ GitHub — не гонка lease: повтор его не лечит');
  const body = ops.calls.find((c) => c[0] === 'comment')[2];
  assert.match(body, /GitHub отклонил push в `dev`/);
  assert.match(body, /`protected branch hook declined`/);
  assert.doesNotMatch(body, /workflow-файл/);
});

test('#705: разбор для шага workflow — тот же исход и комментарий стража ребейза', () => {
  const { refusal, comment } = describePushRefusal(remoteRejected(WORKFLOW_REFUSALS['OAuth App']), {
    ref: 'issue/1-x', branch: 'issue/1-x', candidate: 'c'.repeat(40), stage: 'rebase', pipelineUrl: 'https://run/1', secrets: [FAKE_TOKEN],
  });
  assert.equal(refusal.kind, PUSH_REFUSAL.workflow);
  assert.match(comment, /^\*\*Ревью не запускалось: кандидат меняет workflow-файл, токен конвейера не может его опубликовать: ребейз и push делает автор, либо владелец выдаёт право/);
  assert.match(comment, /цикл ревью не израсходован/);
  assert.doesNotMatch(comment, /вердикт в силе/, 'вердикта ещё нет');
  assert.ok(!comment.includes(FAKE_TOKEN));
  assert.equal(describePushRefusal(' ! [rejected] a -> b (stale info)').comment, '', 'на устаревший lease комментария нет: шаг падает, как раньше');
});

test('#705 на настоящем git: отказ сервера `[remote rejected]` — не устаревший lease, отказ по lease — прежний false', (t) => {
  if (process.platform === 'win32') { t.skip('хук pre-receive — shell-скрипт'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'hp-merge-705-'));
  try {
    const bare = join(dir, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare]);
    // #717: без фонового автообслуживания — иначе rmSync ловит его lock-файлы.
    for (const [key, value] of [['receive.autogc', 'false'], ['maintenance.auto', 'false'], ['gc.auto', '0']]) git(bare, 'config', key, value);
    const work = join(dir, 'work');
    execFileSync('git', ['clone', '-q', bare, work]);
    const cfg = ['-c', 'user.name=t', '-c', 'user.email=t@x', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0'];
    writeFileSync(join(work, 'a.txt'), '1\n');
    git(work, 'add', '.');
    execFileSync('git', ['-C', work, ...cfg, 'commit', '-q', '-m', 'base']);
    git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/dev');
    const base = git(work, 'rev-parse', 'HEAD');
    writeFileSync(join(work, 'a.txt'), '2\n');
    execFileSync('git', ['-C', work, ...cfg, 'commit', '-q', '-am', 'next']);
    const next = git(work, 'rev-parse', 'HEAD');
    // URL с токеном переписывается на локальный bare — push настоящий
    const exec = (cmd, args, opts) => sh(cmd, cmd === 'git'
      ? ['-C', work, '-c', `url.${bare}.insteadOf=https://x-access-token:${FAKE_TOKEN}@github.com/o/r`, ...args] : args, opts);
    const logs = [];
    const ops = realOps({ repo: 'o/r', token: FAKE_TOKEN, exec, log: (line) => logs.push(line) });
    assert.equal(ops.pushWithLease(next, 'dev', 'f'.repeat(40)), false, 'lease на чужую вершину — stale info');
    mkdirSync(join(bare, 'hooks'), { recursive: true });
    writeFileSync(join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "GH013: Repository rule violations found for refs/heads/dev." >&2\nexit 1\n', { mode: 0o755 });
    assert.throws(() => ops.pushWithLease(next, 'dev', base), (error) => {
      assert.equal(error.refusal?.kind, PUSH_REFUSAL.remote, JSON.stringify(error.refusal));
      assert.equal(error.refusal.reason, 'pre-receive hook declined');
      return true;
    });
    assert.match(logs.join('\n'), /GH013: Repository rule violations/, 'ответ сервера в журнале');
    assert.equal(git(work, 'ls-remote', bare, 'refs/heads/dev').split('\t')[0], base, 'dev не тронут');
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
