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

test('code and specification reports collapse full analysis while verdict, status and links stay visible', async () => {
  for (const kind of ['code', 'spec']) {
    const f = fixture(); f.receipt.kind = kind; f.receipt.verdict = 'changes_requested';
    f.receipt.presentation = { round: 2, currentStatus: kind === 'code' ? 'S6-in-progress' : 'S3-spec' };
    f.receipt.reportUrl = 'https://example.test/review/42';
    f.receipt.markdown = '## Основание\n\nОшибка при повторе. Использовать `<details>`.\n\n```js\nconst html = "<details>";\n```\n\n'
      + '<details>\n<summary>Исходные данные</summary>\n\n[Файл](https://example.test/source)\n\n</details>\n';
    await publishReviewReceipt(f);
    const body = f.comments[0].body, start = body.indexOf('<details>');
    assert.match(body.slice(0, start), new RegExp(`${kind === 'code' ? 'Код-ревью' : 'Ревью ТЗ'}.*нужны исправления.*раунд 2`));
    assert.match(body.slice(0, start), /Статус остаётся/);
    assert.match(body.slice(0, start), /Следующий шаг:/);
    assert.ok(body.includes(`<summary>Подробный разбор</summary>\n\n${f.receipt.markdown}\n\n</details>`));
    assert.doesNotMatch(body, /<details open/);
    assert.ok(body.endsWith('[Запуск ревью](https://example.test/review/42). Полный текст сохранён в комментариях этой задачи.'));
  }
});

test('multipart Markdown splits outside complete code fences and nested disclosures', async () => {
  const f = fixture(), paragraph = 'Первый раздел. '.repeat(2_500) + '\n\n';
  const code = '```js\n' + 'const value = 1;\n'.repeat(900) + '```\n\n';
  const nested = '<details>\n<summary>Материал</summary>\n\n' + 'Справка. '.repeat(1_500) + '\n\n</details>\n';
  f.receipt.markdown = paragraph + code + nested;
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 2);
  assert.ok(f.comments[0].body.includes(paragraph));
  assert.ok(f.comments[1].body.includes(code + nested));
  assert.match(f.comments[1].body, /Первая часть отчёта/);
  assert.ok(f.comments.every(row => row.body.includes('<summary>Подробный разбор</summary>') && row.body.length < 65_536));
});

test('oversized indivisible Markdown stays complete and collapsed within the escaped comment budget', async () => {
  const f = fixture(); f.receipt.markdown = '```html\n' + '<&>😀'.repeat(15_000) + '\n```\n';
  await publishReviewReceipt(f);
  const text = f.comments.map(row => {
    assert.ok(row.body.length < 65_536);
    const match = row.body.match(/<pre>([^]*?)<\/pre>/);
    assert.ok(match, 'an oversized block is available as source Markdown inside its spoiler');
    assert.ok(row.body.indexOf('<summary>Подробный разбор') < row.body.indexOf('<pre>'));
    return match[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }).join('');
  assert.equal(text, f.receipt.markdown);
  const before = structuredClone(f.comments);
  await publishReviewReceipt(f); assert.deepEqual(f.comments, before);
});

test('resuming a pre-spoiler multipart report preserves its original offsets and length budget', async () => {
  const f = fixture(); f.receipt.markdown = 'A'.repeat(50_000) + '&'.repeat(50_000) + 'tail';
  const old = { id: 1, user: { login: 'github-actions[bot]' },
    body: `<!-- process-next-review:${f.receipt.requestId}:result:accepted -->\n\n${f.receipt.markdown.slice(0, 50_000)}` };
  f.comments.push(old);
  await publishReviewReceipt(f);
  assert.equal(f.comments.length, 3); assert.deepEqual(f.comments[0], old);
  assert.ok(f.comments[1].body.includes('&'.repeat(50_000)));
  assert.ok(f.comments[2].body.includes('tail'));
  assert.ok(f.comments.every(row => row.body.length < 65_536));
  await publishReviewReceipt(f); assert.equal(f.comments.length, 3);
});

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
  assert.equal(f.issues.length, 1, 'register once before embedding its link in the verdict');
  const first = await publishReviewReceipt(f);
  assert.deepEqual(first.outsideIssues, [100]); assert.equal(f.issues.length, 1);
  assert.match(f.issues[0].body, /process-next-outside:/); assert.match(f.issues[0].body, /issues\/12/);
  assert.deepEqual(f.issues[0].labels, ['bug', 'P2', 'S1-new']);
  await publishReviewReceipt(f); assert.equal(f.issues.length, 1); assert.equal(f.comments.length, 1);
  assert.match(f.comments[0].body, /issues\/100/);
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

test('a current rejection explains the author action without caller-supplied wording', async () => {
  const f = fixture(); f.receipt.verdict = 'changes_requested';
  f.receipt.presentation = { currentStatus: 'S6-in-progress', transition: { from: 'S7-code-review', to: 'S6-in-progress', confirmed: true } };
  await publishReviewReceipt(f);
  assert.match(f.comments[0].body, /Следующий шаг:.*исправляет код на S6/);
  assert.match(f.comments[0].body, /вместе с повторной передачей/);
});

test('accepted review followed by the ordinary merge reports completion, not delayed delivery', async () => {
  const f = fixture(); f.receipt.presentation = { mergedAfterReview: true, currentStatus: 'S8-merged' };
  await publishReviewReceipt(f);
  assert.match(f.comments[0].body, /уже слито в dev/);
  assert.doesNotMatch(f.comments[0].body, /доставлен с задержкой|Следующий шаг/);
});

test('accepted code report and outside links are included in one actual merge comment', async () => {
  const f = fixture(), merge = { marker: '<!-- process-next-task-merged:12:abc -->',
    body: '## Задача #12 слита в dev\n\nПереведена **S7 → S8**; рабочая ветка удалена.' };
  f.receipt.markdown = '## Проверенное решение\n\nПолный разбор принятого кода.\n\nАльтернатива и её ограничения.';
  f.receipt.report.outsideFindings = [{ title: 'Separate defect', problem: 'Unrelated incorrect state', evidence: 'old.mjs:10', suggestedFix: 'Restore existing state' }];
  const result = await publishReviewReceipt({ ...f, merge });
  assert.equal(result.merged, true); assert.equal(f.comments.length, 1);
  assert.ok(f.comments[0].body.startsWith(merge.marker));
  assert.match(f.comments[0].body, /S7 → S8/);
  assert.match(f.comments[0].body, /Код-ревью.*принято/);
  assert.ok(f.comments[0].body.includes(`<summary>Подробный разбор</summary>\n\n${f.receipt.markdown}\n\n</details>`));
  assert.match(f.comments[0].body, /issues\/100/);
  const before = structuredClone(f.comments);
  await publishReviewReceipt({ ...f, merge: { ...merge, body: 'Later changed status' } });
  await publishReviewReceipt(f);
  assert.deepEqual(f.comments, before, 'delivery retry or an old caller cannot duplicate the embedded report');
  assert.equal(f.issues.length, 1);
});

test('multipart accepted report resumes safely and the actual merge is the last comment', async () => {
  const f = fixture(), merge = { marker: '<!-- process-next-task-merged:12:def -->', body: '## Задача #12 слита в dev' };
  f.receipt.markdown = '```html\n' + '<&>😀'.repeat(15_000) + '\n```\n';
  const publish = f.api.comment; let calls = 0;
  f.api.comment = async (...args) => { if (++calls === 2) throw Error('second part unavailable'); return publish(...args); };
  await assert.rejects(publishReviewReceipt({ ...f, merge }), /second part unavailable/);
  const first = structuredClone(f.comments[0]);
  assert.doesNotMatch(first.body, /Задача #12 слита в dev/);
  await publishReviewReceipt({ ...f, merge });
  assert.deepEqual(f.comments[0], first);
  const content = f.comments.map(comment => {
    assert.ok(comment.body.length < 65_536);
    const match = comment.body.match(/<pre>([^]*?)<\/pre>/);
    assert.ok(match);
    return match[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }).join('');
  assert.equal(content, f.receipt.markdown);
  assert.ok(f.comments.at(-1).body.startsWith(merge.marker));
  assert.match(f.comments.at(-1).body, /Часть 1/);
  const before = structuredClone(f.comments);
  await publishReviewReceipt({ ...f, merge }); assert.deepEqual(f.comments, before);
});

test('an already started standalone accepted report finishes unchanged before an ordinary merge', async () => {
  const f = fixture(); f.receipt.markdown = 'A'.repeat(110_000);
  const publish = f.api.comment; let calls = 0;
  f.api.comment = async (...args) => { if (++calls === 2) throw Error('part unavailable'); return publish(...args); };
  await assert.rejects(publishReviewReceipt(f), /part unavailable/);
  const first = structuredClone(f.comments[0]);
  const result = await publishReviewReceipt({ ...f, merge: { marker: '<!-- process-next-task-merged:12:abc -->', body: 'Merged' } });
  assert.equal(result.merged, false); assert.equal(f.comments.length, 3);
  assert.deepEqual(f.comments[0], first);
  assert.ok(f.comments.every(comment => !comment.body.includes('process-next-task-merged:')));
});

test('legacy outside links can be repaired without rewriting an already published verdict', async () => {
  const f = fixture(); await publishReviewReceipt(f);
  const original = structuredClone(f.comments[0]);
  f.receipt.report.outsideFindings = [{ title: 'Legacy defect', problem: 'Outside problem', evidence: 'file:1', suggestedFix: 'Local fix' }];
  await publishReviewReceipt(f); await publishReviewReceipt(f);
  assert.equal(f.comments.length, 2); assert.deepEqual(f.comments[0], original);
  assert.match(f.comments[1].body, /Ссылки к ранее опубликованному/);
  assert.equal(f.issues.length, 1);
});

test('outside issue failure never hides the complete verdict or merged report and recovery adds links once', async () => {
  for (const combined of [false, true]) {
    const f = fixture();
    f.receipt.markdown = 'Полный отчёт должен быть доступен сразу, включая выводы и подробное обоснование.';
    f.receipt.report.outsideFindings = [{ title: 'Separate defect', problem: 'Outside problem', evidence: 'file:1', suggestedFix: 'Local fix' }];
    const request = f.api.request; let failOutside = true;
    f.api.request = async (method, path, body) => {
      if (method === 'POST' && path.endsWith('/issues') && failOutside) throw Error('outside issue endpoint unavailable');
      return request(method, path, body);
    };
    const args = { ...f, ...(combined ? { merge: { marker: '<!-- process-next-task-merged:12:outside-recovery -->',
      body: '## Задача #12 слита в dev\n\nПереведена **S7 → S8**.' } } : {}) };
    const failed = await publishReviewReceipt(args);
    assert.equal(failed.published, false); assert.equal(failed.pending, true); assert.equal(failed.merged, combined);
    assert.equal(f.comments.length, 1); assert.equal(f.issues.length, 0);
    assert.ok(f.comments[0].body.includes(f.receipt.markdown));
    const original = structuredClone(f.comments[0]);
    await publishReviewReceipt(args);
    assert.equal(f.comments.length, 1, 'an unchanged outside failure does not repeat the report');
    failOutside = false;
    assert.equal((await publishReviewReceipt(args)).published, true);
    assert.equal(f.comments.length, 2); assert.equal(f.issues.length, 1);
    assert.deepEqual(f.comments[0], original); assert.match(f.comments[1].body, /issues\/100/);
    await publishReviewReceipt(args);
    assert.equal(f.comments.length, 2); assert.equal(f.issues.length, 1);
    assert.equal(f.comments.filter(comment => comment.body.includes(f.receipt.markdown)).length, 1);
  }
});
