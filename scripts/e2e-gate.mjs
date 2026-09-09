#!/usr/bin/env node
/**
 * E2E на реальном Home Assistant как гейт стабильного релиза (#514).
 *
 * Стабильный релиз проходил Validate и Full Performance на точном SHA, но ни
 * разу не запускался в настоящем HA. Репозиторий houseplan-e2e ставит House
 * Plan из `houseplan.zip` релиза — те же байты, что скачивает HACS, — и гоняет
 * 13 сценариев Playwright. Этот скрипт запускает его workflow на теге и ждёт
 * зелёного; `release.yml` вызывает его для `!prerelease` после Full Performance.
 *
 *   node scripts/e2e-gate.mjs --tag=<vX.Y.Z> [--repo=Matysh/houseplan-e2e] [--workflow=e2e.yml]
 *
 * Печатает `result=green|red|missing|error`, `url=…`, `note=…` (и в
 * $GITHUB_OUTPUT), код выхода 0 только при green. Логика — чистая функция
 * `e2eGate` поверх инъектируемых `ops` (образец — validate-gate.mjs, #510).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { VALIDATE_APPEAR_MS, VALIDATE_TOTAL_MS } from './merge-candidate.mjs';

export const POLL_MS = 20_000;
export const E2E_REPO = 'Matysh/houseplan-e2e';
export const E2E_WORKFLOW = 'e2e.yml';
/** Допуск на расхождение часов раннера и GitHub при отборе «свежих» прогонов. */
export const CLOCK_SKEW_MS = 60_000;
export const TOKEN_HINT = 'нужен секрет E2E_DISPATCH_TOKEN: Actions: write на houseplan-e2e И чтение релизов houseplan-card (fine-grained PAT — оба репозитория в списке)';
export const CARD_REPO = 'Matysh/houseplan-card';

/**
 * Откуда обновляться в сьюте `upgrade`: предыдущий stable, не `stable`.
 * К моменту события `release: published` новый тег — уже самый свежий
 * не-пре-релиз, и `upgrade_from=stable` означало бы «обновиться с v1.74.0 на
 * v1.74.0» — сьют честно краснеет (`Expected: not "1.73.0"`, живой прогон
 * 09.09). Первый stable в истории обновляться неоткуда — тогда `stable`.
 */
export function previousStable(releases, tag) {
  const prior = (Array.isArray(releases) ? releases : [])
    .filter((r) => r && !r.isDraft && !r.isPrerelease && r.tagName && r.tagName !== tag);
  return prior[0]?.tagName || 'stable';
}

/**
 * Прогон — наш, если сьют, ставящий сам тег, назван по нему: имя job в
 * e2e.yml — `"${suite} · HP ${ref} · HA ${ha}"`, и у `journeys`/`first-run`
 * `ref` — это `houseplan_ref`. Сьют `upgrade` носит `upgrade_from` — тег
 * ПРЕДЫДУЩЕГО stable, поэтому «любая job с HP <tag>» приняла бы прогон нового
 * релиза за прогон старого (живой прогон 09.09: v1.72.0 ← run для v1.73.0).
 */
export const TAG_SUITES = ['journeys', 'first-run'];
export function isOurRun(jobs, tag) {
  const needles = TAG_SUITES.map((suite) => `${suite} · HP ${tag} · `);
  return (Array.isArray(jobs) ? jobs : []).some((job) => needles.some((needle) => String(job?.name || '').startsWith(needle)));
}

/**
 * Прогон, у которого ещё нет ни одной job `· HP … ·`, решать рано: e2e.yml
 * сначала планирует матрицу отдельной job, и первые секунды виден только
 * «Матрица прогона». Живой прогон 09.09 записал такой run в чужие навсегда.
 */
export function classifyRun(jobs, tag) {
  const named = (Array.isArray(jobs) ? jobs : []).filter((job) => / · HP .+ · /.test(String(job?.name || '')));
  if (!named.length) return 'unknown';
  return isOurRun(named, tag) ? 'ours' : 'foreign';
}

/**
 * @param {object} p
 * @param {string} p.tag  тег релиза (houseplan_ref для e2e.yml)
 * @param {object} p.ops  { releases() → [{tagName,isDraft,isPrerelease}] новые первыми, dispatch(tag, upgradeFrom), listRuns() → [{databaseId,status,conclusion,url,createdAt}], jobs(runId) → [{name,conclusion}], sleep(ms), now() }
 * @returns {Promise<{result:'green'|'red'|'missing'|'error', url:string|null, note:string}>}
 */
export async function e2eGate({ tag, ops, appearMs = VALIDATE_APPEAR_MS, totalMs = VALIDATE_TOTAL_MS, pollMs = POLL_MS }) {
  const started = ops.now();
  try {
    // Список релизов читается ДО dispatch и обязан падать громко (ревью r3 M1):
    // fine-grained токен «только houseplan-e2e» не видит houseplan-card, и
    // тихий пустой список дал бы upgrade_from=stable — тег сам на себя.
    await ops.dispatch(tag, previousStable(await ops.releases(), tag));
  } catch (error) {
    const message = String(error?.message || error);
    const forbidden = /403|Resource not accessible|not accessible by/i.test(message);
    return { result: 'error', url: null, note: `запуск e2e.yml не удался: ${message}${forbidden ? ` — ${TOKEN_HINT}` : ''}` };
  }
  const foreign = new Set(); // dispatch-прогоны без нашего тега в именах job
  let tracked = null;
  while (ops.now() - started < totalMs) {
    const runs = (await ops.listRuns()).filter((run) => !foreign.has(run.databaseId));
    let run = tracked ? runs.find((x) => x.databaseId === tracked) : null;
    if (!run) {
      // Опознание: свежий dispatch, чьи job носят наш тег.
      for (const candidate of runs) {
        const createdAt = Date.parse(candidate.createdAt || '') || 0;
        if (createdAt < started - CLOCK_SKEW_MS) continue;
        const kind = classifyRun(await ops.jobs(candidate.databaseId), tag);
        if (kind === 'ours') { run = candidate; break; }
        if (kind === 'foreign' || candidate.status === 'completed') foreign.add(candidate.databaseId);
      }
    }
    if (run) {
      tracked = run.databaseId;
      if (run.status === 'completed') {
        if (run.conclusion === 'success') return { result: 'green', url: run.url, note: `E2E на ${tag} зелёный` };
        if (run.conclusion === 'cancelled') return { result: 'red', url: run.url, note: `E2E на ${tag} отменён вручную — перезапустите гейт` };
        return { result: 'red', url: run.url, note: `E2E на ${tag} завершился: ${run.conclusion}` };
      }
    } else if (ops.now() - started > appearMs) {
      return { result: 'missing', url: null, note: `dispatch e2e.yml на ${tag} не появился за ${Math.round(appearMs / 60000)} мин` };
    }
    await ops.sleep(pollMs);
  }
  return { result: 'red', url: tracked ? `run ${tracked}` : null, note: `E2E на ${tag} не завершился за ${Math.round(totalMs / 60000)} мин` };
}

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

export function realOps({ repo = E2E_REPO, workflow = E2E_WORKFLOW, cardRepo = CARD_REPO, exec = sh } = {}) {
  const fields = 'databaseId,status,conclusion,url,createdAt';
  const parse = (r) => (r.status === 0 && r.stdout ? JSON.parse(r.stdout) : []);
  return {
    releases: async () => {
      const r = exec('gh', ['release', 'list', '--repo', cardRepo, '--json', 'tagName,isDraft,isPrerelease', '--limit', '30']);
      if (r.status !== 0) throw new Error(`gh release list ${cardRepo}: ${(r.stderr || r.stdout || '').trim()}`);
      return r.stdout ? JSON.parse(r.stdout) : [];
    },
    dispatch: async (tag, upgradeFrom = 'stable') => {
      const r = exec('gh', ['workflow', 'run', workflow, '--repo', repo, '--ref', 'main',
        '-f', `houseplan_ref=${tag}`, '-f', `upgrade_from=${upgradeFrom}`, '-f', 'ha_version=stable']);
      if (r.status !== 0) throw new Error(`gh workflow run: ${(r.stderr || r.stdout || '').trim()}`);
    },
    listRuns: async () => parse(exec('gh', ['run', 'list', '--repo', repo, '--workflow', workflow, '--event', 'workflow_dispatch', '--json', fields, '--limit', '10'])),
    jobs: async (runId) => {
      const r = exec('gh', ['run', 'view', String(runId), '--repo', repo, '--json', 'jobs']);
      return r.status === 0 && r.stdout ? (JSON.parse(r.stdout).jobs || []).map((job) => ({ name: job.name, conclusion: job.conclusion })) : [];
    },
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const tag = arg('tag');
  if (!tag) {
    console.error('usage: e2e-gate.mjs --tag=<vX.Y.Z> [--repo=Matysh/houseplan-e2e] [--workflow=e2e.yml] [--card-repo=Matysh/houseplan-card]');
    process.exit(2);
  }
  const outcome = await e2eGate({ tag, ops: realOps({ repo: arg('repo') || E2E_REPO, workflow: arg('workflow') || E2E_WORKFLOW, cardRepo: arg('card-repo') || CARD_REPO }) });
  const lines = [`result=${outcome.result}`, `url=${outcome.url || ''}`, `note=${outcome.note}`];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  process.exit(outcome.result === 'green' ? 0 : 1);
}
