#!/usr/bin/env node
/**
 * Смоки не добавляют записей в приватное состояние карточки (#629).
 *
 *   node scripts/no-new-private-writes.mjs                        # origin/dev...HEAD
 *   node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD
 *   node scripts/no-new-private-writes.mjs --diff patch.diff      # или `-` для stdin
 *   node scripts/no-new-private-writes.mjs --count                # остаток на HEAD, не гейт
 *
 * Зачем. Смок, который открывает диалог присваиванием `c._roomDialog = {...}` и
 * меняет план присваиванием `c._serverCfg = …`, зелёный и тогда, когда кнопка,
 * поле ввода и путь закрытия сломаны: он обходит ровно то, что должен
 * проверять. И каждое переименование поля в монолите красит десятки таких
 * смоков без изменения поведения. На 22.09 записей было больше двух тысяч;
 * переписать их разом — месяц работы, поэтому гейт, как `no-new-any` (#342),
 * держит только приращение: судятся добавленные строки диффа.
 *
 * Что считается записью (G1). Разбор настоящим парсером TypeScript: присваивание
 * любым оператором, `++`/`--`, `delete`, если в цепочке доступа левой части есть
 * сегмент `_x` (`.x` или `['x']`). `c._serverCfg.model_version = 7` — запись в
 * `_serverCfg`; `window.__card = …` и `o.ok = …` — нет. Цепочка от `this` —
 * собственный объект страницы, не карточка, и не считается.
 *
 * Вызов, покрытый фасадом (G5): `._setMode(`, `._openRoomEdit(`,
 * `._openMarkerDialog(`, `._openSpaceDialog(` — для них есть операция
 * `window.__hpTest` (demo/helpers/hp-test.mjs), которая нажимает настоящую
 * кнопку.
 *
 * Зачёт (G3). Правка строки — не новая ответственность, если поле то же:
 * каждая удалённая запись в поле F файла X оплачивает одну добавленную в то же
 * F того же X. Перенос непрерывного куска из одного файла в другой — не новый
 * код; куски находит `movedLinesByFile` из `no-new-any` (#592), и удалённые
 * строки, ушедшие на оплату переноса, второй раз правку не оплачивают.
 *
 * Исключение (G4) — на той же строке: `// private-ok: <конкретная причина>`,
 * с теми же требованиями к причине, что у `any-ok`.
 *
 * Чего гейт не видит — мутации через вызовы (`c._serverCfg.spaces.push(...)`,
 * `Object.assign(c, …)`) и записи через локальный псевдоним. Это закрывает
 * правило ревью (PROCESS.md §2.7): приватное поле — только для чтения в
 * ассертах.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { addedLinesByFile, movedLinesByFile, parseExemption } from './no-new-any.mjs';
import { isMainModule } from './spawn-portable.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Имя сегмента, который считается приватным состоянием карточки. */
const PRIVATE_SEGMENT = /^_[A-Za-z$]/;

/** Приватные вызовы, для которых у `window.__hpTest` есть операция (G5). */
export const COVERED_CALLS = {
  _setMode: 'setMode',
  _openRoomEdit: 'openRoomEdit',
  _openMarkerDialog: 'openMarkerDialog',
  _openSpaceDialog: 'openSpaceDialog',
};

/** Подсказка: какой публичной поверхностью заменить запись в поле. */
const FIELD_HINTS = {
  _serverCfg: 'setServerConfig', _cfgEpoch: 'setServerConfig', _modelCache: 'setServerConfig',
  _frame: 'setServerConfig', _regSignature: 'setServerConfig', _layout: 'setLayout',
  _tool: 'setTool', _mode: 'setMode', _space: 'switchSpace',
  _markerDialog: 'openMarkerDialog + input + close', _spaceDialog: 'openSpaceDialog + input + close',
  _roomDialog: 'openRoomEdit + input + close',
};

/** Область гейта (G2): смоки и хелперы харнесса. */
export const isGatedPath = (path) => /^demo\/smoke_[^/]*\.mjs$/.test(path)
  || /^demo\/helpers\/(?:.+\/)?[^/]+\.mjs$/.test(path);

/** Разобрать исключение `// private-ok: …`; `null`, если маркера нет. */
export const parsePrivateOk = (lineText) => parseExemption(lineText, 'private-ok');

const UPDATE_OPERATORS = new Set([ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken]);
const isAssignment = (kind) => kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

/**
 * Приватный сегмент цепочки доступа, ближайший к её корню, либо `null`.
 * Корень `this` — не карточка (G1).
 */
export function privateFieldOf(expression) {
  let field = null;
  let node = expression;
  for (;;) {
    if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)
        || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      node = node.expression;
    } else if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.name) && PRIVATE_SEGMENT.test(node.name.text)) field = node.name.text;
      node = node.expression;
    } else if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      if (key && ts.isStringLiteralLike(key) && PRIVATE_SEGMENT.test(key.text)) field = key.text;
      node = node.expression;
    } else if (ts.isCallExpression(node)) {
      node = node.expression;
    } else break;
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) return null;
  return field;
}

/** Цели присваивания, включая деструктуризацию `[a, c._x] = …`. */
function assignmentTargets(left) {
  if (ts.isArrayLiteralExpression(left)) {
    return left.elements.flatMap((el) => assignmentTargets(ts.isSpreadElement(el) ? el.expression : el));
  }
  if (ts.isObjectLiteralExpression(left)) {
    return left.properties.flatMap((prop) => {
      if (ts.isPropertyAssignment(prop)) return assignmentTargets(prop.initializer);
      if (ts.isSpreadAssignment(prop)) return assignmentTargets(prop.expression);
      return [];
    });
  }
  if (ts.isBinaryExpression(left) && left.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return assignmentTargets(left.left); // значение по умолчанию в деструктуризации
  }
  return [left];
}

/** Имя приватного метода, если вызов покрыт фасадом (G5). */
function coveredCallOf(call) {
  const callee = call.expression;
  let name = null;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) name = callee.name.text;
  else if (ts.isElementAccessExpression(callee) && callee.argumentExpression
    && ts.isStringLiteralLike(callee.argumentExpression)) name = callee.argumentExpression.text;
  if (!name || !Object.hasOwn(COVERED_CALLS, name)) return null;
  if (rootIsThis(callee.expression)) return null;
  return name;
}

function rootIsThis(expression) {
  let node = expression;
  while (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
    || ts.isCallExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
    node = node.expression;
  }
  return node.kind === ts.SyntaxKind.ThisKeyword;
}

/**
 * Места записи и покрытых вызовов в тексте: `{ line, field, kind }`,
 * `kind` — `write` или `call`. Строка — начало цели (или вызываемого).
 */
export function privateWriteSites(path, text) {
  const source = ts.createSourceFile(path, String(text), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const sites = [];
  const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const record = (target, kind) => {
    const field = privateFieldOf(target);
    if (field) sites.push({ line: lineOf(target), field, kind });
  };
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && isAssignment(node.operatorToken.kind)) {
      for (const target of assignmentTargets(node.left)) record(target, 'write');
    }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && UPDATE_OPERATORS.has(node.operator)) {
      record(node.operand, 'write');
    }
    if (ts.isDeleteExpression(node)) record(node.expression, 'write');
    if (ts.isCallExpression(node)) {
      const method = coveredCallOf(node);
      if (method) sites.push({ line: lineOf(node.expression), field: method, kind: 'call' });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites.sort((a, b) => a.line - b.line);
}

/** Ключ зачёта: удалённая запись оплачивает только запись того же вида в то же поле. */
const creditKey = (site) => `${site.kind}:${site.field}`;

/**
 * Бюджет зачёта по файлу: удалённые записи, не ушедшие на оплату переноса.
 * Удалённая строка разбирается отдельно — парсер терпим к незакрытым скобкам,
 * а для зачёта нужна только левая часть.
 */
export function creditsByFile(removedByFile, spent = new Map()) {
  const out = new Map();
  for (const [path, lines] of removedByFile || []) {
    const budget = new Map();
    lines.forEach((text, at) => {
      if (spent.get(path)?.has(at)) return;
      for (const site of privateWriteSites(path, text)) {
        const key = creditKey(site);
        budget.set(key, (budget.get(key) || 0) + 1);
      }
    });
    if (budget.size) out.set(path, budget);
  }
  return out;
}

function hintFor(site) {
  if (site.kind === 'call') return `→ __hpTest.${COVERED_CALLS[site.field]}`;
  const op = FIELD_HINTS[site.field];
  return op ? `→ __hpTest.${op}` : '→ DOM с контрактными хуками, события фикстуры или __hpTest';
}

/**
 * Нарушения на добавленных строках.
 *
 * `files` — `{ path, text, addedLines, movedLines? }`; `credits` — из
 * `creditsByFile`. Изменённая строка в диффе выглядит добавленной: правка
 * судится, но запись в то же поле оплачивается удалённой.
 */
export function findNewPrivateWriteViolations({ files, credits = new Map() }) {
  const violations = [];
  for (const file of files) {
    const textLines = String(file.text).split('\n');
    const budget = new Map(credits.get(file.path) || []);
    for (const site of privateWriteSites(file.path, file.text)) {
      if (!file.addedLines.has(site.line)) continue;
      if (file.movedLines?.has(site.line)) continue;
      const lineText = textLines[site.line - 1] ?? '';
      const exempt = parsePrivateOk(lineText);
      if (exempt && exempt.ok) continue;
      const key = creditKey(site);
      if ((budget.get(key) || 0) > 0) { budget.set(key, budget.get(key) - 1); continue; }
      violations.push({
        path: file.path,
        line: site.line,
        field: site.field,
        kind: site.kind,
        text: lineText.trim(),
        reason: exempt
          ? `маркер private-ok без конкретной причины: «${exempt.reason || '(пусто)'}»`
          : site.kind === 'call'
            ? `вызов приватного ${site.field}() на добавленной строке ${hintFor(site)}`
            : `запись в приватное ${site.field} на добавленной строке ${hintFor(site)}`,
      });
    }
  }
  return violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

/** Строка отчёта (G6): путь:строка, поле, причина; текст строки — следующей. */
export function formatViolation(violation) {
  return `  ${violation.path}:${violation.line} [${violation.field}] — ${violation.reason}\n    ${violation.text}`;
}

/** Все файлы области G2 на диске. */
function gatedFiles(root) {
  const demo = join(root, 'demo');
  const out = [];
  for (const name of readdirSync(demo)) if (isGatedPath(`demo/${name}`)) out.push(`demo/${name}`);
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), path);
      else if (isGatedPath(path)) out.push(path);
    }
  };
  walk(join(demo, 'helpers'), 'demo/helpers');
  return out.sort();
}

/** Остаток записей по файлам — информационный режим `--count`. */
export function countWrites(root = ROOT) {
  const byFile = [];
  for (const path of gatedFiles(root)) {
    const sites = privateWriteSites(path, readFileSync(join(root, path), 'utf8'));
    const writes = sites.filter((site) => site.kind === 'write').length;
    const calls = sites.length - writes;
    if (writes || calls) byFile.push({ path, writes, calls });
  }
  return byFile;
}

function main(argv) {
  const value = (name, fallback) => {
    const found = argv.find((item) => item.startsWith(`--${name}=`));
    if (found) return found.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[index + 1] : fallback;
  };

  if (argv.includes('--count')) {
    const byFile = countWrites(ROOT);
    const writes = byFile.reduce((sum, f) => sum + f.writes, 0);
    const calls = byFile.reduce((sum, f) => sum + f.calls, 0);
    const lines = byFile
      .sort((a, b) => b.writes - a.writes || a.path.localeCompare(b.path))
      .map((f) => `${String(f.writes).padStart(5)} ${String(f.calls).padStart(5)}  ${f.path}`);
    lines.push(`Итого: записей ${writes}, покрытых фасадом вызовов ${calls} в ${byFile.length} файл(ах).`);
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  }

  const diffArg = value('diff');
  let diff;
  if (diffArg) {
    diff = diffArg === '-' ? readFileSync(0, 'utf8') : readFileSync(diffArg, 'utf8');
  } else {
    const base = value('base', 'origin/dev');
    const head = value('head', 'HEAD');
    const run = spawnSync('git', [
      '-C', ROOT, 'diff', '--unified=0', '--no-color', `${base}...${head}`, '--', 'demo',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
      console.error(`git diff ${base}...${head} не удался:\n${run.stderr}`);
      return 2;
    }
    diff = run.stdout;
  }

  const added = addedLinesByFile(diff);
  const details = {};
  const movedByFile = movedLinesByFile(diff, { details });
  const credits = creditsByFile(details.removedByFile, details.spent);
  const files = [];
  for (const [path, addedLines] of added) {
    if (!isGatedPath(path) || !addedLines.size) continue;
    const full = resolve(ROOT, path);
    if (!existsSync(full)) continue;
    files.push({
      path, text: readFileSync(full, 'utf8'), addedLines,
      movedLines: movedByFile.get(path) || new Set(),
    });
  }

  const violations = findNewPrivateWriteViolations({ files, credits });
  const scanned = files.reduce((sum, file) => sum + file.addedLines.size, 0);
  console.log(`Проверено добавленных строк в demo/smoke_*.mjs и demo/helpers/**: ${scanned}`
    + ` в ${files.length} файл(ах).`);
  if (!violations.length) {
    console.log('Новых записей в приватное состояние карточки нет.');
    return 0;
  }
  console.error(`\nНовая запись в приватное состояние карточки: ${violations.length}\n`);
  for (const violation of violations) console.error(formatViolation(violation));
  console.error('\nСмок входит в сценарий через публичную поверхность: DOM с контрактными хуками');
  console.error('(docs/data-hp-contract.json), события фикстуры, window.__hpTest (docs/TESTING.md, #629).');
  console.error('Приватное поле — только для чтения в ассертах. Если иначе нельзя — на той же строке:');
  console.error('  // private-ok: <конкретная причина, лучше со ссылкой на issue>');
  return 1;
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
