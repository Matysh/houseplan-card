import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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

// #593: пакет 0.4.0 рисует каждый символ ОДНИМ путём — многопутёвых файлов,
// на которых дефект #584 был виден в числах, в нём не осталось. Поэтому
// свидетель разделён надвое: факт о поставке проверяется на поставке, а
// арифметика склейки — на реальных байтах пакета плюс относительный путь,
// который такая поставка однажды снова принесёт. Удалять свидетеля нельзя:
// склейка живёт в генераторе и обязана остаться правильной.
test('#593: в поставке 0.4.0 каждый символ — один путь, и склейка на нём тождественна', () => {
  const dir = new URL('../assets/furniture/houseplan-0.4.0/svg/', import.meta.url);
  let checked = 0;
  for (const kind of ['menu', 'plan']) {
    for (const file of readdirSync(new URL(`${kind}/`, dir))) {
      const source = readFileSync(new URL(`${kind}/${file}`, dir), 'utf8');
      const paths = [...source.matchAll(/(?:^|\s)d="([^"]*)"/g)].map((match) => match[1]);
      assert.equal(paths.length, 1, `${kind}/${file}: ожидался ровно один путь`);
      assert.equal(joinFurniturePaths(paths), paths[0].trim(),
        `${kind}/${file}: склейка одного пути обязана быть тождественной`);
      checked += 1;
    }
  }
  assert.equal(checked, 93, 'проверены все файлы поставки');
});

test('AC4: на реальных байтах пакета склейка не даёт второму пути уехать', () => {
  // Первый путь — настоящий, из поставки; второй начинается относительной `m`,
  // как это было у `stairs` и `tv` в 0.3.0. Простой `join(' ')` продолжил бы
  // координаты первого, и деталь ушла бы далеко за `viewBox` 110 × 110.
  const source = readFileSync(
    new URL('../assets/furniture/houseplan-0.4.0/svg/menu/stairs.svg', import.meta.url), 'utf8');
  const real = [...source.matchAll(/(?:^|\s)d="([^"]*)"/g)].map((match) => match[1])[0];
  const tail = 'm100 100 h5';
  const own = svgPathBounds(`M ${tail.slice(1)}`);
  assert.deepEqual([own.minX, own.minY, own.maxX, own.maxY], [100, 100, 105, 100],
    'хвост сам по себе лежит там, где написан');

  const naive = svgPathBounds([real, tail].join(' '));
  const fixed = svgPathBounds(joinFurniturePaths([real, tail]));
  // Простая конкатенация продолжает координаты первого пути: хвост уезжает
  // ровно на его конечную точку, и обе стороны уходят за 110.
  assert.ok(naive.maxX > 110 && naive.maxY > 110,
    `прежняя склейка обязана уводить хвост за viewBox: ${naive.maxX} × ${naive.maxY}`);
  // Правильная склейка кладёт хвост туда, где он написан, не трогая первый путь.
  const realBounds = svgPathBounds(real);
  assert.equal(fixed.maxX, Math.max(realBounds.maxX, own.maxX));
  assert.equal(fixed.maxY, Math.max(realBounds.maxY, own.maxY));
  assert.equal(fixed.minX, Math.min(realBounds.minX, own.minX));
  assert.equal(fixed.minY, Math.min(realBounds.minY, own.minY));
  assert.ok(fixed.maxX <= 110 && fixed.maxY <= 110, 'рисунок обязан лежать внутри viewBox');
});
