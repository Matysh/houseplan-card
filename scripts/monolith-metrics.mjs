#!/usr/bin/env node
/**
 * Метрики связности монолита и мёртвый код в нём (#624).
 *
 * После выноса редакторского рантайма (#425) карточка и рантайм вместе стали
 * длиннее на 22 %: карточка держит сотни однострочных делегатов
 * `return this._editorRuntimeOrThrow()._x(...)`, рантайм читает её приватные
 * поля через порт `HouseplanEditorHostPort` из 350+ членов, а `noUnusedLocals`
 * был выключен — компилятор молчал о ≈380 неиспользуемых импортах и ≈60
 * мёртвых объявлениях. Этот модуль — единственный источник шести чисел, по
 * которым связность измеряется («одно число — один источник», PROCESS.md):
 * их читают и гейт `scripts/unused-locals-gate.mjs`, и `npm run inventory`.
 *
 *   delegates        методов карточки, тело которых — один вызов рантайма
 *   portMembers      членов интерфейса HouseplanEditorHostPort
 *   hostRefs         обращений `host.` в src/** вне карточки
 *   portPrivates     приватных членов карточки, которых карточка не читает,
 *                    но читает рантайм или другой модуль через порт
 *   harnessPrivates  приватных членов карточки, которых не читает никто в
 *                    продукте, но зовут браузерные смоки (`card._x(...)`):
 *                    мёртвый продуктовый код на службе харнесса
 *   bundleBytes      байт в dist/ после сборки — сумма всех файлов, потому что
 *                    `dist/houseplan-card.js` — загрузчик на 1 КБ, а код лежит
 *                    в content-hashed чанках `dist/houseplan-assets/`; судится
 *                    с полосой BUNDLE_BYTES_BAND, остальные — точно
 *
 * Приватный член карточки, который TypeScript считает непрочитанным, — не
 * обязательно мёртвый: рантайм зовёт его как `host._x`. Поэтому гейт не
 * включает `noUnusedLocals` в tsconfig (флаг нельзя ограничить «кроме членов
 * порта», а объявить 300 членов публичными ради флага — спрятать метрику), а
 * разбирает диагностики сам: разрешены поимённо только члены порта и члены,
 * которых касается харнесс, и оба множества считаются.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

export const CARD_FILE = 'src/houseplan-card.ts';
export const RUNTIME_FILE = 'src/houseplan-editor-runtime.ts';
export const PORT_INTERFACE = 'HouseplanEditorHostPort';
export const RUNTIME_ACCESSOR = '_editorRuntimeOrThrow';
export const BASELINE_FILE = 'scripts/monolith-baseline.json';
export const METRIC_NAMES = ['delegates', 'portMembers', 'hostRefs', 'portPrivates', 'harnessPrivates', 'bundleBytes'];

/** Диагностики «объявлено, но не используется». */
export const UNUSED_CODES = new Set([6133, 6138, 6192, 6196, 6198, 6199]);

const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const classNamed = (file, name) => file.statements.find(
  (statement) => ts.isClassDeclaration(statement) && statement.name?.text === name,
);

/**
 * Делегат: метод/аксессор карточки, тело которого — ровно одно выражение
 * `this._editorRuntimeOrThrow().<член>…` (с `return` или без, `async` или нет).
 */
export function isDelegateBody(body, sourceFile) {
  if (!body || !ts.isBlock(body) || body.statements.length !== 1) return false;
  const [statement] = body.statements;
  let expression = null;
  if (ts.isReturnStatement(statement)) expression = statement.expression ?? null;
  else if (ts.isExpressionStatement(statement)) expression = statement.expression;
  if (!expression) return false;
  if (ts.isAwaitExpression(expression)) expression = expression.expression;
  // this._editorRuntimeOrThrow()._x(...)  |  this._editorRuntimeOrThrow()._x
  let node = expression;
  while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
    || ts.isNonNullExpression(node) || ts.isAsExpression(node)) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === RUNTIME_ACCESSOR && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
      return node !== expression; // сам вызов аксессора без обращения к члену — не делегат
    }
    node = ts.isCallExpression(node) ? node.expression : node.expression;
  }
  void sourceFile;
  return false;
}

/** Число делегатов в классе HouseplanCard. */
export function countDelegates(cardText) {
  const file = parse(CARD_FILE, cardText);
  const card = classNamed(file, 'HouseplanCard');
  if (!card) throw new Error(`${CARD_FILE}: класс HouseplanCard не найден`);
  let count = 0;
  for (const member of card.members) {
    if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      if (isDelegateBody(member.body, file)) count += 1;
    }
  }
  return count;
}

/** Имена членов интерфейса HouseplanEditorHostPort. */
export function portMemberNames(runtimeText) {
  const file = parse(RUNTIME_FILE, runtimeText);
  const port = file.statements.find(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === PORT_INTERFACE,
  );
  if (!port) throw new Error(`${RUNTIME_FILE}: интерфейс ${PORT_INTERFACE} не найден`);
  const names = new Set();
  for (const member of port.members) {
    const name = member.name?.getText(file);
    if (name) names.add(name.replace(/^['"]|['"]$/g, ''));
  }
  return names;
}

/** Обращения `host.<имя>` в исходниках вне карточки: общее число и имена. */
export function hostReferences(sourcesByPath) {
  let count = 0;
  const names = new Set();
  for (const [path, text] of Object.entries(sourcesByPath)) {
    if (path.replaceAll('\\', '/').endsWith(CARD_FILE)) continue;
    for (const match of text.matchAll(/(?<![\w$])host\.([A-Za-z_$][\w$]*)/g)) {
      count += 1;
      names.add(match[1]);
    }
  }
  return { count, names };
}

/** Имена, которых браузерные смоки касаются как свойств: `card._x(`, `c._x =`, `['_x']`. */
export function harnessMemberNames(demoSourcesByPath) {
  const names = new Set();
  for (const text of Object.values(demoSourcesByPath)) {
    for (const match of text.matchAll(/(?:\.|\[['"])(_[A-Za-z][\w$]*)(?![\w$])/g)) names.add(match[1]);
  }
  return names;
}

/**
 * Разбор диагностик компилятора с `noUnusedLocals`. Каждая — либо
 * `allowed` (приватный член карточки из порта или харнесса), либо нарушение.
 */
export function classifyUnused(diagnostics, { cardText, portNames, hostNames, harnessNames }) {
  const cardLines = cardText.split('\n');
  const allowed = { port: [], harness: [] };
  const violations = [];
  for (const d of diagnostics) {
    const name = /'([^']+)'/.exec(d.message)?.[1] ?? '';
    const isCard = d.file.replaceAll('\\', '/').endsWith(CARD_FILE);
    const lineText = isCard ? (cardLines[d.line - 1] ?? '') : '';
    const isPrivateMember = /^\s+(?:@\w+(?:\([^)]*\))?\s+)?private\b/.test(lineText);
    if (isCard && isPrivateMember && name) {
      if (portNames.has(name) || hostNames.has(name)) { allowed.port.push(name); continue; }
      if (harnessNames.has(name)) { allowed.harness.push(name); continue; }
    }
    violations.push({ ...d, name });
  }
  return { allowed, violations };
}

/** Суммарный размер файлов dist/ в байтах; null — если сборки нет. */
export function bundleBytes(distDir) {
  if (!existsSync(distDir)) return null;
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path); else total += stat.size;
    }
  };
  walk(distDir);
  return total;
}

/** Диагностики `noUnusedLocals` по tsconfig проекта, в плоском виде. */
export function unusedDiagnostics(root, tsconfig = 'tsconfig.json') {
  const configPath = resolve(root, tsconfig);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noUnusedLocals: true, noEmit: true });
  const out = [];
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!UNUSED_CODES.has(d.code) || !d.file) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    out.push({
      file: relative(root, d.file.fileName).replaceAll('\\', '/'),
      line: line + 1,
      code: d.code,
      message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
    });
  }
  return out;
}

/** Все .ts под src/ — путь → текст. */
export function readSources(root, dir = 'src') {
  const out = {};
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const path = join(d, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.ts$/.test(entry) && !/\.d\.ts$/.test(entry)) out[relative(root, path).replaceAll('\\', '/')] = readFileSync(path, 'utf8');
    }
  };
  walk(resolve(root, dir));
  return out;
}

/**
 * Харнесс — то, что исполняет Validate: смоки `demo/smoke_*.mjs`, бенчмарки
 * и `demo/guard`. Ручные съёмки (`shot_*`, `verify_*`) входом не считаются
 * (см. NOT_AN_INPUT в check-inputs.mjs) и мёртвый член карточки не оправдывают.
 */
export const HARNESS_FILE = /^(?:smoke_|benchmark_).*\.mjs$/;
export function readDemoSources(root) {
  const out = {};
  const demo = resolve(root, 'demo');
  if (!existsSync(demo)) return out;
  for (const entry of readdirSync(demo)) {
    const path = join(demo, entry);
    if (statSync(path).isFile() && HARNESS_FILE.test(entry)) out[`demo/${entry}`] = readFileSync(path, 'utf8');
  }
  const guard = join(demo, 'guard');
  if (existsSync(guard)) {
    for (const entry of readdirSync(guard)) {
      if (/\.mjs$/.test(entry)) out[`demo/guard/${entry}`] = readFileSync(join(guard, entry), 'utf8');
    }
  }
  return out;
}

/**
 * Полный замер: шесть чисел плюс разбор диагностик. `diagnostics` можно
 * подать снаружи (тесты), иначе компилятор запускается по tsconfig.
 */
export function collectMetrics(root, { diagnostics = null, distDir = 'dist' } = {}) {
  const sources = readSources(root);
  const cardText = sources[CARD_FILE];
  const runtimeText = sources[RUNTIME_FILE];
  if (!cardText || !runtimeText) throw new Error('карточка или рантайм не найдены в src/');
  const portNames = portMemberNames(runtimeText);
  const host = hostReferences(sources);
  const harnessNames = harnessMemberNames(readDemoSources(root));
  const diags = diagnostics ?? unusedDiagnostics(root);
  const { allowed, violations } = classifyUnused(diags, { cardText, portNames, hostNames: host.names, harnessNames });
  return {
    metrics: {
      delegates: countDelegates(cardText),
      portMembers: portNames.size,
      hostRefs: host.count,
      portPrivates: allowed.port.length,
      harnessPrivates: allowed.harness.length,
      bundleBytes: bundleBytes(resolve(root, distDir)),
    },
    allowed,
    violations,
  };
}

/**
 * Полоса для `bundleBytes` — как у gzip-потолка стартового графа (#438,
 * `bundle-budget.mjs`): размер dist/ меняется от любой правки `src/**` в
 * любой задаче, а ребейз ветки конвейером пересобирает бандл поверх нового
 * `dev`. Точное число красило бы каждую ветку за чужой коммит. Пять чисел
 * исходника такой полосы не получают: они меняются только правкой монолита.
 */
export const BUNDLE_BYTES_BAND = 2_000;

/** Сравнение с базой: что выросло, что упало. Отсутствующее в базе — рост. */
export function compareWithBaseline(current, baseline, { bundleBand = BUNDLE_BYTES_BAND } = {}) {
  const grown = [];
  const shrunk = [];
  for (const name of METRIC_NAMES) {
    const now = current[name];
    const base = baseline?.[name];
    if (now == null) continue;
    const band = name === 'bundleBytes' ? bundleBand : 0;
    if (base == null || now > base + band) grown.push({ name, base: base ?? null, now });
    else if (now < base - band) shrunk.push({ name, base, now });
  }
  return { grown, shrunk };
}

export function readBaseline(root) {
  const path = resolve(root, BASELINE_FILE);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export function formatMetrics(metrics) {
  return METRIC_NAMES.map((name) => `${name}=${metrics[name] ?? 'n/a'}`).join(' ');
}
