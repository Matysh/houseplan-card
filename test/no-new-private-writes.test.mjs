import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MOVED_BLOCK_MIN } from '../scripts/no-new-any.mjs';
import {
  COVERED_CALLS, countWrites, creditsByFile, findNewPrivateWriteViolations, formatViolation,
  isGatedPath, parsePrivateOk, privateWriteSites,
} from '../scripts/no-new-private-writes.mjs';

// #629. Смоки писали в приватное состояние карточки больше двух тысяч раз и
// поэтому были слепы к обработчикам ввода и путям закрытия. Гейт держит
// приращение на нуле: судятся добавленные строки, как у no-new-any (#342).

const SCRIPT = fileURLToPath(new URL('../scripts/no-new-private-writes.mjs', import.meta.url));
const file = (text, addedLines, path = 'demo/smoke_probe.mjs', movedLines) => ({
  path, text, addedLines: new Set(addedLines), movedLines: movedLines && new Set(movedLines),
});
const run = (args, input) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', input });
/** Унифицированный дифф с нулевым контекстом для одного файла. */
const patch = (path, removed, added, { from = path, start = 1 } = {}) => [
  `diff --git a/${from} b/${path}`,
  `--- ${from === null ? '/dev/null' : `a/${from}`}`,
  `+++ b/${path}`,
  `@@ -${start},${removed.length} +${start},${added.length} @@`,
  ...removed.map((line) => `-${line}`),
  ...added.map((line) => `+${line}`),
].join('\n');

test('запись в приватное поле во всех формах — нарушение (#629 AC1, G1)', () => {
  const text = [
    "c._tool = 'draw';",
    'c._serverCfg.model_version = 7;',
    'c._cfgEpoch++;',
    '--c._cfgEpoch;',
    'delete c._x;',
    "c['_space'] = 'g1';",
    'c._frame ??= null;',
    '[a, c._layout] = pair;',
    'window.__card._mode = "plan";',
  ].join('\n');
  const violations = findNewPrivateWriteViolations({ files: [file(text, [1, 2, 3, 4, 5, 6, 7, 8, 9])] });
  assert.deepEqual(violations.map((v) => [v.line, v.field]), [
    [1, '_tool'], [2, '_serverCfg'], [3, '_cfgEpoch'], [4, '_cfgEpoch'], [5, '_x'],
    [6, '_space'], [7, '_frame'], [8, '_layout'], [9, '_mode'],
  ]);
});

test('не запись в карточку: this, window.__x, обычные поля, чтения, сравнения (#629 AC1, G1)', () => {
  const text = [
    'this._x = 1;',
    'this._state.count++;',
    'window.__card = card;',
    'o.ok = c._tool === "draw";',
    'const t = c._tool;',
    'if (c._mode == "plan") o.mode = true;',
    '// c._tool = "draw" в комментарии',
    'const s = "c._tool = 1";',
    'c._serverCfg.spaces.push(space);',
  ].join('\n');
  assert.deepEqual(findNewPrivateWriteViolations({ files: [file(text, [1, 2, 3, 4, 5, 6, 7, 8, 9])] }), []);
});

test('старая запись на нетронутой строке гейт не блокирует (#629 AC1, G2)', () => {
  const text = "c._tool = 'draw';\nconst fresh = 1;";
  assert.deepEqual(findNewPrivateWriteViolations({ files: [file(text, [2])] }), []);
});

test('вложенная цепочка называет поле, ближайшее к корню (#629 G1)', () => {
  const [site] = privateWriteSites('demo/smoke_probe.mjs',
    'c._serverCfg.spaces[0]._meta.title = "x";');
  assert.deepEqual(site, { line: 1, field: '_serverCfg', kind: 'write' });
  // многострочное присваивание судится по строке, где начинается цель
  const sites = privateWriteSites('demo/smoke_probe.mjs', 'const a = 1;\nc._drag = {\n  id: 1,\n};');
  assert.deepEqual(sites, [{ line: 2, field: '_drag', kind: 'write' }]);
});

test('правка зачитывается только по тому же полю того же файла (#629 AC2, G3)', () => {
  const path = 'demo/smoke_probe.mjs';
  const judge = (removed, added, otherPath = path) => findNewPrivateWriteViolations({
    files: [file(added.join('\n'), added.map((_, i) => i + 1), otherPath)],
    credits: creditsByFile(new Map([[path, removed]])),
  });
  // та же строка, другое значение — правка, а не новая запись
  assert.deepEqual(judge(["c._tool = 'draw';"], ["c._tool = 'select';"]), []);
  // удалённая запись в другое поле новую не оплачивает
  assert.equal(judge(["c._tool = 'draw';"], ["c._mode = 'plan';"]).length, 1);
  // удалённая запись в другом файле — тоже
  assert.equal(judge(["c._tool = 'draw';"], ["c._tool = 'select';"], 'demo/smoke_other.mjs').length, 1);
  // одна удалённая оплачивает одну добавленную
  assert.equal(judge(["c._tool = 'draw';"], ["c._tool = 'select';", "c._tool = 'erase';"]).length, 1);
});

test('перенос блока ≥ MOVED_BLOCK_MIN проходит, одиночная совпавшая строка — нет (#629 AC2, G3)', () => {
  const block = Array.from({ length: MOVED_BLOCK_MIN }, (_, i) => `c._f${i} = ${i};`);
  const moved = [
    patch('demo/smoke_a.mjs', block, []),
    patch('demo/smoke_b.mjs', [], block, { from: null }),
  ].join('\n');
  const one = [
    patch('demo/smoke_a.mjs', ['c._f0 = 0;'], []),
    patch('demo/smoke_b.mjs', [], ['c._f0 = 0;'], { from: null }),
  ].join('\n');
  const fs = { 'demo/smoke_b.mjs': block.join('\n') };
  // CLI в режиме --diff читает файлы с диска, поэтому здесь — чистая функция
  // над тем же разбором, что делает main()
  const judge = (diff, text) => {
    const cli = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { addedLinesByFile, movedLinesByFile } from ${JSON.stringify(new URL('../scripts/no-new-any.mjs', import.meta.url).href)};
      import { creditsByFile, findNewPrivateWriteViolations } from ${JSON.stringify(new URL('../scripts/no-new-private-writes.mjs', import.meta.url).href)};
      const diff = ${JSON.stringify(diff)};
      const details = {};
      const moved = movedLinesByFile(diff, { details });
      const credits = creditsByFile(details.removedByFile, details.spent);
      const added = addedLinesByFile(diff).get('demo/smoke_b.mjs');
      const v = findNewPrivateWriteViolations({ files: [{ path: 'demo/smoke_b.mjs', text: ${JSON.stringify(text)},
        addedLines: added, movedLines: moved.get('demo/smoke_b.mjs') || new Set() }], credits });
      process.stdout.write(JSON.stringify(v.map((x) => x.line)));
    `], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    return JSON.parse(cli.stdout);
  };
  assert.deepEqual(judge(moved, fs['demo/smoke_b.mjs']), []);
  assert.deepEqual(judge(one, 'c._f0 = 0;'), [1]);
});

test('удалённые строки, оплатившие перенос, правку второй раз не оплачивают (#629 G3)', () => {
  const block = Array.from({ length: MOVED_BLOCK_MIN }, () => "c._tool = 'draw';");
  // из a блок уехал в b; в a же добавлена новая запись в то же поле
  const spent = new Map([['demo/smoke_a.mjs', new Set(block.map((_, i) => i))]]);
  const credits = creditsByFile(new Map([['demo/smoke_a.mjs', block]]), spent);
  assert.equal(credits.has('demo/smoke_a.mjs'), false);
  const violations = findNewPrivateWriteViolations({
    files: [file("c._tool = 'select';", [1], 'demo/smoke_a.mjs')], credits,
  });
  assert.equal(violations.length, 1);
});

test('private-ok проходит только с конкретной причиной (#629 AC3, G4)', () => {
  const lines = [
    "c._tool = 'draw'; // private-ok",
    "c._tool = 'draw'; // private-ok: todo",
    "c._tool = 'draw'; // private-ok: потом",
    "c._tool = 'draw'; // private-ok: #700 продукт не перестраивает устройства после принятия конфига",
  ].join('\n');
  const violations = findNewPrivateWriteViolations({ files: [file(lines, [1, 2, 3, 4])] });
  assert.deepEqual(violations.map((v) => v.line), [1, 2, 3]);
  for (const violation of violations) assert.match(violation.reason, /private-ok без конкретной причины/);
  assert.equal(parsePrivateOk('c._x = 1;'), null);
  assert.equal(parsePrivateOk('// private-ok').ok, false);
  // маркер соседнего гейта здесь не действует
  assert.equal(parsePrivateOk('// any-ok: форма события HA не типизирована'), null);
});

test('вызов, покрытый фасадом, — нарушение с подсказкой операции (#629 AC4, G5)', () => {
  const text = [
    "c._setMode('plan');",
    "await c._openRoomEdit(room);",
    'c._openMarkerDialog(dev);',
    "window.__card._openSpaceDialog('edit', 'f1');",
    "c._setMode('view'); // private-ok: #700 режим без вкладок в киоске, фасаду нечего нажать",
    "this._setMode('plan');",
    'c._openAlignDialog();',
  ].join('\n');
  const violations = findNewPrivateWriteViolations({ files: [file(text, [1, 2, 3, 4, 5, 6, 7])] });
  assert.deepEqual(violations.map((v) => [v.line, v.field, v.kind]), [
    [1, '_setMode', 'call'], [2, '_openRoomEdit', 'call'],
    [3, '_openMarkerDialog', 'call'], [4, '_openSpaceDialog', 'call'],
  ]);
  for (const v of violations) assert.ok(v.reason.includes(`__hpTest.${COVERED_CALLS[v.field]}`), v.reason);
  // правка вызова зачитывается, как правка записи
  const credits = creditsByFile(new Map([['demo/smoke_probe.mjs', ["c._setMode('devices');"]]]));
  assert.deepEqual(findNewPrivateWriteViolations({ files: [file("c._setMode('plan');", [1])], credits }), []);
});

test('область гейта — смоки и хелперы харнесса (#629 G2)', () => {
  assert.equal(isGatedPath('demo/smoke_glow.mjs'), true);
  assert.equal(isGatedPath('demo/helpers/hp-test.mjs'), true);
  assert.equal(isGatedPath('demo/helpers/sub/x.mjs'), true);
  assert.equal(isGatedPath('demo/benchmark_glow.mjs'), false);
  assert.equal(isGatedPath('demo/golden/run.mjs'), false);
  assert.equal(isGatedPath('demo/shot_x.mjs'), false);
  assert.equal(isGatedPath('src/probe.ts'), false);
});

test('отчёт называет путь, строку, поле, подсказку и текст (#629 G6)', () => {
  const [v] = findNewPrivateWriteViolations({ files: [file("  c._layout = {};", [1])] });
  const text = formatViolation(v);
  assert.match(text, /demo\/smoke_probe\.mjs:1 \[_layout\]/);
  assert.match(text, /__hpTest\.setLayout/);
  assert.match(text, /c\._layout = \{\};/);
});

test('CLI: --diff красный на добавленной записи и зелёный без неё; --count информационный (#629 G6)', () => {
  // В режиме --diff текст файла читается из дерева, поэтому проба берёт живой
  // смок, который эта задача не переводит, и его первую строку с записью.
  const path = 'demo/smoke_decor.mjs';
  const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const site = privateWriteSites(path, text).find((s) => s.kind === 'write');
  assert.ok(site, 'в пробном смоке должна быть запись');
  const lineText = text.split('\n')[site.line - 1];
  const red = run(['--diff', '-'], patch(path, [], [lineText], { start: site.line }));
  assert.equal(red.status, 1, red.stdout);
  assert.ok(red.stderr.includes(`${path}:${site.line} [${site.field}]`), red.stderr);
  // та же строка как правка записи в то же поле — зачёт
  const edit = run(['--diff', '-'], patch(path, [lineText], [lineText], { start: site.line }));
  assert.equal(edit.status, 0, edit.stderr);
  const commentLine = text.split('\n').findIndex((l) => l.startsWith('//')) + 1;
  const green = run(['--diff', '-'], patch(path, [], ['// x'], { start: commentLine }));
  assert.equal(green.status, 0, green.stderr);
  const count = run(['--count']);
  assert.equal(count.status, 0, count.stderr);
  assert.match(count.stdout, /Итого: записей \d+/);
  const rows = countWrites();
  assert.ok(rows.length > 0 && rows.every((r) => isGatedPath(r.path)));
});
