#!/usr/bin/env node
// #636: продолжение раунда ревью по событию завершения Validate.
//
// До #636 стадия `prepare` конвейера ждала Validate с мутантами на материале
// внутри job: раннер спал ≈ 28 минут на раунд при 10–12 минутах работы модели
// и упирался в бюджет стадии. Теперь `prepare` диспатчит прогон, кладёт
// запечатанный маркер `review-pending-<issue>-<run>-<attempt>` и выходит.
// Этот скрипт запускает `process-resume.yml` на `workflow_run: completed`
// Validate и делает ровно одно: если раунд действительно ждёт этот прогон —
// переставляет метку S7, и обычный контроллер продолжает с завершённым
// dispatch на руках. Ничего не оценивает и не публикует: вердикт Validate
// (зелёный или красный) разбирает новый прогон `prepare`.
//
// Без маркера ожидания будить раунд нельзя: «успешный прогон без вердикта»
// иначе неотличим от потерянного запроса, а лишняя метка — это второй вызов
// модели. Страховка на потерянное событие — process-reconcile (тот же маркер).
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isMainModule } from './spawn-portable.mjs';
import {
  ACTIVE_RUN_STATES, artifactNames, issueEvents, latestReviewRequest, loadSealedArtifact,
  pendingArtifactName, pendingEvidenceError, preparedEvidenceError, processRuns, relabel, reviewRunsForRequest,
} from './process-reconcile.mjs';
import { reviewResultProblems } from './review-result-gate.mjs';
import { validContinuation, continuationName } from './continuation-record.mjs';
import { issueBodyDigest } from './review-doc-guard.mjs';

export const REVIEW_LABEL = 'S7-code-review';
const STOP_LABELS = ['blocked', 'review-4'];

/** `issue/612-view-conflict` → 612; иначе null. */
export function issueNumberFromBranch(branch) {
  const match = /^issue\/(\d+)-/.exec(String(branch || ''));
  return match ? Number(match[1]) : null;
}

/**
 * Чистое решение: будить раунд или нет.
 *
 * @param {object} p
 * @param {string[]} p.labels        метки issue
 * @param {object} p.validateRun     завершённый прогон Validate: { id, event, status, headSha }
 * @param {number} p.issue          номер issue
 * @param {object} p.request        последняя постановка S7 из timeline
 * @param {string} p.branch         ветка материала
 * @param {string} p.headSha        текущая вершина ветки
 * @param {string} p.sha             SHA материала, на котором завершился Validate
 * @param {object[]} p.runs          прогоны конвейера этой issue (parseProcessRun-совместимые)
 * @param {(run) => object|null} p.pendingOf  маркер ожидания прогона либо null
 * @returns {{action:'resume'|'noop', reason:string, run?:object, recheck?:boolean}}
 */
export function decideResume({ labels = [], issue, request, branch, headSha, body, validateRun, sha, runs = [], pendingOf = () => null }) {
  if (validateRun?.event !== 'workflow_dispatch') return { action: 'noop', reason: 'not a dispatch run — only the awaited dispatch wakes the round' };
  if (validateRun?.status !== 'completed') return { action: 'noop', reason: 'validate run is not completed' };
  if (validateRun?.headSha && sha && validateRun.headSha !== sha) return { action: 'noop', reason: 'validate run head differs from the material' };
  if (!labels.includes(REVIEW_LABEL)) return { action: 'noop', reason: 'issue is not awaiting code review' };
  if (labels.includes('S4-spec-review')) return { action: 'noop', reason: 'ambiguous review status labels' };
  const stop = STOP_LABELS.find((label) => labels.includes(label));
  if (stop) return { action: 'noop', reason: `owner stopped the review (${stop})` };
  if (request?.label !== REVIEW_LABEL || !Number.isFinite(Date.parse(request.at))) {
    return { action: 'noop', reason: 'current review label has no timeline request' };
  }
  if (!sha || headSha !== sha) return { action: 'noop', reason: 'branch head differs from the completed Validate material' };
  const mine = reviewRunsForRequest(runs, issue, request);
  if (mine.some((run) => ACTIVE_RUN_STATES.has(run.status))) return { action: 'noop', recheck: true, reason: 'a process run for this issue is already active' };
  const latest = mine[0];
  if (!latest) return { action: 'noop', recheck: true, reason: 'no process run for this issue — reconcile owns lost requests' };
  if (latest.status !== 'completed' || latest.conclusion !== 'success') {
    return { action: 'noop', reason: `latest process run is ${latest.status}/${latest.conclusion || 'none'} — nothing was left pending` };
  }
  const pending = pendingOf(latest);
  if (pending?.completedModel) {
    const p = pending.continuation;
    if (p.epoch !== request.id || p.branch !== branch || p.candidate !== sha
      || p.bodyDigest !== issueBodyDigest(body || '')) throw Error('completed review continuation belongs to another epoch/body/material');
    return { action: 'noop', reason: 'completed sealed model review; merge continuation owns this Validate completion' };
  }
  if (!pending) return { action: 'noop', recheck: true, reason: 'latest process run left no pending marker — it did not wait for Validate' };
  const error = pendingEvidenceError(pending, { issue, run: latest });
  if (error) return { action: 'noop', reason: error };
  if (pending.branch !== branch || String(pending.validate_run_id) !== String(validateRun.id)) {
    return { action: 'noop', reason: 'pending marker waits for another branch or Validate run' };
  }
  if (String(pending.material_sha) !== String(sha)) {
    return { action: 'noop', recheck: true, reason: `pending marker waits for ${String(pending.material_sha).slice(0, 8)}, not ${String(sha).slice(0, 8)}` };
  }
  return { action: 'resume', reason: 'the round was waiting for exactly this Validate run', run: latest };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

/** A normal completed model is a barrier, not an exception. Only a verified
 * complete result + its exact merge intent earns this successful no-op. */
export function resumeEvidence({ repo, issue, run, artifacts, loadJson, loadResult }) {
  const find = name => {
    const matches = artifacts.filter(a => a.name === name && !a.expired);
    if (matches.length > 1) throw Error(`duplicate ${name} artifacts`);
    return matches[0];
  };
  const result = find(`review-result-${issue}-${run.id}-${run.attempt}`);
  if (result) {
    const preparedArtifact = find(`review-prepared-${issue}-${run.id}-${run.attempt}`);
    const mergeArtifact = find(continuationName(run.id, run.attempt));
    if (!preparedArtifact || !mergeArtifact) throw Error('completed model has no prepared/merge receipt');
    const prepared = loadJson(preparedArtifact, 'prepared.json');
    const why = preparedEvidenceError(prepared, { issue: { number: issue }, stage: 'code', run });
    if (why) throw Error(why);
    const receipt = loadResult(result);
    const problems = reviewResultProblems({ ...receipt, expected: prepared });
    if (problems.length) throw Error(`completed model seal invalid: ${problems.join('; ')}`);
    const verdict = JSON.parse(receipt.read('verdict.json'));
    const p = loadJson(mergeArtifact, 'pending.json');
    if (verdict.verdict !== 'green' || verdict.high !== 0 || verdict.medium !== 0 || !validContinuation(p)
      || p.kind !== 'merge' || p.repo !== repo || Number(p.issue) !== Number(issue) || Number(p.producer.run) !== Number(run.id)
      || Number(p.producer.attempt) !== Number(run.attempt) || p.material !== prepared.material_sha
      || p.bodyDigest !== prepared.material_issue_body || p.branch !== prepared.branch || run.stage !== 'code')
      throw Error('completed model and merge receipt identity differ');
    return { completedModel: true, continuation: p };
  }
  const pending = find(pendingArtifactName(issue, run));
  return pending ? loadJson(pending, 'pending.json') : null;
}

function loadResult(repo, run, artifact) {
  const dir = mkdtempSync(join(tmpdir(), 'houseplan-resume-result-'));
  try {
    gh(['run', 'download', String(run.id), '--repo', repo, '--name', artifact.name, '--dir', dir]);
    const files = readdirSync(dir);
    const bytes = new Map(files.map(name => [name, readFileSync(join(dir, name), 'utf8')]));
    return { files, read: name => bytes.get(name) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export async function resume({ repo, branch, sha, validateRun, apply = true, ops = null, sleep = delay }) {
  const issue = issueNumberFromBranch(branch);
  if (!issue) return { action: 'noop', reason: `branch ${branch} is not an issue branch`, issue: null };
  const io = ops || {
    state: () => {
      const current = JSON.parse(gh(['issue', 'view', String(issue), '--repo', repo, '--json', 'labels,state,body']));
      const labels = current.state === 'OPEN' ? current.labels.map((label) => label.name) : [];
      // A deleted branch after merge/closure is normal, not a failed recovery.
      if (!labels.includes(REVIEW_LABEL) || labels.includes('S4-spec-review') || STOP_LABELS.some((label) => labels.includes(label))) {
        return { labels, request: null, headSha: null };
      }
      return { labels, body: current.body, request: latestReviewRequest(issueEvents(repo, issue), REVIEW_LABEL),
        headSha: JSON.parse(gh(['api', `repos/${repo}/git/ref/heads/${branch}`])).object.sha };
    },
    runs: (request) => request ? processRuns(repo, [], { since: request.at }) : [],
    pendingOf: (run) => {
      return resumeEvidence({ repo, issue, run, artifacts: artifactNames(repo, run),
        loadJson: (artifact, file) => loadSealedArtifact(repo, run, artifact, file),
        loadResult: artifact => loadResult(repo, run, artifact) });
    },
    relabel: () => relabel(repo, { number: issue }, REVIEW_LABEL),
  };
  const inspect = () => {
    const state = io.state();
    const decision = decideResume({ ...state, issue, branch, validateRun, sha,
      runs: io.runs(state.request), pendingOf: io.pendingOf });
    return { state, decision };
  };
  let first = inspect();
  // A completed Validate can arrive before the process list/artifact is visible.
  // Three fresh snapshots at most; never search behind a completed review barrier.
  // After this short delivery grace, the scheduled reconciler remains the fallback.
  for (let attempt = 1; first.decision.recheck && attempt < 3; attempt++) {
    await sleep(5_000);
    first = inspect();
  }
  const decision = first.decision;
  if (decision.action === 'resume' && apply) {
    const second = inspect();
    if (second.decision.action !== 'resume' || first.state.request.id !== second.state.request?.id
      || decision.run.id !== second.decision.run?.id || decision.run.attempt !== second.decision.run?.attempt) {
      return { action: 'noop', reason: `state changed before write: ${second.decision.reason}`, issue, applied: false };
    }
    io.relabel();
  }
  return { ...decision, issue, applied: decision.action === 'resume' && apply };
}

if (isMainModule(import.meta.url)) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const repo = arg('repo') || process.env.GITHUB_REPOSITORY;
  const branch = arg('branch');
  const sha = arg('sha');
  if (!repo || !branch || !sha || !arg('run-id')) {
    console.error('usage: process-resume.mjs --repo=<owner/repo> --branch=<issue/NN-slug> --sha=<sha> --run-id=<Validate id> --event=<event> --status=<status> [--apply=false]');
    process.exit(2);
  }
  const outcome = await resume({
    repo, branch, sha,
    validateRun: { id: arg('run-id'), event: arg('event'), status: arg('status') || 'completed', headSha: sha },
    apply: arg('apply') !== 'false',
  });
  const lines = [`action=${outcome.action}`, `issue=${outcome.issue ?? ''}`, `reason=${outcome.reason}`, `applied=${outcome.applied ? 'true' : 'false'}`];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}
