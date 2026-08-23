import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * Правило одного источника для числа, видимого пользователю (#254, ревизия
 * 2026-08-23).
 *
 * Три дефекта за месяц имели одну причину: одно и то же число считалось в двух
 * местах и расходилось.
 *
 *   #234 — превью «резинки» показывало 12 см, запись сохраняла 24;
 *   #233 — подпись ресайза мерила по осевым линиям, площадь рядом — по полу;
 *   #234 (как нашли) — подсветка инструмента «Толщина» врала согласованно
 *          со записью, потому что обе брали толщину по-своему.
 *
 * Полностью механизировать правило нельзя: «одно и то же число» — смысловое
 * понятие. Механизируется его самая дорогая часть — форматирование величин.
 * Пока строку с единицей измерения собирает ровно один форматтер на величину,
 * разойтись двум подписям невозможно; как только рядом появляется второе место,
 * склеивающее число с «м» или «м²», расхождение становится вопросом времени.
 */

const UNIT_FORMATTING = new RegExp(
  // Число, попадающее в строку: либо интерполяция, либо конкатенация после
  // toFixed. Дальше — единица измерения, без требования разделителя: в
  // конкатенации кавычку уже съел предыдущий кусок.
  '(\\$\\{[^{}]*\\}|toFixed\\([0-9]\\)\\s*\\)?\\s*\\+\\s*[\'`])'
  // `\\b` в JS считает границу по ASCII, поэтому после кириллической буквы он
  // не срабатывает: для «см» и «м» нужен явный отрицательный просмотр.
  + '\\s*(m²|ft²|м²|m\\b|cm\\b|см(?![а-яё])|м(?![а-яё])|′|″)',
  'g',
);

/**
 * Единственные места, которым позволено склеивать число с единицей измерения.
 * Окно намеренно узкое: разрешается сам форматтер, а не файл целиком —
 * иначе правило растворится в первом же большом модуле.
 */
const FORMATTERS = [
  { file: 'src/logic.ts', anchor: 'export function formatLength(', lines: 12 },
  { file: 'src/resize.ts', anchor: 'export function formatArea(', lines: 8 },
];

const sourceFiles = (root) => {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(path);
    }
  };
  walk(join(root, 'src'));
  return out;
};

const allowedWindows = (root) => FORMATTERS.map((formatter) => {
  const text = readFileSync(join(root, formatter.file), 'utf8');
  const index = text.indexOf(formatter.anchor);
  assert.ok(index >= 0, `${formatter.file}: не найден форматтер ${formatter.anchor}`);
  const from = text.slice(0, index).split('\n').length;
  return { file: join(root, formatter.file), from, to: from + formatter.lines };
});

export function unitFormattingSites(root = repoRoot) {
  const windows = allowedWindows(root);
  const sites = [];
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, 'utf8');
    UNIT_FORMATTING.lastIndex = 0;
    for (const match of text.matchAll(UNIT_FORMATTING)) {
      const line = text.slice(0, match.index).split('\n').length;
      const allowed = windows.some((window) =>
        window.file === file && line >= window.from && line <= window.to);
      if (!allowed) {
        sites.push(`${file.slice(root.length)}:${line} ${JSON.stringify(match[0].trim())}`);
      }
    }
  }
  return sites;
}

test('строку с единицей измерения собирает только канонический форматтер (#254)', () => {
  assert.deepEqual(unitFormattingSites(), [],
    'число, видимое пользователю, обязано иметь один источник: расхождение подписей '
    + 'уже стоило продукту #233 и #234');
});

test('детектор действительно ловит самодельное форматирование (#254)', () => {
  // Проверка на проверку: правило, которое не может сработать, бесполезно.
  // Прогоняем детектор по временной копии дерева с одной рукодельной строкой.
  const samples = [
    'const label = `${(cm / 100).toFixed(2)} m`;',
    "const label = (cm / 100).toFixed(2) + ' м';",
    'const label = `${value} м²`;',
  ];
  for (const sample of samples) {
    UNIT_FORMATTING.lastIndex = 0;
    assert.ok(UNIT_FORMATTING.test(sample), `детектор не увидел: ${sample}`);
  }
  const clean = [
    'const label = this._fmtLen(a, b);',
    'const cm = wallCmToUnits(50, cellCm, gridPitch);',
    'const text = formatArea(area, imperial);',
  ];
  for (const sample of clean) {
    UNIT_FORMATTING.lastIndex = 0;
    assert.ok(!UNIT_FORMATTING.test(sample), `ложное срабатывание: ${sample}`);
  }
});

test('оба канонических форматтера на месте и единственны (#254)', () => {
  // Если форматтер переименуют или размножат, правило должно об этом сказать,
  // а не тихо разрешить всё.
  for (const formatter of FORMATTERS) {
    const text = readFileSync(join(repoRoot, formatter.file), 'utf8');
    const count = text.split(formatter.anchor).length - 1;
    assert.equal(count, 1, `${formatter.file}: ожидался ровно один ${formatter.anchor}`);
  }
});
