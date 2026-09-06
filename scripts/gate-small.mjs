#!/usr/bin/env node
// Локальный гейт лёгкого трека одной командой (#479): `npm run gate:small`.
//
// PROCESS §8 перечисляет автору шесть команд, и в #476 они гонялись
// последовательно, вперемешку с гейтами, к задаче не относящимися. Здесь
// обязательная часть §8 идёт параллельно — юниты, сборка с typecheck, «новый
// код не добавляет any», выбор смоков по диффу — а затем сверяется бандл. Что
// НЕ входит и остаётся по диффу и AC: сами смоки (их список печатается),
// golden, pytest, инварианты модели, check-docs в строгом режиме.
//
//   npm run gate:small                       # база origin/dev
//   npm run gate:small -- --base=origin/dev  # явная база диапазона

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function parseArgs(argv) {
  const base = argv.find((a) => a.startsWith('--base='))?.slice('--base='.length) || 'origin/dev';
  return { base };
}

/** Шаги параллельной фазы: имя → команда. `base` — начало диапазона диффа. */
export function parallelSteps(base) {
  return [
    { name: 'юниты (npm test)', cmd: npm, args: ['test'] },
    { name: 'сборка + typecheck (npm run build)', cmd: npm, args: ['run', 'build'] },
    { name: 'новый код не добавляет any', cmd: process.execPath, args: ['scripts/no-new-any.mjs', '--base', base, '--head', 'HEAD'] },
    { name: 'смоки по диффу (smoke-select)', cmd: process.execPath, args: ['scripts/smoke-select.mjs', '--base', base, '--head', 'HEAD'], informational: true },
  ];
}

/** Фаза после сборки: три копии бандла совпадают, бюджет не превышен. */
export function serialSteps() {
  return [
    { name: 'копии бандла совпадают (bundle-tree)', cmd: process.execPath, args: ['scripts/bundle-tree.mjs', 'dist', 'custom_components/houseplan/frontend'], hint: 'npm run bundle:sync' },
    { name: 'бюджет бандла', cmd: npm, args: ['run', 'bundle:budget'] },
  ];
}

function runStep(step, cwd) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(step.cmd, step.args, { cwd, shell: process.platform === 'win32', env: process.env });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => done({ ...step, code, out, ms: Date.now() - started }));
    child.on('error', (error) => done({ ...step, code: 1, out: String(error), ms: Date.now() - started }));
  });
}

export function summarize(results) {
  const lines = []; let failed = 0;
  for (const r of results) {
    const ok = r.code === 0;
    if (!ok && !r.informational) failed += 1;
    const mark = ok ? 'ok  ' : (r.informational ? 'info' : 'FAIL');
    lines.push(`${mark}  ${String(Math.round(r.ms / 1000)).padStart(4)} с  ${r.name}${!ok && r.hint ? `  → ${r.hint}` : ''}`);
  }
  return { lines, failed };
}

export async function gateSmall({ cwd = ROOT, base = 'origin/dev', log = console.log } = {}) {
  const started = Date.now();
  log(`gate:small — база диапазона ${base}; параллельно: юниты, сборка, no-new-any, smoke-select`);
  const parallel = await Promise.all(parallelSteps(base).map((step) => runStep(step, cwd)));
  const buildOk = parallel.find((r) => r.args.includes('build'))?.code === 0;
  const serial = [];
  if (buildOk) for (const step of serialSteps()) serial.push(await runStep(step, cwd));
  const results = [...parallel, ...serial];
  const { lines, failed } = summarize(results);
  log('');
  for (const line of lines) log(line);
  const select = parallel.find((r) => r.args.includes('scripts/smoke-select.mjs'));
  if (select) {
    log('');
    log('смоки, относящиеся к диффу (гоняются автором отдельно, решение по каждой строке — в ревью):');
    log(select.out.trim() || '  (smoke-select ничего не напечатал)');
  }
  for (const r of results) {
    if (r.code !== 0 && !r.informational) { log(''); log(`--- ${r.name}`); log(r.out.trim()); }
  }
  log('');
  log(`итого ${Math.round((Date.now() - started) / 1000)} с; упало: ${failed}${buildOk ? '' : ' (сверка бандла пропущена — сборка не прошла)'}`);
  return { failed, results };
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const { base } = parseArgs(process.argv.slice(2));
  gateSmall({ base }).then(({ failed }) => { process.exitCode = failed ? 1 : 0; });
}
