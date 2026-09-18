#!/usr/bin/env node
/**
 * Новый код не добавляет `any` (#342).
 *
 *   node scripts/no-new-any.mjs                        # origin/dev...HEAD
 *   node scripts/no-new-any.mjs --base origin/dev --head HEAD
 *   node scripts/no-new-any.mjs --diff patch.diff      # или `-` для stdin
 *
 * Зачем гейт, а не разовая типизация. В `src/**` сейчас 1034 вхождения явного
 * `any` в 49 файлах — перетипизировать это одним заходом значит месяц риска ради
 * нуля пользовательской ценности. Долг снимается при плановом извлечении
 * подсистем (#425, прежний #34). Задача гейта одна: не давать долгу расти.
 *
 * Практический вред уже случался: несоответствие форм (`d.source.kind` против
 * строкового `source`) компилятор не поймал, потому что путь был через `any`, и
 * это всплыло только в браузерном смоке.
 *
 * Почему через компилятор, а не регуляркой. Регулярка по строке даёт ложные
 * срабатывания там, где слово `any` живёт в прозе: внутри шаблонной строки
 * `html` или в комментарии. Здесь текст файла разбирается настоящим парсером
 * TypeScript, и узел `AnyKeyword` — это ровно тип `any` и ничто другое.
 * Комментарии, строковые литералы и идентификаторы вида `company`, `anyOf`,
 * `manyRooms` узлами этого вида не являются, поэтому false positive невозможен
 * не по старанию, а по построению.
 *
 * Исключение — на той же строке: `// any-ok: <причина>`. Причина обязана быть
 * конкретной: голый маркер, пустая или шаблонная причина («todo», «потом»,
 * «надо») гейт не проходят. Формулировка вида «внешний контракт HA не
 * типизирован» проходит.
 *
 * Второе исключение — перенос (#592). Строка, которая в этом же диапазоне
 * удалена из одного файла и добавлена в другой дословно, новым кодом не
 * является: ответственность за её тип не менялась, и долг в `src/**` не вырос.
 * Гейт считает такие строки перенесёнными и не судит их, но бюджет ведёт
 * мультимножеством: два добавления при одном удалении дают одну находку.
 * Без этого любое извлечение подсистемы — то самое, чем долг и снимается по
 * замыслу #342, — краснит гейт ровно за то, что ничего не изменило.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Причины, которые ничего не объясняют: маркер вместо обоснования. */
const EMPTY_REASONS = [
  'todo', 'fixme', 'later', 'wip', 'temporary', 'temp', 'hack', 'refactor',
  'потом', 'надо', 'позже', 'временно', 'разобраться', 'исправить',
];
const MIN_REASON_LENGTH = 12;

/**
 * Разобрать исключение на строке. Возвращает `null`, если маркера нет.
 * `ok: false` означает, что маркер есть, но обоснования в нём нет.
 */
export function parseAnyOk(lineText) {
  const match = /\/\/\s*any-ok\b\s*:?\s*(.*)$/.exec(String(lineText ?? ''));
  if (!match) return null;
  const reason = match[1].trim().replace(/\s+/g, ' ');
  const bare = reason.replace(/[.…!?—–-]+$/g, '').trim().toLowerCase();
  const ok = reason.length >= MIN_REASON_LENGTH && !EMPTY_REASONS.includes(bare);
  return { reason, ok };
}

/** Номера строк, где TypeScript видит тип `any`. */
export function anyKeywordLines(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const lines = new Map();
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      lines.set(line + 1, (lines.get(line + 1) || 0) + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

/**
 * Нарушения: `any` на строке, которую диапазон объявил добавленной.
 *
 * Изменённая строка в диффе выглядит добавленной, и это намеренно: правка
 * строки со старым `any` — новая ответственность, её либо типизируют, либо
 * обосновывают исключением.
 */
export function findNewAnyViolations({ files }) {
  const violations = [];
  for (const file of files) {
    const textLines = String(file.text).split('\n');
    for (const [line, count] of anyKeywordLines(file.path, file.text)) {
      if (!file.addedLines.has(line)) continue;
      if (file.movedLines?.has(line)) continue;
      const lineText = textLines[line - 1] ?? '';
      const exemption = parseAnyOk(lineText);
      if (exemption?.ok) continue;
      violations.push({
        path: file.path,
        line,
        count,
        text: lineText.trim(),
        reason: exemption
          ? `маркер any-ok без конкретной причины: «${exemption.reason || '(пусто)'}»`
          : 'явный any на добавленной строке',
      });
    }
  }
  return violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

/** Добавленные строки на файл из унифицированного диффа с нулевым контекстом. */
export function addedLinesByFile(diff) {
  const files = new Map();
  let current = null;
  let next = 0;
  for (const raw of String(diff).split('\n')) {
    if (raw.startsWith('+++ ')) {
      const path = raw.slice(4).replace(/^b\//, '');
      current = path === '/dev/null' ? null : path;
      if (current && !files.has(current)) files.set(current, new Set());
      continue;
    }
    if (raw.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      next = match ? Number(match[1]) : 0;
      continue;
    }
    if (!current || !next) continue;
    if (raw.startsWith('+')) { files.get(current).add(next); next += 1; continue; }
    if (raw.startsWith('-') || raw.startsWith('\\')) continue;
    next += 1;
  }
  return files;
}

/**
 * Строки, добавленные одним файлом и дословно удалённые другим (#592).
 *
 * Возвращает по файлу номера таких строк. Сравнение точное, без обрезки
 * пробелов: перенос с изменением отступа — уже правка, и судить её гейт обязан.
 * Бюджет ведётся мультимножеством: одно удаление покрывает одно добавление.
 */
export function movedLinesByFile(diff) {
  const removed = new Map();
  const added = [];
  let current = null;
  let next = 0;
  for (const raw of String(diff).split('\n')) {
    if (raw.startsWith('+++ ')) {
      const path = raw.slice(4).replace(/^b\//, '');
      current = path === '/dev/null' ? null : path;
      continue;
    }
    if (raw.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      next = match ? Number(match[1]) : 0;
      continue;
    }
    if (raw.startsWith('---') || raw.startsWith('diff --git')) continue;
    if (raw.startsWith('-')) {
      const text = raw.slice(1);
      removed.set(text, (removed.get(text) || 0) + 1);
      continue;
    }
    if (!current || !next) continue;
    if (raw.startsWith('+')) { added.push({ path: current, line: next, text: raw.slice(1) }); next += 1; continue; }
    if (raw.startsWith('\\')) continue;
    next += 1;
  }
  const moved = new Map();
  for (const item of added) {
    const budget = removed.get(item.text) || 0;
    if (!budget) continue;
    removed.set(item.text, budget - 1);
    if (!moved.has(item.path)) moved.set(item.path, new Set());
    moved.get(item.path).add(item.line);
  }
  return moved;
}

const isProductTypeScript = (path) => /^src\/.*\.ts$/.test(path);

/**
 * Коммит, добавивший строку (issue #388).
 *
 * Диапазон гейта теперь считается от последнего ДОКАЗАННО зелёного предка, а не
 * от головы предыдущего пуша, — и это значит, что находка может относиться к
 * чужому коммиту, чей прогон был отменён. Без имени источника такое сообщение
 * обвиняет того, кто пушнул следующим: ровно то, что пришлось чинить в #386 для
 * golden.
 */
export function blameLine(path, line, runner = defaultBlame) {
  const out = runner(path, line);
  const match = typeof out === 'string' ? out.match(/^([0-9a-f]{7,40})\s/) : null;
  return match ? match[1].slice(0, 8) : '';
}

const defaultBlame = (path, line) => {
  const run = spawnSync('git', [
    '-C', ROOT, 'blame', '-L', `${line},${line}`, '--porcelain', 'HEAD', '--', path,
  ], { encoding: 'utf8' });
  return run.status === 0 ? run.stdout : '';
};

/** Строка отчёта о находке. Источник печатается, только если он известен. */
export function formatViolation(violation, source) {
  const where = source ? ` (добавил ${source})` : '';
  return `  ${violation.path}:${violation.line}${where} — ${violation.reason}`;
}

function main(argv) {
  const value = (name, fallback) => {
    const found = argv.find((item) => item.startsWith(`--${name}=`));
    if (found) return found.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[index + 1] : fallback;
  };
  const diffArg = value('diff');
  let diff;
  if (diffArg) {
    diff = diffArg === '-' ? readFileSync(0, 'utf8') : readFileSync(diffArg, 'utf8');
  } else {
    const base = value('base', 'origin/dev');
    const head = value('head', 'HEAD');
    const run = spawnSync('git', [
      '-C', ROOT, 'diff', '--unified=0', '--no-color', `${base}...${head}`, '--', 'src',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
      console.error(`git diff ${base}...${head} не удался:\n${run.stderr}`);
      return 2;
    }
    diff = run.stdout;
  }

  const added = addedLinesByFile(diff);
  const movedByFile = movedLinesByFile(diff);
  const files = [];
  for (const [path, addedLines] of added) {
    if (!isProductTypeScript(path) || !addedLines.size) continue;
    const full = resolve(ROOT, path);
    // Файл мог быть удалён в этом же диапазоне — судить нечего.
    if (!existsSync(full)) continue;
    files.push({
      path, text: readFileSync(full, 'utf8'), addedLines,
      movedLines: movedByFile.get(path) || new Set(),
    });
  }

  const violations = findNewAnyViolations({ files });
  const scanned = files.reduce((sum, file) => sum + file.addedLines.size, 0);
  const moved = files.reduce((sum, file) => sum + file.movedLines.size, 0);
  console.log(`Проверено добавленных строк в src/**/*.ts: ${scanned}`
    + ` в ${files.length} файл(ах).`
    + (moved ? ` Из них перенесены дословно из других файлов диапазона: ${moved}.` : ''));
  if (!violations.length) {
    console.log('Новых any нет.');
    return 0;
  }
  console.error(`\nНовый явный any: ${violations.length}\n`);
  for (const violation of violations) {
    console.error(formatViolation(violation, blameLine(violation.path, violation.line)));
    console.error(`    ${violation.text}`);
  }
  console.error('\nЛибо типизируйте, либо обоснуйте на той же строке:');
  console.error('  // any-ok: <конкретная причина, почему тип недоступен>');
  console.error('Существующий долг снимается при извлечении подсистем (#34, #342),');
  console.error('а не разовой заменой: в src/** его 1034 вхождения в 49 файлах.');
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
