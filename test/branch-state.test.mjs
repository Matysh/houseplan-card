import test from 'node:test';
import assert from 'node:assert/strict';

import { conflictingPaths, devMovedNote, rebaseAdvice } from '../scripts/branch-state.mjs';

// #364. Конвейер приводит ветку к dev сам (#257) и при конфликте возвращает
// задачу, не тратя цикл ревью. Но конфликт всплывает в комментарии через сорок
// минут, а чинится на машине автора; и после любого ребейза разбор становится
// полным, а не по дельте (§7.2). Эти helpers переносят обнаружение туда, где
// есть руки, и делают возврат адресным.

test('приведённая ветка совета не требует (#364)', () => {
  assert.equal(rebaseAdvice({ behind: 0 }), null);
  assert.equal(rebaseAdvice({ behind: -1 }), null);
  assert.equal(rebaseAdvice({ behind: NaN }), null);
});

test('отставшая ветка получает число и готовую команду (#364)', () => {
  const one = rebaseAdvice({ behind: 1 });
  assert.match(one, /отстала от origin\/dev на 1 коммит\./);
  assert.match(one, /git rebase origin\/dev/);
  // Причина названа: без неё совет читается как придирка, а он про цену.
  assert.match(one, /разбор станет\s+полным, а не по дельте/);
  assert.match(rebaseAdvice({ behind: 3 }), /на 3 коммита/);
  assert.match(rebaseAdvice({ behind: 12 }), /на 12 коммитов/);
});

test('база может быть не только origin/dev (#364)', () => {
  const advice = rebaseAdvice({ behind: 2, base: 'origin/main' });
  assert.match(advice, /от origin\/main на 2 коммита/);
  assert.match(advice, /git rebase origin\/main/);
});

test('конфликтующие пути читаются, чистятся и сортируются (#364)', () => {
  assert.deepEqual(
    conflictingPaths('src/b.ts\nsrc/a.ts\n\n  src/b.ts  \n'),
    ['src/a.ts', 'src/b.ts'],
  );
  assert.deepEqual(conflictingPaths(''), []);
  assert.deepEqual(conflictingPaths(null), []);
});

test('уход dev во время ревью описывается только когда он был (#364)', () => {
  assert.equal(devMovedNote({ moved: 0 }), null);
  const note = devMovedNote({ moved: 2, sha: 'abc1234' });
  assert.match(note, /продвинулся на 2 коммита/);
  assert.match(note, /`abc1234`/);
  // Вывод, ради которого строка и нужна: вердикт вынесен по другому дереву.
  assert.match(note, /§7\.2/);
});
