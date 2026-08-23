import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkReferences, checkWallKeys, checkWallRecordsPreserved, keyMidpoint,
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
 * `large-house` пишет метки вида `perf-wall-0-3`. Они не разбираются как
 * координаты, поэтому их не находит ни точное совпадение, ни терпимый запас:
 * измерено продуктовым `wallIntervals` — все 80 сплошных рёбер фикстуры
 * остаются с нулевой толщиной и тел стен не возникает вовсе. Это вход и
 * golden (4 сцены), и всех шести перф-бюджетов, поэтому правка требует
 * переприёмки эталонов — решение владельца, а не правка по ходу.
 *
 * `visual-matrix` в этот список не входит: её ключи с четырьмя знаками вместо
 * шести расходятся в пределах запаса, продукт их находит, и проверка выдаёт по
 * ним наблюдения, а не нарушения.
 */
const KEY_CONTRACT_DEBT = new Map([
  ['large-house.mjs:makeLargeHouseFixture', 147],
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
    const keys = checkWallKeys(fixture.config, { notes: [] });
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
// #258/#259. Числа ниже не придуманы: это записи из экспортов владельца.
//
// Главное, что здесь закреплено, — ГРАДАЦИЯ. Первая редакция проверки считала
// сдвиг ключа на шаг решётки нарушением и сверяла ключ с концами, приведёнными
// к узлам. И то и другое неверно: продукт ключует от координат как они лежат в
// конфигурации (проверено `wallIntervals`: для спорного ребра ключ запроса
// `0.887500,0.195833@1.5706`), а запись, ушедшую на полшага, он НАХОДИТ —
// два конфига владельца, различающиеся ровно такими ключами, дают побайтово
// одинаковые тела стен.

const KEYED = (key, cm, a, b) => ({
  spaces: [{ id: 'sp1', cell_cm: 5, rooms: [], walls: [{ key, cm, a, b }] }],
});

test('#258: ключ, ушедший на шаг решётки, — наблюдение, а не нарушение', () => {
  for (const [key, cm, a, b] of [
    ['0.887500,0.200000@1.5706', 29, [0.8875, 0.05], [0.8875, 0.345833333]],
    ['0.979167,0.450000@1.5706', 28, [0.979166667, 0.345833333], [0.979166667, 0.55]],
  ]) {
    const notes = [];
    assert.deepEqual(checkWallKeys(KEYED(key, cm, a, b), { notes }), [],
      'проверка, красящая план, который рисуется верно, отключается первой');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].kind, 'stale_wall_key');
    // Граница названа прямо: попадание у продукта решает шум в последних битах.
    assert.match(notes[0].detail, /ровно на его границе/);
  }
});

test('#258: ключ, равный ключу своего ребра, не даёт даже наблюдения', () => {
  const notes = [];
  assert.deepEqual(checkWallKeys(KEYED(
    '0.887500,0.195833@1.5706', 29, [0.8875, 0.05], [0.8875, 0.345833333],
  ), { notes }), []);
  assert.deepEqual(notes, []);
});

test('#260: ключ, который не разбирается как координаты, — нарушение', () => {
  const notes = [];
  const found = checkWallKeys(
    KEYED('perf-wall-0-3', 15, [0.1, 0.1], [0.5, 0.1]), { notes },
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'wall_key');
  assert.equal(found[0].reference, '0.300000,0.100000@0.0000');
  assert.match(found[0].detail, /не разбирается как координаты/);
  assert.deepEqual(notes, [], 'нарушение не дублируется наблюдением');
});

test('ключ, ушедший дальше терпимого запаса, — нарушение', () => {
  // Два шага вместо полшага: столько запас не покрывает ни при каком округлении.
  const notes = [];
  const found = checkWallKeys(
    KEYED('0.300000,0.108333@0.0000', 15, [0.1, 0.1], [0.5, 0.1]), { notes },
  );
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /2\.00 шага/);
  assert.deepEqual(notes, []);
});

test('запись без концов ключевую проверку не роняет', () => {
  // Совместимость: у старых записей есть только ключ. Сверять не с чем, и это
  // не повод объявлять их сломанными.
  const notes = [];
  assert.deepEqual(checkWallKeys({
    spaces: [{ id: 'sp1', walls: [{ key: 'legacy', cm: 15 }, { cm: 20 }] }],
  }, { notes }), []);
  assert.deepEqual(checkWallKeys({ spaces: [{ id: 'sp1', walls: [
    { key: '', cm: 15, a: [0, 0], b: [0.1, 0] },
    { key: 42, cm: 15, a: [0, 0], b: [0.1, 0] },
  ] }] }, { notes }), []);
  assert.deepEqual(checkWallKeys(null), []);
  assert.deepEqual(notes, []);
});

test('keyMidpoint читает координаты ключа и отвергает метку (#259)', () => {
  assert.deepEqual(keyMidpoint('0.887500,0.200000@1.5706'), [0.8875, 0.2]);
  assert.deepEqual(keyMidpoint('-0.637500,-0.208333@0.0000'), [-0.6375, -0.208333]);
  for (const bad of ['perf-wall-0-3', 'legacy', '', null, undefined, 'a,b@c', '1,2']) {
    assert.equal(keyMidpoint(bad), null, `разобрано то, что не должно: ${bad}`);
  }
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
  // Вырожденный отрезок, ничья округления и координаты не с решётки — там, где
  // формулы расходятся первыми.
  for (const [a, b] of [
    [[0.5, 0.5], [0.5, 0.5]],
    [[0.8875, 0.05], [0.8875, 0.345833333]],
    [[0.979166667, 0.345833333], [0.979166667, 0.55]],
    [[0.06, 0.08], [0.48, 0.08]],
    [[-1.670833333, -0.208333333], [0.4, -0.208333333]],
    [[0, 0], [1 / 240, 0]],
  ]) {
    assert.equal(wallKey(a, b), productWallKey(a, b, GRID_STEP_N),
      `копия разошлась на особом случае ${JSON.stringify([a, b])}`);
  }
});

test('градация по шагам не решается последними битами (#259)', () => {
  // Четыре записи второго пространства владельца ушли на одни и те же полшага.
  // С относительным допуском 1e-6 две из них становились нарушением, две —
  // наблюдением: проверка повторяла ту самую ничью округления, которую должна
  // показывать. Все четыре обязаны попасть в один класс.
  const walls = [
    ['-0.637500,-0.208333@0.0000', 30, [-1.670833333, -0.208333333], [0.4, -0.208333333]],
    ['-0.637500,1.266667@0.0000', 20, [0.4, 1.266666667], [-1.670833333, 1.266666667]],
    ['0.354167,2.287500@0.0000', 20, [-0.354166667, 2.2875], [1.058333333, 2.2875]],
    ['0.354167,3.866667@0.0000', 30, [1.058333333, 3.866666667], [-0.354166667, 3.866666667]],
  ].map(([key, cm, a, b]) => ({ key, cm, a, b }));
  const notes = [];
  assert.deepEqual(checkWallKeys({ spaces: [{ id: 'sp2', cell_cm: 1, walls }] }, { notes }), []);
  assert.equal(notes.length, 4, 'все четыре — один класс, а не два');
});
