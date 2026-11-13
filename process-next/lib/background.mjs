import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { planProfile } from './catalog.mjs';
import { runPlan, executeStep } from './runner.mjs';
import { writeJson } from './storage.mjs';
import { mutationGateReport, REPORT_TITLE_MARKER } from '../../scripts/mutation-gate-report.mjs';

export function mutationShardForDate(date = new Date(), count = 5) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw Error('Mutation shard count must be 1–100');
  const epoch = Date.parse(date instanceof Date ? date.toISOString() : String(date));
  if (!Number.isFinite(epoch)) throw Error('Valid rotation date required');
  return `${((Math.floor(epoch / 86400000) % count) + count) % count + 1}/${count}`;
}

/** Two independent background jobs; neither changes task/release readiness. */
export async function runBackground({ root, kind, date = new Date(), shardCount = 5,
  outputDir = resolve(root, 'artifacts/process-next/background'), signal,
  plan = planProfile, run = runPlan, execute = executeStep, onProgress = () => {},
  gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() }) {
  if (!['mutations', 'coverage'].includes(kind)) throw Error('Unknown background job');
  root = resolve(root); mkdirSync(outputDir, { recursive: true });
  const materialSha = gitSha(), startedAt = new Date().toISOString();
  let result;
  try {
    if (kind === 'mutations') {
      const shard = mutationShardForDate(date, shardCount);
      const profile = await plan({ root, event: 'mutation', mutationShard: shard });
      const report = await run(profile, { root, stateDir: join(outputDir, 'runner'), signal, reuse: false, onProgress });
      const failures = report.results.filter(row => !['passed', 'reused', 'not-required'].includes(row.status));
      result = { kind, shard, materialSha, status: failures.length ? 'failed' : 'passed', report,
        reason: failures.map(row => `${row.name ?? row.id}: ${row.reason ?? row.error ?? row.status}`).join('; ') };
    } else {
      const logPath = join(outputDir, 'coverage.log');
      const outcome = await execute({ id: 'diagnostic-coverage', command: ['node', 'scripts/coverage-diagnostic.mjs', `--sha=${materialSha}`],
        timeoutMs: 120 * 60_000 }, { cwd: root, logPath, signal, onOutput: text => onProgress({ kind, output: text.slice(-500) }) });
      result = { kind, materialSha, status: outcome.status, logPath, diagnostic: true };
    }
  } catch (error) { result = { kind, materialSha, status: 'failed', reason: error.message }; }
  result.startedAt = startedAt; result.finishedAt = new Date().toISOString();
  writeJson(join(outputDir, `${kind}.json`), result);
  return result;
}

async function inventory(api, path) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api.request('GET', `${api.root}/${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw Error('Invalid background issue inventory');
    rows.push(...batch); if (batch.length < 100) return rows;
  }
  throw Error('Background issue inventory incomplete');
}

export async function publishBackgroundFailure({ api, result, eventName, runId, runUrl, date = new Date(), guards = new Map() }) {
  if (eventName !== 'schedule' || result?.kind !== 'mutations' || result.status === 'passed') return { required: false };
  if (!/^[A-Za-z0-9_.:-]+$/.test(String(runId ?? ''))) throw Error('Background run identity required');
  const step = result.report?.results.find(row => row.id === 'mutation-shard');
  const text = step?.logPath && existsSync(step.logPath) ? readFileSync(step.logPath, 'utf8') : null;
  const report = mutationGateReport({ date: new Date(date).toISOString().slice(0, 10), ref: 'dev', sha: result.materialSha,
    runUrl, guards, logs: [{ shard: result.shard ?? 'не запущен', text, outcome: step?.status === 'passed' ? 'success' : 'failure' }] });
  const marker = `<!-- process-next-background:mutations:${runId} -->`;
  // Group the actual failing checks, never all nightly failures or all shards.
  // Runs without identifiable failures are separate incidents, not one bucket.
  const failures = [
    ...report.redGuards.map(guard => ['clean', guard]),
    ...report.escaped.map(id => ['escaped', id]),
    ...report.unverifiable.map(({ id, reason }) => ['unverifiable', id, reason]),
    ...report.unparsed.map(({ line }) => ['unparsed', line]),
  ];
  if (!failures.length) failures.push(['incident', String(runId)]);
  const cause = createHash('sha256').update(JSON.stringify(
    [...new Set(failures.map(failure => JSON.stringify(failure)))].sort(),
  )).digest('hex');
  const causeMarker = `<!-- process-next-background-cause:v1:${cause} -->`;
  const body = `${marker}\n${causeMarker}\n\n## Фоновая проверка тестов — найдена проблема\n\n`
    + `${new Date(date).toISOString().slice(0, 10)}, часть ${result.shard ?? 'не запущена'}, запуск ${runId}.`
    + (result.materialSha ? ` Материал: \`${result.materialSha}\`.` : '')
    + `\n\n${report.body.replace('Полный мутационный прогон', `Фоновая часть ${result.shard ?? 'не запущена'} мутационного набора`)}\n`
    + (result.reason ? `Причина отказа или незавершённого запуска: ${result.reason}\n\n` : '')
    + '**Статусы продуктовых задач и выпусков не меняются.** Это отдельная диагностика чувствительности тестов; требуется разобрать указанный отказ. Остальные части выполняются в следующие ночи.';
  const issues = (await inventory(api, 'issues?state=all')).filter(issue => !issue.pull_request
    && (issue.title?.startsWith(REPORT_TITLE_MARKER) || (issue.body ?? '').includes('<!-- process-next-background:mutations:')));
  // A delivery retry must remain idempotent even if its issue was completed or
  // closed after the first delivery. This does not revive it for a NEW run.
  for (const issue of issues) {
    if ((issue.body ?? '').includes(marker)) return { required: true, issue: issue.number, reused: true };
  }
  for (const issue of issues) {
    const comments = await inventory(api, `issues/${issue.number}/comments`);
    if (comments.some(comment => (comment.body ?? '').includes(marker))) return { required: true, issue: issue.number, reused: true };
  }
  const existing = issues.find(issue => issue.state === 'open'
    && !(issue.labels ?? []).some(label => (typeof label === 'string' ? label : label.name) === 'S8-merged')
    && (issue.body ?? '').includes(causeMarker));
  if (existing) {
    await api.comment(existing.number, body);
    return { required: true, issue: existing.number, reused: true };
  }
  const issue = await api.request('POST', `${api.root}/issues`, { title: report.title, body, labels: ['infra', 'process', 'tests'] });
  if (!Number.isSafeInteger(issue?.number)) throw Error('Background issue creation was not confirmed');
  return { required: true, issue: issue.number, reused: false };
}
