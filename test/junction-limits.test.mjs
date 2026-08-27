import test from 'node:test';
import assert from 'node:assert/strict';

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
