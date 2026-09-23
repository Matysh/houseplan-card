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
import { appendFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';
import {
  ACTIVE_RUN_STATES, artifactNames, loadSealedArtifact, parseProcessRun, pendingArtifactName,
  processRuns, relabel,
} from './process-reconcile.mjs';

export const REVIEW_LABEL = 'S7-code-review';
const STOP_LABELS = ['blocked', 'review-4'];

/** `issue/612-view-conflict` → 612; иначе null. */
export function issueNumberFromBranch(branch) {
  const match = /^issue\/(\d+)-/.exec(String(branch || ''));
  return match ? Number(match[1]) : null;
}

const at = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};

/**
 * Чистое решение: будить раунд или нет.
 *
 * @param {object} p
 * @param {string[]} p.labels        метки issue
 * @param {object} p.validateRun     завершённый прогон Validate: { event, status, headSha }
 * @param {string} p.sha             SHA материала, на котором завершился Validate
 * @param {object[]} p.runs          прогоны конвейера этой issue (parseProcessRun-совместимые)
 * @param {(run) => object|null} p.pendingOf  маркер ожидания прогона либо null
 * @returns {{action:'resume'|'noop', reason:string, run?:object}}
 */
export function decideResume({ labels = [], validateRun, sha, runs = [], pendingOf = () => null }) {
  if (validateRun?.event !== 'workflow_dispatch') return { action: 'noop', reason: 'not a dispatch run — push runs carry no mutants' };
  if (validateRun?.status !== 'completed') return { action: 'noop', reason: 'validate run is not completed' };
  if (validateRun?.headSha && sha && validateRun.headSha !== sha) return { action: 'noop', reason: 'validate run head differs from the material' };
  if (!labels.includes(REVIEW_LABEL)) return { action: 'noop', reason: 'issue is not awaiting code review' };
  const stop = STOP_LABELS.find((label) => labels.includes(label));
  if (stop) return { action: 'noop', reason: `owner stopped the review (${stop})` };
  const mine = runs.map((run) => run.issue ? run : parseProcessRun(run)).filter(Boolean)
    .filter((run) => run.label === REVIEW_LABEL)
    .sort((a, b) => at(b.createdAt) - at(a.createdAt) || Number(b.id) - Number(a.id));
  if (mine.some((run) => ACTIVE_RUN_STATES.has(run.status))) return { action: 'noop', reason: 'a process run for this issue is already active' };
  const latest = mine[0];
  if (!latest) return { action: 'noop', reason: 'no process run for this issue — reconcile owns lost requests' };
  if (latest.status !== 'completed' || latest.conclusion !== 'success') {
    return { action: 'noop', reason: `latest process run is ${latest.status}/${latest.conclusion || 'none'} — nothing was left pending` };
  }
  const pending = pendingOf(latest);
  if (!pending) return { action: 'noop', reason: 'latest process run left no pending marker — it did not wait for Validate' };
  if (String(pending.material_sha) !== String(sha)) {
    return { action: 'noop', reason: `pending marker waits for ${String(pending.material_sha).slice(0, 8)}, not ${String(sha).slice(0, 8)}` };
  }
  return { action: 'resume', reason: 'the round was waiting for exactly this Validate run', run: latest };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

export async function resume({ repo, branch, sha, validateRun, apply = true, ops = null }) {
  const issue = issueNumberFromBranch(branch);
  if (!issue) return { action: 'noop', reason: `branch ${branch} is not an issue branch`, issue: null };
  const io = ops || {
    labels: () => JSON.parse(gh(['issue', 'view', String(issue), '--repo', repo, '--json', 'labels'])).labels.map((label) => label.name),
    runs: () => processRuns(repo, []),
    pendingOf: (run) => {
      const name = pendingArtifactName(issue, run);
      const artifact = artifactNames(repo, run).find((item) => item.name === name && !item.expired);
      if (!artifact) return null;
      const pending = loadSealedArtifact(repo, run, artifact, 'pending.json');
      return String(pending.issue) === String(issue) && String(pending.run_id) === String(run.id) ? pending : null;
    },
    relabel: () => relabel(repo, { number: issue }, REVIEW_LABEL),
  };
  const labels = io.labels();
  const runs = io.runs().filter((run) => run.issue === issue);
  const decision = decideResume({ labels, validateRun, sha, runs, pendingOf: io.pendingOf });
  if (decision.action === 'resume' && apply) io.relabel();
  return { ...decision, issue, applied: decision.action === 'resume' && apply };
}

if (isMainModule(import.meta.url)) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const repo = arg('repo') || process.env.GITHUB_REPOSITORY;
  const branch = arg('branch');
  const sha = arg('sha');
  if (!repo || !branch || !sha) {
    console.error('usage: process-resume.mjs --repo=<owner/repo> --branch=<issue/NN-slug> --sha=<sha> --event=<event> --status=<status> [--apply=false]');
    process.exit(2);
  }
  const outcome = await resume({
    repo, branch, sha,
    validateRun: { event: arg('event'), status: arg('status') || 'completed', headSha: sha },
    apply: arg('apply') !== 'false',
  });
  const lines = [`action=${outcome.action}`, `issue=${outcome.issue ?? ''}`, `reason=${outcome.reason}`, `applied=${outcome.applied ? 'true' : 'false'}`];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}
