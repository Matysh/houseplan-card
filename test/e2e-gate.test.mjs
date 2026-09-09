// #514: a stable release waits for a green E2E run on a real Home Assistant.
import assert from 'node:assert/strict';
import test from 'node:test';

import { e2eGate, isOurRun, realOps, TOKEN_HINT } from '../scripts/e2e-gate.mjs';

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
      dispatch: async (tag) => { if (dispatchError) throw new Error(dispatchError); dispatched.push(tag); },
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
});

test('#514 AC1: dispatch, then the green run on the tag is accepted', async () => {
  const fake = fakeOps({ snapshots: [[run({ status: 'in_progress', conclusion: null })], [run()]], jobsById: { 1: ours() } });
  const outcome = await e2eGate({ tag: TAG, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://e2e/run/1');
  assert.deepEqual(fake.dispatched, [TAG], 'exactly one dispatch with the release tag');
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

test('#514: realOps dispatches e2e.yml on main with the tag and the stable baseline', async () => {
  const calls = [];
  const exec = (cmd, args) => { calls.push([cmd, ...args]); return { status: 0, stdout: '[]', stderr: '' }; };
  const ops = realOps({ exec });
  await ops.dispatch(TAG);
  assert.deepEqual(calls[0], ['gh', 'workflow', 'run', 'e2e.yml', '--repo', 'Matysh/houseplan-e2e', '--ref', 'main',
    '-f', `houseplan_ref=${TAG}`, '-f', 'upgrade_from=stable', '-f', 'ha_version=stable']);
  await ops.listRuns();
  assert.ok(calls[1].includes('--event') && calls[1].includes('workflow_dispatch'));
});
