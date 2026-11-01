import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectIssueSource, issueSourceContext, sourceContextPacket, checkedReviewContext,
  writeReviewContext, batchSourceContext } from '../scripts/review-context.mjs';
import { collectReviewInput, checkReviewInput } from '../scripts/review-preflight.mjs';
import { handoffSnapshot } from '../scripts/review-handoff.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';

const sha = 'a'.repeat(40), tree = 'b'.repeat(40), at = '2026-10-25T01:00:00Z';
const repo = 'owner/repo', url = `https://github.com/${repo}/issues/7`;
const handoff = 'Сделано: synthetic\nФайлы: scripts/change.mjs\nГейты: ordinary\nНЕ сделано: none\nРиски: checked\nСледующий статус: S7-code-review';
const issue = () => ({ number: 7, title: 'Synthetic context', html_url: url, body: 'Approved body',
  updated_at: at, comments: 2, state: 'open', labels: [{ name: 'S7-code-review' }, { name: 'track:ask' }] });
const comment = (id, body, author = 'owner') => ({ id, body, user: { login: author },
  html_url: `${url}#issuecomment-${id}`, created_at: at, updated_at: at });
const comments = () => [comment(1, handoff), comment(2, 'Owner decision: retain all text.\n\nExact second line.')];
const source = (overrides = {}) => issueSourceContext({ repo, number: 7, snapshot: issue(), pages: [comments()],
  startedAt: at, finishedAt: at, ...overrides });
const prepared = (stage = 'code', s = source()) => ({ schema: 1, issue: 7, stage, material_sha: sha,
  material_tree: tree, material_issue_body: issueBodyDigest(s.issue.body),
  handoff_snapshot: handoffSnapshot(s.handoff), validate_result: stage === 'code' ? 'green' : 'skipped',
  validate_url: 'https://github.com/owner/repo/actions/runs/1', validated_note: 'Existing verified proof' });
function packet(stage = 'code', s = source()) {
  return sourceContextPacket({ kind: 'task', sha, tree, sources: [s], preflight: {
    schema: 'houseplan-review-preflight/v2', ok: true, semanticApproval: false,
    identity: { issue: 7, stage, sha, tree, bodyDigest: s.issue.bodyDigest, handoff: stage === 'code' ? s.handoff : null },
  } });
}
const read = (s = source(), stage = 'code') => checkedReviewContext({ prepared: prepared(stage, s),
  packet: packet(stage, s), sha, tree, changedFiles: ['scripts/change.mjs'] });

test('#1065 context keeps full bodies, owner references, exact handoff and a non-atomic boundary', () => {
  const s = source();
  assert.deepEqual(s.comments.map(row => row.body), comments().map(row => row.body));
  assert.deepEqual(s.ownerCommentIds, [1, 2]);
  assert.equal(s.handoff.body, handoff);
  assert.equal(s.issue.bodySha256, createHash('sha256').update(issue().body).digest('hex'));
  assert.deepEqual(s.boundary.pageCounts, [2]);
  assert.equal(s.boundary.atomic, false);
  const context = read(s);
  assert.equal(context.handoff.id, 1);
  assert.equal(context.ciEvidence.result, 'green');
  assert.equal(context.ciEvidence.note, 'Existing verified proof');
  assert.equal(context.sourceContext[0].comments[1].body, comments()[1].body);
});

test('#1065 full history exceeds the former private 128KiB budget without truncation', () => {
  const list = Array.from({ length: 35 }, (_, i) => comment(i + 1, `entry${i}\n` + 'текст😀'.repeat(1000)));
  const s = source({ snapshot: { ...issue(), comments: list.length }, pages: [list.slice(0, 10), list.slice(10)] });
  assert.ok(Buffer.byteLength(JSON.stringify(s)) > 128 * 1024);
  assert.equal(s.comments.length, 35);
  assert.equal(s.comments[34].body, list[34].body);
  assert.equal(s.ownerCommentIds.length, 35, 'owner history is not the former last-five summary');
});

test('#1065 duplicate API pages are explicit; incomplete, conflicting or foreign rows refuse', () => {
  const rows = comments();
  const repeated = source({ pages: [rows, [rows[1]]] });
  assert.equal(repeated.comments.length, 2);
  assert.equal(repeated.boundary.duplicateCopies, 1);
  for (const pages of [[rows.slice(0, 1)], [rows, [{ ...rows[1], body: 'edited during pagination' }]],
    [[{ ...rows[0], id: 0 }, rows[1]]], [[{ ...rows[0], html_url: 'https://github.com/other/repo/issues/7#issuecomment-1' }, rows[1]]],
    [[{ ...rows[0], user: undefined }, rows[1]]], [[{ ...rows[0], updated_at: 'invalid' }, rows[1]]]])
    assert.throws(() => source({ pages }));
  assert.throws(() => source({ pages: rows }), /pages/);
  const deleted = source({ pages: [[{ ...rows[0], user: null }, rows[1]]] });
  assert.equal(deleted.comments[0].author, null, 'a deleted actor is explicit unknown, not a dropped comment');
});

test('#1065 pagination races and oversized bodies fail before context publication', () => {
  for (const alter of [{ body: 'new body' }, { comments: 3 }, { updated_at: '2026-10-25T01:00:01Z' },
    { state: 'closed' }, { labels: [] }]) assert.throws(() => source({ after: { ...issue(), ...alter } }), /changed/);
  assert.throws(() => source({ snapshot: { ...issue(), body: 'x'.repeat(256 * 1024 + 1) } }), /body/);
  assert.throws(() => source({ pages: [[comment(1, 'x'.repeat(16 * 1024 * 1024))]] }), /bound/);
});

test('#1065 collector finishes all pages and rereads the issue before returning', () => {
  const calls = [];
  const s = collectIssueSource({ repo, number: 7, now: () => at, api: (endpoint, paginated) => {
    calls.push([endpoint, paginated]);
    return paginated ? [[comments()[0]], [comments()[1]]] : issue();
  } });
  assert.deepEqual(calls, [[`repos/${repo}/issues/7`, undefined],
    [`repos/${repo}/issues/7/comments?per_page=100`, true], [`repos/${repo}/issues/7`, undefined]]);
  assert.equal(s.boundary.pageCount, 2);
});

test('#1065 context cannot substitute body, material, selected handoff or checked preflight', () => {
  const s = source(), p = packet(), prep = prepared();
  const rejects = [
    { sha: tree }, { tree: sha }, { prepared: { ...prep, material_issue_body: 'f'.repeat(64) } },
    { prepared: { ...prep, handoff_snapshot: 'different' } },
    { packet: { ...p, preflight: { ...p.preflight, ok: false } } },
    { packet: { ...p, preflight: { ...p.preflight, semanticApproval: true } } },
    { packet: { ...p, sources: [{ ...s, comments: [{ ...s.comments[0], body: 'edited' }, s.comments[1]] }] } },
    { packet: { ...p, sources: [{ ...s, ownerCommentIds: [] }] } },
    { packet: { ...p, sources: [{ ...s, boundary: { ...s.boundary, pageCounts: [3] } }] } },
  ];
  for (const change of rejects) assert.throws(() => checkedReviewContext({ prepared: prep, packet: p, sha, tree, ...change }));
});

test('#1065 spec context retains owner history but does not make author handoff its basis', () => {
  const context = read(source(), 'spec');
  assert.equal(context.handoff, null);
  assert.equal(context.sourceContext[0].handoff.body, handoff, 'full historical text is not silently removed');
  assert.equal(context.ciEvidence.result, 'skipped');
});

test('#1065 checked preflight captures the same source without replacing validation authority', () => {
  const data = { issue: 7, repo, stage: 'code', track: 'ask', sha, tree, bodyDigest: issueBodyDigest(issue().body),
    contextOutput: 'external-context.json' };
  const collected = collectReviewInput(data, { api: (endpoint) => endpoint.endsWith('/comments') ? [comments()] : issue(),
    git: args => args[0] === 'rev-parse' ? (args[1] === 'HEAD' ? sha : tree)
      : args[0] === 'merge-base' ? 'c'.repeat(40) : args[0] === 'rev-list' ? sha
        : args[0] === 'show' ? 'fix\n\nIssue: #7\nUser-Visible: no' : 'scripts/change.mjs' });
  const checked = checkReviewInput(collected, { ledgerReader: () => ({}) });
  assert.equal(checked.ok, true);
  assert.equal(checked.semanticApproval, false);
  assert.equal(collected.sourceContext.handoff.id, checked.identity.handoff.id);
  assert.equal(collected.sourceContext.issue.bodyDigest, checked.identity.bodyDigest);
});

test('#1065 real file rendering preserves exact JSON/hash and complete readable Unicode pages', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-review-context-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const long = 'BEGIN\n' + '😀тест'.repeat(7000) + '\nEND';
  const s = source({ pages: [[comments()[0], comment(2, long)]] });
  const output = join(dir, 'context.json');
  const written = writeReviewContext({ output, context: read(s) });
  const exact = JSON.parse(readFileSync(written.sources.exactJson, 'utf8'));
  assert.equal(exact[0].comments[1].body, long);
  assert.ok(written.sources.readablePages.length > 1);
  for (const row of written.sources.manifest) {
    const bytes = readFileSync(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    assert.ok(!bytes.toString('utf8').includes('\ufffd'), 'no split surrogate/UTF-8 replacement');
  }
  const visible = written.sources.readablePages.map(path => readFileSync(path, 'utf8')).join('\n');
  assert.match(visible, /BEGIN/); assert.match(visible, /END/);
  assert.equal((visible.match(/😀/g) || []).length, 7000);
  assert.throws(() => writeReviewContext({ output, context: read(s) }), /exist/i, 'old output cannot silently mix with new snapshot');
});

test('#1065 batch context preserves membership boundary and never invents a CI success', () => {
  for (const kind of ['ship', 'release']) {
    const p = sourceContextPacket({ kind, sha, tree, sources: kind === 'ship' ? [source()] : [],
      readFacts: kind === 'release' ? { membership: { candidate: sha, issues: [{ number: 7 }] }, brief: 'Line facts' } : null });
    const c = checkedReviewContext({ packet: p, sha, tree,
      changedFiles: ['src/widget.ts', 'docs/reviews/CODE-REVIEW-7-r1.md', 'docs/specs/task.md'] });
    assert.equal(c.kind, kind);
    assert.equal(c.sourceContext.length, kind === 'ship' ? 1 : 0);
    assert.equal(c.ciEvidence.result, 'not-supplied');
    if (kind === 'release') assert.deepEqual(c.fullHunkReads, ['src/widget.ts']);
  }
  assert.throws(() => sourceContextPacket({ kind: 'release', sha, tree, sources: [source(), source()] }), /sources/);
  assert.throws(() => sourceContextPacket({ kind: 'release', sha, tree, sources: [source()],
    readFacts: { membership: { candidate: sha } } }), /author sources/);
  const other = issueSourceContext({ repo, number: 8, snapshot: { ...issue(), number: 8,
    html_url: 'https://github.com/owner/repo/issues/8', comments: 0 }, pages: [], startedAt: at });
  const selected = batchSourceContext({ kind: 'ship', sha, tree, base: sha, sources: [source(), other], issueNumbers: [8] });
  assert.deepEqual(selected.sources.map(row => row.issue.number), [8], 'covered/nonmember issue is not injected into selected batch');
  assert.equal(selected.base, sha);
  assert.throws(() => batchSourceContext({ kind: 'ship', sha, tree, sources: [source()], issueNumbers: [8] }), /missing/);
  assert.throws(() => batchSourceContext({ kind: 'ship', sha, tree, sources: [source()], issueNumbers: [7, 7] }), /membership/);
});

test('#1065 actual context CLI binds current Git material and emits both task and independent line inputs', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-review-context-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const currentSha = git(['rev-parse', 'HEAD']), currentTree = git(['rev-parse', 'HEAD^{tree}']);
  const script = fileURLToPath(new URL('../scripts/review-context.mjs', import.meta.url));
  for (const kind of ['task', 'release']) {
    const input = join(dir, `${kind}-input.json`), output = join(dir, `${kind}-context.json`);
    const prep = { ...prepared(), material_sha: currentSha, material_tree: currentTree };
    const p = kind === 'task' ? { ...packet(), sha: currentSha, tree: currentTree, base: currentSha,
      preflight: { ...packet().preflight, identity: { ...packet().preflight.identity, sha: currentSha, tree: currentTree } } }
      : sourceContextPacket({ kind, sha: currentSha, tree: currentTree, base: currentSha, sources: [],
        readFacts: { membership: { candidate: currentSha, issues: [{ number: 7 }] }, brief: 'Independent line facts' } });
    writeFileSync(input, JSON.stringify(p));
    const args = [script, `--kind=${kind}`, `--sha=${currentSha}`, `--input=${input}`, `--output=${output}`];
    if (kind === 'task') {
      const preparedPath = join(dir, 'prepared.json');
      writeFileSync(preparedPath, JSON.stringify(prep));
      args.push(`--prepared=${preparedPath}`);
    }
    const ran = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
    assert.equal(ran.status, 0, ran.stderr);
    const rendered = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(rendered.material.sha, currentSha);
    assert.equal(rendered.material.tree, currentTree);
    assert.equal(rendered.verdictAuthority, false);
    const copied = JSON.parse(readFileSync(rendered.sources.exactJson, 'utf8'));
    if (kind === 'task') assert.equal(copied[0].comments[1].body, comments()[1].body);
    else {
      assert.equal(copied.membership.candidate, currentSha);
      assert.ok(!JSON.stringify(rendered).includes(handoff));
    }
    const staleArgs = args.map(arg => arg === `--input=${input}` ? `--input=${input}.stale` : arg);
    writeFileSync(`${input}.stale`, JSON.stringify({ ...p, tree: currentTree === tree ? sha : tree }));
    assert.equal(spawnSync(process.execPath, staleArgs, { cwd, encoding: 'utf8' }).status, 2,
      'stale material is rejected, not repaired by the context writer');
  }
});
