import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runE2E } from './e2e.mjs';
import { GitHubClient } from './github.mjs';
import { CONVERTER_CASES } from '../converters/cases.mjs';
import { inputIdentity } from './storage.mjs';

const ref = value => typeof value === 'string' && (/^[a-f0-9]{40}$/.test(value) || /^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value));
const save = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); };
const companionInputs = ['tests/**', 'scripts/**', 'seed/**', 'contract/**', 'fixtures/**', 'package.json', 'package-lock.json', 'playwright.config.mjs'];

export function makeConverterStep({ e2eRoot, workRoot, haVersion, candidateRoot, targetRef, expectedVersion, requires = [] } = {}) {
  const missing = [];
  if (!e2eRoot) missing.push('prepared houseplan-e2e checkout');
  if (!workRoot) missing.push('private workRoot');
  if (!/^\d+\.\d+\.\d+(?:b\d+)?$/.test(haVersion ?? '')) missing.push('pinned haVersion');
  if (!candidateRoot && !ref(targetRef)) missing.push('exact candidateRoot or immutable targetRef');
  const args = [fileURLToPath(import.meta.url)];
  for (const [key, value] of Object.entries({ 'e2e-root': e2eRoot, 'work-root': workRoot, 'ha-version': haVersion,
    'companion-identity': e2eRoot && existsSync(e2eRoot) ? inputIdentity(e2eRoot, companionInputs).hash : 'unavailable',
    'candidate-root': candidateRoot, 'target-ref': targetRef, 'expected-version': expectedVersion })) if (value) args.push(`--${key}=${value}`);
  if (requires.includes('release-package')) args.push('--publish-failures');
  return { id: 'converters-stable', name: 'Конвертеры перед stable: 3 формата → импорт в HA', cwd: 'root',
    command: missing.length ? null : ['node', ...args, '--execute'],
    unavailable: missing.length ? 'Converter prerequisites: ' + missing.join('; ') : undefined,
    inputs: ['process-next/converters/**', 'process-next/lib/converters.mjs', 'process-next/lib/e2e.mjs',
      'scripts/sh3d-convert/fixtures/**', 'package.json'], requires,
    diagnostic: true, timeoutMs: 45 * 60_000,
    outputs: ['artifacts/process-next/converters/report.json'],
    reusableReports: ['artifacts/process-next/converters/report.json'] };
}

/** Preserve three separate outcomes even if HA setup fails before discovery/tests. */
export function converterReport(result, { error, workspace = result?.workspace, targetRef, expectedVersion, haVersion } = {}) {
  const formats = CONVERTER_CASES.map(row => {
    const file = workspace && path.join(workspace, 'artifacts/converters', `${row.id}.json`);
    if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
    return { format: row.id, status: 'unavailable', phase: 'environment', error: error ?? 'Journey produced no complete result' };
  });
  const passed = formats.filter(row => row.status === 'passed').length;
  const failed = formats.filter(row => row.status === 'failed').length;
  return { schema: 1, diagnostic: true, status: passed === 3 && result?.status === 'passed' && !error ? 'passed' : failed ? 'failed' : 'unavailable',
    targetRef: targetRef ?? null, expectedVersion: expectedVersion ?? null, haVersion, workspace,
    generatedAt: new Date().toISOString(), formats, reason: error ?? null,
    counts: { tests: 3, passed, failed, skipped: 3 - passed - failed } };
}

const safe = value => String(value ?? '').replaceAll('`', 'ˋ').slice(0, 1800);
export function converterMarkdown(report) {
  const words = { passed: 'успешно', failed: 'отказ', unavailable: 'не выполнено' };
  return '# Конвертеры → импорт в HA\n\nДиагностика не блокирует выпуск Houseplan.\n\n'
    + `Houseplan: ${safe(report.targetRef)}; версия ${safe(report.expectedVersion)}; HA ${safe(report.haVersion)}.\n\n`
    + '| Формат | Результат | Этап |\n|---|---|---|\n'
    + report.formats.map(row => `| ${row.format} | ${words[row.status] ?? 'неизвестно'} | ${row.phase} |`).join('\n')
    + '\n\n' + report.formats.map(row => `**${row.format}**: страница ${safe(row.published?.url ?? 'не получена')}; SHA256 ${safe(row.published?.sha256 ?? 'нет данных')}; конвертер ${safe(row.download?.converterVersion ?? 'нет данных')}.`
      + (row.error ? `\n\n\`${safe(row.error)}\`` : '')).join('\n\n') + '\n';
}

/** Repeated failure of the same published artifact/format updates one open bug. */
export async function publishConverterFailures(api, report, runUrl = null) {
  const defects = report.formats.filter(row => row.status === 'failed');
  if (!defects.length) return [];
  if (!api) return defects.map(row => ({ format: row.format, status: 'pending', reason: 'No GitHub credentials; owner must publish this diagnostic failure' }));
  const issues = [];
  for (let page = 1; page <= 100; page++) {
    const rows = await api.request('GET', `${api.root}/issues?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw Error('Incomplete converter issue inventory');
    issues.push(...rows.filter(row => !row.pull_request));
    if (rows.length < 100) break;
    if (page === 100) throw Error('Converter issue inventory exceeds bound');
  }
  const published = [];
  for (const row of defects) {
    const identity = createHash('sha256').update(row.published?.sha256 ?? 'unknown').digest('hex').slice(0, 20);
    const marker = `<!-- process-next-converter:${row.format}:${identity} -->`;
    const body = marker + `\n\nСквозная проверка опубликованного конвертера: **${row.format}**.\n\n`
      + `Этап: ${row.phase}. ${row.phase === 'houseplan-import' ? 'Отказ пути импорта; причина в конвертере или принимающем продукте ещё не установлена.' : 'Опубликованная страница не завершила преобразование/скачивание с ожидаемым результатом.'}\n\n`
      + converterMarkdown({ ...report, formats: [row] }) + (runUrl ? `\n[Прогон и артефакты](${runUrl})\n` : '')
      + '\nИсточник набора: #1179. Выпуск основного Houseplan не блокируется.\n';
    const previous = issues.find(issue => issue.body?.startsWith(marker));
    let issue;
    if (previous) { await api.upsertComment(previous.number, { marker, body }); issue = previous; }
    else issue = await api.request('POST', `${api.root}/issues`, {
      title: `[converter E2E] ${row.format}: ${row.phase}`, body, labels: ['bug', 'tests'] });
    if (!Number.isSafeInteger(issue?.number)) throw Error('Converter bug publication unconfirmed');
    published.push({ format: row.format, status: 'published', issue: issue.number, url: issue.html_url ?? null, reused: !!previous });
  }
  return published;
}

export async function runConverters(options, { run = runE2E, api, runUrl, signal, outputDir, onProgress = () => {} } = {}) {
  let result, error;
  try {
    if (options.companionIdentity && inputIdentity(options.e2eRoot, companionInputs).hash !== options.companionIdentity) throw Error('Companion files changed after converter selection');
    result = await run({ ...options, suite: 'converters', selection: 'remainder' }, { onProgress, signal });
  }
  catch (failure) { error = failure.message; result = { workspace: failure.workspace }; }
  const report = converterReport(result, { ...options, error });
  report.companionIdentity = options.companionIdentity ?? null;
  try { report.issues = await publishConverterFailures(options.publishFailures ? api : null, report, runUrl); }
  catch (failure) { report.issues = [{ status: 'pending', reason: failure.message }]; }
  const output = outputDir ?? path.resolve('artifacts/process-next/converters');
  save(path.join(output, 'report.json'), report);
  writeFileSync(path.join(output, 'report.md'), converterMarkdown(report)
    + '\nБаги: ' + report.issues.map(issue => issue.url ?? issue.reason ?? `#${issue.issue}`).join('; ') + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {}, names = { 'e2e-root': 'e2eRoot', 'work-root': 'workRoot', 'ha-version': 'haVersion',
    'candidate-root': 'candidateRoot', 'target-ref': 'targetRef', 'expected-version': 'expectedVersion', 'companion-identity': 'companionIdentity' };
  let execute = false;
  for (const argument of process.argv.slice(2)) {
    if (argument === '--execute') execute = true;
    else if (argument === '--publish-failures') options.publishFailures = true;
    else { const match = /^--([^=]+)=(.+)$/.exec(argument); if (!match || !names[match[1]]) throw Error('Unknown converter argument'); options[names[match[1]]] = match[2]; }
  }
  if (!execute) throw Error('Use --execute for an owned disposable converter lab');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const api = token ? new GitHubClient({ owner: 'Matysh', repo: 'houseplan-card', token, activated: true }) : null;
  const runUrl = /^\d+$/.test(process.env.GITHUB_RUN_ID ?? '') ? `https://github.com/Matysh/houseplan-card/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
  const controller = new AbortController();
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => controller.abort());
  const result = await runConverters(options, { api, runUrl, signal: controller.signal, onProgress: event => console.log(JSON.stringify(event)) });
  console.log('PROCESS_NEXT_RESULT ' + JSON.stringify(result));
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
