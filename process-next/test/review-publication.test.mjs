import test from 'node:test';
import assert from 'node:assert/strict';
import { publishReviewReceipt } from '../lib/review-publication.mjs';

function fixture() {
  const comments = [], issues = []; let fail = false, lost = false;
  const api = { root: '/repos/test/project',
    request: async (method, url, body) => {
      if (method === 'GET') return url.includes('/comments?') ? comments : issues;
      if (method === 'PATCH') throw Error('Published history must not be edited');
      if (method === 'POST' && url.endsWith('/issues')) { const issue = { number: issues.length + 100, ...body }; issues.push(issue); return issue; }
      throw Error(`Unexpected API: ${method} ${url}`);
    },
    comment: async (_issue, body) => {
      if (fail) { fail = false; throw Error('comment unavailable'); }
      const row = { id: comments.length + 1, body, user: { login: 'github-actions[bot]' } }; comments.push(row);
      if (lost) { lost = false; throw Error('POST response lost'); }
      return row;
    } };
  const receipt = { requestId: 'review:12:1', issue: 12, kind: 'code', materialSha: 'a'.repeat(40), verdict: 'accepted', markdown: 'report', report: { improvements: ['Optional cleanup'] } };
  return { api, receipt, comments, issues, failOnce() { fail = true; }, loseResponseOnce() { lost = true; } };
}

test('long report is fully archived in issue comments and publication retry creates no duplicates', async () => {
  const f = fixture(); f.receipt.markdown = 'A'.repeat(55_000) + '\nEND OF COMPLETE REVIEW\n' + 'B'.repeat(55_000);
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 3);
  assert.match(f.comments[1].body, /END OF COMPLETE REVIEW/);
  assert.ok(f.comments.every(row => row.body.length < 65_536));
  await publishReviewReceipt(f); assert.equal(f.comments.length, 3);
});

test('partial multipart publication resumes missing parts without changing the delivered first part', async () => {
  const f = fixture(); f.receipt.markdown = 'A'.repeat(110_000);
  const publish = f.api.comment; let calls = 0;
  f.api.comment = async (...args) => { if (++calls === 2) throw Error('second part unavailable'); return publish(...args); };
  await assert.rejects(publishReviewReceipt(f), /second part unavailable/);
  const first = structuredClone(f.comments[0]);
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 3); assert.deepEqual(f.comments[0], first);
  assert.match(f.comments[1].body, /issuecomment-1/);
});

test('outside defects create separate source-marked issues, improvements do not, and retry repairs publication only', async () => {
  const f = fixture(); f.receipt.report.outsideFindings = [{ title: 'Existing lost write', problem: 'Concurrent save loses data', evidence: 'store.mjs:42 before this change', suggestedFix: 'Use the existing serialization path' }];
  f.failOnce(); await assert.rejects(publishReviewReceipt(f), /comment unavailable/);
  assert.equal(f.issues.length, 0);
  const first = await publishReviewReceipt(f);
  assert.deepEqual(first.outsideIssues, [100]); assert.equal(f.issues.length, 1);
  assert.match(f.issues[0].body, /process-next-outside:/); assert.match(f.issues[0].body, /issues\/12/);
  assert.deepEqual(f.issues[0].labels, ['bug', 'P2', 'S1-new']);
  await publishReviewReceipt(f); assert.equal(f.issues.length, 1); assert.equal(f.comments.length, 2);
  assert.match(f.comments[1].body, /issues\/100/);
});

test('local owner-token replay recognizes its own report comments without a second copy', async () => {
  const f = fixture();
  await publishReviewReceipt(f);
  f.comments[0].user.login = 'test';
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 1);
});

test('incomplete report remains unchanged when the same round later completes', async () => {
  const f = fixture(); f.receipt.verdict = 'incomplete'; f.receipt.markdown = 'Analysis stopped before a valid result';
  f.receipt.report.outsideFindings = [{ title: 'Unconfirmed draft' }];
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 1); assert.equal(f.issues.length, 0);
  const first = structuredClone(f.comments[0]);
  f.receipt.verdict = 'accepted'; f.receipt.markdown = 'Completed review'; f.receipt.report.outsideFindings = [];
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 2); assert.match(f.comments[1].body, /Completed review/);
  assert.deepEqual(f.comments[0], first);
  await publishReviewReceipt(f); assert.equal(f.comments.length, 2);
});

test('lost POST response is recovered by reading the marker, and another round appends', async () => {
  const f = fixture(); f.loseResponseOnce();
  await publishReviewReceipt(f); assert.equal(f.comments.length, 1);
  const first = structuredClone(f.comments[0]);
  f.receipt.markdown = 'Different formatting on replay';
  f.receipt.presentation = { currentStatus: 'S8-merged', delayed: true };
  await publishReviewReceipt(f); assert.equal(f.comments.length, 1); assert.deepEqual(f.comments[0], first);
  f.receipt.requestId = 'review:12:2';
  await publishReviewReceipt(f); assert.equal(f.comments.length, 2); assert.deepEqual(f.comments[0], first);
});

test('separate incomplete technical attempts append, while delivery retries stay silent', async () => {
  const f = fixture(); f.receipt.verdict = 'incomplete'; f.receipt.runId = 123; f.receipt.runAttempt = 1;
  await publishReviewReceipt(f); const first = structuredClone(f.comments[0]);
  f.receipt.runAttempt = 2;
  await publishReviewReceipt(f); await publishReviewReceipt(f);
  assert.equal(f.comments.length, 2); assert.deepEqual(f.comments[0], first);
});

test('legacy multipart markers are recognized without editing history or suppressing a new result', async () => {
  const f = fixture();
  const old = { id: 50, user: { login: 'github-actions[bot]' }, body: `<!-- process-next-review:${f.receipt.requestId} -->\n\n\`\`\`json\n${JSON.stringify({ requestId: f.receipt.requestId, materialSha: f.receipt.materialSha, verdict: 'incomplete' })}\n\`\`\`\nOriginal incomplete report` };
  f.comments.push(old); f.receipt.verdict = 'incomplete';
  await publishReviewReceipt(f); assert.equal(f.comments.length, 1);
  f.receipt.verdict = 'accepted'; await publishReviewReceipt(f);
  assert.equal(f.comments.length, 2); assert.equal(f.comments[0], old);
});

test('only confirmed transitions are stated and late reports cannot claim current status changes', async () => {
  const f = fixture();
  f.receipt.presentation = { round: 2, transition: { from: 'S7-code-review', to: 'S6-in-progress', confirmed: true },
    next: 'Исправить перечисленные замечания; слот очереди освобождён.' };
  f.receipt.verdict = 'changes_requested';
  await publishReviewReceipt(f);
  assert.match(f.comments[0].body, /S7.*→.*S6/);
  assert.match(f.comments[0].body, /раунд 2/);
  assert.match(f.comments[0].body, /<details>[\s\S]*```json/);
  f.receipt.requestId = 'review:12:older';
  f.receipt.presentation = { ...f.receipt.presentation, delayed: true, currentStatus: 'S8-merged', occurredAt: '2026-11-01T18:00:00Z' };
  await publishReviewReceipt(f);
  assert.match(f.comments[1].body, /доставлен с задержкой/);
  assert.match(f.comments[1].body, /Текущий статус задачи не изменён/);
  assert.doesNotMatch(f.comments[1].body, /Переведена/);
  assert.doesNotMatch(f.comments[1].body, /Следующий шаг:/);
  assert.match(f.comments[1].body, /18:00:00 UTC/);
});
