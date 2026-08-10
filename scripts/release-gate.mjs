// Exact-SHA GitHub Actions gate used by release workflows. Prereleases require
// Validate; stable releases additionally require the dedicated full
// performance workflow.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function classifyValidateRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return 'wait';
  if (runs.some((run) => run?.status === 'completed' && run?.conclusion !== 'success')) return 'fail';
  if (runs.some((run) => run?.status !== 'completed')) return 'wait';
  return 'success';
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
    const state = classifyValidateRuns(runs);
    if (state === 'fail') {
      const failed = runs.filter((run) => run?.status === 'completed' && run?.conclusion !== 'success');
      throw new Error(`${label} is not green for ${sha}: ${JSON.stringify(failed.map((run) => ({
        conclusion: run.conclusion, url: run.html_url,
      })))}`);
    }
    if (state === 'success') {
      console.log(`${label} is green for ${sha} (${runs.length} run(s))`);
      return;
    }
    if (Date.now() >= deadline) throw new Error(`No completed green ${label} for ${sha} within the deadline`);
    const running = runs.filter((run) => run?.status !== 'completed').length;
    console.log(runs.length
      ? `waiting: ${running} ${label} run(s) still going`
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
