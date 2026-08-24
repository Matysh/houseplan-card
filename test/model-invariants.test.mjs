import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkMixedRoleRecords, checkReferences, checkWallKeys, checkWallRecordsPreserved,
  keyMidpoint, latticeProfile, readModel, wallKey,
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

    // Compatibility-key debt remains visible as notes, while exact `a/b`
    // proves every shipped record resolvable before midpoint parsing.
    const notes = [];
    const keys = checkWallKeys(fixture.config, { notes });
    assert.deepEqual(keys, [], `${label}: exact wall entry declared unresolvable`);
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
// #258/#259. После строгого same-span resolver валидные exact endpoints
// доказывают, что запись найдётся независимо от старого compatibility key.
// Несовпадение остаётся наблюдением для явного Optimize, но не нарушением.

const KEYED = (key, cm, a, b) => ({
  spaces: [{ id: 'sp1', cell_cm: 5, rooms: [], walls: [{ key, cm, a, b }] }],
});

test('#258: старый и неразбираемый compatibility key — наблюдение по exact endpoints', () => {
  for (const [key, cm, a, b] of [
    ['0.887500,0.195833@1.5706', 29, [0.8875, 0.05], [0.8875, 0.345833333]],
    ['0.979167,0.445833@1.5706', 28, [0.979166667, 0.345833333], [0.979166667, 0.55]],
    ['perf-wall-0-3', 15, [0.1, 0.1], [0.5, 0.1]],
    ['0.300000,0.108333@0.0000', 15, [0.1, 0.1], [0.5, 0.1]],
  ]) {
    const notes = [];
    assert.deepEqual(checkWallKeys(KEYED(key, cm, a, b), { notes }), [],
      'exact endpoints make the record resolvable before legacy key fallback');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].kind, 'stale_wall_key');
    assert.match(notes[0].detail, /точной паре endpoints/);
  }
});

test('#258: ключ, равный ключу своего ребра, не даёт даже наблюдения', () => {
  const notes = [];
  assert.deepEqual(checkWallKeys(KEYED(
    '0.887500,0.200000@1.5706', 29, [0.8875, 0.05], [0.8875, 0.345833333],
  ), { notes }), []);
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

test('near-grid key normalization removes last-bit grading (#258, #259)', () => {
  // Four records from the owner's second space differ only in nine-decimal
  // endpoint representation. Stable wallKey makes all four canonical directly;
  // neither a violation nor a stale-key observation is left to grade by bits.
  const walls = [
    ['-0.637500,-0.208333@0.0000', 30, [-1.670833333, -0.208333333], [0.4, -0.208333333]],
    ['-0.637500,1.266667@0.0000', 20, [0.4, 1.266666667], [-1.670833333, 1.266666667]],
    ['0.354167,2.287500@0.0000', 20, [-0.354166667, 2.2875], [1.058333333, 2.2875]],
    ['0.354167,3.866667@0.0000', 30, [1.058333333, 3.866666667], [-0.354166667, 3.866666667]],
  ].map(([key, cm, a, b]) => ({ key, cm, a, b }));
  const notes = [];
  assert.deepEqual(checkWallKeys({ spaces: [{ id: 'sp2', cell_cm: 1, walls }] }, { notes }), []);
  assert.deepEqual(notes, []);
});

// ------------------- стадия 0 ADR #282: профиль решётки ----------------------
// Мера, а не приговор. Нарушений здесь не бывает по построению: авторская
// координата вне сетки законна, а «шум» — это отдельное население, из которого
// растут #258, #279 и несходящийся Optimize.

const oneRoom = (poly) => ({
  config: { spaces: [{ id: 'sp1', cell_cm: 5, rooms: [{ id: 'r1', poly }] }] },
  layout: {},
});

test('профиль различает узел, шум и законную геометрию вне сетки (#282)', () => {
  // 83/240 выбрано не случайно: это та самая вершина с дачи владельца. В
  // двоичном виде она 0.34583333333333333, в хранилище лежит как 0.345833333 —
  // и эти 8e-8 шага перебросили ключ стены в соседний бакет в #258. Узел вида
  // 24/240 = 0.1 для примера не годится: он выживает округление до девяти
  // знаков без изменений, и «шума» на нём не получить.
  const node = 83 / 240;
  const noise = Number((83 / 240).toFixed(9));
  assert.notEqual(node, noise, 'выбранный узел обязан терять точность при записи');
  const offGrid = 0.06;                  // 14.4 шага от узла — авторская координата
  const profile = latticeProfile(oneRoom([[node, node], [noise, noise], [offGrid, offGrid]]));
  assert.equal(profile.total, 6);
  assert.equal(profile.exact, 2, 'узел обязан считаться точным');
  assert.equal(profile.noise, 2, '9 знаков от того же узла — это шум, а не узел');
  assert.equal(profile.offGrid, 2, '0.06 — законная геометрия, а не дефект');
  assert.equal(profile.worstNoise.kind, 'room');
  assert.ok(profile.worstNoise.steps > 0 && profile.worstNoise.steps < profile.noiseSteps);
});

test('профиль видит все виды объектов, а не только комнаты (#282)', () => {
  const off = 0.0605;
  const profile = latticeProfile({
    config: { spaces: [{
      id: 'sp1',
      rooms: [{ id: 'r1', poly: [[off, off]] }],
      partitions: [{ id: 'p1', a: [off, off], b: [off, off] }],
      walls: [{ key: 'k', cm: 20, a: [off, off], b: [off, off] }],
      open_spans: [{ id: 's1', a: [off, off], b: [off, off] }],
      wall_columns: [{ id: 'c1', center: [off, off] }],
    }] },
    layout: { m1: { s: 'sp1', x: off, y: off } },
  });
  assert.deepEqual(Object.keys(profile.byKind).sort(),
    ['column', 'layout', 'open_span', 'partition', 'room', 'wall']);
  assert.equal(profile.total, 18);
});

test('модели проекта не несут шума решётки (#282)', async () => {
  // Свойство, которое стоит знать про себя: тестовые данные проекта чисты —
  // весь их офф-грид авторский. Значит воспроизвести на них #258/#279 нельзя
  // по построению, а на реальном плане владельца шум составляет две трети
  // координат. Именно поэтому этот класс дефектов находит владелец, а не гейт.
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
  assert.ok(models.length >= 3);
  for (const [label, fixture] of models) {
    const profile = latticeProfile({ config: fixture.config, layout: fixture.layout || {} });
    assert.equal(profile.noise, 0,
      `${label}: в тестовых данных появился шум решётки`
      + `${profile.worstNoise ? ` — ${profile.worstNoise.owner}` : ''}`);
  }
});

// ------------------ реальные планы как фикстуры (#285, #286) -----------------
// Синтетика не воспроизводит два класса сразу: координатный шум и конфигурации
// живого плана. Здесь закреплены свойства, ради которых эти фикстуры и лежат в
// репозитории. Если кто-то «почистит» их координаты, фикстуры потеряют смысл —
// и тест скажет об этом раньше, чем это выяснится через месяц.

const REAL_PLANS = [
  { file: 'real-plan-first-floor.json', minNoise: 100, zeroThicknessSolidEdges: 2 },
  { file: 'real-plan-second-floor.json', minNoise: 100, zeroThicknessSolidEdges: 0 },
];

test('реальные планы сохраняют координатный шум, ради которого их взяли (#286)', () => {
  for (const plan of REAL_PLANS) {
    const { space } = JSON.parse(
      readFileSync(resolve(repoRoot, 'test/fixtures', plan.file), 'utf8'));
    const profile = latticeProfile({ config: { spaces: [space] }, layout: {} });
    assert.ok(profile.noise >= plan.minNoise,
      `${plan.file}: шума ${profile.noise}, ожидалось не меньше ${plan.minNoise} —`
      + ' фикстура канонизирована и больше не воспроизводит свой класс дефектов');
    assert.equal(checkWallKeys({ spaces: [space] }, { notes: [] }).length, 0,
      `${plan.file}: запись толщины объявлена неразрешимой`);
  }
});

test('реальные планы: сплошные рёбра без записи толщины закреплены числом (#286)', async () => {
  // Ребро, объявленное сплошным, но с нулевой толщиной, рисуется без кладки.
  // На первом этаже таких два, длиной по 2 шага, и соседние тела их накрывают —
  // поэтому браузерный смок разрывов не видит. Число закреплено здесь: станет
  // больше или короче накрытие — увидим до того, как это станет дыркой.
  const { spaceModels, GRID_STEP_N, GRID_PITCH, NORM_W } =
    await import('../test-build/space-geometry.js');
  const { wallIntervals } = await import('../test-build/wall-thickness.js');
  const { resolveOpenCuts } = await import('../test-build/open-spans.js');
  for (const plan of REAL_PLANS) {
    const { space } = JSON.parse(
      readFileSync(resolve(repoRoot, 'test/fixtures', plan.file), 'utf8'));
    const model = spaceModels({ spaces: [space], markers: [], settings: {} })[0];
    const cuts = resolveOpenCuts(
      model.rooms, space.open_spans ?? null, NORM_W, GRID_PITCH * 0.02, true);
    const intervals = wallIntervals(
      model.rooms, space.walls, cuts, GRID_STEP_N,
      space.cell_cm || 5, GRID_PITCH, NORM_W);
    const zero = intervals.filter((item) => item.kind && !(item.cm > 0));
    assert.equal(zero.length, plan.zeroThicknessSolidEdges,
      `${plan.file}: сплошных рёбер без толщины ${zero.length},`
      + ` ожидалось ${plan.zeroThicknessSolidEdges}`);
  }
});

// ------- инвариант 4: запись толщины не смешивает общее и наружное (#287) ----
// Воспроизведение дефекта владельца из `66.json`: ресайз сдвинул одну комнату
// общей пары, вторая осталась, и нижняя часть стены перестала быть общей —
// но продолжает нести толщину бывшей общей границы.

const pair = (leftPoly, wall) => ({
  spaces: [{
    id: 'sp', cell_cm: 1,
    rooms: [
      { id: 'left', poly: leftPoly },
      { id: 'right', poly: [[1, 0], [2, 0], [2, 1], [1, 1]] },
    ],
    walls: [wall],
  }],
});

test('#287: до ресайза общая стена нарушением не считается', () => {
  assert.deepEqual(checkMixedRoleRecords(pair(
    [[0, 0], [1, 0], [1, 1], [0, 1]], { key: 'k', cm: 20, a: [1, 0], b: [1, 1] },
  )), []);
});

test('#287: после частичного ресайза запись описывает и общее, и наружное', () => {
  const found = checkMixedRoleRecords(pair(
    [[0, 0], [1, 0], [1, 1.2], [0, 1.2]], { key: 'k2', cm: 20, a: [1, 0], b: [1, 1.2] },
  ));
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'mixed_role_record');
  assert.match(found[0].detail, /частью общий, частью наружный/);
  assert.match(found[0].detail, /наружного/);
});

test('#287: наружный угол одной комнаты — не общая граница', () => {
  // Считать надо РАЗНЫЕ комнаты, а не рёбра: в углу точка лежит сразу на двух
  // рёбрах одной комнаты. Подсчёт рёбер давал ложное срабатывание на каждой
  // наружной стене.
  assert.deepEqual(checkMixedRoleRecords({
    spaces: [{
      id: 'sp', cell_cm: 1,
      rooms: [{ id: 'only', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
      walls: [{ key: 'k', cm: 30, a: [0, 0], b: [1, 0] }],
    }],
  }), []);
});

test('#287: наружная стена, упирающаяся в общую, нарушением не считается', () => {
  // Конец записи — это узел, а не участок: там стена законно касается рёбер
  // двух комнат. Включение концов в выборку давало «95% наружного» на каждой
  // такой стене, то есть ложное срабатывание на ровном месте.
  const found = checkMixedRoleRecords({
    spaces: [{
      id: 'sp', cell_cm: 1,
      rooms: [
        { id: 'left', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        { id: 'right', poly: [[1, 0], [2, 0], [2, 1], [1, 1]] },
      ],
      // наружная стена левой комнаты, оба конца упираются в общую границу x=1
      walls: [{ key: 'outer', cm: 30, a: [0, 0], b: [1, 0] }],
    }],
  });
  assert.deepEqual(found, []);
});

test('#287: реальные планы проекта эту проверку проходят', () => {
  for (const file of ['real-plan-first-floor.json', 'real-plan-second-floor.json']) {
    const { space } = JSON.parse(
      readFileSync(resolve(repoRoot, 'test/fixtures', file), 'utf8'));
    assert.deepEqual(checkMixedRoleRecords({ spaces: [space] }), [],
      `${file}: ложное срабатывание на реальном плане`);
  }
});
