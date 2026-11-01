// Inert until explicitly installed and PROCESS_NEXT_ENABLED is set.
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';
import { runBackground, publishBackgroundFailure } from '../lib/background.mjs';
import { readJson } from '../lib/storage.mjs';
import { GitHubClient } from '../lib/github.mjs';

export async function backgroundJob({ env = process.env, reportOnly = false, run = runBackground, api } = {}) {
  if (env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
  const kind = env.HP_BACKGROUND_KIND;
  if (!['mutations', 'coverage'].includes(kind)) throw Error('Unknown background job');
  const root = resolve(env.HP_BACKGROUND_ROOT ?? '.'), outputDir = join(root, 'artifacts/process-next/background');
  if (!reportOnly) return run({ root, kind, shardCount: Number(env.HP_MUTATION_SHARDS || 5), outputDir,
    onProgress: value => console.log(JSON.stringify(value)) });
  const result = readJson(join(outputDir, `${kind}.json`), { kind, status: 'unavailable', reason: 'Background preparation or execution did not finish', materialSha: env.GITHUB_SHA });
  if (kind === 'coverage' || env.GITHUB_EVENT_NAME !== 'schedule' || result.status === 'passed') return { result, issue: { required: false } };
  const [owner, repo] = (env.GITHUB_REPOSITORY ?? '').split('/');
  api ??= new GitHubClient({ owner, repo, token: env.GITHUB_TOKEN, activated: true });
  let guards = new Map();
  try {
    const { MUTANTS } = await import('../../scripts/mutation-registry.mjs');
    guards = new Map(MUTANTS.map(mutant => [mutant.id, mutant.guard]));
  } catch { /* A broken registry is itself reportable; preserve unknown FAIL lines. */ }
  const issue = await publishBackgroundFailure({ api, result, eventName: env.GITHUB_EVENT_NAME,
    runId: env.GITHUB_RUN_ID, runUrl: `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`, guards });
  return { result, issue };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  backgroundJob({ reportOnly: process.argv.includes('--report') }).then(result => {
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Фон: ${process.env.HP_BACKGROUND_KIND} — ${result.result?.status ?? result.status}. Проверки задач и выпусков от этого не зависят.\n`);
    if (!process.argv.includes('--report') && result.status !== 'passed') process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
