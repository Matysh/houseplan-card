#!/usr/bin/env node
// #635: индекс документов ревью — база знаний решений, которую можно прочитать
// за одно чтение.
//
// В `docs/reviews/` ≈ 1 000 документов; что находили по файлу, диалогу или
// подсистеме, узнать можно было только перечитав их. Индекс сводит каждый
// документ в одну строку: issue, этап, раунд, вердикт, число High/Medium и
// заголовки находок. Он генерируется (класс C), а не пишется руками, и
// пересобирается конвейером после публикации каждого документа ревью.
//
//   node scripts/reviews-index.mjs [--dir=docs/reviews] [--output=docs/reviews/INDEX.md] [--check]
//
// `--check` — не писать, а сравнить с существующим файлом (гейт «индекс свеж»).
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const INDEX_FILE = 'INDEX.md';
const DOC_NAME = /^(CODE|SPEC)-REVIEW-(?:issue-)?(\d+)(?:-r(\d+))?(?:-([a-z0-9-]+))?\.md$/i;
const COLOUR = {
  'зелёный': 'зелёный', 'зеленый': 'зелёный', green: 'зелёный',
  'жёлтый': 'жёлтый', 'желтый': 'жёлтый', yellow: 'жёлтый',
  'красный': 'красный', red: 'красный',
};
const COLOUR_RE = /(зелёный|зеленый|жёлтый|желтый|красный|green|yellow|red)(?![а-яёa-z])/i;
const VERDICT_LINE_RE = /(?:[Вв]ердикт|[Vv]erdict)[^\n]{0,60}?\**\s*(зелёный|зеленый|жёлтый|желтый|красный|green|yellow|red)(?![а-яёa-z])/i;

/** Разобрать имя документа: этап, issue, раунд. */
export function parseDocName(name) {
  const match = DOC_NAME.exec(String(name));
  if (!match) return null;
  return {
    stage: match[1].toUpperCase() === 'CODE' ? 'code' : 'spec',
    issue: Number(match[2]),
    round: match[3] ? Number(match[3]) : null,
    suffix: match[4] || null,
  };
}

/** Вердикт: явная строка «Вердикт: **цвет**», иначе — по разделу «Вердикт», иначе «—». */
export function parseVerdict(text) {
  const explicit = VERDICT_LINE_RE.exec(text);
  if (explicit) return COLOUR[explicit[1].toLowerCase()];
  const heading = /^#{1,4}\s*(?:\d+\.\s*)?(?:Вердикт|Verdict|Итог)(?![а-яё])[^\n]*\n([\s\S]*?)(?=\n#{1,4}\s|(?![\s\S]))/m.exec(text);
  if (heading) {
    const section = heading[1];
    const colour = COLOUR_RE.exec(section);
    if (colour) return COLOUR[colour[1].toLowerCase()];
    if (/блокиру|не принят|отклон|red/i.test(section)) return 'красный';
    if (/принят|принимается|готов|без замечаний|можно сливать|регрессий нет|proceed|approved/i.test(section)) return 'зелёный';
  }
  // Старые документы пишут «зелёный вердикт» в свободной форме — ищем в хвосте.
  const tail = /(зелёный|зеленый|жёлтый|желтый|красный|green|yellow|red)\**\s+вердикт/i.exec(text.slice(-2500));
  if (tail) return COLOUR[tail[1].toLowerCase()];
  return '—';
}

/** Числа High/Medium из строки вердикта либо из заголовков находок. */
export function parseCounts(text) {
  const high = /High:\s*(\d+)/.exec(text);
  const medium = /Medium:\s*(\d+)/.exec(text);
  if (high || medium) return { high: high ? Number(high[1]) : 0, medium: medium ? Number(medium[1]) : 0 };
  const headings = [...text.matchAll(/^#{2,4}\s*(H\d+|M\d+)\b/gm)].map((m) => m[1][0]);
  return { high: headings.filter((h) => h === 'H').length, medium: headings.filter((h) => h === 'M').length };
}

/**
 * Заголовки находок: `### 1. …`, `### H1 — …`, `### M2: …`, строки таблиц с
 * severity в первых ячейках. Обрезаются до 90 символов; не больше `limit`.
 */
export function parseFindings(text, limit = 6) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const title = String(raw).replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim().replace(/[.:;—–-]+$/, '').trim();
    if (!title || seen.has(title)) return;
    seen.add(title);
    out.push(title.length > 90 ? `${title.slice(0, 87)}…` : title);
  };
  for (const m of text.matchAll(/^#{3,4}\s*(?:(?:H|M|L)\d+\s*[—–:.-]\s*|\d+\.\s*)([^\n]+)/gm)) push(m[1]);
  for (const m of text.matchAll(/^\|\s*(?:\*\*)?(?:H\d+|M\d+|High|Medium)(?:\*\*)?\s*\|(?:[^|\n]*\|)?\s*([^|\n]+)\|/gm)) push(m[1]);
  return out.slice(0, limit);
}

/** Одна запись индекса по документу. */
export function indexEntry(name, text) {
  const meta = parseDocName(name);
  if (!meta) return null;
  return {
    name, ...meta,
    verdict: parseVerdict(text),
    ...parseCounts(text),
    findings: parseFindings(text),
  };
}

export function collectEntries(dir, read = (name) => readFileSync(join(dir, name), 'utf8')) {
  const names = readdirSync(dir).filter((name) => name.endsWith('.md') && name !== INDEX_FILE).sort();
  const entries = [];
  const skipped = [];
  for (const name of names) {
    const entry = indexEntry(name, read(name));
    if (entry) entries.push(entry); else skipped.push(name);
  }
  return { entries, skipped };
}

const badge = (verdict) => ({ 'зелёный': '🟢', 'жёлтый': '🟡', 'красный': '🔴' }[verdict] || '⚪');

export function renderIndex({ entries, skipped = [] }) {
  const byIssue = new Map();
  for (const entry of entries) {
    const list = byIssue.get(entry.issue) || [];
    list.push(entry);
    byIssue.set(entry.issue, list);
  }
  const issues = [...byIssue.keys()].sort((a, b) => b - a);
  const lines = [];
  lines.push('# Индекс ревью');
  lines.push('');
  lines.push(`Генерируется \`node scripts/reviews-index.mjs\` (#635) — не редактировать руками. Документов: ${entries.length}, issue: ${issues.length}. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок.`);
  lines.push('');
  lines.push('| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки |');
  lines.push('|---|---|---|---|---:|---:|---|');
  for (const issue of issues) {
    const docs = byIssue.get(issue).sort((a, b) => (a.stage === b.stage ? (a.round || 0) - (b.round || 0) : a.stage === 'spec' ? -1 : 1));
    for (const doc of docs) {
      const round = doc.round ? `r${doc.round}` : (doc.suffix || '—');
      lines.push(`| #${issue} | [${doc.name}](${doc.name}) | ${doc.stage} · ${round} | ${badge(doc.verdict)} ${doc.verdict} | ${doc.high} | ${doc.medium} | ${doc.findings.join('; ').replace(/\|/g, '\\|') || '—'} |`);
    }
  }
  if (skipped.length) {
    lines.push('');
    lines.push(`Вне схемы имён (не индексируются): ${skipped.map((name) => `\`${name}\``).join(', ')}.`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildIndex(dir) {
  return renderIndex(collectEntries(dir));
}

if (isMainModule(import.meta.url)) {
  const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dir = arg('dir', 'docs/reviews');
  const output = arg('output', join(dir, INDEX_FILE));
  const markdown = buildIndex(dir);
  if (process.argv.includes('--check')) {
    const current = existsSync(output) ? readFileSync(output, 'utf8') : '';
    if (current !== markdown) {
      console.error(`${output} устарел — пересобрать: node scripts/reviews-index.mjs`);
      process.exit(1);
    }
    console.log(`${output} свеж`);
  } else {
    writeFileSync(output, markdown, 'utf8');
    console.log(`${output}: ${markdown.split('\n').length} строк`);
  }
}
