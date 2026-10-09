import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueFromCommits, readCatalogue, readMergeEntry, reconcileEntry, validateEntry, verifyMilestone } from '../scripts/release-ledger.mjs';

const cycle = { schema: 1, baseStable: 'v1.80.1', targetStable: 'v1.81.0', milestone: { number: 3, title: '1.81' } };
const entry = (issue, category) => ({ schema: 1, issue, baseStable: cycle.baseStable, category,
  rationale: 'Evidence relative to previous stable, reviewed by the agent.',
  summary: { ru: 'Изменение', en: 'Change' }, ...(category === 'line-fix' ? { introducedBy: 1 } : {}) });
const entries = new Map([[1, entry(1, 'major')], [2, entry(2, 'infra')], [3, entry(3, 'stable-fix')], [4, entry(4, 'line-fix')]]);
const commits = [1,2,3,4].map((issue) => ({ sha: String(issue).repeat(40), message: `task\n\nIssue: #${issue}\nUser-Visible: yes` }));

test('catalogue is candidate evidence, not User-Visible, beta text or open milestone membership', () => {
  const releaseCommit = { sha: 'a'.repeat(40), message: 'Release: v1.81.0\nIssue: #999' };
  const result = catalogueFromCommits({ cycle, entries, commits: [...commits, releaseCommit] });
  assert.deepEqual(result.userIssues, [1, 3]); // Old-behaviour performance fixes qualify too.
  assert.deepEqual(result.entries.map((row) => row.issue), [1,2,3,4]);
  assert.deepEqual(result.entries[0].commits, ['1'.repeat(40)]);
  assert.throws(() => catalogueFromCommits({ cycle, entries, commits: [...commits, { sha: 'b'.repeat(40), message: 'Issue: #999' }] }), /Invalid release classification/);
});

test('missing, stale and unjustified classifications cannot be guessed', () => {
  assert.throws(() => validateEntry({ ...entry(1, 'major'), baseStable: 'v1.79.0' }, { baseStable: cycle.baseStable }), /Stale/);
  assert.throws(() => validateEntry({ ...entry(1, 'major'), rationale: '' }), /rationale/);
  assert.throws(() => validateEntry({ ...entry(1, 'major'), summary: { ru: 'Есть' } }), /RU\/EN/);
  assert.throws(() => validateEntry({ ...entry(4, 'line-fix'), introducedBy: null }), /introducedBy/);
});

function gitStub({ absent = false, tags = 'v1.80.1' } = {}) {
  return (args) => {
    if (args[0] === 'tag') return tags;
    if (args[0] === 'rev-parse') return 'c'.repeat(40);
    if (args[0] === 'log') {
      assert.equal(args.at(-1), `v1.80.1..${'c'.repeat(40)}`);
      return commits.map(({ sha, message }) => `${sha}\x1f${message}\x1e`).join('');
    }
    assert.equal(args[0], 'show');
    if (args[1].endsWith('cycle.json')) return JSON.stringify(cycle);
    if (absent) throw new Error('no blob');
    const issue = Number(args[1].match(/\/(\d+)\.json$/)[1]);
    return JSON.stringify(entries.get(issue));
  };
}

test('facts and merge guard read reviewed candidate blobs, not local unreviewed files', () => {
  assert.deepEqual(readCatalogue({ candidate: 'accepted', tag: cycle.targetStable, gitRunner: gitStub() }).userIssues, [1,3]);
  assert.equal(readMergeEntry('accepted', 1, gitStub()).entry.issue, 1);
  assert.throws(() => readCatalogue({ gitRunner: gitStub({ absent: true }) }), /Missing classification for #1/);
  assert.throws(() => readCatalogue({ tag: 'v1.82.0', gitRunner: gitStub() }), /Cycle target/);
  assert.throws(() => readCatalogue({ gitRunner: gitStub({ tags: 'v1.80.2' }) }), /latest reachable/);
  assert.throws(() => readMergeEntry('accepted', 1, gitStub({ tags: 'v1.80.1\nv1.81.0' })), /has shipped/);
});

test('milestone writes are idempotent, excluded categories remove only the release milestone', () => {
  let current = null;
  const calls = [];
  const api = (method, path, body) => {
    calls.push([method, path, body]);
    if (path.includes('/milestones/')) return { title: '1.81', state: 'open' };
    if (method === 'PATCH') { current = body.milestone === null ? null : { number: body.milestone }; return {}; }
    return { milestone: current };
  };
  assert.equal(reconcileEntry({ cycle, entry: entries.get(1), repo: 'x/y', api }).milestone, 3);
  assert.equal(reconcileEntry({ cycle, entry: entries.get(1), repo: 'x/y', api }).changed, false);
  assert.equal(calls.filter(([method]) => method === 'PATCH').length, 1);
  reconcileEntry({ cycle, entry: entries.get(4), repo: 'x/y', api });
  assert.equal(current, null);
  current = { number: 55 };
  assert.throws(() => reconcileEntry({ cycle, entry: entries.get(3), repo: 'x/y', api }), /another milestone/);
  assert.equal(current.number, 55);
});

test('public collection includes closed issues and rejects extra unmerged/infra issues', () => {
  const catalogue = catalogueFromCommits({ cycle, entries, commits });
  const api = (method, path) => path.includes('/milestones/') ? { title: '1.81' } : [{ number: 1, state: 'closed' }, { number: 3, state: 'closed' }];
  assert.doesNotThrow(() => verifyMilestone({ catalogue, repo: 'x/y', api }));
  const extra = (method, path) => path.includes('/milestones/') ? { title: '1.81' } : [...api(method, path), { number: 2 }];
  assert.throws(() => verifyMilestone({ catalogue, repo: 'x/y', api: extra }), /exactly candidate/);
});
