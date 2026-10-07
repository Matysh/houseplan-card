// Владение CSS-правилами только редактора (#805).
//
// Правило отбора ТЗ #805: правило принадлежит ТОЛЬКО редактору, если в КАЖДОМ
// его селекторе есть класс, который
//   — не встречается в исходниках статического графа View (`houseplan-card.ts`,
//     `space-card.ts` и всё, что они импортируют статически; `import type` и
//     `import()` не считаются);
//   — не встречается в исходниках других ленивых графов (онбординг,
//     backdrop-pick, панель, summary, PDF, 2.5D, LED, луна, Zigbee,
//     live-interaction — все цели `import()` кроме editor runtime);
//   — встречается в исходниках графа editor runtime.
// Правило без литерального класса или с классом, которого нет ни в одном
// исходнике (`phase-*`, `kind-*`, мёртвые классы), остаётся eager.
//
// Здесь только чтение исходников и чистые функции: юнит владения и обратного
// храповика (`test/editor-dialog-styles.test.mjs`) судит ими дерево, а не
// собранный бандл, поэтому краснеет на правке, а не после сборки.

import ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const VIEW_ENTRIES = ['src/houseplan-card.ts', 'src/space-card.ts'];
export const EDITOR_ENTRY = 'src/houseplan-editor-runtime.ts';
/** Вторая точка входа rollup — тоже граф, который грузится без редактора. */
export const PANEL_ENTRY = 'src/houseplan-panel.ts';

/**
 * Модули-таблицы стилей не являются «использованием» класса: в них есть все
 * селекторы, и `dialogs.styles.ts` сам лежит в графе View.
 */
export const isStylesheetModule = (path) => /(^|[/.-])styles?\.ts$/.test(path);

const edgeCache = new Map();

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null; // lit, polyclip-ts — не наши исходники
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}/index.ts`]) {
    if (candidate.endsWith('.ts') && existsSync(candidate)) return candidate;
  }
  return null; // JSON-словари и ассеты — не разметка
}

const typeOnlyImport = (node) => {
  const clause = node.importClause;
  if (!clause) return false; // import './side-effect'
  if (clause.isTypeOnly) return true;
  // `import { type A, type B } from` без значения стирается компилятором целиком.
  const named = clause.namedBindings;
  return !clause.name && !!named && ts.isNamedImports(named)
    && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly);
};

/** Статические и динамические рёбра модуля по его AST. */
export function moduleEdges(file) {
  if (edgeCache.has(file)) return edgeCache.get(file);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const statics = [];
  const dynamics = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && !typeOnlyImport(statement)) {
      statics.push(statement.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
      statics.push(statement.moduleSpecifier.text);
    }
  }
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) dynamics.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const edges = {
    statics: statics.map((specifier) => resolveSpecifier(file, specifier)).filter(Boolean),
    dynamics: dynamics.map((specifier) => resolveSpecifier(file, specifier)).filter(Boolean),
  };
  edgeCache.set(file, edges);
  return edges;
}

/** Модули, достижимые от входов только статическими импортами значений. */
export function staticGraph(entries, root = REPO_ROOT) {
  const seen = new Set();
  const queue = entries.map((entry) => resolve(root, entry));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...moduleEdges(file).statics);
  }
  return seen;
}

/** Все цели `import()` во всём достижимом коде: каждая — вход ленивого графа. */
export function lazyEntries(root = REPO_ROOT) {
  const entries = new Set();
  const seen = new Set();
  const queue = [...VIEW_ENTRIES, PANEL_ENTRY, EDITOR_ENTRY].map((entry) => resolve(root, entry));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { statics, dynamics } = moduleEdges(file);
    queue.push(...statics, ...dynamics);
    for (const target of dynamics) entries.add(target);
  }
  return entries;
}

const printer = ts.createPrinter({ removeComments: true });
const tokenCache = new Map();

/** Словарь токенов `[A-Za-z0-9_-]+` исходника без комментариев. */
function sourceTokens(file) {
  if (tokenCache.has(file)) return tokenCache.get(file);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  // Module specifiers are paths, not markup: `from './editor-secondary'` must not
  // count as a use of the class `.editor-secondary`.
  const code = printer.printFile(source)
    .replace(/(\bfrom\s*|\bimport\s*\(?\s*)(['"])[^'"\n]*\2/g, '$1');
  const tokens = new Set(code.match(/[A-Za-z0-9_-]+/g) || []);
  tokenCache.set(file, tokens);
  return tokens;
}

function tokensOf(files) {
  const all = new Set();
  for (const file of files) {
    if (isStylesheetModule(file)) continue;
    for (const token of sourceTokens(file)) all.add(token);
  }
  return all;
}

/**
 * Три множества токенов правила отбора. `extraView` — исходники, которые
 * рендерят в собственный корень с `cardStyles` и потому не должны терять ни
 * одного правила (контракт п. 5: `hp-device-preview`), даже если сами живут
 * в графе редактора.
 */
export function ownershipIndex({ root = REPO_ROOT, extraView = [] } = {}) {
  const view = staticGraph(VIEW_ENTRIES, root);
  const editor = staticGraph([EDITOR_ENTRY], root);
  const editorEntry = resolve(root, EDITOR_ENTRY);
  const others = new Set();
  for (const entry of [resolve(root, PANEL_ENTRY), ...lazyEntries(root)]) {
    if (entry === editorEntry) continue;
    for (const file of staticGraph([entry], root)) others.add(file);
  }
  return {
    viewFiles: view,
    editorFiles: editor,
    otherFiles: others,
    view: tokensOf([...view, ...extraView.map((path) => resolve(root, path))]),
    other: tokensOf(others),
    editor: tokensOf(editor),
  };
}

/** Классы составного селектора: `.a.b:not(.c) > .d` → a, b, c, d. */
export const classesOf = (selector) => [...selector.matchAll(/\.([A-Za-z_-][A-Za-z0-9_-]*)/g)].map((m) => m[1]);

/** Класс, по которому селектор принадлежит только редактору. */
export const editorOnlyClass = (index, cls) =>
  !index.view.has(cls) && !index.other.has(cls) && index.editor.has(cls);

/** Селекторный список, разрезанный по запятым верхнего уровня. */
export function splitSelectors(header) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let k = 0; k < header.length; k++) {
    const ch = header[k];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { parts.push(header.slice(from, k)); from = k + 1; }
  }
  parts.push(header.slice(from));
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Класс есть хоть в одном исходнике; иначе он динамический или мёртвый. */
export const knownClass = (index, cls) => index.view.has(cls) || index.other.has(cls) || index.editor.has(cls);

/**
 * Селектор редактора: несёт класс только редактора, и ни один его класс не
 * собирается динамически и не мёртв — такие правила ТЗ оставляет eager как есть
 * (`hp-dialog .body .temprange .tempin`: `.temprange` нет ни в одной разметке).
 */
export const isEditorOnlySelector = (index, selector) => {
  const classes = classesOf(selector);
  return classes.some((cls) => editorOnlyClass(index, cls)) && classes.every((cls) => knownClass(index, cls));
};

/** Правило редактора: КАЖДЫЙ селектор списка — селектор редактора. */
export const isEditorOnlySelectorList = (index, selectors) => selectors.length > 0
  && selectors.every((selector) => isEditorOnlySelector(index, selector));

/**
 * Правила, которые правило отбора отдаёт редактору. Селектор, который есть и в
 * остающемся правиле (в любом at-правиле), держит в eager все свои правила:
 * переносится только вместе со всеми вхождениями (`.backupcounts`).
 */
export function editorOnlyRules(index, rules) {
  const own = new Set(rules.filter((rule) => isEditorOnlySelectorList(index, rule.selectors)));
  for (let changed = true; changed;) {
    changed = false;
    const kept = new Set(rules.filter((rule) => !own.has(rule)).flatMap((rule) => rule.selectors));
    for (const rule of [...own]) {
      if (rule.selectors.some((selector) => kept.has(selector))) { own.delete(rule); changed = true; }
    }
  }
  return rules.filter((rule) => own.has(rule));
}

/**
 * Правила CSS-текста с областью at-правил. `start`/`end` — смещения в `text`
 * (вместе с вложенным at-правилом — смещения самого правила внутри него).
 */
export function parseRules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
  const rules = [];
  const walk = (from, to, scope) => {
    let i = from;
    while (i < to) {
      while (i < to && /\s/.test(clean[i])) i++;
      if (i >= to) break;
      const open = clean.indexOf('{', i);
      if (open === -1 || open >= to) break;
      let depth = 1;
      let j = open + 1;
      while (j < to && depth > 0) {
        if (clean[j] === '{') depth++;
        else if (clean[j] === '}') depth--;
        j++;
      }
      const header = clean.slice(i, open).replace(/\s+/g, ' ').trim();
      if (header.startsWith('@')) {
        walk(open + 1, j - 1, [...scope, header]);
      } else {
        rules.push({
          scope,
          header,
          selectors: splitSelectors(header),
          declarations: clean.slice(open + 1, j - 1).split(';').map((d) => d.replace(/\s+/g, ' ').trim()).filter(Boolean),
          start: i,
          end: j,
        });
      }
      i = j;
    }
  };
  walk(0, clean.length, []);
  return rules;
}

/** Текст всех css`` шаблонов исходника (без интерполяций). */
export function cssOfSource(source) {
  const chunks = [...source.matchAll(/css`([\s\S]*?)`/g)].map((m) => m[1]);
  if (chunks.some((chunk) => chunk.includes('${'))) throw new Error('interpolation in css``');
  return chunks.join('\n');
}

export const readRepo = (path, root = REPO_ROOT) => readFileSync(resolve(root, path), 'utf8');
export const repoRelative = (file, root = REPO_ROOT) => relative(root, file);
