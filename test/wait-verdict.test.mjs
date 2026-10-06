import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PIPELINE_EVENTS, decide, reviewRequestFromEvents, stateOf, waitForVerdict } from '../scripts/wait-verdict.mjs';
import { NOT_RUN_CONFLICT_RE, NOT_RUN_VALIDATE_RE, returnSignal } from '../scripts/process-metrics.mjs';
import { reviewRoute, routeComment } from '../scripts/process-track.mjs';
import { OUTCOME_SIGNS, PUSH_REFUSAL, commentFor, describePushRefusal } from '../scripts/merge-candidate.mjs';
import { findStep, runStep, workflowSteps } from './helpers/workflow-step.mjs';

// #496: ожидание детерминировано — одинаковое состояние молчит, смена метки и
// события конвейера доставляются один раз, ничего не пишется.

const snap = (labels, comments = [], validate) => ({ labels, comments, validate });

const WORKFLOW = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
/** #810: шаги `_process.yml`, которые пишут «**Ревью не запускалось:**». */
const NOT_RUN_STEPS = Object.freeze({
  conflict: 'Конфликт с dev — вернуть автору без ревью',
  validate: 'Validate красный — вернуть автору без ревью',
});

/**
 * #810: комментарий шага `name` — тело шага исполняется как у раннера
 * (`runStep`), а не копируется строкой. `gh` подменён и сохраняет
 * `--body-file` комментария; `git rev-parse --short` отвечает началом SHA.
 * Выражения `${{ … }}` раннер подставляет до запуска — здесь тоже; файлы
 * `/tmp/*.md` шага уходят во временный каталог теста.
 */
function notRunComment(name, env) {
  const root = mkdtempSync(join(tmpdir(), 'hp-wait-verdict-'));
  try {
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'gh'), [
      '#!/usr/bin/env bash',
      'if [ "$1 $2" = "issue comment" ]; then',
      '  while [ $# -gt 0 ]; do if [ "$1" = --body-file ]; then cp "$2" "$CAPTURE"; fi; shift; done',
      'fi',
      '',
    ].join('\n'), { mode: 0o755 });
    writeFileSync(join(bin, 'git'), [
      '#!/usr/bin/env bash',
      'if [ "$1 $2" = "rev-parse --short" ]; then echo "${3:0:7}"; exit 0; fi',
      'echo "git $*: шаг не должен звать" >&2; exit 1',
      '',
    ].join('\n'), { mode: 0o755 });
    const step = findStep(WORKFLOW, { name }, '_process.yml');
    const script = step.run
      .replace(/\$\{\{\s*github\.server_url\s*\}\}/g, 'https://github.com')
      .replace(/\$\{\{\s*github\.repository\s*\}\}/g, 'o/r')
      .replace(/\$\{\{\s*github\.run_id\s*\}\}/g, '1')
      .replaceAll('/tmp/', `${root}/`);
    assert.ok(!script.includes('${{'), `${name}: выражение раннера осталось без подстановки`);
    const capture = join(root, 'comment.md');
    const r = runStep(step, script, { env: { PATH: `${bin}:${process.env.PATH}`, CAPTURE: capture, NUM: '7', ...env } });
    assert.equal(r.status, 0, `${name}: ${r.stderr}`);
    return readFileSync(capture, 'utf8');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

let notRunCache = null;
/** Конфликт ребейза и оба вида Validate-шага: с мутантами (красный) и лёгкий (не найден). */
function notRunBodies() {
  notRunCache ??= {
    conflict: notRunComment(NOT_RUN_STEPS.conflict, { BRANCH: 'issue/7-x', CONFLICTS: 'scripts/a.mjs' }),
    validate: [
      notRunComment(NOT_RUN_STEPS.validate, {
        BRANCH: 'issue/7-x', SHA: 'a'.repeat(40), MUTANTS: 'true', RESULT: 'failed', NOTE: 'прогон завершился с failure', URL: 'https://github.com/o/r/actions/runs/2',
      }),
      notRunComment(NOT_RUN_STEPS.validate, {
        BRANCH: 'issue/7-x', SHA: 'b'.repeat(40), MUTANTS: 'false', RESULT: 'missing', NOTE: 'прогона на материале нет', URL: '',
      }),
    ],
  };
  return notRunCache;
}

test('одинаковое состояние не порождает ни строки; смена метки — завершение с 0 (#496)', async () => {
  const states = [snap(['S7-code-review', 'P2']), snap(['S7-code-review', 'P2']), snap(['S7-code-review', 'P2']), snap(['S8-merged', 'P2'])];
  let i = 0; const lines = []; let slept = 0;
  const code = await waitForVerdict({
    readSnapshot: async () => states[Math.min(i++, states.length - 1)],
    intervalMs: 5, maxTicks: 10, sleep: async () => { slept++; }, log: (l) => lines.push(l),
  });
  assert.equal(code, 0);
  assert.equal(lines.length, 2, 'точка отсчёта и смена метки — и ничего между');
  assert.match(lines[0], /ожидание: статус S7-code-review/);
  assert.match(lines[1], /метка: S7-code-review → S8-merged/);
  assert.equal(slept, 3);
});

test('событие конвейера доставляется один раз и требует действия (код 3) (#496)', async () => {
  const conflict = { id: 'c1', createdAt: '1', body: notRunBodies().conflict };
  const states = [snap(['S7-code-review']), snap(['S6-in-progress'], [conflict])];
  let i = 0; const lines = [];
  const code = await waitForVerdict({ readSnapshot: async () => states[Math.min(i++, 1)], intervalMs: 1, maxTicks: 5, sleep: async () => {}, log: (l) => lines.push(l) });
  // Смена метки и событие пришли одним тиком: метка даёт 0, событие названо в строках.
  assert.equal(code, 0);
  assert.ok(lines.some((l) => l.includes('не ребейзится на dev')));
  // Событие без смены метки — код 3.
  const failure = { id: 'f1', createdAt: '2', body: 'Автоматическое ревью не отработало: [прогон](u).' };
  const d = decide(stateOf(snap(['S7-code-review'])), stateOf(snap(['S7-code-review'], [failure])));
  assert.equal(d.done, true); assert.equal(d.code, 3); assert.match(d.lines[0], /прогон ревью упал/);
  // Повтор того же события молчит.
  const same = decide(stateOf(snap(['S7-code-review'], [failure])), stateOf(snap(['S7-code-review'], [failure])));
  assert.equal(same.done, false); assert.deepEqual(same.lines, []);
});

test('blocked, review-4 и красный Validate доставляются; неревьюшный статус — ждать нечего (#496)', async () => {
  assert.equal(decide(stateOf(snap(['S7-code-review'])), stateOf(snap(['S7-code-review', 'blocked']))).code, 3);
  assert.equal(decide(stateOf(snap(['S7-code-review'])), stateOf(snap(['S7-code-review', 'review-4']))).code, 3);
  const red = decide(stateOf(snap(['S7-code-review'])), stateOf(snap(['S7-code-review'], [], { status: 'completed', conclusion: 'failure', url: 'u' })));
  assert.equal(red.code, 3); assert.match(red.lines[0], /Validate на SHA красный: failure/);
  const green = decide(stateOf(snap(['S7-code-review'])), stateOf(snap(['S7-code-review'], [], { status: 'completed', conclusion: 'success' })));
  assert.equal(green.done, false); assert.match(green.lines[0], /зелёный/);
  const first = decide(null, stateOf(snap(['S6-in-progress'])));
  assert.equal(first.code, 0); assert.match(first.lines[1], /ждать нечего/);
});

test('лимит ожидания — код 4 и одна строка (#496)', async () => {
  const lines = [];
  const code = await waitForVerdict({ readSnapshot: async () => snap(['S4-spec-review']), intervalMs: 1, maxTicks: 3, sleep: async () => {}, log: (l) => lines.push(l) });
  assert.equal(code, 4);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /лимит ожидания \(3 × 0 с\)/);
});

test('старый failure до нового запроса ревью — baseline, ожидание продолжается (#546)', async () => {
  const oldFailure = {
    id: 'old', createdAt: '2026-09-08T10:00:00Z',
    body: 'Автоматическое ревью не отработало: [прогон](old).',
  };
  const currentRequest = { id: 'request-2', at: '2026-09-12T10:00:00Z', label: 'S7-code-review' };
  const snapshot = { ...snap(['S7-code-review'], [oldFailure]), reviewRequest: currentRequest };
  const lines = []; let slept = 0;
  const code = await waitForVerdict({
    readSnapshot: async () => snapshot,
    intervalMs: 1, maxTicks: 2, sleep: async () => { slept++; }, log: (line) => lines.push(line),
  });
  assert.equal(code, 4);
  assert.equal(slept, 1);
  assert.equal(lines.some((line) => line.includes('прогон ревью упал')), false);
});

test('failure текущего раунда, опубликованный до запуска waiter, виден на первом poll (#546)', async () => {
  const currentFailure = {
    id: 'current', createdAt: '2026-09-12T10:05:00Z',
    body: 'Автоматическое ревью не отработало: [прогон](current).',
  };
  const snapshot = {
    ...snap(['S7-code-review'], [currentFailure]),
    reviewRequest: { id: 'request-2', at: '2026-09-12T10:00:00Z', label: 'S7-code-review' },
  };
  const lines = []; let slept = 0;
  const code = await waitForVerdict({
    readSnapshot: async () => snapshot,
    intervalMs: 1, maxTicks: 2, sleep: async () => { slept++; }, log: (line) => lines.push(line),
  });
  assert.equal(code, 3);
  assert.equal(slept, 0);
  assert.ok(lines.some((line) => line.includes('прогон ревью упал')));
});

test('якорь раунда — последнее применение любой review-метки (#546)', () => {
  const request = reviewRequestFromEvents([
    { id: 1, event: 'labeled', created_at: '2026-09-10T09:00:00Z', label: { name: 'S4-spec-review' } },
    { id: 2, event: 'labeled', created_at: '2026-09-10T10:00:00Z', label: { name: 'P1' } },
    { id: 3, event: 'unlabeled', created_at: '2026-09-10T11:00:00Z', label: { name: 'S4-spec-review' } },
    { id: 4, event: 'labeled', created_at: '2026-09-12T09:00:00Z', label: { name: 'S7-code-review' } },
  ]);
  assert.deepEqual(request, { id: '4', at: '2026-09-12T09:00:00Z', label: 'S7-code-review' });
});

test('новые outcome и owner blocker текущего раунда не скрываются baseline-фильтром (#546)', () => {
  const request = { id: 'request', at: '2026-09-12T10:00:00Z', label: 'S7-code-review' };
  const stale = {
    id: 'stale', createdAt: '2026-09-12T10:05:00Z',
    body: '**Слияние отменено: ветка изменилась после проверенного материала (#312).**',
  };
  const event = decide(null, stateOf({ ...snap(['S7-code-review'], [stale]), reviewRequest: request }));
  assert.equal(event.code, 3);
  assert.ok(event.lines.some((line) => line.includes('слияние отменено')));

  const blocker = decide(null, stateOf({ ...snap(['S7-code-review', 'blocked']), reviewRequest: request }));
  assert.equal(blocker.code, 3);
  assert.ok(blocker.lines.some((line) => line.includes('blocked')));

  const verdict = decide(
    stateOf({ ...snap(['S7-code-review']), reviewRequest: request }),
    stateOf({ ...snap(['S8-merged']), reviewRequest: request }),
  );
  assert.equal(verdict.code, 0);
  assert.ok(verdict.lines.some((line) => line.includes('S7-code-review → S8-merged')));
});

// #726: тексты — те, что пишет шаг решения по вердикту, а не их копии.
const SHOW = { stage: 'code', track: 'show', limit: 2, verdict: 'yellow', high: 0 };
const routeBody = (over, cycle = '1') => routeComment({ decision: reviewRoute({ ...SHOW, ...over }), num: '7', cycle, branch: 'issue/7-x', spent: over.spent ?? 0 });

test('#726 AC7: reclassify доставляется автору видом reclassify — про ТЗ и S5', () => {
  const body = routeBody({ spent: 0, route: 'reclassify', criterion: 'undocumented' });
  const comment = { id: 'r', createdAt: '2026-10-01T10:05:00Z', body };
  const state = stateOf(snap(['S3-spec', 'track:ask'], [comment]));
  assert.equal(state.lastEvent.kind, 'reclassify');
  assert.equal(state.lastEvent.text, 'конвейер: трек повышен до ask: полное ТЗ в теле issue, всю ветку (включая тесты и документы) не пушить до S5');
  // Метка сменилась тем же прогоном — вердикт (0) и текст маршрута в строках.
  const moved = decide(stateOf(snap(['S7-code-review', 'track:show'])), state);
  assert.equal(moved.code, 0);
  assert.ok(moved.lines.some((line) => line.includes('полное ТЗ в теле issue')));
  // Комментарий раньше метки — событие доставлено само (3).
  const early = decide(stateOf(snap(['S7-code-review'])), stateOf(snap(['S7-code-review'], [comment])));
  assert.equal(early.code, 3);
});

test('#726 AC7: вопрос владельцу с blocked доставлен, опрос остановлен; исчерпание — прежний код 3', async () => {
  const question = { id: 'q', createdAt: '2', body: routeBody({ spent: 0, route: 'reclassify', criterion: 'surfaces', confirmed: true }) };
  assert.equal(stateOf(snap(['S6-in-progress'], [question])).lastEvent.kind, 'owner-question');
  const states = [snap(['S7-code-review']), snap(['S6-in-progress', 'blocked'], [question]), snap(['S6-in-progress', 'blocked'], [question])];
  let i = 0; const lines = []; let slept = 0;
  const code = await waitForVerdict({
    readSnapshot: async () => states[Math.min(i++, states.length - 1)], intervalMs: 1, maxTicks: 10,
    sleep: async () => { slept++; }, log: (line) => lines.push(line),
  });
  assert.equal(code, 3);
  assert.equal(slept, 1, 'опрос остановлен на первом же изменении');
  assert.ok(lines.some((line) => line.includes('ждёт владельца')));
  assert.ok(lines.some((line) => line.includes('blocked: задача ждёт владельца')));
  // Вердикт, исчерпавший бюджет: review-4 и прежний префикс — код 3, вид exhausted.
  const exhausted = { id: 'e', createdAt: '3', body: routeBody({ spent: 1 }, '2') };
  const next = stateOf(snap(['S6-in-progress', 'review-4'], [exhausted]));
  assert.equal(next.lastEvent.kind, 'exhausted');
  const d = decide(stateOf(snap(['S7-code-review'])), next);
  assert.equal(d.code, 3);
  assert.ok(d.lines.some((line) => line.includes('лимит циклов исчерпан')));
  // Исчерпание вместе с вопросом владельцу — одним комментарием; решает владелец, вид exhausted.
  const both = { id: 'b', createdAt: '4', body: routeBody({ spent: 1, route: 'reclassify', criterion: 'surfaces', confirmed: true }, '2') };
  assert.equal(stateOf(snap(['S6-in-progress', 'review-4', 'blocked'], [both])).lastEvent.kind, 'exhausted');
});

// #768: исходы слияния кандидата — тела, которые пишет сам merge-candidate.mjs
// (commentFor / describePushRefusal), а не копии строк. Терминальный отказ —
// код 3 уже при неизменной S7; rereview — строка без завершения; слито —
// не событие, его сообщает метка S8.
const MERGE_CTX = {
  material: 'a'.repeat(40), actual: 'b'.repeat(40), candidate: 'c'.repeat(40), devNow: 'd'.repeat(40),
  branch: 'issue/7-x', ref: 'dev', runUrl: 'https://github.com/o/r/actions/runs/1', attempt: 3, error: 'git push dev: boom',
  refusal: { kind: PUSH_REFUSAL.workflow, reason: 'r', files: ['.github/workflows/x.yml'], stderr: 'e' }, pipelineUrl: 'https://run/1',
};
const REQUEST = { id: 'request-2', at: '2026-10-01T10:00:00Z', label: 'S7-code-review' };
const rejectedPush = (reason) => `To https://github.com/o/r\n ! [remote rejected] 0123abcd -> issue/7-x (${reason})\nerror: failed to push some refs to 'https://github.com/o/r'`;
const rebaseRefusal = (reason) => describePushRefusal(rejectedPush(reason), { ref: 'issue/7-x', branch: 'issue/7-x', candidate: 'c'.repeat(40), stage: 'rebase', pipelineUrl: 'https://run/1' }).comment;
// [название, тело, ожидаемый kind (null — не событие), код при неизменной S7 (null — ждать дальше), фрагмент строки]
const OUTCOME_TABLE = [
  ['reject-stale', commentFor('reject-stale', MERGE_CTX), 'stale', 3, 'слияние отменено'],
  ['conflict', commentFor('conflict', MERGE_CTX), 'merge-conflict', 3, 'слияние конфликтует'],
  ['validation-red', commentFor('validation-red', MERGE_CTX), 'validation-red', 3, 'кандидат после ребейза на dev красный'],
  ['validation-missing', commentFor('validation-missing', MERGE_CTX), 'validation-missing', 3, 'Validate на кандидате не дождались'],
  ['give-up', commentFor('give-up', MERGE_CTX), 'give-up', 3, 'dev движется быстрее слияния'],
  ['push-refused-workflow/merge', commentFor('push-refused-workflow', { ...MERGE_CTX, stage: 'merge' }), 'push-refused-workflow', 3, 'GitHub не принял push кандидата'],
  ['push-refused-workflow/rebase', rebaseRefusal('refusing to allow an OAuth App to create or update workflow `.github/workflows/validate.yml` without `workflow` scope'), 'push-refused-workflow', 3, 'ревью не запускалось — GitHub не принял push ребейза'],
  ['push-refused/merge', commentFor('push-refused', { ...MERGE_CTX, stage: 'merge', refusal: { kind: PUSH_REFUSAL.remote, reason: 'protected branch hook declined', stderr: 'e' } }), 'push-refused', 3, 'GitHub отклонил push в dev'],
  ['push-refused/rebase', rebaseRefusal('protected branch hook declined'), 'push-refused', 3, 'GitHub отклонил push ребейза'],
  ['error', commentFor('error', { error: 'boom' }), 'merge-error', 3, 'шаг слияния упал'],
  ['rereview', commentFor('rereview', MERGE_CTX), 'rereview', null, 'новый заход ревью запускается сам'],
  ['push', commentFor('push', MERGE_CTX), null, null, null],
  ['fast-forward', commentFor('fast-forward', MERGE_CTX), null, null, null],
];

test('#768 исходы слияния: таблица тел commentFor → событие и код при неизменной S7', () => {
  for (const [name, body, kind, code, fragment] of OUTCOME_TABLE) {
    assert.ok(body, `${name}: тело не пусто`);
    const comment = { id: name, createdAt: '2026-10-01T10:05:00Z', body };
    const state = stateOf({ ...snap(['S7-code-review'], [comment]), reviewRequest: REQUEST });
    assert.equal(state.lastEvent?.kind ?? null, kind, `${name}: вид события`);
    const d = decide(stateOf({ ...snap(['S7-code-review']), reviewRequest: REQUEST }), state);
    assert.equal(d.code, code, `${name}: код`);
    assert.equal(d.done, code !== null, `${name}: завершение`);
    if (fragment) assert.ok(d.lines.some((line) => line.includes(fragment)), `${name}: строка «${fragment}» — ${d.lines.join(' | ')}`);
    else assert.deepEqual(d.lines, [], `${name}: слито — не событие, ждём метку S8`);
  }
  // Каталог merge-candidate.mjs целиком покрыт: новый исход без своей строки здесь краснеет.
  const covered = new Set(OUTCOME_TABLE.filter(([, , kind]) => kind).map(([name]) => name));
  for (const sign of OUTCOME_SIGNS) {
    assert.ok(covered.has(`${sign.action}/${sign.stage}`) || covered.has(sign.action), `${sign.action}/${sign.stage} — нет строки в таблице`);
  }
});

test('#768 исход текущего раунда, опубликованный до запуска waiter, — код 3 на первом опросе', async () => {
  const red = { id: 'red', createdAt: '2026-10-01T10:05:00Z', body: commentFor('validation-red', MERGE_CTX) };
  const lines = []; let slept = 0;
  const code = await waitForVerdict({
    readSnapshot: async () => ({ ...snap(['S7-code-review'], [red]), reviewRequest: REQUEST }),
    intervalMs: 1, maxTicks: 3, sleep: async () => { slept++; }, log: (line) => lines.push(line),
  });
  assert.equal(code, 3);
  assert.equal(slept, 0, 'ожидания нет: исход уже есть');
  assert.ok(lines.some((line) => line.includes('кандидат после ребейза на dev красный')));
  // Waiter, запущенный уже после возврата в S6, причину тоже называет, а не «ждать нечего».
  const late = decide(null, stateOf({ ...snap(['S6-in-progress'], [red]), reviewRequest: REQUEST }));
  assert.equal(late.code, 3);
  assert.ok(late.lines.some((line) => line.includes('кандидат после ребейза на dev красный')));
  assert.ok(!late.lines.some((line) => line.includes('ждать нечего')));
});

test('#768 исход прежнего раунда — baseline; тот же исход текущего раунда доставляется', async () => {
  const old = { id: 'old', createdAt: '2026-09-30T10:00:00Z', body: commentFor('give-up', MERGE_CTX) };
  const fresh = { id: 'fresh', createdAt: '2026-10-01T10:30:00Z', body: commentFor('give-up', MERGE_CTX) };
  const states = [
    { ...snap(['S7-code-review'], [old]), reviewRequest: REQUEST },
    { ...snap(['S7-code-review'], [old]), reviewRequest: REQUEST },
    { ...snap(['S7-code-review'], [old, fresh]), reviewRequest: REQUEST },
  ];
  let i = 0; const lines = []; let slept = 0;
  const code = await waitForVerdict({
    readSnapshot: async () => states[Math.min(i++, states.length - 1)],
    intervalMs: 1, maxTicks: 5, sleep: async () => { slept++; }, log: (line) => lines.push(line),
  });
  assert.equal(code, 3);
  assert.equal(slept, 2, 'старый исход не будит: ждём, пока не придёт исход текущего раунда');
  assert.equal(lines.filter((line) => line.includes('dev движется быстрее слияния')).length, 1);
  // rereview снова ставит S7: его комментарий оказывается до нового якоря и не повторяется.
  const rereview = { id: 'rr', createdAt: '2026-10-01T10:05:00Z', body: commentFor('rereview', MERGE_CTX) };
  const relabeled = stateOf({ ...snap(['S7-code-review'], [rereview]), reviewRequest: { ...REQUEST, id: 'request-3', at: '2026-10-01T10:06:00Z' } });
  assert.equal(relabeled.lastEvent, null);
});

test('#768 сменившаяся метка: S6 — код 0 и причина в строках; S8 со «слито» — код 0 без отказа', () => {
  const before = stateOf({ ...snap(['S7-code-review']), reviewRequest: REQUEST });
  for (const [name, body, kind, code, fragment] of OUTCOME_TABLE) {
    if (code === null) continue;
    const comment = { id: name, createdAt: '2026-10-01T10:05:00Z', body };
    const d = decide(before, stateOf({ ...snap(['S6-in-progress'], [comment]), reviewRequest: REQUEST }));
    assert.equal(d.code, 0, `${name}: смена метки сохраняет код 0`);
    assert.ok(d.lines.some((line) => line.includes('S7-code-review → S6-in-progress')), name);
    assert.ok(d.lines.some((line) => line.includes(fragment)), `${name}: причина не потеряна (${kind})`);
  }
  const merged = { id: 'm', createdAt: '2026-10-01T10:05:00Z', body: commentFor('push', MERGE_CTX) };
  const done = decide(before, stateOf({ ...snap(['S8-merged'], [merged]), reviewRequest: REQUEST }));
  assert.equal(done.code, 0);
  assert.deepEqual(done.lines.map((line) => line.replace(/^\[[^\]]*\] /, '')), ['метка: S7-code-review → S8-merged']);
});

// #810: «Ревью не запускалось:» пишут два шага _process.yml — конфликт ребейза
// и красный/не найденный Validate на материале. Это разные события: второе —
// не git-конфликт, автор разбирает прогон, а не ребейзит.
const NOT_RUN_VALIDATE_LINE = 'конвейер: Validate на материале красный/не найден — разобрать прогон, править код не обязательно';

test('#810 «Ревью не запускалось»: Validate на материале — своё событие, конфликт ребейза — своё (тела из шагов _process.yml)', () => {
  // Писателей «Ревью не запускалось:» ровно два: третий шаг без своего события краснеет здесь.
  const writers = workflowSteps(WORKFLOW, '_process.yml').filter((step) => step.run?.includes('**Ревью не запускалось:**')).map((step) => step.name);
  assert.deepEqual(writers.sort(), Object.values(NOT_RUN_STEPS).sort());
  const { conflict, validate } = notRunBodies();
  assert.ok(validate[0].includes('Validate с мутантами на материале') && validate[0].includes('**failed**'), 'шаг с мутантами, прогон красный');
  assert.ok(!validate[1].includes('с мутантами') && validate[1].includes('**missing**'), 'лёгкий шаг, прогон не найден');
  const before = stateOf({ ...snap(['S7-code-review']), reviewRequest: REQUEST });
  const after = (labels, body) => stateOf({ ...snap(labels, [{ id: 'n', createdAt: '2026-10-01T10:05:00Z', body }]), reviewRequest: REQUEST });
  for (const [index, body] of validate.entries()) {
    const state = after(['S7-code-review'], body);
    assert.equal(state.lastEvent?.kind, 'validate-red', `Validate #${index}: вид события`);
    const held = decide(before, state);
    assert.equal(held.code, 3, `Validate #${index}: действие автора — код 3`);
    assert.deepEqual(held.lines, [NOT_RUN_VALIDATE_LINE], `Validate #${index}: не «конфликт разрешает автор»`);
    // Шаг сразу переводит метку в S6: код 0 смены метки, причина в строках та же.
    const moved = decide(before, after(['S6-in-progress'], body));
    assert.equal(moved.code, 0);
    assert.deepEqual(moved.lines, ['метка: S7-code-review → S6-in-progress', NOT_RUN_VALIDATE_LINE]);
  }
  const state = after(['S7-code-review'], conflict);
  assert.equal(state.lastEvent?.kind, 'conflict');
  const held = decide(before, state);
  assert.equal(held.code, 3);
  assert.deepEqual(held.lines, ['конвейер: ветка не ребейзится на dev — конфликт разрешает автор']);
});

test('#810 один источник с process-metrics: те же признаки PIPELINE_EVENTS, та же причина', () => {
  const byKind = (kind) => PIPELINE_EVENTS.find((event) => event.kind === kind)?.re;
  assert.equal(NOT_RUN_VALIDATE_RE, byKind('validate-red'), 'NOT_RUN_VALIDATE_RE — признак PIPELINE_EVENTS, не копия');
  assert.equal(NOT_RUN_CONFLICT_RE, byKind('conflict'), 'NOT_RUN_CONFLICT_RE — признак PIPELINE_EVENTS, не копия');
  const { conflict, validate } = notRunBodies();
  for (const body of [conflict, ...validate]) {
    const kind = stateOf(snap(['S7-code-review'], [{ id: 'n', createdAt: '1', body }])).lastEvent?.kind;
    assert.equal(kind, returnSignal(body, { stage: 'code', number: 7 }), `ожидание и метрики называют одну причину: ${body.split('\n')[0]}`);
  }
});

test('#810 «Ревью не запускалось» с неизвестным продолжением — не конфликт: читать комментарий, код 3', () => {
  const body = '**Ревью не запускалось:** причина, которой в шаблонах ещё нет.';
  const state = stateOf(snap(['S7-code-review'], [{ id: 'x', createdAt: '1', body }]));
  assert.equal(state.lastEvent?.kind, 'not-run');
  const d = decide(stateOf(snap(['S7-code-review'])), state);
  assert.equal(d.code, 3);
  assert.deepEqual(d.lines, ['конвейер: ревью не запускалось, причина не распознана — читать комментарий']);
  assert.equal(returnSignal(body, { stage: 'code', number: 7 }), 'unknown', 'метрики: семейство узнано, причина — unknown');
});
