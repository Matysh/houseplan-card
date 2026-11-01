import test from 'node:test';
import assert from 'node:assert/strict';
import { completePublishedRelease } from '../lib/release-completion.mjs';
import { initialReleaseState, reduceRelease } from '../lib/release.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40), D = 'd'.repeat(64);
function fixture(kind = 'beta', issues = [1]) {
  const candidate = { id: 'release', status: 'published', kind, sha: A, tag: 'v2.0.0-beta.1', branch: 'release/new',
    membership: { schema: 1, candidate: A, base: B, issues: issues.map(number => ({ number, commits: [A] })) },
    publication: { artifactDigest: D }, portToDev: [] };
  let state = { ...initialReleaseState(), candidates: { release: candidate } }, count = 0;
  return { get candidate() { return state.candidates.release; }, onUpdate: async event => {
    state = reduceRelease(state, { ...event, id: `event-${++count}` });
  } };
}
test('partial issue completion resumes after S8 removal without duplicate comment, tests or publication', async () => {
  const f = fixture(), issue = { number: 1, state: 'open', labels: ['S8-merged', 'track:show', 'bug'] }, comments = [];
  let closeAttempts = 0, hacs = 0, reads = [];
  const api = { owner: 'o', repo: 'r',
    getIssue: async number => { reads.push(number); assert.equal(number, 1); return structuredClone(issue); },
    listIssueComments: async () => comments,
    comment: async (number, body) => comments.push({ body }),
    removeLabel: async (number, label) => { issue.labels = issue.labels.filter(value => value !== label); },
    updateIssue: async () => { if (++closeAttempts === 1) throw Error('temporary API failure'); issue.state = 'closed'; },
  };
  const args = { api, onUpdate: f.onUpdate, verifyDelivery: async () => { hacs++; return { hacsAvailable: true, tag: f.candidate.tag, artifactDigest: D }; } };
  let result = await completePublishedRelease({ ...args, candidate: f.candidate });
  assert.equal(result.status, 'pending'); assert.equal(issue.state, 'open'); assert.deepEqual(issue.labels, ['track:show', 'bug']);
  assert.equal(comments.length, 1); assert.match(comments[0].body, /CHANGELOG.ru.md/); assert.doesNotMatch(comments[0].body, /Validate|CI точного/);
  result = await completePublishedRelease({ ...args, candidate: f.candidate });
  assert.equal(result.status, 'completed'); assert.equal(issue.state, 'closed'); assert.equal(hacs, 1); assert.equal(comments.length, 1);
  const previousReads = reads.length;
  await completePublishedRelease({ ...args, candidate: f.candidate });
  assert.equal(reads.length, previousReads); assert.equal(closeAttempts, 2);
});
test('missing HACS configuration is visible and makes no issue writes', async () => {
  const f = fixture();
  const result = await completePublishedRelease({ candidate: f.candidate, onUpdate: f.onUpdate, api: {} });
  assert.equal(result.status, 'pending'); assert.equal(result.pending[0].step, 'hacs');
  assert.equal(f.candidate.completion, undefined);
});
test('a delayed S8 label remains pending and closes on retry without re-closing a completed issue reopened by its owner', async () => {
  const f = fixture('beta', [1, 2, 3]); f.candidate.delivery = { hacsAvailable: true };
  const issues = new Map([1, 2, 3].map(number => [number, { number, state: 'open', labels: [number === 1 ? 'S8-merged' : 'S7-review'] }]));
  const closed = [], comments = [];
  const api = { owner: 'o', repo: 'r', getIssue: async number => structuredClone(issues.get(number)), listIssueComments: async () => [],
    comment: async number => comments.push(number),
    removeLabel: async (number, label) => { const issue = issues.get(number); issue.labels = issue.labels.filter(value => value !== label); },
    updateIssue: async number => { issues.get(number).state = 'closed'; closed.push(number); } };
  const args = { api, onUpdate: f.onUpdate };
  const first = await completePublishedRelease({ ...args, candidate: f.candidate });
  assert.equal(first.status, 'pending'); assert.match(first.pending[0].reason, /Waiting for S8 bookkeeping: #2, #3/);
  assert.deepEqual(f.candidate.completion.issues.waitingForS8, [2, 3]); assert.deepEqual(closed, [1]);
  issues.get(1).state = 'open'; // An intentional owner reopen is no longer release completion work.
  issues.get(2).labels = ['S8-merged']; issues.get(3).state = 'closed';
  const second = await completePublishedRelease({ ...args, candidate: f.candidate });
  assert.equal(second.status, 'completed'); assert.equal(issues.get(1).state, 'open');
  assert.deepEqual(closed, [1, 2]); assert.deepEqual(comments, [1, 2]);
});
test('only an unchanged obsolete beta ref is removed; later retry does not repeat finished bookkeeping', async () => {
  const f = fixture('beta', []); f.candidate.delivery = { hacsAvailable: true };
  f.candidate.retiredBeta = { branch: 'release/old', sha: B }; let current = A, deleted = 0;
  const git = { remoteHead: async branch => { assert.equal(branch, 'release/old'); return current; },
    deleteBranchIfUnchanged: async (branch, sha) => { assert.equal(sha, B); deleted++; current = null; return true; } };
  const args = { git, api: {}, onUpdate: f.onUpdate };
  assert.equal((await completePublishedRelease({ ...args, candidate: f.candidate })).status, 'pending'); assert.equal(deleted, 0);
  current = B;
  assert.equal((await completePublishedRelease({ ...args, candidate: f.candidate })).status, 'completed'); assert.equal(deleted, 1);
});
test('stable return and announcement have independent resumable outcomes and never republish', async () => {
  const f = fixture('stable', []); f.candidate.tag = 'v2.0.0'; f.candidate.delivery = { hacsAvailable: true };
  let returns = 0, announcements = 0;
  const args = { api: {}, onUpdate: f.onUpdate, returnToDev: async () => { returns++; return { status: 'completed', devSha: B }; },
    announce: async ({ persist }) => { announcements++; const receipt = { status: announcements === 1 ? 'failed' : 'sent', tag: 'v2.0.0' }; await persist(receipt); return receipt; } };
  assert.equal((await completePublishedRelease({ ...args, candidate: f.candidate })).status, 'pending');
  assert.equal((await completePublishedRelease({ ...args, candidate: f.candidate })).status, 'completed');
  assert.equal(returns, 1); assert.equal(announcements, 2); assert.equal(f.candidate.announcement.status, 'sent');
});

test('stable announcement is persisted before a queued return to dev can finish', async () => {
  const f = fixture('stable', []); f.candidate.tag = 'v2.0.0';
  const order = [];
  let releaseReturn, enteredReturn;
  const waiting = new Promise(resolve => { releaseReturn = resolve; });
  const entered = new Promise(resolve => { enteredReturn = resolve; });
  const completion = completePublishedRelease({ candidate: f.candidate, api: {},
    verifyDelivery: async () => { order.push('hacs'); return { hacsAvailable: true, tag: f.candidate.tag, artifactDigest: D }; },
    onUpdate: async event => {
      await f.onUpdate(event);
      if (event.type === 'completion-step' && event.name === 'issues' && event.result.status === 'completed') order.push('issues');
    },
    announce: async ({ persist }) => {
      order.push('announcement'); const receipt = { status: 'sent', tag: 'v2.0.0' }; await persist(receipt); return receipt;
    },
    returnToDev: async () => { order.push('return-wait'); enteredReturn(); return waiting; },
  });
  await entered;
  assert.deepEqual(order, ['hacs', 'issues', 'announcement', 'return-wait']);
  assert.equal(f.candidate.announcement.status, 'sent');
  releaseReturn({ status: 'completed', devSha: B });
  assert.equal((await completion).status, 'completed');
});
