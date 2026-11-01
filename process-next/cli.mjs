#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { planProfile } from './lib/catalog.mjs';
import { runPlan } from './lib/runner.mjs';
import { readJson, writeJson, ResultStore } from './lib/storage.mjs';
import { LocalQueueStore, QueueController } from './lib/queue.mjs';
import { initialReleaseState, reduceRelease, releaseReadiness } from './lib/release.mjs';
import { buildReviewContext, runReview, previewReview, checkSpecFormat } from './lib/review.mjs';
import { compareMeasurements, renderMetrics } from './lib/metrics.mjs';
import { executeRemoteCommand, readReleaseMetrics } from './remote.mjs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { acceptGolden } from './catalog/golden-accept.mjs';

export function parseArguments(argv) {
  const options = {}, positional = [];
  const arrays = new Set(['area-test', 'changed-file']);
  const booleans = new Set(['help', 'json', 'no-reuse', 'keep-open', 'owner-assigned', 'preview', 'execute']);
  const values = new Set(['root','request','event','issue','track','layer','version','phase','e2e-root','state-dir','jobs','run-id','state','payload','file','base','head','kind','task-file','receipts','previous-review','report-dir','candidate','latest-stable','anchor','out','metrics-request','target-ref','candidate-root','upgrade-from','ha-version','e2e-work-root','e2e-port','mutation-shard','config','branch','scenes','report','decision']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]; if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const [name, ...rest] = arg.slice(2).split('=');
    if (booleans.has(name)) { if (rest.length) throw Error(`Boolean option --${name}`); options[name] = true; continue; }
    if (!values.has(name) && !arrays.has(name)) throw Error(`Unknown option --${name}`);
    const value = rest.length ? rest.join('=') : argv[++i];
    if (value === undefined || value.startsWith('--')) throw Error(`Missing value for --${name}`);
    if (arrays.has(name)) (options[name] ??= []).push(value); else options[name] = value;
  }
  return { options, positional };
}
export const HELP = `Houseplan: подготовленная новая обвязка (#1105), действующий процесс не переключён.

node process-next/cli.mjs plan|run --event task --issue 9999 --track ship --layer product
  --area-test test/example.test.mjs (можно несколько) --changed-file scripts/example.mjs
node process-next/cli.mjs run --event task --issue 9999 --phase after-review --request request.json
node process-next/cli.mjs run --event beta --version "1.99.0 beta 1" --request release.json
node process-next/cli.mjs status --run-id ID
node process-next/cli.mjs finish --config remote.json --issue 9999 --request task.json --execute
node process-next/cli.mjs status --config remote.json --issue 9999 --execute
node process-next/cli.mjs golden-accept --scenes id1,id2 --report report.json --decision source-reference [--execute]
node process-next/cli.mjs spec-check --file specification.md
node process-next/cli.mjs review preview|run --base SHA --head SHA --issue 9999 --task-file task.md
node process-next/cli.mjs queue ACTION --payload event.json
node process-next/cli.mjs release ACTION --payload event.json
node process-next/cli.mjs metrics --candidate candidate.json --latest-stable stable.json --out report.json

Общее: --root каталог --state-dir каталог --jobs 2 --json --no-reuse --keep-open.
План ничего не запускает. run выполняет только выбранный набор. Чистая документация: --layer docs.
queue/release изменяют только локальное draft-состояние, не GitHub. Сеть ревью — только review run.
request.json содержит поля planProfile (event/issue/track/layer/areaTests/changedFiles/version/e2eRoot).
Для HA: e2eRoot, candidateRoot, expectedVersion, upgradeFrom, haVersion, workRoot, port.
Токены никогда не передаются аргументами или через request.json. \n`;

const print = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
function requireValue(value, description) { if (!value) throw Error(`Required: ${description}`); return value; }
function optionsForPlan(o) {
  const request = o.request ? readJson(resolve(o.request)) : {};
  if (!request || Array.isArray(request)) throw Error('Request must be an object');
  const combined = { ...request };
  for (const key of ['event','track','layer','version','phase']) if (o[key] !== undefined) combined[key] = o[key];
  for (const [arg, key] of Object.entries({ 'area-test':'areaTests','changed-file':'changedFiles','e2e-root':'e2eRoot','target-ref':'targetRef','candidate-root':'candidateRoot','upgrade-from':'upgradeFrom','ha-version':'haVersion','e2e-work-root':'workRoot','e2e-port':'port','mutation-shard':'mutationShard','metrics-request':'metricsRequest' })) if (o[arg] !== undefined) combined[key] = o[arg];
  if (o.issue !== undefined) combined.issue = Number(o.issue);
  if (combined.issue !== undefined && (!Number.isSafeInteger(combined.issue) || combined.issue < 1)) throw Error('Positive issue number required');
  return combined;
}
export async function main(argv = process.argv.slice(2)) {
  const { options: o, positional: [command = 'help', action] } = parseArguments(argv);
  if (o.help || command === 'help') { process.stdout.write(HELP); return 0; }
  const root = resolve(o.root ?? dirname(fileURLToPath(new URL('../package.json', import.meta.url))));
  const stateDir = resolve(o['state-dir'] ?? join(root, 'process-next', '.state'));
  if (command === 'finish' || command === 'status' && o.config) {
    const config = readJson(resolve(requireValue(o.config, '--config')));
    config.workspace = resolve(config.workspace ?? root);
    const controller = new AbortController(), abort = () => controller.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {
      const result = await executeRemoteCommand({ command, config, execute: !!o.execute, signal: controller.signal,
        event: { id: `${command}:${randomUUID()}`, issue: Number(requireValue(o.issue, '--issue')), ...(o.branch ? { branch: o.branch } : {}),
          request: o.request ? readJson(resolve(o.request)) : {}, areaTests: o['area-test'] },
        onProgress: progress => {
          if (o.json) print(progress);
          else if (progress.kind === 'queue') process.stdout.write(`Очередь: ${progress.active ? `#${progress.active.issue}, ${progress.active.phase}` : 'слот свободен'}; ваша позиция: ${progress.waiting.find(item => item.issue === Number(o.issue))?.position ?? 'в слоте'}; ${Math.round(progress.elapsedMs / 1000)} сек\n`);
          else if (progress.kind === 'transition') process.stdout.write(`${progress.action}${progress.reason ? ': ' + progress.reason : ''}\n`);
          else if (progress.kind === 'checks' && typeof progress.state !== 'object') process.stdout.write(`${progress.run}: ${progress.completed}/${progress.total}; ${progress.state}\n`);
        } });
      print(result); return ['returned', 'interrupted'].includes(result.action) ? 1 : 0;
    } finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
  }
  if (command === 'golden-accept') {
    print(acceptGolden({ root, scenes: requireValue(o.scenes, '--scenes').split(','), report: requireValue(o.report, '--report'),
      decision: requireValue(o.decision, '--decision'), execute: !!o.execute })); return 0;
  }
  if (command === 'plan' || command === 'run') {
    const options = { ...optionsForPlan(o), root }, plan = await planProfile(options);
    if (command === 'plan') { print(plan); return 0; }
    const controller = new AbortController(), abort = () => controller.abort(); process.once('SIGINT', abort); process.once('SIGTERM', abort);
    let last = null, lastPrint = 0;
    const progress = event => {
      last = event;
      if (o.json) { if (typeof event.state !== 'object') print({ type: 'progress', ...event }); return; }
      if (typeof event.state === 'object' && Date.now() - lastPrint < 1500) return;
      lastPrint = Date.now();
      const current = plan.steps.find(s => s.id === event.step)?.name ?? '';
      const inside = event.state?.progress;
      const tail = inside && Number.isFinite(inside.completed) && inside.total > 0
        ? `внутри группы: ${inside.completed}/${inside.total} (${Math.floor(inside.completed * 100 / inside.total)}%)`
        : typeof event.state === 'object' ? event.state.output.replace(/[\x00-\x1f\x7f]/g, ' ').slice(-180) : event.state;
      process.stdout.write(`[${event.percent === null ? '—' : event.percent + '%'}; ${event.completed}/${event.total}] ${event.run} · ${current} · ${tail}\n`);
    };
    const timer = setInterval(() => { if (!o.json && last?.active.length) process.stdout.write(`Работает: ${last.active.map(id => plan.steps.find(s => s.id === id)?.name ?? id).join('; ')} · ${Math.round(last.elapsedMs / 1000)}+ сек\n`); }, 15000); timer.unref();
    let report;
    const releaseStore = o.candidate ? new LocalQueueStore(resolve(o.state ?? join(stateDir, 'release.json')), { initial: initialReleaseState }) : null;
    const recordRelease = async event => {
      const { state, version } = await releaseStore.read();
      const next = reduceRelease(state, { id: `${o.candidate}:${randomUUID()}`, candidate: o.candidate, ...event });
      await releaseStore.compareAndSwap(version, next);
    };
    if (releaseStore) await recordRelease({ type: 'run-started', sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() });
    try { report = await runPlan(plan, { root, e2eRoot: options.e2eRoot, stateDir, jobs: Number(o.jobs ?? 2), reuse: !o['no-reuse'], signal: controller.signal, onProgress: progress, environment: options.environment ?? {} }); }
    finally { clearInterval(timer); process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
    if (releaseStore) {
      await recordRelease({ type: 'runner-report', report });
      if (['beta', 'stable'].includes(report.event)) {
        const metrics = await readReleaseMetrics({ root, sha: report.materialSha });
        if (metrics) await recordRelease({ type: 'metrics', sha: report.materialSha, report: metrics });
      }
    }
    if (o.json) print({ type: 'result', ...report });
    else {
      process.stdout.write(`\n${report.name}: ${report.status}\n`);
      for (const r of report.results) process.stdout.write(`  ${r.status}: ${r.name}${r.diagnostic ? ' [диагностика]' : ''}${r.counts?.tests !== undefined ? ` · ${r.counts.tests} кейсов` : ''}${r.reason || r.error ? ' · ' + (r.reason || r.error) : ''}\n`);
      process.stdout.write(`Отчёт: ${report.reportPath}\n`);
    }
    if (o['keep-open'] && process.stdin.isTTY) { const prompt = createInterface({ input: process.stdin, output: process.stdout }); await prompt.question('Готово. Enter — закрыть окно.'); prompt.close(); }
    return ['passed','not-required','diagnostic'].includes(report.status) ? 0 : 1;
  }
  if (command === 'status') { print(new ResultStore(stateDir).report(requireValue(o['run-id'], '--run-id'))); return 0; }
  if (command === 'queue' || command === 'release') {
    const store = new LocalQueueStore(resolve(o.state ?? join(stateDir, `${command}.json`)), command === 'release' ? { initial: initialReleaseState } : {});
    if (!action || action === 'status') { print(await store.read()); return 0; }
    const event = readJson(resolve(requireValue(o.payload, '--payload event.json'))); if (!event?.id) throw Error('Event requires a stable unique id');
    if (event.type && event.type !== action) throw Error('Action and event.type differ'); event.type = action;
    if (command === 'queue') print(await new QueueController(store).dispatch(event));
    else { const { state, version } = await store.read(), next = reduceRelease(state, event); if (next.revision !== state.revision) await store.compareAndSwap(version, next); print(next); }
    return 0;
  }
  if (command === 'spec-check') { const result = checkSpecFormat(readFileSync(resolve(requireValue(o.file, '--file')), 'utf8')); print(result); return result.ok ? 0 : 1; }
  if (command === 'review') {
    if (!['preview','run'].includes(action)) throw Error('Use review preview or review run');
    const context = buildReviewContext({ repoRoot: root, base: requireValue(o.base, '--base'), head: o.head ?? 'HEAD',
      track: o.track ?? 'show', ownerAssigned: false, kind: o.kind ?? 'code',
      task: { issue: o.issue ? Number(o.issue) : null, body: readFileSync(resolve(requireValue(o['task-file'], '--task-file')), 'utf8') },
      receipts: o.receipts ? readJson(resolve(o.receipts)) : [], previousReview: o['previous-review'] ? readFileSync(resolve(o['previous-review']), 'utf8') : null });
    if (action === 'preview') { print(previewReview(context)); return 0; }
    const result = await runReview({ context, reportDir: resolve(o['report-dir'] ?? join(stateDir, 'reviews')), onProgress: event => print({ type: 'review-progress', name: context.name, ...event }) });
    print(result); return ['accept','not-required'].includes(result.status) ? 0 : 1;
  }
  if (command === 'metrics') {
    const report = compareMeasurements(readJson(resolve(requireValue(o.candidate, '--candidate'))), readJson(resolve(requireValue(o['latest-stable'], '--latest-stable'))), o.anchor ? readJson(resolve(o.anchor)) : undefined);
    if (o.out) { writeJson(resolve(o.out), report); writeFileSync(resolve(o.out).replace(/\.json$/, '') + '.md', renderMetrics(report)); }
    o.json ? print(report) : process.stdout.write(renderMetrics(report)); return report.ready ? 0 : 2;
  }
  throw Error(`Unknown command: ${command}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(`Ошибка: ${error.message}`); process.exitCode = 1; }
}
