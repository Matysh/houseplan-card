import assert from 'node:assert/strict';
import test from 'node:test';

import {
  finishManifestIssues, planIssueBookkeeping, releaseCommentMarker,
} from '../scripts/release-bookkeeping.mjs';

const tag = 'v1.76.0-beta.1';

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
  const input = { manifest: { issues: [{ number: 10 }] }, tag, url: 'https://example.test/release', ops };

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
  const input = { manifest: { issues: [{ number: 10 }] }, tag, url: 'https://example.test/release', ops };
  assert.throws(() => finishManifestIssues(input), /connection lost/);
  finishManifestIssues(input);
  assert.equal(closeCalls, 1, 'retry observes the persisted close instead of closing again');
  assert.equal(row.comments.length, 1);
});
