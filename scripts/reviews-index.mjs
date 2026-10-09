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
//   node scripts/reviews-index.mjs [--dir=docs/reviews] [--output=docs/reviews/INDEX.md] [--check] [--strict]
//   node scripts/reviews-index.mjs --commit-if-stale --issue=NN [--dir=…]
//
// `--check` — не писать, а сравнить с существующим файлом (гейт «индекс свеж»;
// тот же инвариант держит тест `#635 индекс свеж`).
// `--strict` — отказать до записи, если в каталоге есть неизвестное имя
// документа; точка публикации release-review использует этот режим.
// `--commit-if-stale` — пересобрать и, если файл изменился, закоммитить его
// коммитом конвейера (класс C). Индекс — снимок каталога: ребейз ветки на
// dev, получивший новые документы, устаревает его молча (r2 #635 H1), поэтому
// конвейер зовёт этот режим после каждого своего ребейза — при приведении к
// dev перед ревью и при слиянии кандидата.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { renderedMarkdown } from './md-anchors.mjs';

export const INDEX_FILE = 'INDEX.md';
const DOC_NAME = /^(CODE|SPEC)-REVIEW-(?:issue-)?(\d+)(?:-r(\d+))?(?:-([a-z0-9-]+))?\.md$/i;
const RELEASE_DOC_NAME = /^RELEASE-REVIEW-(v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\.md$/i;
// #696/#727: пакетное ревью ship — ночью заранее; перед бетой проверка покрытия
// и ревью непрочитанной дельты (PROCESS.md §11.7). Документ дельты — по тегу беты;
// ночной `SHIP-REVIEW-<база>-dev-<sha12>.md` — по базе диапазона и SHA головы dev.
const SHIP_DOC_NAME = /^SHIP-REVIEW-(v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta\.(?:0|[1-9]\d*))?)(-dev-[0-9a-f]{12})?\.md$/i;
const COLOUR = {
  'зелёный': 'зелёный', 'зеленый': 'зелёный', green: 'зелёный',
  'жёлтый': 'жёлтый', 'желтый': 'жёлтый', yellow: 'жёлтый',
  'красный': 'красный', red: 'красный',
};
// #811: a colour is a standalone token, not `validate-red`, `infrared` or
// `red_flag`. Markdown emphasis/code delimiters may surround the whole token.
// Share both boundaries across all verdict paths, including the legacy tail.
const COLOUR_TOKEN = String.raw`(?<![\p{L}\p{N}_-])[*_\x60]*([Зз]елёный|[Зз]еленый|[Жж]ёлтый|[Жж]елтый|[Кк]расный|[Gg]reen|[Yy]ellow|[Rr]ed)[*_\x60]*(?![\p{L}\p{N}_-])`;
const COLOUR_RE = new RegExp(COLOUR_TOKEN, 'iu');
// `(?!\s+r\d)`: «Вердикт r2 — зелёный» — пересказ чужого раунда (#779), не вердикт документа ни в каком виде.
const VERDICT_LINE_RE = new RegExp(String.raw`(?:Вердикт|Verdict)(?!\s+r\d)[^\n]{0,60}?${COLOUR_TOKEN}`, 'iu');
/**
 * Своя строка вердикта — «Вердикт: цвет» по шаблону §7.2: с начала строки
 * (после `- `/`**`), двоеточие СРАЗУ после слова, вокруг — пробелы и разметка
 * (`**Вердикт: жёлтый.**`, `**Вердикт:** зелёный`, `Вердикт: 🟢 **зелёный**`).
 * Своя и машинная строка блока «Материал раунда» — `- Вердикт конвейера:
 * \`green\` · High 0` (`review-doc-guard.mjs`, #499): вердикт этого же документа
 * из structured_output; у документов без строки «Вердикт:» он единственный.
 *
 * #779: раздел «Закрытие раунда r<N−1>» (§2.10) пересказывает вердикт прошлого
 * раунда строкой «Вердикт r2 — зелёный, …» — она тоже начинается с «Вердикт»,
 * и прежнее «любые ≤60 символов до цвета» выдавало чужой цвет за свой.
 * Поэтому строка «Вердикт: цвет» главнее любой строки, просто начинающейся со
 * слова, а «Вердикт rN …» (`Вердикт r1: жёлтый`, `Вердикт r1 (красный, …)`)
 * не своя ни на каком уровне.
 */
// Без флага `i`: строчное «вердикт красный» в шапке — пересказ, а не свой вердикт.
const VERDICT_OWN_MARKER_RE = /^[ \t]*(?:[-*]\s*)?[*_]*(?:Вердикт|Verdict)(?: конвейера)?[*_]*[ \t]*:/;
const VERDICT_OWN_LINE_RE = new RegExp(String.raw`^[ \t]*(?:[-*]\s*)?[*_]*(?:Вердикт|Verdict)(?: конвейера)?[*_]*[ \t]*:[ \t*_\x60]*(?:🟢|🟡|🔴)?[ \t]*${COLOUR_TOKEN}`, 'mu');
/** Строка, начинающаяся со слова без двоеточия (`Вердикт зелёный; …` старых документов), — после «Вердикт:». */
const VERDICT_LEAD_MARKER_RE = /^[ \t]*(?:[-*]\s*)?\**(?:Вердикт|Verdict)(?!\s+r\d)/;
const VERDICT_LEAD_LINE_RE = new RegExp(String.raw`^[ \t]*(?:[-*]\s*)?\**(?:Вердикт|Verdict)(?!\s+r\d)[^\n]{0,60}?${COLOUR_TOKEN}`, 'mu');
const VERDICT_TAIL_RE = new RegExp(String.raw`${COLOUR_TOKEN}\s+вердикт`, 'iu');

/** Разобрать имя документа: этап, issue, раунд. */
export function parseDocName(name) {
  const release = RELEASE_DOC_NAME.exec(String(name));
  if (release) return { stage: 'release', issue: null, round: null, suffix: null, tag: release[1] };
  const ship = SHIP_DOC_NAME.exec(String(name));
  if (ship) return { stage: 'ship', issue: null, round: null, suffix: null, tag: ship[1], ...(ship[2] ? { nightly: true } : {}) };
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
 * секция «## Вердикт» → упоминание «вердикт цвет» где угодно (кроме
 * пересказа «Вердикт rN — цвет») → свободная форма хвоста → «—». r1 #635:
 * документ r2 пересказывал вердикт r1 («вердикт красный, High: 1») в шапке,
 * и первое совпадение по тексту выдавало чужой цвет; #779 — то же через
 * «Вердикт r2 — зелёный» в разделе «Закрытие раунда». Все уровни ищутся
 * только в собственном тексте документа (`ownText`, #779/#811).
 * `round` — номер раунда из имени документа (`indexEntry`).
 */
export function parseVerdict(text, { round } = {}) {
  const ownBody = ownText(text, { round });
  const own = VERDICT_OWN_LINE_RE.exec(ownBody) || VERDICT_LEAD_LINE_RE.exec(ownBody);
  if (own) return COLOUR[own[1].toLowerCase()];
  const section = verdictSection(ownBody);
  if (section != null) {
    const colour = COLOUR_RE.exec(section);
    if (colour) return COLOUR[colour[1].toLowerCase()];
    if (/блокиру|не принят|отклон/i.test(section)) return 'красный';
    if (/принят|принимается|готов|без замечаний|можно сливать|регрессий нет|proceed|approved/i.test(section)) return 'зелёный';
  }
  const explicit = VERDICT_LINE_RE.exec(ownBody);
  if (explicit) return COLOUR[explicit[1].toLowerCase()];
  // Старые документы пишут «зелёный вердикт» в свободной форме — ищем в хвосте.
  const tail = VERDICT_TAIL_RE.exec(ownBody.slice(-2500));
  if (tail) return COLOUR[tail[1].toLowerCase()];
  return '—';
}

const VERDICT_SECTION_RE = /^#{1,4}\s*(?:\d+\.\s*)?(?:Вердикт|Verdict|Итог)(?![а-яё])[^\n]*\n([\s\S]*?)(?=\n#{1,4}\s|(?![\s\S]))/m;
const SEVERITY = { high: 'high', h: 'high', medium: 'medium', m: 'medium', low: 'low', l: 'low' };
/** Заголовок находки: `### H1 — …`, `### Находка Medium-2 — …`, `### Medium (в скоупе) — …`, `### Low`. */
const SEVERITY_HEADING_RE = /^(#{2,4})\s*(?:Находка\s+)?\**\[?(High|Medium|Low|[HML])(?:[-\s]?(?:[HML])?(\d+)[a-z-]*)?\]?\**(?:\s*\([^)\n]*\))?\s*(?:[—–:.-]\s*)?(.*)$/gmi;
/** `## Находка 1 (High, в скоупе) — title` — форма ранних документов; группы те же, что у SEVERITY_HEADING_RE. */
const FINDING_HEADING_RE = /^(#{2,4})\s*Находка\s*(\d+)?\s*\((High|Medium|Low)[^)\n]*\)\s*(?:[—–:.-]\s*)?(.*)$/i;
const NOTHING_RE = /^\s*[—–-]?\s*(?:нет|не найдено|не обнаружено|отсутствуют|не блокиру\S*|снима\S*(?:\s+с\s+записью)?|none|no|—)\s*[.,;]?\s*$/i;

/**
 * Строка вердикта — та, где стоит слово «Вердикт» и рядом счётчик High/Medium.
 * Своя — «Вердикт:» с начала строки, затем строка, начинающаяся со слова;
 * пересказ «Вердикт r2 — …, High: 0» не берётся ни как своя, ни как
 * упоминание (#779).
 */
function verdictLine(text, own = false) {
  const lines = text.split('\n');
  const markers = own ? [VERDICT_OWN_MARKER_RE, VERDICT_LEAD_MARKER_RE] : [/(?:[Вв]ердикт|[Vv]erdict)(?!\s+r\d)/];
  for (const marker of markers) {
    const line = lines.find((l) => marker.test(l) && /(?:High|Medium):\s*\d+/.test(l));
    if (line) return line;
  }
  return null;
}

/**
 * Пересказ чужого раунда по заголовку секции (r1 #779 M1): «Закрытие раунда
 * r1», «Унаследовано из r1», «Inherited», «Предыдущий раунд» — и любой
 * заголовок, называющий раунд, который не свой («Вердикт по находкам r1» в
 * r2, «Дельта r1 → r2»). Заголовок документа (`# …`) пересказом не бывает.
 */
const RETELL_HEADING_RE = /Унаследован|Закрыти[ея]\s+(?:раунда|r\d)|Inherited|Previous round|(?:Предыдущ|прошл)\S*\s+раунд/i;
const ROUND_MENTION_RE = /(?<![A-Za-z])r(\d+)\b/g;

/** Свой раунд: из имени документа, иначе последний `rN` заголовка `# …-r3`; неизвестен — null. */
function ownRound(text, round) {
  if (round != null && Number.isFinite(Number(round))) return Number(round);
  const title = /^#[ \t]+([^\n]*)/m.exec(text);
  const mention = title ? [...title[1].matchAll(ROUND_MENTION_RE)].at(-1) : null;
  return mention ? Number(mention[1]) : null;
}

/**
 * Собственный текст документа (r1 #779 M1): строки секций-пересказов (вместе
 * с их подсекциями) и цитат `>` заменены пустыми, нумерация строк сохранена. Источник вердикта и счётчиков выбирается по структуре, а не по
 * позиции: порядок секций не задан — «## Вердикт» бывает и до «## Унаследовано
 * из r1» (SPEC-REVIEW-728-r2), и после (774-r2, 806-r2), и пересказ старого
 * счётчика отдельным абзацем `High: …` не должен выдать чужие числа.
 */
export function ownText(text, { round } = {}) {
  const own = ownRound(String(text), round);
  const stack = [];
  let fence = null;
  let quote = false;
  return String(text).split('\n').map((line) => {
    // Блок кода — не цитата: шаблон своего комментария §7.2 ревьюеры кладут в
    // него (SPEC-REVIEW-288-r1); но `# …` внутри блока — не заголовок секции.
    const mark = /^[ \t]*(`{3,}|~{3,})/.exec(line);
    if (fence && mark && mark[1][0] === fence[0] && mark[1].length >= fence.length) fence = null;
    else if (!fence && mark) fence = mark[1];
    const heading = fence || mark ? null : /^(#{1,6})[ \t]+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      const rounds = [...heading[2].matchAll(ROUND_MENTION_RE)].map((m) => Number(m[1]));
      const retold = level > 1 && (RETELL_HEADING_RE.test(heading[2]) || rounds.some((n) => n !== own));
      stack.push({ level, retold });
    }
    // Цитата — с «ленивым» продолжением: строка сразу под `>` без пустой — та же цитата.
    quote = !fence && (/^[ \t]*>/.test(line) || (quote && line.trim() !== ''));
    if (stack.some((section) => section.retold) || quote) return '';
    return line;
  }).join('\n');
}

/**
 * Итоговая сводка документа — абзац собственного текста, который НАЧИНАЕТСЯ со
 * счётчика: `High: 0 · Medium: 2 (обе в скоупе) · Low: 0.` рядом с
 * `**Вердикт: жёлтый.**` (#779, SPEC-REVIEW-662-r3). Сначала — в секции своей
 * строки вердикта; её нет или там пусто — последний такой абзац собственного
 * текста (`ownText` уже без пересказов и цитат). Строка-продолжение
 * чужого абзаца (`  High: 0, Medium: 1` под буллетом шапки) началом абзаца не
 * считается.
 */
function summaryParagraph(own) {
  const lines = own.split('\n');
  const verdictAt = lines.findIndex((l) => VERDICT_OWN_MARKER_RE.test(l) || VERDICT_LEAD_LINE_RE.test(l));
  const isHeading = (l) => /^#{1,6}[ \t]/.test(l);
  let from = -1;
  let to = -1;
  if (verdictAt >= 0) {
    from = verdictAt;
    while (from > 0 && !isHeading(lines[from])) from -= 1;
    to = verdictAt + 1;
    while (to < lines.length && !isHeading(lines[to])) to += 1;
  }
  let inSection = null;
  let last = null;
  for (let i = 0; i < lines.length; i += 1) {
    const starts = i === 0 || !lines[i - 1].trim() || /^[ \t]*[-*]\s/.test(lines[i]);
    if (!starts || !/^[ \t]*(?:[-*]\s*)?[*_]*High[*_]*:\s*\d/.test(lines[i])) continue;
    const body = [lines[i]];
    for (let j = i + 1; j < lines.length && lines[j].trim() && !/^[ \t]*(?:[-*]\s|#)/.test(lines[j]); j += 1) body.push(lines[j]);
    last = body.join('\n');
    if (i >= from && i < to) inSection = last;
  }
  return inSection ?? last;
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

const releaseCounts = (text) => {
  const match = /(?:^|\n)Итог:\s*High\s+(\d+)\s*·\s*Medium\s+(\d+)(?:\s*·\s*Low\s+\d+)?(?:\s|$)/i.exec(text);
  return match ? { high: Number(match[1]), medium: Number(match[2]) } : null;
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
 * собственного документа → итоговая сводка `High: N · Medium: N` → строка,
 * упоминающая вердикт → счётчик, единственный во всём тексте → подсчёт по
 * заголовкам и нумерованным находкам. Первое попавшееся `High: N` по всему
 * файлу больше не берётся: r1 #635 показал, что оно бывает цитатой чужого
 * документа («ТЗ прошло зелёным на r3 (High: 0, Medium: 0)»), #779 — что
 * им бывает и пересказ прошлого раунда «Вердикт r2 — зелёный (High: 0, Medium: 0)».
 * Все уровни, включая запасной подсчёт по заголовкам, ищутся в собственном тексте
 * (`ownText`): секции «Закрытие раунда»/«Унаследовано» и цитаты — не источник,
 * где бы они ни стояли (r1 #779 M1).
 */
export function parseCounts(text, { round } = {}) {
  const own = ownText(text, { round });
  const release = releaseCounts(own);
  if (release) return release;
  for (const scope of [verdictLine(own, true), verdictSection(own), summaryParagraph(own), verdictLine(own)]) {
    const counts = scope ? countsIn(scope) : null;
    if (counts) return counts;
  }
  const highs = new Set([...own.matchAll(/High:\s*(\d+)/g)].map((m) => m[1]));
  const mediums = new Set([...own.matchAll(/Medium:\s*(\d+)/g)].map((m) => m[1]));
  if ((highs.size || mediums.size) && highs.size <= 1 && mediums.size <= 1) {
    return { high: Number([...highs][0] || 0), medium: Number([...mediums][0] || 0) };
  }
  const ids = { high: new Set(), medium: new Set() };
  let anonymous = { high: 0, medium: 0 };
  for (const block of severityBlocks(own)) {
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
export function parseFindings(text, limit = 6, { round } = {}) {
  const own = ownText(text, { round });
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
  const lines = own.split('\n');
  lines.forEach((line, index) => {
    const numbered = /^#{3,4}\s*\d+\.\s*([^\n]+)/.exec(line);
    if (numbered) found.push({ line: index, title: numbered[1] });
    const row = /^\|\s*(?:\*\*)?(?:H\d+|M\d+|High|Medium)(?:\*\*)?\s*\|(?:[^|\n]*\|)?\s*([^|\n]+)\|/.exec(line);
    if (row) found.push({ line: index, title: row[1] });
  });
  for (const block of severityBlocks(own)) {
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
export function parseFiles(text, limit = 8, { round } = {}) {
  const out = [];
  const seen = new Set();
  const blocks = severityBlocks(ownText(text, { round }));
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
  const body = meta.stage === 'ship' ? renderedMarkdown(text) : text;
  const verdict = parseVerdict(body, { round: meta.round });
  // Ship reports use their canonical own «Итог: High … · Medium …» summary,
  // not a colour verdict. High blocks ship coverage; Medium is owner advice.
  // No summary => still unknown. Ordinary reviews retain their stricter rule.
  const shipSummary = meta.stage === 'ship' ? releaseCounts(ownText(body)) : null;
  return {
    name, ...meta,
    verdict: shipSummary?.high > 0 ? 'красный'
      : verdict === '—' && shipSummary ? 'зелёный' : verdict,
    ...parseCounts(body, { round: meta.round }),
    findings: parseFindings(text, 6, { round: meta.round }),
    files: parseFiles(text, 8, { round: meta.round }),
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

/** Строгая граница публикации: новый документ обязан попасть в индекс сразу. */
export function assertAllDocumentsIndexed({ skipped }) {
  if (skipped.length) throw new Error(`вне схемы имён: ${skipped.join(', ')}`);
}

const badge = (verdict) => ({ 'зелёный': '🟢', 'жёлтый': '🟡', 'красный': '🔴' }[verdict] || '⚪');

export function renderIndex({ entries, skipped = [] }) {
  // Документы линии и беты (release, ship) — без issue; свежий тег выше.
  // Стабильный тег старше своих бет: `v1.79.0` выше `v1.79.0-beta.3`.
  const tagKey = (tag) => {
    const [core, beta] = tag.slice(1).split('-beta.');
    return [...core.split('.').map(Number), beta == null ? Infinity : Number(beta)];
  };
  const releaseDocs = entries.filter((entry) => entry.issue == null).sort((a, b) => {
    const av = tagKey(a.tag);
    const bv = tagKey(b.tag);
    for (let i = 0; i < 4; i += 1) if (av[i] !== bv[i]) return bv[i] - av[i];
    // #727: ночной документ читал код после своей базы — он новее документов этого тега.
    if (Boolean(a.nightly) !== Boolean(b.nightly)) return a.nightly ? -1 : 1;
    return a.stage.localeCompare(b.stage) || a.name.localeCompare(b.name);
  });
  const byIssue = new Map();
  for (const entry of entries.filter((item) => item.issue != null)) {
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
  for (const doc of releaseDocs) {
    const [who, what] = doc.nightly ? ['ночь после', 'ночное пакетное ревью ship']
      : doc.stage === 'ship' ? ['бета', 'пакетное ревью ship'] : ['линия', 'ревью линии'];
    lines.push(`| ${who} ${doc.tag} | [${doc.name}](${doc.name}) | ${what} · — | ${badge(doc.verdict)} ${doc.verdict} | ${doc.high} | ${doc.medium} | ${doc.findings.join('; ').replace(/\|/g, '\\|') || '—'} | ${(doc.files || []).map((f) => `\`${f}\``).join(' ') || '—'} |`);
  }
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
  const collected = collectEntries(dir);
  if (process.argv.includes('--strict')) assertAllDocumentsIndexed(collected);
  const markdown = renderIndex(collected);
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
