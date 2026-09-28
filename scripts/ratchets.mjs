#!/usr/bin/env node
/**
 * Храповики беты (#699, PROCESS.md §8).
 *
 *   node scripts/ratchets.mjs report [--warn]   # факт против потолков
 *   node scripts/ratchets.mjs tighten           # потолки := факт кандидата
 *
 * С #699 задача может вырасти над потолком беты в пределах полосы, а снижение
 * её не красит. Вторая сторона храповика живёт здесь: релиз-менеджер на
 * кандидате беты опускает потолки до факта одной командой, и выигрыш,
 * накопленный линией, фиксируется одним коммитом, а не правкой общих чисел в
 * каждой ветке — на них параллельные задачи и конфликтовали.
 *
 * Потолки лежат там же, где их читают гейты: строки ядер — в
 * `test/core-file-budget.test.mjs` (CAPS), gzip-графы — в
 * `scripts/bundle-budget.mjs`, числа связности — в
 * `scripts/monolith-baseline.json`. Бандл и `bundleBytes` меряются по
 * собранному `dist/`: на кандидате он закоммичен свежим (`npm run bundle:release`).
 *
 * `report --warn` печатает `::warning::` на рыхлые и вышедшие в полосу потолки
 * и всегда выходит с 0: это напоминание публикации беты, а не её гейт.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import {
  INITIAL_VIEW_CEILING_BAND, LAZY_GRAPH_CEILING_BAND,
} from './bundle-budget.mjs';
import {
  BASELINE_FILE, METRIC_BANDS, METRIC_NAMES, collectMetrics, readBaseline,
} from './monolith-metrics.mjs';

export const CORE_BUDGET_FILE = 'test/core-file-budget.test.mjs';
export const BUNDLE_BUDGET_FILE = 'scripts/bundle-budget.mjs';
/** Полоса ядра — та же, что у теста (#699); тест сверяет, что числа не разошлись. */
export const CORE_BAND = 50;

export const BUNDLE_CEILINGS = Object.freeze([
  { name: 'INITIAL_VIEW_GZIP_CEILING', metric: 'initialViewGzipBytes', label: 'initial View', band: INITIAL_VIEW_CEILING_BAND },
  { name: 'LAZY_EDITOR_GZIP_CEILING', metric: 'lazyEditorGzipBytes', label: 'lazy editor', band: LAZY_GRAPH_CEILING_BAND },
  { name: 'LAZY_ONBOARDING_GZIP_CEILING', metric: 'lazyOnboardingGzipBytes', label: 'lazy onboarding', band: LAZY_GRAPH_CEILING_BAND },
  { name: 'LAZY_FURNITURE_ART_GZIP_CEILING', metric: 'lazyFurnitureArtGzipBytes', label: 'lazy furniture art', band: LAZY_GRAPH_CEILING_BAND },
]);

const capsBlock = (source) => {
  const start = source.indexOf('const CAPS = {');
  if (start < 0) throw new Error(`${CORE_BUDGET_FILE}: нет блока const CAPS`);
  const end = source.indexOf('};', start);
  return { start, end, text: source.slice(start, end) };
};

/** Потолки ядер из исходника теста: `'src/x.ts': 12891,`. */
export function readCoreCaps(source) {
  const caps = {};
  for (const match of capsBlock(source).text.matchAll(/^\s*'([^']+)':\s*(\d+),\s*$/gm)) caps[match[1]] = Number(match[2]);
  return caps;
}

/** Тот же исходник с новыми числами; комментарии и порядок — как были. */
export function rewriteCoreCaps(source, facts) {
  const { start, end, text } = capsBlock(source);
  const next = text.replace(/^(\s*)'([^']+)':\s*(\d+),(\s*)$/gm,
    (line, indent, file, value, tail) => (file in facts ? `${indent}'${file}': ${facts[file]},${tail}` : line));
  return source.slice(0, start) + next + source.slice(end);
}

/** `301_000` → 301000. */
export function readConst(source, name) {
  const match = new RegExp(`^export const ${name} = ([\\d_]+);$`, 'm').exec(source);
  if (!match) throw new Error(`${BUNDLE_BUDGET_FILE}: нет export const ${name}`);
  return Number(match[1].replaceAll('_', ''));
}

const grouped = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '_');

export function rewriteConst(source, name, value) {
  readConst(source, name);
  return source.replace(new RegExp(`^export const ${name} = [\\d_]+;$`, 'm'), `export const ${name} = ${grouped(value)};`);
}

/** Состояние одного храповика относительно потолка беты и полосы. */
export function ratchetState(fact, ceiling, band) {
  if (!Number.isFinite(fact) || !Number.isFinite(ceiling)) return 'missing';
  if (fact > ceiling + band) return 'grew';
  if (fact > ceiling) return 'over';
  if (fact < ceiling) return 'loose';
  return 'tight';
}

export function ratchetRows({ coreFacts = {}, coreCaps = {}, bundleFacts = {}, bundleCeilings = {}, metrics = {}, baseline = {} }) {
  const rows = [];
  for (const [file, cap] of Object.entries(coreCaps)) {
    rows.push({ kind: 'core', name: file, fact: coreFacts[file], ceiling: cap, band: CORE_BAND });
  }
  for (const entry of BUNDLE_CEILINGS) {
    rows.push({ kind: 'bundle', name: entry.label, key: entry.name, fact: bundleFacts[entry.metric], ceiling: bundleCeilings[entry.name], band: entry.band });
  }
  for (const name of METRIC_NAMES) {
    rows.push({ kind: 'monolith', name, fact: metrics[name], ceiling: baseline?.[name], band: METRIC_BANDS[name] ?? 0 });
  }
  return rows.map((row) => ({ ...row, state: ratchetState(row.fact, row.ceiling, row.band) }));
}

const STATE_TEXT = {
  tight: 'равен факту',
  loose: 'рыхлый — опустить до факта',
  over: 'факт в полосе над потолком — поднять до факта или вернуть',
  grew: 'факт выше полосы — гейт ветки обязан был покраснеть',
  missing: 'не измерен',
};

export function formatRow(row) {
  const delta = Number.isFinite(row.fact) && Number.isFinite(row.ceiling) ? row.fact - row.ceiling : null;
  const sign = delta == null ? '' : ` (${delta > 0 ? '+' : ''}${delta}, полоса +${row.band})`;
  return `${row.kind.padEnd(8)} ${row.name}: факт ${row.fact ?? '—'} · потолок ${row.ceiling ?? '—'}${sign} — ${STATE_TEXT[row.state]}`;
}

function measure(root) {
  const coreSource = readFileSync(resolve(root, CORE_BUDGET_FILE), 'utf8');
  const bundleSource = readFileSync(resolve(root, BUNDLE_BUDGET_FILE), 'utf8');
  const coreCaps = readCoreCaps(coreSource);
  const coreFacts = Object.fromEntries(Object.keys(coreCaps).map((file) => [
    file, existsSync(resolve(root, file)) ? readFileSync(resolve(root, file), 'utf8').split('\n').length : undefined,
  ]));
  const manifestPath = resolve(root, 'dist/houseplan-assets.json');
  const bundleFacts = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const bundleCeilings = Object.fromEntries(BUNDLE_CEILINGS.map((entry) => [entry.name, readConst(bundleSource, entry.name)]));
  const { metrics } = collectMetrics(root);
  const baseline = readBaseline(root) || {};
  return { coreSource, bundleSource, coreCaps, coreFacts, bundleFacts, bundleCeilings, metrics, baseline };
}

if (isMainModule(import.meta.url)) {
  const [command] = process.argv.slice(2);
  const root = process.cwd();
  try {
    const m = measure(root);
    const rows = ratchetRows(m);
    if (command === 'report') {
      const warn = process.argv.includes('--warn');
      for (const row of rows) console.log(formatRow(row));
      const attention = rows.filter((row) => row.state !== 'tight');
      if (warn) {
        for (const row of attention) console.log(`::warning::храповик ${row.kind} ${row.name}: ${STATE_TEXT[row.state]} — node scripts/ratchets.mjs tighten`);
        process.exit(0);
      }
      process.exit(rows.some((row) => row.state === 'grew' || row.state === 'missing') ? 1 : 0);
    } else if (command === 'tighten') {
      const missing = rows.filter((row) => row.state === 'missing');
      if (missing.length) throw new Error(`не измерено: ${missing.map((row) => `${row.kind} ${row.name}`).join(', ')} — сначала npm run build`);
      const coreFacts = Object.fromEntries(rows.filter((row) => row.kind === 'core').map((row) => [row.name, row.fact]));
      writeFileSync(resolve(root, CORE_BUDGET_FILE), rewriteCoreCaps(m.coreSource, coreFacts));
      let bundleSource = m.bundleSource;
      for (const row of rows.filter((r) => r.kind === 'bundle')) bundleSource = rewriteConst(bundleSource, row.key, row.fact);
      writeFileSync(resolve(root, BUNDLE_BUDGET_FILE), bundleSource);
      const baseline = Object.fromEntries(METRIC_NAMES.map((name) => [name, m.metrics[name]]));
      writeFileSync(resolve(root, BASELINE_FILE), `${JSON.stringify(baseline, null, 2)}\n`);
      for (const row of rows.filter((r) => r.state !== 'tight')) console.log(`${row.kind} ${row.name}: ${row.ceiling} → ${row.fact}`);
      console.log(`потолки опущены до факта: ${CORE_BUDGET_FILE}, ${BUNDLE_BUDGET_FILE}, ${BASELINE_FILE} — закоммитить вместе с кандидатом беты`);
    } else {
      throw new Error('usage: ratchets.mjs report [--warn] | tighten');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(command === 'report' && process.argv.includes('--warn') ? 0 : 1);
  }
}
