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
//   node scripts/reviews-index.mjs --commit-if-stale --issue=NN [--dir=…]
//
// `--check` — не писать, а сравнить с существующим файлом (гейт «индекс свеж»;
// тот же инвариант держит тест `#635 индекс свеж`).
// `--commit-if-stale` — пересобрать и, если файл изменился, закоммитить его
// коммитом конвейера (класс C). Индекс — снимок каталога: ребейз ветки на
// dev, получивший новые документы, устаревает его молча (r2 #635 H1), поэтому
// конвейер зовёт этот режим после каждого своего ребейза — при приведении к
// dev перед ревью и при слиянии кандидата.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
/** Строка, НАЧИНАЮЩАЯСЯ с «Вердикт» (с заглавной, после `- `/`**`): своя, а не пересказ чужого раунда. */
// Без флага `i`: строчное «вердикт красный» в шапке — пересказ, а не свой вердикт.
const VERDICT_OWN_LINE_RE = /^[ \t]*(?:[-*]\s*)?\**(?:Вердикт|Verdict)[^\n]{0,60}?\**\s*([Зз]елёный|[Зз]еленый|[Жж]ёлтый|[Жж]елтый|[Кк]расный|[Gg]reen|[Yy]ellow|[Rr]ed)(?![а-яёa-z])/m;

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

/**
 * Вердикт. Порядок доверия: своя строка «Вердикт: цвет» с начала строки →
 * секция «## Вердикт» → упоминание «вердикт цвет» где угодно → свободная
 * форма хвоста → «—». r1 #635: документ r2 пересказывал вердикт r1
 * («вердикт красный, High: 1») в шапке, и первое совпадение по тексту
 * выдавало чужой цвет.
 */
export function parseVerdict(text) {
  const own = VERDICT_OWN_LINE_RE.exec(text);
  if (own) return COLOUR[own[1].toLowerCase()];
  const section = verdictSection(text);
  if (section != null) {
    const colour = COLOUR_RE.exec(section);
    if (colour) return COLOUR[colour[1].toLowerCase()];
    if (/блокиру|не принят|отклон|red/i.test(section)) return 'красный';
    if (/принят|принимается|готов|без замечаний|можно сливать|регрессий нет|proceed|approved/i.test(section)) return 'зелёный';
  }
  const explicit = VERDICT_LINE_RE.exec(text);
  if (explicit) return COLOUR[explicit[1].toLowerCase()];
  // Старые документы пишут «зелёный вердикт» в свободной форме — ищем в хвосте.
  const tail = /(зелёный|зеленый|жёлтый|желтый|красный|green|yellow|red)\**\s+вердикт/i.exec(text.slice(-2500));
  if (tail) return COLOUR[tail[1].toLowerCase()];
  return '—';
}

const VERDICT_SECTION_RE = /^#{1,4}\s*(?:\d+\.\s*)?(?:Вердикт|Verdict|Итог)(?![а-яё])[^\n]*\n([\s\S]*?)(?=\n#{1,4}\s|(?![\s\S]))/m;
const SEVERITY = { high: 'high', h: 'high', medium: 'medium', m: 'medium', low: 'low', l: 'low' };
/** Заголовок находки: `### H1 — …`, `### Medium-2 (…) — …`, `### Medium (в скоупе) — …`, `### Low`. */
const SEVERITY_HEADING_RE = /^(#{2,4})\s*\**\[?(High|Medium|Low|[HML])(?:[-\s]?(?:[HML])?(\d+)[a-z-]*)?\]?\**(?:\s*\([^)\n]*\))?\s*(?:[—–:.-]\s*)?(.*)$/gmi;
/** `## Находка 1 (High, в скоупе) — title` — форма ранних документов; группы те же, что у SEVERITY_HEADING_RE. */
const FINDING_HEADING_RE = /^(#{2,4})\s*Находка\s*(\d+)?\s*\((High|Medium|Low)[^)\n]*\)\s*(?:[—–:.-]\s*)?(.*)$/i;
const NOTHING_RE = /^\s*[—–-]?\s*(?:нет|не найдено|не обнаружено|отсутствуют|не блокиру\S*|снима\S*(?:\s+с\s+записью)?|none|no|—)\s*[.,;]?\s*$/i;

/** Строка вердикта — та, где стоит слово «Вердикт» и рядом счётчик High/Medium. */
function verdictLine(text, own = false) {
  const marker = own ? /^[ \t]*(?:[-*]\s*)?\**(?:Вердикт|Verdict)/ : /(?:[Вв]ердикт|[Vv]erdict)/;
  return text.split('\n').find((line) => marker.test(line) && /(?:High|Medium):\s*\d+/.test(line)) || null;
}

/** Секция «## Вердикт» (тело до следующего заголовка) либо null. */
function verdictSection(text) {
  const match = VERDICT_SECTION_RE.exec(text);
  return match ? match[1] : null;
}

const countsIn = (scope) => {
  const high = /High:\s*(\d+)/.exec(scope);
  const medium = /Medium:\s*(\d+)/.exec(scope);
  return high || medium ? { high: high ? Number(high[1]) : 0, medium: medium ? Number(medium[1]) : 0 } : null;
};

/**
 * Заголовки находок с их severity и телом секции. Тело — строки до
 * следующего заголовка того же или более высокого уровня.
 */
function severityBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    SEVERITY_HEADING_RE.lastIndex = 0;
    let m = SEVERITY_HEADING_RE.exec(lines[i]);
    let [severity, id] = m ? [m[2], m[3]] : [];
    if (!m) {
      m = FINDING_HEADING_RE.exec(lines[i]);
      if (!m) continue;
      [severity, id] = [m[3], m[2]];
    }
    const level = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = /^(#{1,4})\s/.exec(lines[j]);
      if (next && next[1].length <= level) break;
      body.push(lines[j]);
    }
    blocks.push({ line: i, severity: SEVERITY[severity.toLowerCase()], id: id ? Number(id) : null, title: (m[4] || '').trim(), body });
  }
  return blocks;
}

/**
 * Первый абзац тела секции как заголовок находки без заголовка. Абзац — до
 * пустой строки, перенесённые строки склеиваются: иначе у буллета, не
 * уместившегося в одну физическую строку, брался его хвост (r2 #635 M1,
 * `CODE-REVIEW-485-r4`: «пусто). Не эскалирую…»). Маркер буллета и код
 * `**M1.**` снимаются; абзац, начинающийся с «не найдено»/«нет», — не находка.
 */
function firstParagraph(body) {
  const paragraphs = [];
  let current = [];
  for (const raw of [...body, '']) {
    const line = raw.trim();
    if (!line) { if (current.length) paragraphs.push(current.join(' ')); current = []; continue; }
    if (/^[|#<]/.test(line) || /^<!--/.test(line)) { if (current.length) paragraphs.push(current.join(' ')); current = []; continue; }
    current.push(line);
  }
  for (const paragraph of paragraphs) {
    const text = paragraph.replace(/^[-*]\s+/, '').replace(/^\**[HML]\d+\**\s*[.:—–-]?\s*/, '').trim();
    if (!text || text.startsWith('(')) continue; // служебная скобка «(унаследовано из r1…)» — не находка
    if (NOTHING_RE.test(text) || /^(?:\**(?:High|Medium|Low)\**\s*)?(?:не найдено|не обнаружено|нет находок|нет\b|отсутству)/i.test(text)) return null;
    return text;
  }
  return null;
}

/** `**M1. …**`, `**H2 — …**`, `- M3: …` в теле секции — пронумерованные находки без заголовка. */
function numberedItems(body) {
  const items = [];
  for (const raw of body) {
    const line = raw.trim();
    const m = /^(?:[-*]\s*)?\**([HML])(\d+)\**\s*[.:—–-]\s*(.+)$/.exec(line);
    if (m) { items.push({ severity: SEVERITY[m[1].toLowerCase()], id: Number(m[2]), title: m[3] }); continue; }
    // Перенесённая строка того же пункта — продолжение заголовка (r2 #635 M1).
    const last = items[items.length - 1];
    if (last && line && !/^[|#<>-]/.test(line) && !last.closed) last.title += ` ${line}`;
    else if (last) last.closed = true;
  }
  return items;
}

/**
 * Числа High/Medium. Порядок доверия: счётчик в строке или секции «Вердикт»
 * собственного документа → счётчик, единственный во всём тексте → подсчёт по
 * заголовкам и нумерованным находкам. Первое попавшееся `High: N` по всему
 * файлу больше не берётся: r1 #635 показал, что оно бывает цитатой чужого
 * документа («ТЗ прошло зелёным на r3 (High: 0, Medium: 0)»).
 */
export function parseCounts(text) {
  for (const scope of [verdictLine(text, true), verdictSection(text), verdictLine(text)]) {
    const counts = scope ? countsIn(scope) : null;
    if (counts) return counts;
  }
  const highs = new Set([...text.matchAll(/High:\s*(\d+)/g)].map((m) => m[1]));
  const mediums = new Set([...text.matchAll(/Medium:\s*(\d+)/g)].map((m) => m[1]));
  if ((highs.size || mediums.size) && highs.size <= 1 && mediums.size <= 1) {
    return { high: Number([...highs][0] || 0), medium: Number([...mediums][0] || 0) };
  }
  const ids = { high: new Set(), medium: new Set() };
  let anonymous = { high: 0, medium: 0 };
  for (const block of severityBlocks(text)) {
    if (block.severity === 'low') continue;
    if (block.id != null) { ids[block.severity].add(block.id); continue; }
    const items = numberedItems(block.body).filter((item) => item.severity === block.severity);
    if (items.length) { for (const item of items) ids[block.severity].add(item.id); continue; }
    const first = block.body.map((l) => l.trim()).find(Boolean) || '';
    if (NOTHING_RE.test(block.title || first) || (!block.title && !first)) continue;
    anonymous = { ...anonymous, [block.severity]: anonymous[block.severity] + 1 };
  }
  return { high: ids.high.size + anonymous.high, medium: ids.medium.size + anonymous.medium };
}

/**
 * Заголовки находок: `### 1. …`, `### H1 — …`, `### M2: …`,
 * `### Medium (в скоупе) — …`, секция `### Medium` с `**M1. …**` внутри или
 * с первым абзацем как заголовком, строки таблиц с severity в первых
 * ячейках. Обрезаются до 90 символов; не больше `limit`.
 */
export function parseFindings(text, limit = 6) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    // Снимается разметка, а не символы: `_` внутри `smoke_links.mjs` — часть имени.
    const title = String(raw).replace(/[`*]/g, '').replace(/(^|\s)_+|_+(\s|$)/g, '$1$2').replace(/\s+/g, ' ').trim()
      .replace(/^[HML]\d+\s*[.:—–-]\s*/, '').replace(/[.,:;—–-]+$/, '').trim();
    if (!title || NOTHING_RE.test(title) || seen.has(title)) return;
    seen.add(title);
    out.push(title.length > 90 ? `${title.slice(0, 87)}…` : title);
  };
  // Источники сливаются в порядке документа: заголовок r1 не должен уступать
  // место таблице из конца файла только потому, что он другой формы.
  const found = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const numbered = /^#{3,4}\s*\d+\.\s*([^\n]+)/.exec(line);
    if (numbered) found.push({ line: index, title: numbered[1] });
    const row = /^\|\s*(?:\*\*)?(?:H\d+|M\d+|High|Medium)(?:\*\*)?\s*\|(?:[^|\n]*\|)?\s*([^|\n]+)\|/.exec(line);
    if (row) found.push({ line: index, title: row[1] });
  });
  for (const block of severityBlocks(text)) {
    if (block.title) { found.push({ line: block.line, title: block.title }); continue; }
    const items = numberedItems(block.body);
    if (items.length) { items.forEach((item, k) => found.push({ line: block.line + k / 100, title: item.title })); continue; }
    const first = firstParagraph(block.body);
    if (first) found.push({ line: block.line, title: first });
  }
  found.sort((a, b) => a.line - b.line);
  for (const item of found) push(item.title);
  return out.slice(0, limit);
}

/**
 * Файлы, названные в находках: пути в обратных кавычках внутри секций
 * High/Medium/Low (с номером строки или без). Это и есть ответ на «что
 * находили по файлу X» — `grep 'form-kit' INDEX.md` (r1 #635 AC2).
 */
export function parseFiles(text, limit = 8) {
  const out = [];
  const seen = new Set();
  const blocks = severityBlocks(text);
  const scope = blocks.length ? blocks.map((b) => [b.title, ...b.body].join('\n')).join('\n') : '';
  for (const m of scope.matchAll(/`((?:[\w@.-]+\/)*[\w@.-]+\.(?:ts|mjs|js|py|md|yml|yaml|json|css|html|sh|ps1|mermaid))(?::\d+(?:[-–]\d+)?)?`/g)) {
    const file = m[1].replace(/^\.\//, '');
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(file);
    if (out.length >= limit) break;
  }
  return out;
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
    files: parseFiles(text),
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
  lines.push(`Генерируется \`node scripts/reviews-index.mjs\` (#635) — не редактировать руками. Документов: ${entries.length}, issue: ${issues.length}. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок. Файлы — пути, названные в находках; ищите по имени файла: \`grep form-kit INDEX.md\`.`);
  lines.push('');
  lines.push('| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |');
  lines.push('|---|---|---|---|---:|---:|---|---|');
  for (const issue of issues) {
    const docs = byIssue.get(issue).sort((a, b) => (a.stage === b.stage ? (a.round || 0) - (b.round || 0) : a.stage === 'spec' ? -1 : 1));
    for (const doc of docs) {
      const round = doc.round ? `r${doc.round}` : (doc.suffix || '—');
      lines.push(`| #${issue} | [${doc.name}](${doc.name}) | ${doc.stage} · ${round} | ${badge(doc.verdict)} ${doc.verdict} | ${doc.high} | ${doc.medium} | ${doc.findings.join('; ').replace(/\|/g, '\\|') || '—'} | ${(doc.files || []).map((f) => `\`${f}\``).join(' ') || '—'} |`);
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

export const CONVEYOR_IDENTITY = ['-c', 'user.name=claude[bot]', '-c', 'user.email=209825114+claude[bot]@users.noreply.github.com'];

/**
 * Пересобрать индекс и закоммитить, если он изменился. Возвращает
 * `{ changed, sha }`: `sha` — новый HEAD при коммите, иначе null.
 * `git` — исполнитель `(args) => { status, stdout, stderr }` (для теста).
 */
export function commitIfStale({ dir, output = join(dir, INDEX_FILE), issue, git = defaultGit }) {
  if (!existsSync(dir)) return { changed: false, sha: null }; // каталога нет — индексировать нечего
  const markdown = buildIndex(dir);
  const current = existsSync(output) ? readFileSync(output, 'utf8') : '';
  if (current === markdown) return { changed: false, sha: null };
  writeFileSync(output, markdown, 'utf8');
  const must = (args, what) => {
    const r = git(args);
    if (r.status !== 0) throw new Error(`${what}: ${r.stderr || r.stdout}`);
    return String(r.stdout || '').trim();
  };
  must(['add', '--', output], 'git add');
  const trailer = issue ? `\n\nIssue: #${issue}\nUser-Visible: no\n` : '\n\nUser-Visible: no\n';
  must([...CONVEYOR_IDENTITY, 'commit', '-q', '-m', `docs(reviews): индекс после сдвига каталога${issue ? ` (#${issue})` : ''}${trailer}`], 'git commit');
  return { changed: true, sha: must(['rev-parse', 'HEAD'], 'rev-parse') };
}

function defaultGit(args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

if (isMainModule(import.meta.url)) {
  const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dir = arg('dir', 'docs/reviews');
  const output = arg('output', join(dir, INDEX_FILE));
  if (process.argv.includes('--commit-if-stale')) {
    const { changed, sha } = commitIfStale({ dir, output, issue: arg('issue', '') });
    console.log(changed ? `${output} пересобран и закоммичен: ${sha}` : `${output} свеж — коммит не нужен`);
    process.exit(0);
  }
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
