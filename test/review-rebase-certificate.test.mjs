import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { certificateDigest, certificateAnchor, validReviewRebaseCertificate,
  loadReviewRebaseCertificate } from '../scripts/review-rebase-certificate.mjs';

const repo = 'Matysh/houseplan-card', controller = 'a'.repeat(40);
const certificate = () => ({ schema: 'houseplan-review-rebase/v1', repo, issue: 1068, run_id: 12, run_attempt: 2,
  doc: 'docs/reviews/CODE-REVIEW-1068-r1.md', document_digest: '1'.repeat(64), base: 'b'.repeat(40),
  material: 'c'.repeat(40), tree: 'd'.repeat(40), body: '2'.repeat(64), raw_delta: '3'.repeat(64),
  normalized_delta: '4'.repeat(64), policy: '5'.repeat(64), verdict: 'green', high: 0 });
const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
function zip(value, { name = 'certificate.json', deflate = false, count = 1, inflatedSize } = {}) {
  const raw = Buffer.from(JSON.stringify(value)), body = deflate ? deflateRawSync(raw) : raw, filename = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
  local.writeUInt16LE(deflate ? 8 : 0, 8); local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(inflatedSize ?? raw.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(deflate ? 8 : 0, 10); central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(inflatedSize ?? raw.length, 24); central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(local.length + filename.length + body.length, 16);
  return Buffer.concat([local, filename, body, central, filename, end]);
}
function fixture() {
  const cert = certificate(), bytes = zip(cert);
  const run = { id: 12, run_attempt: 2, path: '.github/workflows/process.yml', head_sha: controller,
    head_branch: 'main', event: 'issues', status: 'completed', conclusion: 'failure',
    repository: { full_name: repo }, head_repository: { full_name: repo },
    referenced_workflows: [{ path: `${repo}/.github/workflows/_process.yml@dev`, ref: 'refs/heads/dev', sha: 'e'.repeat(40) }] };
  const success = (name, number, start, end) => ({ name, number, status: 'completed', conclusion: 'success',
    started_at: `2026-10-25T12:00:${start}Z`, completed_at: `2026-10-25T12:00:${end}Z` });
  const job = { id: 100, run_id: 12, name: 'dev / Ревью: публикация и интеграция', status: 'completed', conclusion: 'failure',
    steps: [success('Проверить полноту и происхождение результата', 10, '00', '05'),
      success('Опубликовать документ ревью', 11, '06', '20'), success('Retain authenticated counter rebase certificate', 12, '21', '25'),
      { name: 'Слить ветку в dev', number: 13, status: 'completed', conclusion: 'failure' }] };
  const artifact = { id: 99, name: 'review-rebase-1068-12-2', expired: false, size_in_bytes: bytes.length,
    digest: digest(bytes), created_at: '2026-10-25T12:00:23Z', workflow_run: { id: 12, head_sha: controller },
    archive_download_url: 'https://untrusted.invalid/must-not-forward-token' };
  return { cert, bytes, run, latest: structuredClone(run), jobs: { total_count: 1, jobs: [job] },
    artifacts: { total_count: 1, artifacts: [artifact] }, calls: [],
    options: { repo, issue: 1068, anchor: certificateAnchor(cert), documentDigest: cert.document_digest, body: cert.body,
      token: 'fixture-token', apiBase: 'https://api.github.com' } };
}
function fetcher(f) {
  return async (url, options) => {
    f.calls.push(url); assert.ok(url.startsWith(`https://api.github.com/repos/${repo}/`));
    assert.equal(options.headers.Authorization, 'Bearer fixture-token'); assert.ok(options.signal);
    const path = url.split(`/repos/${repo}/`)[1];
    if (path === 'actions/artifacts/99/zip') return { ok: true, arrayBuffer: async () => f.bytes };
    const value = path === 'actions/runs/12' ? f.latest : path === 'actions/runs/12/attempts/2' ? f.run
      : path.includes('/jobs?') ? f.jobs : path.includes('/artifacts?') ? f.artifacts : null;
    assert.ok(value, path); return { ok: true, json: async () => value };
  };
}
const load = f => loadReviewRebaseCertificate({ ...f.options, fetchImpl: fetcher(f) });

test('#1068 certificate shape and digest bind every sealed field, independent of JSON property order', () => {
  const cert = certificate(); assert.equal(validReviewRebaseCertificate(cert), true);
  assert.equal(certificateDigest(Object.fromEntries(Object.entries(cert).reverse())), certificateDigest(cert));
  for (const change of [{ issue: 1 }, { run_attempt: '2' }, { verdict: 'red' }, { high: 1 }, { extra: 'unknown' },
    { material: 'bad' }, { policy: {} }, { doc: 'docs/reviews/CODE-REVIEW-1068-rundefined.md' }])
    assert.throws(() => certificateDigest({ ...cert, ...change }), /invalid/);
  for (const field of ['document_digest', 'body', 'raw_delta', 'normalized_delta', 'policy'])
    assert.notEqual(certificateDigest({ ...cert, [field]: 'f'.repeat(64) }), certificateDigest(cert));
});

test('#1068 actual trusted publisher artifact survives a later failed merge without treating controller SHA as material', async () => {
  for (const deflate of [false, true]) {
    const f = fixture(); f.bytes = zip(f.cert, { deflate });
    Object.assign(f.artifacts.artifacts[0], { digest: digest(f.bytes), size_in_bytes: f.bytes.length });
    assert.deepEqual(await load(f), f.cert);
    assert.equal(f.calls.length, 6, 'bounded four metadata calls, one artifact, one latest-attempt recheck');
    assert.notEqual(f.cert.material, f.run.head_sha);
  }
});

for (const [name, mutate] of Object.entries({
  'foreign repository': f => { f.run.repository.full_name = 'foreign/repo'; },
  'candidate workflow branch': f => { f.run.head_branch = 'issue/1068-forged'; },
  'untrusted reusable ref': f => { f.run.referenced_workflows[0].ref = 'refs/heads/issue/1068-forged'; },
  'unattested reusable workflow': f => { f.run.referenced_workflows = []; },
  'newer attempt': f => { f.latest.run_attempt = 3; },
  'model job instead of publisher': f => { f.jobs.jobs[0].name = 'dev / Ревью: работа модели'; },
  'ambiguous publisher': f => { f.jobs.jobs.push(structuredClone(f.jobs.jobs[0])); f.jobs.total_count++; },
  'failed result seal': f => { f.jobs.jobs[0].steps[0].conclusion = 'failure'; },
  'skipped upload': f => { f.jobs.jobs[0].steps[2].conclusion = 'skipped'; },
  'model preupload with successful empty publisher upload': f => { f.artifacts.artifacts[0].created_at = '2026-10-25T12:00:10Z'; },
  'artifact from another controller SHA': f => { f.artifacts.artifacts[0].workflow_run.head_sha = 'f'.repeat(40); },
  'expired artifact': f => { f.artifacts.artifacts[0].expired = true; },
  'duplicate artifact': f => { f.artifacts.artifacts.push(structuredClone(f.artifacts.artifacts[0])); f.artifacts.total_count++; },
  'truncated jobs': f => { f.jobs.total_count++; },
  'wrong archive digest': f => { f.artifacts.artifacts[0].digest = 'sha256:' + 'f'.repeat(64); },
  'changed review prose': f => { f.options.documentDigest = 'f'.repeat(64); },
  'changed issue body': f => { f.options.body = 'f'.repeat(64); },
  'forged Markdown anchor': f => { f.options.anchor.digest = 'f'.repeat(64); },
})) test('#1068 certificate refuses ' + name, async () => {
  const f = fixture(); mutate(f); assert.equal(await load(f), null); assert.ok(f.calls.length <= 6);
});

test('#1068 certificate refuses extra, renamed, oversized and malformed ZIP entries', async () => {
  for (const options of [{ name: '../certificate.json' }, { count: 2 }, { inflatedSize: 17000 }, { name: 'proof.json' }]) {
    const f = fixture(); f.bytes = zip(f.cert, options);
    Object.assign(f.artifacts.artifacts[0], { digest: digest(f.bytes), size_in_bytes: f.bytes.length });
    assert.equal(await load(f), null);
  }
});

test('#1068 a shared deadline bounds stalled fetch and body parsing without optimistic reuse', async () => {
  for (const bodyStall of [false, true]) {
    const f = fixture(); const signals = []; const started = Date.now();
    const fetchImpl = async (_url, options) => {
      signals.push(options.signal);
      if (bodyStall) return { ok: true, json: () => new Promise(() => {}) };
      return new Promise(() => {});
    };
    assert.equal(await loadReviewRebaseCertificate({ ...f.options, fetchImpl, deadline: Date.now() + 30 }), null);
    assert.ok(Date.now() - started < 1000); assert.ok(signals.every(signal => signal.aborted));
  }
});
