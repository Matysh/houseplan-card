#!/usr/bin/env node
// #857: a failed model round returns only its still-current request, no verdict/cycle.
import { execFileSync } from 'node:child_process';
import { issueBodyDigest } from './review-doc-guard.mjs';
import { issueEvents, latestReviewRequest, processRuns, reviewRunsForRequest } from './process-reconcile.mjs';
import { moveStatusLabel } from './status-label.mjs';
import { modelSummary, parseModelDetails, publishedModelDetails } from './model-usage-details.mjs';
import { publishedUsageLine } from './model-usage.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function failureDecision({ stage, runId, materialSha, bodyDigest }, current) {
  const from = stage === 'spec' ? 'S4-spec-review' : stage === 'code' ? 'S7-code-review' : null;
  const labels = (current.issue?.labels || []).map(l => typeof l === 'string' ? l : l.name);
  if (!from || current.issue?.state !== 'open' || labels.filter(l => /^S[1-8]-/.test(l)).join(',') !== from
    || labels.includes('blocked') || labels.includes('review-4')) return { action: 'noop', reason: 'request no longer active' };
  if (!/^[a-f0-9]{64}$/.test(bodyDigest || '') || issueBodyDigest(current.issue.body || '') !== bodyDigest)
    return { action: 'noop', reason: 'body changed' };
  const run = reviewRunsForRequest(current.runs, current.issue.number, current.request)[0];
  if (!run || String(run.id) !== String(runId) || current.request?.label !== from)
    return { action: 'noop', reason: 'newer/different request or process run' };
  if (stage === 'code' && (!/^[a-f0-9]{40}$/.test(materialSha || '') || current.headSha !== materialSha))
    return { action: 'noop', reason: 'material changed' };
  return { action: 'return', from, to: stage === 'spec' ? 'S3-spec' : 'S6-in-progress', request: current.request.id };
}
export function recoverFailedReview(options, { state, move, comment }) {
  const decision = failureDecision(options, state());
  if (decision.action !== 'return') return decision;
  // Re-read the entire epoch/body/head immediately before mutation.
  const fresh = failureDecision(options, state());
  if (fresh.action !== 'return' || fresh.request !== decision.request) return { action: 'noop', reason: 'request changed during recovery' };
  const details = parseModelDetails(options.details);
  const reason = ['exhausted', 'error'].includes(details?.outcome) ? details.outcome : 'incomplete-result';
  move(fresh.from, fresh.to);
  comment(`Модельный раунд не завершён: ${reason}. Полного допустимого вердикта нет; цикл не израсходован, слияние не разрешено. Статус ${fresh.to}.\n\n`
    + `Проверьте ошибку в [прогоне](https://github.com/${options.repo}/actions/runs/${options.runId}), затем повторите review-метку. Модель/лимит автоматически не переключаются.\n\n`
    + modelSummary(options.details) + '\n\n' + publishedModelDetails(options.details) + '\n' + publishedUsageLine(options.usage));
  return { ...fresh, reason };
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const options = { repo: arg('repo'), issue: Number(arg('issue')), stage: arg('stage'), branch: arg('branch'),
    runId: arg('run-id'), materialSha: arg('material'), bodyDigest: arg('body'), usage: process.env.USAGE, details: process.env.USAGE_DETAILS };
  const gh = (args, extra = {}) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...extra });
  const api = endpoint => JSON.parse(gh(['api', endpoint]));
  try {
    if (!/^[\w.-]+\/[\w.-]+$/.test(options.repo || '') || !Number.isSafeInteger(options.issue) || options.issue <= 0
      || !/^[1-9]\d*$/.test(options.runId || '')) throw Error('invalid recovery identity');
    console.log(JSON.stringify(recoverFailedReview(options, {
      state: () => {
        const issue = api(`repos/${options.repo}/issues/${options.issue}`);
        const label = options.stage === 'spec' ? 'S4-spec-review' : 'S7-code-review';
        const request = latestReviewRequest(issueEvents(options.repo, options.issue), label);
        return { issue, request, runs: request ? processRuns(options.repo, [], { since: request.at }) : [],
          headSha: options.stage === 'code' && /^issue\/[1-9]\d+-[\w-]+$/.test(options.branch || '')
            ? api(`repos/${options.repo}/git/ref/heads/${options.branch}`).object.sha : null };
      },
      move: (from, to) => moveStatusLabel({ repo: options.repo, issue: options.issue, from, to }),
      comment: body => gh(['api', '--method', 'POST', `repos/${options.repo}/issues/${options.issue}/comments`, '--input', '-'], { input: JSON.stringify({ body }) }),
    })));
  } catch { console.error('model recovery could not verify current request; no verdict/merge authority'); process.exitCode = 2; }
}
