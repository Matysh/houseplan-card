// Чистые функции гейта мёртвых i18n-ключей (#502).
//
// Гейт (`test/i18n-dead-keys.test.mjs`) считает ключ словаря живым, если в
// `src/**` есть его потребитель: строковый литерал, «динамическая семья»
// (конкатенация или шаблонная строка, из которой ключ собирается по данным)
// или производный `.aria` от вызова `_help('x.help')`.
//
// До #502 динамической семьёй считалось любое строковое выражение с буквой:
// `'r' + Date.now().toString(36)` (генерация id черновика) превращалось в
// `^r.+$` и «читало» весь `radar.*`, `room.*`, `resize.*`, `run.*`. Так
// `radar.bad_references` (#485) прошёл гейт мёртвым. Теперь потребитель обязан
// быть похож на ключ (см. `isKeyShapedPattern`).
//
// Здесь нет чтения `src/**` и словарей — только AST → паттерны → множество
// потребителей → список мёртвых ключей, чтобы каждый шаг проверялся на
// синтетических входах.

import ts from 'typescript';

export const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Разобрать одно выражение из строки — для юнитов на синтетическом AST.
 * `(${code});` даёт ParenthesizedExpression, который expressionPattern снимает.
 */
export const parseExpression = (code) => {
  const file = ts.createSourceFile('probe.ts', `(${code});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const [statement] = file.statements;
  if (!statement || !ts.isExpressionStatement(statement)) throw new Error(`not an expression: ${code}`);
  return statement.expression;
};

/**
 * Паттерн ключа из строкового выражения: `source` — тело регулярки без
 * якорей, `dynamic` — есть ли вычисляемая часть, `staticText` — склейка
 * литеральных частей (по ней решается, похож ли паттерн на ключ).
 * Не строковое выражение — null.
 */
export const expressionPattern = (node) => {
  if (ts.isStringLiteralLike(node)) {
    return { source: escapeRegExp(node.text), dynamic: false, staticText: node.text };
  }
  if (ts.isParenthesizedExpression(node)) return expressionPattern(node.expression);
  if (ts.isTemplateExpression(node)) {
    let source = escapeRegExp(node.head.text);
    let staticText = node.head.text;
    for (const span of node.templateSpans) {
      source += '.+' + escapeRegExp(span.literal.text);
      staticText += span.literal.text;
    }
    return { source, dynamic: true, staticText };
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = expressionPattern(node.left);
    const right = expressionPattern(node.right);
    if (!left && !right) return null;
    return {
      source: (left?.source || '.+') + (right?.source || '.+'),
      dynamic: (left?.dynamic ?? true) || (right?.dynamic ?? true),
      staticText: (left?.staticText ?? '') + (right?.staticText ?? ''),
    };
  }
  return null;
};

/**
 * Динамический потребитель обязан быть похож на i18n-ключ (#502, контракт
 * п.1–2): каждый ключ словаря имеет вид `namespace.key`, поэтому в статической
 * части выражения должны быть разделитель `.` и хотя бы одна буква.
 *
 *   `radar.${code}`, prefix + '.title', `${ns}.aria`  → потребители;
 *   'r' + Date.now().toString(36), `${a}b`, 'x' + id  → нет: точки нет;
 *   `${a}.${b}`, a + '.' + b                          → нет: одна точка без
 *     буквы совпала бы с каждым ключом словаря — это не семья, а всё.
 *
 * Буква до точки не требуется: `.+\.title` покрывает ровно ключи с этим
 * суффиксом. Требование буквы (в любом месте статической части) принято
 * предположительно — оно было и в прежней версии гейта.
 */
export const isKeyShapedPattern = (pattern) => Boolean(pattern?.dynamic)
  && pattern.staticText.includes('.')
  && /[A-Za-z]/.test(pattern.staticText);

export const isStringJoin = (node) => ts.isTemplateExpression(node)
  || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken);

/**
 * Собрать потребителей из исходников `{ path, text }[]`.
 *
 * `literals` — все строковые литералы; `dynamic` — регулярки семей, похожих на
 * ключ; `derivedHelpAria` — `x.help.aria` для каждого `_help('x.help')`;
 * `discarded` — динамические паттерны, отброшенные как непохожие на ключ
 * (для отчёта о сужении, AC5; уникальны по source).
 */
export const collectConsumers = (sources) => {
  const literals = new Set();
  const dynamic = [];
  const derivedHelpAria = new Set();
  const discardedBySource = new Map();

  for (const { path, text } of sources) {
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node)) literals.add(node.text);

      if (isStringJoin(node)) {
        const pattern = expressionPattern(node);
        if (isKeyShapedPattern(pattern)) {
          dynamic.push(new RegExp(`^${pattern.source}$`));
        } else if (pattern?.dynamic && /[A-Za-z]/.test(pattern.source) && !discardedBySource.has(pattern.source)) {
          // ровно то, что прежний гейт принял бы за семью
          discardedBySource.set(pattern.source, { regExp: new RegExp(`^${pattern.source}$`), path });
        }
      }

      if (ts.isCallExpression(node) && node.arguments.length) {
        const callee = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ts.isIdentifier(node.expression) ? node.expression.text : '';
        const key = node.arguments[0];
        if (callee === '_help' && ts.isStringLiteralLike(key) && key.text.endsWith('.help')) {
          derivedHelpAria.add(`${key.text}.aria`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }

  return { literals, dynamic, derivedHelpAria, discarded: [...discardedBySource.values()] };
};

const hasConsumer = (key, consumers, families) => consumers.literals.has(key)
  || consumers.derivedHelpAria.has(key)
  || consumers.dynamic.some((pattern) => pattern.test(key))
  || families.some(({ pattern }) => pattern.test(key));

/** Ключи словаря без потребителя. `families` — явные динамические семьи (контракт п.3). */
export const unusedKeys = (keys, consumers, families = []) => keys
  .filter((key) => !hasConsumer(key, consumers, families));

/**
 * Дефекты списка явных семей (контракт п.3): пустая причина, не RegExp,
 * запись без единого ключа словаря. Пустой список — норма.
 */
export const familyProblems = (families, keys) => {
  const problems = [];
  families.forEach((family, index) => {
    const label = `DYNAMIC_KEY_FAMILIES[${index}]`;
    if (!(family?.pattern instanceof RegExp)) {
      problems.push(`${label}: pattern must be a RegExp`);
      return;
    }
    if (typeof family.because !== 'string' || !family.because.trim()) {
      problems.push(`${label} (${family.pattern}): because must name the consumer and the reason`);
    }
    if (!keys.some((key) => family.pattern.test(key))) {
      problems.push(`${label} (${family.pattern}): covers no dictionary key — drop the entry`);
    }
  });
  return problems;
};

/**
 * Отчёт о сужении (AC5): сколько паттернов отброшено и какие ключи держались
 * только на них. Непустой `onlyDiscarded` на реальном дереве — либо мёртвый
 * ключ (отдельный issue, класс A), либо кандидат в явную семью.
 */
export const narrowingReport = (keys, consumers, families = []) => ({
  discarded: consumers.discarded.length,
  onlyDiscarded: keys.filter((key) => !hasConsumer(key, consumers, families)
    && consumers.discarded.some(({ regExp }) => regExp.test(key))),
});
