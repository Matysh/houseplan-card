import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QueueController, MemoryQueueStore } from '../lib/queue.mjs';
import { returnPublishedHistory, prepareReturnEnvironment } from '../lib/return-worker.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
async function fixture(t, { reusedBranch = false, lostCreate = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'hp-return-worker-')); t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = { id: 'stable1', kind: 'stable', status: 'published', tag: 'v1.1.0', sha: B };
  const queue = new QueueController(new MemoryQueueStore());
  const issues = new Map(), updates = [], gitCalls = [], comments = new Map();
  let created = 0, finished = 0, installations = 0, included = false, localBranch = null, worktree = null;
  const api = { owner: 'owner', repo: 'repo', root: '/repos/owner/repo',
    request: async (method, path, body) => {
      if (method === 'GET' && path.includes('/issues?')) return [...issues.values()].map(value => structuredClone(value));
      if (method === 'POST' && path.endsWith('/labels')) { issues.get(9).labels.push(...body.labels); return []; }
      throw Error(`${method} ${path}`);
    },
    getIssue: async number => structuredClone(issues.get(number)),
    createIssue: async value => { created++; const issue = { number: 9, state: 'open', ...structuredClone(value) }; issues.set(9, issue);
      if (lostCreate) { lostCreate = false; throw Error('POST response was lost'); } return structuredClone(issue); },
    moveStatus: async (number, to) => { const row = issues.get(number); row.labels = row.labels.filter(label => !/^S[1-8]-/.test(label)).concat(to); },
    removeLabel: async (number, label) => { const row = issues.get(number); row.labels = row.labels.filter(name => name !== label); },
    updateIssue: async (number, change) => Object.assign(issues.get(number), change),
    upsertComment: async (number, { marker, body }) => comments.set(`${number}:${marker}`, body),
  };
  const git = { cwd: root, dev: 'dev',
    verifyDevReturn: async sourceSha => { assert.equal(sourceSha, B); if (!included) throw Object.assign(Error('not an ancestor'), { code: 1 }); return { devSha: C }; },
    prepareDevReturn: async ({ issue, branch, worktree: requested }) => {
      if (!reusedBranch) { worktree = requested; localBranch = branch; await mkdir(worktree, { recursive: true }); }
      return { prepared: true, reused: reusedBranch, task: { issue, branch, track: 'show', layer: 'product', materialSha: C,
        syncMode: 'merge', mergeSourceSha: B, releaseTag: candidate.tag } };
    },
    git: async args => {
      gitCalls.push(args);
      if (args.join(' ') === 'worktree list --porcelain') return worktree ? `worktree ${worktree}\nHEAD ${C}\nbranch refs/heads/${localBranch}\n\n` : '';
      if (args[0] === 'rev-parse') { if (localBranch) return C; throw Object.assign(Error('missing branch'), { code: 128 }); }
      if (args[0] === 'worktree' && args[1] === 'add') {
        assert.ok(!args.includes('--force')); assert.ok(!args.includes('-B'));
        if (args[2] === '-b') { localBranch = args[3]; worktree = args[4]; } else { worktree = args[2]; localBranch = args[3]; }
        await mkdir(worktree, { recursive: true }); return '';
      }
      throw Error(args.join(' '));
    },
  };
  const options = { candidate, api, git, queue, config: { workspace: root }, onUpdate: async event => updates.push(structuredClone(event)),
    prepareEnvironment: async ({ worktree }) => { installations++; assert.ok(worktree.startsWith(root)); },
    finish: async ({ config, worktree, task, event, prepareEnvironment }) => {
      finished++; assert.equal(config.workspace, worktree); assert.equal(event.branch, task.branch);
      const queued = (await queue.store.read()).state.tasks[9]; assert.equal(queued.releaseTag, candidate.tag);
      const state = await queue.dispatch({ id: 'admit', type: 'admit' }), token = state.active.token;
      await queue.dispatch({ id: 'sync', type: 'synchronized', issue: 9, token, expectedBase: A, materialSha: C, patchId: C,
        review: { source: 'published-release', verdict: 'accepted', patchId: C } });
      await prepareEnvironment();
      await queue.dispatch({ id: 's6', type: 's6-complete', issue: 9, token, materialSha: C, outcome: 'passed' });
      await queue.dispatch({ id: 'merged', type: 'merged', issue: 9, token, materialSha: C, actualDevSha: C });
      included = true; await api.moveStatus(9, 'S8-merged'); return { action: 'merged' };
    } };
  return { options, issues, updates, gitCalls, comments, queue, get created() { return created; }, get finished() { return finished; },
    get installations() { return installations; }, set included(value) { included = value; } };
}

test('published history reaches dev through queued S6 and closes its service issue; retry does no work', async t => {
  const f = await fixture(t), result = await returnPublishedHistory(f.options);
  assert.equal(result.status, 'completed'); assert.equal(result.devSha, C);
  assert.equal(f.created, 1); assert.equal(f.finished, 1); assert.equal(f.installations, 1);
  assert.equal(f.updates[0].result.issue, 9); assert.ok(f.updates[0].result.branch);
  assert.equal(f.issues.get(9).state, 'closed'); assert.deepEqual(f.issues.get(9).labels.sort(), ['infra', 'track:show']);
  assert.equal((await f.queue.store.read()).state.tasks[9].status, 'S8-merged');
  const retried = await returnPublishedHistory({ ...f.options, previous: result });
  assert.equal(retried.alreadyIncluded, true); assert.equal(f.finished, 1); assert.equal(f.created, 1); assert.equal(f.comments.size, 1);
});

test('lost issue-create response is found by marker instead of creating another service issue', async t => {
  const f = await fixture(t, { lostCreate: true });
  assert.equal((await returnPublishedHistory(f.options)).status, 'completed'); assert.equal(f.created, 1);
});

test('a remote return branch resumes in a new local worktree without resetting existing refs', async t => {
  const f = await fixture(t, { reusedBranch: true });
  assert.equal((await returnPublishedHistory(f.options)).status, 'completed');
  const creation = f.gitCalls.find(args => args[0] === 'worktree' && args[1] === 'add');
  assert.ok(creation); assert.equal(creation[2], '-b'); assert.equal(creation.at(-1), C);
  assert.ok(f.gitCalls.every(args => !args.includes('reset') && !args.includes('--force') && !args.includes('-B')));
});

test('installed track is preserved and owner-blocked service work is not resumed', async t => {
  const f = await fixture(t);
  f.issues.set(9, { number: 9, state: 'open', labels: ['infra', 'track:ship', 'S6-in-progress'],
    body: '<!-- process-next-release-return:v1.1.0 -->' });
  const original = f.options.finish;
  f.options.finish = async request => { assert.equal(request.task.track, 'ship'); return original(request); };
  assert.equal((await returnPublishedHistory(f.options)).status, 'completed'); assert.equal(f.created, 0);
  const stopped = await fixture(t); stopped.issues.set(9, { number: 9, state: 'open', labels: ['infra', 'track:ask', 'blocked'],
    body: '<!-- process-next-release-return:v1.1.0 -->' });
  const result = await returnPublishedHistory(stopped.options);
  assert.equal(result.status, 'pending'); assert.match(result.reason, /owner stopped/); assert.equal(stopped.finished, 0);
  assert.ok(stopped.issues.get(9).labels.includes('blocked'));
});

test('a returned review finding waits for executor correction rather than another automatic paid round', async t => {
  const f = await fixture(t); f.issues.set(9, { number: 9, state: 'open', labels: ['infra', 'track:show', 'S6-in-progress'],
    body: '<!-- process-next-release-return:v1.1.0 -->' });
  const { state, version } = await f.queue.store.read();
  state.tasks[9] = { issue: 9, status: 'S6-in-progress', releaseTag: 'v1.1.0', mergeSourceSha: B, reason: 'review-findings', queued: false };
  await f.queue.store.compareAndSwap(version, state);
  const result = await returnPublishedHistory(f.options);
  assert.equal(result.status, 'pending'); assert.match(result.reason, /executor correction/); assert.equal(f.finished, 0);
});

test('Git transport failure during early ancestry read never creates another task', async t => {
  const f = await fixture(t); f.options.git.verifyDevReturn = async () => { throw Object.assign(Error('remote unavailable'), { code: 128 }); };
  assert.equal((await returnPublishedHistory(f.options)).status, 'pending'); assert.equal(f.created, 0); assert.equal(f.finished, 0);
});

test('already-included history reconciles an orphan service issue by marker without a new queue entry', async t => {
  const f = await fixture(t); f.included = true;
  f.issues.set(9, { number: 9, state: 'open', labels: ['infra', 'S8-merged', 'track:show'],
    body: '<!-- process-next-release-return:v1.1.0 -->' });
  const result = await returnPublishedHistory(f.options);
  assert.equal(result.alreadyIncluded, true); assert.equal(f.issues.get(9).state, 'closed'); assert.equal(f.finished, 0);
});

test('S6 dependency preparation skips matching inputs and disables lifecycle hooks on install', async t => {
  const root = await mkdtemp(join(tmpdir(), 'hp-return-deps-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), '{"name":"fixture"}'); await writeFile(join(root, 'package-lock.json'), '{}');
  let installs = 0;
  const execute = async (_command, args, options) => { installs++; assert.deepEqual(args, ['ci', '--ignore-scripts']);
    assert.equal(options.cwd, root); await mkdir(join(root, 'node_modules'), { recursive: true }); };
  assert.equal((await prepareReturnEnvironment({ worktree: root, execute })).status, 'prepared');
  assert.equal((await prepareReturnEnvironment({ worktree: root, execute })).status, 'reused'); assert.equal(installs, 1);
  await writeFile(join(root, 'package-lock.json'), '{"updated":true}');
  await prepareReturnEnvironment({ worktree: root, execute }); assert.equal(installs, 2);
});
