#!/usr/bin/env node
// Детерминированное ожидание вердикта / CI (#496).
//
// Runbook велит автору ждать вердикт опросом: раз в 90 секунд, не более 30 раз,
// смотреть на метку. В исполнении LLM каждый тик — это ход модели с чтением JSON
// и рассуждением «ничего не изменилось» — десятки пустых ходов на одно ревью.
// Этот скрипт делает опрос сам и ГОВОРИТ только при смене состояния: одинаковое
// состояние не будит никого. Что доставляется: смена статусной метки (вердикт),
// отказ конвейера (комментарий «Ревью не запускалось» / «Слияние отменено» /
// «Автоматическое ревью не отработало»), `blocked`, `review-4`, а при `--sha` —
// исход Validate на этом SHA. Исторические комментарии до последнего запроса
// S4/S7 образуют baseline: иначе новый раунд немедленно завершался по старому
// failure. Событие текущего раунда, даже опубликованное до запуска waiter,
// доставляется сразу (#546).
//
// Скрипт НИЧЕГО не пишет: ни меток, ни комментариев, ни запусков. Новое ревью
// или релиз начинаются только по текущей авторизации человека.
//
//   node scripts/wait-verdict.mjs --issue 437 [--sha <tip>] [--interval 90] [--max 30]
//
// Коды выхода: 0 — статус сменился (вердикт есть, читать метку и комментарий);
// 3 — доставлено событие, требующее действия (отказ конвейера, конфликт,
// blocked, review-4, красный Validate); 4 — лимит ожидания, состояние прежнее;
// 2 — ошибка вызова.

import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';

export const REVIEW_LABELS = ['S4-spec-review', 'S7-code-review'];
const STATUS = ['S1-new', 'S2-analysis', 'S3-spec', 'S4-spec-review', 'S5-ready', 'S6-in-progress', 'S7-code-review', 'S8-merged'];

/** Комментарии конвейера, которые требуют действия автора или владельца. */
export const PIPELINE_EVENTS = [
  { re: /^\*\*Ревью не запускалось:\*\*/m, kind: 'conflict', text: 'конвейер: ветка не ребейзится на dev — конфликт разрешает автор' },
  { re: /^\*\*Слияние отменено/m, kind: 'stale', text: 'конвейер: слияние отменено — вершина ветки ушла от проверенного SHA (#312)' },
  { re: /^\*\*Код-ревью зелёное — вердикт выше в силе/m, kind: 'merge-conflict', text: 'конвейер: вердикт зелёный, слияние конфликтует — ребейз (rebase-on-dev.mjs) и снова S7' },
  { re: /^Автоматическое ревью не отработало/m, kind: 'failure', text: 'конвейер: прогон ревью упал — метка не менялась, смотреть логи, сообщить владельцу' },
  { re: /^Лимит циклов ревью исчерпан/m, kind: 'exhausted', text: 'конвейер: лимит циклов исчерпан — решение владельца' },
  { re: /^Конвейер ревью не запущен:/m, kind: 'refused', text: 'конвейер отказал (blocked/review-4) — читать комментарий' },
];

/** Последнее применение S4/S7 — устойчивый якорь текущего раунда ревью. */
export function reviewRequestFromEvents(events = []) {
  const requests = events
    .filter((event) => event?.event === 'labeled' && REVIEW_LABELS.includes(event?.label?.name))
    .map((event) => ({
      id: String(event.id || event.node_id || event.createdAt || event.created_at || ''),
      at: event.createdAt || event.created_at || null,
      label: event.label.name,
    }))
    .filter((request) => Number.isFinite(Date.parse(String(request.at || ''))));
  requests.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  return requests.at(-1) || null;
}

function eventBelongsToReview(comment, request) {
  if (!request) return true; // Совместимость с чистыми/старыми snapshot без timeline.
  const eventAt = Date.parse(String(comment.at || ''));
  const requestAt = Date.parse(String(request.at || ''));
  return Number.isFinite(eventAt) && Number.isFinite(requestAt) && eventAt >= requestAt;
}

/** Снимок → нормализованное состояние. */
export function stateOf(snapshot) {
  const labels = snapshot.labels || [];
  const status = STATUS.find((l) => labels.includes(l)) || null;
  const events = (snapshot.comments || [])
    .map((c) => ({ id: c.id, at: c.createdAt, event: PIPELINE_EVENTS.find((e) => e.re.test(String(c.body || ''))) }))
    .filter((c) => c.event && eventBelongsToReview(c, snapshot.reviewRequest));
  const last = events.at(-1) || null;
  return {
    status,
    blocked: labels.includes('blocked'),
    exhausted: labels.includes('review-4'),
    lastEventId: last ? String(last.id) : null,
    lastEvent: last ? last.event : null,
    reviewRequest: snapshot.reviewRequest || null,
    validate: snapshot.validate || null,
  };
}

/**
 * Решение по паре состояний: что сказать и заканчивать ли.
 * `prev` — предыдущее состояние (null на первом тике).
 */
export function decide(prev, next) {
  const lines = [];
  let code = null;
  if (prev && prev.status !== next.status) {
    lines.push(`метка: ${prev.status || '—'} → ${next.status || '—'}`);
    code = 0;
  }
  if (next.lastEventId && (!prev || prev.lastEventId !== next.lastEventId)) {
    lines.push(next.lastEvent.text);
    if (code === null) code = 3;
  }
  if (next.exhausted && (!prev || !prev.exhausted)) { lines.push('review-4: лимит циклов — решение владельца'); code = 3; }
  if (next.blocked && (!prev || !prev.blocked)) { lines.push('blocked: задача ждёт владельца, ждать вердикт бессмысленно'); code = 3; }
  if (next.validate && (!prev || !prev.validate || prev.validate.conclusion !== next.validate.conclusion || prev.validate.status !== next.validate.status)) {
    if (next.validate.status === 'completed' && next.validate.conclusion !== 'success') {
      lines.push(`Validate на SHA красный: ${next.validate.conclusion}${next.validate.url ? ` ${next.validate.url}` : ''}`);
      if (code === null) code = 3;
    } else if (next.validate.status === 'completed') {
      lines.push(`Validate на SHA зелёный${next.validate.url ? ` ${next.validate.url}` : ''}`);
    }
  }
  // Первый тик: состояние печатается один раз как точка отсчёта, без завершения.
  if (!prev) {
    lines.unshift(`ожидание: статус ${next.status || '—'}${next.blocked ? ' +blocked' : ''}${next.exhausted ? ' +review-4' : ''}`);
    if (!REVIEW_LABELS.includes(next.status) && code === null) {
      lines.push('статус не ревьюшный — ждать нечего');
      code = 0;
    }
  }
  return { lines, done: code !== null, code };
}

export async function waitForVerdict({
  readSnapshot, intervalMs = 90_000, maxTicks = 30, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log,
}) {
  let prev = null;
  for (let tick = 1; tick <= maxTicks; tick++) {
    const next = stateOf(await readSnapshot());
    const { lines, done, code } = decide(prev, next);
    for (const line of lines) log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
    if (done) return code;
    prev = next;
    if (tick < maxTicks) await sleep(intervalMs);
  }
  log(`лимит ожидания (${maxTicks} × ${Math.round(intervalMs / 1000)} с): состояние не менялось — прогон мог упасть, смотреть Actions`);
  return 4;
}

function gh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`gh ${args.join(' ')} → ${(r.stderr || r.error?.message || '').trim()}`);
  return JSON.parse(r.stdout || 'null');
}

export function ghSnapshotReader({ number, repo, sha }) {
  return async () => {
    const view = gh(['issue', 'view', String(number), '--repo', repo, '--json', 'labels,comments']);
    const pages = gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${number}/events?per_page=100`]);
    const timelineEvents = Array.isArray(pages?.[0]) ? pages.flat() : (Array.isArray(pages) ? pages : []);
    const snapshot = {
      labels: (view.labels || []).map((l) => l.name),
      comments: (view.comments || []).map((c) => ({ id: c.id || c.url || c.createdAt, createdAt: c.createdAt, body: c.body })),
      reviewRequest: reviewRequestFromEvents(timelineEvents),
    };
    if (sha) {
      try {
        const runs = gh(['run', 'list', '--repo', repo, '--workflow', 'validate.yml', '--commit', sha, '--limit', '5', '--json', 'status,conclusion,url']);
        const done = runs.find((r) => r.status === 'completed') || runs[0];
        if (done) snapshot.validate = { status: done.status, conclusion: done.conclusion, url: done.url };
      } catch { /* Validate — дополнение, не условие */ }
    }
    return snapshot;
  };
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (name, fallback = '') => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? (argv[at + 1] || '') : fallback;
  };
  const number = Number(value('issue'));
  if (!Number.isInteger(number) || number <= 0) { console.error('нужен --issue <номер>'); process.exit(2); }
  const repo = value('repo', 'Matysh/houseplan-card');
  const sha = value('sha') || null;
  const intervalMs = Number(value('interval', '90')) * 1000;
  const maxTicks = Number(value('max', '30'));
  waitForVerdict({ readSnapshot: ghSnapshotReader({ number, repo, sha }), intervalMs, maxTicks })
    .then((code) => { process.exitCode = code; })
    .catch((error) => { console.error(`wait-verdict: ${error.message}`); process.exitCode = 2; });
}
