import { readFileSync, appendFileSync } from 'node:fs';
import { executeRemoteCommand } from '../remote.mjs';
import { GitHubClient, GitHubQueueStore } from '../lib/github.mjs';
import { queueSummary } from '../lib/queue.mjs';
import { devBuildTarget } from '../lib/coordinator.mjs';
if (process.env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
const config = JSON.parse(readFileSync('process-next/templates/remote-config.json', 'utf8'));
const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const delivery = `github:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT ?? 1}`;
const call = (command, event) => executeRemoteCommand({ command, config, event, execute: true });
if (process.env.GITHUB_EVENT_NAME === 'issues') {
  const label = payload.label?.name;
  if (['labeled', 'unlabeled'].includes(payload.action) && !/^(?:S[4-8]-|track:|blocked$)/.test(label ?? '')) process.exit(0);
  console.log(JSON.stringify(await call('label', { id: `${delivery}:label`, issue: payload.issue.number,
    actor: payload.sender.login, action: payload.action, label })));
}
const api = new GitHubClient({ owner: config.owner, repo: config.repo, token: process.env[config.github?.tokenEnv ?? 'GH_TOKEN'], activated: true });
if (process.env.GITHUB_EVENT_NAME !== 'issues') {
  for (let page = 1; page <= 20; page++) {
    const issues = await api.request('GET', `${api.root}/issues?state=open&labels=S4-spec-review&per_page=100&page=${page}`);
    for (const issue of issues) try { console.log(JSON.stringify(await call('label', { id: `${delivery}:spec:${issue.number}`, issue: issue.number }))); }
    catch (error) { console.error(`Specification #${issue.number}: ${error.message}; retry on the next tick`); }
    if (issues.length < 100) break;
  }
}
for (let index = 0; index < 4; index++) {
  const result = await call('reconcile', { id: `${delivery}:tick:${index}` });
  console.log(JSON.stringify(result));
  if (!['ready-to-merge', 'merged', 'expired'].includes(result.action)) break;
}
// Metadata retries do not reacquire a task slot or replay its tests/review/merge.
try { console.log(JSON.stringify(await call('reconcile-completions', { id: `${delivery}:completions` }))); }
catch { console.error('Task bookkeeping remains pending; retry on the next tick'); }
// Delivery retry is independent of building/publishing a new dev artifact.
try { console.log(JSON.stringify(await call('dev-webhook', { id: `${delivery}:dev-webhook` }))); }
catch { console.error('HA wakeup remains pending; retry on the next tick'); }
const { state } = await new GitHubQueueStore(api, config.queue).read();
const summary = queueSummary(state);
const text = [`Очередь: ${summary.active ? `#${summary.active.issue} — ${summary.active.phase}` : 'слот свободен'}`,
  ...summary.waiting.map(item => `${item.position}. #${item.issue} (${item.ownerShip ? 'owner ship' : item.track})`) ].join('\n');
console.log(text); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
if (devBuildTarget(state, null) && process.env.GITHUB_OUTPUT) {
  const head = (await api.getRef(config.git?.dev ?? 'dev')).object.sha;
  const target = devBuildTarget(state, head);
  appendFileSync(process.env.GITHUB_OUTPUT, `dev_build_sha=${target.sha}\ndev_build_issue=${target.issue}\n`);
}
