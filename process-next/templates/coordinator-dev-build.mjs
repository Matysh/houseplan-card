import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { publishDevBuild } from '../../scripts/dev-build.mjs';
import { executeRemoteCommand } from '../remote.mjs';
export async function runDevBuildDelivery({ env = process.env, config, publish = publishDevBuild,
  execute = executeRemoteCommand, log = value => console.log(JSON.stringify(value)) } = {}) {
  if (env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
  const result = await publish({ sha: env.DEV_BUILD_SHA, dist: 'dist', remote: config.git?.remote ?? 'origin',
    expectRef: `refs/heads/${config.git?.dev ?? 'dev'}` });
  log({ published: result.published, reason: result.reason, source: env.DEV_BUILD_SHA });
  if (!result.published) return result;
  const id = `dev-build:${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT ?? 1}`;
  log(await execute({ command: 'dev-build-complete', config, execute: true, env,
    event: { id, issue: Number(env.DEV_BUILD_ISSUE), webhookPending: result.changed && Boolean(env.HP_HA_DEV_WEBHOOK) } }));
  // The pending wakeup is durable before HTTP. A failure never republishes the artifact.
  const notification = await execute({ command: 'dev-webhook', config, execute: true, env, event: { id: `${id}:webhook` } });
  log(notification);
  return { ...result, notification };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = JSON.parse(readFileSync('process-next/config.json', 'utf8'));
  runDevBuildDelivery({ config }).catch(() => { console.error('Dev-build delivery needs an addressed retry'); process.exitCode = 1; });
}
