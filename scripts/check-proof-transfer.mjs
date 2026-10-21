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
if (isMainModule(import.meta.url)) {
  const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const file = resolve(arg('file') || 'artifacts/ci/transfer.json'), marker = arg('marker');
  if (marker) {
    const p = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8'))[arg('job')] : null;
    let output = 'accepted=false\nsource_run=\nsource_attempt=\nsource_sha=\n';
    // A cache hit is only a lookup hint, never independent authorization. A
    // stale/foreign cached marker must not override the verified direct source.
    if (p) {
      writeFileSync(marker, `SHA: ${p.sourceSha}\nпрогон: ${p.url}\nпопытка: ${p.sourceAttempt}\n`);
      const source = parseReuseMarker(readFileSync(marker, 'utf8'));
      output = `accepted=true\nsource_run=${source.sourceRun}\nsource_attempt=${source.sourceAttempt}\nsource_sha=${source.sourceSha}\n`;
    }
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
    process.stdout.write(output);
  } else {
    const repo = arg('repo') || process.env.GITHUB_REPOSITORY, root = process.cwd();
    const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
    let result = {};
    try {
      const memo = new Map(), readers = new Map();
      const requested = process.env.TRANSFER_CHECKS ? JSON.parse(process.env.TRANSFER_CHECKS) : null;
      result = await discoverTransfers({ root, repo,
        jobs: requested ? REUSE_JOBS.filter(j => requested[j] === true || requested[j] === 'true') : REUSE_JOBS,
        performanceSet: ['glow', process.env.PERF_ISO === 'true' && 'iso', process.env.PERF_INTERACTION === 'true' && 'interaction'].filter(Boolean).join('-'),
        api: p => JSON.parse(execFileSync('gh', ['api', p], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })),
        contextOf: run => loadGithubProofContext({ repo, run, token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN }),
        ancestor: sha => { try {
          git(['merge-base', '--is-ancestor', sha, 'HEAD']);
          // The stamp producer is part of trust too, not only its aggregator.
          return transferProtocolMatches(root, sha);
        } catch { return false; } },
        treeOf: sha => git(['rev-parse', `${sha}^{tree}`]),
        keyOf: (job, ref = null) => {
          const id = `${job}:${ref}`;
          if (ref && !readers.has(ref)) readers.set(ref, inputReader(root, ref));
          if (!memo.has(id)) memo.set(id, reuseKey(root, job, { ref, reader: readers.get(ref) }));
          return memo.get(id);
        },
      });
    } catch { /* API unavailable means no inherited execution. */ }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(result));
    const output = REUSE_JOBS.map(j => `${j}=${Boolean(result[j])}`).join('\n') + '\n';
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
    process.stdout.write(output);
  }
}
