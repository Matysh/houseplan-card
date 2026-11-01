import { readFileSync } from 'node:fs';
import { publishDevBuild } from '../../scripts/dev-build.mjs';
import { executeRemoteCommand } from '../remote.mjs';
if (process.env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
const config = JSON.parse(readFileSync('process-next/templates/remote-config.json', 'utf8'));
const result = publishDevBuild({ sha: process.env.DEV_BUILD_SHA, dist: 'dist', remote: config.git?.remote ?? 'origin', expectRef: `refs/heads/${config.git?.dev ?? 'dev'}` });
console.log(JSON.stringify({ published: result.published, reason: result.reason, source: process.env.DEV_BUILD_SHA }));
if (result.published) console.log(JSON.stringify(await executeRemoteCommand({ command: 'dev-build-complete', config, execute: true,
  event: { id: `dev-build:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT ?? 1}`, issue: Number(process.env.DEV_BUILD_ISSUE) } })));
