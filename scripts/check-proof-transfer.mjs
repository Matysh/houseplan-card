#!/usr/bin/env node
// #954: bridge branch-scoped caches with authenticated, direct producer evidence.
import { productWorkflow, ciRunsUrl, registeredRuns } from './ci-workflows.mjs';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { REUSE_JOBS } from './check-inputs.mjs';
import { reuseKey } from './gate-reuse.mjs';
import { inputReader } from './content-inputs.mjs';
import { CI_PROOF_POLICIES, evaluateCiProof, loadGithubProofContext, parseReuseMarker } from './ci-proof.mjs';
import { runnerEnvironment, matchingProducerEnvironment } from './ci-job-environment.mjs';

export const transferEnvironment = runnerEnvironment;
export function transferProtocolMatches(root, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) return false;
  try {
    return ['ci-proof', 'ci-job-environment'].every(name => {
      const path = `scripts/${name}.mjs`;
      const source = execFileSync('git', ['-C', root, 'show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return source.replace(/\r\n?/g, '\n') === readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
    });
  } catch { return false; }
}
export function directTransfer({ repo, run, context, job, key, sourceKey, tree, environment, performanceSet = 'glow', now = Date.now() }) {
  if (!REUSE_JOBS.includes(job) || !environment.imageOS || !environment.imageVersion) return null;
  if (run.repository?.full_name !== repo || run.head_repository?.full_name !== repo
    || !productWorkflow(run.path) || !/^(?:dev|main|issue\/[1-9]\d+-[\w-]+)$/.test(run.head_branch || '')) return null;
  if (!Number.isFinite(Date.parse(run.updated_at)) || now < Date.parse(run.updated_at) || now - Date.parse(run.updated_at) >= 86400000) return null;
  if (!matchingProducerEnvironment(context.proof?.environments?.[job], environment, job) || key !== sourceKey) return null;
  const claim = context.proof?.checks?.[job];
  if (job === 'performance_smoke' && context.proof?.performanceSet !== performanceSet) return null;
  if (claim?.mode !== 'executed' || claim.key !== key || context.proof?.evidence?.keys?.[job] !== key) return null;
  const verdict = evaluateCiProof({ run, ...context, candidate: { sha: run.head_sha, tree }, policy: CI_PROOF_POLICIES.reviewLight });
  if (verdict.status !== 'green') return null;
  return { sourceRun: run.id, sourceAttempt: run.run_attempt, sourceSha: run.head_sha, key, url: run.html_url };
}
export async function discoverTransfers({ root = process.cwd(), repo, environment = transferEnvironment(), api,
  contextOf, ancestor, treeOf, keyOf, jobs = REUSE_JOBS, performanceSet = 'glow', now = Date.now() }) {
  const result = {};
  if (!environment.imageOS || !environment.imageVersion || !jobs.length) return result;
  const list = await api(ciRunsUrl({ repo, status: 'success', limit: 30 }));
  for (const row of registeredRuns(list, { productOnly: true, repo })) {
    if (jobs.every(j => result[j])) break;
    try {
      if (String(row.id) === String(process.env.GITHUB_RUN_ID) || !ancestor(row.head_sha)) continue;
      const run = await api(`repos/${repo}/actions/runs/${row.id}`);
      const context = await contextOf(run), tree = treeOf(run.head_sha);
      for (const job of jobs.filter(j => !result[j])) {
        if (context.proof?.checks?.[job]?.mode !== 'executed') continue;
        const key = keyOf(job), sourceKey = keyOf(job, run.head_sha);
        const proof = directTransfer({ repo, run, context, job, key, sourceKey, tree, environment, performanceSet, now });
        if (proof) result[job] = proof;
      }
    } catch { /* A missing/expired/unreadable proof is not a PASS. Execute fresh. */ }
  }
  return result;
}
// #981: historical fixture exports remain; this retired CLI grants no skip.
if (isMainModule(import.meta.url)) {
  const output = REUSE_JOBS.map(job => job + '=false').join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
  console.error('check-proof-transfer retired: use the authenticated ci-proofs registry');
}
