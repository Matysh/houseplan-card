import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  CHECK_OF_OUTPUT, CLASSIFIERS, OUTPUTS, PERF_PROFILES, classifyAll, classifyChanges, formatOutputs,
} from '../scripts/classify-changes.mjs';
import { manifest } from '../scripts/check-inputs.mjs';
import { fileURLToPath } from 'node:url';

// Классификация идёт из единого manifest входов (#492 §5.2) на РЕАЛЬНОМ
// дереве репозитория: тест доказывает решения job `changes` для настоящих
// файлов, а не для выдуманных путей. Manifest считается один раз.
//
// Пути, которые НЕ должны быть входами, собираются из кусков: строковый
// литерал в этом файле сам сделал бы их входом frontend (тесты читают то, что
// называют), и проверка стала бы самосбывающейся.
const MANIFEST = manifest(process.cwd());
const classify = (files) => classifyChanges(files, { manifest: MANIFEST });
const p = (...parts) => parts.join('/');

test('дифф по изометрии включает perf_iso и только его из перф-выходов (#473 AC8)', () => {
  const out = classify(['src/iso-overlays.ts']);
  assert.equal(out.perf_iso, 'true');
  assert.equal(out.perf_interaction, 'false');
  assert.equal(out.frontend, 'true');
  assert.deepEqual(out.unknown, []);
});

test('дифф по живому пути и оркестраторам кадра включает perf_interaction (#473 AC8)', () => {
  for (const file of ['src/live-hover.ts', 'src/render-invalidation.ts',
    'src/houseplan-render-lifecycle.ts', 'src/houseplan-card.ts']) {
    const out = classify([file]);
    assert.equal(out.perf_interaction, 'true', file);
    assert.equal(out.perf_iso, 'false', file);
  }
});

test('дифф по документации не включает ни одного перф-профиля и ни одной job (#473 AC8)', () => {
  const out = classify([p('docs', 'SUN.md')]);
  assert.equal(out.perf_iso, 'false');
  assert.equal(out.perf_interaction, 'false');
  assert.equal(out.frontend, 'false');
  assert.equal(out.backend, 'false');
});

test('тесты и демо перф-профили не включают: кадр они не замедляют', () => {
  const out = classify(['test/iso-scene-render.test.mjs', 'demo/benchmark_large_house.mjs']);
  assert.equal(out.perf_iso, 'false');
  assert.equal(out.perf_interaction, 'false');
});

test('правка реестра мутантов даёт mutants=true; юниты реестра — тоже вход frontend (#475 r1, #492)', () => {
  const out = classify(['scripts/mutation-gate.mjs']);
  assert.equal(out.mutants, 'true');
  assert.equal(out.frontend, 'true', 'test/mutation-gate.test.mjs читает реестр');
  assert.equal(out.backend, 'false');
  assert.equal(classify(['src/color.ts']).mutants, 'true', 'патчи мутантов лежат в src/**');
});

test('#492 §1.2: relay, converter, schema и pyproject запускают backend', () => {
  for (const file of ['scripts/support-relay/relay.py', 'scripts/support-relay/hp_relay/app.py',
    'scripts/sh3d-convert/convert.mjs', 'scripts/sh3d-convert/golden/two-levels.space-1.json',
    'scripts/config-schema.json', 'scripts/dump-config-schema.py', 'pyproject.toml',
    'custom_components/houseplan/frontend_registration.py']) {
    const out = classify([file]);
    assert.equal(out.backend, 'true', file);
    assert.deepEqual(out.unknown, [], file);
  }
});

test('#492 AC6: правка UI не классифицируется как backend', () => {
  const out = classify(['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts']);
  assert.equal(out.backend, 'false');
  assert.equal(out.frontend, 'true');
});

test('интеграция: манифест, hacs.json, переводы (как в inline-shell до выноса)', () => {
  assert.equal(classify(['custom_components/houseplan/manifest.json']).integration, 'true');
  assert.equal(classify(['hacs.json']).integration, 'true');
  assert.equal(classify(['custom_components/houseplan/translations/ru.json']).integration, 'true');
  assert.equal(classify(['src/color.ts']).integration, 'false');
  assert.equal(classify(['']).frontend, 'false');
});

test('копия бандла — не вход ни одной проверки (класс D)', () => {
  const out = classify(['custom_components/houseplan/frontend/houseplan-card.js', 'dist/houseplan-card.js']);
  for (const name of Object.keys(CHECK_OF_OUTPUT)) assert.equal(out[name], 'false', name);
  assert.deepEqual(out.unknown, []);
});

test('#492 §5.2: неизвестный исполняемый вход расширяет прогон до полного набора и называется', () => {
  const out = classify(['scripts/brand-new-gate.mjs']);
  for (const name of OUTPUTS) assert.equal(out[name], 'true', name);
  assert.deepEqual(out.unknown, ['scripts/brand-new-gate.mjs']);
  // Объявленный не-вход и документация не расширяют.
  const quiet = classify([p('demo', 'stand', 'README.md'), p('demo', 'shot_sun.mjs'), p('docs', 'new-page.md')]);
  assert.deepEqual(quiet.unknown, []);
  for (const name of OUTPUTS) assert.equal(quiet[name], 'false', name);
});

test('fallback --all выставляет каждый известный выход, включая перф-профили', () => {
  const all = classifyAll();
  assert.deepEqual(Object.keys(all).filter((k) => k !== 'unknown'), OUTPUTS);
  assert.ok(OUTPUTS.every((name) => all[name] === 'true'));
  assert.deepEqual(Object.keys(CLASSIFIERS), OUTPUTS);
  assert.deepEqual(Object.keys(PERF_PROFILES), ['perf_iso', 'perf_interaction']);
});

test('CLI пишет формат $GITHUB_OUTPUT: stdin — список файлов, --all — всё true', () => {
  // fileURLToPath, не URL.pathname (#496): на Windows pathname даёт «/C:/…», Node ищет C:\C:\… .
  const script = fileURLToPath(new URL('../scripts/classify-changes.mjs', import.meta.url));
  const doc = p('docs', 'SUN.md');
  const fromStdin = execFileSync('node', [script], { input: `src/iso-overlays.ts\n${doc}\n`, encoding: 'utf8' });
  assert.equal(fromStdin, formatOutputs(classify(['src/iso-overlays.ts', doc])));
  assert.match(fromStdin, /^perf_iso=true$/m);
  assert.match(fromStdin, /^perf_interaction=false$/m);
  assert.match(fromStdin, /^unknown_inputs=$/m);
  const all = execFileSync('node', [script, '--all'], { input: '', encoding: 'utf8' });
  assert.equal(all, OUTPUTS.map((name) => `${name}=true`).join('\n') + '\nunknown_inputs=\n');
});

// #479: тяжёлые job идут на кандидате беты, по кнопке, на PR и по расписанию —
// и НЕ идут на обычном пуше. Обе стороны доказаны на самой функции, которую
// исполняет шаг `heavy` job `changes`.
import { heavyGatesRequested, hasReleaseTrailer } from '../scripts/classify-changes.mjs';

test('обычный push в dev не запрашивает тяжёлые job (#479)', () => {
  assert.equal(heavyGatesRequested({
    eventName: 'push',
    headMessage: 'fix: speed up wall-chain commits\n\nIssue: #461\nUser-Visible: yes\n',
  }), false);
  assert.equal(heavyGatesRequested({ eventName: 'push', headMessage: '' }), false);
  assert.equal(heavyGatesRequested({}), false);
});

test('кандидат беты и релиза — трейлер Release: — запрашивает тяжёлые job (#479)', () => {
  assert.equal(heavyGatesRequested({
    eventName: 'push',
    headMessage: 'build: prepare v1.73.0-beta.1 candidate\n\nIssue: #160\nUser-Visible: yes\nRelease: v1.73.0-beta.1\n',
  }), true);
  assert.equal(hasReleaseTrailer('Release v1.72.0\n\nRelease: v1.72.0'), true);
  // Слово в теле — не трейлер: строка должна начинаться с `Release:`.
  assert.equal(hasReleaseTrailer('docs: mention the Release: process in AGENTS'), false);
  assert.equal(hasReleaseTrailer('Release: soon'), false);
});

test('workflow_dispatch запрашивает тяжёлые job только с full=true (#479)', () => {
  assert.equal(heavyGatesRequested({ eventName: 'workflow_dispatch', fullInput: 'true' }), true);
  assert.equal(heavyGatesRequested({ eventName: 'workflow_dispatch', fullInput: true }), true);
  assert.equal(heavyGatesRequested({ eventName: 'workflow_dispatch', fullInput: 'false' }), false);
  assert.equal(heavyGatesRequested({ eventName: 'workflow_dispatch', fullInput: '' }), false);
});

test('pull_request и schedule всегда запрашивают тяжёлые job (#479)', () => {
  assert.equal(heavyGatesRequested({ eventName: 'pull_request', headMessage: 'x' }), true);
  assert.equal(heavyGatesRequested({ eventName: 'schedule' }), true);
});

test('CLI --heavy читает событие и сообщение из окружения (#479)', () => {
  const run = (env) => execFileSync(process.execPath, ['scripts/classify-changes.mjs', '--heavy'], {
    encoding: 'utf8', env: { ...process.env, ...env },
  }).trim();
  assert.equal(run({ EVENT_NAME: 'push', HEAD_MESSAGE: 'fix: x\n\nIssue: #1\nUser-Visible: no' }), 'heavy=false');
  assert.equal(run({ EVENT_NAME: 'push', HEAD_MESSAGE: 'x\n\nRelease: v1.2.3' }), 'heavy=true');
  assert.equal(run({ EVENT_NAME: 'workflow_dispatch', FULL_INPUT: 'true', HEAD_MESSAGE: '' }), 'heavy=true');
});
