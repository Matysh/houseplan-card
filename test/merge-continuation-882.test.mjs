// #882: продолжение слияния (#856) сверяет patch-id материала ревью с
// кандидатом. Материал — вершина ветки до ребейза; после force-push кандидата
// он не лежит ни на одной ветке, и клон job (только refs/heads/*) его не знает.
// Фикстуры — настоящий git: bare «origin» во временном каталоге, клон job,
// собранный так же, как checkout (`+refs/heads/*`, `+refs/tags/*`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sealContinuation } from '../scripts/continuation-record.mjs';
import { realOps, sh } from '../scripts/merge-candidate.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { mergeReviewedCandidate, resumeMergeContinuation } from '../scripts/workflow-continuation.mjs';

const repo = 'o/r', issue = 77, branch = 'issue/77-material', body = 'immutable issue';
const FAKE_TOKEN = `ghs_${'F'.repeat(36)}`;
const PUSH_URL = `https://x-access-token:${FAKE_TOKEN}@github.com/${repo}`;
// Глобальные настройки машины (подпись, push.negotiate, автообслуживание) фикстуре не нужны.
const QUIET = ['-c', 'user.name=t', '-c', 'user.email=t@x', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false',
  '-c', 'push.negotiate=false', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0'];
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...QUIET, ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const has = (cwd, sha) => spawnSync('git', ['-C', cwd, 'cat-file', '-e', `${sha}^{commit}`]).status === 0;
const write = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
const commitAll = (work, message) => { git(work, 'add', '.'); git(work, 'commit', '-qm', message); return git(work, 'rev-parse', 'HEAD'); };

/**
 * Состояние, в котором застряли #877 и #878: ревью видело `material`, `dev`
 * сдвинул документ ревью соседа, слияние перебазировало ветку, добавило
 * индекс (doc-коммит конвейера) и опубликовало кандидата force-push'ем.
 */
function fixture(t, { tamper = false, material: sealedMaterial } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-882-'));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const bare = join(dir, 'origin.git'), work = join(dir, 'author'), job = join(dir, 'job');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  for (const [key, value] of [['receive.autogc', 'false'], ['gc.auto', '0'], ['maintenance.auto', 'false']]) git(bare, 'config', key, value);
  execFileSync('git', ['init', '-q', work]);
  git(work, 'remote', 'add', 'origin', bare);
  write(work, 'a.mjs', 'export const a = 20;\n');
  write(work, 'b.mjs', 'export const b = 1;\n');
  write(work, 'docs/release-ledger/cycle.json', JSON.stringify({ schema: 1, baseStable: 'v1.0.0', targetStable: 'v1.1.0',
    milestone: { number: 1, title: '1.1' } }));
  commitAll(work, 'base');
  git(work, 'branch', '-M', 'dev');
  git(work, 'tag', 'v1.0.0');
  git(work, 'push', '-q', 'origin', 'dev', 'v1.0.0');
  git(work, 'checkout', '-q', '-b', branch);
  write(work, 'b.mjs', "import { a } from './a.mjs';\nexport const b = a * 2;\n");
  write(work, `docs/release-ledger/v1.0.0/${issue}.json`, JSON.stringify({ schema: 1, issue, baseStable: 'v1.0.0',
    category: 'infra', rationale: 'fixture' }));
  const material = commitAll(work, 'material');
  git(work, 'push', '-q', 'origin', branch);
  git(work, 'checkout', '-q', 'dev');
  write(work, 'docs/reviews/CODE-REVIEW-5-r1.md', '# neighbour review\n');
  const dev = commitAll(work, 'docs: review document for #5');
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', branch);
  git(work, 'rebase', '-q', 'dev');
  if (tamper) write(work, 'b.mjs', "import { a } from './a.mjs';\nexport const b = a * 3;\n");
  write(work, 'docs/reviews/INDEX.md', '# index\n');
  const candidate = commitAll(work, 'docs(reviews): index');
  git(work, 'push', '-q', '--force', 'origin', branch);
  // Клон job: checkout с fetch-depth 0 приносит ветки и теги, не недостижимые коммиты.
  execFileSync('git', ['init', '-q', job]);
  git(job, 'remote', 'add', 'origin', pathToFileURL(bare).href);
  git(job, 'fetch', '-q', 'origin', '+refs/heads/*:refs/remotes/origin/*', '+refs/tags/*:refs/tags/*');
  git(job, 'checkout', '-q', '--detach', 'origin/dev');
  const p = sealContinuation({ kind: 'merge', repo, issue, branch, material: sealedMaterial || material, candidate,
    tree: git(work, 'rev-parse', `${candidate}^{tree}`), dev, epoch: 'epoch-1', bodyDigest: issueBodyDigest(body),
    policy: 'merge-light', producerPath: '.github/workflows/process.yml' }, join(dir, 'pending'),
  { GITHUB_RUN_ID: '20', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: dev, GITHUB_REF_NAME: 'main' });
  const pushes = [], milestones = [], moves = [], comments = [];
  // Push настоящий: URL с токеном переписывается на локальный bare.
  const exec = (cmd, args, opts) => {
    if (cmd === 'git' && args[0] === 'push') pushes.push(args);
    return sh(cmd, cmd === 'git' ? [...QUIET, '-c', `url.${bare}.insteadOf=${PUSH_URL}`, ...args] : args, opts);
  };
  const ops = realOps({ repo, token: FAKE_TOKEN, issue, exec, log: () => {} });
  ops.recordReleaseMilestone = sha => milestones.push(sha); // milestone API — вне фикстуры
  const neighbour = () => {
    git(work, 'checkout', '-q', 'dev');
    write(work, 'docs/reviews/CODE-REVIEW-6-r1.md', '# another neighbour\n');
    const sha = commitAll(work, 'docs: review document for #6');
    git(work, 'push', '-q', 'origin', 'dev');
    return sha;
  };
  const head = ref => git(bare, 'rev-parse', `refs/heads/${ref}`);
  // Свежесть — как у continueWorkflows: текущие dev и ветка на origin.
  const state = () => {
    const devNow = head('dev');
    return { issue: { state: 'open', labels: ['S7-code-review'], body }, request: { id: 'epoch-1', label: 'S7-code-review' },
      latestProcess: 20, branch: head(branch), dev: devNow,
      merged: spawnSync('git', ['-C', bare, 'merge-base', '--is-ancestor', candidate, devNow]).status === 0 };
  };
  const devPushes = () => pushes.filter(args => args.at(-1).endsWith(':refs/heads/dev'));
  return { bare, job, material, candidate, dev, p, ops, pushes, devPushes, milestones, moves, comments, neighbour, head, state };
}

/** Путь `continueWorkflows` для `kind: merge`: cwd — клон job, затем resume с зелёным доказательством. */
async function runContinuation(f, { merge } = {}) {
  const cwd = process.cwd();
  process.chdir(f.job);
  try {
    f.ops.fetch('dev', f.p.branch);
    return await resumeMergeContinuation(f.p, { state: f.state, proof: () => ({ status: 'green' }),
      merge: merge || (() => mergeReviewedCandidate(f.p, f.ops)),
      move: (...v) => f.moves.push(v), comment: text => f.comments.push(text) });
  } finally { process.chdir(cwd); }
}

test('#882 AC1 material on no branch is fetched by SHA; exact candidate goes to dev with lease on the sealed dev', async t => {
  const f = fixture(t);
  assert.notEqual(f.candidate, f.material);
  assert.equal(has(f.job, f.material), false, 'precondition: the job clone does not know the reviewed material');
  assert.throws(() => git(f.job, 'merge-base', f.material, f.dev), /Not a valid commit name/, 'the #877/#878 failure');
  const result = await runContinuation(f);
  assert.equal(result.to, 'S8-merged', JSON.stringify(result));
  assert.equal(f.head('dev'), f.candidate, 'dev is exactly the validated candidate');
  assert.equal(has(f.job, f.material), true, 'material delivered');
  assert.deepEqual(f.devPushes().map(args => args.find(a => a.startsWith('--force-with-lease='))),
    [`--force-with-lease=refs/heads/dev:${f.dev}`]);
  assert.deepEqual(f.moves, [['S7-code-review', 'S8-merged']]);
  assert.deepEqual(f.milestones, [f.candidate]);
  // continueWorkflows вызывает именно эту функцию, а не свою копию тела.
  const source = readFileSync(new URL('../scripts/workflow-continuation.mjs', import.meta.url), 'utf8');
  assert.match(source, /merge: \(\) => mergeReviewedCandidate\(p, ops\b/);
});

test('#882 AC2 delivered material keeps the old guards: changed patch, moved dev, rejected lease', async t => {
  const changed = fixture(t, { tamper: true });
  await assert.rejects(runContinuation(changed), /reviewed patch changed/);
  assert.equal(has(changed.job, changed.material), true, 'the patch was compared on delivered material');
  assert.deepEqual(changed.devPushes(), []);
  assert.equal(changed.head('dev'), changed.dev);
  assert.deepEqual(changed.moves, [], 'label unchanged');

  const moved = fixture(t);
  const after = moved.neighbour();
  let merges = 0;
  const returned = await runContinuation(moved, { merge: () => { merges++; return mergeReviewedCandidate(moved.p, moved.ops); } });
  assert.equal(returned.action, 'return');
  assert.equal(returned.to, 'S6-in-progress');
  assert.equal(merges, 0);
  assert.deepEqual(moved.devPushes(), []);
  assert.equal(moved.head('dev'), after);

  const raced = fixture(t);
  const check = raced.ops.checkReleaseEntry;
  let racedTip;
  // dev сдвигается между последней сверкой состояния и push.
  raced.ops.checkReleaseEntry = sha => { racedTip = raced.neighbour(); return check(sha); };
  const refused = await runContinuation(raced);
  assert.equal(refused.action, 'noop');
  assert.match(refused.reason, /lease\/branch changed before dev push/);
  assert.equal(raced.devPushes().length, 1, 'one push attempt, refused by the lease');
  assert.equal(raced.head('dev'), racedTip, 'the neighbour commit is not overwritten');
  assert.deepEqual(raced.moves, []);
  assert.deepEqual(raced.milestones, []);
});

test('#882 AC3 undeliverable material: no push, no label move, stderr names the step and SHA without a token', async t => {
  const missing = 'deadbeef'.repeat(5);
  const f = fixture(t, { material: missing });
  const lines = [];
  t.mock.method(console, 'error', (...args) => lines.push(args.join(' ')));
  await assert.rejects(runContinuation(f), /git fetch/);
  t.mock.restoreAll();
  assert.deepEqual(f.devPushes(), []);
  assert.equal(f.head('dev'), f.dev);
  assert.deepEqual(f.moves, [], 'label unchanged');
  assert.deepEqual(f.comments, []);
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0], new RegExp(`material fetch ${missing}`));
  assert.ok(!lines[0].includes(FAKE_TOKEN));

  // Ответ git с учётными данными: в журнал — шаг и SHA, без токена.
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
  const leaky = realOps({ repo, token: FAKE_TOKEN, issue, log: () => {}, exec: (cmd, args) => {
    assert.deepEqual([cmd, ...args], ['git', 'fetch', '-q', 'origin', f.p.material]);
    return { status: 128, stdout: '', stderr: `fatal: unable to access '${PUSH_URL}/': The requested URL returned error: 403\n`
      + `Authorization: Bearer ${FAKE_TOKEN}` };
  } });
  for (const name of ['mergeBase', 'patchId', 'checkReleaseEntry', 'pushWithLease']) leaky[name] = () => assert.fail(`${name} after a failed delivery`);
  assert.throws(() => mergeReviewedCandidate(f.p, leaky, { secrets: [FAKE_TOKEN] }), /git fetch/);
  assert.equal(logged.length, 1);
  assert.match(logged[0], new RegExp(`^merge continuation: material fetch ${f.p.material} failed: .*403`));
  assert.ok(!logged[0].includes(FAKE_TOKEN) && !logged[0].includes('x-access-token:'), logged[0]);
});
