import test from 'node:test';
import assert from 'node:assert/strict';
import { publishReviewReceipt } from '../lib/review-publication.mjs';

function fixture() {
  const comments = [], issues = []; let fail = false;
  const api = { root: '/repos/test/project',
    request: async (method, url, body) => {
      if (method === 'GET') return url.includes('/comments?') ? comments : issues;
      if (method === 'PATCH') { const comment = comments.find(row => row.id === Number(url.split('/').at(-1))); Object.assign(comment, body); return comment; }
      if (method === 'POST' && url.endsWith('/issues')) { const issue = { number: issues.length + 100, ...body }; issues.push(issue); return issue; }
      throw Error(`Unexpected API: ${method} ${url}`);
    },
    comment: async (_issue, body) => {
      if (fail) { fail = false; throw Error('comment unavailable'); }
      const row = { id: comments.length + 1, body, user: { login: 'github-actions[bot]' } }; comments.push(row); return row;
    } };
  const receipt = { requestId: 'review:12:1', issue: 12, kind: 'code', materialSha: 'a'.repeat(40), verdict: 'accepted', markdown: 'report', report: { improvements: ['Optional cleanup'] } };
  return { api, receipt, comments, issues, failOnce() { fail = true; } };
}

test('long report is fully archived in issue comments and publication retry creates no duplicates', async () => {
  const f = fixture(); f.receipt.markdown = 'A'.repeat(55_000) + '\nEND OF COMPLETE REVIEW\n' + 'B'.repeat(55_000);
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 3);
  assert.match(f.comments[1].body, /END OF COMPLETE REVIEW/);
  assert.ok(f.comments.every(row => row.body.length < 65_536));
  await publishReviewReceipt(f); assert.equal(f.comments.length, 3);
});

test('outside defects create separate source-marked issues, improvements do not, and retry repairs publication only', async () => {
  const f = fixture(); f.receipt.report.outsideFindings = [{ title: 'Existing lost write', problem: 'Concurrent save loses data', evidence: 'store.mjs:42 before this change', suggestedFix: 'Use the existing serialization path' }];
  f.failOnce(); await assert.rejects(publishReviewReceipt(f), /comment unavailable/);
  assert.equal(f.issues.length, 0);
  const first = await publishReviewReceipt(f);
  assert.deepEqual(first.outsideIssues, [100]); assert.equal(f.issues.length, 1);
  assert.match(f.issues[0].body, /process-next-outside:/); assert.match(f.issues[0].body, /issues\/12/);
  assert.deepEqual(f.issues[0].labels, ['bug', 'P2', 'S1-new']);
  await publishReviewReceipt(f); assert.equal(f.issues.length, 1); assert.equal(f.comments.length, 1);
});

test('local owner-token replay recognizes its own report comments without a second copy', async () => {
  const f = fixture();
  await publishReviewReceipt(f);
  f.comments[0].user.login = 'test';
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 1);
});
