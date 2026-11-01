// Inert binding: only the future workflow calls main. Importing this module does no I/O.
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReviewContext, runReview } from '../lib/review.mjs';
import { GitHubClient } from '../lib/github.mjs';
import { readJson, writeJson } from '../lib/storage.mjs';
import { WorkflowReviewAdapter } from '../remote.mjs';

function requestFrom(env) {
  if (env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
  const issue = Number(env.HP_ISSUE), requestId = env.HP_REQUEST_ID, kind = env.HP_KIND ?? 'code';
  if (!Number.isSafeInteger(issue) || issue < 1 || !/^[A-Za-z0-9:_.-]{1,200}$/.test(requestId ?? '')) throw Error('Review request identity required');
  if (![env.HP_BASE, env.HP_HEAD].every(value => /^[a-f0-9]{40}$/.test(value ?? ''))) throw Error('Resolved base/head SHAs required');
  if (!['code', 'spec'].includes(kind)) throw Error('Unknown review kind');
  if (env.HP_PATCH_ID && !/^[a-f0-9]{40,64}$/.test(env.HP_PATCH_ID)) throw Error('Invalid patch identity');
  return { issue, requestId, kind, base: env.HP_BASE, materialSha: env.HP_HEAD, patchId: env.HP_PATCH_ID || null };
}

function compatible(receipt, request) {
  if (receipt?.requestId !== request.requestId || receipt.issue !== request.issue || receipt.kind !== request.kind
    || !(receipt.materialSha === request.materialSha || request.kind === 'code' && request.patchId && receipt.patchId === request.patchId)
    || !['accepted', 'changes_requested', 'incomplete', 'not-required'].includes(receipt.verdict)) throw Error('Saved review belongs to different material or has no verdict');
  if (typeof receipt.markdown !== 'string' || !receipt.markdown.trim()) throw Error('Saved review has no report');
  return receipt;
}

async function issueComments(api, issue) {
  const comments = [];
  for (let page = 1; ; page++) {
    const batch = await api.request('GET', `${api.root}/issues/${issue}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw Error('Invalid issue comment inventory');
    comments.push(...batch.map(comment => ({ id: comment.id, author: comment.user?.login ?? null,
      createdAt: comment.created_at, updatedAt: comment.updated_at, url: comment.html_url, body: comment.body ?? '' })));
    if (batch.length < 100) return comments;
  }
}

/** Save the paid result before any attempt to publish the human-readable comment.
 * result.json is uploaded as review-result by the next workflow step and is the sole verdict source.
 */
export async function prepareReviewJob({ env = process.env, api, reviewAdapter, runReviewImpl = runReview,
  buildContext = buildReviewContext, reportDir = resolve('process-next/.state/reviews'), onProgress = value => console.log(JSON.stringify(value)) } = {}) {
  const request = requestFrom(env), resultFile = join(reportDir, 'result.json');
  const existing = readJson(resultFile);
  if (existing) return { ...compatible(existing, request), reused: true };
  const lookup = { requestId: request.requestId, kind: request.kind,
    active: { issue: request.issue, expectedBase: request.base, materialSha: request.materialSha, patchId: request.patchId },
    task: { track: env.HP_TRACK, ownerAssigned: false } };
  const prior = await reviewAdapter.readReviewResult(lookup);
  if (prior?.verdict && prior.markdown) {
    const receipt = { ...compatible(prior, request), reused: true };
    writeJson(resultFile, receipt);
    return receipt;
  }
  // Reading issue discussion does not grant it instruction authority or prove owner identity.
  const [issue, comments, previousReview] = await Promise.all([
    api.getIssue(request.issue), issueComments(api, request.issue),
    reviewAdapter.readPreviousReviewResult({ issue: request.issue, kind: request.kind, excludeRequestId: request.requestId }),
  ]);
  const context = buildContext({ repoRoot: resolve(env.HP_CANDIDATE_ROOT || '.'), base: request.base, head: request.materialSha,
    task: { issue: request.issue, title: issue.title, url: issue.html_url, body: issue.body, comments },
    // Routing already excludes owner ship. Workflow inputs cannot grant a review exemption.
    kind: request.kind, track: env.HP_TRACK, ownerAssigned: false,
    receipts: JSON.parse(env.HP_RECEIPTS || '[]'), previousReview });
  const name = `${request.kind === 'spec' ? 'Ревью ТЗ' : 'Код-ревью'} задачи ${request.issue}`;
  const result = await runReviewImpl({ context, reportDir, onProgress: value => onProgress({ name, ...value }) });
  const receipt = { version: 1, ...request, verdict: result.status === 'accept' ? 'accepted' : result.status,
    model: result.model ?? null, report: result.report ?? null, usage: result.usage ?? null,
    markdown: result.file ? readFileSync(result.file, 'utf8') : result.reason, createdAt: new Date().toISOString() };
  compatible(receipt, request);
  writeJson(resultFile, receipt);
  return receipt;
}

/** Optional presentation only. A failed/retried comment never reruns the model. */
export async function publishReviewComment({ env = process.env, api, reportDir = resolve('process-next/.state/reviews') } = {}) {
  const request = requestFrom(env), receipt = compatible(readJson(join(reportDir, 'result.json')), request);
  const marker = `<!-- process-next-review:${request.requestId} -->`;
  const comments = await issueComments(api, request.issue);
  if (comments.some(comment => comment.author === 'github-actions[bot]' && comment.body.startsWith(marker))) return { published: true, reused: true };
  const identity = { requestId: receipt.requestId, materialSha: receipt.materialSha, base: receipt.base, kind: receipt.kind, verdict: receipt.verdict, model: receipt.model };
  const reportUrl = receipt.reportUrl ?? (env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null);
  const suffix = reportUrl ? `\n\nПолный отчёт: ${reportUrl} (артефакт review-result).` : '';
  const report = receipt.markdown.length > 55_000 ? `${receipt.markdown.slice(0, 55_000)}\n\n[Отчёт в комментарии сокращён; полный текст сохранён в артефакте.]` : receipt.markdown;
  const body = `${marker}\n\n\`\`\`json\n${JSON.stringify(identity)}\n\`\`\`\n\n${report}${suffix}`;
  await api.comment(request.issue, body);
  return { published: true };
}

async function main() {
  requestFrom(process.env); // Activation checked before even constructing a remote client.
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  const api = new GitHubClient({ owner, repo, token: process.env.GITHUB_TOKEN, activated: true });
  if (process.argv.includes('--publish')) {
    console.log(JSON.stringify(await publishReviewComment({ api })));
    return;
  }
  const reviewAdapter = new WorkflowReviewAdapter({ api });
  const receipt = await prepareReviewJob({ api, reviewAdapter });
  // Rerunning a failed comment step must not delete/replace an already durable artifact.
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `artifact_reused=${Boolean(receipt.artifactId)}\n`);
  console.log(JSON.stringify({ requestId: receipt.requestId, verdict: receipt.verdict, reused: receipt.reused ?? false }));
  if (!['accepted', 'not-required'].includes(receipt.verdict)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
