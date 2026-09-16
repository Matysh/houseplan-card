import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinFurniturePaths } from '../scripts/furniture-path-join.mjs';
import { svgPathBounds } from '../scripts/svg-path-bounds.mjs';

// #584. У каждого исходного `<path>` своя текущая точка, и начинается она в
// нуле. Генератор склеивал строки `d` простым `join(' ')`, поэтому второй путь,
// начинающийся относительной `m`, продолжал координаты первого. Рисунок уезжал
// молча: `viewBox` совпадал, метаданные совпадали, тесты были зелёными.

test('AC4: каждый исходный путь начинает свою текущую точку заново', () => {
  assert.equal(joinFurniturePaths(['M3.765 40h2', 'm56.26 26.96l-3-3']),
    'M3.765 40h2 M 56.26 26.96 l-3-3');
});

test('AC4: неявные пары после относительного m остаются относительными линиями', () => {
  // `m10 20 5 6` — это перенос и ОТНОСИТЕЛЬНАЯ линия. Без явной `l` пара
  // досталась бы канонизированной `M` и стала бы абсолютной точкой (5, 6).
  assert.equal(joinFurniturePaths(['m10 20 5 6-2-3z']), 'M 10 20 l 5 6-2-3z');
  assert.deepEqual(svgPathBounds(joinFurniturePaths(['m10 20 5 6-2-3z'])),
    svgPathBounds('M10 20 l5 6-2-3z'));
});

test('AC4: относительные команды внутри пути смысла не меняют', () => {
  assert.equal(joinFurniturePaths(['m1e1,-2.5m.5.6']), 'M 1e1 -2.5 m.5.6');
  assert.equal(joinFurniturePaths(['M10 20 5 6Z']), 'M10 20 5 6Z');
});

test('AC4: путь без начального moveto — ошибка, а не тихая склейка', () => {
  assert.throws(() => joinFurniturePaths(['L1 2']), /must begin with M or m/);
  assert.throws(() => joinFurniturePaths([]), /has no paths/);
  assert.throws(() => joinFurniturePaths(null), /has no paths/);
});

test('AC4: на реальном символе прежняя склейка уводила детали за viewBox', () => {
  // `stairs` и `tv` из меню — единственные, у кого дефект был виден в числах:
  // при простом `join(' ')` части рисунка уходили за границу 110 × 110.
  for (const id of ['stairs', 'tv']) {
    const source = readFileSync(new URL(`../assets/furniture/houseplan-0.3.0/svg/menu/${id}.svg`, import.meta.url), 'utf8');
    const paths = [...source.matchAll(/(?:^|\s)d="([^"]*)"/g)].map((match) => match[1]);
    assert.ok(paths.length > 1, `${id}: фикстура должна быть многопутёвой`);
    const naive = svgPathBounds(paths.join(' '));
    const fixed = svgPathBounds(joinFurniturePaths(paths));
    const own = paths.map((d) => svgPathBounds(d)).reduce((a, b) => ({
      minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
    }));
    assert.ok(naive.maxX > 110 || naive.maxY > 110,
      `${id}: прежняя склейка обязана выводить рисунок за viewBox, иначе фикстура не о том`);
    for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
      assert.ok(Math.abs(fixed[key] - own[key]) < 1e-9,
        `${id}.${key}: склейка ${fixed[key]} против «каждый путь из своего нуля» ${own[key]}`);
    }
    assert.ok(fixed.maxX <= 110 && fixed.maxY <= 110, `${id}: рисунок обязан лежать внутри viewBox`);
  }
});
