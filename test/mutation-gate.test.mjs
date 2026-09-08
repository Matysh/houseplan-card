import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MUTANTS, applyPatches, guardNeedsBundle, guardNeedsTestBuild, selectChangedMutants, shardMutants, guardFiles,
  witnessFingerprint, readLedger, recordCaught, splitByLedger, LEDGER_SCHEMA,
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

test('#486 panel registration, cleanup and read-only protections have mutation witnesses', () => {
  const ids = new Set(MUTANTS.map(({ id }) => id));
  for (const id of [
    'panel-registers-wrong-route',
    'panel-registers-card-static-url',
    'panel-module-url-loses-version',
    'panel-becomes-admin-only',
    'panel-bypasses-panel-custom-api',
    'panel-static-legacy-boolean-claims-both-urls',
    'panel-cleanup-drops-generation-guard',
    'panel-cleanup-drops-identity-guard',
    'panel-cleanup-uses-new-remove-keyword',
    'panel-accepts-unverifiable-ownership',
    'panel-readonly-empty-bypasses-write-capability',
  ]) {
    assert.ok(ids.has(id), `${id}: отсутствует защитный свидетель #486`);
  }
});

test('#486 bundle topology and both stale entries have mutation witnesses', () => {
  const ids = new Set(MUTANTS.map(({ id }) => id));
  for (const id of [
    'entry-fallback-rewrite-skipped',
    'panel-entry-fallback-rewrite-skipped',
    'panel-entry-bypasses-card-graph',
  ]) {
    assert.ok(ids.has(id), `${id}: отсутствует защитный свидетель bundle-контракта #486`);
  }
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
  // Отбор по патчу, а не по префиксу id (ревью r1: `frontend-reload-notice-*`
  // патчит тот же файл и обязан попасть в набор).
  const registration = MUTANTS
    .filter((m) => m.patches.some((patch) => patch.file === 'custom_components/houseplan/frontend_registration.py'))
    .map((m) => m.id);
  assert.ok(registration.length >= 4, 'в реестре есть бэкенд-мутанты регистрации');
  for (const id of registration) {
    assert.ok(byGuard.includes(id), `${id} не отобран по гарду`);
    assert.ok(byPatch.includes(id), `${id} не отобран по патчу`);
  }
});

// #481. Журнал пойманных свидетелей: отобранный по диффу мутант, чьи входы
// не менялись с последнего пойманного прогона, не гоняется повторно. Так
// отменённый прогон не пропадает даром, а релизный бамп версии не
// превращает 131 мутанта в 20 минут на шард.

const LEDGER_MUTANT = { id: 'x', guard: 'node --test test/x.test.mjs', patches: [{ file: 'src/x.ts', find: 'a', replace: 'b' }] };
const fakeFs = (files) => ({
  root: '/repo',
  read: (file) => files[file] ?? '',
  exists: (file) => file in files,
  normalize: (text) => text.split('1.2.3').join('0.0.0-product-version'),
});

test('#481 AC1: отпечаток свидетеля не меняется от бампа версии, но меняется от правки патч-файла, гарда и объявления', () => {
  const base = fakeFs({ 'src/x.ts': "const CARD_VERSION = '1.2.3';\nlet a = 1;", 'test/x.test.mjs': 'assert(a)' });
  const fp = witnessFingerprint(LEDGER_MUTANT, base);
  const bumped = fakeFs({ ...{ 'src/x.ts': "const CARD_VERSION = '1.2.3';\nlet a = 1;", 'test/x.test.mjs': 'assert(a)' } });
  bumped.read = (file) => (file === 'src/x.ts' ? "const CARD_VERSION = '1.2.4';\nlet a = 1;" : 'assert(a)');
  bumped.normalize = (text) => text.split('1.2.4').join('0.0.0-product-version');
  assert.equal(witnessFingerprint(LEDGER_MUTANT, bumped), fp, 'бамп версии — не изменение свидетеля');
  const crlf = { ...base, read: (file) => base.read(file).replace(/\n/g, '\r\n') };
  assert.equal(witnessFingerprint(LEDGER_MUTANT, crlf), fp, 'CRLF канонизируется');
  const patchChanged = { ...base, read: (file) => (file === 'src/x.ts' ? 'let a = 2;' : base.read(file)) };
  assert.notEqual(witnessFingerprint(LEDGER_MUTANT, patchChanged), fp, 'правка патч-файла меняет отпечаток');
  const guardChanged = { ...base, read: (file) => (file === 'test/x.test.mjs' ? 'assert(b)' : base.read(file)) };
  assert.notEqual(witnessFingerprint(LEDGER_MUTANT, guardChanged), fp, 'правка файла гарда меняет отпечаток');
  assert.notEqual(witnessFingerprint({ ...LEDGER_MUTANT, guard: 'node --test test/y.test.mjs' }, base), fp, 'объявление гарда');
  assert.notEqual(witnessFingerprint({ ...LEDGER_MUTANT, patches: [{ file: 'src/x.ts', find: 'a', replace: 'c' }] }, base), fp, 'объявление патча');
});

test('#481 AC2: по журналу пропускается только совпавший отпечаток; чужой или отсутствующий — к прогону', () => {
  const a = { id: 'a', guard: 'g', patches: [] };
  const b = { id: 'b', guard: 'g', patches: [] };
  const c = { id: 'c', guard: 'g', patches: [] };
  const ledger = { schema: LEDGER_SCHEMA, caught: { a: 'fp-a', b: 'fp-old' } };
  const split = splitByLedger([a, b, c], ledger, (m) => `fp-${m.id}`);
  assert.deepEqual(split.skipped.map((m) => m.id), ['a']);
  assert.deepEqual(split.run.map((entry) => `${entry.mutant.id}:${entry.fingerprint}`), ['b:fp-b', 'c:fp-c']);
});

test('#481 AC3: журнал пишется сразу при поимке и переживает битый/чужой файл', () => {
  const dir = mkdtempSync(join(tmpdir(), 'houseplan-ledger-'));
  try {
    const file = join(dir, 'nested', 'ledger.json');
    assert.deepEqual(readLedger(file), { schema: LEDGER_SCHEMA, caught: {} }, 'нет файла — пустой журнал');
    const ledger = readLedger(file);
    recordCaught(file, ledger, { id: 'a' }, 'fp-a');
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { schema: LEDGER_SCHEMA, caught: { a: 'fp-a' } },
      'запись появляется в файле немедленно, не в конце прогона');
    recordCaught(file, ledger, { id: 'b' }, 'fp-b');
    assert.deepEqual(readLedger(file).caught, { a: 'fp-a', b: 'fp-b' });
    writeFileSync(file, '{ not json');
    assert.deepEqual(readLedger(file).caught, {}, 'битый журнал — пустой, не отказ');
    writeFileSync(file, JSON.stringify({ schema: 99, caught: { a: 'x' } }));
    assert.deepEqual(readLedger(file).caught, {}, 'чужая схема — пустой');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#481 AC4: --ledger без --changed — отказ с кодом 2', () => {
  const script = join(repoRoot, 'scripts/mutation-gate.mjs');
  const run = spawnSync(process.execPath, [script, '--ledger=/tmp/none.json', '--id=budget-warning-never-fires'], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /--ledger работает только вместе с --changed/);
});

test('#481: отпечатки реестра детерминированы и различают мутантов', () => {
  const first = witnessFingerprint(MUTANTS[0]);
  assert.equal(witnessFingerprint(MUTANTS[0]), first);
  assert.notEqual(witnessFingerprint(MUTANTS[1]), first);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test('#481 AC6 (реестр): бамп версии продукта не меняет отпечаток ни одного мутанта, патчащего ядра', () => {
  const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;
  const core = MUTANTS.filter((m) => m.patches.some((p) => /houseplan-(card|editor-runtime)\.ts$/.test(p.file)));
  assert.ok(core.length > 50, `ожидались десятки мутантов на ядра, найдено ${core.length}`);
  const bumped = (file) => readFileSync(join(repoRoot, file), 'utf8').split(version).join('9.9.9-bumped');
  const normalize = (text) => text.split('9.9.9-bumped').join('0.0.0-product-version').split(version).join('0.0.0-product-version');
  for (const m of core) {
    const before = witnessFingerprint(m, { root: repoRoot, normalize });
    const after = witnessFingerprint(m, { root: repoRoot, read: bumped, normalize });
    assert.equal(after, before, `${m.id}: релизный бамп изменил отпечаток`);
  }
});

// #499: девять браузерных гвардов начинались с `npm run bundle:sync` — раннер
// уже собрал бандл мутанта, гвард собирал его второй раз, а `tsc --noEmit`
// внутри `bundle:sync` красил гвард на нестрогом мутанте ещё до смока.
test('#499: ни один гвард реестра не собирает бандл сам — сборка одна, у раннера', () => {
  const selfBuilding = MUTANTS.filter((m) => /bundle:sync|bundle-sync\.mjs|rollup -c/.test(m.guard));
  assert.deepEqual(selfBuilding.map((m) => m.id), []);
  // Отрицательный свидетель: --check отвергает такой гвард. Проверяется на самой
  // регулярке из реестра, чтобы правило и тест не расходились.
  const guard = 'npm run bundle:sync && node demo/smoke_furniture.mjs';
  assert.ok(/bundle:sync|bundle-sync\.mjs|rollup -c/.test(guard));
  assert.equal(guardNeedsBundle('node demo/smoke_furniture.mjs'), true, 'без префикса гвард остаётся браузерным');
  const source = readFileSync(new URL('../scripts/mutation-gate.mjs', import.meta.url), 'utf8');
  assert.match(source, /гвард сам собирает бандл — сборку делает раннер \(#499\)/);
});

// --- #492 §6: замыкание входов гарда, обёртки, определения реестра -----------

import {
  baseRegistry, guardInputs, registryDelta, selectForDiff, wrapperInputs,
} from '../scripts/mutation-gate.mjs';

test('#492 §6.1: обёртки объявляют GUARD_INPUTS, и объявление читается статически', () => {
  assert.deepEqual(wrapperInputs('scripts/backend-test-guard.mjs'), ['tests_backend/test_ha_import_export.py']);
  assert.deepEqual(wrapperInputs('scripts/trail-resume-test-guard.mjs'),
    ['tests_backend/test_trails.py', 'tests_backend/test_trail_recorder.py']);
  assert.deepEqual(wrapperInputs('test/x.test.mjs'), [], 'не обёртка — нет объявления');
  // умолчание в коде обёртки совпадает с объявлением
  const wrapper = readFileSync(join(repoRoot, 'scripts/backend-test-guard.mjs'), 'utf8');
  assert.match(wrapper, /process\.argv\[3\] \|\| GUARD_INPUTS\[0\]/);
  // каждая обёртка, которую использует реестр, объявляет входы
  const wrappers = new Set(MUTANTS.flatMap((m) => guardFiles(m.guard)).filter((f) => /^scripts\/[\w-]+-guard\.mjs$/.test(f)));
  for (const file of wrappers) assert.ok(wrapperInputs(file).length > 0, `${file}: нет GUARD_INPUTS`);
});

test('#492 §6.1: умолчание обёртки действует без третьего аргумента и уступает явному файлу', () => {
  const byDefault = guardInputs('node scripts/backend-test-guard.mjs some_pattern');
  assert.ok(byDefault.includes('tests_backend/test_ha_import_export.py'));
  assert.ok(byDefault.includes('tests_backend/conftest.py'), 'pytest подхватывает conftest');
  assert.ok(byDefault.includes('scripts/backend-test-guard.mjs'), 'текст обёртки — в отпечатке');
  const explicit = guardInputs('node scripts/backend-test-guard.mjs some_pattern tests_backend/test_ha_websocket.py');
  assert.ok(explicit.includes('tests_backend/test_ha_websocket.py'));
  assert.ok(!explicit.includes('tests_backend/test_ha_import_export.py'), 'явный файл отменяет умолчание');
  const trail = guardInputs('node scripts/trail-resume-test-guard.mjs');
  assert.ok(trail.includes('tests_backend/test_trails.py') && trail.includes('tests_backend/test_trail_recorder.py'));
});

test('#492 §6.2: смок-гард тянет serve.mjs, compat-хелперы и фикстуры; src/** остаётся стороной патча', () => {
  const inputs = guardInputs('node demo/smoke_zigbee_topology_hover.mjs');
  for (const file of ['demo/serve.mjs', 'demo/editor-runtime-compat.mjs', 'demo/bundle-freshness.mjs']) {
    assert.ok(inputs.includes(file), `${file} вне входов смок-гарда`);
  }
  assert.ok(!inputs.some((f) => f.startsWith('src/')), 'src/** — не вход гарда (§6.4)');
  assert.ok(!inputs.some((f) => f.includes('/frontend/')), 'копия бандла — не вход');
});

test('#492 §8.2: правка запускаемого теста отбирает свидетелей обёрток и меняет их отпечаток', () => {
  const defaults = MUTANTS.filter((m) => /^node scripts\/backend-test-guard\.mjs \S+$/.test(m.guard));
  assert.ok(defaults.length >= 10, `обёрток без третьего аргумента: ${defaults.length}`);
  const selected = new Set(selectChangedMutants(MUTANTS, ['tests_backend/test_ha_import_export.py']).map((m) => m.id));
  for (const m of defaults) assert.ok(selected.has(m.id), `${m.id} не отобран правкой import-export теста`);
  const explicitOther = MUTANTS.find((m) => m.guard.includes('tests_backend/test_ha_websocket.py'));
  assert.ok(!selected.has(explicitOther.id), 'явный websocket-гард не отбирается правкой import-export');

  const trail = MUTANTS.find((m) => m.id === 'vacuum-trail-resume-disabled');
  assert.ok(selectChangedMutants(MUTANTS, ['tests_backend/test_trails.py']).some((m) => m.id === trail.id));
  const before = witnessFingerprint(trail);
  const after = witnessFingerprint(trail, {
    read: (file) => (file === 'tests_backend/test_trails.py' ? '# changed\n' : (existsSync(join(repoRoot, file)) ? readFileSync(join(repoRoot, file), 'utf8') : '')),
  });
  assert.notEqual(after, before, 'правка test_trails.py обязана менять отпечаток trail-свидетеля');

  const smokes = MUTANTS.filter((m) => /^node demo\/smoke_/.test(m.guard));
  const byServe = new Set(selectChangedMutants(MUTANTS, ['demo/serve.mjs']).map((m) => m.id));
  for (const m of smokes) assert.ok(byServe.has(m.id), `${m.id}: смок-свидетель не отобран правкой serve.mjs`);
});

test('#492 §6.4: дифф только по реестру отбирает добавленные и изменённые определения', () => {
  const a = { id: 'a', guard: 'node --test test/a.test.mjs', patches: [{ file: 'src/a.ts', find: '1', replace: '2' }], because: 'a' };
  const b = { id: 'b', guard: 'node --test test/b.test.mjs', patches: [{ file: 'src/b.ts', find: '1', replace: '2' }], because: 'b' };
  const bChanged = { ...b, patches: [{ file: 'src/b.ts', find: '1', replace: '3' }] };
  const c = { id: 'c', guard: 'node --test test/c.test.mjs', patches: [{ file: 'src/c.ts', find: '1', replace: '2' }], because: 'c' };
  assert.deepEqual(registryDelta([a, bChanged, c], [a, b, { ...c, id: 'gone' }]), { changed: ['b', 'c'], removed: ['gone'] });
  const picked = selectForDiff([a, bChanged, c], ['scripts/mutation-gate.mjs'], [a, b], { guardInputs: () => [] });
  assert.deepEqual(picked.selected.map((m) => m.id), ['b', 'c']);
  assert.deepEqual(picked.byFiles, []);
  // без реестра базы отбор по определениям невозможен — и это не «ничего не изменилось»
  const blind = selectForDiff([a, bChanged, c], ['scripts/mutation-gate.mjs'], null, { guardInputs: () => [] });
  assert.deepEqual(blind.selected, []);
  // дифф без реестра — определения не смотрятся
  const plain = selectForDiff([a, bChanged, c], ['src/a.ts'], [a, b], { guardInputs: () => [] });
  assert.deepEqual(plain.selected.map((m) => m.id), ['a']);
});

test('#492 §6.4: реестр базы читается из git без побочных эффектов', async () => {
  const base = await baseRegistry('HEAD');
  assert.ok(Array.isArray(base) && base.length > 500, 'реестр HEAD прочитан');
  assert.ok(!existsSync(join(repoRoot, 'scripts')) || !readFileSync(join(repoRoot, 'scripts/mutation-gate.mjs'), 'utf8').includes('\0'));
  assert.equal(await baseRegistry('0000000000000000000000000000000000000000'), null, 'нет такой базы — null, не бросок');
  const leftovers = (await import('node:fs')).readdirSync(join(repoRoot, 'scripts')).filter((f) => f.startsWith('.mutation-gate.base-'));
  assert.deepEqual(leftovers, [], 'временный модуль удалён');
});
