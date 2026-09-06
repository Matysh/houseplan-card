import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArgs, parallelSteps, serialSteps, summarize } from '../scripts/gate-small.mjs';

// #479 AC6: одна команда вместо списка §8 — состав обязательной части закреплён,
// информационный шаг (smoke-select) не считается падением, сверка бандла идёт
// после сборки.

test('gate:small гоняет обязательную часть PROCESS §8 и сверяет бандл (#479)', () => {
  const names = parallelSteps('origin/dev').map((s) => `${s.cmd} ${s.args.join(' ')}`);
  assert.ok(names.some((n) => n.endsWith('npm test') || n.endsWith('npm.cmd test')));
  assert.ok(names.some((n) => n.includes('run build')));
  assert.ok(names.some((n) => n.includes('scripts/no-new-any.mjs --base origin/dev --head HEAD')));
  assert.ok(names.some((n) => n.includes('scripts/smoke-select.mjs --base origin/dev --head HEAD')));
  const serial = serialSteps().map((s) => s.args.join(' '));
  assert.ok(serial.some((s) => s.includes('bundle-tree.mjs dist custom_components/houseplan/frontend')));
  assert.ok(serial.some((s) => s.includes('bundle:budget')));
  assert.equal(parseArgs(['--base=abc']).base, 'abc');
  assert.equal(parseArgs([]).base, 'origin/dev');
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts['gate:small'],
    'node scripts/gate-small.mjs');
});

test('сводка: информационный шаг не падение, упавший шаг с подсказкой (#479)', () => {
  const { lines, failed } = summarize([
    { name: 'a', code: 0, ms: 1000 },
    { name: 'select', code: 1, ms: 10, informational: true },
    { name: 'bundle', code: 1, ms: 10, hint: 'npm run bundle:sync' },
  ]);
  assert.equal(failed, 1);
  assert.match(lines[0], /^ok /);
  assert.match(lines[1], /^info/);
  assert.match(lines[2], /^FAIL.*→ npm run bundle:sync/);
});
