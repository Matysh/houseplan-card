import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { catalogueFromCommits, ghApi, assertMilestoneNaming, milestoneLink, milestoneTitle, readCatalogue, readMergeEntry, reconcileEntry, validateCycle, validateEntry, verifyMilestone } from '../scripts/release-ledger.mjs';

const cycle = { schema: 1, baseStable: 'v1.80.1', targetStable: 'v1.81.0', milestone: { number: 3, title: '1.81.0' } };
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
    if (args[0] === 'diff-tree') return 'scripts/example.mjs';
    if (args[0] === 'ls-tree') return '';
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
    if (path.includes('/milestones/')) return { title: '1.81.0', state: 'open' };
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
  const api = (method, path) => path.includes('/milestones/') ? { title: '1.81.0' } : [{ number: 1, state: 'closed' }, { number: 3, state: 'closed' }];
  assert.doesNotThrow(() => verifyMilestone({ catalogue, repo: 'x/y', api }));
  const extra = (method, path) => path.includes('/milestones/') ? { title: '1.81.0' } : [...api(method, path), { number: 2 }];
  assert.throws(() => verifyMilestone({ catalogue, repo: 'x/y', api: extra }), /exactly candidate/);
});

test('milestone naming is permanently X.Y.Z of the target stable and the collection link is by number', () => {
  // Owner decision 2026-10-31: titles never carry `v` or drop the patch part; links survive renames.
  assert.equal(milestoneTitle('v1.84.0'), '1.84.0');
  assert.equal(assertMilestoneNaming(cycle), cycle);
  for (const title of ['1.81', 'v1.81.0', '1.81.0 ', '1.81.1'])
    assert.throws(() => assertMilestoneNaming({ ...cycle, milestone: { number: 3, title } }), /must be titled 1\.81\.0/);
  assert.throws(() => assertMilestoneNaming({ ...cycle, milestone: { title: '1.81.0' } }), /Invalid release cycle/);
  // Published history (v1.81.0…v1.83.0 tags carry `1.81`…`1.83`) stays readable; its links work by number.
  const published = { ...cycle, milestone: { number: 3, title: '1.81' } };
  assert.equal(validateCycle(published), published);
  assert.equal(milestoneLink('x/y', published), 'https://github.com/x/y/milestone/3?closed=1');
  assert.equal(milestoneLink('x/y', cycle), 'https://github.com/x/y/milestone/3?closed=1');
  assert.equal(milestoneLink('x/y', { ...cycle, milestone: { number: 11, title: '1.81.0' } }), 'https://github.com/x/y/milestone/11?closed=1');
  const renamed = (method, path) => path.includes('/milestones/') ? { title: '1.81', state: 'open' } : [];
  assert.throws(() => verifyMilestone({ catalogue: catalogueFromCommits({ cycle, entries, commits }), repo: 'x/y', api: renamed }), /permanent naming/);
  assert.throws(() => reconcileEntry({ cycle, entry: entries.get(1), repo: 'x/y', api: renamed }), /renamed or closed/);
  const stale = { ...cycle, milestone: { number: 3, title: '1.81' } };
  assert.throws(() => verifyMilestone({ catalogue: catalogueFromCommits({ cycle: stale, entries, commits }), repo: 'x/y', api: renamed }), /must be titled/);
});

test('#916 GitHub transport reads a full >1 MiB child response and fails closed on malformed/failed/oversized output', () => {
  const execute = script => (command, args, options) => {
    assert.equal(command, 'gh');
    assert.deepEqual(args, ['api', '--method', 'GET', 'repos/x/y/issues']);
    return execFileSync(process.execPath, ['-e', script], options);
  };
  const payload = "process.stdout.write(JSON.stringify({body:'x'.repeat(1500000),tail:'complete'}))";
  const value = ghApi('GET', 'repos/x/y/issues', undefined, execute(payload));
  assert.equal(value.body.length, 1500000);
  assert.equal(value.tail, 'complete');
  assert.throws(() => ghApi('GET', 'repos/x/y/issues', undefined, execute("process.stdout.write('{broken')")), SyntaxError);
  assert.throws(() => ghApi('GET', 'repos/x/y/issues', undefined, execute("process.exit(7)")), error => error.status === 7);
  assert.throws(() => ghApi('GET', 'repos/x/y/issues', undefined,
    execute("process.stdout.write(JSON.stringify({body:'x'.repeat(9*1024*1024)}))")), error => error.code === 'ENOBUFS');
});
