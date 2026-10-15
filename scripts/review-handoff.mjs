/** #904: syntactic handoff identity, never authorization or semantic approval. */
import { createHash } from 'node:crypto';

export const HANDOFF_FIELDS = Object.freeze([
  ['done', 'Сделано'], ['files', 'Файлы'], ['gates', 'Гейты'],
  ['not-done', 'НЕ сделано'], ['risks', 'Риски'], ['next', 'Следующий статус'],
]);
export const handoffDigest = body => createHash('sha256').update(String(body ?? '')).digest('hex');
export const handoffSnapshot = provenance => Buffer.from(JSON.stringify(provenance ? {
  id: provenance.id, url: provenance.url, createdAt: provenance.createdAt,
  updatedAt: provenance.updatedAt, digest: provenance.digest,
} : null)).toString('base64url');

function withoutExamples(body) {
  const lines = String(body || '').replace(/<!--[^]*?(?:-->|$)/g, '').split(/\r?\n/);
  let fence = null;
  return lines.filter(line => {
    if (/^\s*>/.test(line)) return false;
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return false;
    }
    if (marker) { fence = marker[1]; return false; }
    return !/^(?: {4}|\t)/.test(line);
  }).join('\n').trim();
}

function fieldPresent(text, label) {
  const words = label.split(' ').join('[ \\t]+');
  return new RegExp(`(?:^|·)[ \\t]*${words}[ \\t]*:|^#{1,6}[ \\t]+${words}[ \\t]*:?[ \\t]*$`, 'imu').test(text);
}

export function parseHandoff(body) {
  const text = withoutExamples(body);
  const first = text.split('\n')[0] || '';
  const candidate = /^(?:Сделано[ \t]*:|#{1,6}[ \t]+Сделано[ \t]*:?[ \t]*$)/iu.test(first);
  return { candidate, text, fields: candidate ? HANDOFF_FIELDS.filter(([, label]) => fieldPresent(text, label)).map(([field]) => field) : [] };
}

export function validHandoffProvenance(value) {
  if (!value || !Number.isSafeInteger(value.id) || value.id < 1
    || typeof value.url !== 'string' || !/^https:\/\//.test(value.url)
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))
    || Date.parse(value.updatedAt) < Date.parse(value.createdAt)
    || !/^[0-9a-f]{64}$/.test(value.digest || '')) return false;
  try { return new URL(value.url).protocol === 'https:'; } catch { return false; }
}

export function selectHandoff(pages) {
  const candidates = (pages || []).flat().filter(row => parseHandoff(row?.body).candidate).map(row => ({
    body: row.body,
    provenance: { id: row.id, url: row.html_url, createdAt: row.created_at, updatedAt: row.updated_at, digest: handoffDigest(row.body) },
  }));
  if (candidates.some(candidate => !validHandoffProvenance(candidate.provenance)))
    return { body: '', provenance: null, error: 'Recognized handoff has invalid comment id/URL/timestamps; freshness is unknown' };
  candidates.sort((a, b) => Date.parse(b.provenance.updatedAt) - Date.parse(a.provenance.updatedAt)
    || b.provenance.id - a.provenance.id);
  // A repeated page may repeat an id, but conflicting snapshots of that id are
  // not a deterministic observation and must not silently choose one version.
  const seen = new Map();
  for (const candidate of candidates) {
    const signature = handoffSnapshot(candidate.provenance);
    if (seen.has(candidate.provenance.id) && seen.get(candidate.provenance.id) !== signature)
      return { body: '', provenance: null, error: 'Conflicting handoff comment snapshots across API pages' };
    seen.set(candidate.provenance.id, signature);
  }
  return candidates[0] || { body: '', provenance: null };
}
