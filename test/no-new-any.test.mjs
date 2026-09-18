import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MOVED_BLOCK_MIN,
  addedLinesByFile, anyKeywordLines, blameLine, findNewAnyViolations, formatViolation,
  movedLinesByFile, parseAnyOk,
} from '../scripts/no-new-any.mjs';

// #342. Цель гейта — не перетипизировать монолит, а не давать долгу расти. В
// src/** сейчас 1034 вхождения явного any в 49 файлах; разовая замена — месяц
// риска ради нуля пользовательской ценности, поэтому долг снимается при
// извлечении подсистем (#34), а гейт держит приращение на нуле.

const file = (text, addedLines) => ({
  path: 'src/probe.ts', text, addedLines: new Set(addedLines),
});

test('добавленный явный any во всех формах — нарушение (#342 AC1)', () => {
  const text = [
    'export const a = (v: any): number => 1;',
    'export const b = (v: unknown) => v as any;',
    'export const c: any[] = [];',
    'export const d: Record<string, any> = {};',
    'export const e = <any>null;',
  ].join('\n');
  const violations = findNewAnyViolations({ files: [file(text, [1, 2, 3, 4, 5])] });
  assert.deepEqual(violations.map((item) => item.line), [1, 2, 3, 4, 5]);
});

test('старый any на нетронутой строке гейт не блокирует (#342 AC2)', () => {
  // Ровно то свойство, из-за которого гейт вообще применим: существующий долг
  // допустим, пока подсистему не извлекли.
  const text = 'export const old = (v: any) => v;\nexport const fresh = (v: number) => v;';
  assert.deepEqual(findNewAnyViolations({ files: [file(text, [2])] }), []);
});

test('правка строки со старым any — новая ответственность (#342 AC2)', () => {
  // Изменённая строка в диффе выглядит добавленной, и это намеренно: тронул —
  // либо типизируй, либо обоснуй.
  const text = 'export const old = (v: any) => v;';
  assert.equal(findNewAnyViolations({ files: [file(text, [1])] }).length, 1);
});

test('any-ok проходит только с конкретной причиной (#342 AC3)', () => {
  const lines = [
    'const a = (v: any) => v; // any-ok',
    'const b = (v: any) => v; // any-ok: todo',
    'const c = (v: any) => v; // any-ok: потом',
    'const d = (v: any) => v; // any-ok: форма события HA не типизирована в @types',
  ].join('\n');
  const violations = findNewAnyViolations({ files: [file(lines, [1, 2, 3, 4])] });
  assert.deepEqual(violations.map((item) => item.line), [1, 2, 3]);
  for (const violation of violations) assert.match(violation.reason, /без конкретной причины/);
});

test('разбор маркера отличает отсутствие, пустоту и обоснование (#342 AC3)', () => {
  assert.equal(parseAnyOk('const a = 1;'), null);
  assert.equal(parseAnyOk('// any-ok').ok, false);
  assert.equal(parseAnyOk('// any-ok: hack').ok, false);
  assert.equal(parseAnyOk('// any-ok: внешний контракт HA не типизирован').ok, true);
});

test('слово any в прозе, строках и идентификаторах не ловится (#342 AC4)', () => {
  // Регулярка по строке здесь давала бы ложные срабатывания, поэтому текст
  // разбирается парсером TypeScript: узел AnyKeyword — это тип any и ничто
  // другое, а комментарии и литералы узлами такого вида не бывают.
  const text = [
    '/** Choose any room: prose mentions any twice, any. */',
    "export const companyName = 'any company, any size';",
    'export const anyOfThem = (manyRooms: number): string => `pick any of ${manyRooms}`;',
    'export const tpl = `',
    '  multi-line template mentioning any room',
    '`;',
  ].join('\n');
  assert.deepEqual(findNewAnyViolations({ files: [file(text, [1, 2, 3, 4, 5, 6])] }), []);
  assert.equal(anyKeywordLines('src/probe.ts', text).size, 0);
});

test('добавленные строки читаются из диффа с нулевым контекстом (#342 AC5)', () => {
  const diff = [
    'diff --git a/src/one.ts b/src/one.ts',
    '--- a/src/one.ts',
    '+++ b/src/one.ts',
    '@@ -10,0 +11,2 @@',
    '+const a = 1;',
    '+const b = 2;',
    '@@ -20,1 +22,1 @@',
    '-const old = 3;',
    '+const neu = 3;',
    'diff --git a/src/two.ts b/src/two.ts',
    '--- /dev/null',
    '+++ b/src/two.ts',
    '@@ -0,0 +1,1 @@',
    '+const c = 4;',
  ].join('\n');
  const added = addedLinesByFile(diff);
  assert.deepEqual([...added.get('src/one.ts')].sort((a, b) => a - b), [11, 12, 22]);
  assert.deepEqual([...added.get('src/two.ts')], [1]);
});

test('удалённый файл не даёт нарушений: судить нечего (#342)', () => {
  const diff = [
    '--- a/src/gone.ts',
    '+++ /dev/null',
    '@@ -1,1 +0,0 @@',
    '-const a: any = 1;',
  ].join('\n');
  assert.equal(addedLinesByFile(diff).size, 0);
});

// --- источник находки (#388) -----------------------------------------------

test('находка называет коммит, который добавил строку (#388)', () => {
  // Диапазон теперь считается от последнего зелёного предка, поэтому находка
  // может относиться к чужому коммиту с отменённым прогоном. Без имени
  // источника сообщение обвиняло бы того, кто пушнул следующим — ровно то, что
  // пришлось чинить в #386 для golden.
  const porcelain = '3fa1c0de9b8a7654 12 12 1\nauthor Кто-то\nsummary правка\n';
  assert.equal(blameLine('src/a.ts', 12, () => porcelain), '3fa1c0de');
  assert.equal(
    formatViolation({ path: 'src/a.ts', line: 12, reason: 'нет обоснования' }, '3fa1c0de'),
    '  src/a.ts:12 (добавил 3fa1c0de) — нет обоснования',
  );
});

test('недоступный blame не выдумывает источник и не роняет отчёт (#388)', () => {
  for (const answer of ['', 'мусор без sha\n', null, undefined]) {
    assert.equal(blameLine('src/a.ts', 1, () => answer), '');
  }
  assert.equal(
    formatViolation({ path: 'src/a.ts', line: 1, reason: 'нет обоснования' }, ''),
    '  src/a.ts:1 — нет обоснования',
  );
});

// #592. Извлечение подсистемы — то, чем по замыслу #342 и снимается долг, —
// выглядит для диффа как тысяча добавленных строк. Судить по ним «новый код»
// значит требовать типизации ровно там, где ничего не изменилось, и заодно
// ломать доказательство переноса: тело обязано совпадать побайтово.
//
// Послабление даётся блоку, а не строке (ревью кода #592, M1): одиночное
// совпадение текста подделывается слишком легко.

const block = (n, prefix = 'line') => Array.from({ length: n }, (_, i) => `  const ${prefix}${i} = ${i};`);

test('#592 непрерывный перенесённый кусок новым кодом не считается', () => {
  const body = [...block(3), '  const handler = (e: any) => e;', ...block(3, 'tail')];
  const diff = [
    'diff --git a/src/big.ts b/src/big.ts',
    '--- a/src/big.ts',
    '+++ b/src/big.ts',
    `@@ -10,${body.length} +10,0 @@`,
    ...body.map((line) => `-${line}`),
    'diff --git a/src/editors/part.ts b/src/editors/part.ts',
    '--- /dev/null',
    '+++ b/src/editors/part.ts',
    `@@ -0,0 +1,${body.length} @@`,
    ...body.map((line) => `+${line}`),
  ].join('\n');
  const moved = movedLinesByFile(diff).get('src/editors/part.ts');
  assert.equal(moved?.size, body.length, 'перенесён весь кусок целиком');

  const violations = findNewAnyViolations({ files: [{
    path: 'src/editors/part.ts', text: `${body.join('\n')}\n`,
    addedLines: new Set(body.map((_, i) => i + 1)),
    movedLines: moved,
  }] });
  assert.deepEqual(violations, [], 'внутри перенесённого куска новых any нет');
});

test('#592 одиночное совпадение переносом не считается (M1)', () => {
  // Обход первой редакции: несвязанная уборка удаляет типовую строку с any,
  // а новый файл добавляет свою — текстуально такую же. Это не перенос.
  const line = '  <span>${this.host._t(k as any)}</span>';
  const diff = [
    'diff --git a/src/unrelated.ts b/src/unrelated.ts',
    '--- a/src/unrelated.ts',
    '+++ b/src/unrelated.ts',
    '@@ -40,1 +40,0 @@',
    `-${line}`,
    'diff --git a/src/fresh.ts b/src/fresh.ts',
    '--- /dev/null',
    '+++ b/src/fresh.ts',
    '@@ -0,0 +1,1 @@',
    `+${line}`,
  ].join('\n');
  assert.equal(movedLinesByFile(diff).size, 0, 'одна строка переносом не признаётся');

  const violations = findNewAnyViolations({ files: [{
    path: 'src/fresh.ts', text: `${line}\n`,
    addedLines: new Set([1]),
    movedLines: movedLinesByFile(diff).get('src/fresh.ts'),
  }] });
  assert.equal(violations.length, 1, 'новый any остаётся находкой');
});

test('#592 кусок короче порога переносом не считается', () => {
  const body = block(MOVED_BLOCK_MIN - 1);
  const diff = [
    '--- a/src/big.ts',
    '+++ b/src/big.ts',
    `@@ -10,${body.length} +10,0 @@`,
    ...body.map((line) => `-${line}`),
    '--- /dev/null',
    '+++ b/src/editors/part.ts',
    `@@ -0,0 +1,${body.length} @@`,
    ...body.map((line) => `+${line}`),
  ].join('\n');
  assert.equal(movedLinesByFile(diff).size, 0);
});

test('#592 один удалённый кусок оплачивает ровно одну вставку', () => {
  const body = block(MOVED_BLOCK_MIN);
  const diff = [
    '--- a/src/big.ts',
    '+++ b/src/big.ts',
    `@@ -10,${body.length} +10,0 @@`,
    ...body.map((line) => `-${line}`),
    '--- /dev/null',
    '+++ b/src/editors/part.ts',
    `@@ -0,0 +1,${body.length * 2} @@`,
    ...body.map((line) => `+${line}`),
    ...body.map((line) => `+${line}`),
  ].join('\n');
  const moved = [...(movedLinesByFile(diff).get('src/editors/part.ts') || [])].sort((a, b) => a - b);
  assert.deepEqual(moved, body.map((_, i) => i + 1), 'вторая копия остаётся новым кодом');
});

test('#592 перенос с изменённым отступом переносом не считается', () => {
  const body = block(MOVED_BLOCK_MIN + 2);
  const diff = [
    '--- a/src/big.ts',
    '+++ b/src/big.ts',
    `@@ -10,${body.length} +10,0 @@`,
    ...body.map((line) => `-      ${line.trim()}`),
    '--- /dev/null',
    '+++ b/src/editors/part.ts',
    `@@ -0,0 +1,${body.length} @@`,
    ...body.map((line) => `+  ${line.trim()}`),
  ].join('\n');
  assert.equal(movedLinesByFile(diff).size, 0);
});
