import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MAX_JUNCTION_VALENCE, MIN_JUNCTION_ANGLE_DEG, MIN_NODE_DISTANCE_CM,
  MIN_ROOM_CLEARANCE_CM2, MIN_SEGMENT_LENGTH_CM,
  checkNodeDistances, checkNodes, checkRoomClearance, checkSegmentLengths,
  cmToUnits, newViolations,
} from '../test-build/junction-limits.js';
import { GRID_STEP_N } from '../test-build/space-geometry.js';

// #329, решения владельца 2026-08-27. Пороги абсолютные: 15°, 6 стен,
// max(20 см, толщина), 5 см, 25 см². cell_cm на них не влияет.
const CELL = 5;
const PITCH = GRID_STEP_N;
const cm = (value) => cmToUnits(value, CELL, PITCH);

const rayAt = (degrees, lengthCm = 100) => {
  const radians = (degrees * Math.PI) / 180;
  return { a: [0, 0], b: [Math.cos(radians) * cm(lengthCm), Math.sin(radians) * cm(lengthCm)] };
};

test('П1: угол ниже 15° отклоняется, 15° и выше проходит', () => {
  assert.equal(MIN_JUNCTION_ANGLE_DEG, 15);
  const narrow = checkNodes([rayAt(0), rayAt(14)]);
  assert.equal(narrow.filter((item) => item.rule === 'angle').length, 1);
  assert.ok(Math.abs(narrow[0].actual - 14) < 1e-6);
  assert.deepEqual(checkNodes([rayAt(0), rayAt(15)]).filter((item) => item.rule === 'angle'), []);
  assert.deepEqual(checkNodes([rayAt(0), rayAt(16)]).filter((item) => item.rule === 'angle'), []);
  // Прямая стена, проходящая через узел, — это 180°, а не нарушение.
  assert.deepEqual(checkNodes([rayAt(0), rayAt(180)]).filter((item) => item.rule === 'angle'), []);
});

test('П2: шесть стен в узле проходят, седьмая — нет', () => {
  assert.equal(MAX_JUNCTION_VALENCE, 6);
  const six = [0, 60, 120, 180, 240, 300].map((degrees) => rayAt(degrees));
  assert.deepEqual(checkNodes(six).filter((item) => item.rule === 'valence'), []);
  const seven = [0, 51, 102, 154, 205, 257, 308].map((degrees) => rayAt(degrees));
  const valence = checkNodes(seven).filter((item) => item.rule === 'valence');
  assert.equal(valence.length, 1);
  assert.equal(valence[0].actual, 7);
});

test('П3: сегмент короче 20 см или короче собственной толщины отклоняется', () => {
  assert.equal(MIN_SEGMENT_LENGTH_CM, 20);
  const segment = (lengthCm, thicknessCm) => ({
    id: `s-${lengthCm}-${thicknessCm}`, a: [0, 0], b: [cm(lengthCm), 0], cm: thicknessCm,
  });
  assert.equal(checkSegmentLengths([segment(19, 15)], CELL, PITCH).length, 1);
  assert.deepEqual(checkSegmentLengths([segment(20, 15)], CELL, PITCH), []);
  // Длина 25 см при толщине 30 см — «квадрат», запрещено.
  const thick = checkSegmentLengths([segment(25, 30)], CELL, PITCH);
  assert.equal(thick.length, 1);
  assert.equal(thick[0].limit, 30);
  assert.deepEqual(checkSegmentLengths([segment(30, 30)], CELL, PITCH), []);
  // Нулевая стена (#306) держит общий минимум 20 см.
  assert.equal(checkSegmentLengths([segment(19, 0)], CELL, PITCH).length, 1);
  assert.deepEqual(checkSegmentLengths([segment(20, 0)], CELL, PITCH), []);
});

test('П4: почти совпадающие узлы и почти-касания отклоняются, T-стык — нет', () => {
  assert.equal(MIN_NODE_DISTANCE_CM, 5);
  const wall = { id: 'w', a: [0, 0], b: [cm(200), 0] };
  // Узел «почти касается» тела чужой стены: конец в 4 см над ней, вдали от
  // её концов — именно тот микро-зазор, который рождает атомы-пылинки.
  const near = { id: 'n', a: [cm(100), cm(4)], b: [cm(100), cm(200)] };
  const far = { id: 'f', a: [cm(100), cm(5)], b: [cm(100), cm(200)] };
  const nearNodes = { id: 'x', a: [cm(204), 0], b: [cm(204), cm(100)] };

  assert.ok(checkNodeDistances([wall, near], CELL, PITCH)
    .some((item) => item.rule === 'distance'));
  assert.deepEqual(checkNodeDistances([wall, far], CELL, PITCH), []);
  // Узел в 4 см от чужого узла.
  assert.ok(checkNodeDistances([wall, nearNodes], CELL, PITCH).length > 0);
  // T-стык: конец стены стоит ровно на чужой стене — законно.
  const tee = { id: 't', a: [cm(100), 0], b: [cm(100), cm(200)] };
  assert.deepEqual(checkNodeDistances([wall, tee], CELL, PITCH), []);
});

test('П5: просвет комнаты меньше 25 см² отклоняется (независимо от П1)', () => {
  assert.equal(MIN_ROOM_CLEARANCE_CM2, 25);
  const square = (sideCm) => [
    [0, 0], [cm(sideCm), 0], [cm(sideCm), cm(sideCm)], [0, cm(sideCm)],
  ];
  assert.deepEqual(checkRoomClearance('r', square(6), CELL, PITCH), []);
  const tight = checkRoomClearance('r', square(4), CELL, PITCH);
  assert.equal(tight.length, 1);
  assert.ok(tight[0].actual < 25);
  // Пустой/вырожденный контур — тоже нарушение просвета.
  assert.equal(checkRoomClearance('r', null, CELL, PITCH).length, 1);
  assert.equal(checkRoomClearance('r', [[0, 0], [cm(50), 0]], CELL, PITCH).length, 1);
});

test('унаследованные нарушения не считаются новыми (граница §3 ТЗ)', () => {
  const inherited = checkNodes([rayAt(0), rayAt(9)]);
  assert.equal(inherited.length, 1);
  // Тот же документ переписан без изменения этого узла — новых нарушений нет.
  assert.deepEqual(newViolations(inherited, inherited), []);
  // Появился второй узкий узел — он и есть новое нарушение.
  const worse = [...inherited, { rule: 'angle', subject: 'other', actual: 3, limit: 15 }];
  assert.deepEqual(newViolations(worse, inherited).map((item) => item.subject), ['other']);
});

// --- #329 §4: честная вершина легаси-плана ---

test('§4: вырожденная вершина сходится в точку плана, обычные углы нетронуты', async () => {
  const { isDegenerateApexCorner, outsetContour, DEGENERATE_APEX_MAX_DEGREES } =
    await import('../test-build/wall-thickness.js');
  assert.equal(DEGENERATE_APEX_MAX_DEGREES, 15);

  // Фикстура issue: вершина ≈9.85°, стены 15 см (полутолщина 7.5 см).
  const apex = [3.7167, 0.2417];
  const spike = [[3.6417, 1.8333], apex, [3.9083, 1.7667]];
  const half = cm(7.5);
  const offsets = [half, half, half];
  assert.equal(isDegenerateApexCorner(spike, offsets, 1), true);
  assert.equal(isDegenerateApexCorner(spike, offsets, 0), false);

  // Внешний контур сходится РОВНО в вершине плана: ни плоского среза (две
  // точки у вершины), ни иглы mitre, торчащей далеко за неё.
  const outset = outsetContour(spike, offsets, null);
  assert.ok(outset, 'контур строится');
  const nearApex = outset.filter((point) => Math.hypot(point[0] - apex[0], point[1] - apex[1]) < half * 4);
  assert.equal(nearApex.length, 1, 'у вершины ровно одна точка — остриё');
  assert.ok(Math.hypot(nearApex[0][0] - apex[0], nearApex[0][1] - apex[1]) < 1e-9,
    'остриё стоит в самой вершине плана');

  // Прямоугольник: обычные углы, mitre сохраняется, вырожденных нет.
  const square = [[0, 0], [cm(400), 0], [cm(400), cm(400)], [0, cm(400)]];
  assert.equal(square.every((_, index) => !isDegenerateApexCorner(square, Array(4).fill(half), index)), true);
  // Острый, но не вырожденный угол 30° — тоже обычный (#310 сохраняется).
  const thirty = [[0, 0], [cm(400), 0],
    [cm(400) * Math.cos(Math.PI / 6), cm(400) * Math.sin(Math.PI / 6)]];
  assert.equal(isDegenerateApexCorner(thirty, Array(3).fill(half), 0), false);
  // Нулевая толщина не создаёт вырожденной зоны.
  assert.equal(isDegenerateApexCorner(spike, [0, 0, 0], 1), false);
});

test('наследование считается по правилам, а не по id носителя', async () => {
  const { increasedViolations } = await import('../test-build/junction-limits.js');
  const inherited = [
    { rule: 'length', subject: 'wall-old-1', actual: 5, limit: 20 },
    { rule: 'length', subject: 'wall-old-2', actual: 7, limit: 20 },
  ];
  // Структурная запись переатомизировала стены: те же два нарушения под
  // новыми id — запись законна (ровно кейс ресайза реального плана).
  const rekeyed = [
    { rule: 'length', subject: 'wall-new-a', actual: 5, limit: 20 },
    { rule: 'length', subject: 'wall-new-b', actual: 7, limit: 20 },
  ];
  assert.deepEqual(increasedViolations(rekeyed, inherited), []);
  // Появилось третье — вот оно и есть новое.
  const worse = [...rekeyed, { rule: 'length', subject: 'wall-new-c', actual: 3, limit: 20 }];
  assert.equal(increasedViolations(worse, inherited).length, 1);
  // Новое правило на чистом плане.
  assert.equal(increasedViolations(
    [{ rule: 'angle', subject: 'n', actual: 9, limit: 15 }], [],
  ).length, 1);
});

test('§4: у вырожденной вершины грани прямые — ни зазубрин, ни щепок', async () => {
  const { wallBodiesGeometry, insetContour, roomWallProfile } =
    await import('../test-build/wall-thickness.js');
  const room = {
    id: 'spike', name: 'Spike', area: null,
    poly: [[3.6417, 1.8333], [3.7167, 0.2417], [3.9083, 1.7667]],
  };
  const walls = room.poly.map((point, index) => ({
    key: `w${index}`, a: point, b: room.poly[(index + 1) % room.poly.length], cm: 15,
  }));
  const profile = roomWallProfile([room], room.id, walls, [], PITCH, CELL, PITCH, 1);
  // Внутренний контур сходится в СВОЮ вершину — четвёртой точки-складки нет.
  const inset = insetContour(profile.poly, profile.offsets, null);
  assert.equal(inset.length, 3, 'внутренний контур — треугольник, а не «бабочка»');

  const geometry = wallBodiesGeometry([room], walls, [], [], PITCH, CELL, PITCH, 1);
  assert.equal(geometry.status, 'ok');
  const outer = geometry.roomGeom[0][0];
  const distinct = outer.slice(0, -1);
  assert.equal(distinct.length, 3, 'внешнее кольцо — треугольник без ступенек');
  // Никаких микро-вершин: каждая сторона длиннее полутолщины.
  for (let index = 0; index < distinct.length; index++) {
    const next = distinct[(index + 1) % distinct.length];
    const side = Math.hypot(next[0] - distinct[index][0], next[1] - distinct[index][1]);
    assert.ok(side > cm(7.5), `сторона ${index} не вырождена: ${side}`);
  }
});

test('П3 меряет стену, а не атом: компенсация перепада толщин законна', async () => {
  const { collinearRunLengthUnits } = await import('../test-build/junction-limits.js');
  // Репорт владельца 2026-08-27: на стыке 30 см и 20 см атомизация оставляет
  // кусок (30−20)/2 = 5 см — коллинеарное продолжение той же стены.
  const run = [
    { id: 'long', a: [0, 0], b: [0, cm(349)], cm: 30 },
    { id: 'step', a: [0, cm(349)], b: [0, cm(354)], cm: 30 },
    { id: 'cross', a: [0, cm(354)], b: [cm(482), cm(354)], cm: 20 },
  ];
  assert.deepEqual(checkSegmentLengths(run, CELL, PITCH), [],
    'короткий атом внутри прямого прогона не нарушение');
  const runLength = collinearRunLengthUnits(run[1], run);
  assert.ok(Math.abs((runLength / PITCH) * CELL - 354) < 1e-6, 'меряется весь прогон');

  // Одинокая короткая стена по-прежнему отклоняется: коллинеарного
  // продолжения нет.
  const lonely = [
    { id: 'a', a: [0, 0], b: [cm(10), 0], cm: 15 },
    { id: 'b', a: [cm(10), 0], b: [cm(10), cm(10)], cm: 15 },
  ];
  assert.equal(checkSegmentLengths(lonely, CELL, PITCH).length, 2);

  // Продолжение ДРУГОЙ толщины прогоном не считается.
  const mixed = [
    { id: 'thin', a: [0, 0], b: [0, cm(10)], cm: 15 },
    { id: 'thick', a: [0, cm(10)], b: [0, cm(400)], cm: 40 },
  ];
  assert.ok(checkSegmentLengths(mixed, CELL, PITCH)
    .some((item) => item.subject === 'thin'));
});

// --- #329 AC10: Optimize — ремонтный путь, а не источник новых нарушений ---

/**
 * Нарушения одного пространства так, как их считает барьер записи: обе
 * стороны сперва проходят одну и ту же миграцию каталога.
 */
async function violationsByRule(config, spaceId) {
  const { commitWallSegmentModel } = await import('../test-build/wall-segment-model.js');
  const { checkNodes, checkSegmentLengths, checkNodeDistances } =
    await import('../test-build/junction-limits.js');
  const { config: migrated } = commitWallSegmentModel(
    JSON.parse(JSON.stringify(config)),
  );
  const space = (migrated.spaces || []).find(
    (item) => String(item.id) === String(spaceId),
  );
  // Молчаливое «пространства нет» превратило бы тест в проверку пустоты.
  assert.ok(space, `пространство ${spaceId} есть после миграции`);
  assert.ok((space.wall_segments || []).length > 0, 'каталог стен непуст');
  const segments = [
    ...(space.wall_segments || []).map((item) => ({ id: item.id, a: item.a, b: item.b, cm: Number(item.cm) })),
    ...(space.partitions || []).map((item) => ({ id: item.id, a: item.a, b: item.b, cm: Number(item.cm) })),
  ];
  const cellCm = Number(space.cell_cm) || 1;
  const all = [
    ...checkNodes(segments),
    ...checkSegmentLengths(segments, cellCm, GRID_STEP_N),
    ...checkNodeDistances(segments, cellCm, GRID_STEP_N),
  ];
  const counts = {};
  for (const item of all) counts[item.rule] = (counts[item.rule] || 0) + 1;
  return counts;
}

test('AC10: Optimize на легаси-плане с нарушением не добавляет новых', async () => {
  const { optimizePlans } = await import('../test-build/plan-optimizer.js');
  const { readFileSync } = await import('node:fs');
  const fixture = JSON.parse(readFileSync(
    new URL('./fixtures/329-sharp-apex.json', import.meta.url), 'utf8',
  ));
  // Легаси-хранение: только контуры и `walls`, без каталога — то состояние,
  // в котором план приходит на Оптимизацию в первый раз.
  const space = {
    id: 'legacy', title: 'legacy', cell_cm: fixture.cell_cm,
    view_box: [0, 0, 1, 1],
    rooms: fixture.rooms.map(({ id, name, area, poly }) => ({ id, name, area, poly })),
    walls: fixture.walls.map(({ id, a, b, cm }) => ({ key: id, a, b, cm })),
    openings: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const config = { spaces: [space], markers: [], settings: {} };
  const before = await violationsByRule(config, 'legacy');
  // Шпиль владельца обязан читаться как унаследованное нарушение — иначе
  // тест доказывал бы «ничего не выросло» на пустом месте.
  assert.equal((before.angle || 0) > 0, true, 'фикстура несёт нарушение угла');

  const result = optimizePlans(config, {});
  const after = await violationsByRule(result.config, 'legacy');
  for (const rule of new Set([...Object.keys(before), ...Object.keys(after)])) {
    assert.equal((after[rule] || 0) <= (before[rule] || 0), true,
      `Оптимизация добавила нарушений по правилу ${rule}: `
      + `${before[rule] || 0} → ${after[rule] || 0}`);
  }
});

test('AC10: привязка к решётке не утаскивает узел на пороге П4 под лимит', async () => {
  const { optimizePlans } = await import('../test-build/plan-optimizer.js');
  // Две комнаты, между гранями ровно 5 см — П4 выполняется впритык, и
  // сдвиг на доли сантиметра при выравнивании увёл бы его под порог.
  const CELL_LOCAL = 2;
  const u = (value) => (value / CELL_LOCAL) * GRID_STEP_N;
  const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const left = box(u(100), u(100), u(200), u(200));
  const right = box(u(100) + u(205), u(100), u(200), u(200));
  const wallsOf = (poly, prefix) => poly.map((point, index) => ({
    key: `${prefix}${index}`, a: point, b: poly[(index + 1) % poly.length], cm: 15,
  }));
  const config = { spaces: [{
    id: 'edge', title: 'edge', cell_cm: CELL_LOCAL, view_box: [0, 0, 1, 1],
    rooms: [
      { id: 'a', name: 'a', area: null, poly: left },
      { id: 'b', name: 'b', area: null, poly: right },
    ],
    walls: [...wallsOf(left, 'l'), ...wallsOf(right, 'r')],
    openings: [], room_drafts: [], partitions: [], wall_columns: [],
  }], markers: [], settings: {} };

  const before = await violationsByRule(config, 'edge');
  assert.equal(before.distance || 0, 0, 'исходный план по П4 чист');
  const result = optimizePlans(config, {});
  const after = await violationsByRule(result.config, 'edge');
  assert.equal(after.distance || 0, 0,
    'после Оптимизации узлы не сблизились под 5 см');
});

// --- #330: производительность без смены вердиктов ---

test('#330 AC2: П4 через bucket эквивалентен перебору на границах', async () => {
  const { checkNodeDistances } = await import('../test-build/junction-limits.js');
  // Простейший перебор — эталон, с которым обязана совпасть решётка.
  const brute = (segments, cellCm) => {
    const key = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    const nodes = new Map();
    for (const s of segments) { nodes.set(key(s.a), s.a); nodes.set(key(s.b), s.b); }
    const mu = cmToUnits(MIN_NODE_DISTANCE_CM, cellCm, PITCH);
    const out = [];
    const es = [...nodes.entries()];
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const d = Math.hypot(es[i][1][0] - es[j][1][0], es[i][1][1] - es[j][1][1]);
      if (d < mu - 1e-9) out.push('nn');
    }
    for (const [k, p] of nodes) for (const s of segments) {
      if (key(s.a) === k || key(s.b) === k) continue;
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      const l2 = dx * dx + dy * dy;
      const t = l2 <= 1e-18 ? 0 : Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l2));
      const d = Math.hypot(p[0] - (s.a[0] + dx * t), p[1] - (s.a[1] + dy * t));
      if (d > 1e-9 && d < mu - 1e-9) out.push('ns');
    }
    return out.length;
  };
  const cases = [
    // ровно 5 см между узлами — проходит; 4 см — нет; T-стык; почти-касание
    [{ id: 'a', a: [0, 0], b: [cm(300), 0], cm: 15 },
     { id: 'b', a: [0, cm(5)], b: [cm(300), cm(5)], cm: 15 }],
    [{ id: 'a', a: [0, 0], b: [cm(300), 0], cm: 15 },
     { id: 'b', a: [0, cm(4)], b: [cm(300), cm(4)], cm: 15 }],
    [{ id: 'a', a: [0, 0], b: [cm(300), 0], cm: 15 },
     { id: 'b', a: [cm(150), 0], b: [cm(150), cm(300)], cm: 15 }],
    [{ id: 'a', a: [0, 0], b: [cm(300), 0], cm: 15 },
     { id: 'b', a: [cm(150), cm(4)], b: [cm(450), cm(4)], cm: 15 }],
    // узлы в разных ячейках решётки, но ближе порога через границу ячейки
    [{ id: 'a', a: [cm(4.9), 0], b: [cm(304.9), 0], cm: 15 },
     { id: 'b', a: [cm(9.7), cm(0.5)], b: [cm(309.7), cm(0.5)], cm: 15 }],
  ];
  for (const [index, segments] of cases.entries()) {
    const grid = checkNodeDistances(segments, CELL, PITCH).length;
    assert.equal(grid, brute(segments, CELL),
      `кейс ${index}: решётка и перебор разошлись`);
  }
});

test('#330 AC2: индекс byNode не меняет вердикт П3', async () => {
  const { checkSegmentLengths, collinearRunLengthUnits } =
    await import('../test-build/junction-limits.js');
  // Доборный атом 5 см при перепаде толщин остаётся законным (АС3b #329),
  // одиночные 19 см — нарушением; прямой вызов без индекса согласован.
  const run = [
    { id: 'long', a: [0, 0], b: [cm(349), 0], cm: 30 },
    { id: 'filler', a: [cm(349), 0], b: [cm(354), 0], cm: 30 },
    { id: 'thin', a: [cm(354), 0], b: [cm(554), 0], cm: 20 },
  ];
  assert.equal(checkSegmentLengths(run, CELL, PITCH).length, 0);
  const short = [{ id: 's', a: [0, 0], b: [cm(19), 0], cm: 15 }];
  assert.equal(checkSegmentLengths(short, CELL, PITCH).length, 1);
  const direct = collinearRunLengthUnits(run[1], run);
  assert.ok(Math.abs(direct - cmToUnits(354, CELL, PITCH)) < 1e-9,
    'прямой вызов без индекса меряет тот же прогон');
});

test('#330 AC4: кэш baseline инвалидируется по конфиг-эпохе (контракт исходника)', () => {
  // houseplan-card.ts не компилируется в test-build (монолит вне
  // tsconfig.test.json), поэтому контракт кэша пинится по исходнику — тем же
  // приёмом, каким #293 пинит обвязку смока. Поведенческая половина AC4
  // (N move → N+1 вычислений в реальном жесте) живёт в
  // demo/smoke_junction_limits.mjs (resizeBaselineCachedPerGesture).
  const source = readFileSync(
    new URL('../src/houseplan-card.ts', import.meta.url), 'utf8',
  );
  const method = source.slice(
    source.indexOf('private _junctionLimitsIntroduced('),
    source.indexOf('private _commitPhysicalGeometry('),
  );
  assert.match(method, /cached\.epoch === this\._cfgEpoch/,
    'кэш baseline обязан сверять конфиг-эпоху — иначе он переживает write и судит план, которого больше нет');
  assert.match(method, /_junctionBaselineCache\.set\(previousConfig/,
    'кэш ключуется идентичностью документа');
  assert.match(method, />= WALL_SEGMENT_MODEL_VERSION\s*\n?\s*\? previousConfig/,
    'документ текущей версии используется как есть (#330 §4.6)');
});

test('#330 M2: §4.6 на границах — v9 как есть == v9 через миграцию (TS)', async () => {
  const { commitWallSegmentModel } = await import('../test-build/wall-segment-model.js');
  const { checkNodes, checkSegmentLengths, checkNodeDistances } =
    await import('../test-build/junction-limits.js');
  const countsOf = (space) => {
    const segments = (space.wall_segments || []).map((item) => ({
      id: item.id, a: item.a, b: item.b, cm: Number(item.cm),
    }));
    const all = [
      ...checkNodes(segments),
      ...checkSegmentLengths(segments, Number(space.cell_cm) || 1, PITCH),
      ...checkNodeDistances(segments, Number(space.cell_cm) || 1, PITCH),
    ];
    const counts = {};
    for (const item of all) counts[item.rule] = (counts[item.rule] || 0) + 1;
    return counts;
  };
  const polys = {
    spike: [[0.30, 0.70], [0.3167, 0.24], [0.36, 0.68]],
    box: [[0.60, 0.60], [0.80, 0.60], [0.80, 0.80], [0.60, 0.80]],
    narrow: [[0.30, 0.70], [0.32, 0.24], [0.36, 0.68]],
  };
  for (const [name, poly] of Object.entries(polys)) {
    const legacy = { spaces: [{
      id: 's', title: 's', cell_cm: CELL, view_box: [0, 0, 1, 1],
      rooms: [{ id: 'r1', name, area: null, poly }],
      walls: poly.map((point, index) => ({
        key: `w${index}`, a: point, b: poly[(index + 1) % poly.length], cm: 15,
      })),
      openings: [], room_drafts: [], partitions: [], wall_columns: [],
    }], markers: [], settings: {} };
    const v9 = commitWallSegmentModel(JSON.parse(JSON.stringify(legacy))).config;
    const asIs = countsOf(v9.spaces[0]);
    const through = commitWallSegmentModel(JSON.parse(JSON.stringify(v9))).config;
    assert.deepEqual(asIs, countsOf(through.spaces[0]),
      `${name}: вердикт «как есть» разошёлся с «через миграцию»`);
  }
});
