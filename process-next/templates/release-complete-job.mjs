import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { executeRemoteCommand } from '../remote.mjs';

/** A credential-bearing entry to the same resumable completion used locally. */
export async function completeHostedRelease({ env = process.env, config,
  execute = executeRemoteCommand, onProgress = () => {} } = {}) {
  if (env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
  const candidate = env.HP_RELEASE_CANDIDATE;
  if (typeof candidate !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,199}$/.test(candidate))
    throw Error('Use the ID of an already published candidate from process-release-state');
  const settings = config ?? JSON.parse(readFileSync('process-next/config.json', 'utf8'));
  // If a published history still needs returning to dev, reuse the existing
  // hosted S6 fallback instead of installing a second testing environment here.
  const hosted = { ...settings, release: { ...settings.release, returnS6: 'github' } };
  return execute({ command: 'complete-release', config: hosted, env, execute: true, onProgress,
    event: { id: `github:${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT ?? 1}:complete`, candidate } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await completeHostedRelease({ onProgress: value => console.log(JSON.stringify(value)) });
    const summary = { candidate: process.env.HP_RELEASE_CANDIDATE, published: result.published,
      status: result.completion?.status, pending: result.completion?.pending ?? [] };
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Выпуск ${summary.candidate}: ${summary.status}\n\n` + summary.pending.map(item => `- ${item.step}: ${item.reason}`).join('\n') + '\n');
    if (summary.status !== 'completed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
