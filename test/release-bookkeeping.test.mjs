import assert from 'node:assert/strict';
import test from 'node:test';

import {
  finishManifestIssues, finishVerifiedManifestIssues, planIssueBookkeeping, releaseCommentMarker,
} from '../scripts/release-bookkeeping.mjs';
import { buildCiProof } from '../scripts/ci-proof.mjs';
import { classifyValidateProofs } from '../scripts/release-gate.mjs';
import { jobInstanceNames, validateJobs } from '../scripts/workflow-jobs.mjs';

const tag = 'v1.76.0-beta.1';
const repo = 'Matysh/houseplan-card';
const url = `https://github.com/${repo}/releases/tag/${tag}`;
const ciUrl = `https://github.com/${repo}/actions/runs/123/attempts/2`;

test('#970: the actual closing comment includes exact CI and tag-pinned bilingual changelogs', () => {
  const row = { state: 'OPEN', labels: ['S8-merged'], comments: [] };
  finishManifestIssues({
    manifest: { issues: [{ number: 10 }] }, repo, tag, url, ciUrl,
    ops: {
      load: () => structuredClone(row),
      comment: (_number, body) => row.comments.push(body),
      removeLabel: () => { row.labels = []; },
      close: () => { row.state = 'CLOSED'; },
    },
  });
  assert.deepEqual(row.comments, [
    `Выпущено в \`${tag}\` · [релиз](${url}) · [CI точного кандидата](${ciUrl})\n\n`
    + `[Changelog RU](https://github.com/${repo}/blob/${tag}/docs/CHANGELOG.ru.md) · `
    + `[Changelog EN](https://github.com/${repo}/blob/${tag}/docs/CHANGELOG.md)\n\n`
    + releaseCommentMarker(tag),
  ]);
});

test('#547: first bookkeeping pass comments, strips status and closes', () => {
  assert.deepEqual(planIssueBookkeeping({
    state: 'OPEN', labels: ['bug', 'S8-merged'], comments: [],
  }, tag), {
    comment: true, removeLabels: ['S8-merged'], close: true,
  });
});

test('#547 AC3: every partial-failure retry converges without duplicate comments', () => {
  const marker = releaseCommentMarker(tag);
  assert.deepEqual(planIssueBookkeeping({
    state: 'OPEN', labels: ['S8-merged'], comments: [`released\n${marker}`],
  }, tag), {
    comment: false, removeLabels: ['S8-merged'], close: true,
  }, 'retry after comment failure does not comment twice');
  assert.deepEqual(planIssueBookkeeping({
    state: 'OPEN', labels: ['bug'], comments: [`released\n${marker}`],
  }, tag), {
    comment: false, removeLabels: [], close: true,
  }, 'retry after label removal still closes from the manifest');
  assert.deepEqual(planIssueBookkeeping({
    state: 'CLOSED', labels: ['S8-merged'], comments: [`released\n${marker}`],
  }, tag), {
    comment: false, removeLabels: ['S8-merged'], close: false,
  }, 'retry after close repairs a leftover status label');
  assert.deepEqual(planIssueBookkeeping({
    state: 'CLOSED', labels: ['bug'], comments: [`released\n${marker}`],
  }, tag), {
    comment: false, removeLabels: [], close: false,
  });
});

test('#547 AC1/AC3: manifest retry repairs uncertain steps and never touches later S8 work', () => {
  const rows = new Map([
    [10, { state: 'OPEN', labels: ['bug', 'S8-merged'], comments: [] }],
    [11, { state: 'OPEN', labels: ['S8-merged'], comments: [] }],
  ]);
  const calls = [];
  const ops = {
    load(number) {
      calls.push(`load:${number}`);
      return structuredClone(rows.get(number));
    },
    comment(number, body) {
      calls.push(`comment:${number}`);
      rows.get(number).comments.push(body);
    },
    removeLabel(number, label) {
      calls.push(`remove:${number}`);
      rows.get(number).labels = rows.get(number).labels.filter((name) => name !== label);
    },
    close(number) {
      calls.push(`close:${number}`);
      rows.get(number).state = 'CLOSED';
    },
  };
  const input = { manifest: { issues: [{ number: 10 }] }, repo, tag, url, ciUrl, ops };

  const originalRemove = ops.removeLabel;
  let first = true;
  ops.removeLabel = (...args) => {
    if (first) { first = false; throw new Error('label API failed'); }
    originalRemove(...args);
  };
  assert.throws(() => finishManifestIssues(input), /label API failed/);
  assert.equal(rows.get(10).comments.length, 1);
  finishManifestIssues(input);
  assert.equal(rows.get(10).comments.length, 1, 'release comment is not duplicated');
  assert.ok(rows.get(10).comments[0].includes(`[CI точного кандидата](${ciUrl})`));
  assert.ok(rows.get(10).comments[0].includes(`/blob/${tag}/docs/CHANGELOG.ru.md`));
  assert.deepEqual(rows.get(10), {
    state: 'CLOSED', labels: ['bug'], comments: rows.get(10).comments,
  });
  assert.deepEqual(rows.get(11), {
    state: 'OPEN', labels: ['S8-merged'], comments: [],
  }, 'B is not a member of candidate A and remains untouched');
  assert.equal(calls.some((call) => call.endsWith(':11')), false);
});

test('#547 AC3: an uncertain close response is harmless on retry', () => {
  const row = { state: 'OPEN', labels: [], comments: [] };
  let closeCalls = 0;
  const ops = {
    load: () => structuredClone(row),
    comment: (_number, body) => row.comments.push(body),
    removeLabel: () => {},
    close: () => {
      closeCalls++;
      row.state = 'CLOSED';
      if (closeCalls === 1) throw new Error('connection lost after close');
    },
  };
  const input = { manifest: { issues: [{ number: 10 }] }, repo, tag, url, ciUrl, ops };
  assert.throws(() => finishManifestIssues(input), /connection lost/);
  finishManifestIssues(input);
  assert.equal(closeCalls, 1, 'retry observes the persisted close instead of closing again');
  assert.equal(row.comments.length, 1);
});

const candidate = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const workflow = validateJobs();
const proofFixture = ({ id = 123, full = true, conclusion = 'success', headSha = candidate } = {}) => {
  const needs = {
    preflight: { result: 'success' }, changes: { result: 'success', outputs: { heavy: String(full), frontend: 'true' } },
    reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' },
    smoke: { result: full ? 'success' : 'skipped' }, smoke_done: { result: full ? 'success' : 'skipped' },
    golden: { result: full ? 'success' : 'skipped' }, performance_smoke: { result: full ? 'success' : 'skipped' },
  };
  return {
    run: { databaseId: id, attempt: 2, headSha, status: 'completed', conclusion,
      event: 'workflow_dispatch', url: `https://github.com/${repo}/actions/runs/${id}/attempts/2`,
      startedAt: new Date(id * 1000).toISOString() },
    proof: buildCiProof({ candidateSha: headSha, candidateTree: tree, runId: id, attempt: 2,
      event: 'workflow_dispatch', needs }),
    jobs: Object.entries(needs).filter(([, value]) => value.result === 'success')
      .flatMap(([id]) => jobInstanceNames(workflow.get(id)).map(name => ({ name, conclusion: 'success' }))),
  };
};

// The production probe and this fixture use the same release-policy classifier;
// no remote API writes, workflow dispatches or implementation substitutions.
const probeFixtures = (fixtures) => async (options) => {
  assert.deepEqual(options, { repo, sha: candidate, token: 'fixture-token' });
  return classifyValidateProofs({ ...options, tree, runs: fixtures.map(f => f.run),
    loadContext: async run => fixtures.find(f => f.run.databaseId === run.databaseId) });
};

test('#970: bookkeeping links the selected full proof rather than a newer light run', async () => {
  const full = proofFixture();
  const light = proofFixture({ id: 124, full: false });
  const row = { state: 'OPEN', labels: [], comments: [] };
  await finishVerifiedManifestIssues({ manifest: { issues: [{ number: 10 }] }, repo, tag, candidate, url,
    token: 'fixture-token', probe: probeFixtures([light, full]), ops: {
      load: () => structuredClone(row),
      comment: (_number, body) => row.comments.push(body),
      removeLabel: () => assert.fail('no status label'), close: () => { row.state = 'CLOSED'; },
    } });
  assert.ok(row.comments[0].includes(`[CI точного кандидата](${full.run.url})`));
  assert.ok(!row.comments[0].includes(light.run.url));
  assert.equal(row.state, 'CLOSED');
});

test('#970: foreign, red, missing and light-only CI cannot start issue bookkeeping', async () => {
  for (const fixtures of [
    [proofFixture({ headSha: 'c'.repeat(40) })], [proofFixture({ conclusion: 'failure' })],
    [], [proofFixture({ full: false })],
    [proofFixture({ id: 124, conclusion: 'failure' }), proofFixture()],
  ]) {
    await assert.rejects(finishVerifiedManifestIssues({
      manifest: { issues: [{ number: 10 }] }, repo, tag, candidate, url, token: 'fixture-token',
      probe: probeFixtures(fixtures), ops: { load: () => assert.fail('no issue read or write before proof') },
    }), /Exact-SHA Validate proof is (missing|failed)/);
  }
});

test('#970: absent CI URL is refused before touching any issue, including a nominal green verdict', async () => {
  const input = { manifest: { issues: [{ number: 10 }] }, repo, tag, candidate, url,
    ops: { load: () => assert.fail('missing evidence must not close issues') } };
  assert.throws(() => finishManifestIssues(input), /verified exact-SHA CI URL/);
  await assert.rejects(finishVerifiedManifestIssues({ ...input,
    probe: async () => ({ status: 'green', url: null, note: 'missing link' }),
  }), /missing link/);
});
