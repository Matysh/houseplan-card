// #699, PROCESS.md §8: полоса над потолком беты вместо точки; потолки
// опускает до факта релиз-менеджер одной командой на кандидате.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_CEILINGS, CORE_BAND, CORE_BUDGET_FILE, BUNDLE_BUDGET_FILE, formatRow, ratchetRows, ratchetState,
  readConst, readCoreCaps, rewriteConst, rewriteCoreCaps,
} from '../scripts/ratchets.mjs';
import { METRIC_NAMES } from '../scripts/monolith-metrics.mjs';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

test('#699 состояние храповика: равен, рыхлый, в полосе, выше полосы, не измерен', () => {
  assert.equal(ratchetState(100, 100, 50), 'tight');
  assert.equal(ratchetState(90, 100, 50), 'loose');
  assert.equal(ratchetState(150, 100, 50), 'over', 'граница полосы включительная — как у гейтов ветки');
  assert.equal(ratchetState(151, 100, 50), 'grew');
  assert.equal(ratchetState(undefined, 100, 50), 'missing');
  assert.equal(ratchetState(100, null, 50), 'missing');
});

test('#699 потолки ядер читаются и переписываются в исходнике теста, комментарии на месте', () => {
  const source = read(CORE_BUDGET_FILE);
  const caps = readCoreCaps(source);
  // Имена ядер здесь не пишутся: тесты, читающие монолит как текст, заморожены (#624).
  const [first, second] = Object.keys(caps);
  assert.equal(Object.keys(caps).length, 2, 'два ядра');
  const next = rewriteCoreCaps(source, { [first]: 12000 });
  assert.equal(readCoreCaps(next)[first], 12000);
  assert.equal(readCoreCaps(next)[second], caps[second]);
  assert.equal(next.split('\n').length, source.split('\n').length, 'меняется только число');
  assert.match(next, /2026-09-27, #676/, 'история решений остаётся');
  assert.match(source, new RegExp(`^export const CORE_BAND = ${CORE_BAND};$`, 'm'), 'полоса теста и инструмента — одно число');
});

test('#699 потолки графов читаются и переписываются с разрядами', () => {
  const source = read(BUNDLE_BUDGET_FILE);
  for (const entry of BUNDLE_CEILINGS) assert.ok(readConst(source, entry.name) > 0, entry.name);
  const next = rewriteConst(source, 'INITIAL_VIEW_GZIP_CEILING', 300323);
  assert.equal(readConst(next, 'INITIAL_VIEW_GZIP_CEILING'), 300323);
  assert.match(next, /^export const INITIAL_VIEW_GZIP_CEILING = 300_323;$/m);
  assert.throws(() => readConst(source, 'NO_SUCH_CEILING'), /нет export const NO_SUCH_CEILING/);
});

test('#699 отчёт видит все три вида храповиков и называет, что делать', () => {
  const rows = ratchetRows({
    coreCaps: { 'a.ts': 100 }, coreFacts: { 'a.ts': 90 },
    bundleCeilings: Object.fromEntries(BUNDLE_CEILINGS.map((e) => [e.name, 1000])),
    bundleFacts: Object.fromEntries(BUNDLE_CEILINGS.map((e) => [e.metric, 1000])),
    metrics: Object.fromEntries(METRIC_NAMES.map((n) => [n, 10])),
    baseline: Object.fromEntries(METRIC_NAMES.map((n) => [n, n === 'hostRefs' ? 5 : 10])),
  });
  assert.equal(rows.length, 1 + BUNDLE_CEILINGS.length + METRIC_NAMES.length);
  assert.equal(rows.find((r) => r.kind === 'core').state, 'loose');
  assert.ok(rows.filter((r) => r.kind === 'bundle').every((r) => r.state === 'tight'));
  assert.equal(rows.find((r) => r.name === 'hostRefs').state, 'over');
  assert.match(formatRow(rows.find((r) => r.kind === 'core')), /факт 90 · потолок 100 \(-10, полоса \+50\) — рыхлый/);
});

test('#699 публикация беты напоминает о храповиках, но не останавливается на них', () => {
  const local = read('scripts/release-prerelease.mjs');
  const main = local.slice(local.indexOf('const main = async'));
  assert.match(main, /'scripts\/ratchets\.mjs', 'report', '--warn'/);
  assert.match(main, /'scripts\/ratchets\.mjs', 'report', '--warn'\], \{ allowFailure: true, inherit: true \}\)/);
});

test('#699 r1 M1: runbook беты опускает храповики при подготовке кандидата, до публикации', () => {
  const runbook = read('docs/DEVELOPMENT.md');
  const prepare = runbook.slice(runbook.indexOf('Prepare the candidate as usual'), runbook.indexOf('npm run release:prerelease --'));
  assert.ok(prepare.length > 0, 'раздел подготовки кандидата найден');
  assert.match(prepare, /`npm run bundle:release`[\s\S]*`node scripts\/ratchets\.mjs tighten`/, 'tighten — после свежего dist/');
  assert.match(prepare, /commit them with the candidate/);
});
