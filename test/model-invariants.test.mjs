import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkReferences, checkWallKeys, checkWallRecordsPreserved, latticePoint,
  readModel, wallKey,
} from '../scripts/model-invariants.mjs';
import { wallKey as productWallKey } from '../test-build/wall-thickness.js';
import { GRID_STEP_N } from '../test-build/space-geometry.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// #254. Инварианты нужны не сами по себе, а чтобы ловить уже случившиеся
// дефекты: #253 (запись толщины исчезла при ресайзе), #244 (маркеры на
// удалённые пространства), #252 (позиции без владельца). Поэтому каждый тест
// ниже воспроизводит либо реальный дефект, либо законный случай, который
// проверка обязана НЕ ловить — второе не менее важно: инвариант, кричащий на
// законную операцию, отключат в первую неделю.

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const model = (overrides = {}) => ({
  config: {
    spaces: [{
      id: 'sp1', cell_cm: 5,
      rooms: [{ id: 'r1', name: 'R', area: 'kitchen', poly: rect(0.1, 0.1, 0.4, 0.4) }],
      walls: [{ key: 'k1', cm: 30, a: [0.1, 0.1], b: [0.4, 0.1] }],
      partitions: [], open_spans: [],
    }],
    markers: [{ id: 'm1', binding: 'virtual', space: 'sp1' }],
    ...overrides.config,
  },
  layout: overrides.layout ?? { m1: { s: 'sp1', x: 0.2, y: 0.2 } },
});

test('чистая модель нарушений не даёт (#254)', () => {
  assert.deepEqual(checkReferences(model()), []);
});

test('#244: маркер на удалённое пространство — нарушение', () => {
  const m = model();
  m.config.markers[0].space = 'f1';
  const found = checkReferences(m);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'marker_space');
  assert.equal(found[0].reference, 'f1');
});

test('#244: удалённый маркер не считается нарушением', () => {
  // `removed: true` — это надгробие, а не живая ссылка. Ловить его значит
  // приучить читателя пролистывать отчёт.
  const m = model();
  m.config.markers[0].space = 'f1';
  m.config.markers[0].removed = true;
  assert.deepEqual(checkReferences(m), []);
});

test('#252: позиция на удалённое пространство и позиция без владельца', () => {
  const m = model({ layout: {
    m1: { s: 'sp1', x: 0.2, y: 0.2 },
    ghost: { s: 'space_f1_4c7c573f', x: 0.3, y: 0.3 },
    rl_room_gone: { s: 'sp1', x: 0.3, y: 0.3 },
    'grp_no_such_area': { s: 'sp1', x: 0.3, y: 0.3 },
  } });
  const kinds = checkReferences(m).map((v) => `${v.kind}:${v.owner}`);
  assert.ok(kinds.includes('layout_space:ghost'));
  assert.ok(kinds.includes('layout_owner:rl_room_gone'));
  assert.ok(kinds.includes('layout_owner:grp_no_such_area'));
  assert.equal(kinds.length, 3, 'живая позиция m1 нарушением быть не должна');
});

test('позиция устройства без записи маркера — наблюдение, а не нарушение (#254)', () => {
  // Маркеры создаются лениво, позиция сохраняется сразу: по одной
  // конфигурации мусор от живого устройства не отличить. Проверка с ложными
  // срабатываниями будет отключена в первую же неделю, поэтому такие случаи
  // выводятся отдельным списком.
  const m = model({ layout: { '980f1446c4ec1a3a9fa9ff5f6d93caed': { s: 'sp1', x: 0.2, y: 0.2 } } });
  const notes = [];
  assert.deepEqual(checkReferences(m, { notes }), []);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].kind, 'unknown_owner');
});

// Все модели, которые проект возит с собой, обязаны быть согласованы. Список
// не хардкодится: фикстуры перечисляются чтением каталога, поэтому новая
// фикстура попадает под проверку сама, без правки этого теста.
const fixtureModules = () => readdirSync(resolve(repoRoot, 'demo/fixtures'))
  .filter((name) => name.endsWith('.mjs')).sort();

const demoStandModel = () => {
  // Конфигурация стенда живёт внутри demo.html — на ней стоят все 170 смоков.
  // Если разбор перестанет находить блоки, это само по себе сигнал: стенд
  // сменил форму, и проверять его надо заново.
  const html = readFileSync(resolve(repoRoot, 'demo/srv/demo.html'), 'utf8');
  const block = (name) => {
    const declaration = html.indexOf(`const ${name} = `);
    assert.ok(declaration >= 0, `в demo.html не найден блок ${name}`);
    const from = html.indexOf('{', declaration);
    let depth = 0, index = from;
    for (; index < html.length; index++) {
      const char = html[index];
      if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { index++; break; }
    }
    // eslint-disable-next-line no-new-func
    return new Function(`return ${html.slice(from, index)}`)();
  };
  return { config: block('CFG'), layout: block('LAYOUT') };
};

/**
 * Признанный долг по контракту ключей (#260), а не список исключений.
 *
 * `large-house` пишет метки вида `perf-wall-0-3`: они не разбираются как
 * координаты вовсе, поэтому в перф-профиле путь поиска по ключу мёртв и
 * толщину спасают только точные концы. `visual-matrix` пишет ключ с четырьмя
 * знаками вместо шести — там расхождение попадает в допуск и рендер не страдает.
 * Обе — вход golden и бюджетов, поэтому правка требует переприёмки эталонов:
 * решение владельца, а не правка по ходу.
 */
const KEY_CONTRACT_DEBT = new Map([
  ['large-house.mjs:makeLargeHouseFixture', 147],
  ['visual-matrix.mjs:makeVisualMatrixFixture', 23],
]);

test('все модели, которые возит с собой проект, инварианты не нарушают (#254)', async () => {
  const models = [];
  for (const file of fixtureModules()) {
    const loaded = await import(`../demo/fixtures/${file}`);
    for (const [name, value] of Object.entries(loaded)) {
      if (typeof value !== 'function' || !/^make.*Fixture$/.test(name)) continue;
      const fixture = value();
      if (fixture?.config) models.push([`${file}:${name}`, fixture]);
    }
  }
  models.push(['demo/srv/demo.html', demoStandModel()]);
  assert.ok(models.length >= 3, `моделей найдено ${models.length}: список подозрительно короток`);

  for (const [label, fixture] of models) {
    const found = checkReferences({ config: fixture.config, layout: fixture.layout || {} });
    assert.deepEqual(found.map((v) => `${v.kind}:${v.owner} → ${v.reference}`), [],
      `${label}: модель, нарушающая инварианты, обесценивает и golden, и смоки на ней`);

    // Ключи (#259) проверяются с одним признанным долгом: две фикстуры пишут
    // ключ не по контракту (#260). Долг записан числом, а не исключением по
    // имени: вырастет — тест покраснеет, починят — тоже покраснеет и потребует
    // убрать запись. Молчаливого исключения здесь быть не должно, иначе
    // проверка тихо перестанет что-либо значить.
    const debt = KEY_CONTRACT_DEBT.get(label) ?? 0;
    const keys = checkWallKeys(fixture.config);
    assert.equal(keys.length, debt, debt
      ? `${label}: признанный долг #260 — ожидалось ${debt} записей с ключом не по`
        + ` контракту, найдено ${keys.length}. Починили — уберите запись из`
        + ' KEY_CONTRACT_DEBT; стало больше — фикстура добавила новые.'
      : `${label}: ключ записи толщины не равен ключу решёточного ребра —`
        + ' при отрисовке такая запись не находится (#258)');
  }
});

test('подпись существующей комнаты и метка существующей области законны', () => {
  const m = model({ layout: {
    rl_r1: { s: 'sp1', x: 0.2, y: 0.2 },
    grp_kitchen: { s: 'sp1', x: 0.25, y: 0.25 },
  } });
  assert.deepEqual(checkReferences(m), []);
});

test('запись толщины обязана лежать на ребре комнаты или на перегородке', () => {
  const m = model();
  m.config.spaces[0].walls.push({ key: 'k2', cm: 20, a: [0.8, 0.8], b: [0.9, 0.8] });
  const found = checkReferences(m).filter((v) => v.kind === 'wall_carrier');
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /не лежит/);

  // Перегородка — такой же законный носитель, как ребро комнаты.
  m.config.spaces[0].partitions.push({ id: 'p1', a: [0.8, 0.8], b: [0.9, 0.8], cm: 20 });
  assert.deepEqual(checkReferences(m).filter((v) => v.kind === 'wall_carrier'), []);
});

test('запись только с ключом (совместимость) проверку не роняет', () => {
  const m = model();
  m.config.spaces[0].walls.push({ key: 'legacy', cm: 15 });
  assert.deepEqual(checkReferences(m).filter((v) => v.kind === 'wall_carrier'), []);
});

test('#253: исчезнувшая запись толщины — нарушение первого инварианта', () => {
  // Точные числа реального дефекта: 24 записи до жеста, 23 после; исчезла
  // горизонтальная стена 33 см, общая с соседними комнатами.
  const before = [{ cm: 33 }, { cm: 29 }, { cm: 20 }];
  const after = [{ cm: 29 }, { cm: 20 }];
  const found = checkWallRecordsPreserved(before, after);
  assert.equal(found.length, 1);
  assert.equal(found[0].owner, '33 см');
  assert.equal(found[0].kind, 'lost');
});

test('законные операции первый инвариант не нарушают (#254)', () => {
  // Укорачивание: ресайз сдвинул ребро, записи те же.
  assert.deepEqual(checkWallRecordsPreserved([{ cm: 30 }], [{ cm: 30 }]), []);
  // Разрез: одна запись стала двумя того же значения.
  assert.deepEqual(checkWallRecordsPreserved([{ cm: 30 }], [{ cm: 30 }, { cm: 30 }]), []);
  // Склейка: две одинаковые записи стали одной.
  assert.deepEqual(checkWallRecordsPreserved([{ cm: 30 }, { cm: 30 }], [{ cm: 30 }]), []);
  // Явная очистка толщины пользователем — объявляется вызывающим.
  assert.deepEqual(checkWallRecordsPreserved([{ cm: 30 }], [], { allowClear: true }), []);
  // Нулевые и мусорные значения записями не считаются.
  assert.deepEqual(checkWallRecordsPreserved([{ cm: 0 }, { cm: null }], []), []);
});

test('readModel понимает экспорт, ответ config/get и сырой config (#254)', () => {
  const config = { spaces: [], markers: [] };
  assert.deepEqual(readModel(JSON.stringify({ payload: { config, layout: { a: 1 } } })),
    { config, layout: { a: 1 } });
  assert.deepEqual(readModel(JSON.stringify({ result: { config } })), { config, layout: {} });
  assert.deepEqual(readModel(JSON.stringify(config)), { config, layout: {} });
});

// --------------------------- инвариант 3: ключи ------------------------------
// #258. Числа ниже не придуманы: это две записи из экспорта владельца, на
// которых после «Оптимизировать» появились белые клинья в местах схода стен.
// Стены вертикальные, длиной 71 и 49 шагов решётки — нечётной, поэтому середина
// приходится ровно на границу округления, и бакет решает шум в последних битах.

const KEYED = (key, cm, a, b) => ({
  config: { spaces: [{ id: 'sp1', cell_cm: 5, rooms: [], walls: [{ key, cm, a, b }] }] },
});

test('#258: ключ, пересчитанный от сырых концов, — нарушение', () => {
  const found = checkWallKeys(KEYED(
    '0.887500,0.195833@1.5706', 29, [0.8875, 0.05], [0.8875, 0.345833333],
  ).config);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'wall_key');
  assert.equal(found[0].reference, '0.887500,0.200000@1.5706');

  const second = checkWallKeys(KEYED(
    '0.979167,0.445833@1.5706', 28, [0.979166667, 0.345833333], [0.979166667, 0.55],
  ).config);
  assert.equal(second.length, 1);
  assert.equal(second[0].reference, '0.979167,0.450000@1.5706');
});

test('#258: тот же ключ до дефекта нарушением не считается', () => {
  // Обратная половина того же дефекта, и она важнее прямой: форма проверки «от
  // сырых концов» помечала бы именно ЭТО состояние, а план на нём рисовался
  // верно. Проверка, ругающаяся на исправное, отключается в первую неделю.
  assert.deepEqual(checkWallKeys(KEYED(
    '0.887500,0.200000@1.5706', 29, [0.8875, 0.05], [0.8875, 0.345833333],
  ).config), []);
});

test('запись без концов ключевую проверку не роняет', () => {
  // Совместимость: у старых записей есть только ключ. Сверять не с чем, и это
  // не повод объявлять их сломанными.
  assert.deepEqual(checkWallKeys({
    spaces: [{ id: 'sp1', walls: [{ key: 'legacy', cm: 15 }, { cm: 20 }] }],
  }), []);
  assert.deepEqual(checkWallKeys({ spaces: [{ id: 'sp1', walls: [
    { key: '', cm: 15, a: [0, 0], b: [0.1, 0] },
    { key: 42, cm: 15, a: [0, 0], b: [0.1, 0] },
  ] }] }), []);
  assert.deepEqual(checkWallKeys(null), []);
});

test('копия wallKey в скрипте совпадает с продуктовой (#259)', () => {
  // Скрипт не импортирует src/**: он читает сырой JSON без сборки. Формулу
  // приходится дублировать, а дубль величины — тот самый дефект, который проект
  // ловил трижды. Поэтому копия прикреплена к настоящей здесь.
  assert.equal(GRID_STEP_N, 1 / 240, 'решётка изменилась — копия ключа устарела');
  const nodes = [0, 1, 2, 3, 7, 47, 48, 71, 83, 107, 120, 239, 240];
  let checked = 0;
  for (const i of nodes) {
    for (const j of nodes) {
      for (const [dx, dy] of [[0, 1], [1, 0], [1, 1], [1, 2], [3, 1], [0, -1], [-2, 1]]) {
        const a = [i / 240, j / 240];
        const b = [(i + dx) / 240, (j + dy) / 240];
        assert.equal(wallKey(a, b), productWallKey(a, b, GRID_STEP_N),
          `копия разошлась с продуктовой на ${JSON.stringify([a, b])}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500, `сверено ${checked} отрезков: набор подозрительно мал`);
  // Вырожденный отрезок и ничья округления — там, где формулы расходятся первыми.
  for (const [a, b] of [
    [[0.5, 0.5], [0.5, 0.5]],
    [[0.8875, 0.05], [0.8875, 0.345833333]],
    [[0.979166667, 0.345833333], [0.979166667, 0.55]],
    [[0, 0], [1 / 240, 0]],
  ]) {
    assert.equal(wallKey(a, b), productWallKey(a, b, GRID_STEP_N),
      `копия разошлась на особом случае ${JSON.stringify([a, b])}`);
  }
});

test('latticePoint даёт точный узел, а не почти узел (#259)', () => {
  // Делением на шаг вместо индекса узла 83/240 превращается в значение, которое
  // отличается в последних битах — а весь инвариант живёт именно там.
  const [, y] = latticePoint([0, 0.345833333]);
  assert.equal(y, 83 / 240);
  assert.equal(latticePoint([0.05, 0.55])[1], 132 / 240);
  assert.deepEqual(latticePoint([-1.670833333, -0.208333333]), [-401 / 240, -50 / 240]);
});

test('детектор ключей умеет падать (#259)', () => {
  // Проверка на проверку: инвариант, который не может сработать, бесполезен.
  const good = KEYED('0.050000,0.050000@0.0000', 20, [0, 0.05], [0.1, 0.05]).config;
  assert.deepEqual(checkWallKeys(good), []);
  const broken = JSON.parse(JSON.stringify(good));
  broken.spaces[0].walls[0].key = '0.050000,0.054167@0.0000';
  assert.equal(checkWallKeys(broken).length, 1);
});
