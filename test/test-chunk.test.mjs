import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { chunkFiles, listTestFiles, parseChunk } from '../scripts/test-chunk.mjs';

// #633. Полный набор юнитов в песочнице агента не укладывается в одну команду
// (≈3 мин), и его резали руками. `npm run test:chunk -- N/M` делит детерминированно;
// эти тесты держат главное свойство: M частей вместе — каждый файл ровно один раз.

test('N/M разбирается, невозможная часть — ошибка, а не пустой прогон (#633)', () => {
  assert.deepEqual(parseChunk('2/6'), { index: 2, total: 6 });
  assert.deepEqual(parseChunk(' 1/1 '), { index: 1, total: 1 });
  for (const bad of ['0/4', '5/4', '1/0', '2', '', undefined, 'a/b', '-1/4', '1/4/2']) {
    assert.throws(() => parseChunk(bad), /N\/M|не существует/, String(bad));
  }
});

test('каждый test/*.test.mjs ровно в одной части при любом M (#633 AC3)', () => {
  const files = listTestFiles();
  assert.ok(files.length > 10, 'набор тестов найден');
  assert.ok(files.includes('test/test-chunk.test.mjs'));
  assert.ok(files.every((file) => /^test\/[^/]+\.test\.mjs$/.test(file)));
  for (const total of [1, 2, 3, 4, 6, 7, files.length, files.length + 3]) {
    const seen = new Map();
    for (let index = 1; index <= total; index += 1) {
      for (const file of chunkFiles(files, index, total)) seen.set(file, (seen.get(file) ?? 0) + 1);
    }
    assert.deepEqual([...seen.keys()].sort(), [...files].sort(), `M=${total}: покрыты все файлы`);
    assert.ok([...seen.values()].every((count) => count === 1), `M=${total}: ни один файл не попал дважды`);
  }
});

test('деление детерминировано и не зависит от порядка входа; части равны ±1 (#633)', () => {
  const files = Array.from({ length: 23 }, (_, i) => `test/f${String(i).padStart(2, '0')}.test.mjs`);
  const shuffled = [...files].reverse();
  for (let index = 1; index <= 4; index += 1) {
    assert.deepEqual(chunkFiles(shuffled, index, 4), chunkFiles(files, index, 4));
  }
  assert.deepEqual(chunkFiles(files, 1, 4).slice(0, 3), ['test/f00.test.mjs', 'test/f04.test.mjs', 'test/f08.test.mjs']);
  const sizes = [1, 2, 3, 4].map((index) => chunkFiles(files, index, 4).length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, sizes.join(','));
  // Сортировка по коду символов, не по локали: одна и та же на любой машине.
  assert.deepEqual(chunkFiles(['test/b.test.mjs', 'test/B.test.mjs', 'test/a.test.mjs'], 1, 1),
    ['test/B.test.mjs', 'test/a.test.mjs', 'test/b.test.mjs']);
});

test('npm run test:chunk ведёт в scripts/test-chunk.mjs (#633)', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['test:chunk'], 'node scripts/test-chunk.mjs');
});
