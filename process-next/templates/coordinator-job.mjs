import { readFileSync } from 'node:fs';
import { executeRemoteCommand } from '../remote.mjs';
if (process.env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
const config = JSON.parse(readFileSync('process-next/templates/remote-config.json', 'utf8'));
const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const delivery = `github:${process.env.GITHUB_RUN_ID}`;
if (process.env.GITHUB_EVENT_NAME === 'issues') {
  const event = { id: delivery + ':label', issue: payload.issue.number, actor: payload.sender.login, action: payload.action, label: payload.label?.name };
  console.log(JSON.stringify(await executeRemoteCommand({ command: 'label', config, event, execute: true })));
}
// Continue only immediately available transitions. Never run S6 or wait for a model here.
for (let i = 0; i < 4; i++) {
  const result = await executeRemoteCommand({ command: 'reconcile', config, event: { id: `${delivery}:tick:${i}` }, execute: true });
  console.log(JSON.stringify(result));
  if (!['ready-to-merge','merged'].includes(result.action)) break;
}
