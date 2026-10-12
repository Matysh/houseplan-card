#!/usr/bin/env node
// #860: bounded addressed history, immutable sources, no second decision canon.
import { spawnSync } from 'node:child_process';
import { posix } from 'node:path';
import { parseDocName } from './reviews-index.mjs';
import { headings } from './md-anchors.mjs';
import { issueTrailers } from './release-membership.mjs';
import { isMainModule } from './spawn-portable.mjs';

export const HISTORY_LIMIT = 32;
export const DOCUMENT_LIMIT = 12;
const safePath = path => typeof path === 'string' && /^[\w@./-]+$/.test(path)
  && !path.startsWith('/') && !path.split('/').some(p => p === '..' || p === '.' || !p);

export function decisionContext({ issue, file, at = 'HEAD', historical = false, limit = 5,
  git = args => {
    const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (r.status !== 0) throw new Error('decision-context: source could not be read');
    return r.stdout;
  } } = {}) {
  if ((!issue && !file) || (issue != null && !/^[1-9]\d*$/.test(String(issue)))
    || (file && !safePath(file)) || !Number.isInteger(limit) || limit < 1 || limit > DOCUMENT_LIMIT)
    throw new Error('decision-context: use issue/file and limit 1..12');
  if (!/^[\w./-]+$/.test(at) || at.startsWith('-')) throw new Error('decision-context: invalid material');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(at);
  if (date && (!Number.isFinite(Date.parse(at)) || new Date(at).toISOString().slice(0, 10) !== at))
    throw new Error('decision-context: invalid material date');
  const material = git(date
    ? ['log', '-1', `--before=${at}T23:59:59Z`, '--format=%H', 'HEAD']
    : ['rev-parse', '--verify', `${at}^{commit}`]).trim();
  if (!/^[a-f0-9]{40}$/.test(material)) throw new Error('decision-context: missing immutable material');
  let issues = issue ? new Set([Number(issue)]) : null;
  if (file && !issue) {
    const history = git(['log', `-${HISTORY_LIMIT}`, '--format=%B%x00', material, '--', file]);
    issues = new Set(history.split('\0').flatMap(body => [...issueTrailers(body)]));
  }
  const names = git(['ls-tree', '-r', '--name-only', material, '--', 'docs/reviews',
    ...(historical ? ['legacy/reviews'] : [])]).trim().split('\n');
  const candidates = names.filter(path => {
    const meta = parseDocName(posix.basename(path));
    return safePath(path) && meta?.issue != null && issues.has(meta.issue);
  }).sort((a, b) => {
    const x = parseDocName(posix.basename(a)), y = parseDocName(posix.basename(b));
    return y.issue - x.issue || (y.round || 0) - (x.round || 0) || a.localeCompare(b);
  });
  const documents = [];
  let reads = 0;
  for (const path of candidates.slice(0, DOCUMENT_LIMIT)) {
    const text = git(['show', `${material}:${path}`]); reads++;
    if (file && !text.includes(file)) continue;
    const anchors = headings(text).filter(h => /решени|находк|вердикт|материал|high|medium/i.test(h.text));
    const selected = (anchors.length ? anchors : headings(text)).slice(0, 4);
    documents.push({ path, issue: parseDocName(posix.basename(path)).issue,
      sources: selected.map(h => ({ title: h.text, line: h.line + 1, anchor: h.anchor,
        url: `https://github.com/Matysh/houseplan-card/blob/${material}/${path}#${h.anchor}` })),
      excerpt: text.replace(/<!--[^]*?-->/g, '').slice(0, 400) });
    if (documents.length >= limit) break;
  }
  return { schema: 1, material, historical, selector: { issue: issue ?? null, file: file ?? null, at },
    coverage: `file history <=${HISTORY_LIMIT} commits; source reads <=${DOCUMENT_LIMIT}; not a full-text archive search`,
    candidates: candidates.length, reads, truncated: candidates.length > reads, documents };
}

if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  try {
    console.log(JSON.stringify(decisionContext({ issue: arg('issue'), file: arg('file'), at: arg('at') || 'HEAD',
      historical: process.argv.includes('--historical'), limit: Number(arg('limit') || 5) }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
