import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// #646. Тест, создавший временный каталог, обязан его убрать — даже когда
// падает. `golden-capture-provenance` оставлял по ≈20 МБ за прогон
// (`hp-golden-571-baselines-*`), и за сутки параллельной работы агентов общий
// TMPDIR вырос до 8,5 ГБ: ENOSPC, упавшая сборка и ложно красные юниты с
// временными git-репозиториями.
//
// Проверка статическая, по исходникам: рантайм видит утечку только на том
// пути, который исполнился, а исходник показывает намерение на всех путях.
//
// Правило. Каждый вызов `mkdtemp`/`mkdtempSync` в `test/**/*.mjs`:
//  1. связан с именем (`const dir = mkdtempSync(...)`) либо сразу возвращён;
//  2. это имя убирается вызовом `rm`/`rmSync`/`rmdirSync(<имя>, ...)`, стоящим
//     в блоке `finally` или в колбэке `after`/`afterEach`/`t.after` внутри
//     той же функции — очистка, которая не исполнится при упавшем assert, не
//     считается;
//  3. либо функция — именованный помощник, который возвращает каталог (сам или
//     полем объекта), и тогда правило 2 применяется к КАЖДОМУ месту его вызова
//     (цепочка помощников — до MAX_DEPTH звеньев);
//  4. исключение — комментарий `// tmp-ok: <причина>` на строке вызова или на
//     строке над ним. Причина обязательна: пустой `tmp-ok:` не принимается.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TEST_DIR = join(ROOT, 'test');
const MAX_DEPTH = 3;
const CREATORS = new Set(['mkdtemp', 'mkdtempSync']);
const REMOVERS = new Set(['rm', 'rmSync', 'rmdirSync', 'rmdir']);
const HOOKS = new Set(['after', 'afterEach']);

const calleeName = (call) => {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
};

const isFunctionLike = (node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
  || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);

const enclosingFunction = (node) => {
  for (let cur = node.parent; cur; cur = cur.parent) if (isFunctionLike(cur)) return cur;
  return node.getSourceFile();
};

/** Имя функции: объявление либо `const name = () => ...`. */
function functionName(fn) {
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  if (ts.isMethodDeclaration(fn) && ts.isIdentifier(fn.name)) return fn.name.text;
  const parent = fn.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return null;
}

/** Куда уходит значение выражения: `{ name }`, `{ returned: true }` или `null`. */
function binding(expr) {
  let node = expr;
  while (node.parent && (ts.isAwaitExpression(node.parent) || ts.isParenthesizedExpression(node.parent))) {
    node = node.parent;
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
    if (ts.isIdentifier(parent.name)) return { name: parent.name.text };
    if (ts.isObjectBindingPattern(parent.name)) {
      const fields = new Map();
      for (const element of parent.name.elements) {
        const key = element.propertyName ?? element.name;
        if (ts.isIdentifier(key) && ts.isIdentifier(element.name)) fields.set(key.text, element.name.text);
      }
      return { fields };
    }
    return null;
  }
  if (ts.isReturnStatement(parent)) return { returned: true };
  if (ts.isArrowFunction(parent) && parent.body === node) return { returned: true };
  return null;
}

/** Узел `node` лежит в `finally` либо в колбэке хука очистки, не выходя за `scope`. */
function inCleanupPosition(node, scope) {
  for (let cur = node; cur && cur !== scope; cur = cur.parent) {
    const parent = cur.parent;
    if (!parent) break;
    if (ts.isTryStatement(parent) && parent.finallyBlock === cur) return true;
    if (isFunctionLike(cur) && ts.isCallExpression(parent) && parent.arguments.includes(cur)
        && HOOKS.has(calleeName(parent))) return true;
  }
  return false;
}

/** В `scope` есть очистка каталога с именем `name` в безопасной позиции. */
function cleansUp(scope, name) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isCallExpression(node) && REMOVERS.has(calleeName(node))) {
      const [first] = node.arguments;
      if (first && ts.isIdentifier(first) && first.text === name && inCleanupPosition(node, scope)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(scope, visit);
  return found;
}

/** Возвращает ли `fn` значение `name`: целиком (`''`) или полями объекта (их ключи). */
function returnedAs(fn, name) {
  const keys = new Set();
  const visit = (node) => {
    if (node !== fn && isFunctionLike(node)) return;
    const value = ts.isReturnStatement(node) ? node.expression
      : (node === fn && ts.isArrowFunction(fn) && !ts.isBlock(fn.body) ? fn.body : null);
    if (value) {
      let expr = value;
      while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
      if (ts.isIdentifier(expr) && expr.text === name) keys.add('');
      if (ts.isObjectLiteralExpression(expr)) {
        for (const prop of expr.properties) {
          if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === name) keys.add(prop.name.text);
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.initializer)
              && prop.initializer.text === name && ts.isIdentifier(prop.name)) keys.add(prop.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);
  return keys;
}

function exempt(lines, line) {
  const reason = /\/\/\s*tmp-ok:\s*(\S.*)$/;
  return reason.test(lines[line] ?? '') || reason.test(lines[line - 1] ?? '');
}

/**
 * Нарушения в одном исходнике: `[{ line, message }]`, строки с 1.
 * Экспортируется не наружу, а в самопроверку ниже: правило обязано краснеть
 * на плохом примере, иначе зелёный результат ничего не доказывает.
 */
export function tempDirViolations(source, fileName = 'x.mjs') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lines = source.split('\n');
  const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
  const calls = [];
  const collect = (node) => {
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, collect);
  };
  collect(file);

  const violations = [];
  // Проверка значения `expr`, созданного на строке `origin`: убрано ли оно.
  const check = (expr, depth, origin, path) => {
    const bound = binding(expr);
    const scope = enclosingFunction(expr);
    const where = `${path} (строка ${lineOf(expr) + 1})`;
    if (!bound) return [`${where}: каталог не связан с именем — убрать его нечем`];
    if (bound.name && cleansUp(scope, bound.name)) return [];
    const names = bound.name ? [bound.name] : bound.fields ? [...bound.fields.values()] : [];
    if (names.some((name) => cleansUp(scope, name))) return [];
    // Не убрано здесь — может быть, это помощник, отдающий каталог наружу.
    const returnedKeys = bound.returned ? new Set(['']) : bound.name ? returnedAs(scope, bound.name) : new Set();
    if (!returnedKeys.size) {
      return [`${where}: нет rm*/rmSync(${names[0] ?? '…'}) в finally или after-хуке той же функции`];
    }
    if (depth >= MAX_DEPTH) return [`${where}: цепочка помощников длиннее ${MAX_DEPTH}`];
    const helper = scope === file ? null : functionName(scope);
    if (!helper) return [`${where}: каталог возвращается из безымянной функции — вызовы не проследить`];
    const sites = calls.filter((call) => ts.isIdentifier(call.expression) && call.expression.text === helper);
    const problems = [];
    for (const site of sites) {
      const siteBound = binding(site);
      // Поле объекта, которое вызывающий не забрал, — утечка: каталог никто не удалит.
      if (siteBound?.fields && ![...returnedKeys].some((key) => key && siteBound.fields.has(key))) {
        problems.push(`${path} (строка ${lineOf(site) + 1}): ${helper}() отдаёт каталог полем `
          + `{${[...returnedKeys].filter(Boolean).join(', ')}}, вызывающий его не забирает`);
        continue;
      }
      if (siteBound?.fields) {
        const taken = [...returnedKeys].filter((key) => key && siteBound.fields.has(key))
          .map((key) => siteBound.fields.get(key));
        const siteScope = enclosingFunction(site);
        if (taken.some((name) => cleansUp(siteScope, name))) continue;
        problems.push(`${path} (строка ${lineOf(site) + 1}): нет очистки {${taken.join(', ')}} из ${helper}() `
          + 'в finally или after-хуке');
        continue;
      }
      problems.push(...check(site, depth + 1, origin, `${path} → ${helper}()`));
    }
    return problems;
  };

  for (const call of calls) {
    if (!CREATORS.has(calleeName(call))) continue;
    const line = lineOf(call);
    if (exempt(lines, line)) continue;
    for (const message of check(call, 0, line, `${fileName}:${line + 1}`)) {
      violations.push({ line: line + 1, message });
    }
  }
  return violations;
}

const testSources = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? testSources(join(dir, entry.name))
    : extname(entry.name) === '.mjs' ? [join(dir, entry.name)] : []);

test('#646 AC2: каждый mkdtemp в тестах убирается в finally или after-хуке', () => {
  const files = testSources(TEST_DIR);
  let sites = 0;
  const problems = [];
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    if (!/mkdtemp/.test(source)) continue;
    const name = relative(ROOT, path).replaceAll('\\', '/');
    sites += (source.match(/\bmkdtemp(?:Sync)?\s*\(/g) ?? []).length;
    problems.push(...tempDirViolations(source, name).map((v) => v.message));
  }
  // Разбор, не нашедший ни одного вызова, доказал бы только то, что он сломан.
  assert.ok(sites >= 20, `ожидались десятки вызовов mkdtemp в test/, найдено ${sites}`);
  assert.deepEqual(problems, [], `временные каталоги без очистки:\n${problems.join('\n')}`);
});

test('#646 AC2: правило краснеет на утечке и молчит на корректной очистке', () => {
  const bad = (src) => tempDirViolations(src).length > 0;
  // Очистка без finally не исполнится после упавшего assert.
  assert.ok(bad(`test('x', () => { const d = mkdtempSync('a'); work(d); rmSync(d, { recursive: true }); });`));
  // Очистки нет вовсе.
  assert.ok(bad(`test('x', () => { const d = mkdtempSync('a'); work(d); });`));
  // Очищен не тот каталог.
  assert.ok(bad(`test('x', () => { const d = mkdtempSync('a'); const e = 'b'; try {} finally { rmSync(e); } });`));
  // Результат не связан с именем.
  assert.ok(bad(`test('x', () => { work(mkdtempSync('a')); });`));
  // Помощник отдаёт каталог, вызывающий не убирает.
  assert.ok(bad(`function f() { const d = mkdtempSync('a'); return d; }
    test('x', () => { const d = f(); try {} finally {} });`));
  // Помощник отдаёт каталог полем объекта, вызывающий это поле не забирает (#646: accept()).
  assert.ok(bad(`function f() { const sandbox = mkdtempSync('a'); return { index: 1, sandbox }; }
    test('x', () => { const { index } = f(); });`));
  // Пустая причина исключения не принимается.
  assert.ok(bad(`test('x', () => { const d = mkdtempSync('a'); // tmp-ok:
  });`));

  const good = (src) => assert.deepEqual(tempDirViolations(src), [], src);
  good(`test('x', () => { const d = mkdtempSync('a'); try { work(d); } finally { rmSync(d, { recursive: true, force: true }); } });`);
  good(`test('x', (t) => { const d = mkdtempSync('a'); t.after(() => rmSync(d, { recursive: true, force: true })); });`);
  good(`test('x', async () => { const d = await mkdtemp('a'); try {} finally { await fs.rm(d, { recursive: true }); } });`);
  good(`function f() { const d = mkdtempSync('a'); return d; }
    test('x', () => { const d = f(); try {} finally { rmSync(d, { recursive: true }); } });`);
  good(`const f = () => mkdtempSync('a');
    test('x', (t) => { const r = f(); t.after(() => rmSync(r, { recursive: true })); });`);
  good(`function f() { const root = mkdtempSync('a'); return { root, x: 1 }; }
    test('x', () => { const { root } = f(); try {} finally { rmSync(root, { recursive: true }); } });`);
  good(`test('x', () => { const d = mkdtempSync('a'); // tmp-ok: каталог уносит дочерний процесс
  });`);
});
