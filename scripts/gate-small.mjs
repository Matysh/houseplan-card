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
//   npm run gate:small -- --smokes           # #496: после сборки — bundle-sync и
//                                            #   смоки, выбранные по диффу (прямые
//                                            #   и зарегистрированные), по два параллельно
//
// Фазы разделены зависимостями (#496): read-only проверки идут параллельно сразу;
// browser-consumers (смоки) — только после подготовки артефактов (build →
// bundle-sync), потому что читают собранное дерево demo/srv/assets.

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableCommand } from './spawn-portable.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = 'npm';

export function parseArgs(argv) {
  const base = argv.find((a) => a.startsWith('--base='))?.slice('--base='.length) || 'origin/dev';
  const smokes = argv.includes('--smokes');
  const jobs = Number(argv.find((a) => a.startsWith('--jobs='))?.slice('--jobs='.length) || 2);
  return { base, smokes, jobs: Number.isInteger(jobs) && jobs > 0 ? jobs : 2 };
}

/** Смоки для прогона из JSON smoke-select: прямые + зарегистрированные, без «широких». */
export function smokesToRun(selection) {
  if (!selection || selection.noExecutableDiff) return [];
  const names = [...(selection.direct || []), ...(selection.registered || [])]
    .map((entry) => (typeof entry === 'string' ? entry : entry.smoke))
    .filter(Boolean);
  return [...new Set(names)].sort();
}

/** Ограниченный параллелизм: browser-consumers тяжёлые, по умолчанию два разом. */
export async function runLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

/** Шаги параллельной фазы: имя → команда. `base` — начало диапазона диффа. */
export function parallelSteps(base) {
  return [
    { name: 'юниты (npm test)', cmd: npm, args: ['test'] },
    { name: 'сборка + typecheck (npm run build)', cmd: npm, args: ['run', 'build'] },
    { name: 'новый код не добавляет any', cmd: process.execPath, args: ['scripts/no-new-any.mjs', '--base', base, '--head', 'HEAD'] },
    { name: 'смоки по диффу (smoke-select)', cmd: process.execPath, args: ['scripts/smoke-select.mjs', '--base', base, '--head', 'HEAD', '--json'], informational: true },
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
    // Оболочка только для npm.cmd на Windows (#496): node/git — напрямую.
    const { cmd, shell } = portableCommand(step.cmd);
    const child = spawn(cmd, step.args, { cwd, shell, env: process.env });
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

export async function gateSmall({ cwd = ROOT, base = 'origin/dev', smokes = false, jobs = 2, log = console.log } = {}) {
  const started = Date.now();
  log(`gate:small — база диапазона ${base}; параллельно: юниты, сборка, no-new-any, smoke-select${smokes ? `; затем bundle-sync и смоки по диффу (×${jobs})` : ''}`);
  const parallel = await Promise.all(parallelSteps(base).map((step) => runStep(step, cwd)));
  const buildOk = parallel.find((r) => r.args.includes('build'))?.code === 0;
  const serial = [];
  if (buildOk) for (const step of serialSteps()) serial.push(await runStep(step, cwd));
  // Browser-consumers — после подготовки артефактов (#496): bundle-sync раскладывает
  // собранное дерево в demo/srv/assets, смоки читают его и отказываются на несвежем.
  let selected = [];
  if (smokes && buildOk) {
    const select = parallel.find((r) => r.args.includes('scripts/smoke-select.mjs'));
    try { selected = smokesToRun(JSON.parse(select?.out || 'null')); } catch { selected = []; }
    if (selected.length) {
      serial.push(await runStep({ name: 'подготовка артефактов (bundle-sync)', cmd: process.execPath, args: ['scripts/bundle-sync.mjs'] }, cwd));
      if (serial.at(-1).code === 0) {
        const runs = await runLimited(selected, jobs, (smoke) => runStep({ name: `смок ${smoke}`, cmd: process.execPath, args: [`demo/${smoke}`] }, cwd));
        serial.push(...runs);
      }
    }
  }
  const results = [...parallel, ...serial];
  const { lines, failed } = summarize(results);
  log('');
  for (const line of lines) log(line);
  const select = parallel.find((r) => r.args.includes('scripts/smoke-select.mjs'));
  if (select) {
    log('');
    let selection = null;
    try { selection = JSON.parse(select.out || 'null'); } catch { /* ниже — сырой вывод */ }
    if (!selection) log(select.out.trim() || '  (smoke-select ничего не напечатал)');
    else if (selection.noExecutableDiff) log('smoke-select: исполняемого frontend-диффа нет — смоки этим диффом не выбираются');
    else {
      const names = smokesToRun(selection);
      log(`smoke-select: прямые и зарегистрированные (${names.length})${smokes ? ' — прогнаны выше' : ' — гоняются автором (или `--smokes`), решение по каждой строке в ревью'}:`);
      for (const name of names) log(`  demo/${name}`);
      if ((selection.broad || []).length) log(`  «широких» символов: ${selection.broad.length} — решает ревьюер, автоматически не гоняются`);
    }
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
  const { base, smokes, jobs } = parseArgs(process.argv.slice(2));
  gateSmall({ base, smokes, jobs }).then(({ failed }) => { process.exitCode = failed ? 1 : 0; });
}
