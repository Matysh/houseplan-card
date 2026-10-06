import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import {
  CHECK_OF_OUTPUT, CLASSIFIERS, OUTPUTS, PERF_PROFILES, classifyAll, classifyChanges, formatOutputs, mutantsRequested,
  screenshotsGateMode,
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

test('тесты и чужие демо-файлы перф-профили не включают: кадр и замер они не меняют', () => {
  // Glow-раннер и compare.mjs исполняет glow-смок, который идёт всегда;
  // фикстура плотного двойника принадлежит профилю без смока.
  const out = classify(['test/iso-scene-render.test.mjs', 'demo/benchmark_glow.mjs',
    'demo/performance/compare.mjs', 'demo/performance/isometric-stage3-dense-fixture.mjs']);
  assert.equal(out.perf_iso, 'false');
  assert.equal(out.perf_interaction, 'false');
});

// #770: смоковый профиль судят его бюджеты, а замеряет общий раннер
// large-house. Прежде профиль включал только `src/**`, и правка одного потолка
// шла в Validate с одним glow: новый потолок впервые судил кандидат беты.
// Профиль шага берётся из самого validate.yml (его `--budgets`), бюджеты
// профиля — из demo/performance по полю `profile`: новый файл бюджета этого
// профиля обязан включать его без правки теста.
const VALIDATE = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
const PERF_DIR = new URL('../demo/performance/', import.meta.url);
const BUDGETS = readdirSync(PERF_DIR).filter((name) => /^budgets[\w-]*\.json$/.test(name))
  .map((name) => ({ path: `demo/performance/${name}`, profile: JSON.parse(readFileSync(new URL(name, PERF_DIR), 'utf8')).profile }));
const PERF_STEPS = { perf_iso: 'Изометрический профиль по диффу', perf_interaction: 'Профиль взаимодействия по диффу' };
const smokeProfileOf = (output) => {
  const job = VALIDATE.slice(VALIDATE.indexOf('\n  performance_smoke:\n'), VALIDATE.indexOf('\n  geometry_parity:\n'));
  const start = job.indexOf(PERF_STEPS[output]);
  const step = job.slice(start, job.indexOf('- name:', start));
  assert.ok(start > 0, `${output}: нет шага «${PERF_STEPS[output]}»`);
  assert.match(step, new RegExp(`if: needs\\.changes\\.outputs\\.${output} == 'true'`));
  const smokeBudget = step.match(/--absolute-only --budgets=(demo\/performance\/[\w-]+\.json)/)[1];
  const { profile } = BUDGETS.find((budget) => budget.path === smokeBudget);
  assert.ok(step.includes(`--profile=${profile} `), `${output}: шаг меряет тот профиль, который судит его бюджет`);
  return { profile, smokeBudget };
};
// Набор профилей ключа реюза — тем же текстом, что исполняет шаг `keys` job
// `reuse`: `set=glow` и по строке `[ "$PERF_X" = "true" ] && set="$set-…"`.
const REUSE = VALIDATE.slice(VALIDATE.indexOf('\n  reuse:\n'), VALIDATE.indexOf('\n  hacs:\n'));
const perfSetOf = (outputs) => {
  const envOutput = Object.fromEntries([...REUSE.matchAll(/(PERF_\w+): \$\{\{ needs\.changes\.outputs\.(\w+) \}\}/g)]
    .map(([, env, output]) => [env, output]));
  let set = REUSE.match(/^\s*set=(\w+)$/m)[1];
  for (const [, env, suffix] of REUSE.matchAll(/\[ "\$(PERF_\w+)" = "true" \] && set="\$set-(\w+)"/g)) {
    if (outputs[envOutput[env]] === 'true') set = `${set}-${suffix}`;
  }
  return set;
};

test('#770: правка только бюджета включает профиль, который он судит, и меняет ключ реюза', () => {
  const quiet = perfSetOf(classify([p('docs', 'SUN.md')]));
  assert.equal(quiet, 'glow', 'без перф-диффа набор — один glow');
  for (const output of Object.keys(PERF_STEPS)) {
    const { profile, smokeBudget } = smokeProfileOf(output);
    const judged = BUDGETS.filter((budget) => budget.profile === profile).map((budget) => budget.path);
    // Смоковый и полный: смок повторяет потолки полного (#473 AC4), и правка
    // полного — правка того же профиля.
    assert.ok(judged.includes(smokeBudget) && judged.length >= 2, `${profile}: ${judged.join(', ')}`);
    for (const path of judged) {
      const out = classify([path]);
      assert.equal(out[output], 'true', `${path} судит ${profile} — профиль обязан войти в смок`);
      for (const other of Object.keys(PERF_STEPS).filter((name) => name !== output))
        assert.equal(out[other], 'false', `${path} не судит профиль ${other}`);
      assert.deepEqual(out.unknown, [], path);
      // Обе половины ключа `reuse-performance_smoke-<входы>-<набор>` меняются:
      // файл — вход job (хеш), а набор получает профиль.
      assert.ok(MANIFEST.performance_smoke.has(path), `${path}: вход хеша performance_smoke`);
      assert.notEqual(perfSetOf(out), quiet, `${path}: ключ реюза совпал бы с glow-only прогоном`);
    }
  }
  // Бюджеты профилей без смока (полные и glow) смоковых профилей не включают.
  const smokeProfiles = new Set(Object.keys(PERF_STEPS).map((output) => smokeProfileOf(output).profile));
  for (const budget of BUDGETS.filter(({ profile }) => !smokeProfiles.has(profile))) {
    const out = classify([budget.path]);
    for (const output of Object.keys(PERF_STEPS)) assert.equal(out[output], 'false', `${budget.path} → ${output}`);
  }
});

test('#770: раннер large-house, его фикстура, контракт карточки и оценщик включают оба смоковых профиля', () => {
  for (const file of ['demo/benchmark_large_house.mjs', 'demo/fixtures/large-house.mjs',
    'demo/performance/card-contract.mjs', 'demo/performance/evaluate.mjs']) {
    const out = classify([file]);
    assert.equal(out.perf_iso, 'true', file);
    assert.equal(out.perf_interaction, 'true', file);
    assert.equal(perfSetOf(out), 'glow-iso-interaction', file);
    assert.deepEqual(out.unknown, [], file);
  }
});

test('правка реестра мутантов даёт mutants=true; юниты реестра — тоже вход frontend (#475 r1, #492)', () => {
  for (const file of ['scripts/mutation-gate.mjs', 'scripts/mutation-registry.mjs',
    'scripts/mutation-selection.mjs', 'scripts/mutation-evidence.mjs',
    'scripts/mutation-execution.mjs']) {
    const out = classify([file]);
    assert.equal(out.mutants, 'true', file);
    assert.equal(out.frontend, 'true', `${file}: test/mutation-gate.test.mjs читает tooling`);
    assert.equal(out.backend, 'false', file);
  }
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

test('#548: parity выбирается по обоим зеркалам, fixture и toolchain, но не по чужому UI', () => {
  for (const file of ['src/junction-limits.ts', 'src/space-geometry.ts',
    'custom_components/houseplan/junction_limits.py',
    'custom_components/houseplan/wall_segment_model.py',
    'tests_backend/junction_parity.py', 'test/fixtures/junction-limits-parity.json',
    'tsconfig.junction-parity.json', 'package-lock.json', '.nvmrc', '.python-version']) {
    const out = classify([file]);
    assert.equal(out.geometry_parity, 'true', file);
    assert.deepEqual(out.unknown, [], file);
  }
  assert.equal(classify(['src/houseplan-card.ts']).geometry_parity, 'false');
  assert.equal(classify(['custom_components/houseplan/websocket_api.py']).geometry_parity, 'false');
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
  assert.equal(run({ EVENT_NAME: 'push', HEAD_MESSAGE: 'fix: x\n\nIssue: #1\nUser-Visible: no' }), 'heavy=false\nmutants_requested=false');
  // #601: кандидат беты и полный набор берут тяжёлые job, но не мутантов
  assert.equal(run({ EVENT_NAME: 'push', HEAD_MESSAGE: 'x\n\nRelease: v1.2.3' }), 'heavy=true\nmutants_requested=false');
  assert.equal(run({ EVENT_NAME: 'workflow_dispatch', FULL_INPUT: 'true', HEAD_MESSAGE: '' }), 'heavy=true\nmutants_requested=false');
  // #709: `mutants=true` по кнопке мутантов больше не включает — только ночь
  assert.equal(run({ EVENT_NAME: 'workflow_dispatch', FULL_INPUT: 'false', MUTANTS_INPUT: 'true', HEAD_MESSAGE: '' }), 'heavy=false\nmutants_requested=false');
  assert.equal(run({ EVENT_NAME: 'workflow_dispatch', FULL_INPUT: 'true', MUTANTS_INPUT: 'true', HEAD_MESSAGE: '' }), 'heavy=true\nmutants_requested=false');
});

test('#586: режим гейта скриншотов приходит одним значением и на кандидате строгий', () => {
  assert.equal(screenshotsGateMode({ eventName: 'push', headMessage: 'fix: x\n\nIssue: #1\nUser-Visible: no' }), 'warn');
  assert.equal(screenshotsGateMode({ eventName: 'push', headMessage: 'x\n\nRelease: v1.2.3' }), 'strict', 'кандидат беты');
  assert.equal(screenshotsGateMode({ eventName: 'push', headMessage: 'x\n\nRelease: v1.76.0' }), 'strict', 'кандидат стабильного');
  assert.equal(screenshotsGateMode({ eventName: 'workflow_dispatch', fullInput: 'true' }), 'strict');
  assert.equal(screenshotsGateMode({ eventName: 'workflow_dispatch', fullInput: 'false' }), 'warn');
  assert.equal(screenshotsGateMode({ eventName: 'pull_request' }), 'strict');
  assert.equal(screenshotsGateMode({ eventName: 'schedule' }), 'strict');
  // #760: полный Validate ветки задачи (`ci:golden`) судит отпечаток мягко,
  // кандидат на `dev` — строго, как прежде.
  assert.equal(screenshotsGateMode({ eventName: 'workflow_dispatch', fullInput: 'true', refName: 'issue/740-stairs' }), 'warn');
  assert.equal(screenshotsGateMode({ eventName: 'workflow_dispatch', fullInput: 'true', refName: 'refs/heads/issue/718-moon' }), 'warn');
  assert.equal(screenshotsGateMode({ eventName: 'workflow_dispatch', fullInput: 'true', refName: 'dev' }), 'strict');
  assert.equal(screenshotsGateMode({ eventName: 'push', headMessage: 'x\n\nRelease: v1.2.3', refName: 'dev' }), 'strict', 'кандидат на dev');

  // Регрессия, ради которой заведён #586: у `--heavy` вывод ДВУХСТРОЧНЫЙ, и
  // сравнение всего вывода со строкой `heavy=true` не совпадает никогда.
  const run = (args, env) => execFileSync(process.execPath, ['scripts/classify-changes.mjs', ...args], {
    encoding: 'utf8', env: { ...process.env, ...env },
  }).trim();
  const candidate = { EVENT_NAME: 'push', HEAD_MESSAGE: 'x\n\nRelease: v1.2.3' };
  assert.notEqual(run(['--heavy'], candidate), 'heavy=true', 'вывод --heavy многострочный — сравнивать его целиком нельзя');
  assert.equal(run(['--screenshots-mode'], candidate), 'strict');
  assert.equal(run(['--screenshots-mode'], { EVENT_NAME: 'push', HEAD_MESSAGE: 'fix: x' }), 'warn');
});

test('#586: preflight спрашивает режим одним значением, а не разбирает вывод --heavy', () => {
  const workflow = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  assert.match(workflow, /classify-changes\.mjs --screenshots-mode/);
  assert.ok(!/=\s*"heavy=true"/.test(workflow),
    'сравнение со строкой «heavy=true» вернулось — строгий режим снова не включится');
  assert.match(workflow, /check-docs\.mjs "\$external" --screenshots=\$mode/);
});

test('#709: Validate не запрашивает мутантов по диффу ни на одном событии — весь реестр ночью', () => {
  const t = (env) => mutantsRequested(env);
  assert.equal(t({ eventName: 'push', headMessage: 'fix: x\n\nIssue: #1\nUser-Visible: no' }), false, 'обычный push');
  assert.equal(t({ eventName: 'pull_request' }), false, 'PR — тоже нет');
  assert.equal(t({ eventName: 'workflow_dispatch', fullInput: 'false', mutantsInput: 'true' }), false, 'кнопка mutants=true больше ничего не включает');
  assert.equal(t({ eventName: 'workflow_dispatch', fullInput: 'false', mutantsInput: 'false' }), false, 'кнопка без запроса');
  // #601: мутанты проверяют тесты, а не продукт (#513); к бете задача прогнана
  // ими дважды, а ночь покрыта полным реестром — эти входы их не включают.
  assert.equal(t({ eventName: 'push', headMessage: 'x\n\nRelease: v1.2.3' }), false, 'кандидат беты — тяжёлые гейты без мутантов');
  assert.equal(t({ eventName: 'push', headMessage: 'x\n\nRelease: v1.76.0' }), false, 'кандидат стабильного — тоже');
  assert.equal(t({ eventName: 'workflow_dispatch', fullInput: 'true' }), false, 'полный набор по кнопке — без мутантов');
  assert.equal(t({ eventName: 'workflow_dispatch', fullInput: 'true', mutantsInput: 'false' }), false);
  assert.equal(t({ eventName: 'schedule' }), false, 'расписание Validate — не место мутантов, реестр идёт в mutation-gate.yml');
  assert.equal(t({ eventName: 'workflow_dispatch', fullInput: 'true', mutantsInput: 'true' }), false, 'и рядом с full');
  // #601 AC2: тяжёлые гейты на тех же входах не изменились
  assert.equal(heavyGatesRequested({ eventName: 'push', headMessage: 'x\n\nRelease: v1.2.3' }), true);
  assert.equal(heavyGatesRequested({ eventName: 'workflow_dispatch', fullInput: 'true' }), true);
});

test('#697: на ветке задачи трейлер Release: тяжёлый набор не включает, на dev — как прежде', () => {
  const acceptance = 'test: accept golden\n\nIssue: #687\nUser-Visible: no\nRelease: v1.78.0-beta.9\nBaseline-Reviewed: https://github.com/o/r/actions/runs/1';
  assert.equal(heavyGatesRequested({ eventName: 'push', headMessage: acceptance, refName: 'issue/687-x' }), false);
  assert.equal(heavyGatesRequested({ eventName: 'push', headMessage: acceptance, refName: 'refs/heads/issue/687-x' }), false);
  assert.equal(heavyGatesRequested({ eventName: 'push', headMessage: acceptance, refName: 'dev' }), true, 'кандидат на dev');
  assert.equal(heavyGatesRequested({ eventName: 'push', headMessage: acceptance }), true, 'без ветки — прежнее правило');
  assert.equal(heavyGatesRequested({ eventName: 'workflow_dispatch', fullInput: 'true', refName: 'issue/687-x' }), true,
    'ci:full/ci:golden — dispatch full=true на ветке задачи');
  assert.equal(screenshotsGateMode({ eventName: 'push', headMessage: acceptance, refName: 'issue/687-x' }), 'warn');
  const run = (env) => execFileSync(process.execPath, ['scripts/classify-changes.mjs', '--heavy'], {
    encoding: 'utf8', env: { ...process.env, ...env },
  }).trim();
  assert.equal(run({ EVENT_NAME: 'push', HEAD_MESSAGE: acceptance, REF_NAME: 'issue/687-x' }), 'heavy=false\nmutants_requested=false');
  const workflow = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  assert.equal((workflow.match(/REF_NAME: \$\{\{ github\.ref_name \}\}/g) || []).length >= 2, true, 'оба вызова знают ветку');
});
