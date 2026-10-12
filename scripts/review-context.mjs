#!/usr/bin/env node
// #857: immutable bounded material plus existing role sources, not a new canon.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { issueBodyDigest } from './review-doc-guard.mjs';
import { roleEntry } from './entry-cost.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function reviewContext({ prepared, body, changedFiles = [] }) {
  if (prepared?.schema !== 1 || !['code', 'spec'].includes(prepared.stage)
    || !/^[a-f0-9]{40}$/.test(prepared.material_sha || '') || !/^[a-f0-9]{40}$/.test(prepared.material_tree || '')
    || !/^[1-9]\d*$/.test(String(prepared.issue || '')) || typeof body !== 'string' || body.length > 256 * 1024
    || issueBodyDigest(body) !== prepared.material_issue_body || !Array.isArray(changedFiles) || changedFiles.length > 200
    || changedFiles.some(p => typeof p !== 'string' || p.startsWith('/') || p.split('/').includes('..')))
    throw Error('review-context: missing/stale/oversized immutable input');
  return { schema: 1, ...roleEntry('reviewer', changedFiles), issue: Number(prepared.issue), stage: prepared.stage,
    material: { sha: prepared.material_sha, tree: prepared.material_tree, bodyDigest: prepared.material_issue_body },
    body, fullHunkReads: [...new Set(changedFiles)],
    note: 'Read required sources once, current comments and relevant subsystem decisions. All changed/risky hunks and negative evidence remain required. Re-run checks when material/environment/oracle changed; never replace complete verdict with this packet.' };
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  try {
    const prepared = JSON.parse(readFileSync(arg('prepared'), 'utf8'));
    if (!/^[\w.-]+\/[\w.-]+$/.test(arg('repo') || '') || !/^[1-9]\d*$/.test(String(prepared?.issue || '')))
      throw Error('review-context: invalid identity');
    const snapshot = JSON.parse(execFileSync('gh', ['api', `repos/${arg('repo')}/issues/${prepared.issue}`],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
    const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
    if (git(['rev-parse', 'HEAD']) !== prepared.material_sha || git(['rev-parse', 'HEAD^{tree}']) !== prepared.material_tree)
      throw Error('review-context: checkout changed');
    const base = git(['merge-base', arg('base'), prepared.material_sha]);
    const changedFiles = prepared.stage === 'code' ? git(['diff', '--name-only', base, prepared.material_sha]).split('\n').filter(Boolean) : [];
    const context = reviewContext({ prepared, body: snapshot.body || '', changedFiles });
    writeFileSync(arg('output'), JSON.stringify(context, null, 2) + '\n', { flag: 'wx' });
    console.log(`review-context: ${context.requiredRole}; sources=${context.files.length}; full-hunk-files=${context.fullHunkReads.length}; body=${context.material.bodyDigest}`);
  } catch { console.error('review-context: immutable source verification failed; model must not run'); process.exitCode = 2; }
}
