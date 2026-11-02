// Read-only model job: publication and release state changes belong to the host.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildShipReviewContext, runReview } from '../lib/review.mjs';
import { GitHubClient, checkedRef, readRepositoryFile } from '../lib/github.mjs';
import { readJson, writeJson } from '../lib/storage.mjs';
import { WorkflowReviewAdapter } from '../remote.mjs';

function requestFrom(env) {
  if (env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
  if (env.HP_KIND !== 'ship-batch' || env.HP_TRACK !== 'ship') throw Error('Expected a ship batch review');
  if (!/^[A-Za-z0-9:_.-]{1,200}$/.test(env.HP_REQUEST_ID ?? '')) throw Error('Ship review request identity required');
  const base = env.HP_BASE || null;
  if (!/^[a-f0-9]{40}$/.test(env.HP_HEAD ?? '') || base !== null && !/^[a-f0-9]{40}$/.test(base))
    throw Error('Resolved ship review base/head SHAs required');
  const batch = JSON.parse(env.HP_BATCH || '{}');
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)
    || typeof batch.candidateId !== 'string' || !batch.candidateId.trim()
    || typeof batch.version !== 'string' || !batch.version.trim()
    || !/^[a-f0-9]{64}$/.test(batch.selectionDigest ?? '')) throw Error('Frozen ship batch identifiers required');
  const stateBranch = checkedRef(batch.stateBranch ?? 'process-release-state');
  const statePath = batch.statePath ?? 'releases.json';
  if (typeof statePath !== 'string' || /[\x00-\x1f\\:*?\[\]]/.test(statePath)
    || statePath.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid release state path');
  return { kind: 'ship-batch', requestId: env.HP_REQUEST_ID, candidateId: batch.candidateId,
    base, materialSha: env.HP_HEAD, selectionDigest: batch.selectionDigest,
    releaseVersion: batch.version, stateBranch, statePath };
}

function compatible(receipt, request) {
  if (!receipt || ['kind', 'requestId', 'candidateId', 'base', 'materialSha', 'selectionDigest'].some(key => receipt[key] !== request[key])
    || !['accepted', 'changes_requested', 'incomplete', 'not-required'].includes(receipt.verdict))
    throw Error('Saved ship review belongs to different material or has no verdict');
  if (typeof receipt.markdown !== 'string' || !receipt.markdown.trim()) throw Error('Saved ship review has no report');
  return receipt;
}

function final(receipt, request, packet) {
  if (!receipt) return null;
  compatible(receipt, request);
  if (receipt.verdict === 'not-required' && packet.pending.length) throw Error('A nonempty ship batch requires review');
  return receipt.verdict === 'incomplete' ? null : receipt;
}

async function cachedArtifact(reviewAdapter, request, packet) {
  if (!reviewAdapter) return null;
  const escaped = request.requestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const identity = new RegExp(`(?:^|[\\s·])${escaped}(?=$|[\\s·])`);
  const runs = (await reviewAdapter.runs()).filter(run => identity.test(run.display_title ?? run.name ?? ''))
    .sort((a, b) => Number(b.id) - Number(a.id) || (b.run_attempt ?? 1) - (a.run_attempt ?? 1));
  let incomplete = null;
  for (const run of runs) {
    const receipt = await reviewAdapter.artifactResult(run);
    if (final(receipt, request, packet)) return receipt;
    if (receipt?.verdict === 'incomplete') incomplete ??= receipt;
  }
  return incomplete;
}

/** The packet is fetched from coordinator-owned release state, never reconstructed
 * from today's issues or from mutable files in the candidate checkout.
 */
export async function prepareShipReviewJob({ env = process.env, api, reviewAdapter,
  buildContext = buildShipReviewContext, runReviewImpl = runReview,
  reportDir = resolve('process-next/.state/reviews'), onProgress = value => console.log(JSON.stringify(value)) } = {}) {
  const request = requestFrom(env), resultFile = join(reportDir, 'result.json');
  const file = await readRepositoryFile(api, request.statePath, request.stateBranch);
  const state = JSON.parse(file.text);
  const entry = state.shipReviews?.[request.requestId], packet = entry?.packet;
  if (packet?.schema !== 1 || packet.requestId !== request.requestId || packet.candidateId !== request.candidateId
    || packet.base !== request.base || packet.head !== request.materialSha || packet.version !== request.releaseVersion
    || packet.selectionDigest !== request.selectionDigest || !Array.isArray(packet.tasks) || !Array.isArray(packet.pending))
    throw Error('Stored ship review packet does not match the dispatched request');
  const local = readJson(resultFile);
  const savedFinal = final(local, request, packet) ?? final(entry.result, request, packet);
  const artifact = savedFinal ? null : await cachedArtifact(reviewAdapter, request, packet);
  // Two dispatchers can race before Actions exposes either run. Concurrency
  // serializes the jobs, but a queued first attempt must not turn an incomplete
  // predecessor into an automatic paid retry. Only an explicit job rerun may.
  const existing = savedFinal ?? final(artifact, request, packet)
    ?? (Number(env.GITHUB_RUN_ATTEMPT || '1') === 1
      ? [local, entry.result, artifact].find(receipt => receipt?.verdict === 'incomplete') : null);
  if (existing) {
    const receipt = { ...existing, reused: true };
    writeJson(resultFile, receipt);
    return receipt;
  }
  const { stateBranch, statePath, ...identity } = request;
  const metadata = { version: 1, ...identity,
    workflowRunId: env.GITHUB_RUN_ID ? Number(env.GITHUB_RUN_ID) : null,
    workflowRunAttempt: env.GITHUB_RUN_ATTEMPT ? Number(env.GITHUB_RUN_ATTEMPT) : null };
  if (!packet.pending.length) {
    const receipt = { ...metadata, verdict: 'not-required', model: null, report: null,
      markdown: 'Новых ship-задач для пакетного ревью нет. Ранее принятые результаты сохранены; модель не вызывалась.',
      createdAt: new Date().toISOString() };
    writeJson(resultFile, receipt);
    return receipt;
  }
  const context = buildContext({ repoRoot: resolve(env.HP_CANDIDATE_ROOT || '.'), packet });
  const name = `Пакетное код-ревью ship перед ${packet.version}`;
  const result = await runReviewImpl({ context, reportDir, onProgress: value => onProgress({ name, ...value }) });
  const receipt = { ...metadata, verdict: result.status === 'accept' ? 'accepted' : result.status,
    model: result.model ?? null, report: result.report ?? null, usage: result.usage ?? null,
    markdown: result.file ? readFileSync(result.file, 'utf8') : result.reason,
    createdAt: new Date().toISOString() };
  compatible(receipt, request);
  if (receipt.verdict === 'not-required') throw Error('A nonempty ship batch requires review');
  writeJson(resultFile, receipt);
  return receipt;
}

export function renderShipReviewSummary(receipt) {
  const verdict = { accepted: 'принято', changes_requested: 'нужны исправления', incomplete: 'анализ не завершён', 'not-required': 'новых задач нет' }[receipt.verdict];
  const version = String(receipt.releaseVersion ?? receipt.candidateId).replace(/[\r\n]/g, ' ');
  return `## Пакетное код-ревью ship перед ${version}\n\nРезультат: **${verdict}**. Кандидат: \`${receipt.materialSha}\`.\n\n<details>\n<summary>Полный разбор выбранных ship-задач</summary>\n\n${receipt.markdown}\n\n</details>\n`;
}

async function main() {
  requestFrom(process.env);
  if (process.argv.includes('--publish')) throw Error('Review publication belongs to the release host');
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  // This client and the workflow token can only read. The model has no GitHub client.
  const api = new GitHubClient({ owner, repo, token: process.env.GITHUB_TOKEN, activated: false });
  const receipt = await prepareShipReviewJob({ api, reviewAdapter: new WorkflowReviewAdapter({ api }) });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `artifact_reused=${Boolean(receipt.artifactId)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderShipReviewSummary(receipt));
  console.log(JSON.stringify({ name: `Пакетное код-ревью ship перед ${receipt.releaseVersion ?? receipt.candidateId}`,
    requestId: receipt.requestId, verdict: receipt.verdict, reused: receipt.reused ?? false }));
  if (!['accepted', 'not-required'].includes(receipt.verdict)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
