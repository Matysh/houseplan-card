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
//   node scripts/process-metrics.mjs --repo=<owner/repo> --days=7 [--until=ISO] [--output=path.md] [--json=path.json]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

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

/** Собрать всё в один отчёт. */
export function buildReport({ since, until, issues = [], timelines = new Map(), reviewFiles = [], runs = [], jobsByRun = null }) {
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
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// gh-обвязка: только чтение.

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

export function fetchSnapshot({ repo, since, until, gh = ghJson, git = null }) {
  const sinceIso = new Date(since).toISOString();
  const untilMs = at(until);
  const issues = [];
  for (let page = 1; page <= 5; page++) {
    const batch = gh(['api', `repos/${repo}/issues?state=closed&since=${encodeURIComponent(sinceIso)}&per_page=100&page=${page}`]);
    if (!Array.isArray(batch) || !batch.length) break;
    for (const issue of batch) {
      if (issue.pull_request) continue;
      const closed = at(issue.closed_at);
      if (Number.isFinite(closed) && closed >= at(sinceIso) && closed <= untilMs) issues.push(issue);
    }
    if (batch.length < 100) break;
  }
  const timelines = new Map();
  for (const issue of issues) {
    const events = [];
    for (let page = 1; page <= 3; page++) {
      const batch = gh(['api', `repos/${repo}/issues/${issue.number}/timeline?per_page=100&page=${page}`, '-H', 'Accept: application/vnd.github+json']);
      if (!Array.isArray(batch) || !batch.length) break;
      events.push(...batch);
      if (batch.length < 100) break;
    }
    timelines.set(Number(issue.number), events);
  }
  const runs = [];
  for (let page = 1; page <= 15; page++) {
    const batch = gh(['api', `repos/${repo}/actions/runs?created=${encodeURIComponent(`${sinceIso.slice(0, 10)}..${new Date(untilMs).toISOString().slice(0, 10)}`)}&per_page=100&page=${page}`]);
    const rows = batch?.workflow_runs || [];
    runs.push(...rows);
    if (rows.length < 100) break;
  }
  const reviewFiles = git
    ? git(['ls-tree', '--name-only', 'HEAD:docs/reviews']).split('\n').filter(Boolean)
    : [];
  return { issues, timelines, runs, reviewFiles };
}

if (isMainModule(import.meta.url)) {
  const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const repo = arg('repo', process.env.GITHUB_REPOSITORY);
  if (!repo) {
    console.error('usage: process-metrics.mjs --repo=<owner/repo> [--days=7] [--until=ISO] [--output=file.md] [--json=file.json]');
    process.exit(2);
  }
  const until = arg('until', new Date().toISOString());
  const days = Number(arg('days', '7'));
  const since = new Date(at(until) - days * 86_400_000).toISOString();
  const git = (args) => execFileSync('git', args, { encoding: 'utf8' });
  const snapshot = fetchSnapshot({ repo, since, until, git });
  const report = buildReport({ since, until, ...snapshot });
  const markdown = renderMarkdown(report);
  const output = arg('output');
  if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, markdown, 'utf8'); }
  const json = arg('json');
  if (json) { mkdirSync(dirname(json), { recursive: true }); writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
  process.stdout.write(markdown);
}
