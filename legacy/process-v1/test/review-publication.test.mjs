import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { publicationPlan, publishReview, verifyReviewPublication, assertNoReviewPublication,
  publicationReference, publicationReceiptFromDocument, readPublicationArtifact, realOps } from '../scripts/review-publication.mjs';
import { findingsPolicy, outsideFindingsProblems } from '../scripts/review-findings-policy.mjs';
import { PASSPORT_FIELDS, sha256 } from '../scripts/review-result-gate.mjs';

const identity = { repo: 'owner/repo', issue: 1065, stage: 'code', round: 4 };
const finding = { id: 'F1', title: 'Independent outside defect', body: 'The separate path refuses a valid value.', severity: 'medium' };
function fixture({ mode = 'issues', outside = [finding], verdict = 'green' } = {}) {
  const policy = findingsPolicy(mode === 'file' ? '[1065]' : '', identity);
  const expected = { ...Object.fromEntries(PASSPORT_FIELDS.map(k => [k, ''])), repo: identity.repo,
    issue: '1065', stage: 'code', cycle: '4', run_id: '123', run_attempt: '1',
    material_sha: 'a'.repeat(40), material_tree: 'b'.repeat(40), material_issue_body: 'c'.repeat(64), findings_policy_snapshot: JSON.stringify(policy) };
  const files = { 'prepared.json': JSON.stringify({ schema: 1, ...expected }),
    'review-document.md': '# Complete independent review\n',
    'verdict.json': JSON.stringify({ verdict, high: 0, medium: 0, summary: 'Reviewed code and required evidence.', outside_findings: outside }) };
  if (mode === 'file') files['outside-findings.md'] = 'Separate Markdown findings.\n';
  files['manifest.sha256'] = Object.entries(files).map(([name, body]) => `${sha256(body)}  ${name}`).join('\n') + '\n';
  const input = { files: Object.keys(files), read: n => files[n], expected, spent: 1, limit: 2 };
  return { files, input, plan: () => publicationPlan(input) };
}
function memory() {
  const actor = { id: 42, login: 'publisher' }, comments = [], issues = [], writes = [];
  let sequence = 100;
  const ops = { actor: async () => actor, comments: async () => comments, issues: async () => issues,
    createComment: async (issue, body) => {
      const row = { id: sequence++, body, user: actor, html_url: `https://github.com/owner/repo/issues/${issue}#issuecomment-${sequence - 1}` };
      writes.push('comment'); comments.push(row); return row;
    },
    createIssue: async payload => {
      const row = { ...payload, id: sequence++, number: sequence, user: actor, html_url: `https://github.com/owner/repo/issues/${sequence}` };
      writes.push('issue'); issues.push(row); return row;
    } };
  return { actor, comments, issues, writes, ops };
}

test('#1065 publication accepts only bounded typed outside Medium data', () => {
  assert.deepEqual(outsideFindingsProblems([finding]), []);
  assert.deepEqual(outsideFindingsProblems(undefined), []);
  for (const value of [null, {}, [{ ...finding, severity: 'high' }], [{ ...finding, repo: 'foreign/repo' }],
    [{ ...finding, labels: ['S8-merged'] }], [finding, finding], [{ ...finding, id: '../F1' }],
    [{ ...finding, title: '\n' }], [{ ...finding, body: '\0' }], [{ ...finding, body: 'x'.repeat(262145) }]])
    assert.ok(outsideFindingsProblems(value).length);
  assert.ok(outsideFindingsProblems([finding], { mode: 'file' }).length);
  assert.ok(outsideFindingsProblems([{ ...finding, kind: 'S8-merged' }]).length);
  let called = 0;
  assert.ok(outsideFindingsProblems([{ ...finding, get toJSON() { called++; return () => finding; } }]).length);
  assert.equal(called, 0);
});

test('#1065 valid seal is required before any publication operation', async () => {
  const f = fixture(); f.files['review-document.md'] += 'tampered';
  assert.throws(f.plan, /not valid/);
  const plan = fixture().plan(), m = memory(); plan.verdict.outside_findings[0].body += 'changed';
  await assert.rejects(publishReview(plan, m.ops), /changed plan/);
  assert.deepEqual(m.writes, []);
});

test('#1065 ordinary GREEN receives canonical summary, stable mapping and no second posts', async () => {
  const f = fixture(), before = JSON.stringify(f.files), plan = f.plan(), m = memory();
  const receipt = await publishReview(plan, m.ops);
  assert.equal(m.issues.length, 1);
  assert.deepEqual(m.issues[0].labels, ['bug', 'P2', 'S1-new']);
  assert.equal(m.comments.length, 2);
  assert.match(m.comments[1].body, /^Вердикт: зелёный/);
  assert.match(m.comments[1].body, /F1 → \[#/);
  assert.equal(receipt.findings[0].issue, m.issues[0].number);
  assert.equal(await verifyReviewPublication(receipt, m.ops, { repo: identity.repo, issue: 1065 }), true);
  await publishReview(plan, m.ops);
  assert.deepEqual(m.writes, ['comment', 'issue', 'comment']);
  assert.equal(JSON.stringify(f.files), before, 'sealed report/verdict/manifest never rewritten');
});

test('#1065 file-mode Markdown stays routed to file and creates no outside issue', async () => {
  const f = fixture({ mode: 'file', outside: [] }), before = f.files['outside-findings.md'], m = memory();
  const receipt = await publishReview(f.plan(), m.ops);
  assert.equal(receipt.findings.length, 0); assert.equal(m.issues.length, 0);
  assert.equal(f.files['outside-findings.md'], before);
});

test('#1065 multiple findings keep separate local identities through publication and retry', async () => {
  const plan = fixture({ outside: [finding, { ...finding, id: 'F2', title: 'Second outside defect', kind: 'infra' }] }).plan();
  const m = memory(), receipt = await publishReview(plan, m.ops);
  assert.deepEqual(receipt.findings.map(row => row.id), ['F1', 'F2']);
  assert.equal(new Set(receipt.findings.map(row => row.issue)).size, 2);
  assert.deepEqual(m.issues[1].labels, ['infra', 'P2', 'S1-new']);
  await publishReview(plan, m.ops);
  assert.deepEqual(m.writes, ['comment', 'issue', 'issue', 'comment']);
  assert.equal(await verifyReviewPublication(receipt, m.ops), true);
});

test('#1065 partial create with unknown outcome is reconciled, never blindly reposted', async () => {
  const plan = fixture().plan(), m = memory(), create = m.ops.createIssue;
  m.ops.createIssue = async payload => { await create(payload); throw Error('unknown transport outcome'); };
  await assert.rejects(publishReview(plan, m.ops), /unknown/);
  await assert.rejects(assertNoReviewPublication({ issue: 1065, stage: 'code', round: 4, material: plan.identity.material }, m.ops), /do not rerun/);
  assert.equal(m.issues.length, 1);
  m.ops.createIssue = create;
  const result = await publishReview(plan, m.ops);
  assert.equal(result.type, 'complete'); assert.equal(m.issues.length, 1);
  assert.equal(m.writes.filter(x => x === 'issue').length, 1);
});

test('#1065 same identity with changed or foreign marker is refused', async () => {
  const plan = fixture().plan(), m = memory(); await publishReview(plan, m.ops);
  const original = m.issues[0].body;
  m.issues[0].body = original.replace('Source:', 'Changed source:');
  await assert.rejects(publishReview(plan, m.ops), /footer payload changed/);
  m.issues[0].body = original;
  m.issues[0].body += '\nHuman changed the body';
  await assert.rejects(publishReview(plan, m.ops), /pre-existing duplicate/);
  m.issues[0].user = { id: 99 };
  await assert.rejects(publishReview(plan, m.ops), /foreign|pre-existing duplicate/);
});

test('#1065 existing unmarked title is not silently overwritten or duplicated', async () => {
  const m = memory(); m.issues.push({ number: 5, title: finding.title, body: 'Existing issue', user: m.actor });
  await assert.rejects(publishReview(fixture().plan(), m.ops), /pre-existing duplicate/);
  assert.equal(m.issues.length, 1); assert.ok(!m.writes.includes('issue'));
});

test('#1065 completion receipt blocks missing/edited comment and foreign review reuse', async () => {
  const m = memory(), receipt = await publishReview(fixture().plan(), m.ops);
  await assert.rejects(verifyReviewPublication(receipt, m.ops, { issue: 7 }), /another review/);
  const exact = m.comments[1].body; m.comments[1].body += '\nchanged';
  await assert.rejects(verifyReviewPublication(receipt, m.ops), /changed/);
  m.comments[1].body = exact; m.comments.pop();
  await assert.rejects(verifyReviewPublication(receipt, m.ops), /missing/);
});

test('#1065 pending guard uses the trusted publisher and exact marker hash, not quoted/foreign comments', async () => {
  const plan = fixture().plan(), m = memory(); await publishReview(plan, m.ops);
  const request = { issue: 1065, stage: 'code', round: 4, material: plan.identity.material, publisherId: m.actor.id };
  await assert.rejects(assertNoReviewPublication({ ...request, round: 5, bodyDigest: plan.identity.bodyDigest }, m.ops), /do not rerun/);
  assert.equal(await assertNoReviewPublication({ ...request, round: 5, bodyDigest: 'd'.repeat(64) }, m.ops), true, 'a new body remains a fresh review');
  assert.equal(await assertNoReviewPublication({ ...request, material: 'f'.repeat(40) }, m.ops), true, 'a new material remains a fresh review');
  const foreign = memory(); foreign.comments.push(...m.comments.map(row => ({ ...row, user: { id: 99 } })));
  assert.equal(await assertNoReviewPublication(request, foreign.ops), true);
  const quoted = memory(); quoted.comments.push({ ...m.comments[0], body: '```\n' + m.comments[0].body + '\n```' });
  assert.equal(await assertNoReviewPublication(request, quoted.ops), true);
  await assert.rejects(assertNoReviewPublication({ ...request, publisherId: NaN }, m.ops), /identity is missing/);
  const marker = m.comments[0].body.match(/<!-- hp:review-publication ([\w-]+) -->/)[1];
  const data = JSON.parse(Buffer.from(marker, 'base64url')); data.key = 'f'.repeat(64);
  m.comments[0].body = m.comments[0].body.replace(marker, Buffer.from(JSON.stringify(data)).toString('base64url'));
  await assert.rejects(assertNoReviewPublication(request, m.ops), /hash changed/);
});

test('#1065 receipt attaches only to published copy and preserves legacy documents', async () => {
  const m = memory(), receipt = await publishReview(fixture().plan(), m.ops);
  const document = '# Copy\n\n' + publicationReference(receipt, '# Copy');
  assert.deepEqual(publicationReceiptFromDocument(document), receipt);
  assert.equal(publicationReceiptFromDocument('# Historical CODE'), null);
  assert.throws(() => publicationReceiptFromDocument(document.replace('# Copy', '# Changed')), /payload changed/);
  assert.equal(publicationReceiptFromDocument(document + '\nContinued prose'), null, 'a non-terminal quotation is not authority');
});

test('#1065 literal/quoted markers in model data are preserved without publication authority', async () => {
  const m = memory(), first = await publishReview(fixture().plan(), m.ops);
  const quoted = m.comments[0].body;
  const f = fixture({ outside: [{ ...finding, body: 'Protocol example:\n' + quoted }] });
  f.files['review-document.md'] = '# Report\n\n```html\n' + publicationReference(first) + '\n```\n';
  f.files['verdict.json'] = JSON.stringify({ verdict: 'green', high: 0, medium: 0,
    summary: 'This report reads the footer protocol.\n' + quoted,
    outside_findings: [{ ...finding, body: 'Protocol example:\n' + quoted }] });
  f.files['manifest.sha256'] = Object.entries(f.files).filter(([name]) => name !== 'manifest.sha256')
    .map(([name, value]) => `${sha256(value)}  ${name}`).join('\n');
  const fresh = memory(), plan = f.plan(); // Legitimate report containing the protocol still seals.
  fresh.comments.push({ id: 1, user: fresh.actor, body: quoted + '\ncontinued quotation', html_url: 'example' });
  assert.equal(await assertNoReviewPublication({ issue: 1065, stage: 'code', round: 4,
    material: plan.identity.material, publisherId: fresh.actor.id }, fresh.ops), true);
  const result = await publishReview(plan, fresh.ops);
  assert.equal(result.type, 'complete');
  await publishReview(plan, fresh.ops);
  assert.equal(fresh.issues.length, 1, 'body marker did not hijack finding reconciliation');
  const prefix = f.files['review-document.md'].trimEnd();
  assert.deepEqual(publicationReceiptFromDocument(prefix + '\n\n' + publicationReference(result, prefix)), result);
});

test('#1065 publication reads one bounded regular-file snapshot and refuses symlinks/oversize', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-publication-'));
  t.after(() => { assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/')); rmSync(dir, { recursive: true, force: true }); });
  const f = fixture();
  for (const [name, body] of Object.entries(f.files)) writeFileSync(join(dir, name), body);
  const snapshot = readPublicationArtifact(dir);
  assert.equal(snapshot.read('review-document.md'), f.files['review-document.md']);
  writeFileSync(join(dir, 'review-document.md'), 'x'.repeat(4 * 1024 * 1024 + 1));
  assert.throws(() => readPublicationArtifact(dir), /bound/);
  assert.equal(snapshot.read('review-document.md'), f.files['review-document.md'], 'already captured bytes stay immutable');
  if (process.platform !== 'win32') {
    rmSync(join(dir, 'review-document.md'));
    symlinkSync(join(dir, 'verdict.json'), join(dir, 'review-document.md'));
    assert.throws(() => readPublicationArtifact(dir), /non-file|canonical/);
  }
});

test('#1106 real pagination finds the existing publication beyond 8 MiB without duplicate writes', async () => {
  const plan = fixture().plan(), m = memory();
  const original = await publishReview(plan, m.ops);
  const older = Array.from({ length: 200 }, (_, n) => ({ id: n + 1000, number: n + 2000,
    title: `Older unrelated issue ${n}`, body: 'x'.repeat(48000), user: { id: 99 } }));
  const history = [...older, ...m.issues], issuePages = [];
  assert.ok(Buffer.byteLength(JSON.stringify(history)) > 8 * 1024 * 1024);
  const ops = realOps(identity.repo, (command, args, options) => {
    assert.equal(command, 'gh');
    assert.equal(options.maxBuffer, 8 * 1024 * 1024, 'per-response cap is unchanged');
    assert.equal(args[3], 'GET', 'reconciliation must not write another finding or comment');
    const endpoint = args[1];
    if (endpoint === 'user') return JSON.stringify(m.actor);
    const url = new URL(endpoint, 'https://api.github.com/');
    assert.equal(url.searchParams.get('per_page'), '100');
    const page = Number(url.searchParams.get('page'));
    if (url.pathname.endsWith('/comments')) return JSON.stringify(m.comments.slice((page - 1) * 100, page * 100));
    assert.equal(url.pathname, '/repos/owner/repo/issues');
    assert.equal(url.searchParams.get('state'), 'all', 'closed history remains in reconciliation');
    issuePages.push(page);
    return JSON.stringify(history.slice((page - 1) * 100, page * 100));
  });
  const receipt = await publishReview(plan, ops);
  assert.deepEqual(receipt, original);
  assert.deepEqual(issuePages, [1, 2, 3, 1, 2, 3], 'reconciliation and receipt verification read the late matching issue');
  assert.equal(await verifyReviewPublication(receipt, ops), true);
  assert.deepEqual(m.writes, ['comment', 'issue', 'comment']);
});

function sizedPage(bytes, count = 100) {
  const rows = Array.from({ length: count }, () => ({ body: '' }));
  rows[0].body = 'x'.repeat(bytes - Buffer.byteLength(JSON.stringify(rows)));
  return JSON.stringify(rows);
}

test('#1106 aggregate accepts exactly 64 MiB and refuses the next byte without partial history', () => {
  const full = sizedPage(7 * 1024 * 1024), last = sizedPage(1024 * 1024, 1);
  for (const extra of [0, 1]) {
    let calls = 0;
    const ops = realOps(identity.repo, (_command, args) => {
      const page = Number(new URL(args[1], 'https://api.github.com/').searchParams.get('page'));
      calls++;
      return page < 10 ? full : extra ? sizedPage(1024 * 1024 + extra, 1) : last;
    });
    if (extra) assert.throws(() => ops.issues(), /API pagination exceeds its aggregate bound/);
    else assert.equal(ops.issues().length, 901);
    assert.equal(calls, 10, 'bounded traversal ends at the final page or the first overflow');
  }
});

test('#1106 malformed page and excessive page count fail closed instead of returning a prefix', () => {
  for (const bad of ['{}', 'null', '"page"', '{broken']) {
    let calls = 0;
    const ops = realOps(identity.repo, () => ++calls === 1 ? JSON.stringify(Array(100).fill({})) : bad);
    assert.throws(() => ops.comments(1065), /API pagination shape|API operation failed/);
    assert.equal(calls, 2);
  }
  let pages = 0;
  const ops = realOps(identity.repo, () => { pages++; return JSON.stringify(Array(100).fill({})); });
  assert.throws(() => ops.issues(), /API pagination bound exceeded/);
  assert.equal(pages, 100);
});

test('#1106 real CLI buffer keeps the 8 MiB response cap and does not retry unknown writes', () => {
  let calls = 0;
  const oversized = realOps(identity.repo, (_command, _args, options) => {
    calls++;
    assert.equal(options.maxBuffer, 8 * 1024 * 1024);
    // Real child output exercises execFileSync's unchanged response limit.
    return execFileSync(process.execPath, ['-e', 'process.stdout.write("x".repeat(9 * 1024 * 1024))'], options);
  });
  assert.throws(() => oversized.issues(), /API operation failed or write outcome unknown/);
  assert.equal(calls, 1);
  const uncertain = realOps(identity.repo, (_command, args, options) => {
    assert.equal(args[3], 'POST');
    assert.deepEqual(JSON.parse(options.input), { body: 'pending' });
    calls++;
    throw Error('transport lost response after write');
  });
  assert.throws(() => uncertain.createComment(1065, 'pending'), /reconcile before retry/);
  assert.equal(calls, 2);
});
