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
 * Второе исключение — перенос (#592). Код, который в этом же диапазоне удалён
 * из одного файла и дословно добавлен в другой, новым не является:
 * ответственность за его типы не менялась, и долг в `src/**` не вырос. Без
 * этого послабления любое извлечение подсистемы — то самое, чем долг и
 * снимается по замыслу #342, — краснит гейт ровно за то, что ничего не
 * изменило.
 *
 * Послабление даётся БЛОКУ, а не строке (ревью кода #592, M1). Первая редакция
 * сопоставляла одиночные строки по всему диффу, и этого хватало для обхода:
 * несвязанная уборка удаляет где-то строку с `any`, а новый код добавляет свою,
 * текстуально совпадающую, — и гейт молчит. Совпадение тут не экзотика: в этой
 * базе 887 явных `any`, и типовые однострочники вроде
 * `<span>${...(k as any)}</span>` повторяются буквально (две таких строки
 * встретились в самом коммите переноса).
 *
 * Поэтому перенесённым признаётся только непрерывный кусок длиной не меньше
 * MOVED_BLOCK_MIN строк, встречающийся подряд и целиком среди удалённых строк
 * ОДНОГО файла. Случайно совпасть пятью строками подряд в двух местах одного
 * диффа практически невозможно, а настоящее извлечение подсистемы состоит из
 * таких кусков по определению. Каждый удалённый кусок оплачивает ровно одно
 * добавление: повторная вставка того же блока остаётся новым кодом.
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
  return parseExemption(lineText, 'any-ok');
}

/**
 * То же правило для любого маркера исключения вида `// <marker>: <причина>`.
 * Общее с `no-new-private-writes` (#629): требования к причине не должны
 * расходиться между гейтами.
 */
export function parseExemption(lineText, marker) {
  const escaped = String(marker).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\/\\/\\s*${escaped}\\b\\s*:?\\s*(.*)$`).exec(String(lineText ?? ''));
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

/** Минимальная длина непрерывного куска, который считается переносом. */
export const MOVED_BLOCK_MIN = 5;

/**
 * Строки, которые приехали в файл переносом непрерывного куска (#592).
 *
 * Возвращает по файлу номера таких строк. Сравнение точное, без обрезки
 * пробелов: перенос с изменённым отступом — уже правка, и судить её гейт обязан.
 */
export function movedLinesByFile(diff, { minBlock = MOVED_BLOCK_MIN, details } = {}) {
  const removedByFile = new Map();
  const addedByFile = new Map();
  let target = null;
  let sourcePath = null;
  let next = 0;
  for (const raw of String(diff).split('\n')) {
    if (raw.startsWith('--- ')) {
      const path = raw.slice(4).replace(/^a\//, '');
      sourcePath = path === '/dev/null' ? null : path;
      continue;
    }
    if (raw.startsWith('+++ ')) {
      const path = raw.slice(4).replace(/^b\//, '');
      target = path === '/dev/null' ? null : path;
      continue;
    }
    if (raw.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      next = match ? Number(match[1]) : 0;
      continue;
    }
    if (raw.startsWith('diff --git')) continue;
    if (raw.startsWith('-')) {
      const key = sourcePath || target || '';
      if (!removedByFile.has(key)) removedByFile.set(key, []);
      removedByFile.get(key).push(raw.slice(1));
      continue;
    }
    if (!target || !next) continue;
    if (raw.startsWith('+')) {
      if (!addedByFile.has(target)) addedByFile.set(target, []);
      addedByFile.get(target).push({ line: next, text: raw.slice(1) });
      next += 1;
      continue;
    }
    if (raw.startsWith('\\')) continue;
    next += 1;
  }

  // Позиции удалённых строк по тексту — чтобы искать начало куска за один шаг.
  const index = new Map();
  for (const [path, lines] of removedByFile) {
    lines.forEach((text, at) => {
      if (!index.has(text)) index.set(text, []);
      index.get(text).push({ path, at });
    });
  }
  const spent = new Map();
  const isSpent = (path, at) => spent.get(path)?.has(at) === true;
  const spend = (path, from, length) => {
    if (!spent.has(path)) spent.set(path, new Set());
    for (let step = 0; step < length; step += 1) spent.get(path).add(from + step);
  };

  const moved = new Map();
  for (const [path, added] of addedByFile) {
    // Куски считаются по непрерывным номерам строк: разрыв — конец куска.
    const runs = [];
    for (const item of added) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1].line + 1 === item.line) last.push(item);
      else runs.push([item]);
    }
    for (const run of runs) {
      let at = 0;
      while (at < run.length) {
        let best = null;
        for (const start of index.get(run[at].text) || []) {
          if (isSpent(start.path, start.at)) continue;
          const source = removedByFile.get(start.path) || [];
          let length = 0;
          while (at + length < run.length
            && start.at + length < source.length
            && !isSpent(start.path, start.at + length)
            && source[start.at + length] === run[at + length].text) length += 1;
          if (length >= minBlock && (!best || length > best.length)) {
            best = { path: start.path, at: start.at, length };
          }
        }
        if (!best) { at += 1; continue; }
        spend(best.path, best.at, best.length);
        if (!moved.has(path)) moved.set(path, new Set());
        for (let step = 0; step < best.length; step += 1) moved.get(path).add(run[at + step].line);
        at += best.length;
      }
    }
  }
  // Удалённые строки и те из них, что ушли на оплату переноса, — для гейтов,
  // которым нужен зачёт правок без двойного счёта (#629).
  if (details) {
    details.removedByFile = removedByFile;
    details.spent = spent;
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
