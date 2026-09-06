import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MUTANTS, applyPatches, guardNeedsBundle, guardNeedsTestBuild, selectChangedMutants, shardMutants, guardFiles,
} from '../scripts/mutation-gate.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Дешёвая половина гейта, идёт с обычными юнитами на каждом прогоне. Полный
// прогон с пересборкой бандла на мутанта — предрелизный, он в
// .github/workflows/mutation-gate.yml.
//
// Реестр, отставший от кода, хуже отсутствующего: он выглядит защитой. Поэтому
// дрейф якорей ловится здесь, а не при редком полном прогоне.

test('every mutant patch anchors exactly once in the current source', () => {
  for (const mutant of MUTANTS) {
    for (const patch of mutant.patches) {
      const path = join(repoRoot, patch.file);
      assert.ok(existsSync(path), `${mutant.id}: файла ${patch.file} больше нет`);
      const source = readFileSync(path, 'utf8');
      const hits = source.split(patch.find).length - 1;
      assert.equal(hits, 1,
        `${mutant.id}: якорь в ${patch.file} найден ${hits} раз(а) — реестр отстал от кода`);
      assert.notEqual(patch.find, patch.replace, `${mutant.id}: патч ничего не меняет`);
    }
  }
});

test('every guard command points at a file that exists', () => {
  for (const mutant of MUTANTS) {
    // #42: python guards are legal now — the first pytest-scanner mutants
    const script = mutant.guard.split(' ')
      .find((part) => part.endsWith('.mjs') || part.endsWith('.py'));
    assert.ok(script, `${mutant.id}: guard не называет исполняемый файл`);
    assert.ok(existsSync(join(repoRoot, script)),
      `${mutant.id}: guard-файла ${script} не существует`);
  }
});

test('every mutant explains itself', () => {
  const ids = new Set();
  for (const mutant of MUTANTS) {
    assert.ok(mutant.because && mutant.because.length > 40,
      `${mutant.id}: без объяснения мутант превратится в карго-культ`);
    assert.ok(!ids.has(mutant.id), `дубль id: ${mutant.id}`);
    ids.add(mutant.id);
  }
  assert.ok(MUTANTS.length >= 6, 'стартовый набор — шесть мутантов по дырам из #85');
});

test('applyPatches rewrites the anchor and refuses a stale one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mg-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'a.ts'), 'const KEEP = 1;\nconst FEATHER = 2;\n');

    applyPatches(dir, [{ file: 'src/a.ts', find: 'const FEATHER = 2;', replace: 'const FEATHER = 20;' }]);
    assert.match(readFileSync(join(dir, 'src', 'a.ts'), 'utf8'), /FEATHER = 20/);

    // Якоря нет — отказ, а не тихий пропуск: патч «в никуда» выглядит защитой.
    assert.throws(
      () => applyPatches(dir, [{ file: 'src/a.ts', find: 'no such anchor', replace: 'x' }]),
      /0 раз/,
    );

    // Якорь двоится — тоже отказ: патч лёг бы «куда попало».
    writeFileSync(join(dir, 'src', 'a.ts'), 'twice\ntwice\n');
    assert.throws(
      () => applyPatches(dir, [{ file: 'src/a.ts', find: 'twice', replace: 'x' }]),
      /2 раз/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #235: в свежем worktree мутанта каталога test-build/ нет. Короткий гвард
// (сразу `node --test`) падал там с ERR_MODULE_NOT_FOUND, а гейт читал это как
// «мутант пойман» — тихий отказ, который девять мутантов держал мёртвыми, не
// краснея. Теперь компиляцию делает харнесс, и здесь проверяется, что он
// узнаёт нужный ему гвард.

test('the harness compiles test-build for exactly the guards that need it (#235)', () => {
  assert.equal(guardNeedsTestBuild('node --test --test-name-pattern="x" test/a.test.mjs'), true);
  assert.equal(guardNeedsTestBuild(
    'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/a.test.mjs',
  ), false, 'длинный гвард компилирует сам — второй раз не надо');
  assert.equal(guardNeedsTestBuild('node demo/smoke_x.mjs'), false, 'смоку хватает бандла');
  assert.equal(guardNeedsTestBuild('node scripts/backend-test-guard.mjs x'), false);
});

test('no mutant guard is left unable to resolve test-build (#235)', () => {
  for (const mutant of MUTANTS) {
    const file = mutant.guard.split(/\s+/).find((part) => part.endsWith('.test.mjs'));
    if (!file) continue;
    const source = readFileSync(join(repoRoot, file), 'utf8');
    if (!source.includes('test-build/')) continue;
    // Либо гвард компилирует сам, либо это делает харнесс — третьего исхода
    // (падение на резолве модуля) быть не должно.
    assert.ok(
      mutant.guard.includes('tsconfig.test.json') || guardNeedsTestBuild(mutant.guard),
      `${mutant.id}: гвард читает ${file}, который импортирует test-build/, `
      + 'и никто этот каталог в мутанте не соберёт',
    );
  }
});

// --- #332: бандл собирается только тем, кто его читает ---

test('#332: guardNeedsBundle отличает браузерные гварды от остальных', () => {
  // Браузерные: смоки, golden и явный bundle:sync.
  assert.equal(guardNeedsBundle('node demo/smoke_junction_limits.mjs'), true);
  assert.equal(guardNeedsBundle(
    'node demo/golden/run.mjs --mode=capture --scenario=openings-filled-tunnel-dark',
  ), true);
  assert.equal(guardNeedsBundle('npm run bundle:sync && node demo/smoke_v8_draft_write.mjs'), true);
  // Юнит, бэкенд и хелперы бандл не открывают.
  assert.equal(guardNeedsBundle(
    'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
    + '&& node --test --test-name-pattern="x" test/junction-limits.test.mjs',
  ), false);
  assert.equal(guardNeedsBundle(
    'node scripts/backend-test-guard.mjs some_pattern tests_backend/test_trails.py',
  ), false);
  assert.equal(guardNeedsBundle('node scripts/trail-resume-test-guard.mjs'), false);
});

test('#332: каждый гвард реестра классифицируется, смешанных нет', () => {
  // Гвард, который гоняет и юниты, и смок, обязан получить бандл: критерий
  // demo/ это покрывает. Здесь фиксируется, что доля браузерных гвардов не
  // «схлопнулась» молча — экономия #332 живёт только пока классификация умна.
  const bundle = MUTANTS.filter((m) => guardNeedsBundle(m.guard)).length;
  const rest = MUTANTS.length - bundle;
  assert.ok(bundle >= 40, `браузерных гвардов подозрительно мало: ${bundle}`);
  assert.ok(rest >= 150, `небраузерных гвардов подозрительно мало: ${rest}`);
});

// --- #332: дифф-режим и шарды ---

test('#332: selectChangedMutants берёт мутанта при любом задетом patch.file', () => {
  const mutants = [
    { id: 'a', patches: [{ file: 'src/one.ts' }] },
    { id: 'b', patches: [{ file: 'src/two.ts' }, { file: 'src/three.ts' }] },
    { id: 'c', patches: [{ file: 'custom_components/houseplan/x.py' }] },
  ];
  assert.deepEqual(
    selectChangedMutants(mutants, ['src/three.ts', 'docs/README.md']).map((m) => m.id),
    ['b'],
  );
  assert.deepEqual(selectChangedMutants(mutants, ['docs/README.md']), []);
  assert.deepEqual(
    selectChangedMutants(mutants, ['src/one.ts', 'custom_components/houseplan/x.py'])
      .map((m) => m.id),
    ['a', 'c'],
  );
});

test('#332: шарды покрывают реестр целиком и не пересекаются', () => {
  const TOTAL = 4;
  const seen = new Map();
  for (let index = 1; index <= TOTAL; index++) {
    for (const mutant of shardMutants(MUTANTS, index, TOTAL)) {
      assert.equal(seen.has(mutant.id), false, `мутант ${mutant.id} попал в два шарда`);
      seen.set(mutant.id, index);
    }
  }
  assert.equal(seen.size, MUTANTS.length, 'объединение шардов не равно реестру');
  // Чересполосная нарезка: дорогие смок-мутанты размазаны, а не в одном шарде.
  const perShard = new Map();
  for (const [id, shard] of seen) {
    const isBundle = guardNeedsBundle(MUTANTS.find((m) => m.id === id).guard);
    if (isBundle) perShard.set(shard, (perShard.get(shard) || 0) + 1);
  }
  const counts = [...perShard.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= MUTANTS.length / TOTAL / 2,
    `браузерные мутанты скучковались: ${counts.join(', ')}`);
});

test('#458 у каждого модуля горячего пути отрисовки есть свой мутант', () => {
  // #451 принёс 1 651 строку в восьми новых модулях, и защита осталась
  // смотреть на старые ядровые файлы: единственный мутант того релиза патчил
  // houseplan-card.ts и houseplan-editor-runtime.ts, то есть места, ОТКУДА код
  // ушёл. Это системный побочный эффект выноса в модули, и он повторяется на
  // каждой такой задаче — поэтому требование записано гейтом, а не памятью.
  //
  // Цена ошибки здесь необычная: обычный дефект рендера виден (экран падает или
  // мигает), а дефект этой оптимизации даёт устаревший экран без единого
  // признака поломки — план тихо показывает вчерашнее состояние лампы.
  const modules = [
    'src/live-editor.ts',
    'src/pointer-move-queue.ts',
    'src/live-interaction-runtime.ts',
    'src/live-viewport.ts',
    'src/render-invalidation.ts',
    'src/resize-live-preflight.ts',
    'src/houseplan-render-lifecycle.ts',
  ];
  // `src/live-hover.ts` сознательно вне списка: его контракты — либо чисто
  // производительные (мемо по наведённой комнате), либо доменные (подсветка
  // комнаты, застрявшая после ухода курсора). Первое мутантом не ловится в
  // принципе, второе ловится только браузерным смоком. Появится смок — модуль
  // добавляется сюда вместе с мутантом.
  for (const file of modules) {
    const covered = MUTANTS.filter((mutant) => mutant.patches.some((patch) => patch.file === file));
    assert.ok(covered.length, `${file}: ни одного мутанта — защита не там, где код`);
    for (const mutant of covered) {
      assert.ok(!mutant.patches.some((patch) => patch.file === 'src/houseplan-card.ts'
        || patch.file === 'src/houseplan-editor-runtime.ts'),
      `${mutant.id}: патчит старое ядро вместо ${file} — это и есть исходный дефект #458`);
    }
  }
});

// #472. У отказа еженедельного прогона не было адресата: права workflow не
// позволяли завести issue, шага на отказ не было, а одна concurrency-группа на
// всё позволяла ручному запуску молча отменить расписание.
import { readFileSync as readWorkflowFile } from 'node:fs';
const mutationWorkflow = readWorkflowFile(
  new URL('../.github/workflows/mutation-gate.yml', import.meta.url), 'utf8',
);
const validateWorkflowText = readWorkflowFile(
  new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8',
);

test('#472 AC1: у расписания и ручного запуска разные concurrency-группы', () => {
  assert.match(mutationWorkflow, /group: mutation-gate-\$\{\{ github\.event_name \}\}/);
});

test('#472 AC2: каждый шард сохраняет свой лог артефактом при любом исходе', () => {
  assert.match(mutationWorkflow, /set -o pipefail\n\s+node scripts\/mutation-gate\.mjs --shard=[^\n]*\| tee artifacts\/mutation-shard-/);
  const upload = mutationWorkflow.slice(mutationWorkflow.indexOf('- name: Сохранить лог шарда'));
  assert.match(upload.slice(0, 400), /if: always\(\)/);
  assert.match(upload.slice(0, 400), /name: mutation-shard-\$\{\{ matrix\.shard \}\}/);
});

test('#472 AC5: job report — только по расписанию, только при не-успехе, с полными правами', () => {
  const report = mutationWorkflow.slice(mutationWorkflow.indexOf('  report:'));
  assert.match(report, /if: always\(\) && github\.event_name == 'schedule' && needs\.mutants\.result != 'success'/);
  const permissions = report.slice(report.indexOf('permissions:'), report.indexOf('steps:'));
  for (const grant of ['contents: read', 'actions: read', 'issues: write']) {
    assert.ok(permissions.includes(grant), `нет права ${grant} у job report`);
  }
  assert.match(report, /node scripts\/mutation-gate-report\.mjs/);
});

test('#472 r1: SHA отчёта — от чекаута dev, а не github.sha (вершина main у расписания)', () => {
  const report = mutationWorkflow.slice(mutationWorkflow.indexOf('\n  report:\n'));
  assert.match(report, /ref: dev/);
  assert.match(report, /SHA=\$\(git rev-parse HEAD\)/);
  assert.ok(!report.includes('${{ github.sha }}'), 'github.sha у schedule указывает на main, не на проверенный dev');
  assert.match(report, /--ref=dev --sha="\$SHA"/);
});

test('#472 AC6: повторный отказ дописывает открытое issue, а не создаёт второе', () => {
  const report = mutationWorkflow.slice(mutationWorkflow.indexOf('  report:'));
  const search = report.indexOf('gh issue list');
  const create = report.indexOf('gh issue create');
  const comment = report.indexOf('gh issue comment');
  assert.ok(search > 0 && comment > search && create > search, 'поиск открытого issue идёт до create/comment');
});

test('#472 AC7: отсутствие Telegram-секретов не роняет job', () => {
  const telegram = mutationWorkflow.slice(mutationWorkflow.indexOf('- name: Telegram'));
  assert.match(telegram, /if \[ -z "\$TOKEN" \] \|\| \[ -z "\$CHAT" \]; then\n\s+echo "::warning::[^\n]*"\n\s+exit 0/);
});

test('#472 AC8: Validate сверяет mutation-gate.yml между main и dev наравне с process.yml', () => {
  assert.match(validateWorkflowText, /for file in process\.yml mutation-gate\.yml; do/);
});

// #475. Свидетель гниёт двумя способами: изменился файл, который он патчит,
// либо изменился его гард — и тот перестал ходить по мутированной ветке.
// Прежний отбор по диффу видел только первый; четыре мутанта пережили свои
// гарды после #302/#309 и нашлись лишь полным прогоном перед v1.72.0.

const always = () => true;

test('#475 AC1: мутант отбирается по изменённому файлу патча', () => {
  const m = { id: 'x', guard: 'node --test test/x.test.mjs', patches: [{ file: 'src/x.ts' }] };
  assert.equal(selectChangedMutants([m], ['src/x.ts'], always).length, 1);
  assert.equal(selectChangedMutants([m], ['src/y.ts'], always).length, 0);
});

test('#475 AC2: мутант отбирается по изменённому файлу гарда — смок, юнит, pytest', () => {
  const smoke = { id: 's', guard: 'node demo/smoke_x.mjs', patches: [{ file: 'src/a.ts' }] };
  const unit = { id: 'u', guard: 'node --test --test-name-pattern="p" test/u.test.mjs', patches: [{ file: 'src/a.ts' }] };
  const py = { id: 'p', guard: 'python3 -m pytest tests_backend/test_x.py -q -p no:cacheprovider', patches: [{ file: 'custom_components/houseplan/x.py' }] };
  assert.deepEqual(selectChangedMutants([smoke, unit, py], ['demo/smoke_x.mjs'], always).map((m) => m.id), ['s']);
  assert.deepEqual(selectChangedMutants([smoke, unit, py], ['test/u.test.mjs'], always).map((m) => m.id), ['u']);
  assert.deepEqual(selectChangedMutants([smoke, unit, py], ['tests_backend/test_x.py'], always).map((m) => m.id), ['p']);
});

test('#475 AC3: флаги и шаблоны гарда файлами не считаются', () => {
  const files = guardFiles('node --test --test-name-pattern="magnet presses|x.mjs" test/furniture.test.mjs', always);
  assert.deepEqual(files, ['test/furniture.test.mjs']);
  // несуществующий путь — не файл гарда, даже если похож
  assert.deepEqual(guardFiles('node demo/smoke_nope.mjs', () => false), []);
  assert.deepEqual(guardFiles('', always), []);
});

test('#475 AC5: дифф, не задевающий ни патчей, ни гардов, ничего не отбирает', () => {
  const m = { id: 'x', guard: 'node demo/smoke_x.mjs', patches: [{ file: 'src/x.ts' }] };
  assert.deepEqual(selectChangedMutants([m], ['docs/README.md', 'src/other.ts'], always), []);
});

test('#475 AC6: воспроизведение #467 — дифф по src/wall-thickness.ts отбирает multi-wall мутантов', () => {
  const ids = selectChangedMutants(MUTANTS, ['src/wall-thickness.ts']).map((m) => m.id);
  for (const id of ['multi-wall-orthogonal-strip-protection-disabled', 'multi-wall-exterior-corridor-disabled', 'junction-fan-limit-back-to-249']) {
    assert.ok(ids.includes(id), `${id} не отобран`);
  }
});

test('#475 AC7: воспроизведение находки ревью — бэкенд-мутанты отбираются по .py гарду и патчу', () => {
  const byGuard = selectChangedMutants(MUTANTS, ['tests_backend/test_ha_frontend_registration.py']).map((m) => m.id);
  const byPatch = selectChangedMutants(MUTANTS, ['custom_components/houseplan/frontend_registration.py']).map((m) => m.id);
  const registration = MUTANTS.filter((m) => m.id.startsWith('frontend-registration-')).map((m) => m.id);
  assert.ok(registration.length >= 3, 'в реестре есть бэкенд-мутанты регистрации');
  for (const id of registration) {
    assert.ok(byGuard.includes(id), `${id} не отобран по гарду`);
    assert.ok(byPatch.includes(id), `${id} не отобран по патчу`);
  }
});
