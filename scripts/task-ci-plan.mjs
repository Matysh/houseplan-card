// #954: one up-front plan for push and dispatch; golden is not the full matrix.
import { execFileSync } from 'node:child_process';
import { classifyRisk } from './change-risk.mjs';

export function taskCiPlan(inputs, { baseFull = false, labels = [], risk = null, unknown = false } = {}) {
  const task = /^issue\/[1-9]\d+-/.test(inputs.refName || '');
  const full = baseFull || task && (unknown || labels.includes('ci:full'));
  const golden = full || task && (labels.includes('ci:golden') || Boolean(risk?.visual?.render));
  return { full: Boolean(full), golden: Boolean(golden) };
}
export function readTaskDemand({ refName, repo = process.env.GITHUB_REPOSITORY, root = process.cwd(), run = execFileSync } = {}) {
  const match = /^issue\/([1-9]\d+)-/.exec(refName || '');
  if (!match) return {};
  try {
    const issue = JSON.parse(run('gh', ['issue', 'view', match[1], '--repo', repo, '--json', 'labels'], { cwd: root, encoding: 'utf8' }));
    if (!Array.isArray(issue.labels)) throw Error('unknown labels');
    const diff = run('git', ['diff', '--unified=0', 'origin/dev...HEAD'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return { labels: issue.labels.map(x => x.name), risk: classifyRisk(diff) };
  } catch { return { unknown: true }; }
}
