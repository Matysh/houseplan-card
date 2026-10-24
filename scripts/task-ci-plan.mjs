// #1044: the same bounded task plan for push, review and merge on every track.
import { execFileSync } from 'node:child_process';
import { classifyRisk } from './change-risk.mjs';
import { browserPushPlan } from './browser-push-plan.mjs';
import { CALL_CONTEXT_LINES } from './smoke-select.mjs';

export function taskCiPlan(inputs, { baseFull = false, labels = [], risk = null, unknown = false,
  diffText, files, root, browserOptions = {} } = {}) {
  const task = /^issue\/[1-9]\d+-/.test(inputs.refName || '');
  const full = Boolean(baseFull || task && labels.includes('ci:full'));
  if (full) return { full: true, golden: true };
  if (!task) return { full: false, golden: false };
  if (unknown || typeof diffText !== 'string' || !Array.isArray(files))
    throw Error('Task check plan is unknown: read the issue labels and complete task diff before running CI');
  const issue = Number(/^issue\/([1-9]\d+)-/.exec(inputs.refName)[1]);
  const browser = browserPushPlan({ root, issue, diffText, files, labels,
    render: Boolean(risk?.visual?.render), ...browserOptions });
  return { full: false, golden: false, browser };
}
export function readTaskDemand({ refName, repo = process.env.GITHUB_REPOSITORY, root = process.cwd(), run = execFileSync } = {}) {
  const match = /^issue\/([1-9]\d+)-/.exec(refName || '');
  if (!match) return {};
  try {
    const issue = JSON.parse(run('gh', ['issue', 'view', match[1], '--repo', repo, '--json', 'labels'], { cwd: root, encoding: 'utf8' }));
    if (!Array.isArray(issue.labels)) throw Error('unknown labels');
    // Task scope is the complete task diff, independent of a prior successful
    // push. Range/provenance guards keep their own GREEN_BASE separately.
    const base = run('git', ['merge-base', 'origin/dev', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const diff = run('git', ['diff', `--unified=${CALL_CONTEXT_LINES}`, base, 'HEAD'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const files = run('git', ['diff', '--name-only', base, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return { labels: issue.labels.map(x => x.name), risk: classifyRisk(diff), diffText: diff, files, root };
  } catch { return { unknown: true }; }
}
