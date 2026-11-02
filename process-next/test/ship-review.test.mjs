import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildCandidateMembership } from '../lib/release-data.mjs';
import { buildShipReviewPacket } from '../lib/ship-review.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-ship-review-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (path, message) => {
    mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), `${message}\n${run(['rev-parse', '--verify', 'HEAD'])}\n`);
    run(['add', '.']); run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message]);
    return run(['rev-parse', 'HEAD']);
  };
  run(['init', '-q']); run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'stable']);
  const base = run(['rev-parse', 'HEAD']), git = { git: async args => run(args) }, fetched = [], labels = new Map();
  const api = { getIssue: async issue => { fetched.push(issue); return { number: issue, title: `Task ${issue}`,
    html_url: `https://example.invalid/issues/${issue}`, body: `Requirements ${issue}`, labels: labels.get(issue) ?? [{ name: 'track:ship' }] }; } };
  const candidate = async (id = 'beta-1', tasks = [], previousMembership) => {
    const head = run(['rev-parse', 'HEAD']);
    return { id, tag: `v2.0.0-${id}`, sha: head,
      membership: await buildCandidateMembership({ git, baseSha: base, candidateSha: head, tasks, previousMembership }) };
  };
  return { run, commit, base, git, api, labels, fetched, candidate };
}
const merged = (issue, mergedSha, track = 'ship') => ({ issue, mergedSha, track, status: 'S8-merged' });
const accepted = packet => ({ requestId: packet.requestId, packet,
  result: { verdict: 'accepted', reportUrl: `https://example.invalid/reviews/${packet.requestId}` } });

test('selects product, docs and infrastructure ship from immutable membership, not the live issue list', async t => {
  const f = fixture(t), one = f.commit('src/one.ts', 'product\n\nIssue: #1');
  f.commit('docs/manual.md', 'docs\n\nIssue: #2'); f.commit('process-next/tool.mjs', 'infra\n\nIssue: #3');
  const four = f.commit('src/four.ts', 'show\n\nIssue: #4');
  f.commit('version.txt', 'release return\n\nIssue: #5\nRelease: v2.0.0-beta.1');
  const tasks = [merged(1, one), merged(4, four, 'show')], candidate = await f.candidate('beta-1', tasks);
  const later = f.commit('later.txt', 'future\n\nIssue: #6'); tasks.push(merged(6, later));
  f.labels.set(1, [{ name: 'track:ask' }]); // The recorded merge wins over today's label.
  const packet = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, tasks });
  assert.deepEqual(packet.tasks.map(task => task.issue), [1, 2, 3]); assert.deepEqual(packet.pending, [1, 2, 3]);
  assert.deepEqual(packet.reused, []); assert.equal(packet.head, candidate.sha); assert.equal(packet.base, f.base);
  assert.equal(packet.tasks[0].body, 'Requirements 1'); assert.equal(packet.tasks[0].title, 'Task 1');
  assert.equal(packet.tasks[0].url, 'https://example.invalid/issues/1');
  assert.deepEqual(f.fetched, [1, 2, 3]); assert.equal('diff' in packet, false);
});

test('rejects membership for another candidate, duplicate issue rows and commits outside the stable-to-candidate range', async t => {
  const f = fixture(t), one = f.commit('one.txt', 'one\n\nIssue: #1'), candidate = await f.candidate();
  const later = f.commit('later.txt', 'later\n\nIssue: #2');
  const check = membership => buildShipReviewPacket({ candidate: { ...candidate, membership }, git: f.git, api: f.api });
  await assert.rejects(check({ ...candidate.membership, candidate: later }), /immutable candidate/);
  await assert.rejects(check({ ...candidate.membership, issues: [{ number: 1, commits: [one] }, { number: 1, commits: [one] }] }), /unambiguous/);
  for (const commit of [f.base, later])
    await assert.rejects(check({ ...candidate.membership, issues: [{ number: 1, commits: [commit] }] }), /outside the candidate range/);
  f.run(['checkout', '-q', '--detach', f.base]); const unrelated = f.commit('side.txt', 'unrelated');
  await assert.rejects(check({ ...candidate.membership, base: unrelated }), /merge-base/);
  await assert.rejects(check({ ...candidate.membership, base: 'dev' }), /exact candidate/);
});

test('legacy missing tracks are diagnostic; any ship evidence among conflicting tracks is reviewed without changing labels', async t => {
  const f = fixture(t), commit = f.commit('one.txt', 'one\n\nIssue: #1'), candidate = await f.candidate();
  f.labels.set(1, []);
  const legacy = await buildShipReviewPacket({ candidate, git: f.git, api: f.api });
  assert.deepEqual(legacy.tasks, []); assert.deepEqual(legacy.unclassified, [1]);
  const labels = ['track:ship', { name: 'track:show' }]; f.labels.set(1, labels);
  const ambiguous = await buildShipReviewPacket({ candidate, git: f.git, api: f.api });
  assert.deepEqual(ambiguous.pending, [1]); assert.deepEqual(ambiguous.unclassified, []);
  assert.deepEqual(f.labels.get(1), labels);
  const contradictory = await buildShipReviewPacket({ candidate, git: f.git, api: f.api,
    tasks: [merged(1, commit, 'ship'), merged(1, commit, 'ask')] });
  assert.deepEqual(contradictory.pending, [1]);
  for (const track of [null, 'legacy-track']) {
    const fallback = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, tasks: [merged(1, commit, track)] });
    assert.deepEqual(fallback.pending, [1]); assert.deepEqual(fallback.unclassified, []);
  }
  f.labels.set(1, ['track:ask', 'track:show']);
  const nonShip = await buildShipReviewPacket({ candidate, git: f.git, api: f.api });
  assert.deepEqual(nonShip.tasks, []); assert.deepEqual(nonShip.unclassified, []);
});

test('a later beta reuses exact accepted task commits, including after queue pruning and metadata-only changes', async t => {
  const f = fixture(t), one = f.commit('one.txt', 'one\n\nIssue: #1'), candidate = await f.candidate();
  const first = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, tasks: [merged(1, one)] });
  f.commit('version.txt', 'next beta version'); const next = await f.candidate('beta-2');
  f.labels.set(1, []); // No current queue or label is needed once its merge track was frozen.
  const second = await buildShipReviewPacket({ candidate: next, git: f.git, api: f.api, reviews: [accepted(first)] });
  assert.deepEqual(second.pending, []); assert.equal(second.reused[0].requestId, first.requestId);
  assert.equal(second.reused[0].reportUrl, accepted(first).result.reportUrl);
  assert.equal(second.tasks[0].fingerprint, first.tasks[0].fingerprint); assert.equal(second.selectionDigest, first.selectionDigest);
  assert.notEqual(second.requestId, first.requestId);
  const repeat = await buildShipReviewPacket({ candidate: next, git: f.git, api: f.api,
    tasks: [merged(1, one, null)], reviews: [accepted(first)] });
  assert.equal(repeat.requestId, second.requestId);
  assert.deepEqual(repeat.unclassified, []);
});

test('new or changed ship commits stay pending while unaffected accepted tasks are retained', async t => {
  const f = fixture(t); f.commit('one.txt', 'one\n\nIssue: #1'); f.commit('two.txt', 'two\n\nIssue: #2');
  const first = await buildShipReviewPacket({ candidate: await f.candidate(), git: f.git, api: f.api });
  const fix = f.commit('one.txt', 'fix one\n\nIssue: #1'); f.commit('three.txt', 'three\n\nIssue: #3');
  f.labels.set(1, []); f.labels.set(2, []);
  const next = await buildShipReviewPacket({ candidate: await f.candidate('beta-2'), git: f.git, api: f.api, reviews: [accepted(first)] });
  assert.deepEqual(next.pending, [1, 3]); assert.deepEqual(next.reused.map(task => task.issue), [2]);
  assert.notEqual(next.tasks[0].fingerprint, first.tasks[0].fingerprint); assert.ok(next.tasks[0].commits.includes(fix));
  assert.notEqual(next.selectionDigest, first.selectionDigest);
});

test('only an accepted review of that exact pending task can be reused', async t => {
  const f = fixture(t); f.commit('one.txt', 'one\n\nIssue: #1'); const candidate = await f.candidate();
  const packet = await buildShipReviewPacket({ candidate, git: f.git, api: f.api });
  for (const review of [
    { ...accepted(packet), result: { verdict: 'changes-requested' } },
    accepted({ ...packet, pending: [] }),
    accepted({ ...packet, tasks: [{ ...packet.tasks[0], fingerprint: 'not-the-same' }] }),
    accepted({ ...packet, tasks: [{ ...packet.tasks[0], commits: [f.base] }] }),
  ]) {
    const next = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, reviews: [review] });
    assert.deepEqual(next.pending, [1]); assert.deepEqual(next.reused, []);
  }
});

test('an unrelated old issue packet cannot supply a historical track for different implementation commits', async t => {
  const f = fixture(t); f.commit('one.txt', 'one\n\nIssue: #1');
  const old = await buildShipReviewPacket({ candidate: await f.candidate(), git: f.git, api: f.api });
  f.run(['checkout', '-q', '--detach', f.base]); f.commit('other.txt', 'different implementation\n\nIssue: #1');
  f.labels.set(1, []);
  const packet = await buildShipReviewPacket({ candidate: await f.candidate('beta-2'), git: f.git, api: f.api, reviews: [accepted(old)] });
  assert.deepEqual(packet.tasks, []); assert.deepEqual(packet.unclassified, [1]);
});

test('an exact queue base includes every fast-forward commit and excludes earlier unrelated unlabelled work', async t => {
  const f = fixture(t), before = f.commit('earlier.txt', 'unrelated work before the admission');
  const first = f.commit('one.txt', 'implementation without a trailer');
  const tip = f.commit('two.txt', 'correction without a trailer');
  const tasks = [{ ...merged(1, tip), expectedBase: before }];
  const candidate = await f.candidate('beta-1', tasks);
  assert.deepEqual(candidate.membership.issues[0].commits, [tip]);
  const packet = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, tasks });
  assert.deepEqual(packet.tasks[0].commits, [first, tip].sort());
  assert.ok(!packet.tasks[0].commits.includes(before));
  await assert.rejects(buildShipReviewPacket({ candidate, git: f.git, api: f.api,
    tasks: [{ ...tasks[0], expectedBase: 'dev' }] }), /exact implementation base/);
});

test('legacy queue tips recover preceding unattributed implementation without absorbing another task', async t => {
  const f = fixture(t), other = f.commit('show.txt', 'another reviewed task (#2)');
  const first = f.commit('one.txt', 'implementation without any issue marker');
  const tip = f.commit('two.txt', 'last correction without any issue marker');
  const tasks = [merged(1, tip), merged(2, other, 'show')], candidate = await f.candidate('beta-1', tasks);
  f.labels.set(2, ['track:show']);
  const packet = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, tasks });
  assert.deepEqual(packet.tasks.map(task => task.issue), [1]);
  assert.deepEqual(packet.tasks[0].commits, [first, tip].sort());
  const partial = { ...packet, tasks: [{ ...packet.tasks[0], commits: [tip],
    fingerprint: createHash('sha256').update(JSON.stringify([tip])).digest('hex') }] };
  const retry = await buildShipReviewPacket({ candidate, git: f.git, api: f.api, tasks, reviews: [accepted(partial)] });
  assert.deepEqual(retry.pending, [1]);
});

test('legacy subject-only multi-commit tasks remain visible after queue pruning', async t => {
  const f = fixture(t); f.commit('show.txt', 'previous task (#2)');
  const first = f.commit('one.txt', 'fix: first implementation (#1157)');
  const tip = f.commit('two.txt', 'test: complete implementation checks (#1157)');
  const candidate = await f.candidate(); assert.deepEqual(candidate.membership.issues, []);
  f.labels.set(2, ['track:show']);
  const packet = await buildShipReviewPacket({ candidate, git: f.git, api: f.api });
  assert.deepEqual(packet.tasks.map(task => task.issue), [1157]);
  assert.deepEqual(packet.tasks[0].commits, [first, tip].sort());
});
