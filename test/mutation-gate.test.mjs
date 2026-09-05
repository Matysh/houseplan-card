import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MUTANTS, applyPatches, guardNeedsBundle, guardNeedsTestBuild,
  selectChangedMutants, shardMutants,
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
