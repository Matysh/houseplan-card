// #980: workflow identity is a registered path, never a display name.
import { execFileSync } from 'node:child_process';

export const CI_WORKFLOWS = Object.freeze({
  'validate.yml': 'full',
  'validate-product.yml': 'product',
  'validate-tooling.yml': 'tooling',
  'validate-docs.yml': 'docs',
});
export function ciWorkflow(value) {
  const path = typeof value === 'string' ? value : value?.path || value?.workflow;
  const file = String(path || '').replace(/^\.github\/workflows\//, '');
  return Object.hasOwn(CI_WORKFLOWS, file) ? file : null;
}
export const productWorkflow = value => ['full', 'product'].includes(CI_WORKFLOWS[ciWorkflow(value)]);
export function ciRunsUrl({ repo, sha, branch, event, status, limit = 100 } = {}) {
  const params = new URLSearchParams({ per_page: String(limit) });
  if (sha) params.set('head_sha', sha);
  if (branch) params.set('branch', branch);
  if (event) params.set('event', event);
  if (status) params.set('status', status);
  return `repos/${repo}/actions/runs?${params}`;
}
export function registeredRuns(payload, { sha, repo, productOnly = false } = {}) {
  const list = Array.isArray(payload) ? payload : payload?.workflow_runs || [];
  return list.filter(run => ciWorkflow(run) && (!sha || (run.head_sha || run.headSha) === sha)
    && (!repo || (!run.repository || run.repository.full_name === repo)
      && (!run.head_repository || run.head_repository.full_name === repo))
    && (!productOnly || productWorkflow(run)))
    .sort((a, b) => Number(b.id || b.databaseId) - Number(a.id || a.databaseId));
}
export function listCiRuns(options, run = execFileSync) {
  const payload = JSON.parse(run('gh', ['api', ciRunsUrl(options)], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  return registeredRuns(payload, options).map(row => ({ ...row,
    databaseId: row.id, headSha: row.head_sha, attempt: row.run_attempt,
    url: row.html_url, startedAt: row.run_started_at, createdAt: row.created_at,
  }));
}
