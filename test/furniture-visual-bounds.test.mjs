import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FURNITURE, furnitureGraphic, furnitureRenderTransform } from '../test-build/furniture.js';
import { GENERATED_FURNITURE_ART } from '../test-build/furniture-plan-art.generated.js';
import { parseSvgPath } from '../test-build/pdf/svg-path.js';
import { svgPathBounds, boxFillDeviation } from '../scripts/svg-path-bounds.mjs';
import { PLAN_BOUNDS_TOLERANCE } from '../scripts/generate-furniture-assets.mjs';

// #584. Контракт задачи говорит о ВИДИМОМ габарите, поэтому и проверять надо
// рисунок, а не метаданные: до этой задачи `viewBox` совпадал с каталогом у
// всех 44 дизайнерских символов, а рисунок внутри занимал около 88 % стороны.
// Тесты на `viewBox` были зелёными, и предмет 60 × 60 всё равно выглядел
// меньше соседа 60 × 60.

/** Путь символа в его собственном боксе: дизайнерский art либо legacy-примитив. */
const artOf = (symbol) => (symbol.designer
  ? {
    d: GENERATED_FURNITURE_ART[symbol.id].d,
    w: GENERATED_FURNITURE_ART[symbol.id].viewW,
    h: GENERATED_FURNITURE_ART[symbol.id].viewH,
  }
  // Legacy-символы рисуются в unit box и приходят тем же публичным путём, что
  // и в продакшене.
  : { d: furnitureGraphic(symbol.id).d, w: 1, h: 1 });

test('AC1: рисунок каждого символа заполняет свой физический бокс', () => {
  const misses = [];
  for (const symbol of FURNITURE) {
    const art = artOf(symbol);
    const tolerance = symbol.designer ? PLAN_BOUNDS_TOLERANCE : PLAN_BOUNDS_TOLERANCE / Math.max(symbol.w, symbol.h);
    const deviation = boxFillDeviation(art.d, art.w, art.h);
    if (deviation > tolerance) misses.push(`${symbol.id}: ${deviation.toFixed(4)} > ${tolerance.toFixed(4)}`);
  }
  assert.deepEqual(misses, [], 'символы с полями внутри своего бокса');
  assert.equal(FURNITURE.length, 56, 'библиотека: 44 дизайнерских + 12 legacy');

  // Положительный контроль. Утверждение «полей нет» стоит ровно столько,
  // сколько стоит измерение: та же функция на той же геометрии обязана поля
  // УВИДЕТЬ. Числа — из шапки issue: рисунок `kitchen_floor` занимал
  // 52,615 × 52,615 внутри viewBox 60 × 60.
  const padded = 'M 3.6925 3.6925 L 56.3075 3.6925 L 56.3075 56.3075 L 3.6925 56.3075 Z';
  const paddedDeviation = boxFillDeviation(padded, 60, 60);
  assert.ok(paddedDeviation > PLAN_BOUNDS_TOLERANCE,
    `измерение обязано видеть поля, а вернуло ${paddedDeviation}`);
  assert.ok(Math.abs(paddedDeviation - 3.6925) < 1e-9, 'поля меряются, а не округляются');
  assert.equal(boxFillDeviation('M 0 0 L 60 0 L 60 60 L 0 60 Z', 60, 60), 0);
});

test('AC2: одинаковые размеры дают одинаковый видимый габарит', () => {
  // Пара из шапки issue: оба предмета 60 × 60, но посудомойка была крупнее.
  const floor = FURNITURE.find((s) => s.id === 'kitchen_floor');
  const dishwasher = FURNITURE.find((s) => s.id === 'dishwasher');
  assert.deepEqual([floor.w, floor.h], [60, 60]);
  assert.deepEqual([dishwasher.w, dishwasher.h], [60, 60]);
  const extent = (symbol) => {
    const art = artOf(symbol);
    const bounds = svgPathBounds(art.d);
    return [
      ((bounds.maxX - bounds.minX) / art.w) * symbol.w,
      ((bounds.maxY - bounds.minY) / art.h) * symbol.h,
    ];
  };
  const [floorW, floorH] = extent(floor);
  const [dishW, dishH] = extent(dishwasher);
  assert.ok(Math.abs(floorW - dishW) <= PLAN_BOUNDS_TOLERANCE, `ширина ${floorW} против ${dishW}`);
  assert.ok(Math.abs(floorH - dishH) <= PLAN_BOUNDS_TOLERANCE, `глубина ${floorH} против ${dishH}`);
  assert.ok(Math.abs(floorW - 60) <= PLAN_BOUNDS_TOLERANCE, 'кухонный модуль занимает заявленные 60 см');
});

test('AC3: после продакшен-трансформа геометрия занимает бокс фигуры', () => {
  const symbol = FURNITURE.find((s) => s.id === 'kitchen_floor');
  const art = artOf(symbol);
  const canvasW = 1000, canvasH = 800;
  const shape = { x: 0.2, y: 0.1, w: 0.3, h: 0.25 };
  const box = { x: shape.x * canvasW, y: shape.y * canvasH, w: shape.w * canvasW, h: shape.h * canvasH };
  const tolerance = 0.1 * Math.max(box.w / symbol.w, box.h / symbol.h);

  // Прямые углы: габарит рисунка совпадает с боксом фигуры. Зеркалирование —
  // отражение того же бокса, поэтому равенство обязано сохраниться.
  for (const angle of [0, 90, 180, 270]) {
    for (const flip_h of [false, true]) {
      for (const flip_v of [false, true]) {
        const transform = furnitureRenderTransform({ ...shape, angle, flip_h, flip_v }, canvasW, canvasH, art.w, art.h);
        const bounds = transformedBounds(art.d, transform);
        const expected = rotatedBox(box, angle);
        const state = `angle=${angle} flip=${flip_h ? 'h' : ''}${flip_v ? 'v' : ''}`;
        for (const [key, value] of Object.entries(expected)) {
          assert.ok(Math.abs(bounds[key] - value) <= tolerance,
            `${state}: ${key} ${bounds[key].toFixed(3)} против ${value.toFixed(3)}`);
        }
      }
    }
  }

  // Произвольный угол: габарит рисунка обязан ЛЕЖАТЬ в повёрнутом боксе.
  // Равенства здесь и не должно быть — у скруглённых углов повёрнутый рисунок
  // занимает чуть меньше, чем повёрнутый прямоугольник, и это геометрия, а не
  // поля внутри символа.
  for (const angle of [15, 37]) {
    const transform = furnitureRenderTransform({ ...shape, angle, flip_h: false, flip_v: false }, canvasW, canvasH, art.w, art.h);
    const bounds = transformedBounds(art.d, transform);
    const expected = rotatedBox(box, angle);
    const inside = bounds.minX >= expected.minX - tolerance && bounds.maxX <= expected.maxX + tolerance
      && bounds.minY >= expected.minY - tolerance && bounds.maxY <= expected.maxY + tolerance;
    assert.ok(inside, `angle=${angle}: рисунок вышел за повёрнутый бокс`);
    const cover = (bounds.maxX - bounds.minX) / (expected.maxX - expected.minX);
    assert.ok(cover > 0.97, `angle=${angle}: рисунок занимает лишь ${(cover * 100).toFixed(1)} % повёрнутого бокса`);
  }
});

/**
 * Тот же разбор трансформа, что применяет браузер: rotate → translate → scale.
 * Аффинное преобразование переносит контрольные точки кубик, поэтому границы
 * считаются по настоящим экстремумам уже преобразованной кривой, а не по
 * выпуклой оболочке: иначе скруглённый угол дал бы габарит больше бокса.
 */
function transformedBounds(d, transform) {
  const rotate = /rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/.exec(transform);
  const translate = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(transform);
  const scale = /scale\(([-\d.]+) ([-\d.]+)\)/.exec(transform);
  const apply = (x, y) => {
    let px = x * Number(scale[1]) + Number(translate[1]);
    let py = y * Number(scale[2]) + Number(translate[2]);
    if (rotate) {
      const radians = (Number(rotate[1]) * Math.PI) / 180;
      const cx = Number(rotate[2]), cy = Number(rotate[3]);
      const dx = px - cx, dy = py - cy;
      px = cx + dx * Math.cos(radians) - dy * Math.sin(radians);
      py = cy + dx * Math.sin(radians) + dy * Math.cos(radians);
    }
    return [px, py];
  };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const noteX = (v) => { minX = Math.min(minX, v); maxX = Math.max(maxX, v); };
  const noteY = (v) => { minY = Math.min(minY, v); maxY = Math.max(maxY, v); };
  const extrema = (p0, p1, p2, p3) => {
    const values = [p0, p3];
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
    const at = (t) => { if (t > 0 && t < 1) { const u = 1 - t;
      values.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3); } };
    if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) at(-c / b); }
    else { const disc = b * b - 4 * a * c; if (disc >= 0) { const r = Math.sqrt(disc);
      at((-b + r) / (2 * a)); at((-b - r) / (2 * a)); } }
    return values;
  };
  let cur = [0, 0];
  for (const op of parseSvgPath(d)) {
    if (op.op === 'Z') continue;
    if (op.op === 'M' || op.op === 'L') {
      const [x, y] = apply(op.x, op.y);
      noteX(x); noteY(y); cur = [x, y];
      continue;
    }
    const [x1, y1] = apply(op.x1, op.y1);
    const [x2, y2] = apply(op.x2, op.y2);
    const [x, y] = apply(op.x, op.y);
    for (const v of extrema(cur[0], x1, x2, x)) noteX(v);
    for (const v of extrema(cur[1], y1, y2, y)) noteY(v);
    cur = [x, y];
  }
  return { minX, minY, maxX, maxY };
}

/** Габарит повёрнутого прямоугольника — то, что бокс занимает на экране. */
function rotatedBox(box, angle) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const radians = (angle * Math.PI) / 180;
  const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
  const points = corners.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(radians) - dy * Math.sin(radians), cy + dx * Math.sin(radians) + dy * Math.cos(radians)];
  });
  return {
    minX: Math.min(...points.map((p) => p[0])), maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])), maxY: Math.max(...points.map((p) => p[1])),
  };
}

test('границы считаются той же математикой, что у продакшен-экспорта', () => {
  // Генератор — .mjs и работает без сборки TypeScript, поэтому у него свой
  // разбор пути. Две реализации не имеют права разъехаться молча: сверяем их
  // на всей библиотеке.
  for (const symbol of FURNITURE) {
    const art = artOf(symbol);
    const mine = svgPathBounds(art.d);
    const production = productionBounds(art.d);
    for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
      assert.ok(Math.abs(mine[key] - production[key]) < 1e-6,
        `${symbol.id}.${key}: ${mine[key]} против ${production[key]}`);
    }
  }
});

/** Границы по операциям продакшен-парсера: те же экстремумы кубик. */
function productionBounds(d) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let cur = [0, 0];
  const noteX = (v) => { minX = Math.min(minX, v); maxX = Math.max(maxX, v); };
  const noteY = (v) => { minY = Math.min(minY, v); maxY = Math.max(maxY, v); };
  const extrema = (p0, p1, p2, p3) => {
    const values = [p0, p3];
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
    const at = (t) => { if (t > 0 && t < 1) { const u = 1 - t;
      values.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3); } };
    if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) at(-c / b); }
    else { const disc = b * b - 4 * a * c; if (disc >= 0) { const r = Math.sqrt(disc);
      at((-b + r) / (2 * a)); at((-b - r) / (2 * a)); } }
    return values;
  };
  for (const op of parseSvgPath(d)) {
    if (op.op === 'M' || op.op === 'L') { noteX(op.x); noteY(op.y); cur = [op.x, op.y]; }
    else if (op.op === 'C') {
      for (const v of extrema(cur[0], op.x1, op.x2, op.x)) noteX(v);
      for (const v of extrema(cur[1], op.y1, op.y2, op.y)) noteY(v);
      cur = [op.x, op.y];
    }
  }
  return { minX, minY, maxX, maxY };
}

test('AC5: гейт пака читает репозиторий и падает на символе с полями', async () => {
  const generator = readFileSync(new URL('../scripts/generate-furniture-assets.mjs', import.meta.url), 'utf8');
  assert.match(generator, /boxFillDeviation/, 'проверка границ обязана быть в гейте, а не только в тестах');
  assert.match(generator, /plan symbol must be a single path/);
  assert.match(generator, /plan subpaths must start with an absolute M/);
  assert.equal(PLAN_BOUNDS_TOLERANCE, 0.1, 'допуск контракта из ТЗ дизайнеру');
  // Символ с полями внутри бокса обязан отвергаться: это и есть дефект #584.
  const padded = 'M 5 5 L 55 5 L 55 55 L 5 55 Z';
  assert.ok(boxFillDeviation(padded, 60, 60) > PLAN_BOUNDS_TOLERANCE);
  assert.ok(boxFillDeviation('M 0 0 L 60 0 L 60 60 L 0 60 Z', 60, 60) <= PLAN_BOUNDS_TOLERANCE);
});
