#!/usr/bin/env node
// History identifies candidates; only the separate manual review classifies them.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { digestBytes } from './coverage-identity.mjs';

export const SEED_COMMITS = [
  'c689297625978a0144a2530096c69c0c397ce530', '554071aea5b3f17c9202af89c611bcb6ab5b242e',
  'f04d05e3479ab8f7a9b31f66b79d2471c24dffc1', '54d208a32982dda6d068262a27f39b30f1d40288',
  '8c1d2755d2a244b38926caf01b5a2af9deb9fc96', '6d3cdb755cd5cb7bef931cd959065b0c8576c0b5',
  'a249d62dce89f3ecf45f6a6d23f1ee3d52b1474c', '45c33ee60b65bc1ddf5c4b9dc723a9563aeb5391',
  '4ab7ecb4a2fce7b19654d4d433df137109893adc', '45b24911779e1d06e476264af202ea3500f71ac4',
  '93051edfc2aa359fcba815f8678d0fdcc4a2def7',
  // Concrete migration history discovered while reviewing the dialog seeds.
  '585cd958c5f6af2b16659d79771d99a82e70dabe', 'acd2e6685f8e511d8ccbe3a1064d03a983d39a84',
  'f50bc224cf38da52e81bdba29c284b7955268a2f',
];
export function historicalCandidates({ root = process.cwd(), candidate = 'HEAD', base = 'v1.80.1',
  stable = ['v1.81.0', 'v1.82.0'], seeds = SEED_COMMITS, reviews = null } = {}) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  const pin = ref => git(['rev-parse', '--verify', `${ref}^{commit}`]);
  const sha = pin(candidate), baseSha = pin(base), boundaries = stable.map(ref => ({ ref, sha: pin(ref) }));
  const ancestor = (commit, ref) => { try { git(['merge-base', '--is-ancestor', commit, ref]); return true; } catch { return false; } };
  if (!ancestor(baseSha, sha) || boundaries.some((b, i) => !ancestor(i ? boundaries[i - 1].sha : baseSha, b.sha) || !ancestor(b.sha, sha))) {
    throw Error('Stable boundaries must form an ancestral chain to candidate');
  }
  const inRange = git(['rev-list', `${baseSha}..${sha}`]).split('\n').filter(Boolean), range = new Set(inRange);
  const rows = [];
  for (const commit of [...new Set([...inRange, ...seeds.map(pin)])]) {
    const subject = git(['show', '-s', '--format=%s', commit]), seed = seeds.some(s => commit.startsWith(s));
    if (!seed && !/^(fix|refactor)(\([^)]*\))?:/i.test(subject)) continue;
    const files = git(['show', '--format=', '--numstat', commit, '--', 'src']).split('\n')
      .map(line => line.match(/^(\d+)\t(\d+)\t(src\/.+)$/)).filter(Boolean)
      .filter(match => !/^src\/(?:i18n|localize)\//.test(match[3]))
      .map(match => ({ path: match[3], added: +match[1], deleted: +match[2] }));
    const added = files.reduce((n, f) => n + f.added, 0), deleted = files.reduce((n, f) => n + f.deleted, 0);
    const formula = added > 0 && added >= 3 * deleted && range.has(commit);
    if (!formula && !seed) continue;
    const cycle = range.has(commit) ? boundaries.find(b => ancestor(commit, b.sha))?.ref || 'unreleased' : 'seed/outside-range';
    const issue = git(['show', '-s', '--format=%B', commit]).match(/(?:Issue:\s*#?|\(#)(\d+)/)?.[1] || null;
    const review = reviews?.entries?.find(r => r.sha === commit) || null;
    rows.push({ sha: commit, issue: issue && +issue, subject, files, added, deleted, formula, seed, cycle,
      review: review ? { ...review, auditedCandidate: reviews.candidate,
        stillExact: reviews.candidate === sha, authority: 'manual author review at auditedCandidate; recheck callers if material changes' }
        : { decision: 'needs-witness', reason: 'No recorded semantic classification for this exact commit; insertion ratio is only a candidate signal.' } });
  }
  return { schema: 'houseplan-parallel-path-audit/v1', authority: 'diagnostic-only', semanticApproval: false,
    candidate: sha, base: { ref: base, sha: baseSha }, boundaries, rows,
    dialogSeries: { verified: seeds.slice(0, 6), count: 6,
      note: 'Request prelude said seven; six commits with the exact dialog-composition subject and src changes were verified across Git refs. Do not invent a seventh.' },
    digest: digestBytes(JSON.stringify(rows)) };
}
export function auditMarkdown(audit) {
  const cell = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return `# Parallel path history audit\n\nCandidate ${audit.candidate}; ${audit.base.ref}..candidate. Stable cycles: ${audit.boundaries.map(b => b.ref).join(', ')}; remainder unreleased. Formula src additions > 0 and additions ≥ 3 × deletions, excluding i18n/binary; explicit seeds remain separate. ${audit.dialogSeries.note}\n\n`
    + '| SHA / issue / cycle | volume / files | introduced → prior path | current callers and decision |\n|---|---|---|---|\n'
    + audit.rows.map(row => `| ${row.sha} / #${row.issue || '?'} / ${row.cycle}${row.seed ? ' (seed)' : ''} | +${row.added}/−${row.deleted}; ${cell(row.files.map(f => f.path).join(', '))} | ${cell(row.review.introduced)} → ${cell(row.review.prior)} | ${cell(row.review.callers)}; **${row.review.decision}**: ${cell(row.review.reason)}; anchors ${cell(JSON.stringify(row.review.anchors || []))} |`).join('\n') + '\n';
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  try {
    const path = resolve('docs/audits/parallel-paths-1018.json');
    const reviews = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
    const audit = historicalCandidates({ candidate: arg('sha') || 'HEAD', base: arg('base') || 'v1.80.1',
      stable: (arg('stable') || 'v1.81.0,v1.82.0').split(','), reviews });
    if (arg('out')) writeFileSync(arg('out'), JSON.stringify(audit, null, 2));
    else console.log(auditMarkdown(audit));
  } catch (error) { console.error(String(error)); process.exitCode = 2; }
}
