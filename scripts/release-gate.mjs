// Exact-SHA GitHub Actions gate used by release workflows. Prereleases require
// Validate; stable releases additionally require the dedicated full
// performance workflow.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CI_PROOF_POLICIES, evaluateCiProof, githubCandidateTree,
  loadGithubProofContext, selectCiProofVerdict,
} from './ci-proof.mjs';

/**
 * The verdict is the LATEST run that was not cancelled (#511). A cancelled run
 * proves nothing either way — concurrency or a hand superseded it — and the
 * old "every run must be green" rule turned one red or cancelled duplicate on
 * a SHA into a permanent block (v1.73.0: a cancelled dispatch twin plus a red
 * comparison next to a green push run left the tag without assets). A later
 * re-run or a dispatch with another baseline may therefore refresh the verdict
 * on the same SHA; the owner accepted that trade-off deliberately.
 */
export function latestRelevantRun(runs) {
  const relevant = (Array.isArray(runs) ? runs : []).filter((run) => run && run.conclusion !== 'cancelled');
  const stamp = (run) => Date.parse(run.run_started_at || run.created_at || 0) || 0;
  return relevant.sort((a, b) => stamp(b) - stamp(a) || Number(b.id || 0) - Number(a.id || 0))[0] || null;
}

export function classifyValidateRuns(runs) {
  const latest = latestRelevantRun(runs);
  if (!latest) return 'wait';
  if (latest.status !== 'completed') return 'wait';
  return latest.conclusion === 'success' ? 'success' : 'fail';
}

const newestFirst = (runs) => [...(Array.isArray(runs) ? runs : [])].sort((a, b) => {
  const stamp = (run) => Date.parse(run?.run_started_at || run?.startedAt || run?.created_at || run?.createdAt || 0) || 0;
  return stamp(b) - stamp(a) || Number(b?.id || b?.databaseId || 0) - Number(a?.id || a?.databaseId || 0);
});

/** #541: proof-aware verdict shared with review and merge. */
export async function classifyValidateProofs({
  runs, repo, sha, tree, token, fetchImpl = fetch,
  loadContext = (run) => loadGithubProofContext({ repo, run, token, fetchImpl }),
}) {
  const evaluations = [];
  for (const run of newestFirst(runs)) {
    if (run?.status !== 'completed' || run?.conclusion === 'cancelled') {
      evaluations.push(evaluateCiProof({ run, candidate: { sha, tree }, policy: CI_PROOF_POLICIES.release }));
    } else {
      try {
        const context = await loadContext(run);
        evaluations.push(evaluateCiProof({
          run, ...context, candidate: { sha, tree }, policy: CI_PROOF_POLICIES.release,
        }));
      } catch (error) {
        evaluations.push({
          status: 'missing', url: run.html_url || run.url || null,
          note: `proof could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
    const current = evaluations.at(-1);
    if (current.status !== 'cancelled' && current.status !== 'stale') break;
  }
  return selectCiProofVerdict(evaluations);
}

export const workflowRunsUrl = ({ repo, workflow, sha }) => (
  `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}`
  + `/runs?head_sha=${encodeURIComponent(sha)}&per_page=100`
);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function waitForGreenWorkflow({
  repo, sha, token, workflow = 'validate.yml', label = 'Validate', timeoutMs = 60 * 60 * 1000,
}) {
  if (!repo || !sha || !token || !workflow) throw new Error('repo, sha, token and workflow are required');
  const deadline = Date.now() + timeoutMs;
  const url = workflowRunsUrl({ repo, workflow, sha });
  const proofRequired = workflow === 'validate.yml';
  const tree = proofRequired ? await githubCandidateTree({ repo, sha, token }) : null;
  while (true) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'houseplan-release-gate',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GitHub Actions API ${response.status}: ${await response.text()}`);
    const body = await response.json();
    const runs = Array.isArray(body?.workflow_runs) ? body.workflow_runs : [];
    const latest = latestRelevantRun(runs);
    const verdict = proofRequired
      ? await classifyValidateProofs({ runs, repo, sha, tree, token })
      : { status: classifyValidateRuns(runs) === 'success' ? 'green'
        : classifyValidateRuns(runs) === 'fail' ? 'failed' : 'pending', url: latest?.html_url, note: '' };
    if (verdict.status === 'failed') {
      throw new Error(`${label} is not green for ${sha}: ${verdict.note}${verdict.url ? ` (${verdict.url})` : ''}`);
    }
    if (verdict.status === 'green') {
      console.log(`${label} proof is green for ${sha}: ${verdict.url || latest?.html_url || latest?.id} (${runs.length} run(s) on the SHA)`);
      return;
    }
    if (Date.now() >= deadline) throw new Error(`No complete ${label} proof for ${sha} within the deadline: ${verdict.status} (${verdict.note})`);
    const running = runs.filter((run) => run?.status !== 'completed').length;
    console.log(runs.length
      ? `waiting: ${label} proof is ${verdict.status}; ${running} run(s) still going (${verdict.note})`
      : `waiting: no ${label} run for ${sha} yet`);
    await sleep(30_000);
  }
}

export const waitForGreenValidate = (options) => waitForGreenWorkflow({
  ...options, workflow: 'validate.yml', label: 'Validate',
});

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const sha = process.argv[2];
  const valueArg = (name) => process.argv
    .find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const workflow = valueArg('workflow') || 'validate.yml';
  const label = valueArg('label') || (workflow === 'validate.yml' ? 'Validate' : workflow);
  waitForGreenWorkflow({
    repo: process.env.REPO || process.env.GITHUB_REPOSITORY,
    sha,
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    workflow,
    label,
  }).catch((err) => {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
