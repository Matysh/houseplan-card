#!/usr/bin/env node
// Privileged publication of an already validated/sealed review, never model authority.
import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalCallJson } from './review-call-digest.mjs';
import { outsideFindingsProblems, readFindingsPolicy } from './review-findings-policy.mjs';
import { reviewResultProblems, verdictProblems } from './review-result-gate.mjs';
import { ANCHOR_MARKER } from './review-doc-guard.mjs';
import { isMainModule } from './spawn-portable.mjs';

const SCHEMA = 'houseplan-review-publication/v1';
const PREFIX = 'hp:review-publication';
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonicalCallJson(value)).digest('hex');
const positive = n => Number.isSafeInteger(n) && n > 0;
const sha = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);
const same = (a, b) => canonicalCallJson(a) === canonicalCallJson(b);
const fail = message => { throw new Error(`review publication: ${message}`); };

export function publicationPlan({ files, read, expected, spent, limit, routing = '' }) {
  const errors = reviewResultProblems({ files, read, expected });
  if (errors.length) fail('sealed result is not valid: ' + errors.join('; '));
  const prepared = JSON.parse(read('prepared.json')), verdict = JSON.parse(read('verdict.json'));
  const identity = { repo: expected.repo, issue: Number(prepared.issue), stage: prepared.stage,
    round: Number(prepared.cycle), material: prepared.material_sha, tree: prepared.material_tree,
    bodyDigest: prepared.material_issue_body,
    producerRun: String(prepared.run_id), producerAttempt: String(prepared.run_attempt) };
  if (!/^[\w.-]+\/[\w.-]+$/.test(identity.repo) || !positive(identity.issue)
    || !positive(identity.round) || !['code', 'spec'].includes(identity.stage)
    || !sha(identity.material) || !sha(identity.tree) || !/^[a-f0-9]{64}$/.test(identity.bodyDigest || '') || !/^\d+$/.test(identity.producerRun)
    || !/^[1-9]\d*$/.test(identity.producerAttempt)) fail('invalid trusted identity');
  if (!Number.isSafeInteger(spent) || spent < 0 || !positive(limit) || spent > limit
    || typeof routing !== 'string' || Buffer.byteLength(routing) > 262144) fail('invalid trusted routing');
  const policy = readFindingsPolicy(prepared.findings_policy_snapshot, { repo: identity.repo,
    issue: identity.issue, stage: identity.stage, round: identity.round });
  const reportDigest = digest(read('review-document.md')), verdictDigest = digest(read('verdict.json'));
  const verdictCanonicalDigest = digest(verdict);
  const key = digest({ schema: SCHEMA, ...identity, reportDigest, verdictDigest, verdictCanonicalDigest });
  return { schema: SCHEMA, key, identity, reportDigest, verdictDigest, verdictCanonicalDigest, policy,
    verdict, spent, limit, routing,
    document: `docs/reviews/${identity.stage === 'spec' ? 'SPEC' : 'CODE'}-REVIEW-${identity.issue}-r${identity.round}.md` };
}

function marker(record) { return `<!-- ${PREFIX} ${Buffer.from(JSON.stringify(record)).toString('base64url')} -->`; }
const footer = (payload, record) => `${payload}\n\n${marker({ ...record, bodyDigest: digest(payload) })}`;
function records(rows) {
  const out = [];
  for (const row of rows) {
    const body = String(row.body || '');
    // Only the generated terminal footer binds this exact preceding payload.
    // Quotes/examples/protocol markers elsewhere in human/model prose are data.
    const match = new RegExp(`\\n\\n<!-- ${PREFIX} ([A-Za-z0-9_-]+) -->\\n?$`).exec(body);
    if (!match) continue;
    let record;
    try { record = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); }
    catch { fail('malformed publication marker'); }
    if (record?.schema !== SCHEMA || !/^[a-f0-9]{64}$/.test(record.key || '')) fail('unknown publication marker');
    if (record.bodyDigest !== digest(body.slice(0, match.index))) fail('publication footer payload changed');
    const { bodyDigest: _bodyDigest, ...bound } = record;
    record = bound;
    const expectedKey = digest({ schema: SCHEMA, ...record.identity, reportDigest: record.reportDigest,
      verdictDigest: record.verdictDigest, verdictCanonicalDigest: record.verdictCanonicalDigest });
    if (expectedKey !== record.key) fail('publication marker identity hash changed');
    out.push({ row, record });
  }
  return out;
}
const owner = (row, actor) => row?.user?.id === actor.id;
function requireSingle(rows, actor, expected, type) {
  const hits = records(rows.filter(row => owner(row, actor))).filter(x => x.record.key === expected.key && x.record.type === type
    && (type !== 'finding' || x.record.localId === expected.localId));
  if (hits.length > 1) fail('duplicate publication identity');
  if (!hits.length) return null;
  const hit = hits[0];
  if (!owner(hit.row, actor) || !same(hit.record, expected)) fail('foreign or changed publication identity');
  return hit.row;
}
function identityRecord(plan, type) {
  return { schema: SCHEMA, type, key: plan.key, identity: plan.identity,
    reportDigest: plan.reportDigest, verdictDigest: plan.verdictDigest, verdictCanonicalDigest: plan.verdictCanonicalDigest };
}
function assertPlan(plan) {
  if (plan?.schema !== SCHEMA || !plan.identity || !sha(plan.identity.material)
    || !sha(plan.identity.tree) || !positive(plan.identity.issue) || !positive(plan.identity.round)
    || !/^[\w.-]+\/[\w.-]+$/.test(plan.identity.repo)) fail('invalid plan');
  const expected = digest({ schema: SCHEMA, ...plan.identity, reportDigest: plan.reportDigest,
    verdictDigest: plan.verdictDigest, verdictCanonicalDigest: plan.verdictCanonicalDigest });
  if (plan.key !== expected || digest(plan.verdict) !== plan.verdictCanonicalDigest) fail('changed plan identity');
  const problems = outsideFindingsProblems(plan.verdict?.outside_findings, plan.policy);
  if (problems.length) fail(problems.join('; '));
}
function findingRecord(plan, finding) {
  return { ...identityRecord(plan, 'finding'), localId: finding.id, payloadDigest: digest(finding) };
}
function findingBody(plan, finding, record) {
  return footer(`${finding.body}\n\nSource: #${plan.identity.issue}, ${plan.identity.stage} r${plan.identity.round}, material \`${plan.identity.material}\`.`, record);
}
function validateCreated(row, actor, expectedBody, urlPrefix) {
  if (!positive(row?.id) || !owner(row, actor) || row.body !== expectedBody
    || typeof row.html_url !== 'string' || !row.html_url.startsWith(urlPrefix)) fail('created object was not authenticated');
  return row;
}

/** All operations are injected for inert tests. An uncertain write stops; no retry loop. */
export async function publishReview(plan, ops) {
  assertPlan(plan);
  const actor = await ops.actor();
  if (!positive(actor?.id)) fail('publisher identity unavailable');
  const { repo, issue } = plan.identity;
  let comments = await ops.comments(issue);
  const pending = identityRecord(plan, 'pending');
  if (!requireSingle(comments, actor, pending, 'pending')) {
    const body = footer(`Публикация запечатанного ревью #${issue}: ${plan.identity.stage} r${plan.identity.round}. До завершения публикации новый вызов модели не требуется.`, pending);
    const row = validateCreated(await ops.createComment(issue, body), actor, body, `https://github.com/${repo}/issues/${issue}#issuecomment-`);
    comments = [...comments, row];
  }
  const mapping = [];
  let issues = plan.verdict.outside_findings?.length ? await ops.issues() : [];
  for (const finding of plan.verdict.outside_findings || []) {
    const record = findingRecord(plan, finding);
    let row = requireSingle(issues, actor, record, 'finding');
    if (!row) {
      if (issues.some(i => !i.pull_request && i.title?.trim().toLowerCase() === finding.title.trim().toLowerCase()))
        fail(`possible pre-existing duplicate for ${finding.id}; explicit resolution required`);
      const body = findingBody(plan, finding, record);
      row = validateCreated(await ops.createIssue({ title: finding.title, body, labels: [finding.kind || 'bug', 'P2', 'S1-new'] }), actor, body, `https://github.com/${repo}/issues/`);
      if (!positive(row.number)) fail('created finding has no issue number');
      issues = [...issues, row];
    }
    if (row.title !== finding.title || row.body !== findingBody(plan, finding, record)) fail('published finding text changed');
    mapping.push({ id: finding.id, issue: row.number, url: row.html_url, payloadDigest: record.payloadDigest,
      bodyDigest: digest(row.body), titleDigest: digest(row.title) });
  }
  const complete = { ...identityRecord(plan, 'complete'), findings: mapping };
  let comment = requireSingle(comments, actor, complete, 'complete');
  const heading = `Вердикт: ${{ green: 'зелёный', yellow: 'жёлтый', red: 'красный' }[plan.verdict.verdict]} · заход r${plan.identity.round} · блокирующих циклов ${plan.spent}/${plan.limit} · High: ${plan.verdict.high} · Medium: ${plan.verdict.medium} · Документ: ${plan.document}`;
  const links = mapping.length ? '\n\nПобочные находки: ' + mapping.map(m => `${m.id} → [#${m.issue}](${m.url})`).join('; ') : '';
  const body = footer(`${heading}\n\n${plan.verdict.summary}${plan.routing ? '\n\n' + plan.routing : ''}${links}`, complete);
  if (!comment) comment = validateCreated(await ops.createComment(issue, body), actor, body, `https://github.com/${repo}/issues/${issue}#issuecomment-`);
  else if (comment.body !== body) fail('existing canonical comment changed');
  const receipt = { ...complete, comment: { id: comment.id, url: comment.html_url, bodyDigest: digest(body) } };
  await verifyReviewPublication(receipt, ops);
  return receipt;
}

/** Read-only completion gate; used before reuse/forward transitions. */
export async function verifyReviewPublication(receipt, ops, expectedIdentity = {}) {
  if (receipt?.schema !== SCHEMA || receipt.type !== 'complete' || !receipt.comment) fail('publication is not complete');
  for (const [key, value] of Object.entries(expectedIdentity))
    if (receipt.identity?.[key] !== value) fail('publication belongs to another review');
  const actor = await ops.actor(), comments = await ops.comments(receipt.identity.issue);
  const { comment, ...expected } = receipt;
  const row = requireSingle(comments, actor, expected, 'complete');
  if (!row || row.id !== comment.id || row.html_url !== comment.url || digest(row.body) !== comment.bodyDigest) fail('canonical comment missing or changed');
  const issues = receipt.findings.length ? await ops.issues() : [];
  for (const finding of receipt.findings) {
    const row = issues.find(i => i.number === finding.issue);
    if (!row || !owner(row, actor) || row.html_url !== finding.url
      || digest(row.body) !== finding.bodyDigest || digest(row.title) !== finding.titleDigest) fail('published finding missing, changed or foreign');
    const record = { ...identityRecord(receipt, 'finding'), localId: finding.id, payloadDigest: finding.payloadDigest };
    if (!requireSingle([row], actor, record, 'finding')) fail('published finding receipt missing');
  }
  return true;
}

/** A new model call cannot repair a known pending/partial publication. */
export async function assertNoReviewPublication({ issue, stage, material, bodyDigest, publisherId }, ops) {
  const id = publisherId ?? (await ops.actor()).id;
  if (!positive(id)) fail('trusted publication identity is missing');
  const found = records((await ops.comments(issue)).filter(row => row.user?.id === id)).filter(({ record }) => record.identity?.issue === issue
    && record.identity.stage === stage && record.identity.material === material
    && (bodyDigest === undefined || record.identity.bodyDigest === bodyDigest));
  if (found.length) fail('this material already has a publication record; resume/verify its original sealed result, do not rerun the model');
  return true;
}

export function publicationReference(receipt, payload = '') {
  if (receipt?.type !== 'complete') fail('cannot reference incomplete publication');
  const bound = { schema: 'houseplan-review-document-publication/v1', payloadDigest: digest(payload), receipt };
  return `<!-- hp:review-publication-receipt ${Buffer.from(JSON.stringify(bound)).toString('base64url')} -->`;
}
export function publicationReceiptFromDocument(document) {
  const text = String(document), at = text.indexOf(ANCHOR_MARKER);
  const prefix = (at < 0 ? text : text.slice(0, at)).trimEnd();
  const match = /\n\n<!-- hp:review-publication-receipt ([A-Za-z0-9_-]+) -->$/.exec(prefix);
  if (!match) return null; // Legacy documents and literal protocol examples are data.
  let bound;
  try { bound = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); }
  catch { fail('malformed document publication receipt'); }
  if (bound?.schema !== 'houseplan-review-document-publication/v1'
    || bound.payloadDigest !== digest(prefix.slice(0, match.index))) fail('document publication payload changed');
  return bound.receipt;
}

function boundedText(path) {
  const absolute = resolve(path), max = 4 * 1024 * 1024;
  if (realpathSync(absolute) !== absolute) fail('artifact input is not a canonical file');
  const fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > max) fail('artifact input exceeds its file bound');
    const bytes = Buffer.alloc(max + 1);
    let length = 0, n;
    while (length < bytes.length && (n = readSync(fd, bytes, length, bytes.length - length, null))) length += n;
    const after = fstatSync(fd);
    if (length > max || after.size !== before.size || length !== after.size) fail('artifact input changed or exceeds its bound');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally { closeSync(fd); }
}

export function readPublicationArtifact(directory) {
  const dir = resolve(directory);
  if (realpathSync(dir) !== dir) fail('artifact directory is not canonical');
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.length > 5 || entries.some(e => !e.isFile())) fail('artifact contains a non-file or excess entry');
  const data = Object.fromEntries(entries.map(e => [e.name, boundedText(resolve(dir, e.name))]));
  return { files: Object.keys(data), read: name => data[name] };
}

function realOps(repo) {
  const api = (endpoint, method = 'GET', payload) => {
    try {
      const args = ['api', endpoint, '--method', method];
      if (payload) args.push('--input', '-');
      return JSON.parse(execFileSync('gh', args, { input: payload ? JSON.stringify(payload) : undefined,
        encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
    } catch { fail('API operation failed or write outcome unknown; reconcile before retry'); }
  };
  const pages = endpoint => {
    const out = []; let bytes = 0;
    for (let page = 1; page <= 100; page++) {
      const rows = api(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Array.isArray(rows)) fail('API pagination shape');
      bytes += Buffer.byteLength(JSON.stringify(rows));
      if (bytes > 8 * 1024 * 1024) fail('API pagination exceeds its aggregate bound');
      out.push(...rows);
      if (rows.length < 100) return out;
    }
    fail('API pagination bound exceeded');
  };
  return { actor: () => api('user'), comments: issue => pages(`repos/${repo}/issues/${issue}/comments`),
    issues: () => pages(`repos/${repo}/issues?state=all`),
    createComment: (issue, body) => api(`repos/${repo}/issues/${issue}/comments`, 'POST', { body }),
    createIssue: payload => api(`repos/${repo}/issues`, 'POST', payload) };
}

if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(v => v.startsWith(`--${key}=`))?.slice(key.length + 3);
  try {
    const mode = process.argv[2], repo = process.env.REPO;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) fail('trusted repository required');
    if (mode === 'publish') {
      const dir = arg('dir'), expected = JSON.parse(boundedText(arg('expected')));
      if (expected.repo !== repo) fail('verified result repository changed');
      const plan = publicationPlan({ ...readPublicationArtifact(dir), expected,
        spent: Number(process.env.SPENT), limit: Number(process.env.LIMIT), routing: arg('routing') ? readFileSync(arg('routing'), 'utf8') : '' });
      const receipt = await publishReview(plan, realOps(repo));
      writeFileSync(arg('output'), JSON.stringify(receipt) + '\n');
      console.log('review publication complete');
    } else if (mode === 'validate-verdict') {
      const policy = readFindingsPolicy(process.env.FINDINGS_POLICY_SNAPSHOT, { repo,
        issue: Number(process.env.NUM), stage: process.env.STAGE, round: Number(process.env.CYCLE) });
      const errors = verdictProblems(JSON.parse(readFileSync(arg('verdict'), 'utf8')), policy);
      if (errors.length) fail(errors.join('; '));
    } else if (mode === 'verify') {
      const receipt = publicationReceiptFromDocument(readFileSync(arg('document'), 'utf8'));
      if (receipt) await verifyReviewPublication(receipt, realOps(repo), { repo,
        ...(process.env.NUM ? { issue: Number(process.env.NUM) } : {}),
        ...(process.env.STAGE ? { stage: process.env.STAGE } : {}) });
      else if (process.env.MATERIAL_SHA) await assertNoReviewPublication({ issue: Number(process.env.NUM),
        stage: process.env.STAGE, material: process.env.MATERIAL_SHA, bodyDigest: process.env.MATERIAL_ISSUE_BODY || undefined }, realOps(repo));
      console.log(receipt ? 'review publication verified' : 'legacy review document has no publication receipt');
    } else if (mode === 'assert-no-pending') {
      await assertNoReviewPublication({ issue: Number(process.env.NUM), stage: process.env.STAGE,
        material: process.env.MATERIAL_SHA, bodyDigest: process.env.MATERIAL_ISSUE_BODY || undefined,
        publisherId: Number(process.env.REVIEW_PUBLISHER_ID) }, realOps(repo));
    } else if (mode === 'attach') {
      const path = arg('document'), receipt = JSON.parse(readFileSync(arg('receipt'), 'utf8'));
      const body = readFileSync(path, 'utf8');
      const at = body.indexOf(ANCHOR_MARKER), prefix = (at < 0 ? body : body.slice(0, at)).trimEnd();
      const reference = publicationReference(receipt, prefix);
      writeFileSync(path, at < 0 ? `${prefix}\n\n${reference}\n`
        : `${prefix}\n\n${reference}\n\n${body.slice(at)}`);
    } else fail('unknown operation');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
