#!/usr/bin/env node
// #637: еженедельный замер процесса одним скриптом.
//
// Аудит 22.09 собирал эти цифры руками через API за час: раунды ревью на
// issue, время S→S7→S8, прогоны Validate по исходам, минуты конвейера в S7,
// доля мутантов. Без регулярного замера решения об ускорении (#620, #636)
// нельзя проверить. Здесь — чистые функции над снимками GitHub (issue с
// таймлайном меток, прогоны Actions, имена документов ревью) и тонкий CLI на
// `gh`. Скрипт ничего не пишет в репозиторий и в issue: результат — Markdown в
// stdout/файл; куда его класть, решает workflow (`process-metrics.yml`:
// step summary + artifact, опционально комментарий в issue-журнал).
//
//
// #728: эффект процесса по трекам — трек на момент события, отрезки времени
// (работа, ожидание, переделка), возвраты с причинами, находки пакетного ревью
// ship, job-минуты по стадиям, токены и сравнение сопоставимых задач до и после
// перехода на треки. Определения — в ТЗ #728 и в заголовках разделов отчёта.
// Отчёт только читает: признаки конвейера импортируются, а не копируются, где
// у конвейера есть константа; где её нет (`validate-red`/`conflict`), копию
// текста держит контрактный тест на шаблонах `_process.yml`.
//
//   node scripts/process-metrics.mjs --repo=<owner/repo> --days=7 [--until=ISO] [--output=path.md] [--json=path.json]
//        [--compare=2026-09-28] [--compare-days=28]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { classify } from './change-classes.mjs';
import { labelTrack, parseNumstat } from './process-track.mjs';
import { issueTrailers } from './release-membership.mjs';
import { USAGE_KEYS, lastUsageIn } from './model-usage.mjs';
import { ANCHOR_MARKER, verdictDeclaration } from './review-doc-guard.mjs';
import { SHIP_REVIEW_ANCHOR, parseAnchorBlock } from './ship-review.mjs';
import { PIPELINE_EVENTS } from './wait-verdict.mjs';

export const STATUS_LABELS = ['S1-new', 'S2-analysis', 'S3-spec', 'S4-spec-review', 'S5-ready', 'S6-in-progress', 'S7-code-review', 'S8-merged'];
const PROCESS_RUN = /^process #(\d+) · (S4-spec-review|S7-code-review)(?: ·|$)/;
const REVIEW_DOC = /^(CODE|SPEC)-REVIEW-(\d+)-r(\d+)\.md$/;

const at = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};
const minutes = (ms) => Math.round(ms / 60_000);
const hours = (ms) => Math.round((ms / 3_600_000) * 10) / 10;
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const medianHours = (values) => {
  const value = median(values);
  return value === null ? null : hours(value);
};
const mean = (values) => {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null;
};

/**
 * Метрики одного issue по таймлайну меток.
 * @param {object} issue        { number, title, closed_at, state_reason, labels }
 * @param {object[]} events     timeline: { event: 'labeled'|'unlabeled', label: { name }, created_at }
 */
export function issueMetrics(issue, events = []) {
  const labeled = (events || [])
    .filter((event) => event?.event === 'labeled' && event.label?.name)
    .map((event) => ({ label: event.label.name, at: at(event.created_at) }))
    .filter((event) => Number.isFinite(event.at))
    .sort((a, b) => a.at - b.at);
  const first = (label) => labeled.find((event) => event.label === label)?.at ?? null;
  const count = (label) => labeled.filter((event) => event.label === label).length;
  const entered = labeled.find((event) => STATUS_LABELS.includes(event.label))?.at ?? null;
  const s7 = first('S7-code-review');
  const s8 = first('S8-merged');
  const s4 = first('S4-spec-review');
  const s5 = first('S5-ready');
  const closed = at(issue.closed_at);
  return {
    number: Number(issue.number),
    title: String(issue.title || ''),
    stateReason: issue.state_reason || null,
    enteredAt: entered,
    s4At: s4, s5At: s5, s7At: s7, s8At: s8,
    closedAt: Number.isFinite(closed) ? closed : null,
    // Повторные постановки метки: S7 конвейер ставит сам после pending (#636),
    // поэтому число S7-событий — не число раундов; раунды считаются по документам.
    s7Requests: count('S7-code-review'),
    s4Requests: count('S4-spec-review'),
    leadToS7Ms: entered != null && s7 != null ? s7 - entered : null,
    reviewToMergeMs: s7 != null && s8 != null ? s8 - s7 : null,
    leadToS8Ms: entered != null && s8 != null ? s8 - entered : null,
    specLeadMs: s4 != null && s5 != null ? s5 - s4 : null,
  };
}

/**
 * Имена документов ревью из `git ls-tree -r --name-only` по живому каталогу и
 * архиву (#682): после стабильного релиза документы линии уезжают в
 * `legacy/reviews/<тег>/`, и счёт раундов за окно не должен от этого меняться.
 */
export function reviewDocNames(listing = '') {
  return String(listing).split('\n').map((path) => path.trim()).filter(Boolean)
    .filter((path) => path.startsWith('docs/reviews/') || path.startsWith('legacy/reviews/'))
    .map((path) => path.slice(path.lastIndexOf('/') + 1));
}

/** Раунды ревью по именам документов `docs/reviews/*-REVIEW-<NN>-r<K>.md`. */
export function reviewRounds(fileNames = []) {
  const rounds = new Map();
  for (const name of fileNames) {
    const match = REVIEW_DOC.exec(String(name));
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    const round = Number(match[3]);
    rounds.set(key, Math.max(rounds.get(key) || 0, round));
  }
  return rounds;
}

/** Сводка по прогонам Actions за окно: по workflow — число, исходы, wall-time, события. */
export function runMetrics(runs = []) {
  const byWorkflow = new Map();
  for (const run of runs) {
    const name = String(run.name || run.workflow_name || '');
    // Прогоны конвейера именуются `process #NN · <метка> · …` на каждое событие метки;
    // для сводки они — один workflow, а не сотни строк по меткам.
    const key = /^process #\d+ · /.test(String(run.display_title || '')) ? 'process' : name;
    const entry = byWorkflow.get(key) || {
      workflow: key, runs: 0, success: 0, failure: 0, cancelled: 0, skipped: 0, other: 0, wallMs: 0, events: {},
    };
    entry.runs += 1;
    const conclusion = run.conclusion || 'other';
    if (conclusion in entry && typeof entry[conclusion] === 'number') entry[conclusion] += 1; else entry.other += 1;
    const started = at(run.run_started_at || run.created_at);
    const ended = at(run.updated_at);
    if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) entry.wallMs += ended - started;
    entry.events[run.event] = (entry.events[run.event] || 0) + 1;
    byWorkflow.set(key, entry);
  }
  return [...byWorkflow.values()].sort((a, b) => b.wallMs - a.wallMs);
}

/** Минуты конвейера по стадиям (имя прогона `process #NN · S7-code-review · …`). */
export function pipelineMetrics(runs = []) {
  const stages = { 'S7-code-review': { runs: 0, wallMs: 0, issues: new Set() }, 'S4-spec-review': { runs: 0, wallMs: 0, issues: new Set() } };
  for (const run of runs) {
    const match = PROCESS_RUN.exec(String(run.display_title || run.name || ''));
    if (!match || run.conclusion === 'skipped') continue;
    const stage = stages[match[2]];
    const started = at(run.run_started_at || run.created_at);
    const ended = at(run.updated_at);
    stage.runs += 1;
    stage.issues.add(Number(match[1]));
    if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) stage.wallMs += ended - started;
  }
  return Object.fromEntries(Object.entries(stages).map(([label, stage]) => [label, {
    runs: stage.runs, issues: stage.issues.size, wallMinutes: minutes(stage.wallMs),
    perRunMinutes: stage.runs ? Math.round(minutes(stage.wallMs) / stage.runs) : null,
  }]));
}

/** Job-минуты по jobs прогонов (если переданы): в целом и доля «Мутанты». */
export function jobMinutes(jobsByRun = new Map()) {
  let total = 0;
  let mutants = 0;
  for (const jobs of jobsByRun.values()) {
    for (const job of jobs || []) {
      const started = at(job.started_at);
      const ended = at(job.completed_at);
      if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) continue;
      total += ended - started;
      if (/^Мутанты/.test(String(job.name || ''))) mutants += ended - started;
    }
  }
  return { totalMinutes: minutes(total), mutantMinutes: minutes(mutants), mutantShare: total ? Math.round((mutants / total) * 100) : null };
}

// ---------------------------------------------------------------------------
// #728: эффект процесса по трекам.

const DAY_MS = 86_400_000;
/** Решение владельца о треках (PROCESS.md §5, #695): граница сравнения «до и после». */
export const TRACKS_CUTOVER = '2026-09-28';
export const COMPARE_DAYS = 28;
/** Минимальная когорта сравнения: меньше — «мало данных», разницы нет. */
export const MIN_COHORT = 3;
/** Jobs запрашиваются не больше чем для стольких прогонов окна. */
export const JOBS_RUN_CAP = 600;
/** Таймлайн issue читается не дальше стольких страниц по 100 событий. */
export const TIMELINE_PAGE_CAP = 10;
export const TRACKS = ['ship', 'show', 'ask'];
export const SEGMENTS = ['queue', 'spec', 'work', 'review', 'rework', 'blocked'];
export const RETURN_REASONS = ['verdict-yellow', 'verdict-red', 'validate-red', 'conflict', 'merge', 'reclassify', 'owner-question', 'unknown'];
export const PIPELINE_STAGES = ['guard', 'prepare', 'model', 'integrate'];
export const VOLUME_BUCKETS = ['≤30', '31–200', '201–1000', '>1000'];
export const VALIDATE_WORKFLOW = 'Проверка (CI)';
export const TOKENS_NO_DATA = 'Токены: нет данных (ни один документ ревью не несёт расход модели)';

/**
 * Причины `validate-red` и `conflict` (К3). У конвейера нет для них отдельной
 * константы: оба комментария `_process.yml` («Validate красный — вернуть
 * автору без ревью» и «Конфликт с dev — вернуть автору без ревью») идут под
 * одним префиксом `PIPELINE_EVENTS` с `kind: 'conflict'`. Причину даёт
 * продолжение первой строки. Это копия текста шаблонов, а не импорт: от
 * расхождения её держит контрактный тест на самих шаблонах (AC3 #728).
 */
export const NOT_RUN_VALIDATE_RE = /^\*\*Ревью не запускалось:\*\* Validate(?: с мутантами)? на материале /m;
export const NOT_RUN_CONFLICT_RE = /^\*\*Ревью не запускалось:\*\* ветка \S+ не ребейзится на /m;
/** Маршрут вердикта show (#726): машинная строка комментария конвейера. */
export const ROUTE_RE = /<!--\s*hp:route\s+(reclassify|owner-question)\b[^>]*-->/;

/** Признак конвейера по `kind`: переименование в `wait-verdict.mjs` ломает загрузку, а не молча даёт `unknown`. */
function pipelineEvent(kind) {
  const event = PIPELINE_EVENTS.find((entry) => entry.kind === kind);
  if (!event) throw new Error(`process-metrics: в PIPELINE_EVENTS (wait-verdict.mjs) нет kind '${kind}'`);
  return event.re;
}
/** Общий префикс «Ревью не запускалось»: семейство, не причина. */
const NOT_RUN_RE = pipelineEvent('conflict');
/** Неудачное слияние после ревью: «Слияние отменено», «Код-ревью зелёное — вердикт выше в силе». */
const MERGE_RES = [pipelineEvent('stale'), pipelineEvent('merge-conflict')];

const toMs = (value) => (typeof value === 'number' ? value : at(value));

/** События меток таймлайна в порядке времени (при равном времени — в порядке таймлайна). */
function labelEvents(events = []) {
  return (events || [])
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => (event?.event === 'labeled' || event?.event === 'unlabeled') && event.label?.name)
    .map(({ event, index }) => ({ type: event.event, label: event.label.name, at: at(event.created_at), index }))
    .filter((event) => Number.isFinite(event.at))
    .sort((a, b) => a.at - b.at || a.index - b.index);
}

/** Комментарии таймлайна (`commented`) в порядке времени. */
function commentEvents(events = []) {
  return (events || [])
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event?.event === 'commented')
    .map(({ event, index }) => ({ body: String(event.body ?? ''), at: at(event.created_at), index }))
    .filter((comment) => Number.isFinite(comment.at))
    .sort((a, b) => a.at - b.at || a.index - b.index);
}

/**
 * Метки на задаче в момент `t`: все `labeled`/`unlabeled` строго до `t`
 * (`inclusive` — включая события в сам момент `t`).
 */
export function labelsAt(events, t, { inclusive = false } = {}) {
  const moment = toMs(t);
  const labels = new Set();
  for (const event of labelEvents(events)) {
    if (inclusive ? event.at > moment : event.at >= moment) break;
    if (event.type === 'labeled') labels.add(event.label); else labels.delete(event.label);
  }
  return [...labels];
}

/**
 * К1. Трек на момент `t` — по меткам, стоящим на задаче до `t`. Трековые метки
 * разрешает `process-track.mjs`, одним правилом с конвейером: строжайшая из
 * нескольких `track:*`; прежние `small`/`trivial` — show; без метки — ask для
 * продукта, show для инфраструктуры (`infra`, §5.1).
 */
export function trackAt(events, t, { infra = false } = {}) {
  return labelTrack({ labels: labelsAt(events, t), infrastructure: infra });
}

/** Путь трека: разные треки подряд от `from` (включительно) до `to` (исключая), например `['ship', 'show']`. */
export function trackPath(events, { from, to, infra = false } = {}) {
  const start = toMs(from);
  const end = toMs(to);
  const path = [];
  const push = (track) => { if (path.at(-1) !== track) path.push(track); };
  push(labelTrack({ labels: labelsAt(events, start, { inclusive: true }), infrastructure: infra }));
  const moments = [...new Set(labelEvents(events).map((event) => event.at))].filter((moment) => moment > start && moment < end);
  for (const moment of moments) push(labelTrack({ labels: labelsAt(events, moment, { inclusive: true }), infrastructure: infra }));
  return path;
}

const SEGMENT_OF_STATUS = {
  'S1-new': 'queue', 'S2-analysis': 'queue', 'S5-ready': 'queue',
  'S4-spec-review': 'review', 'S7-code-review': 'review',
};

/**
 * К2. Отрезки от первой статусной метки до первого `S8-merged`. Статус в
 * каждый момент — последняя поставленная статусная метка, `blocked` —
 * наложение поверх статуса: его время вычитается из отрезка под ним. Возврат —
 * смена статуса `S7 → S6` (и `S7 → S3`, маршрут reclassify #726) или `S4 → S3`;
 * постановка `S7` поверх `S7` — не возврат и не новый отрезок. Сумма отрезков
 * равна `lead`. Без `S8` — `null`.
 */
export function issueSegments(events = []) {
  const list = labelEvents(events);
  const s8 = list.find((event) => event.type === 'labeled' && event.label === 'S8-merged');
  if (!s8) return null;
  const segments = Object.fromEntries(SEGMENTS.map((name) => [name, 0]));
  const returns = [];
  let status = null;
  let enteredAt = null;
  let reviewSince = null;
  let blocked = false;
  let specReturned = false;
  let codeReturned = false;
  let cursor = null;
  const current = () => {
    if (blocked) return 'blocked';
    if (status === 'S3-spec') return specReturned || codeReturned ? 'rework' : 'spec';
    if (status === 'S6-in-progress') return codeReturned ? 'rework' : 'work';
    return SEGMENT_OF_STATUS[status] || 'queue';
  };
  for (const event of list) {
    if (cursor !== null && event.at > cursor) {
      segments[current()] += event.at - cursor;
      cursor = event.at;
    }
    if (event === s8) break;
    if (event.label === 'blocked') { blocked = event.type === 'labeled'; continue; }
    if (event.type !== 'labeled' || !STATUS_LABELS.includes(event.label) || event.label === status) continue;
    if (status === 'S7-code-review' && (event.label === 'S6-in-progress' || event.label === 'S3-spec')) {
      codeReturned = true;
      returns.push({ stage: 'code', from: status, to: event.label, since: reviewSince, at: event.at });
    } else if (status === 'S4-spec-review' && event.label === 'S3-spec') {
      specReturned = true;
      returns.push({ stage: 'spec', from: status, to: event.label, since: reviewSince, at: event.at });
    }
    status = event.label;
    if (status === 'S4-spec-review' || status === 'S7-code-review') reviewSince = event.at;
    if (cursor === null) { cursor = event.at; enteredAt = event.at; }
  }
  if (enteredAt === null) enteredAt = s8.at;
  return { enteredAt, s8At: s8.at, leadMs: s8.at - enteredAt, segments, returns };
}

/** Цвет объявленного вердикта по строке `verdictDeclaration`: первый цвет после слова «Вердикт». */
function verdictColour(line) {
  const match = /(красн)|(жёлт|желт)|(зелён|зелен)/i.exec(String(line).slice(Math.max(0, String(line).indexOf('Вердикт'))));
  if (!match) return null;
  return match[1] ? 'red' : match[2] ? 'yellow' : 'green';
}

/**
 * Вердикт этапа в комментарии: объявление (`verdictDeclaration`) и документ
 * этой задачи и этого этапа `<MARKER>-<NN>` — то же правило, что у счёта
 * циклов конвейера (`stageVerdictComments`). Вердикт о чужом документе — `null`.
 */
export function stageVerdict(body, { stage = 'code', number } = {}) {
  if (!/^\d+$/.test(String(number ?? ''))) return null;
  const marker = stage === 'spec' ? 'SPEC-REVIEW' : 'CODE-REVIEW';
  const text = String(body ?? '');
  if (!new RegExp(`${marker}-${number}(?![0-9])`).test(text)) return null;
  const line = verdictDeclaration(text);
  return line ? verdictColour(line) : null;
}

/**
 * К3. Признак причины возврата в одном комментарии; `null` — комментарий
 * причины не называет. «Ревью не запускалось» с другим продолжением —
 * `unknown`: семейство узнано, причина не угадывается.
 */
export function returnSignal(body, { stage = 'code', number } = {}) {
  const text = String(body ?? '');
  const route = ROUTE_RE.exec(text);
  if (route) return route[1];
  if (NOT_RUN_RE.test(text)) {
    if (NOT_RUN_VALIDATE_RE.test(text)) return 'validate-red';
    if (NOT_RUN_CONFLICT_RE.test(text)) return 'conflict';
    return 'unknown';
  }
  if (MERGE_RES.some((re) => re.test(text))) return 'merge';
  const colour = stageVerdict(text, { stage, number });
  if (colour === 'red') return 'verdict-red';
  if (colour === 'yellow') return 'verdict-yellow';
  return null;
}

/**
 * Причина возврата — последний комментарий с признаком К3 между постановкой
 * ревью (`since`) и возвратом (`at`), обе границы включительно. Комментарии
 * без признака (разговор, «Пока шло ревью…», «Лимит циклов…») причину не
 * перекрывают. Ничего — `unknown`: метку переставил человек.
 */
export function returnReason(comments = [], { since, at: returnedAt, stage = 'code', number } = {}) {
  const from = toMs(since);
  const to = toMs(returnedAt);
  const window = (comments || []).filter((comment) => {
    const moment = toMs(comment.at ?? comment.created_at);
    return Number.isFinite(moment) && moment >= from && moment <= to;
  });
  for (let i = window.length - 1; i >= 0; i--) {
    const signal = returnSignal(window[i].body, { stage, number });
    if (signal) return signal;
  }
  return 'unknown';
}

/** Раунды ревью по комментариям: объявление вердикта этапа своей задачи до `until`. */
export function verdictRounds(comments = [], { number, until = Infinity } = {}) {
  const rounds = [];
  for (const comment of comments || []) {
    const moment = toMs(comment.at ?? comment.created_at);
    if (!Number.isFinite(moment) || moment > toMs(until)) continue;
    for (const stage of ['code', 'spec']) {
      const colour = stageVerdict(comment.body, { stage, number });
      if (!colour) continue;
      rounds.push({ stage, colour, blocking: colour !== 'green', at: moment });
      break;
    }
  }
  return rounds;
}

const SHIP_DOC = /^(?:docs\/reviews|legacy\/reviews)\/(?:.*\/)?SHIP-REVIEW-[^/]+\.md$/;

/**
 * К4. Находки пакетного ревью ship по документам `SHIP-REVIEW-*.md` живого
 * каталога и архива: счёт High/Medium/Low — по документу (по задаче
 * серьёзность не записывается), у задачи — сумма по документам, чей
 * машинный блок её называет.
 */
export function shipFindings(reviewDocs = []) {
  const byIssue = new Map();
  const docs = [];
  for (const doc of reviewDocs || []) {
    if (!SHIP_DOC.test(String(doc?.path || ''))) continue;
    const block = parseAnchorBlock(doc.text);
    if (!block) continue;
    const entry = { path: doc.path, issues: block.issues, high: block.high ?? 0, medium: block.medium ?? 0, low: block.low ?? 0 };
    docs.push(entry);
    for (const number of block.issues) {
      const sum = byIssue.get(number) || { high: 0, medium: 0, low: 0, docs: [] };
      sum.high += entry.high; sum.medium += entry.medium; sum.low += entry.low; sum.docs.push(doc.path);
      byIssue.set(number, sum);
    }
  }
  return { byIssue, docs };
}

/**
 * #737: строка расхода модели документа ревью — только из машинного блока,
 * который пишет конвейер: после `ANCHOR_MARKER` (ревью ТЗ и кода) или после
 * последнего `SHIP_REVIEW_ANCHOR` (`SHIP-REVIEW-*`). Проза выше маркера не
 * источник: ревьюер r2 цитирует документ r1, и расход r1 считался бы дважды.
 * Формат и разбор — `model-usage.mjs`; строки нет — `null`.
 */
export function reviewDocUsage(doc) {
  const text = String(doc?.text ?? '');
  const at = SHIP_DOC.test(String(doc?.path || '')) ? text.lastIndexOf(SHIP_REVIEW_ANCHOR) : text.indexOf(ANCHOR_MARKER);
  return at < 0 ? null : lastUsageIn(text.slice(at));
}

/**
 * К6 (#728, #737). Расход модели по документам ревью: `docs` — документы с
 * данными, `totals` — суммы по ключам строки (`null`, пока данных нет),
 * `missing` — документы с `hp:usage-none`. «Нет данных» — не ноль: в суммы
 * не входит. Документы без строки (до #737) не считаются ни тем, ни другим.
 */
export function tokenUsage(reviewDocs = []) {
  const totals = Object.fromEntries(USAGE_KEYS.map((key) => [key, 0]));
  let docs = 0;
  let missing = 0;
  for (const doc of reviewDocs || []) {
    const usage = reviewDocUsage(doc);
    if (!usage) continue;
    if ('reason' in usage) { missing += 1; continue; }
    docs += 1;
    for (const key of USAGE_KEYS) totals[key] += usage[key];
  }
  return { docs, totals: docs ? totals : null, missing };
}

/** `git log --format=%x1e%H%x1f%cI%x1f%B%x1f --numstat` → коммиты с трейлерами и строками. */
export function parseGitLog(text = '') {
  return String(text).split('\x1e').filter((record) => record.trim()).map((record) => {
    const [sha, date, body = '', numstat = ''] = record.split('\x1f');
    return { sha: sha.trim(), date: date?.trim() || null, body, issues: issueTrailers(body), files: parseNumstat(numstat) };
  }).filter((commit) => /^[0-9a-f]{7,64}$/.test(commit.sha));
}

/** Коммиты `ref` с `since` (дата коммиттера) — с `--numstat`, без переименований. */
export function readCommits(git, { ref = 'origin/dev', since } = {}) {
  const args = ['log', ref, '--no-renames', '--numstat', '--format=%x1e%H%x1f%cI%x1f%B%x1f'];
  if (since) args.splice(2, 0, `--since=${new Date(toMs(since)).toISOString()}`);
  return parseGitLog(git(args));
}

/** Строка объёма К7: не класс D (`classify`) и не `docs/reviews/**`. */
const countsToVolume = (path) => classify(path) !== 'D' && !String(path).startsWith('docs/reviews/');

/**
 * Изменения задачи по коммитам с трейлером `Issue: #NN`, кроме коммитов
 * `Release:` (они несут трейлеры всех задач беты, бандлы и версию манифеста):
 * объём К7 (`+/−` без класса D и `docs/reviews/**`) и файлы для признака
 * инфраструктуры К1.
 */
export function issueChanges(commits = []) {
  const byIssue = new Map();
  for (const commit of commits || []) {
    if (/^Release:/m.test(String(commit.body || ''))) continue;
    for (const number of commit.issues || issueTrailers(commit.body)) {
      const entry = byIssue.get(number) || { lines: 0, files: new Set(), commits: 0 };
      entry.commits += 1;
      for (const file of commit.files || []) {
        entry.files.add(file.path);
        if (countsToVolume(file.path)) entry.lines += (file.added ?? 0) + (file.deleted ?? 0);
      }
      byIssue.set(number, entry);
    }
  }
  return byIssue;
}

/** Инфраструктура (§1): в коммитах задачи есть файлы и ни одного класса A. */
export const isInfra = (change) => Boolean(change && change.files.size && [...change.files].every((path) => classify(path) !== 'A'));

/** Корзина объёма К7: ≤ 30, 31–200, 201–1000, > 1000 строк. */
export function volumeBucket(lines) {
  if (!Number.isFinite(lines)) return null;
  if (lines <= 30) return VOLUME_BUCKETS[0];
  if (lines <= 200) return VOLUME_BUCKETS[1];
  if (lines <= 1000) return VOLUME_BUCKETS[2];
  return VOLUME_BUCKETS[3];
}

/**
 * Задача для разделов по трекам: трек на момент первого `S8-merged`, путь
 * трека, отрезки, возвраты и раунды с треком своего момента, находки ship.
 * Без `S8` — `null`. Усечённый таймлайн — строка без отрезков (`truncated`).
 */
export function issueTrackMetrics(issue, events = [], { change = null, ship = null, truncated = false } = {}) {
  const number = Number(issue.number);
  const s8 = labelEvents(events).find((event) => event.type === 'labeled' && event.label === 'S8-merged');
  if (!s8) return null;
  const infra = isInfra(change);
  const base = {
    number, title: String(issue.title || ''), stateReason: issue.state_reason || null, s8At: s8.at,
    infra, volume: change ? change.lines : null, bucket: change ? volumeBucket(change.lines) : null,
  };
  if (truncated) return { ...base, truncated: true, track: null, path: [], leadMs: null, segments: null, returns: [], rounds: [], ship: null };
  const seg = issueSegments(events);
  const comments = commentEvents(events);
  const track = trackAt(events, s8.at, { infra });
  return {
    ...base,
    truncated: false,
    track,
    path: trackPath(events, { from: seg.enteredAt, to: s8.at, infra }),
    enteredAt: seg.enteredAt,
    leadMs: seg.leadMs,
    segments: seg.segments,
    returns: seg.returns.map((ret) => ({
      stage: ret.stage, from: ret.from, to: ret.to, at: ret.at,
      reason: returnReason(comments, { since: ret.since, at: ret.at, stage: ret.stage, number }),
      track: trackAt(events, ret.at, { infra }),
    })),
    rounds: verdictRounds(comments, { number, until: s8.at }).map((round) => ({ ...round, track: trackAt(events, round.at, { infra }) })),
    ship: track === 'ship' ? (ship || { high: 0, medium: 0, low: 0, docs: [] }) : null,
  };
}

const trackOrder = (track) => (TRACKS.includes(track) ? TRACKS.indexOf(track) : TRACKS.length);

/**
 * Разделы «По трекам»: задачи по треку на момент S8; возвраты и раунды — по
 * треку своего момента. Находки ship — сумма по разным документам, которые
 * называют ship-задачи раздела: документ на две задачи считается один раз.
 */
export function trackSection(rows = [], { shipDocs = [] } = {}) {
  const counted = rows.filter((row) => !row.truncated);
  const tracks = [...new Set([...TRACKS, ...counted.map((row) => row.track)])].sort((a, b) => trackOrder(a) - trackOrder(b));
  const byTrack = tracks.map((track) => {
    const own = counted.filter((row) => row.track === track);
    const medians = Object.fromEntries(['lead', ...SEGMENTS].map((name) => [name, medianHours(own.map((row) => (name === 'lead' ? row.leadMs : row.segments[name])))]));
    let ship = null;
    if (track === 'ship') {
      const numbers = new Set(own.map((row) => row.number));
      const docs = (shipDocs || []).filter((doc) => doc.issues.some((number) => numbers.has(number)));
      ship = {
        issues: own.length,
        covered: own.filter((row) => row.ship?.docs.length).length,
        docs: docs.length,
        high: docs.reduce((sum, doc) => sum + doc.high, 0),
        medium: docs.reduce((sum, doc) => sum + doc.medium, 0),
        low: docs.reduce((sum, doc) => sum + doc.low, 0),
      };
    }
    return { track, n: own.length, medians, ship };
  });
  const events = tracks.map((track) => {
    const returns = counted.flatMap((row) => row.returns).filter((ret) => ret.track === track);
    const rounds = counted.flatMap((row) => row.rounds).filter((round) => round.track === track);
    return {
      track,
      returns: returns.length,
      reasons: Object.fromEntries(RETURN_REASONS.map((reason) => [reason, returns.filter((ret) => ret.reason === reason).length])),
      rounds: Object.fromEntries(['code', 'spec'].map((stage) => [stage, {
        blocking: rounds.filter((round) => round.stage === stage && round.blocking).length,
        green: rounds.filter((round) => round.stage === stage && !round.blocking).length,
      }])),
    };
  });
  return {
    n: counted.length,
    byTrack, events,
    truncated: rows.filter((row) => row.truncated).map((row) => row.number),
    changed: counted.filter((row) => row.path.length > 1).map((row) => ({ number: row.number, path: row.path })),
    rows: [...rows].sort((a, b) => a.number - b.number),
  };
}

/** Стадия конвейера по имени job тела — части после « / »: «Страж…», «Ревью: материал…», … */
export function jobStage(name = '') {
  const text = String(name);
  const own = text.includes(' / ') ? text.slice(text.indexOf(' / ') + 3) : text;
  if (/^Страж/.test(own)) return 'guard';
  if (/^Ревью: материал/.test(own)) return 'prepare';
  if (/^Ревью: работа модели/.test(own)) return 'model';
  if (/^Ревью: публикация/.test(own)) return 'integrate';
  return 'other';
}

const PROCESS_TITLE = /^process #(\d+) · /;

/**
 * Прогоны, для которых запрашиваются jobs (К5): конвейер `process #NN · …` и
 * Validate, кроме skipped (у них нет ни одной выполненной job), не больше `cap`.
 */
export function jobRuns(runs = [], cap = JOBS_RUN_CAP) {
  const eligible = (runs || []).filter((run) => run?.conclusion !== 'skipped'
    && (PROCESS_TITLE.test(String(run.display_title || '')) || String(run.name || '') === VALIDATE_WORKFLOW));
  return { total: eligible.length, selected: eligible.slice(0, cap) };
}

const jobMs = (job) => {
  const started = at(job?.started_at);
  const ended = at(job?.completed_at);
  return Number.isFinite(started) && Number.isFinite(ended) && ended > started ? ended - started : 0;
};

/**
 * К5. Job-минуты конвейера по стадиям — всего и по треку задачи на момент
 * прогона (К1); Validate — всего и по событию. Jobs прогона недоступны
 * (`null`: 403, истёк срок хранения) — прогон не даёт данных; ни одного
 * прогона с данными — `null` («нет данных»), а не ноль.
 */
export function stageMinutes({ runs = [], jobsByRun = new Map(), trackOf = () => null, cap = JOBS_RUN_CAP } = {}) {
  const { total, selected } = jobRuns(runs, cap);
  const stagesMs = () => Object.fromEntries([...PIPELINE_STAGES, 'other'].map((stage) => [stage, 0]));
  const processAll = stagesMs();
  const processByTrack = {};
  const validateByEvent = {};
  let validateMs = 0;
  let processRuns = 0;
  let validateRuns = 0;
  let unavailable = 0;
  for (const run of selected) {
    const jobs = jobsByRun.get(run.id) ?? jobsByRun.get(String(run.id)) ?? null;
    if (!Array.isArray(jobs)) { unavailable += 1; continue; }
    const process = PROCESS_TITLE.exec(String(run.display_title || ''));
    if (process) {
      processRuns += 1;
      const track = trackOf(Number(process[1]), at(run.run_started_at || run.created_at)) || '—';
      processByTrack[track] ||= stagesMs();
      for (const job of jobs) {
        const stage = jobStage(job.name);
        processAll[stage] += jobMs(job);
        processByTrack[track][stage] += jobMs(job);
      }
    } else {
      validateRuns += 1;
      const event = String(run.event || 'other');
      for (const job of jobs) {
        validateMs += jobMs(job);
        validateByEvent[event] = (validateByEvent[event] || 0) + jobMs(job);
      }
    }
  }
  const toMinutes = (stages) => Object.fromEntries(Object.entries(stages).map(([stage, ms]) => [stage, minutes(ms)]));
  return {
    runs: total,
    fetched: selected.length,
    truncated: total > selected.length ? { fetched: selected.length, total } : null,
    unavailable,
    process: processRuns ? {
      runs: processRuns,
      stages: toMinutes(processAll),
      byTrack: Object.fromEntries(Object.entries(processByTrack)
        .sort(([a], [b]) => trackOrder(a) - trackOrder(b)).map(([track, stages]) => [track, toMinutes(stages)])),
    } : null,
    validate: validateRuns ? {
      runs: validateRuns,
      minutes: minutes(validateMs),
      byEvent: Object.fromEntries(Object.entries(validateByEvent).map(([event, ms]) => [event, minutes(ms)])),
    } : null,
  };
}

/**
 * К7. Сравнение сопоставимых задач до и после `cutover`: первый `S8-merged`
 * в `[cutover − days, cutover)` и `[cutover, min(cutover + days, until))`,
 * когорта — трек на момент S8 и корзина объёма. n < `MIN_COHORT` на любой
 * стороне — «мало данных», разницы нет. Задачи без коммитов с трейлером
 * объёма не имеют и в когорты не входят.
 */
export function compareCohorts(rows = [], { cutover = TRACKS_CUTOVER, days = COMPARE_DAYS, until = null } = {}) {
  const border = toMs(cutover);
  const beforeFrom = border - days * DAY_MS;
  const afterTo = Math.min(border + days * DAY_MS, until == null ? Infinity : toMs(until));
  const sideOf = (row) => {
    if (row.s8At >= beforeFrom && row.s8At < border) return 'before';
    if (row.s8At >= border && row.s8At < afterTo) return 'after';
    return null;
  };
  const inWindow = rows.filter((row) => !row.truncated && sideOf(row));
  const noCommits = inWindow.filter((row) => row.bucket == null).map((row) => row.number).sort((a, b) => a - b);
  const cohorts = new Map();
  for (const row of inWindow.filter((r) => r.bucket != null)) {
    const key = `${row.track} · ${row.bucket}`;
    const cohort = cohorts.get(key) || { key, track: row.track, bucket: row.bucket, before: [], after: [] };
    cohort[sideOf(row)].push(row);
    cohorts.set(key, cohort);
  }
  const stats = (side) => ({
    n: side.length,
    lead: medianHours(side.map((row) => row.leadMs)),
    work: medianHours(side.map((row) => row.segments.work)),
    review: medianHours(side.map((row) => row.segments.review)),
    rework: medianHours(side.map((row) => row.segments.rework)),
    returns: side.length ? Math.round(mean(side.map((row) => row.returns.length)) * 100) / 100 : null,
  });
  const delta = (a, b) => (a == null || b == null ? null : Math.round((b - a) * 100) / 100);
  const list = [...cohorts.values()]
    .sort((a, b) => trackOrder(a.track) - trackOrder(b.track) || VOLUME_BUCKETS.indexOf(a.bucket) - VOLUME_BUCKETS.indexOf(b.bucket))
    .map((cohort) => {
      const before = stats(cohort.before);
      const after = stats(cohort.after);
      const enough = before.n >= MIN_COHORT && after.n >= MIN_COHORT;
      return {
        key: cohort.key, track: cohort.track, bucket: cohort.bucket, before, after, enough,
        diff: enough ? Object.fromEntries(['lead', 'work', 'review', 'rework', 'returns'].map((name) => [name, delta(before[name], after[name])])) : null,
      };
    });
  return {
    cutover: new Date(border).toISOString().slice(0, 10),
    days,
    before: { from: new Date(beforeFrom).toISOString(), to: new Date(border).toISOString() },
    after: { from: new Date(border).toISOString(), to: Number.isFinite(afterTo) ? new Date(afterTo).toISOString() : null },
    cohorts: list,
    noCommits,
  };
}

/** Собрать всё в один отчёт. */
export function buildReport({
  since, until, issues = [], timelines = new Map(), reviewFiles = [], runs = [], jobsByRun = null,
  // #728: задачи для разделов по трекам (по умолчанию — те же `issues`), усечённые
  // таймлайны, тексты документов ревью, коммиты dev и окно сравнения.
  allIssues = null, timelineTruncated = new Set(), reviewDocs = [], commits = [], compare = {},
}) {
  const perIssue = issues.map((issue) => issueMetrics(issue, timelines.get(Number(issue.number)) || []));
  const rounds = reviewRounds(reviewFiles);
  const completed = perIssue.filter((issue) => issue.stateReason === 'completed');
  const codeRounds = completed.map((issue) => rounds.get(`CODE:${issue.number}`)).filter(Boolean);
  const specRounds = completed.map((issue) => rounds.get(`SPEC:${issue.number}`)).filter(Boolean);
  const dist = (values) => values.reduce((acc, value) => (acc[value] = (acc[value] || 0) + 1, acc), {});
  return {
    since, until,
    issues: {
      closed: perIssue.length,
      completed: completed.length,
      notPlanned: perIssue.filter((issue) => issue.stateReason === 'not_planned').length,
      medianLeadToS7Hours: medianHours(completed.map((i) => i.leadToS7Ms)),
      medianReviewToMergeHours: medianHours(completed.map((i) => i.reviewToMergeMs)),
      medianLeadToS8Hours: medianHours(completed.map((i) => i.leadToS8Ms)),
      medianSpecLeadHours: medianHours(completed.map((i) => i.specLeadMs)),
      codeReviewRounds: { mean: mean(codeRounds), distribution: dist(codeRounds), issues: codeRounds.length },
      specReviewRounds: { mean: mean(specRounds), distribution: dist(specRounds), issues: specRounds.length },
      s7RepeatRequests: completed.filter((i) => i.s7Requests > 1).length,
      rows: perIssue.map((issue) => ({
        ...issue,
        codeRounds: rounds.get(`CODE:${issue.number}`) || 0,
        specRounds: rounds.get(`SPEC:${issue.number}`) || 0,
      })),
    },
    runs: runMetrics(runs),
    pipeline: pipelineMetrics(runs),
    jobs: jobsByRun ? jobMinutes(jobsByRun) : null,
    ...trackReport({ since, until, issues: allIssues || issues, timelines, timelineTruncated, reviewDocs, runs, jobsByRun, commits, compare }),
  };
}

/** #728: разделы по трекам, job-минуты по стадиям, токены и сравнение до/после. */
function trackReport({ since, until, issues, timelines, timelineTruncated, reviewDocs, runs, jobsByRun, commits, compare }) {
  const changes = issueChanges(commits);
  const ship = shipFindings(reviewDocs);
  const seen = new Set();
  const rows = [];
  for (const issue of issues || []) {
    const number = Number(issue.number);
    if (seen.has(number)) continue;
    seen.add(number);
    const row = issueTrackMetrics(issue, timelines.get(number) || [], {
      change: changes.get(number) || null, ship: ship.byIssue.get(number) || null, truncated: timelineTruncated.has(number),
    });
    if (row) rows.push(row);
  }
  const from = at(since);
  const to = at(until);
  const trackOf = (number, moment) => {
    const events = timelines.get(number);
    return events && Number.isFinite(moment) ? trackAt(events, moment, { infra: isInfra(changes.get(number)) }) : null;
  };
  return {
    tracks: trackSection(rows.filter((row) => row.s8At >= from && row.s8At <= to), { shipDocs: ship.docs }),
    stages: jobsByRun ? stageMinutes({ runs, jobsByRun, trackOf }) : null,
    tokens: tokenUsage(reviewDocs),
    compare: compareCohorts(rows, { cutover: compare.cutover ?? TRACKS_CUTOVER, days: compare.days ?? COMPARE_DAYS, until }),
  };
}

const fmt = (value, suffix = '') => (value == null || Number.isNaN(value) ? '—' : `${typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}${suffix}`);

export function renderMarkdown(report) {
  const lines = [];
  lines.push(`## Метрики процесса · ${String(report.since).slice(0, 10)} — ${String(report.until).slice(0, 10)}`);
  lines.push('');
  const i = report.issues;
  lines.push(`Закрыто issue: **${i.closed}** (completed ${i.completed}, not_planned ${i.notPlanned}).`);
  lines.push('');
  lines.push('| Метрика | Значение |');
  lines.push('|---|---|');
  lines.push(`| Медиана вход → S7 | ${fmt(i.medianLeadToS7Hours, ' ч')} |`);
  lines.push(`| Медиана S7 → S8 | ${fmt(i.medianReviewToMergeHours, ' ч')} |`);
  lines.push(`| Медиана вход → S8 | ${fmt(i.medianLeadToS8Hours, ' ч')} |`);
  lines.push(`| Медиана S4 → S5 (ревью ТЗ) | ${fmt(i.medianSpecLeadHours, ' ч')} |`);
  lines.push(`| Раундов код-ревью на issue | ${fmt(i.codeReviewRounds.mean)} (${Object.entries(i.codeReviewRounds.distribution).map(([r, n]) => `r${r}: ${n}`).join(', ') || '—'}) |`);
  lines.push(`| Раундов ревью ТЗ на issue | ${fmt(i.specReviewRounds.mean)} (${Object.entries(i.specReviewRounds.distribution).map(([r, n]) => `r${r}: ${n}`).join(', ') || '—'}) |`);
  lines.push(`| Issue с повторной S7 | ${i.s7RepeatRequests} |`);
  lines.push('');
  lines.push('### Прогоны Actions');
  lines.push('');
  lines.push('| Workflow | Прогонов | ok | red | cancel | skipped | Wall, мин |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const run of report.runs) {
    lines.push(`| ${run.workflow} | ${run.runs} | ${run.success} | ${run.failure} | ${run.cancelled} | ${run.skipped} | ${minutes(run.wallMs)} |`);
  }
  lines.push('');
  const p = report.pipeline;
  lines.push(`Конвейер: S7 — ${p['S7-code-review'].runs} прогонов по ${p['S7-code-review'].issues} issue, ${p['S7-code-review'].wallMinutes} мин (≈ ${fmt(p['S7-code-review'].perRunMinutes)} мин/прогон); S4 — ${p['S4-spec-review'].runs} прогонов, ${p['S4-spec-review'].wallMinutes} мин.`);
  if (report.jobs) {
    lines.push('');
    lines.push(`Job-минуты: **${report.jobs.totalMinutes}**, из них «Мутанты» ${report.jobs.mutantMinutes} (${fmt(report.jobs.mutantShare, ' %')}).`);
  }
  lines.push('');
  lines.push('<details><summary>По issue</summary>');
  lines.push('');
  lines.push('| # | Исход | Вход → S7, ч | S7 → S8, ч | Раунды код / ТЗ | S7 постановок |');
  lines.push('|---|---|---:|---:|---|---:|');
  for (const row of [...i.rows].sort((a, b) => a.number - b.number)) {
    lines.push(`| #${row.number} | ${row.stateReason || '—'} | ${fmt(row.leadToS7Ms == null ? null : hours(row.leadToS7Ms))} | ${fmt(row.reviewToMergeMs == null ? null : hours(row.reviewToMergeMs))} | ${row.codeRounds || '—'} / ${row.specRounds || '—'} | ${row.s7Requests} |`);
  }
  lines.push('');
  lines.push('</details>');
  // #728: новые разделы — после прежних; прежние строки не меняются.
  if (report.tracks) renderTracks(lines, report.tracks);
  if ('stages' in report) renderStages(lines, report.stages);
  if ('tokens' in report) renderTokens(lines, report.tokens);
  if (report.compare) renderCompare(lines, report.compare);
  return `${lines.join('\n')}\n`;
}

const h = (value) => fmt(value);
const hoursOf = (ms) => (ms == null ? null : hours(ms));
const isoDay = (value) => String(value || '').slice(0, 10);

function renderTracks(lines, t) {
  lines.push('');
  lines.push('### По трекам');
  lines.push('');
  lines.push(`Задачи с первым \`S8-merged\` в окне: **${t.n}**. Трек — на момент первого \`S8-merged\` (прежние \`small\`/\`trivial\` — show, без метки — ask для продукта и show для инфраструктуры, §5.1). Отрезки — от первой статусной метки до первого \`S8-merged\`, сумма равна lead: queue — \`S1\`/\`S2\`/\`S5\`; spec — \`S3\` до первого возврата с ревью ТЗ; work — \`S6\` до первого возврата с код-ревью; review — \`S4\`/\`S7\` вместе с ожиданием Validate; rework — \`S3\`/\`S6\` после возврата; blocked — под \`blocked\`, вычитается из отрезка под ним.`);
  lines.push('');
  lines.push('| Трек | n | lead, ч | queue | spec | work | review | rework | blocked | Находки ship |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const row of t.byTrack) {
    const m = row.medians;
    const ship = row.ship
      ? `покрыто ${row.ship.covered} из ${row.ship.issues}, документов ${row.ship.docs}${row.ship.docs ? `: High ${row.ship.high} · Medium ${row.ship.medium} · Low ${row.ship.low}` : ''}`
      : '—';
    lines.push(`| ${row.track} | ${row.n} | ${h(m.lead)} | ${h(m.queue)} | ${h(m.spec)} | ${h(m.work)} | ${h(m.review)} | ${h(m.rework)} | ${h(m.blocked)} | ${ship} |`);
  }
  lines.push('');
  lines.push('Медианы в часах. Возвраты и раунды — по треку на момент события. Возврат — `S7 → S6`/`S3` или `S4 → S3`; причина — последний комментарий с признаком между постановкой ревью и возвратом, без признака — `unknown`. Раунд — объявление вердикта этапа в комментарии.');
  lines.push('');
  lines.push(`| Трек | Возвратов | ${RETURN_REASONS.join(' | ')} | Код-ревью: блок. / зел. | Ревью ТЗ: блок. / зел. |`);
  lines.push(`|---|---:|${RETURN_REASONS.map(() => '---:').join('|')}|---|---|`);
  for (const row of t.events) {
    lines.push(`| ${row.track} | ${row.returns} | ${RETURN_REASONS.map((reason) => row.reasons[reason]).join(' | ')} | ${row.rounds.code.blocking} / ${row.rounds.code.green} | ${row.rounds.spec.blocking} / ${row.rounds.spec.green} |`);
  }
  if (t.changed.length) {
    lines.push('');
    lines.push(`Трек менялся: ${t.changed.map((row) => `#${row.number} ${row.path.join('→')}`).join(', ')}.`);
  }
  if (t.truncated.length) {
    lines.push('');
    lines.push(`Таймлайн усечён (больше ${TIMELINE_PAGE_CAP} страниц), в отрезки не входит: ${t.truncated.map((n) => `#${n}`).join(', ')}.`);
  }
  if (t.rows.length) {
    lines.push('');
    lines.push('<details><summary>По задачам (треки)</summary>');
    lines.push('');
    lines.push('| # | Трек | Путь | Исход | lead, ч | work | review | rework | Возвраты | Объём | Находки ship |');
    lines.push('|---|---|---|---|---:|---:|---:|---:|---|---:|---|');
    for (const row of t.rows) {
      if (row.truncated) {
        lines.push(`| #${row.number} | таймлайн усечён | — | ${row.stateReason || '—'} | — | — | — | — | — | ${fmt(row.volume)} | — |`);
        continue;
      }
      const returns = row.returns.length ? row.returns.map((ret) => ret.reason).join(', ') : '—';
      const ship = row.ship ? (row.ship.docs.length ? `H ${row.ship.high} · M ${row.ship.medium} · L ${row.ship.low}` : 'не ревьюирована') : '—';
      lines.push(`| #${row.number} | ${row.track} | ${row.path.join('→')} | ${row.stateReason || '—'} | ${h(hoursOf(row.leadMs))} | ${h(hoursOf(row.segments.work))} | ${h(hoursOf(row.segments.review))} | ${h(hoursOf(row.segments.rework))} | ${returns} | ${fmt(row.volume)} | ${ship} |`);
    }
    lines.push('');
    lines.push('</details>');
  }
}

function renderStages(lines, s) {
  lines.push('');
  lines.push('### Job-минуты по стадиям');
  lines.push('');
  if (!s) {
    lines.push('Нет данных: jobs прогонов не запрашивались.');
    return;
  }
  if (!s.process) {
    lines.push('Конвейер: нет данных (jobs недоступны или прогонов нет).');
  } else {
    const tracks = Object.keys(s.process.byTrack);
    lines.push(`Конвейер, ${s.process.runs} прогонов с jobs; трек — задачи на момент прогона.`);
    lines.push('');
    lines.push(`| Стадия | Всего, мин | ${tracks.join(' | ')} |`);
    lines.push(`|---|---:|${tracks.map(() => '---:').join('|')}|`);
    for (const stage of [...PIPELINE_STAGES, 'other']) {
      if (stage === 'other' && !s.process.stages.other) continue;
      lines.push(`| ${stage} | ${s.process.stages[stage]} | ${tracks.map((track) => s.process.byTrack[track][stage]).join(' | ')} |`);
    }
  }
  lines.push('');
  lines.push(s.validate
    ? `Validate: **${s.validate.minutes}** мин за ${s.validate.runs} прогонов (${Object.entries(s.validate.byEvent).map(([event, value]) => `${event} ${value}`).join(', ') || '—'}).`
    : 'Validate: нет данных (jobs недоступны или прогонов нет).');
  if (s.truncated) {
    lines.push('');
    lines.push(`Jobs запрошены не для всех прогонов — усечено: ${s.truncated.fetched} из ${s.truncated.total} прогонов.`);
  }
  if (s.unavailable) {
    lines.push('');
    lines.push(`Jobs недоступны у ${s.unavailable} из ${s.fetched} прогонов — в минуты не входят.`);
  }
}

function renderTokens(lines, tokens) {
  lines.push('');
  lines.push('### Токены');
  lines.push('');
  lines.push(tokens?.docs
    ? `Токены по ${tokens.docs} документам ревью: ${USAGE_KEYS.map((key) => `${key} ${tokens.totals[key]}`).join(' · ')}.`
    : `${TOKENS_NO_DATA}.`);
  if (tokens?.missing) {
    lines.push('');
    lines.push(`Без данных о расходе: ${tokens.missing}.`);
  }
}

function renderCompare(lines, c) {
  lines.push('');
  lines.push(`### До и после ${c.cutover}`);
  lines.push('');
  lines.push(`Первый \`S8-merged\` в [${isoDay(c.before.from)}, ${isoDay(c.before.to)}) и [${isoDay(c.after.from)}, ${c.after.to ? isoDay(c.after.to) : '…'}), окно ${c.days} дн. Когорта — трек на момент S8 и объём задачи: \`+/−\` строк коммитов \`Issue: #NN\` без \`Release:\`, класса D и \`docs/reviews/**\` (корзины ${VOLUME_BUCKETS.join(', ')}). Медианы в часах «до → после (разница)»; n < ${MIN_COHORT} на любой стороне — мало данных. Job-минуты в сравнение не входят.`);
  lines.push('');
  if (!c.cohorts.length) {
    lines.push('Мало данных: в окне сравнения нет задач с коммитами.');
  } else {
    lines.push('| Когорта | n до | n после | lead | work | review | rework | Возвратов (среднее) |');
    lines.push('|---|---:|---:|---|---|---|---|---|');
    const pair = (cohort, name) => `${fmt(cohort.before[name])} → ${fmt(cohort.after[name])} (${cohort.diff[name] == null ? '—' : `${cohort.diff[name] > 0 ? '+' : ''}${fmt(cohort.diff[name])}`})`;
    for (const cohort of c.cohorts) {
      if (!cohort.enough) {
        lines.push(`| ${cohort.key} | ${cohort.before.n} | ${cohort.after.n} | мало данных | | | | |`);
        continue;
      }
      lines.push(`| ${cohort.key} | ${cohort.before.n} | ${cohort.after.n} | ${['lead', 'work', 'review', 'rework', 'returns'].map((name) => pair(cohort, name)).join(' | ')} |`);
    }
  }
  if (c.noCommits.length) {
    lines.push('');
    lines.push(`Без коммитов с трейлером (объёма нет, в когорты не входят): ${c.noCommits.map((n) => `#${n}`).join(', ')}.`);
  }
}

// ---------------------------------------------------------------------------
// gh-обвязка: только чтение.

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

/**
 * Снимок для отчёта: только чтение GitHub API и локального git.
 *
 * - issue `state=all` с `since` самого раннего окна (неделя отчёта или окно
 *   сравнения К7): задачи в `S8-merged` закрываются только с бетой (§2.8).
 *   Прежняя выборка (`issues`) — закрытые в окне, как раньше;
 * - таймлайн — у прежней выборки, у задач с `S8-merged` или закрытых и у
 *   задач прогонов конвейера окна; не дальше `TIMELINE_PAGE_CAP` страниц,
 *   иначе задача помечается «таймлайн усечён»;
 * - jobs (К5) — для `jobRuns`, недоступные jobs — `null`;
 * - имена документов ревью, тексты `SHIP-REVIEW-*.md` и документов со строкой
 *   расхода, коммиты `origin/dev` с `--numstat` за окно сравнения.
 */
export function fetchSnapshot({ repo, since, until, gh = ghJson, git = null, compare = {} }) {
  const sinceIso = new Date(since).toISOString();
  const untilMs = at(until);
  const cutover = toMs(compare.cutover ?? TRACKS_CUTOVER);
  const days = Number(compare.days ?? COMPARE_DAYS);
  const earliestIso = new Date(Math.min(at(sinceIso), cutover - days * DAY_MS)).toISOString();
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = gh(['api', `repos/${repo}/issues?state=all&since=${encodeURIComponent(earliestIso)}&per_page=100&page=${page}`]);
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch.filter((issue) => !issue.pull_request));
    if (batch.length < 100) break;
  }
  const closedInWindow = (issue) => {
    const closed = at(issue.closed_at);
    return Number.isFinite(closed) && closed >= at(sinceIso) && closed <= untilMs;
  };
  const issues = all.filter(closedInWindow);
  const runs = [];
  for (let page = 1; page <= 15; page++) {
    const batch = gh(['api', `repos/${repo}/actions/runs?created=${encodeURIComponent(`${sinceIso.slice(0, 10)}..${new Date(untilMs).toISOString().slice(0, 10)}`)}&per_page=100&page=${page}`]);
    const rows = batch?.workflow_runs || [];
    runs.push(...rows);
    if (rows.length < 100) break;
  }
  const { selected } = jobRuns(runs);
  const runIssues = new Set(selected.map((run) => Number(PROCESS_TITLE.exec(String(run.display_title || ''))?.[1])).filter(Number.isFinite));
  const allIssues = all.filter((issue) => closedInWindow(issue)
    || (issue.labels || []).some((label) => (label?.name ?? label) === 'S8-merged')
    || (issue.state === 'closed' && at(issue.closed_at) >= at(earliestIso))
    || runIssues.has(Number(issue.number)));
  const timelines = new Map();
  const timelineTruncated = new Set();
  for (const issue of allIssues) {
    const events = [];
    for (let page = 1; page <= TIMELINE_PAGE_CAP; page++) {
      const batch = gh(['api', `repos/${repo}/issues/${issue.number}/timeline?per_page=100&page=${page}`, '-H', 'Accept: application/vnd.github+json']);
      if (!Array.isArray(batch) || !batch.length) break;
      events.push(...batch);
      if (batch.length < 100) break;
      if (page === TIMELINE_PAGE_CAP) timelineTruncated.add(Number(issue.number));
    }
    timelines.set(Number(issue.number), events);
  }
  const jobsByRun = new Map();
  for (const run of selected) {
    try {
      const jobs = [];
      for (let page = 1; page <= 3; page++) {
        const batch = gh(['api', `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100&page=${page}`]);
        const rows = batch?.jobs || [];
        jobs.push(...rows);
        if (rows.length < 100) break;
      }
      jobsByRun.set(run.id, jobs);
    } catch {
      jobsByRun.set(run.id, null); // 403, истёк срок хранения: «нет данных», а не ноль
    }
  }
  let reviewFiles = [];
  const reviewDocs = [];
  let commits = [];
  if (git) {
    const listing = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'docs/reviews', 'legacy/reviews']);
    reviewFiles = reviewDocNames(listing);
    const paths = String(listing).split('\n').map((path) => path.trim()).filter(Boolean);
    let usage = [];
    try {
      usage = git(['grep', '-l', '-e', 'hp:usage', 'HEAD', '--', 'docs/reviews', 'legacy/reviews'])
        .split('\n').map((line) => line.trim().replace(/^HEAD:/, '')).filter(Boolean);
    } catch { /* git grep без совпадений выходит с кодом 1 */ }
    for (const path of new Set([...paths.filter((p) => SHIP_DOC.test(p)), ...usage])) {
      reviewDocs.push({ path, text: git(['show', `HEAD:${path}`]) });
    }
    let ref = 'origin/dev';
    try { git(['rev-parse', '--verify', '-q', ref]); } catch { ref = 'HEAD'; }
    // Коммиты задачи бывают раньше её S8: запас в одно окно до начала сравнения.
    commits = readCommits(git, { ref, since: at(earliestIso) - days * DAY_MS });
  }
  return { issues, allIssues, timelines, timelineTruncated, runs, jobsByRun, reviewFiles, reviewDocs, commits };
}

if (isMainModule(import.meta.url)) {
  const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const repo = arg('repo', process.env.GITHUB_REPOSITORY);
  const compare = { cutover: arg('compare', TRACKS_CUTOVER), days: Number(arg('compare-days', String(COMPARE_DAYS))) };
  if (!repo || !Number.isFinite(at(compare.cutover)) || !(compare.days > 0)) {
    console.error('usage: process-metrics.mjs --repo=<owner/repo> [--days=7] [--until=ISO] [--output=file.md] [--json=file.json] [--compare=YYYY-MM-DD] [--compare-days=28]');
    process.exit(2);
  }
  const until = arg('until', new Date().toISOString());
  const days = Number(arg('days', '7'));
  const since = new Date(at(until) - days * 86_400_000).toISOString();
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const snapshot = fetchSnapshot({ repo, since, until, git, compare });
  // #728: jobs передаёт только CLI — `buildReport` без них job-минут не выдумывает.
  const report = buildReport({ since, until, ...snapshot, compare });
  const markdown = renderMarkdown(report);
  const output = arg('output');
  if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, markdown, 'utf8'); }
  const json = arg('json');
  if (json) { mkdirSync(dirname(json), { recursive: true }); writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
  process.stdout.write(markdown);
}
