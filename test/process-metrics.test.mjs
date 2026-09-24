// #637: еженедельный замер процесса — чистые функции над снимками GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildReport, issueMetrics, jobMinutes, pipelineMetrics, renderMarkdown, reviewRounds, runMetrics,
} from '../scripts/process-metrics.mjs';

const T = (h) => new Date(Date.UTC(2026, 8, 15, 0, Math.round(h * 60))).toISOString();
const labeled = (name, h) => ({ event: 'labeled', label: { name }, created_at: T(h) });

test('#637 issueMetrics: вход по первой статусной метке, S7/S8 по первой постановке, повторы считаются отдельно', () => {
  const m = issueMetrics({ number: 600, title: 't', closed_at: T(30), state_reason: 'completed' }, [
    labeled('bug', 0), labeled('S2-analysis', 1), labeled('S3-spec', 2), labeled('S4-spec-review', 3),
    labeled('S5-ready', 5), labeled('S6-in-progress', 6), labeled('S7-code-review', 10),
    { event: 'unlabeled', label: { name: 'S7-code-review' }, created_at: T(11) },
    labeled('S7-code-review', 12), labeled('S8-merged', 20),
  ]);
  assert.equal(m.enteredAt, Date.parse(T(1)), 'bug — не статус');
  assert.equal(m.leadToS7Ms, 9 * 3_600_000);
  assert.equal(m.reviewToMergeMs, 10 * 3_600_000);
  assert.equal(m.leadToS8Ms, 19 * 3_600_000);
  assert.equal(m.specLeadMs, 2 * 3_600_000);
  assert.equal(m.s7Requests, 2);
  assert.equal(m.s4Requests, 1);
  const bare = issueMetrics({ number: 1, closed_at: 'x', state_reason: 'not_planned' }, []);
  assert.equal(bare.leadToS7Ms, null);
  assert.equal(bare.closedAt, null);
});

test('#637 reviewRounds: максимум раунда по документам, отдельно CODE и SPEC', () => {
  const rounds = reviewRounds(['CODE-REVIEW-600-r1.md', 'CODE-REVIEW-600-r2.md', 'SPEC-REVIEW-600-r1.md', 'CODE-REVIEW-601-r1.md', 'README.md', 'CODE-REVIEW-issue-5.md']);
  assert.equal(rounds.get('CODE:600'), 2);
  assert.equal(rounds.get('SPEC:600'), 1);
  assert.equal(rounds.get('CODE:601'), 1);
  assert.equal(rounds.size, 3);
});

const run = (over) => ({
  name: 'Проверка (CI)', event: 'push', conclusion: 'success', run_started_at: T(0), updated_at: T(1), ...over,
});

test('#637 runMetrics: по workflow — исходы, wall-time, события; прогоны конвейера сведены в одну строку', () => {
  const rows = runMetrics([
    run(), run({ conclusion: 'failure', event: 'workflow_dispatch' }), run({ conclusion: 'cancelled', updated_at: T(0) }),
    run({ name: 'Ревью-конвейер', display_title: 'process #600 · S7-code-review · x', event: 'issues', updated_at: T(2) }),
    run({ name: 'Ревью-конвейер', display_title: 'process #600 · bug · x', event: 'issues', conclusion: 'skipped', updated_at: T(0) }),
  ]);
  const validate = rows.find((r) => r.workflow === 'Проверка (CI)');
  assert.deepEqual([validate.runs, validate.success, validate.failure, validate.cancelled], [3, 1, 1, 1]);
  assert.equal(validate.wallMs, 2 * 3_600_000, 'отменённый без длительности не считается');
  assert.deepEqual(validate.events, { push: 2, workflow_dispatch: 1 });
  const process = rows.find((r) => r.workflow === 'process');
  assert.deepEqual([process.runs, process.skipped], [2, 1]);
});

test('#637 pipelineMetrics: минуты S7/S4 по имени прогона, skipped не считаются', () => {
  const p = pipelineMetrics([
    run({ display_title: 'process #600 · S7-code-review · x', updated_at: T(1) }),
    run({ display_title: 'process #600 · S7-code-review · x', updated_at: T(2) }),
    run({ display_title: 'process #601 · S7-code-review · x', conclusion: 'skipped', updated_at: T(2) }),
    run({ display_title: 'process #602 · S4-spec-review · x', run_started_at: T(0), updated_at: T(0.5) }),
  ]);
  assert.deepEqual(p['S7-code-review'], { runs: 2, issues: 1, wallMinutes: 180, perRunMinutes: 90 });
  assert.deepEqual(p['S4-spec-review'], { runs: 1, issues: 1, wallMinutes: 30, perRunMinutes: 30 });
});

test('#637 jobMinutes: доля «Мутанты» по именам job', () => {
  const jobs = new Map([[1, [
    { name: 'Мутанты по диффу (1/6): x', started_at: T(0), completed_at: T(1) },
    { name: 'Фронтенд: типы', started_at: T(0), completed_at: T(0.5) },
    { name: 'сломан', started_at: 'x', completed_at: T(1) },
  ]]]);
  assert.deepEqual(jobMinutes(jobs), { totalMinutes: 90, mutantMinutes: 60, mutantShare: 67 });
  assert.deepEqual(jobMinutes(new Map()), { totalMinutes: 0, mutantMinutes: 0, mutantShare: null });
});

test('#637 buildReport + renderMarkdown: сводка воспроизводит цифры аудита на фикстуре', () => {
  // Форма аудита 22.09: 30 issue с код-ревью — 15 r1, 13 r2, 2 r3 → 1.57; Validate 226 прогонов.
  const issues = [];
  const timelines = new Map();
  const reviewFiles = [];
  for (let n = 1; n <= 30; n++) {
    issues.push({ number: n, title: `t${n}`, closed_at: T(48), state_reason: 'completed' });
    timelines.set(n, [labeled('S1-new', 0), labeled('S7-code-review', 24), labeled('S8-merged', 30)]);
    const rounds = n <= 15 ? 1 : n <= 28 ? 2 : 3;
    for (let r = 1; r <= rounds; r++) reviewFiles.push(`CODE-REVIEW-${n}-r${r}.md`);
  }
  issues.push({ number: 99, title: 'dropped', closed_at: T(48), state_reason: 'not_planned' });
  const runs = Array.from({ length: 226 }, (_, k) => run({ conclusion: k < 178 ? 'success' : k < 215 ? 'failure' : 'cancelled' }));
  const report = buildReport({ since: T(0), until: T(48), issues, timelines, reviewFiles, runs });
  assert.equal(report.issues.completed, 30);
  assert.equal(report.issues.notPlanned, 1);
  assert.equal(Math.round(report.issues.codeReviewRounds.mean * 100) / 100, 1.57);
  assert.deepEqual(report.issues.codeReviewRounds.distribution, { 1: 15, 2: 13, 3: 2 });
  assert.equal(report.issues.medianLeadToS7Hours, 24);
  assert.equal(report.issues.medianReviewToMergeHours, 6);
  const validate = report.runs.find((r) => r.workflow === 'Проверка (CI)');
  assert.deepEqual([validate.runs, validate.success, validate.failure, validate.cancelled], [226, 178, 37, 11]);
  const md = renderMarkdown(report);
  assert.match(md, /Закрыто issue: \*\*31\*\* \(completed 30, not_planned 1\)/);
  assert.match(md, /Раундов код-ревью на issue \| 1\.57 \(r1: 15, r2: 13, r3: 2\)/);
  assert.match(md, /\| Проверка \(CI\) \| 226 \| 178 \| 37 \| 11 \| 0 \| 13560 \|/);
  assert.match(md, /\| #99 \| not_planned \| — \| — \| — \/ — \| 0 \|/);
  assert.equal(report.jobs, null, 'без jobs job-минуты не выдумываются');
});

test('#637 buildReport: нулевая медиана не смешивается с отсутствием данных', () => {
  const issue = { number: 637, title: 'fast', closed_at: T(4 / 60), state_reason: 'completed' };
  const timelines = new Map([[637, [
    labeled('S1-new', 0),
    labeled('S4-spec-review', 0),
    labeled('S5-ready', 1 / 60),
    labeled('S7-code-review', 2 / 60),
    labeled('S8-merged', 3 / 60),
  ]] ]);
  const report = buildReport({ since: T(0), until: T(1), issues: [issue], timelines });
  assert.deepEqual([
    report.issues.medianLeadToS7Hours,
    report.issues.medianReviewToMergeHours,
    report.issues.medianLeadToS8Hours,
    report.issues.medianSpecLeadHours,
  ], [0, 0, 0.1, 0]);
  assert.match(renderMarkdown(report), /Медиана вход → S7 \| 0 ч/);

  const empty = buildReport({ since: T(0), until: T(1) });
  assert.equal(empty.issues.medianLeadToS7Hours, null);
  assert.match(renderMarkdown(empty), /Медиана вход → S7 \| —/);
});

test('#637 workflow: еженедельный запуск читает только, публикует summary и artifact', () => {
  const wf = readFileSync(new URL('../.github/workflows/_process-metrics.yml', import.meta.url), 'utf8');
  // #623: расписание — у тонкого вызывающего файла, тело — в `_process-metrics.yml`.
  const caller = readFileSync(new URL('../.github/workflows/process-metrics.yml', import.meta.url), 'utf8');
  assert.match(caller, /schedule:\n(?:\s+#[^\n]*\n)*\s+- cron: '/);
  assert.match(caller, /workflow_dispatch:/);
  assert.ok(!/issues: write/.test(caller), 'потолок прав вызывающего тоже без записи в issue');
  assert.match(wf, /permissions:\n\s+contents: read\n\s+actions: read\n\s+issues: read/);
  assert.match(wf, /node scripts\/process-metrics\.mjs[\s\S]*--output=artifacts\/process-metrics\/report\.md/);
  assert.match(wf, /GITHUB_STEP_SUMMARY/);
  assert.ok(!/issues: write/.test(wf), 'метрики ничего не пишут в issue');
});
