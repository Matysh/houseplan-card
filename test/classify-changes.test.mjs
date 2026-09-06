import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { classifyChanges, classifyAll, formatOutputs, OUTPUTS, CLASSIFIERS } from '../scripts/classify-changes.mjs';

// #473 AC8: диффозависимость перф-смока доказана на самой функции
// классификации, которую исполняет job `changes`.

test('дифф по изометрии включает perf_iso и только его из перф-выходов (#473 AC8)', () => {
  const out = classifyChanges(['src/iso-x.ts']);
  assert.equal(out.perf_iso, 'true');
  assert.equal(out.perf_interaction, 'false');
  assert.equal(out.frontend, 'true');
});

test('дифф по живому пути и оркестраторам кадра включает perf_interaction (#473 AC8)', () => {
  for (const file of ['src/live-x.ts', 'src/render-invalidation.ts',
    'src/houseplan-render-lifecycle.ts', 'src/houseplan-card.ts']) {
    const out = classifyChanges([file]);
    assert.equal(out.perf_interaction, 'true', file);
    assert.equal(out.perf_iso, 'false', file);
  }
});

test('дифф по документации не включает ни одного перф-профиля (#473 AC8)', () => {
  const out = classifyChanges(['docs/x.md']);
  assert.equal(out.perf_iso, 'false');
  assert.equal(out.perf_interaction, 'false');
  assert.equal(out.frontend, 'false');
});

test('тесты и демо перф-профили не включают: кадр они не замедляют', () => {
  const out = classifyChanges(['test/iso-scene-render.test.mjs', 'demo/benchmark_large_house.mjs', 'src/iso-x.test.ts.md']);
  assert.equal(out.perf_iso, 'false');
  assert.equal(out.perf_interaction, 'false');
});

test('прежние три выхода классифицируются как в inline-shell до выноса', () => {
  assert.deepEqual(classifyChanges(['custom_components/houseplan/frontend_registration.py']),
    { frontend: 'false', backend: 'true', integration: 'true', perf_iso: 'false', perf_interaction: 'false' });
  assert.deepEqual(classifyChanges(['custom_components/houseplan/frontend/houseplan-card.js']),
    { frontend: 'true', backend: 'false', integration: 'false', perf_iso: 'false', perf_interaction: 'false' });
  assert.deepEqual(classifyChanges(['hacs.json', 'tsconfig.json']),
    { frontend: 'true', backend: 'false', integration: 'true', perf_iso: 'false', perf_interaction: 'false' });
  assert.equal(classifyChanges(['scripts/support-relay/x.py']).backend, 'true');
  assert.equal(classifyChanges(['']).frontend, 'false');
});

test('fallback --all выставляет каждый известный выход, включая перф-профили', () => {
  const all = classifyAll();
  assert.deepEqual(Object.keys(all), OUTPUTS);
  assert.ok(OUTPUTS.every((name) => all[name] === 'true'));
  assert.deepEqual(Object.keys(CLASSIFIERS), OUTPUTS);
});

test('CLI пишет формат $GITHUB_OUTPUT: stdin — список файлов, --all — всё true', () => {
  const script = new URL('../scripts/classify-changes.mjs', import.meta.url).pathname;
  const fromStdin = execFileSync('node', [script], { input: 'src/iso-x.ts\ndocs/x.md\n', encoding: 'utf8' });
  assert.equal(fromStdin, formatOutputs(classifyChanges(['src/iso-x.ts', 'docs/x.md'])));
  assert.match(fromStdin, /^perf_iso=true$/m);
  assert.match(fromStdin, /^perf_interaction=false$/m);
  const all = execFileSync('node', [script, '--all'], { input: '', encoding: 'utf8' });
  assert.equal(all, OUTPUTS.map((name) => `${name}=true`).join('\n') + '\n');
});
