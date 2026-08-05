// Exact-SHA Validate gate used by .github/workflows/release.yml.
// The policy is exported so failure/cancel/skip scenarios stay unit-tested.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function classifyValidateRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return 'wait';
  if (runs.some((run) => run?.status === 'completed' && run?.conclusion !== 'success')) return 'fail';
  if (runs.some((run) => run?.status !== 'completed')) return 'wait';
  return 'success';
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function waitForGreenValidate({ repo, sha, token, timeoutMs = 60 * 60 * 1000 }) {
  if (!repo || !sha || !token) throw new Error('repo, sha and token are required');
  const deadline = Date.now() + timeoutMs;
  const url = `https://api.github.com/repos/${repo}/actions/workflows/validate.yml/runs?head_sha=${encodeURIComponent(sha)}&per_page=100`;
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
      throw new Error(`Validate is not green for ${sha}: ${JSON.stringify(failed.map((run) => ({
        conclusion: run.conclusion, url: run.html_url,
      })))}`);
    }
    if (state === 'success') {
      console.log(`Validate is green for ${sha} (${runs.length} run(s))`);
      return;
    }
    if (Date.now() >= deadline) throw new Error(`No completed green Validate for ${sha} within the deadline`);
    const running = runs.filter((run) => run?.status !== 'completed').length;
    console.log(runs.length ? `waiting: ${running} Validate run(s) still going` : `waiting: no Validate run for ${sha} yet`);
    await sleep(30_000);
  }
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const sha = process.argv[2];
  waitForGreenValidate({
    repo: process.env.REPO || process.env.GITHUB_REPOSITORY,
    sha,
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  }).catch((err) => {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
