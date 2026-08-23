import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { fixtureWallKey, WALL_KEY_PITCH } from '../demo/fixtures/wall-key.mjs';
import { wallKey as productWallKey } from '../test-build/wall-thickness.js';
import { GRID_STEP_N } from '../test-build/space-geometry.js';

/**
 * Привязка ключа фикстур к продуктовому (#260).
 *
 * Фикстуры обязаны оставаться без внешних импортов: бэкенд-гейт исполняет их
 * через `node --eval` в job без `npm ci` и без `test-build/`, а отпечаток
 * источников хеширует только `src/**` и `.mjs` из `demo/fixtures`/`demo/golden`.
 * Значит формула ключа в `demo/fixtures/wall-key.mjs` — копия, и жить ей
 * позволено только под этим тестом.
 *
 * Цена расхождения измерена, а не предположена. Пока `large-house` писал метки
 * `perf-wall-0-3`, продукт не находил ни одной из 147 записей: все 80 сплошных
 * рёбер каждого этажа резолвились в нулевую толщину, тел стен не возникало
 * вовсе — а на этой фикстуре стоят четыре golden-сцены и все шесть
 * перф-бюджетов. `visual-matrix` писала четыре знака вместо шести и держалась
 * на терпимом запасе `lookupWall`, то есть на удаче.
 */

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('ключ фикстур совпадает с продуктовым на решётке (#260)', () => {
  assert.equal(WALL_KEY_PITCH, GRID_STEP_N, 'шаг решётки разошёлся с продуктовым');
  const nodes = [0, 1, 2, 3, 7, 47, 48, 71, 83, 107, 120, 239, 240];
  let checked = 0;
  for (const i of nodes) {
    for (const j of nodes) {
      for (const [dx, dy] of [[0, 1], [1, 0], [1, 1], [1, 2], [3, 1], [0, -1], [-2, 1]]) {
        const a = [i / 240, j / 240];
        const b = [(i + dx) / 240, (j + dy) / 240];
        assert.equal(fixtureWallKey(a, b), productWallKey(a, b, GRID_STEP_N),
          `копия разошлась с продуктовой на ${JSON.stringify([a, b])}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500, `сверено ${checked} отрезков: набор подозрительно мал`);
});

test('ключ фикстур совпадает и вне решётки (#260)', () => {
  // Координаты фикстур авторские (0.06, 0.48, 0.2875) и на узлы не попадают:
  // именно там точность и разошлась — шесть знаков против четырёх.
  for (const [a, b] of [
    [[0.06, 0.08], [0.48, 0.08]],
    [[0.48, 0.08], [0.48, 0.48]],
    [[0.2875, 0.13], [0.7125, 0.13]],
    [[0.5, 0.5], [0.5, 0.5]],
    [[-1.670833333, -0.208333333], [0.4, -0.208333333]],
    [[0.8875, 0.05], [0.8875, 0.345833333]],
  ]) {
    assert.equal(fixtureWallKey(a, b), productWallKey(a, b, GRID_STEP_N),
      `копия разошлась на ${JSON.stringify([a, b])}`);
  }
  // Шесть знаков, а не четыре: точность зависит от шага, и на 1/240 продукт
  // печатает шесть. Ровно эта строка была причиной #260.
  assert.equal(fixtureWallKey([0.06, 0.08], [0.48, 0.08]), '0.270833,0.079167@0.0000');
});

test('ни одна фикстура не несёт своей копии ключа (#260)', () => {
  // Третья копия формулы — тот же дефект «одно число, два источника», который
  // проект уже ловил в #233, #234 и #258. Держим один источник на demo/fixtures.
  const dir = `${repoRoot}demo/fixtures`;
  const offenders = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.mjs') || file === 'wall-key.mjs') continue;
    const text = readFileSync(`${dir}/${file}`, 'utf8');
    if (/Math\.atan2|toFixed\(4\)\s*\}@|1 \/ 240/.test(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [],
    'фикстура считает ключ сама — импортируйте fixtureWallKey из wall-key.mjs');
});
