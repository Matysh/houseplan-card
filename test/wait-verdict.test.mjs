import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, stateOf, waitForVerdict } from '../scripts/wait-verdict.mjs';

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
