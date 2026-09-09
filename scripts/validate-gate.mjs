#!/usr/bin/env node
/**
 * Validate с мутантами на материале ревью — до того, как ревьюер потратит
 * цикл (#510 §5).
 *
 * Мутанты по диффу бегут только по запросу (`validate.yml`, `mutants=true`), и
 * доказательство для ревью — dispatch-прогон на точном SHA материала. Push-
 * прогон на том же SHA зелёный не считается: в нём мутантов нет.
 *
 *   node scripts/validate-gate.mjs --repo=<owner/repo> --ref=<ветка> --sha=<sha> [--workflow=validate.yml]
 *
 * Печатает `result=green|red|missing` и `url=…` (и в $GITHUB_OUTPUT, если он
 * задан); код выхода 0 только при green. Логика — чистая функция `validateGate`
 * поверх инъектируемых `ops`, чтобы тесты и мутанты гоняли её без gh.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { VALIDATE_APPEAR_MS, VALIDATE_TOTAL_MS } from './merge-candidate.mjs';

export const POLL_MS = 20_000;

/** Кандидат в доказательства: dispatch — только там мутанты могут быть запрошены. */
export function isMutantRun(run) {
  return run?.event === 'workflow_dispatch';
}

export const MUTANT_JOB_PREFIX = 'Мутанты по диффу';

/**
 * Зелёный dispatch доказывает мутанты, только если их job реально исполнены
 * (ревью ТЗ r1): чужой dispatch с `mutants=false` на том же SHA тоже зелёный,
 * но с `changed_mutants: skipped`. `validate.yml` при запросе исполняет job
 * даже на пустом отборе, поэтому skipped однозначно значит «не запрашивали».
 */
export function provesMutants(jobs) {
  const mutantJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => String(job?.name || '').startsWith(MUTANT_JOB_PREFIX));
  return mutantJobs.length > 0 && mutantJobs.every((job) => job.conclusion === 'success');
}

/**
 * @param {object} p
 * @param {string} p.ref     ветка, на которой запускать
 * @param {string} p.sha     SHA материала
 * @param {object} p.ops     { listRuns(sha) → [{databaseId,status,conclusion,url,event,headSha}], listRunsOnRef(ref) → те же, jobs(runId) → [{name,conclusion}], dispatch(ref), sleep(ms), now() }
 * @returns {Promise<{result:'green'|'red'|'missing', url:string|null, note:string}>}
 */
export async function validateGate({ ref, sha, ops, appearMs = VALIDATE_APPEAR_MS, totalMs = VALIDATE_TOTAL_MS, pollMs = POLL_MS }) {
  const started = ops.now();
  const ignored = new Set(); // завершённые dispatch, которые ничего не доказывают: отменённые и зелёные без мутантов
  let tracked = null;
  let dispatchedAt = null;
  while (ops.now() - started < totalMs) {
    const runs = (await ops.listRuns(sha)).filter((x) => isMutantRun(x) && !ignored.has(x.databaseId));
    const run = runs.find((x) => tracked && x.databaseId === tracked) || runs[0];
    if (run) {
      tracked = run.databaseId;
      if (run.status === 'completed') {
        if (run.conclusion === 'cancelled') {
          // Отменённый прогон ничего не доказывает (#511, ревью r1 M1): его
          // заменил другой dispatch в той же concurrency-группе — ждём его,
          // а если замены нет, запускаем свой.
          ignored.add(run.databaseId);
          tracked = null;
          continue;
        }
        if (run.conclusion !== 'success') return { result: 'red', url: run.url, note: `dispatch-прогон завершился: ${run.conclusion}` };
        if (provesMutants(await ops.jobs(run.databaseId))) return { result: 'green', url: run.url, note: 'dispatch-прогон с исполненными мутантами зелёный' };
        // зелёный, но мутанты не исполнялись (чужой dispatch без mutants=true) — не доказательство
        ignored.add(run.databaseId);
        tracked = null;
        continue;
      }
    } else if (dispatchedAt === null) {
      await ops.dispatch(ref);
      dispatchedAt = ops.now();
    } else if (ops.now() - dispatchedAt > appearMs) {
      // Прогон должен был появиться. Если на ветке появился dispatch на другом
      // SHA — материал сменился под ногами; иначе запуск просто не прошёл.
      const elsewhere = (await ops.listRunsOnRef(ref)).filter(isMutantRun).find((x) => x.headSha && x.headSha !== sha);
      return {
        result: 'missing', url: elsewhere?.url || null,
        note: elsewhere ? `материал сменился: dispatch-прогон стоит на ${String(elsewhere.headSha).slice(0, 8)}` : 'dispatch-прогон не появился за 3 минуты',
      };
    }
    await ops.sleep(pollMs);
  }
  return { result: 'red', url: null, note: 'Validate с мутантами не завершился за 45 минут' };
}

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

export function realOps({ repo, workflow = 'validate.yml' }) {
  const fields = 'databaseId,status,conclusion,url,event,headSha';
  const parse = (r) => (r.status === 0 && r.stdout ? JSON.parse(r.stdout) : []);
  return {
    listRuns: async (sha) => parse(sh('gh', ['run', 'list', '--repo', repo, '--workflow', workflow, '--commit', sha, '--json', fields, '--limit', '20'])),
    jobs: async (runId) => {
      const r = sh('gh', ['run', 'view', String(runId), '--repo', repo, '--json', 'jobs']);
      return r.status === 0 && r.stdout ? (JSON.parse(r.stdout).jobs || []).map((job) => ({ name: job.name, conclusion: job.conclusion })) : [];
    },
    listRunsOnRef: async (ref) => parse(sh('gh', ['run', 'list', '--repo', repo, '--workflow', workflow, '--branch', ref, '--event', 'workflow_dispatch', '--json', fields, '--limit', '5'])),
    dispatch: async (ref) => {
      const r = sh('gh', ['workflow', 'run', workflow, '--repo', repo, '--ref', ref, '-f', 'full=false', '-f', 'mutants=true']);
      if (r.status !== 0) throw new Error(`gh workflow run: ${r.stderr || r.stdout}`);
    },
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const repo = arg('repo') || process.env.GITHUB_REPOSITORY;
  const ref = arg('ref');
  const sha = arg('sha');
  if (!repo || !ref || !sha) {
    console.error('usage: validate-gate.mjs --repo=<owner/repo> --ref=<branch> --sha=<sha> [--workflow=validate.yml]');
    process.exit(2);
  }
  const outcome = await validateGate({ ref, sha, ops: realOps({ repo, workflow: arg('workflow') || 'validate.yml' }) });
  const lines = [`result=${outcome.result}`, `url=${outcome.url || ''}`, `note=${outcome.note}`];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  process.exit(outcome.result === 'green' ? 0 : 1);
}
