// #634: цена входа агента измерима и ограничена (AC1: автор ≤ 12 000 слов).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ROUTES, countWords, measureAll, measureRoute } from '../scripts/entry-cost.mjs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('#634 entry-cost: вход автора и ревьюера в бюджете (AC1)', () => {
  const results = measureAll();
  assert.equal(ROUTES.author.budget, 12000, 'бюджет автора — AC1 #634');
  for (const [name, result] of Object.entries(results)) {
    if (result.budget == null) continue;
    assert.equal(result.over, false, `${name}: ${result.total} слов > бюджета ${result.budget}`);
    assert.ok(result.total <= result.budget);
  }
  // Маршрут автора не содержит полного канона — иначе бюджет держится случайно.
  assert.ok(!ROUTES.author.files.includes('PROCESS.md'));
  assert.ok(ROUTES.author.files.includes('docs/process/AUTHOR.md'));
  assert.ok(ROUTES.reviewer.files.includes('docs/process/REVIEWER.md'));
});

test('#634 entry-cost: превышение бюджета краснит замер', () => {
  const files = { 'a.md': 'one two three', 'b.md': 'четыре  пять\nшесть\t семь' };
  const reader = (rel) => files[rel];
  assert.equal(countWords(files['b.md']), 4);
  const within = measureRoute({ budget: 7, files: ['a.md', 'b.md'] }, reader);
  assert.deepEqual([within.total, within.over], [7, false]);
  const over = measureRoute({ budget: 6, files: ['a.md', 'b.md'] }, reader);
  assert.deepEqual([over.total, over.over], [7, true]);
  assert.equal(measureRoute({ budget: null, files: ['a.md'] }, reader).over, false);
});

test('#634 entry-cost: AGENTS.md называет те же маршруты в том же порядке', () => {
  const agents = read('AGENTS.md');
  const section = agents.slice(agents.indexOf('**Reading order by role**'), agents.indexOf('The two digests'));
  assert.ok(section.length > 0, 'раздел порядка чтения в AGENTS.md');
  const route = (prefix) => {
    const item = section.split('\n- ').find((chunk) => chunk.startsWith(prefix));
    assert.ok(item, `AGENTS.md: нет пункта «${prefix}»`);
    return [...item.matchAll(/`([^`]+\.md)`/g)].map((match) => match[1]);
  };
  assert.deepEqual(route('author'), ROUTES.author.files);
  assert.deepEqual(route('reviewer'), ROUTES.reviewer.files);
  assert.deepEqual(route('changing the pipeline'), ROUTES.canon.files);
});
