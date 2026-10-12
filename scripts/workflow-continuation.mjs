#!/usr/bin/env node
// #856: consume the existing sealed-artifact/request epoch machinery, no runner polling.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { authenticatedContinuation, validContinuation } from './continuation-record.mjs';
import { artifactNames, issueEvents, latestReviewRequest, loadSealedArtifact, processRuns, reviewRunsForRequest } from './process-reconcile.mjs';
import { issueBodyDigest } from './review-doc-guard.mjs';
import { moveStatusLabel } from './status-label.mjs';
import { realOps as mergeOps } from './merge-candidate.mjs';
import { CI_PROOF_POLICIES, evaluateCiProof, loadGithubProofContext } from './ci-proof.mjs';
import { isMainModule } from './spawn-portable.mjs';
import { probeGreenWorkflow } from './release-gate.mjs';
import { probeE2e, realOps as e2eOps } from './e2e-gate.mjs';
import { tagCommit } from './workflow-pending.mjs';

/** At most one domain dispatch. An ambiguous claimed intent requires owner repair,
 * not an automatic duplicate publisher/model round. Claims are namespaced refs,
 * never release tags or product commits. */
export async function resumeDomainContinuation(p, { state, proof, claim, dispatch, diagnose = () => {} }) {
  const before = await state();
  const matches = s => p.kind === 'night' ? s.dev === p.candidate
    : s.branch === p.dispatchSha && s.tag === p.tagSha;
  if (!matches(before)) return { action: 'noop', reason: 'branch/tag changed; fresh owner intent required' };
  const verdict = await proof(p);
  let diagnosticWarning;
  if (p.kind === 'night' && verdict.status === 'failed') {
    try { await diagnose(p); } catch { diagnosticWarning = 'night-red diagnostic failed; original full verdict remains red'; }
  }
  if (p.kind === 'night' ? !['green', 'failed'].includes(verdict.status) : verdict.status !== 'green')
    return { action: 'pending', reason: `complete proof not green: ${verdict.status}` };
  if (!matches(await state())) return { action: 'noop', reason: 'state changed before dispatch' };
  if (!await claim(p)) return { action: 'already-claimed', reason: 'no repeat; inspect original continuation run if delivery is ambiguous' };
  try {
    if (!matches(await state())) return { action: 'claimed-stale', reason: 'changed after claim; no dispatch, owner repair required' };
    await dispatch(p);
  } catch { return { action: 'claimed-delivery-unknown', reason: 'claim exists; verify source/delivery before an explicit owner retry', needsRecovery: true }; }
  return { action: 'dispatched', status: verdict.status, ...(diagnosticWarning ? { diagnosticWarning } : {}) };
}

export function mergeContinuationDecision(p, current) {
  if (!validContinuation(p) || p.kind !== 'merge') return { action: 'noop', reason: 'invalid merge identity' };
  const labels = (current.issue?.labels || []).map(l => l.name ?? l);
  if (current.issue?.state !== 'open' || labels.filter(l => /^S[1-8]-/.test(l)).join(',') !== 'S7-code-review'
    || labels.includes('blocked') || labels.includes('review-4')) return { action: 'noop', reason: 'request stopped/settled' };
  if (current.request?.id !== p.epoch || current.request?.label !== 'S7-code-review'
    || current.latestProcess !== Number(p.producer.run) || issueBodyDigest(current.issue.body || '') !== p.bodyDigest
    || current.branch !== p.candidate) return { action: 'noop', reason: 'new request/body/branch/process run' };
  if (current.merged) return { action: 'repair', reason: 'candidate already in dev, repair only its current label' };
  if (current.dev !== p.dev) return { action: 'return', reason: 'dev changed; fresh candidate required' };
  return { action: 'merge', reason: 'exact current request/candidate/dev' };
}
export async function resumeMergeContinuation(p, { state, proof, merge, move, comment }) {
  let decision = mergeContinuationDecision(p, await state());
  if (decision.action === 'noop') return decision;
  const verdict = decision.action === 'merge' ? await proof(p) : null;
  const fresh = mergeContinuationDecision(p, await state());
  if (fresh.action !== decision.action) return { action: 'noop', reason: 'state changed before write' };
  decision = fresh;
  if (decision.action === 'merge' && verdict?.status !== 'green')
    decision = { action: 'return', reason: `candidate proof ${verdict?.status || 'missing'}: ${verdict?.note || 'not complete'}` };
  if (decision.action === 'merge') {
    if (!await merge(p)) return { action: 'noop', reason: 'lease/branch changed before dev push' };
    // A successful push is irreversible here; do not relabel a newer epoch.
    try {
      if (mergeContinuationDecision(p, await state()).action !== 'repair')
        return { action: 'merged', reason: 'code in dev; changed request left untouched' };
    } catch { return { action: 'merged-label-pending', reason: 'code pushed; freshness API failed, reconcile must repair', needsRecovery: true }; }
  }
  const to = ['merge', 'repair'].includes(decision.action) ? 'S8-merged' : 'S6-in-progress';
  try { await move('S7-code-review', to); }
  catch { return { action: to === 'S8-merged' ? 'merged-label-pending' : 'return-label-pending', reason: 'label API failed; reconcile must repair', needsRecovery: true }; }
  let warning;
  try {
    await comment(`Event continuation #856: ${decision.reason}. ${to}. `
      + `Кандидат \`${p.candidate}\`; источник https://github.com/${p.repo}/actions/runs/${p.producer.run}. `
      + 'Модель/цикл не повторялись.');
  } catch { warning = 'comment API failed; applied code/status not rolled back'; }
  return { ...decision, to, ...(warning ? { warning } : {}) };
}
const gh = (args, extra = {}) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...extra });
const api = path => JSON.parse(gh(['api', path]));
export const nightRedCommand = (repo, child) => ['scripts/night-red.mjs', `--repo=${repo}`, `--red-run=${child.id}`];
const claimIntent = (repo, p, suffix = '') => {
  const ref = `refs/heads/workflow-continuation/${p.producer.run}-${p.producer.attempt}${suffix}`;
  try {
    gh(['api', '--method', 'POST', `repos/${repo}/git/refs`, '--input', '-'],
      { input: JSON.stringify({ ref, sha: p.candidate }) });
    return true;
  } catch { return false; }
};
const head = (repo, branch) => { try { return api(`repos/${repo}/git/ref/heads/${branch}`).object.sha; } catch { return null; } };

export async function continueWorkflows({ repo, eventId, apply = false, out = null }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || eventId && !/^[1-9]\d*$/.test(String(eventId))) throw Error('invalid event identity');
  const event = eventId ? api(`repos/${repo}/actions/runs/${eventId}`) : null;
  const artifacts = api(`repos/${repo}/actions/artifacts?per_page=100`).artifacts || [];
  const candidates = artifacts.filter(a => /^workflow-continuation-[1-9]\d*-[1-9]\d*$/.test(a.name) && !a.expired).slice(0, 12);
  const outcomes = [];
  for (const artifact of candidates) {
    try {
      const [, runId, attempt] = /^workflow-continuation-(\d+)-(\d+)$/.exec(artifact.name);
      // Read CURRENT run attempt, not its historical success endpoint.
      // An old artifact must not survive a cancelled/new producer rerun.
      const producer = api(`repos/${repo}/actions/runs/${runId}`);
      const p = loadSealedArtifact(repo, { id: runId, attempt }, artifact, 'pending.json');
      if (!validContinuation(p) || String(p.producer.run) !== runId || String(p.producer.attempt) !== attempt) {
        outcomes.push({ action: 'noop', reason: 'invalid sealed identity/name' }); continue;
      }
      const eventWorkflow = event?.path === '.github/workflows/performance.yml' && p.kind === 'release' ? 'performance.yml' : 'validate.yml';
      const childRuns = api(`repos/${repo}/actions/workflows/${eventWorkflow}/runs?head_sha=${p.candidate}&per_page=10`).workflow_runs || [];
      const latest = childRuns.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)[0];
      const child = event || latest;
      if (!authenticatedContinuation(p, producer, child, repo) || child?.id !== latest?.id) continue;
      if (p.kind !== 'merge' && child.conclusion === 'cancelled') {
        outcomes.push({ kind: p.kind, producer: producer.id, action: 'noop', reason: 'cancelled completion grants no dispatch authority' });
        continue;
      }
      if (!apply) { outcomes.push({ kind: p.kind, action: 'ready-for-check', producer: producer.id }); continue; }
      if (p.kind === 'merge') {
        const ops = mergeOps({ repo, token: process.env.HP_PROCESS_TOKEN || process.env.GH_TOKEN, issue: p.issue, mutants: p.policy === 'merge' });
        ops.fetch('dev', p.branch);
        const state = () => {
          const issue = api(`repos/${repo}/issues/${p.issue}`), request = latestReviewRequest(issueEvents(repo, p.issue), 'S7-code-review');
          const latestProcess = reviewRunsForRequest(request ? processRuns(repo, [], { since: request.at }) : [], p.issue, request)[0]?.id;
          const dev = head(repo, 'dev'), branch = head(repo, p.branch);
          let merged = false;
          try {
            ops.fetch('dev');
            merged = execFileSync('git', ['merge-base', '--is-ancestor', p.candidate, 'origin/dev'], { stdio: 'pipe' }).length === 0;
          } catch { /* not merged */ }
          return { issue, request, latestProcess, dev, branch, merged };
        };
        const result = await resumeMergeContinuation(p, {
          state,
          proof: async () => evaluateCiProof({ run: child, ...await loadGithubProofContext({ repo, run: child, token: process.env.GH_TOKEN }),
            candidate: { sha: p.candidate, tree: p.tree }, policy: p.policy === 'merge' ? CI_PROOF_POLICIES.merge : CI_PROOF_POLICIES.mergeLight }),
          merge: () => {
            const base = ops.mergeBase(p.material, p.dev);
            if (ops.patchId(base, p.material) !== ops.patchId(p.dev, p.candidate)) throw Error('reviewed patch changed');
            ops.checkReleaseEntry(p.candidate);
            const pushed = ops.pushWithLease(p.candidate, 'dev', p.dev);
            if (pushed) { try { ops.recordReleaseMilestone(p.candidate); } catch { console.error('milestone accounting needs retry; code is already in dev'); } }
            return pushed;
          },
          move: (from, to) => moveStatusLabel({ repo, issue: p.issue, from, to }),
          comment: body => gh(['api', '--method', 'POST', `repos/${repo}/issues/${p.issue}/comments`, '--input', '-'], { input: JSON.stringify({ body }) }),
        });
        outcomes.push({ kind: p.kind, producer: producer.id, ...result });
        if (result.to === 'S8-merged') { try { ops.deleteBranch(p.branch, p.candidate); } catch { console.error('merged branch cleanup needs retry'); } }
      }
      if (['night', 'release'].includes(p.kind)) {
        const result = await resumeDomainContinuation(p, {
          state: () => p.kind === 'night' ? { dev: head(repo, 'dev') }
            : { branch: head(repo, p.stable ? 'main' : 'dev'), tag: tagCommit(repo, p.tag) },
          proof: async () => {
            const validate = await probeGreenWorkflow({ repo, sha: p.candidate, tree: p.tree,
              token: process.env.GH_TOKEN, expected: null });
            if (p.kind === 'night' || validate.status !== 'green') return validate;
            if (p.stable) {
              const performance = await probeGreenWorkflow({ repo, sha: p.candidate,
                workflow: 'performance.yml', token: process.env.GH_TOKEN });
              if (performance.status !== 'green') return performance;
              return probeE2e({ tag: p.tag, ref: p.candidate, ops: e2eOps(), dispatch: !p.e2eDispatched,
                since: Date.parse(p.createdAt) - 86400000,
                authorizeDispatch: () => head(repo, 'main') === p.dispatchSha && tagCommit(repo, p.tag) === p.tagSha
                  && claimIntent(repo, p, '-e2e') });
            }
            return validate;
          },
          claim: () => claimIntent(repo, p),
          diagnose: () => execFileSync('node', nightRedCommand(repo, child),
            { stdio: 'pipe', env: { ...process.env, ACTIONS_TOKEN: process.env.GH_TOKEN } }),
          dispatch: () => gh(['workflow', 'run', p.kind === 'night' ? 'ship-review.yml' : p.workflow,
            '--repo', repo, '--ref', p.kind === 'night' || !p.stable ? 'dev' : 'main',
            '-f', `tag=${p.kind === 'night' ? 'nightly' : p.tag}`,
            ...(p.kind === 'night' ? ['-f', `candidate=${p.candidate}`] : [])]),
        });
        outcomes.push({ kind: p.kind, producer: producer.id, ...result });
      }
    } catch { outcomes.push({ action: 'unverified', reason: 'verification failed; no success assumed; inspect source and possible one-shot claim before retry' }); }
  }
  if (out) {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/summary.json`, JSON.stringify({ schema: 1, outcomes, coverage: 'latest 100 artifacts, at most 12 continuations' }) + '\n');
  }
  return outcomes;
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  try {
    const outcomes = await continueWorkflows({ repo: arg('repo') || process.env.GITHUB_REPOSITORY,
      eventId: arg('run-id'), apply: arg('apply') === 'true', out: arg('out') });
    console.log(JSON.stringify(outcomes));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nContinuation: ${JSON.stringify(outcomes)}\n`);
  } catch { console.error('continuation discovery failed; no verdict/merge/release authority'); process.exitCode = 1; }
}
