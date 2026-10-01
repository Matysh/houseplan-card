// #637: еженедельный замер процесса — чистые функции над снимками GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  buildReport, issueMetrics, jobMinutes, pipelineMetrics, renderMarkdown, reviewDocNames, reviewRounds, runMetrics,
  NOT_RUN_CONFLICT_RE, NOT_RUN_VALIDATE_RE, TIMELINE_PAGE_CAP, TOKENS_NO_DATA, TRACKS_CUTOVER,
  compareCohorts, fetchSnapshot, isInfra, issueChanges, issueSegments, issueTrackMetrics, jobRuns, jobStage,
  readCommits, returnSignal, reviewDocAddedAt, shipFindings, stageMinutes, tokenDocs, tokenUsage, trackAt, trackPath, trackSection, volumeBucket,
} from '../scripts/process-metrics.mjs';
import { labelTrack } from '../scripts/process-track.mjs';
import { commentFor } from '../scripts/merge-candidate.mjs';
import { anchorBlock } from '../scripts/ship-review.mjs';
import { withMaterialAnchors } from '../scripts/review-doc-guard.mjs';
import { formatUsage } from '../scripts/model-usage.mjs';
import { PIPELINE_EVENTS } from '../scripts/wait-verdict.mjs';

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

test('#682 reviewDocNames: живой каталог и архив legacy/reviews/<тег>/ считаются вместе', () => {
  const listing = [
    'docs/reviews/CODE-REVIEW-600-r2.md',
    'docs/reviews/INDEX.md',
    'legacy/reviews/v1.77.0/CODE-REVIEW-600-r1.md',
    'legacy/reviews/v1.77.0/SPEC-REVIEW-601-r1.md',
    'legacy/docs/ROADMAP.md',
    '',
  ].join('\n');
  const names = reviewDocNames(listing);
  assert.deepEqual(names, ['CODE-REVIEW-600-r2.md', 'INDEX.md', 'CODE-REVIEW-600-r1.md', 'SPEC-REVIEW-601-r1.md']);
  // Перенос r1 в архив не уменьшает число раундов задачи.
  assert.equal(reviewRounds(names).get('CODE:600'), 2);
});

// ---------------------------------------------------------------------------
// #728: эффект процесса по трекам.

const unlabeled = (name, h) => ({ event: 'unlabeled', label: { name }, created_at: T(h) });
const commented = (body, h) => ({ event: 'commented', body, created_at: T(h) });
const labeledAt = (name, iso) => ({ event: 'labeled', label: { name }, created_at: iso });
const HOUR = 3_600_000;

test('#728 trackAt: трек на момент события и путь трека, прежние метки и инфраструктура (AC1)', () => {
  const events = [
    labeled('S1-new', 0), labeled('track:ship', 0), labeled('S5-ready', 1), labeled('S6-in-progress', 2),
    unlabeled('track:ship', 5), labeled('track:show', 5), labeled('S7-code-review', 6), labeled('S8-merged', 9),
    unlabeled('track:show', 10), labeled('track:ask', 10),
  ];
  assert.equal(trackAt(events, T(4)), 'ship', 'до смены');
  assert.equal(trackAt(events, T(5)), 'ship', 'в сам момент смены — метки строго до него');
  assert.equal(trackAt(events, T(6)), 'show', 'после смены');
  assert.deepEqual(trackPath(events, { from: T(0), to: T(9) }), ['ship', 'show']);
  const row = issueTrackMetrics({ number: 701 }, events);
  assert.equal(row.track, 'show', 'трек задачи — на момент S8, смена после слияния не в счёт');
  assert.deepEqual(row.path, ['ship', 'show']);

  // Прежние метки до 28.09 — по §5.1.
  const legacy = [labeledAt('S1-new', '2026-09-20T10:00:00Z'), labeledAt('small', '2026-09-20T10:00:00Z')];
  assert.equal(trackAt(legacy, '2026-09-21T00:00:00Z'), 'show', 'small → show');
  const bare = [labeledAt('S1-new', '2026-09-20T10:00:00Z')];
  assert.equal(trackAt(bare, '2026-09-21T00:00:00Z'), 'ask', 'без метки, продукт → ask');
  assert.equal(trackAt(bare, '2026-09-21T00:00:00Z', { infra: true }), 'show', 'без метки, инфраструктура → show');
  // Две трековые метки — как у process-track.mjs: строжайшая.
  const both = [labeled('track:ship', 0), labeled('track:ask', 0)];
  assert.equal(trackAt(both, T(1)), labelTrack({ labels: ['track:ship', 'track:ask'] }));
  assert.equal(trackAt(both, T(1)), 'ask');

  // infra — ни одного файла класса A в коммитах задачи; Release:-коммит не в счёт.
  const commits = [
    { sha: 'a'.repeat(40), body: 'x\n\nIssue: #801\n', issues: [801], files: [{ added: 5, deleted: 0, path: 'scripts/x.mjs' }] },
    { sha: 'b'.repeat(40), body: 'x\n\nIssue: #802\n', issues: [802], files: [{ added: 5, deleted: 0, path: 'src/x.ts' }] },
    { sha: 'c'.repeat(40), body: 'rel\n\nIssue: #801\nRelease: v1.0.0-beta.1\n', issues: [801], files: [{ added: 1, deleted: 1, path: 'custom_components/houseplan/manifest.json' }] },
  ];
  const timelines = new Map([[801, [labeled('S6-in-progress', 0), labeled('S8-merged', 2)]], [802, [labeled('S6-in-progress', 0), labeled('S8-merged', 2)]]]);
  const report = buildReport({ since: T(0), until: T(48), issues: [{ number: 801 }, { number: 802 }], timelines, commits });
  const byNumber = new Map(report.tracks.rows.map((r) => [r.number, r]));
  assert.equal(byNumber.get(801).track, 'show', 'инфраструктура без метки → show');
  assert.equal(byNumber.get(802).track, 'ask', 'продукт без метки → ask');
});

test('#728 issueSegments: отрезки по часам, blocked вычитается, сумма равна lead (AC2)', () => {
  const events = [
    labeled('S1-new', 0), labeled('S5-ready', 1), labeled('S6-in-progress', 2),
    labeled('blocked', 3), unlabeled('blocked', 4),
    labeled('S7-code-review', 5), labeled('S6-in-progress', 6), labeled('S7-code-review', 8), labeled('S8-merged', 9),
  ];
  const seg = issueSegments(events);
  const inHours = Object.fromEntries(Object.entries(seg.segments).map(([k, v]) => [k, v / HOUR]));
  assert.deepEqual(inHours, { queue: 2, spec: 0, work: 2, review: 2, rework: 2, blocked: 1 });
  assert.equal(seg.leadMs, 9 * HOUR);
  assert.equal(Object.values(seg.segments).reduce((a, b) => a + b, 0), seg.leadMs, 'сумма отрезков = lead');
  assert.equal(seg.returns.length, 1);

  // Повторная постановка S7 конвейером (#636, #706) — не возврат и не новый отрезок.
  const repeated = issueSegments([
    ...events.slice(0, 6), labeled('S7-code-review', 5.5),
    events[6], events[7], unlabeled('S7-code-review', 8.5), labeled('S7-code-review', 8.5), events[8],
  ]);
  assert.deepEqual(repeated.segments, seg.segments);
  assert.equal(repeated.returns.length, 1);
  // …и не сдвигает начало окна причины: вердикт до повторной постановки остаётся причиной.
  const verdictBefore = issueTrackMetrics({ number: 701 }, [
    ...events.slice(0, 6), commented('Вердикт: жёлтый · Документ: docs/reviews/CODE-REVIEW-701-r1.md', 5.2),
    labeled('S7-code-review', 5.5), ...events.slice(6),
  ]);
  assert.deepEqual(verdictBefore.returns.map((r) => r.reason), ['verdict-yellow']);

  // Ревью ТЗ: S3 до первого возврата — spec, после S4 → S3 — rework.
  const spec = issueSegments([
    labeled('S3-spec', 0), labeled('S4-spec-review', 2), labeled('S3-spec', 3), labeled('S4-spec-review', 4),
    labeled('S5-ready', 5), labeled('S6-in-progress', 6), labeled('S7-code-review', 7), labeled('S8-merged', 8),
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(spec.segments).map(([k, v]) => [k, v / HOUR])),
    { queue: 1, spec: 2, work: 1, review: 3, rework: 1, blocked: 0 });
  assert.deepEqual(spec.returns.map((r) => r.stage), ['spec']);
  assert.equal(issueSegments([labeled('S6-in-progress', 0)]), null, 'без S8 — не в выборке');
});

const NUM = 701;
const VERDICT_YELLOW = `Вердикт: жёлтый · заход r1 · High: 0 · Medium: 2 · Документ: docs/reviews/CODE-REVIEW-${NUM}-r1.md`;
const VERDICT_RED = `**Вердикт: красный** · заход r2 · High: 1 · Документ: docs/reviews/CODE-REVIEW-${NUM}-r2.md`;

/** Шаблоны «Ревью не запускалось» из `_process.yml`: снять экранирование и подставить `$kind`. */
function notRunTemplates() {
  const workflow = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
  const templates = workflow.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('**Ревью не запускалось:**'));
  const step = workflow.slice(workflow.indexOf('- name: Validate красный — вернуть автору без ревью'));
  const kinds = ['Validate', 'Validate с мутантами'];
  for (const kind of kinds) assert.ok(step.slice(0, 1500).includes(`kind="${kind}"`), `шаг Validate красный задаёт kind="${kind}"`);
  return templates.map((line) => kinds.map((kind) => line.replaceAll('\\`', '`').replaceAll('$kind', kind)
    .replaceAll('$BRANCH', 'issue/701-white-tile').replaceAll('$short', '1a2b3c4').replaceAll('$RESULT', 'failed')));
}

test('#728 returnSignal: причины возврата на текстах конвейера (AC3)', () => {
  const sig = (body) => returnSignal(body, { stage: 'code', number: NUM });
  assert.equal(sig(VERDICT_YELLOW), 'verdict-yellow');
  assert.equal(sig(VERDICT_RED), 'verdict-red');
  assert.equal(sig(VERDICT_YELLOW.replace(`CODE-REVIEW-${NUM}`, 'CODE-REVIEW-702')), null, 'вердикт о чужом документе — не причина');
  assert.equal(sig(`Вердикт: зелёный · заход r1 · Документ: docs/reviews/CODE-REVIEW-${NUM}-r1.md`), null, 'зелёный — не причина возврата');
  assert.equal(sig(commentFor('reject-stale', { material: 'a'.repeat(40), actual: 'b'.repeat(40) })), 'merge');
  assert.equal(sig(commentFor('conflict', { branch: 'issue/701-x' })), 'merge');
  assert.ok(PIPELINE_EVENTS.find((e) => e.kind === 'stale').re.test(commentFor('reject-stale', {})), 'текст под константу конвейера');
  assert.equal(sig('**Ревью не запускалось:** что-то третье, о чём отчёт не знает.'), 'unknown');
  const refused = commentFor('push-refused-workflow', {
    stage: 'rebase', candidate: 'c'.repeat(40), branch: 'issue/701-x', refusal: { files: ['.github/workflows/x.yml'] },
  });
  assert.match(refused, /^\*\*Ревью не запускалось: кандидат меняет workflow-файл/);
  assert.equal(sig(refused), null, 'отказ push по праву на workflow (#705) — без признака, возврат уйдёт в unknown');
  assert.equal(sig('Текст.\n\n<!-- hp:route reclassify criterion=undocumented -->'), 'reclassify');
  assert.equal(sig('Текст.\n\n<!-- hp:route owner-question criterion=undocumented -->'), 'owner-question');
  assert.equal(sig('Пока шло ревью, `dev` продвинулся на 2 коммит(ов).'), null);
  assert.equal(NOT_RUN_VALIDATE_RE.flags.includes('m') && NOT_RUN_CONFLICT_RE.flags.includes('m'), true);
});

test('#728 контракт: шаблоны «Ревью не запускалось» _process.yml дают conflict и validate-red (AC3)', () => {
  const templates = notRunTemplates();
  assert.equal(templates.length, 2, 'шаблонов «Ревью не запускалось:» в _process.yml ровно два');
  const reasons = templates.map((variants) => [...new Set(variants.map((text) => returnSignal(text, { stage: 'code', number: NUM })))]);
  assert.deepEqual(reasons.map((r) => r.join(',')).sort(), ['conflict', 'validate-red'],
    'один шаблон — conflict, другой — validate-red при обоих $kind');
  for (const variants of templates) {
    for (const text of variants) assert.ok(PIPELINE_EVENTS.find((e) => e.kind === 'conflict').re.test(text), 'общий префикс — под константой PIPELINE_EVENTS');
  }
});

test('#728 returnReason: последний комментарий с признаком, возврат без комментария — unknown, трек своего момента (AC3)', () => {
  const issue = { number: NUM };
  const cycle = (h, comment) => [
    labeled('S7-code-review', h), ...(comment ? [commented(comment, h + 0.5)] : []), labeled('S6-in-progress', h + 0.5),
  ];
  const templates = notRunTemplates();
  const conflict = templates.find((variants) => variants[0].includes(' ветка '));
  const validate = templates.find((variants) => variants !== conflict);
  const events = [
    labeled('S1-new', 0), labeled('track:ship', 0), labeled('S6-in-progress', 1),
    ...cycle(2, VERDICT_YELLOW),
    ...cycle(3, VERDICT_RED),
    ...cycle(4, validate[0]),
    ...cycle(5, validate[1]),
    unlabeled('track:ship', 5.8), labeled('track:show', 5.8),
    ...cycle(6, conflict[0]),
    ...cycle(7, commentFor('reject-stale', {})),
    // Комментарий без признака после вердикта не перекрывает причину.
    labeled('S7-code-review', 8), commented(VERDICT_YELLOW, 8.2), commented('Пока шло ревью, `dev` продвинулся на 1 коммит(ов).', 8.3), labeled('S6-in-progress', 8.5),
    ...cycle(9, null),
    ...cycle(10, VERDICT_YELLOW.replace(`CODE-REVIEW-${NUM}`, 'CODE-REVIEW-702')),
    ...cycle(11, '**Ревью не запускалось:** иное продолжение.'),
    ...cycle(12, commentFor('push-refused-workflow', { stage: 'rebase', candidate: 'c'.repeat(40), branch: 'b' })),
    labeled('S7-code-review', 13), commented('Ревью show: решать есть что.\n<!-- hp:route owner-question criterion=undocumented -->', 13.5),
    labeled('blocked', 13.5), labeled('S6-in-progress', 13.5), unlabeled('blocked', 13.8),
    labeled('S7-code-review', 14), commented('Трек повышен.\n<!-- hp:route reclassify criterion=undocumented -->', 14.5),
    labeled('S3-spec', 14.5), unlabeled('track:show', 14.5), labeled('track:ask', 14.5),
    labeled('S4-spec-review', 15), commented(`Вердикт: красный · Документ: docs/reviews/SPEC-REVIEW-${NUM}-r1.md`, 15.5), labeled('S3-spec', 15.5),
    labeled('S4-spec-review', 16), labeled('S5-ready', 16.5), labeled('S6-in-progress', 17), labeled('S7-code-review', 18), labeled('S8-merged', 19),
  ];
  const row = issueTrackMetrics(issue, events);
  assert.deepEqual(row.returns.map((r) => r.reason), [
    'verdict-yellow', 'verdict-red', 'validate-red', 'validate-red', 'conflict', 'merge', 'verdict-yellow',
    'unknown', 'unknown', 'unknown', 'unknown', 'owner-question', 'reclassify', 'verdict-red',
  ]);
  assert.deepEqual(row.returns.map((r) => r.track), [
    'ship', 'ship', 'ship', 'ship', 'show', 'show', 'show', 'show', 'show', 'show', 'show', 'show', 'show', 'ask',
  ], 'возврат — по треку своего момента; reclassify — на треке, где шло ревью');
  assert.deepEqual(row.path, ['ship', 'show', 'ask']);
  assert.equal(row.track, 'ask');
  const section = trackSection([row]);
  const ship = section.events.find((e) => e.track === 'ship');
  assert.deepEqual([ship.returns, ship.reasons['verdict-yellow'], ship.reasons['validate-red']], [4, 1, 2]);
  assert.equal(section.events.find((e) => e.track === 'show').reasons.unknown, 4);
  // Раунды — объявления вердикта этапа, по треку и блокирующие/зелёные.
  assert.deepEqual([ship.rounds.code.blocking, ship.rounds.code.green], [2, 0]);
  assert.deepEqual(section.events.find((e) => e.track === 'ask').rounds.spec, { blocking: 1, green: 0 });
});

test('#728 shipFindings: находки пакетного ревью ship по машинному блоку, архив тоже читается (AC4)', () => {
  const doc = (tag, issues, high, medium, low) => anchorBlock({ tag, candidate: 'c'.repeat(40), issues, high, medium, low });
  const reviewDocs = [
    { path: 'docs/reviews/SHIP-REVIEW-v1.79.0-beta.2.md', text: `# Пакетное ревью\n\n${doc('v1.79.0-beta.2', [701, 702], 0, 1, 2)}` },
    { path: 'legacy/reviews/v1.78.0/SHIP-REVIEW-v1.78.0-beta.9.md', text: doc('v1.78.0-beta.9', [703], 1, 0, 0) },
    { path: 'docs/reviews/CODE-REVIEW-701-r1.md', text: doc('v1.79.0-beta.2', [701], 9, 9, 9) },
  ];
  const { byIssue } = shipFindings(reviewDocs);
  assert.deepEqual(byIssue.get(701), { high: 0, medium: 1, low: 2, docs: ['docs/reviews/SHIP-REVIEW-v1.79.0-beta.2.md'] });
  assert.deepEqual([byIssue.get(702).medium, byIssue.get(702).low], [1, 2]);
  assert.equal(byIssue.get(703).high, 1, 'документ из legacy/reviews/ читается');
  assert.equal(byIssue.has(704), false, 'задачи нет в блоке — находок нет');

  const shipped = (n) => [labeled('S1-new', 0), labeled('track:ship', 0), labeled('S6-in-progress', 1), labeled('S7-code-review', 2), labeled('S8-merged', 3)];
  const timelines = new Map([701, 702, 704].map((n) => [n, shipped(n)]));
  const report = buildReport({ since: T(0), until: T(48), issues: [701, 702, 704].map((number) => ({ number })), timelines, reviewDocs });
  const rows = new Map(report.tracks.rows.map((r) => [r.number, r]));
  assert.deepEqual([rows.get(701).ship.medium, rows.get(701).ship.low], [1, 2]);
  assert.deepEqual(rows.get(704).ship, { high: 0, medium: 0, low: 0, docs: [] });
  const ship = report.tracks.byTrack.find((r) => r.track === 'ship').ship;
  assert.deepEqual(ship, { issues: 3, covered: 2, docs: 1, high: 0, medium: 1, low: 2 }, 'документ на две задачи — один раз');
  assert.match(renderMarkdown(report), /\| ship \| 3 \|[^\n]*покрыто 2 из 3, документов 1: High 0 · Medium 1 · Low 2 \|/);
});

const jobsRun = (id, over) => ({ id, name: 'Ревью-конвейер', event: 'issues', conclusion: 'success', run_started_at: T(10), updated_at: T(11), ...over });
const job = (name, startH, endH) => ({ name, started_at: T(startH), completed_at: T(endH) });

test('#728 stageMinutes: job-минуты по стадиям и треку, Validate по событию, усечение, нет данных (AC5)', () => {
  const runs = [
    jobsRun(1, { display_title: 'process #701 · S7-code-review · x' }),
    jobsRun(2, { display_title: 'process #701 · bug · x', conclusion: 'skipped' }),
    jobsRun(3, { name: 'Проверка (CI)', display_title: 'feat: x', event: 'push' }),
    jobsRun(4, { name: 'Проверка (CI)', display_title: 'feat: x', event: 'workflow_dispatch' }),
  ];
  const jobsByRun = new Map([
    [1, [
      job('dev / Страж: ребейз на dev и предпосылки ревью', 10, 10.1),
      job('dev / Ревью: материал и deterministic gates', 10.1, 10.3),
      job('dev / Ревью: работа модели', 10.3, 10.8),
      job('dev / Ревью: публикация и интеграция', 10.8, 10.9),
    ]],
    [3, [job('Фронтенд: типы', 10, 10.25), job('Мутанты по диффу (1/6): x', 10, 10.5)]],
    [4, [job('Фронтенд: типы', 10, 11)]],
  ]);
  assert.deepEqual(jobRuns(runs).selected.map((r) => r.id), [1, 3, 4], 'skipped без jobs');
  const timelines = new Map([[701, [labeled('S1-new', 0), labeled('track:ship', 0), labeled('S6-in-progress', 1), labeled('S8-merged', 20)]]]);
  const report = buildReport({ since: T(0), until: T(48), issues: [{ number: 701 }], timelines, runs, jobsByRun });
  assert.deepEqual(report.stages.process.stages, { guard: 6, prepare: 12, model: 30, integrate: 6, other: 0 });
  assert.deepEqual(report.stages.process.byTrack, { ship: { guard: 6, prepare: 12, model: 30, integrate: 6, other: 0 } });
  assert.deepEqual(report.stages.validate, { runs: 2, minutes: 105, byEvent: { push: 45, workflow_dispatch: 60 } });
  assert.equal(report.stages.truncated, null);
  const md = renderMarkdown(report);
  assert.match(md, /### Job-минуты по стадиям[\s\S]*\| model \| 30 \| 30 \|/);
  assert.match(md, /Validate: \*\*105\*\* мин за 2 прогонов \(push 45, workflow_dispatch 60\)/);
  assert.match(md, /Job-минуты: \*\*159\*\*, из них «Мутанты» 30/, 'прежняя строка снова печатается');

  // 601-й прогон — усечено.
  const many = Array.from({ length: 601 }, (_, k) => jobsRun(100 + k, { name: 'Проверка (CI)', display_title: 'x', event: 'push' }));
  assert.equal(jobRuns(many).selected.length, 600);
  const capped = stageMinutes({ runs: many, jobsByRun: new Map(many.map((r) => [r.id, []])) });
  assert.deepEqual(capped.truncated, { fetched: 600, total: 601 });
  assert.match(renderMarkdown(buildReport({ since: T(0), until: T(48), runs: many, jobsByRun: new Map() })), /усечено: 600 из 601 прогонов/);

  // Jobs недоступны (403, истёк срок) — «нет данных», а не ноль.
  const gone = buildReport({ since: T(0), until: T(48), issues: [{ number: 701 }], timelines, runs, jobsByRun: new Map([[1, null], [3, null], [4, null]]) });
  assert.equal(gone.stages.process, null);
  assert.equal(gone.stages.validate, null);
  assert.equal(gone.stages.unavailable, 3);
  const goneMd = renderMarkdown(gone);
  assert.match(goneMd, /Конвейер: нет данных/);
  assert.match(goneMd, /Validate: нет данных/);
  assert.doesNotMatch(goneMd.slice(goneMd.indexOf('### Job-минуты по стадиям')), /\| guard \| 0/);
});

test('#728 контракт: имена job _process.yml дают четыре стадии конвейера (AC5)', () => {
  const workflow = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
  const names = [...workflow.matchAll(/^ {4}name: "([^"]+)"$/gm)].map((m) => m[1]);
  assert.deepEqual(names.map((name) => jobStage(`dev / ${name}`)), ['guard', 'prepare', 'model', 'integrate']);
});

test('#728 tokenUsage: без строки расхода — «нет данных», чисел токенов нет (AC6)', () => {
  const report = buildReport({ since: T(0), until: T(48), reviewDocs: [{ path: 'docs/reviews/CODE-REVIEW-701-r1.md', text: '# Ревью\n\nВердикт: зелёный' }] });
  assert.deepEqual(report.tokens, { docs: 0, totals: null, missing: 0 });
  const md = renderMarkdown(report);
  assert.ok(md.includes(TOKENS_NO_DATA));
  assert.equal(TOKENS_NO_DATA, 'Токены: нет данных (ни один документ ревью не несёт расход модели)', '#737: конвейер строку пишет');
  const section = md.slice(md.indexOf('### Токены'), md.indexOf('###', md.indexOf('### Токены') + 3));
  assert.doesNotMatch(section, /\d/, 'ни оценок, ни пересчётов из минут');
  // #737: строка вне машинного блока больше не читается — это намеренно.
  const recorded = tokenUsage([{ path: 'docs/reviews/CODE-REVIEW-701-r1.md', text: '<!-- hp:usage input_tokens=1200 output_tokens=300 -->' }]);
  assert.deepEqual(recorded, { docs: 0, totals: null, missing: 0 }, 'строка без машинного блока — не данные');
});

// #737 К6: расход — только из машинного блока документа (после маркера блока
// якорей или последнего маркера SHIP-REVIEW). «Нет данных» — не ноль.
test('#737 AC6 tokenUsage: только строка машинного блока; суммы по пяти ключам; «нет данных» — не ноль', () => {
  const usage = (input, output, creation, read, turns) => formatUsage({
    input_tokens: input, output_tokens: output, cache_creation_input_tokens: creation, cache_read_input_tokens: read, num_turns: turns,
  });
  const r1 = usage(1000, 200, 30, 4000, 5);
  const r2 = usage(2000, 300, 40, 5000, 6);
  const night = usage(100, 10, 1, 1000, 2);
  // r2 цитирует документ r1 в прозе — расход r1 не засчитывается второй раз.
  const code = { path: 'docs/reviews/CODE-REVIEW-701-r2.md',
    text: withMaterialAnchors(`# CODE-REVIEW-701-r2\n\nУнаследовано из r1:\n\n${r1}\n`, { tree: 'a'.repeat(40), verdict: 'green', high: 0, usage: r2 }) };
  const ship = { path: 'docs/reviews/SHIP-REVIEW-v1.0.0-dev-0123456789ab.md',
    text: `# Ночное ревью\nИтог: High 0 · Medium 0 · Low 0\n${r1}\n\n${anchorBlock({ tag: 'nightly', candidate: 'c'.repeat(40), issues: [701], usage: night })}` };
  assert.deepEqual(tokenUsage([code]), { docs: 1, totals: { input_tokens: 2000, output_tokens: 300, cache_creation_input_tokens: 40, cache_read_input_tokens: 5000, num_turns: 6 }, missing: 0 },
    'считается только строка блока, проза до маркера — нет');
  const both = tokenUsage([code, ship]);
  assert.deepEqual(both, { docs: 2, totals: { input_tokens: 2100, output_tokens: 310, cache_creation_input_tokens: 41, cache_read_input_tokens: 6000, num_turns: 8 }, missing: 0 });
  const tokensSection = (report) => {
    const md = renderMarkdown(report);
    const at = md.indexOf('### Токены');
    return md.slice(at, md.indexOf('###', at + 3));
  };
  const withData = tokensSection(buildReport({ since: T(0), until: T(48), reviewDocs: [code, ship] }));
  assert.match(withData, /^Токены по 2 документам ревью: input_tokens 2100 · output_tokens 310 · cache_creation_input_tokens 41 · cache_read_input_tokens 6000 · num_turns 8\.$/m);
  assert.doesNotMatch(withData, /Без данных о расходе/);

  // hp:usage-none — документ без данных: в суммы не входит, ноль не печатается.
  const none = { path: 'legacy/reviews/v1.0/SPEC-REVIEW-702-r1.md',
    text: withMaterialAnchors('# SPEC-REVIEW-702-r1\n', { tree: 'b'.repeat(40), verdict: 'green', high: 0, usage: '' }) };
  assert.deepEqual(tokenUsage([code, ship, none]), { ...both, missing: 1 });
  const mixed = tokensSection(buildReport({ since: T(0), until: T(48), reviewDocs: [code, ship, none] }));
  assert.match(mixed, /^Токены по 2 документам ревью: input_tokens 2100 [^\n]*\n\nБез данных о расходе: 1\.$/m);
  assert.deepEqual(tokenUsage([none]), { docs: 0, totals: null, missing: 1 });
  const onlyNone = tokensSection(buildReport({ since: T(0), until: T(48), reviewDocs: [none] }));
  assert.ok(onlyNone.includes(`${TOKENS_NO_DATA}.`));
  assert.match(onlyNone, /Без данных о расходе: 1\./);
  assert.doesNotMatch(onlyNone, /input_tokens|\b0\b/, '«нет данных» не печатается нулём');

  // Строк нет вовсе (документы до #737, строка только в прозе) — «нет данных», цифр нет.
  const old = { path: 'docs/reviews/CODE-REVIEW-700-r1.md', text: `# r1\n${r1}\n` };
  const empty = tokensSection(buildReport({ since: T(0), until: T(48), reviewDocs: [old] }));
  assert.ok(empty.includes(`${TOKENS_NO_DATA}.`));
  assert.doesNotMatch(empty, /\d/);
});

test('#728 сравнение: объём из git без Release:, dist/** и docs/reviews/**, корзины и «мало данных» (AC7)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-728-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  git('init', '-q', '-b', 'dev');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  git('config', 'core.hooksPath', '/dev/null');
  const write = (path, lines) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), `${Array.from({ length: lines }, (_, k) => `l${k}`).join('\n')}\n`); };
  write('src/a.ts', 10); write('dist/houseplan-card.js', 500); write('docs/reviews/CODE-REVIEW-701-r1.md', 40);
  git('add', '.'); git('commit', '-q', '-m', 'feat: a (#701)\n\nIssue: #701\nUser-Visible: no');
  write('src/b.ts', 300);
  git('add', '.'); git('commit', '-q', '-m', 'Release v1.0.0-beta.1 candidate\n\nIssue: #701\nRelease: v1.0.0-beta.1');
  write('scripts/x.mjs', 25);
  git('add', '.'); git('commit', '-q', '-m', 'test: x (#702)\n\nIssue: #702');
  const commits = readCommits((args) => git(...args), { ref: 'HEAD', since: '2000-01-01' });
  assert.equal(commits.length, 3);
  const changes = issueChanges(commits);
  assert.equal(changes.get(701).lines, 10, 'без Release:-коммита, без dist/** и без docs/reviews/**');
  assert.equal(changes.get(702).lines, 25);
  assert.equal(isInfra(changes.get(701)), false);
  assert.equal(isInfra(changes.get(702)), true);

  assert.deepEqual([0, 30, 31, 200, 201, 1000, 1001].map(volumeBucket), ['≤30', '≤30', '31–200', '31–200', '201–1000', '201–1000', '>1000']);
  assert.equal(volumeBucket(null), null);

  const row = (number, iso, track, volume, leadH, returns = 0) => ({
    number, s8At: Date.parse(iso), track, volume, bucket: volumeBucket(volume), truncated: false, leadMs: leadH * HOUR,
    segments: { queue: 0, spec: 0, work: leadH * HOUR / 2, review: leadH * HOUR / 2, rework: 0, blocked: 0 },
    returns: Array.from({ length: returns }, () => ({ reason: 'verdict-yellow' })),
  });
  const rows = [
    row(1, '2026-09-01T00:00:00Z', 'show', 10, 10, 1), row(2, '2026-09-10T00:00:00Z', 'show', 20, 12, 1), row(3, '2026-09-27T23:00:00Z', 'show', 30, 14, 0),
    row(4, '2026-09-28T00:00:00Z', 'show', 5, 4), row(5, '2026-09-29T00:00:00Z', 'show', 6, 6), row(6, '2026-10-01T00:00:00Z', 'show', 7, 8),
    row(7, '2026-09-05T00:00:00Z', 'ask', 150, 40), row(8, '2026-09-06T00:00:00Z', 'ask', 160, 50),
    row(9, '2026-09-30T00:00:00Z', 'ask', 170, 20), row(10, '2026-10-02T00:00:00Z', 'ask', 180, 21), row(11, '2026-10-03T00:00:00Z', 'ask', 190, 22),
    row(12, '2026-08-30T23:59:00Z', 'show', 10, 99), row(13, '2026-10-04T00:00:00Z', 'show', 10, 99),
    { ...row(14, '2026-09-20T00:00:00Z', 'show', null, 1), bucket: null },
  ];
  const compare = compareCohorts(rows, { cutover: '2026-09-28', days: 28, until: '2026-10-04T00:00:00Z' });
  const show = compare.cohorts.find((c) => c.key === 'show · ≤30');
  assert.deepEqual([show.before.n, show.after.n, show.enough], [3, 3, true], '#12 до окна и #13 в until не входят');
  assert.deepEqual([show.before.lead, show.after.lead, show.diff.lead], [12, 6, -6]);
  assert.deepEqual([show.before.returns, show.after.returns], [0.67, 0]);
  const ask = compare.cohorts.find((c) => c.key === 'ask · 31–200');
  assert.deepEqual([ask.before.n, ask.after.n, ask.enough, ask.diff], [2, 3, false, null]);
  assert.deepEqual(compare.noCommits, [14]);
  const md = renderMarkdown({ ...buildReport({ since: T(0), until: T(1) }), compare });
  assert.match(md, /\| show · ≤30 \| 3 \| 3 \| 12 → 6 \(-6\) \|/);
  assert.match(md, /\| ask · 31–200 \| 2 \| 3 \| мало данных \|/);
  assert.match(md, /Без коммитов с трейлером[^\n]*#14/);
});

test('#728 renderMarkdown: новые разделы после прежних, JSON несёт те же поля, buildReport без jobs (AC8)', () => {
  const report = buildReport({ since: T(0), until: T(48), issues: [{ number: 701, closed_at: T(30), state_reason: 'completed' }],
    timelines: new Map([[701, [labeled('S1-new', 0), labeled('S7-code-review', 2), labeled('S8-merged', 3)]]]) });
  assert.equal(report.jobs, null);
  assert.equal(report.stages, null, 'jobs передаёт только CLI');
  const md = renderMarkdown(report);
  const order = ['</details>', '### По трекам', '### Job-минуты по стадиям', '### Токены', `### До и после ${TRACKS_CUTOVER}`].map((s) => md.indexOf(s));
  assert.ok(order.every((i) => i > 0) && order.every((i, k) => k === 0 || i > order[k - 1]), `порядок разделов: ${order}`);
  assert.match(md, /Нет данных: jobs прогонов не запрашивались/);
  const json = JSON.parse(JSON.stringify(report));
  for (const key of ['tracks', 'stages', 'tokens', 'compare']) assert.ok(key in json, key);
  assert.equal(json.tracks.rows[0].track, 'ask');
});

test('#728 workflow: полная история и потолок 30 минут', () => {
  const wf = readFileSync(new URL('../.github/workflows/_process-metrics.yml', import.meta.url), 'utf8');
  const metrics = wf.slice(wf.indexOf('\n  metrics:\n'));
  assert.ok(metrics.length > 1, 'job metrics');
  const head = metrics.slice(0, metrics.indexOf('\n    steps:'));
  assert.match(head, /^ {4}timeout-minutes: 30$/m);
  assert.match(metrics, /- uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n {8}with:\n(?: {10}[^\n]*\n)*? {10}fetch-depth: 0\n/);
  assert.equal([...wf.matchAll(/fetch-depth:/g)].length, 1, 'другой строки fetch-depth: в файле нет');
});

test('#728 fetchSnapshot: state=all, таймлайн до 10 страниц, jobs недоступны — null', () => {
  const calls = [];
  const full = Array.from({ length: 100 }, () => labeled('bug', 0));
  const gh = (args) => {
    const path = args[1];
    calls.push(path);
    if (path.startsWith('repos/o/r/issues?')) {
      return path.includes('page=1') ? [
        { number: 701, state: 'open', labels: [{ name: 'S8-merged' }] },
        { number: 702, state: 'closed', closed_at: T(30), state_reason: 'completed', labels: [] },
        { number: 703, state: 'open', labels: [{ name: 'S6-in-progress' }] },
        { number: 704, pull_request: {}, state: 'open', labels: [] },
      ] : [];
    }
    if (path.startsWith('repos/o/r/actions/runs?')) {
      return { workflow_runs: [
        jobsRun(1, { display_title: 'process #703 · S7-code-review · x' }),
        jobsRun(2, { name: 'Проверка (CI)', display_title: 'x', event: 'push' }),
      ] };
    }
    if (path === 'repos/o/r/actions/runs/1/jobs?per_page=100&page=1') return { jobs: [job('dev / Ревью: работа модели', 10, 10.5)] };
    if (path.startsWith('repos/o/r/actions/runs/2/jobs')) throw new Error('HTTP 410');
    if (path.startsWith('repos/o/r/issues/701/timeline')) return full;
    if (path.startsWith('repos/o/r/issues/')) return [labeled('S1-new', 0)];
    throw new Error(`unexpected ${path}`);
  };
  const git = (args) => {
    if (args[0] === 'ls-tree') return 'docs/reviews/SHIP-REVIEW-v1.79.0-beta.2.md\ndocs/reviews/CODE-REVIEW-701-r1.md\n';
    if (args[0] === 'grep') throw new Error('exit 1');
    if (args[0] === 'show') return 'ship doc';
    if (args[0] === 'rev-parse') return 'f'.repeat(40);
    if (args[0] === 'log') return `\x1e${'a'.repeat(40)}\x1f2026-09-30T00:00:00Z\x1fx\n\nIssue: #701\n\x1f\n3\t1\tsrc/a.ts\n`;
    throw new Error(`git ${args.join(' ')}`);
  };
  const snap = fetchSnapshot({ repo: 'o/r', since: T(0), until: T(48), gh, git });
  assert.ok(calls[0].includes('state=all') && calls[0].includes(`since=${encodeURIComponent('2026-08-31T00:00:00.000Z')}`), calls[0]);
  assert.deepEqual(snap.issues.map((i) => i.number), [702], 'прежняя выборка — закрытые в окне');
  assert.deepEqual(snap.allIssues.map((i) => i.number), [701, 702, 703], 'S8, закрытые и задачи прогонов конвейера');
  assert.equal(calls.filter((c) => c.startsWith('repos/o/r/issues/701/timeline')).length, TIMELINE_PAGE_CAP);
  assert.deepEqual([...snap.timelineTruncated], [701]);
  assert.equal(snap.jobsByRun.get(1).length, 1);
  assert.equal(snap.jobsByRun.get(2), null);
  assert.deepEqual(snap.reviewDocs, [{ path: 'docs/reviews/SHIP-REVIEW-v1.79.0-beta.2.md', text: 'ship doc' }]);
  assert.equal(issueChanges(snap.commits).get(701).lines, 4);
});

// ---------------------------------------------------------------------------
// #761: токены — только за окно отчёта, по коммиту, добавившему документ в dev.

test('#761 токены за окно: документ вне окна, перенос в архив в окне и hp:usage-none вне окна не считаются (AC1–AC3)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-761-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (args, env = {}) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  git(['init', '-q', '-b', 'dev']);
  git(['config', 'user.email', 't@t']); git(['config', 'user.name', 't']);
  git(['config', 'core.hooksPath', '/dev/null']);
  const usage = (input, output) => formatUsage({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, num_turns: 1 });
  const doc = (title, line) => withMaterialAnchors(`# ${title}\n\nВердикт: зелёный.\n`, { tree: 'a'.repeat(40), verdict: 'green', high: 0, usage: line });
  const commitAt = (iso, message, files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, dirname(path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    git(['add', '-A']);
    git(['commit', '-q', '-m', message], { GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso });
  };
  const since = '2026-09-24T00:00:00Z';
  const until = '2026-10-01T00:00:00Z';
  // Вне окна: документ с расходом и документ без данных (hp:usage-none).
  commitAt('2026-09-10T10:00:00Z', 'docs: review document for #700', {
    'docs/reviews/CODE-REVIEW-700-r1.md': doc('CODE-REVIEW-700-r1', usage(1000, 100)),
    'docs/reviews/SPEC-REVIEW-701-r1.md': doc('SPEC-REVIEW-701-r1', ''),
  });
  // Внутри окна: документ с расходом и документ без данных.
  commitAt('2026-09-26T10:00:00Z', 'docs: review document for #702', {
    'docs/reviews/CODE-REVIEW-702-r1.md': doc('CODE-REVIEW-702-r1', usage(20, 2)),
    'docs/reviews/SPEC-REVIEW-703-r1.md': doc('SPEC-REVIEW-703-r1', ''),
  });
  // Внутри окна: перенос документов вне окна в архив (#682) — переименование, не добавление.
  mkdirSync(join(dir, 'legacy/reviews/v1.0.0'), { recursive: true });
  git(['mv', 'docs/reviews/CODE-REVIEW-700-r1.md', 'legacy/reviews/v1.0.0/CODE-REVIEW-700-r1.md']);
  git(['mv', 'docs/reviews/SPEC-REVIEW-701-r1.md', 'legacy/reviews/v1.0.0/SPEC-REVIEW-701-r1.md']);
  commitAt('2026-09-28T10:00:00Z', 'chore(legacy): archive the v1.0.0 review documents', {});
  // После окна: документ с расходом (отчёт за прошлую неделю его не видит).
  commitAt('2026-10-02T10:00:00Z', 'docs: review document for #704', { 'docs/reviews/CODE-REVIEW-704-r1.md': doc('CODE-REVIEW-704-r1', usage(5, 5)) });

  const added = reviewDocAddedAt(git(['log', '-M', '--diff-filter=AR', '--reverse', '--name-status', '--format=%x1e%cI', 'HEAD', '--', 'docs/reviews', 'legacy/reviews']));
  assert.equal(Date.parse(added.get('legacy/reviews/v1.0.0/CODE-REVIEW-700-r1.md')), Date.parse('2026-09-10T10:00:00Z'), 'перенос в архив сохраняет дату добавления');
  assert.equal(added.has('docs/reviews/CODE-REVIEW-700-r1.md'), false, 'прежнего пути в HEAD нет');

  const gh = (args) => (String(args[1]).includes('/actions/runs?') ? { workflow_runs: [] } : []);
  const snap = fetchSnapshot({ repo: 'o/r', since, until, gh, git: (args) => git(args) });
  assert.equal(snap.reviewDocs.length, 5, 'тексты читаются из HEAD, как раньше');
  const report = buildReport({ since, until, ...snap });
  assert.equal(report.tokens.docs, 1, 'AC1: только документ, добавленный в окне');
  assert.deepEqual([report.tokens.totals.input_tokens, report.tokens.totals.output_tokens], [20, 2]);
  assert.equal(report.tokens.missing, 1, 'AC3: hp:usage-none — по тому же окну');
  const md = renderMarkdown(report);
  const section = md.slice(md.indexOf('### Токены'), md.indexOf('###', md.indexOf('### Токены') + 3));
  assert.match(section, /^Документы ревью, добавленные в `dev` за окно отчёта/m);
  assert.match(section, /^Токены по 1 документам ревью: input_tokens 20 · output_tokens 2 /m);
  assert.match(section, /^Без данных о расходе: 1\.$/m);

  // Неделя, в которую документ #700 был добавлен, его видит — в архиве он или нет.
  const early = buildReport({ since: '2026-09-07T00:00:00Z', until: '2026-09-14T00:00:00Z', ...snap });
  assert.deepEqual([early.tokens.docs, early.tokens.totals.input_tokens, early.tokens.missing], [1, 1000, 1]);
  // Без карты дат (юнит над готовыми документами) окна нет — как до #761.
  assert.equal(tokenDocs(snap.reviewDocs).length, 5);
  assert.equal(tokenDocs(snap.reviewDocs, { added: new Map(), since, until }).length, 0, 'добавление не найдено — вне окна');
});
