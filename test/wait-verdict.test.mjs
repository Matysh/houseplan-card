import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, reviewRequestFromEvents, stateOf, waitForVerdict } from '../scripts/wait-verdict.mjs';

// #496: ожидание детерминировано — одинаковое состояние молчит, смена метки и
// события конвейера доставляются один раз, ничего не пишется.

const snap = (labels, comments = [], validate) => ({ labels, comments, validate });

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
  const conflict = { id: 'c1', createdAt: '1', body: '**Ревью не запускалось:** ветка `issue/1-x` не ребейзится…' };
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
