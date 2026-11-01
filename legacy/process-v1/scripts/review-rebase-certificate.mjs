// #1068: Markdown is a locator; only the trusted integrate publisher grants reuse.
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const SCHEMA = 'houseplan-review-rebase/v1';
const MAX_ARCHIVE = 256 * 1024, MAX_CERTIFICATE = 16 * 1024;
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const canonical = value => JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])));
const hash = value => createHash('sha256').update(value).digest('hex');
const fields = ['schema', 'repo', 'issue', 'run_id', 'run_attempt', 'doc', 'document_digest',
  'base', 'material', 'tree', 'body', 'raw_delta', 'normalized_delta', 'policy', 'verdict', 'high'].sort();
export function validReviewRebaseCertificate(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(fields)
    && value.schema === SCHEMA && /^[\w.-]+\/[\w.-]+$/.test(value.repo || '')
    && [value.issue, value.run_id, value.run_attempt].every(positive)
    && new RegExp(`^docs/reviews/CODE-REVIEW-${value.issue}-r[1-9]\\d*\\.md$`).test(value.doc || '')
    && ['base', 'material', 'tree'].every(key => hex(value[key], 40))
    && ['document_digest', 'body', 'raw_delta', 'normalized_delta', 'policy'].every(key => hex(value[key], 64))
    && value.verdict === 'green' && value.high === 0);
}
export function certificateDigest(certificate) {
  if (!validReviewRebaseCertificate(certificate)) throw Error('invalid review rebase certificate');
  return hash(canonical(certificate));
}
export const certificateAnchor = certificate => ({ run_id: certificate.run_id,
  run_attempt: certificate.run_attempt, digest: certificateDigest(certificate) });

/** Only a single regular certificate.json; bounded inflation, no filesystem extraction. */
function readCertificateZip(bytes) {
  if (bytes.length < 22 || bytes.length > MAX_ARCHIVE) throw Error('invalid certificate archive size');
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--)
    if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) { end = at; break; }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)
    || bytes.readUInt16LE(end + 8) !== 1 || bytes.readUInt16LE(end + 10) !== 1) throw Error('certificate archive must contain one file');
  const size = bytes.readUInt32LE(end + 12), at = bytes.readUInt32LE(end + 16);
  if (at + size !== end || size < 46 || bytes.readUInt32LE(at) !== 0x02014b50) throw Error('invalid certificate directory');
  const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10);
  const compressed = bytes.readUInt32LE(at + 20), length = bytes.readUInt32LE(at + 24);
  const nameLength = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32);
  const mode = (bytes.readUInt32LE(at + 38) >>> 16) & 0xf000;
  const local = bytes.readUInt32LE(at + 42), name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
  if (name !== 'certificate.json' || 46 + nameLength + extra + comment !== size || flags & 1
    || ![0, 8].includes(method) || length < 1 || length > MAX_CERTIFICATE || ![0, 0x8000].includes(mode)
    || local !== 0 || bytes.readUInt32LE(local) !== 0x04034b50) throw Error('invalid certificate entry');
  const localName = bytes.readUInt16LE(local + 26), localExtra = bytes.readUInt16LE(local + 28);
  const start = local + 30 + localName + localExtra;
  if (bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 6) !== flags
    || bytes.subarray(local + 30, local + 30 + localName).toString('utf8') !== name
    || start + compressed > at) throw Error('invalid local certificate entry');
  const body = method === 0 ? bytes.subarray(start, start + compressed)
    : inflateRawSync(bytes.subarray(start, start + compressed), { maxOutputLength: MAX_CERTIFICATE });
  if (body.length !== length) throw Error('invalid certificate body size');
  return JSON.parse(body.toString('utf8'));
}

/** One deadline covers API, download and parsing; any incomplete evidence means no reuse. */
export async function loadReviewRebaseCertificate({ repo, issue, anchor, documentDigest, body,
  token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN, fetchImpl = fetch,
  apiBase = process.env.GITHUB_API_URL || 'https://api.github.com', deadline = Date.now() + 8000 } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !positive(issue) || !positive(anchor?.run_id)
    || !positive(anchor?.run_attempt) || !hex(anchor?.digest, 64) || !hex(documentDigest, 64) || !hex(body, 64)
    || !token || !Number.isFinite(deadline) || deadline <= Date.now()) return null;
  const controller = new AbortController();
  const check = () => { if (controller.signal.aborted || Date.now() >= deadline) throw Error('certificate deadline exceeded'); };
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(Error('certificate deadline exceeded'));
  }, Math.max(1, deadline - Date.now())); });
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
    'User-Agent': 'houseplan-review-rebase', 'X-GitHub-Api-Version': '2022-11-28' };
  const request = async path => {
    check(); const response = await fetchImpl(`${apiBase.replace(/\/+$/, '')}/repos/${repo}/${path}`,
      { headers, signal: controller.signal });
    check(); if (!response.ok) throw Error('certificate API unavailable');
    return response;
  };
  const json = async path => { const value = await (await request(path)).json(); check(); return value; };
  try {
    return await Promise.race([timeout, (async () => {
      const id = anchor.run_id, attempt = anchor.run_attempt, name = `review-rebase-${issue}-${id}-${attempt}`;
      const [run, latest, jobs, artifacts] = await Promise.all([
        json(`actions/runs/${id}/attempts/${attempt}`), json(`actions/runs/${id}`),
        json(`actions/runs/${id}/attempts/${attempt}/jobs?per_page=100`),
        json(`actions/runs/${id}/artifacts?name=${encodeURIComponent(name)}&per_page=100`),
      ]);
      const trustedRun = value => value?.id === id && value.run_attempt === attempt
        && value.repository?.full_name === repo && value.head_repository?.full_name === repo
        && value.path === '.github/workflows/process.yml' && ['main', 'dev'].includes(value.head_branch)
        && ['issues', 'workflow_dispatch'].includes(value.event) && hex(value.head_sha, 40)
        && Array.isArray(value.referenced_workflows) && value.referenced_workflows.filter(workflow =>
          [`${repo}/.github/workflows/_process.yml@dev`, `${repo}/.github/workflows/_process.yml@refs/heads/dev`].includes(workflow.path)
          && workflow.ref === 'refs/heads/dev' && hex(workflow.sha, 40)).length === 1;
      if (!trustedRun(run) || !trustedRun(latest) || latest.head_sha !== run.head_sha
        || !Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length
        || !Array.isArray(artifacts.artifacts) || artifacts.total_count !== artifacts.artifacts.length) return null;
      const publishers = jobs.jobs.filter(job => ['Ревью: публикация и интеграция', 'dev / Ревью: публикация и интеграция'].includes(job.name));
      if (publishers.length !== 1 || publishers[0].run_id !== id || !Array.isArray(publishers[0].steps)) return null;
      const required = ['Проверить полноту и происхождение результата', 'Опубликовать документ ревью',
        'Retain authenticated counter rebase certificate'];
      const steps = required.map(name => publishers[0].steps.filter(step => step.name === name));
      if (steps.some(matches => matches.length !== 1 || matches[0].status !== 'completed' || matches[0].conclusion !== 'success')) return null;
      const upload = steps[2][0], start = Date.parse(upload.started_at), end = Date.parse(upload.completed_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end
        || steps.some(([step]) => !positive(step.number))
        || !(steps[0][0].number < steps[1][0].number && steps[1][0].number < upload.number)) return null;
      const matches = artifacts.artifacts.filter(artifact => artifact.name === name);
      if (matches.length !== 1) return null;
      const artifact = matches[0], created = Date.parse(artifact.created_at);
      if (!positive(artifact.id) || artifact.expired !== false || !positive(artifact.size_in_bytes)
        || artifact.size_in_bytes > MAX_ARCHIVE || artifact.workflow_run?.id !== id
        || artifact.workflow_run.head_sha !== run.head_sha || !Number.isFinite(created) || created < start || created > end
        || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest || '')) return null;
      // Construct the URL ourselves; never forward a token to an artifact-supplied URL.
      const response = await request(`actions/artifacts/${artifact.id}/zip`);
      const chunks = []; let length = 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        try { while (true) {
          const next = await reader.read(); check(); if (next.done) break;
          length += next.value.length; if (length > MAX_ARCHIVE) throw Error('certificate download too large');
          chunks.push(Buffer.from(next.value));
        } } finally { await reader.cancel().catch(() => {}); }
      } else { const bytes = Buffer.from(await response.arrayBuffer()); check(); length = bytes.length; chunks.push(bytes); }
      if (length > MAX_ARCHIVE || length !== artifact.size_in_bytes) return null;
      const bytes = Buffer.concat(chunks), certificate = readCertificateZip(bytes);
      check();
      if ('sha256:' + hash(bytes) !== artifact.digest || !validReviewRebaseCertificate(certificate)
        || certificate.repo !== repo || certificate.issue !== issue || certificate.run_id !== id || certificate.run_attempt !== attempt
        || certificate.document_digest !== documentDigest || certificate.body !== body || certificateDigest(certificate) !== anchor.digest) return null;
      const final = await json(`actions/runs/${id}`);
      check(); return trustedRun(final) && final.head_sha === run.head_sha ? certificate : null;
    })()]);
  } catch { return null; }
  finally { clearTimeout(timer); controller.abort(); }
}
