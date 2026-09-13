// Геометрический regression-корпус пользовательских планов (#560).
//
// Зачем он отдельно от 246 смоков и сотни модельных тестов. Каждый прежний
// тест ставит одно условие и проверяет одно следствие. Полевой план так не
// живёт: в нём короткие рёбра, T-узлы, пять разных толщин в одном
// пространстве, проём, упирающийся в вершину, и шум у узлов — одновременно, и
// проходит он не одну операцию, а цепочку import → Optimize → Optimize →
// Resize → save/reload → export. Ломается согласованность как раз на стыках
// (#253, #244, #252, #258), и ловил их до сих пор человек глазами.
//
// Оракулы здесь ЧИСЛЕННЫЕ и не зависят от рендера: инварианты модели,
// сходимость Optimize к фикс-пойнту, сохранность записей толщины, равенство
// после сериализации. Это прямое требование приёмки #560: корпус не имеет
// права принимать текущий рендер за эталон, иначе он узаконит любой регресс,
// который рендер отрисовал «похоже».
//
// Профиль поля, по которому подобраны условия (прочитан 13.09.2026 на
// установке владельца, только чтение, модель v10, rev 2740): 5 пространств,
// 37 комнат, 121 запись толщины, 35 проёмов, 7 перегородок, 156 маркеров;
// толщины по пространствам 20/22/28/29/33, 20/30/40, 4/15/17/33, 10/15;
// минимальное ребро комнаты 5 см при шаге сетки 1 см и 10 см при шаге 5 см;
// T-узлов 7/6/3/2 по пространствам, X-узлов НИ ОДНОГО; координат 1010, из них
// 23 с шумом ближе 1e-4 шага; почти осевых стен 0; один проём, чей край лежит
// ровно в вершине комнаты; в layout четыре записи на два УДАЛЁННЫХ
// пространства. Сама геометрия владельца в репозиторий не попадает: фикстуры
// синтетические и воспроизводят названные условия числами, а не планом дома.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import { applySafeResize, clampSafeResize, resolveSafeResize } from '../test-build/resize.js';
import { GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { thicknessCmAt, wallCmToUnits } from '../test-build/wall-thickness.js';
import { classifyNearAxisSegment } from '../test-build/near-axis.js';
import {
  checkReferences, checkWallKeys, checkMixedRoleRecords, checkHiddenObstacles,
  checkPhysicalGeometry, checkWallRecordsPreserved, latticeProfile, wallKey,
} from '../scripts/model-invariants.mjs';

const STEP = 1 / 240;                 // шаг решётки в нормированных единицах
const clone = (value) => structuredClone(value);

const load = (name) => {
  const raw = JSON.parse(readFileSync(
    new URL(`./fixtures/560-corpus/${name}.json`, import.meta.url), 'utf8',
  ));
  return { config: raw.config ?? raw, layout: raw.layout ?? {} };
};

/** Все нарушения инвариантов одним списком — тот же набор, что у CLI (#254). */
const violations = (config, layout = {}) => [
  ...checkReferences({ config, layout }),
  ...checkWallKeys(config),
  ...checkMixedRoleRecords(config),
  ...checkHiddenObstacles(config),
  ...checkPhysicalGeometry(config),
];

const kinds = (list) => list.map((item) => `${item.invariant}/${item.kind}`).sort();

/** Степени узлов: сколько рёбер комнат приходит в каждую точку. */
function nodeDegrees(space) {
  const degree = new Map();
  for (const room of space.rooms || []) {
    for (const point of room.poly || []) {
      const key = `${point[0].toFixed(9)},${point[1].toFixed(9)}`;
      degree.set(key, (degree.get(key) || 0) + 1);
    }
  }
  return degree;
}

/** Длины рёбер комнат в шагах решётки. */
function edgeSteps(space) {
  const out = [];
  for (const room of space.rooms || []) {
    const poly = room.poly || [];
    for (let index = 0; index < poly.length; index++) {
      const a = poly[index];
      const b = poly[(index + 1) % poly.length];
      out.push(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP);
    }
  }
  return out;
}

/** Точки проёма: центр ± половина длины по его углу (angle в градусах). */
function openingEnds(opening) {
  const radians = (opening.angle || 0) * Math.PI / 180;
  const half = (opening.length || 0) / 2;
  const dx = Math.cos(radians) * half;
  const dy = Math.sin(radians) * half;
  return [[opening.x - dx, opening.y - dy], [opening.x + dx, opening.y + dy]];
}

const roomVertices = (space) => (space.rooms || []).flatMap((room) => room.poly || []);

const near = (a, b, eps = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1]) < eps;

/** Вход Resize в единицах NORM_W — та же подготовка, что у #281. */
const resizeInputs = (space) => ({
  rooms: (space.rooms || []).map((room) => ({
    id: room.id, poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
  })),
  openings: (space.openings || []).map((opening) => ({
    id: opening.id,
    x: opening.x * NORM_W,
    y: opening.y * NORM_W,
    length: opening.length * NORM_W,
    angle: opening.angle,
    hosted: !!opening.host,
  })),
  obstacles: (space.partitions || []).map((partition) => ({
    kind: 'segment',
    a: partition.a.map((value) => value * NORM_W),
    b: partition.b.map((value) => value * NORM_W),
    half: wallCmToUnits(partition.cm, space.cell_cm, GRID_PITCH) / 2,
  })),
});

const resizeOptions = (space, inputs, cm) => ({
  minDim: wallCmToUnits(30, space.cell_cm, GRID_PITCH),
  eps: GRID_PITCH * 0.05,
  step: GRID_PITCH,
  movingHalf: wallCmToUnits(cm, space.cell_cm, GRID_PITCH) / 2,
  obstacles: inputs.obstacles,
});

/**
 * Первая подвижная ручка ресайза на плане: комната, ребро, разрешённый шаг.
 * Нужна именно подвижная — «включена, но ход нулевой» уже было дефектом #281.
 */
function firstMovableHandle(space) {
  const inputs = resizeInputs(space);
  for (const room of inputs.rooms) {
    for (let edge = 0; edge < room.poly.length; edge++) {
      const a = room.poly[edge];
      const b = room.poly[(edge + 1) % room.poly.length];
      const cm = thicknessCmAt(space.walls, a, b, STEP, NORM_W) || 15;
      const options = resizeOptions(space, inputs, cm);
      const resolution = resolveSafeResize(inputs.rooms, inputs.openings, room.id, edge, options);
      if (!resolution.enabled) continue;
      const outward = clampSafeResize(
        inputs.rooms, inputs.openings, resolution.plan, GRID_PITCH, GRID_PITCH, options,
      );
      if (!outward) continue;
      return { inputs, options, plan: resolution.plan, room: room.id, edge, d: outward };
    }
  }
  return null;
}

/** Записать результат ресайза обратно в конфиг (единицы NORM_W → нормированные). */
function writeResize(space, moved) {
  const next = clone(space);
  for (const room of next.rooms || []) {
    const poly = moved.polys[room.id];
    if (poly) room.poly = poly.map(([x, y]) => [x / NORM_W, y / NORM_W]);
  }
  for (const opening of next.openings || []) {
    const point = moved.openings[opening.id];
    if (point) { opening.x = point[0] / NORM_W; opening.y = point[1] / NORM_W; }
  }
  return next;
}

/**
 * Корпус. `condition` проверяется отдельным тестом: фикстура, потерявшая своё
 * условие, — это зелёный прогон, который ничего не проверяет, и такой тихий
 * успех в этом проекте уже дважды стоил дня (#171, #207).
 */
const CORPUS = [
  {
    file: 'c1-short-edges',
    what: 'короткие рёбра: уступ в два шага (10 см при шаге 5 см)',
    field: 'минимальное ребро комнаты в поле — 2 шага на первом этаже, 5 см на втором',
    fixedPointOnImport: true,
    condition(space) {
      const short = edgeSteps(space).filter((steps) => steps <= 2.001);
      assert.ok(short.length >= 2, `коротких рёбер ${short.length}, нужно ≥2`);
    },
  },
  {
    file: 'c2-t-junction-thicknesses',
    what: 'T-узел, в котором сходятся записи трёх разных толщин',
    field: 'в поле 7 T-узлов и пять толщин (20/22/28/29/33) в одном пространстве',
    fixedPointOnImport: true,
    condition(space) {
      const tee = [...nodeDegrees(space).entries()].filter(([, degree]) => degree >= 3);
      assert.ok(tee.length >= 1, 'T-узла нет');
      const thicknesses = new Set((space.walls || []).map((wall) => wall.cm));
      assert.ok(thicknesses.size >= 3, `толщин ${thicknesses.size}, нужно ≥3`);
    },
  },
  {
    file: 'c3-x-junction',
    what: 'X-узел: четыре комнаты в одной точке',
    field: 'в поле X-узлов НЕТ НИ ОДНОГО — это рискованный сосед, не наблюдение',
    synthetic: true,
    fixedPointOnImport: true,
    condition(space) {
      const cross = [...nodeDegrees(space).values()].filter((degree) => degree >= 4);
      assert.ok(cross.length >= 1, 'узла степени 4 нет');
    },
  },
  {
    file: 'c4-opening-at-vertex',
    what: 'проём, чей край лежит ровно в вершине комнаты',
    field: 'в поле один такой проём',
    fixedPointOnImport: true,
    condition(space) {
      const vertices = roomVertices(space);
      const touching = (space.openings || []).filter((opening) => openingEnds(opening)
        .some((end) => vertices.some((vertex) => near(vertex, end, STEP * 1e-3))));
      assert.equal(touching.length, 1, 'проём должен упираться краем в вершину');
      assert.ok(touching[0].host?.kind === 'wall' && touching[0].host.id,
        'проём должен быть подвешен на сегмент стены');
    },
  },
  {
    file: 'c5-node-noise-near-axis',
    what: 'шум у узла плюс честно наклонная стена',
    field: 'в поле 23 координаты из 1010 лежат ближе 1e-4 шага от узла',
    fixedPointOnImport: false,   // именно шум Optimize и снимает
    condition(space) {
      assert.ok(latticeProfile({ config: { spaces: [space] } }).noise >= 1, 'шума у узла нет');
      const slanted = (space.rooms || []).some((room) => {
        const poly = room.poly || [];
        return poly.some((a, index) => {
          const b = poly[(index + 1) % poly.length];
          const dx = Math.abs(b[0] - a[0]);
          const dy = Math.abs(b[1] - a[1]);
          return dx > STEP && dy > STEP * 0.5 && dy < dx;   // наклон, но не осевой
        });
      });
      assert.ok(slanted, 'наклонной стены нет');
    },
  },
  {
    file: 'c6-stale-layout',
    what: 'записи layout на пространство, которого в конфиге больше нет',
    field: 'в поле четыре такие записи на два удалённых пространства',
    fixedPointOnImport: false,
    expectedViolations: ['references/layout_space', 'references/layout_space'],
    condition(space, layout) {
      const known = new Set([space.id]);
      const orphans = Object.values(layout).filter((entry) => !known.has(entry.s));
      assert.equal(orphans.length, 2, 'осиротевших записей layout должно быть две');
    },
  },
];

for (const item of CORPUS) {
  const label = `${item.file}${item.synthetic ? ' (синтетический)' : ''}`;

  test(`корпус #560 ${label}: фикстура несёт своё условие — ${item.what}`, () => {
    const { config, layout } = load(item.file);
    assert.equal(config.model_version, 10, 'корпус ведётся на актуальной модели');
    item.condition(config.spaces[0], layout);
  });

  test(`корпус #560 ${label}: импорт → Optimize → Optimize`, () => {
    const { config, layout } = load(item.file);
    const expected = item.expectedViolations ?? [];
    assert.deepEqual(kinds(violations(config, layout)), expected.slice().sort(),
      'импорт: инварианты');

    const guard = clone(config);
    const first = optimizePlans(config, layout);
    assert.deepEqual(config, guard, 'Optimize не имеет права менять вход (#281)');
    assert.deepEqual(kinds(violations(first.config, first.layout)), expected.slice().sort(),
      'после Optimize новых нарушений нет');
    assert.equal(first.changed, item.fixedPointOnImport ? false : true,
      item.fixedPointOnImport
        ? 'приведённый план Optimize трогать не должен'
        : 'фикстура заявлена как требующая приведения');

    const second = optimizePlans(clone(first.config), clone(first.layout));
    assert.equal(second.changed, false, 'второй Optimize — фикс-пойнт (#477)');
    assert.deepEqual(second.config, first.config, 'второй Optimize ничего не двигает');

    // Записи толщины — отдельный оракул: именно их теряли #253 и #258.
    assert.deepEqual(
      checkWallRecordsPreserved(config.spaces[0].walls, first.config.spaces[0].walls),
      [], 'Optimize сохранил записи толщины',
    );
  });

  /**
   * Граница этой проверки названа прямо: перенос ЗАПИСЕЙ ТОЛЩИНЫ вслед за
   * сдвинутым ребром делает не `resize.ts`, а хост карточки — `project()` в
   * `ResizeController.move` возвращает `afterWalls`, и чистой функции для этого
   * в модуле нет. Поэтому здесь проверяется то, что проверяемо без карточки:
   * ручка действительно подвижна, геометрия после сдвига согласована, записи
   * толщины целы, и Optimize сходится за ограниченное число проходов. Полный
   * путь со штатным writer'ом проверяет браузерный смок корпуса.
   */
  test(`корпус #560 ${label}: Resize ребра сохраняет согласованность`, (t) => {
    const { config, layout } = load(item.file);
    const optimized = optimizePlans(clone(config), clone(layout));
    const space = optimized.config.spaces[0];
    const handle = firstMovableHandle(space);
    if (!handle) return t.skip('подвижной ручки ресайза на этом плане нет');

    const moved = applySafeResize(handle.inputs.rooms, handle.inputs.openings, handle.plan, handle.d);
    const resized = clone(optimized.config);
    resized.spaces[0] = writeResize(space, moved);

    const after = optimizePlans(clone(resized), clone(optimized.layout));
    const expected = item.expectedViolations ?? [];
    assert.deepEqual(kinds(violations(after.config, after.layout)), expected.slice().sort(),
      'после Resize и Optimize новых нарушений нет');
    assert.deepEqual(
      checkWallRecordsPreserved(space.walls, after.config.spaces[0].walls),
      [], 'ресайз не потерял ни одной толщины (#253)',
    );
    // Сходимость, а не «один проход»: вход здесь — рёбра сдвинуты, а записи
    // толщины остались на прежних координатах, потому что их переносит хост.
    // Из такого состояния Optimize имеет право убирать остатки в два приёма;
    // важно, что он ОСТАНАВЛИВАЕТСЯ, а не переписывает план бесконечно.
    let passes = 0;
    let current = after;
    while (current.changed && passes < 5) {
      current = optimizePlans(clone(current.config), clone(current.layout));
      passes += 1;
    }
    assert.equal(current.changed, false, `Optimize не сошёлся за ${passes} проходов`);
    assert.ok(passes <= 2, `после Resize Optimize сходится за ${passes} проходов, ожидалось ≤2`);
    assert.deepEqual(kinds(violations(current.config, current.layout)), expected.slice().sort(),
      'сошедшийся план согласован');
  });

  test(`корпус #560 ${label}: сохранение и перечитывание плана`, () => {
    const { config, layout } = load(item.file);
    const optimized = optimizePlans(clone(config), clone(layout));
    const reloaded = JSON.parse(JSON.stringify(optimized.config));
    assert.deepEqual(reloaded, optimized.config, 'план переживает сериализацию без потерь');
    const again = optimizePlans(reloaded, JSON.parse(JSON.stringify(optimized.layout)));
    assert.equal(again.changed, false, 'перечитанный план не требует приведения');
  });
}

test('корпус #560: ключи записей толщины канонические', () => {
  for (const item of CORPUS) {
    const { config } = load(item.file);
    if (!item.fixedPointOnImport) continue;   // c5/c6 приводит сам Optimize
    for (const wall of config.spaces[0].walls || []) {
      assert.equal(wall.key, wallKey(wall.a, wall.b),
        `${item.file}: ключ записи разошёлся с координатами`);
    }
  }
});

test('корпус #560: наклонная стена не считается почти осевой', () => {
  // Прямая проверка приёмки «корректная планировка не исправляется ради
  // удобства рендера»: честный наклон 1 шаг на 60 не должен попадать в класс,
  // который Optimize канонизирует. Шум у узла — попадает, и это правильно.
  const { config } = load('c5-node-noise-near-axis');
  const slanted = config.spaces[0].rooms.find((room) => room.id === 'c5-r2');
  const [a, b] = [slanted.poly[0], slanted.poly[1]];
  assert.equal(classifyNearAxisSegment(a, b), null, 'наклон не классифицируется как почти осевой');
  const optimized = optimizePlans(clone(config), {});
  const after = optimized.config.spaces[0].rooms.find((room) => room.id === 'c5-r2');
  assert.deepEqual(after.poly[0], a, 'Optimize не выпрямил наклонную стену');
  assert.deepEqual(after.poly[1], b, 'Optimize не выпрямил наклонную стену');
});
