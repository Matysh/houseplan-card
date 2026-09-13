// #514: a stable release waits for a green E2E run on a real Home Assistant.
import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRun, e2eGate, isOurRun, previousStable, realOps, TOKEN_HINT } from '../scripts/e2e-gate.mjs';

const TAG = 'v1.74.0';
const ours = (suffix = '') => [{ name: `journeys · HP ${TAG} · HA stable${suffix}`, conclusion: 'success' }, { name: 'upgrade · HP stable · HA stable', conclusion: 'success' }];
const theirs = () => [{ name: 'journeys · HP v1.73.0 · HA stable', conclusion: 'success' }];

/** Fake gh: scripted run-list snapshots per poll, jobs per run id, a virtual clock. */
function fakeOps({ snapshots, jobsById = {}, dispatchError = null, startedAt = 100_000 }) {
  let clock = startedAt;
  let calls = 0;
  const dispatched = [];
  return {
    ops: {
      releases: async () => [{ tagName: TAG, isDraft: false, isPrerelease: false }, { tagName: 'v1.74.0-beta.2', isPrerelease: true }, { tagName: 'v1.73.0', isDraft: false, isPrerelease: false }],
      dispatch: async (tag, upgradeFrom) => { if (dispatchError) throw new Error(dispatchError); dispatched.push([tag, upgradeFrom]); },
      listRuns: async () => { const s = snapshots[Math.min(calls, snapshots.length - 1)]; calls += 1; return s; },
      jobs: async (id) => jobsById[id] ?? [],
      sleep: async (ms) => { clock += ms; },
      now: () => clock,
    },
    dispatched,
    calls: () => calls,
  };
}

const run = (over) => ({ databaseId: 1, status: 'completed', conclusion: 'success', url: 'https://e2e/run/1', createdAt: new Date(100_500).toISOString(), ...over });

test('#514 AC2: a run is ours only when a job carries our tag', () => {
  assert.equal(isOurRun(ours(), TAG), true);
  assert.equal(isOurRun(theirs(), TAG), false);
  assert.equal(isOurRun([{ name: `journeys · HP ${TAG}-beta.1 · HA stable` }], TAG), false, 'a prerelease of the same version is not the tag');
  assert.equal(isOurRun([], TAG), false);
  // live 09.09: the upgrade job carries the PREVIOUS stable's tag — a gate for v1.72.0 must not adopt the v1.73.0 run
  assert.equal(isOurRun([{ name: 'journeys · HP v1.73.0 · HA stable' }, { name: 'upgrade · HP v1.72.0 · HA stable' }], 'v1.72.0'), false);
  assert.equal(isOurRun([{ name: 'first-run · HP v1.73.0 · HA stable' }], 'v1.73.0'), true);
});

test('#514 AC2: a run that has only planned its matrix is undecided, not foreign', async () => {
  assert.equal(classifyRun([{ name: 'Матрица прогона', conclusion: 'success' }], TAG), 'unknown');
  assert.equal(classifyRun([{ name: 'Матрица прогона' }, ...ours()], TAG), 'ours');
  assert.equal(classifyRun(theirs(), TAG), 'foreign');
  // live 09.09: the first poll saw only the plan job — the run must still be recognised on the next poll
  const planning = run({ databaseId: 5, status: 'in_progress', conclusion: null, url: 'https://e2e/run/5' });
  let polls = 0;
  const fake = fakeOps({ snapshots: [[planning], [planning], [run({ databaseId: 5, url: 'https://e2e/run/5' })]] });
  fake.ops.jobs = async () => (polls++ === 0 ? [{ name: 'Матрица прогона', conclusion: 'success' }] : [{ name: 'Матрица прогона' }, ...ours()]);
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://e2e/run/5');
});

test('#514 AC1: dispatch, then the green run on the tag is accepted', async () => {
  const fake = fakeOps({ snapshots: [[run({ status: 'in_progress', conclusion: null })], [run()]], jobsById: { 1: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://e2e/run/1');
  assert.deepEqual(fake.dispatched, [[TAG, 'v1.73.0']], 'exactly one dispatch with the release tag, upgrading from the previous stable');
});

test('#514 AC1: a red run withholds the assets and names the run', async () => {
  const fake = fakeOps({ snapshots: [[run({ conclusion: 'failure', url: 'https://e2e/run/red' })]], jobsById: { 1: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'red');
  assert.equal(outcome.url, 'https://e2e/run/red');
  assert.match(outcome.note, /failure/);
});

test('#514 AC2: a foreign dispatch on another tag is ignored, ours is tracked even when it appears later', async () => {
  const foreign = run({ databaseId: 7, url: 'https://e2e/run/7' });
  const mine = run({ databaseId: 9, url: 'https://e2e/run/9' });
  const fake = fakeOps({ snapshots: [[foreign], [foreign], [mine, foreign]], jobsById: { 7: theirs(), 9: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://e2e/run/9');
});

test('#514 AC2: a stale run from before the dispatch is not ours even with the same tag', async () => {
  const stale = run({ databaseId: 3, url: 'https://e2e/run/stale', createdAt: new Date(100_000 - 120_000).toISOString() });
  const fake = fakeOps({ snapshots: [[stale]], jobsById: { 3: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, appearMs: 5000, pollMs: 1000 });
  assert.equal(outcome.result, 'missing');
});

test('#514 AC1: no run appears within the appear window → missing', async () => {
  const fake = fakeOps({ snapshots: [[]] });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, appearMs: 5000, pollMs: 1000 });
  assert.equal(outcome.result, 'missing');
  assert.match(outcome.note, /не появился/);
});

test('#514 AC1: a run that never finishes is red after the total window', async () => {
  const fake = fakeOps({ snapshots: [[run({ status: 'in_progress', conclusion: null })]], jobsById: { 1: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, totalMs: 10_000, pollMs: 4000 });
  assert.equal(outcome.result, 'red');
  assert.match(outcome.note, /не завершился/);
});

test('#514 AC1: a cancelled run is red with an explicit note — nobody cancels e2e.yml but a hand', async () => {
  const fake = fakeOps({ snapshots: [[run({ conclusion: 'cancelled' })]], jobsById: { 1: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'red');
  assert.match(outcome.note, /отменён вручную/);
});

test('#514 AC1: a dispatch refused by the token is an error that names the missing secret', async () => {
  const fake = fakeOps({ snapshots: [[]], dispatchError: 'gh workflow run: HTTP 403: Resource not accessible by personal access token' });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'error');
  assert.ok(outcome.note.includes(TOKEN_HINT), outcome.note);
  assert.equal(fake.calls(), 0, 'no polling after a failed dispatch');
});

test('#514 r3 M1: a token that cannot read houseplan-card releases fails loudly with the token hint, never dispatches with upgrade_from=stable', async () => {
  const fake = fakeOps({ snapshots: [[]] });
  fake.ops.releases = async () => { throw new Error('gh release list Matysh/houseplan-card: HTTP 404: Not Found'); };
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'error');
  assert.deepEqual(fake.dispatched, [], 'no dispatch on a broken release list');
  assert.ok(outcome.note.includes('gh release list'), outcome.note);
  // realOps: a failing gh is an exception, not an empty list
  const exec = () => ({ status: 1, stdout: '', stderr: 'HTTP 403: Resource not accessible by personal access token' });
  await assert.rejects(() => realOps({ exec }).releases(), /403/);
});

test('#514: the upgrade suite starts from the previous stable, never from the tag under test', () => {
  const releases = [
    { tagName: 'v1.74.0', isDraft: false, isPrerelease: false },
    { tagName: 'v1.74.0-beta.3', isDraft: false, isPrerelease: true },
    { tagName: 'v1.73.0', isDraft: false, isPrerelease: false },
    { tagName: 'v1.72.0', isDraft: false, isPrerelease: false },
  ];
  assert.equal(previousStable(releases, 'v1.74.0'), 'v1.73.0', 'the tag itself is already the newest stable at release time');
  assert.equal(previousStable(releases, 'v1.73.0'), 'v1.74.0', 'a re-gated older tag still upgrades from another stable');
  assert.equal(previousStable([{ tagName: 'v1.0.0', isPrerelease: false }], 'v1.0.0'), 'stable', 'the first stable ever falls back to stable');
  assert.equal(previousStable([{ tagName: 'v1.74.0', isDraft: true, isPrerelease: false }, { tagName: 'v1.73.0', isPrerelease: false }], 'v1.75.0'), 'v1.73.0', 'drafts are not releases');
});

test('#514: realOps dispatches e2e.yml on main with the tag and the previous stable', async () => {
  const calls = [];
  const exec = (cmd, args) => { calls.push([cmd, ...args]); return { status: 0, stdout: '[]', stderr: '' }; };
  const ops = realOps({ exec });
  await ops.dispatch(TAG, 'v1.73.0');
  assert.deepEqual(calls[0], ['gh', 'workflow', 'run', 'e2e.yml', '--repo', 'Matysh/houseplan-e2e', '--ref', 'main',
    '-f', `houseplan_ref=${TAG}`, '-f', 'upgrade_from=v1.73.0', '-f', 'ha_version=stable']);
  await ops.listRuns();
  assert.ok(calls[1].includes('--event') && calls[1].includes('workflow_dispatch'));
  await ops.releases();
  assert.deepEqual(calls[2].slice(0, 5), ['gh', 'release', 'list', '--repo', 'Matysh/houseplan-card']);
});

// #540: под тестом — коммит-кандидат, не публичный релиз. Гейт диспатчит e2e.yml
// на SHA (install-houseplan.mjs ставит дерево из tarball codeload), опознаёт
// прогон по этому SHA в именах job, а `upgrade_from` по-прежнему выбирает по
// тегу — выпускаемый тег из кандидатов исключается.
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

test('#540 AC1: with --ref the dispatch and the recognition use the candidate SHA, upgrade_from still excludes the tag', async () => {
  const oursBySha = [{ name: `journeys · HP ${SHA} · HA stable`, conclusion: 'success' }, { name: 'upgrade · HP v1.73.0 · HA stable', conclusion: 'success' }];
  const fake = fakeOps({ snapshots: [[run({ status: 'in_progress', conclusion: null })], [run()]], jobsById: { 1: oursBySha } });
  const outcome = await e2eGate({ tag: TAG, ref: SHA, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.match(outcome.note, new RegExp(SHA));
  assert.deepEqual(fake.dispatched, [[SHA, 'v1.73.0']], 'houseplan_ref is the SHA; upgrade_from is the previous stable, not the tag under release');
});

test('#540 AC1: a run whose jobs carry the tag, not the SHA, is foreign to a SHA-dispatched gate', async () => {
  const byTag = run({ databaseId: 3, url: 'https://e2e/run/3' });
  const fake = fakeOps({ snapshots: [[byTag], [byTag], [byTag]], jobsById: { 3: ours() }, startedAt: 100_000 });
  const outcome = await e2eGate({ tag: TAG, ref: SHA, ops: fake.ops, pollMs: 1000, appearMs: 2500 });
  assert.equal(outcome.result, 'missing', 'a tag-named run is not the SHA run — the old ZIP-from-release path is gone');
  assert.equal(isOurRun(ours(), SHA), false);
  assert.equal(classifyRun([{ name: `first-run · HP ${SHA} · HA stable` }], SHA), 'ours');
});

test('#540: without --ref the gate behaves exactly as before — the tag is the ref', async () => {
  const fake = fakeOps({ snapshots: [[run()]], jobsById: { 1: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.deepEqual(fake.dispatched, [[TAG, 'v1.73.0']]);
});
