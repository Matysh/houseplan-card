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

// #496: browser-consumers отделены от подготовки артефактов и идут после неё.
import { runLimited, smokesToRun } from '../scripts/gate-small.mjs';

test('smokesToRun берёт прямые и зарегистрированные смоки, не «широкие»; без диффа — пусто (#496)', () => {
  assert.deepEqual(smokesToRun({ noExecutableDiff: true, direct: [{ smoke: 'smoke_x.mjs' }] }), []);
  assert.deepEqual(smokesToRun({
    direct: [{ smoke: 'smoke_b.mjs', strong: true }, { smoke: 'smoke_a.mjs', strong: false }],
    registered: [{ smoke: 'smoke_b.mjs' }, { smoke: 'smoke_c.mjs' }],
    broad: [{ smoke: 'smoke_everything.mjs' }],
  }), ['smoke_a.mjs', 'smoke_b.mjs', 'smoke_c.mjs']);
  assert.deepEqual(smokesToRun(null), []);
  assert.deepEqual(parseArgs(['--smokes', '--jobs=3']), { base: 'origin/dev', smokes: true, jobs: 3 });
  assert.deepEqual(parseArgs(['--jobs=abc']).jobs, 2);
});

test('runLimited держит не больше N одновременных consumers и сохраняет порядок (#496)', async () => {
  let active = 0; let peak = 0;
  const out = await runLimited([1, 2, 3, 4, 5], 2, async (n) => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--; return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50]);
  assert.equal(peak, 2);
});

test('gate-small: смоки идут только после bundle-sync и только с --smokes (#496)', () => {
  const source = readFileSync(new URL('../scripts/gate-small.mjs', import.meta.url), 'utf8');
  const smokesAt = source.indexOf("args: [`demo/${smoke}`]");
  const syncAt = source.indexOf("args: ['scripts/bundle-sync.mjs']");
  assert.ok(syncAt > 0 && smokesAt > syncAt, 'bundle-sync предшествует запуску смоков');
  assert.match(source, /if \(smokes && buildOk\)/);
});
