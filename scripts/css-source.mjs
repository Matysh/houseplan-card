/** Read-only TypeScript AST analysis. No application module is executed. */
import ts from 'typescript';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { splitCssFragments } from './css-lex.mjs';

const UNKNOWN = Symbol('not statically finite');
const CHOICE = Symbol('finite alternatives');
const DEFERRED = Symbol('deferred AST value');
const alternatives = value => value && typeof value === 'object' && value[CHOICE] ? value[CHOICE] : [value];
const choice = values => values.length === 1 ? values[0] : { [CHOICE]: [...new Set(values)] };
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
};
const textOf = value => value === UNKNOWN ? '__HP_DYNAMIC__' : Array.isArray(value)
  ? value.map(textOf).join(',') : value && typeof value === 'object' ? '__HP_DYNAMIC__' : String(value ?? '');
const propertyName = node => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : null;
const isFunction = node => ts.isFunctionLike(node) && !!node.body;
const arrayMutationStatement = node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
  && ts.isPropertyAccessExpression(node.expression.expression)
  && ['push','unshift'].includes(node.expression.expression.name.text)
  && ts.isIdentifier(node.expression.expression.expression);
const supportedStatements = statements => statements.every(statement => ts.isReturnStatement(statement)
  || ts.isVariableStatement(statement) || ts.isEmptyStatement(statement) || arrayMutationStatement(statement)
  || ts.isBlock(statement) && supportedStatements(statement.statements)
  || ts.isIfStatement(statement)
    && supportedStatements(ts.isBlock(statement.thenStatement) ? statement.thenStatement.statements : [statement.thenStatement])
    && (!statement.elseStatement || supportedStatements(ts.isBlock(statement.elseStatement) ? statement.elseStatement.statements : [statement.elseStatement])));
const words = text => text.split(/[\t\n\f\r ]+/).filter(Boolean);
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Literal HTML chunks have expression sentinels, so quote boundaries remain
 * lexical. Text, comments and another attribute's quoted value are not class
 * attributes. Style/script children are never scanned as markup. */
function htmlAttributes(text) {
  const attributes = [];
  for (let i = 0; i < text.length;) {
    const open = text.indexOf('<', i);
    if (open < 0) break;
    if (text.startsWith('<!--', open)) { const close = text.indexOf('-->', open + 4); i = close < 0 ? text.length : close + 3; continue; }
    i = open + 1;
    if (!/[a-z]/i.test(text[i] || '')) { i++; continue; }
    const tagStart = i;
    while (i < text.length && !/[\t\n\f\r />]/.test(text[i])) i++;
    const tag = text.slice(tagStart, i).toLowerCase();
    while (i < text.length && text[i] !== '>') {
      while (/[\t\n\f\r /]/.test(text[i] || '') && i < text.length) i++;
      if (text[i] === '>') break;
      const start = i;
      while (i < text.length && !/[\t\n\f\r =>/]/.test(text[i])) i++;
      if (i === start) { i++; continue; }
      const name = text.slice(start, i).toLowerCase();
      while (/[\t\n\f\r ]/.test(text[i] || '') && i < text.length) i++;
      if (text[i] !== '=') continue;
      i++; while (/[\t\n\f\r ]/.test(text[i] || '') && i < text.length) i++;
      let value;
      if (text[i] === '"' || text[i] === "'") {
        const quote = text[i++], begin = i;
        while (i < text.length && text[i] !== quote) i++;
        value = text.slice(begin, i); if (i < text.length) i++;
      } else { const begin = i; while (i < text.length && !/[\t\n\f\r >]/.test(text[i])) i++; value = text.slice(begin, i); }
      attributes.push({ name, value });
    }
    i++;
    if (tag === 'style' || tag === 'script') {
      const end = text.toLowerCase().indexOf('</' + tag, i);
      i = end < 0 ? text.length : end;
    }
  }
  return attributes;
}

export function namedOwner(node) {
  for (let current = node; current; current = current.parent) {
    if (!isFunction(current)) continue;
    if (current.name) {
      const name = current.name.getText();
      const parent = current.parent;
      return (ts.isClassLike(parent) && parent.name ? parent.name.text + '.' : '') + name;
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      if (ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) return current.parent.name.text;
      if (ts.isPropertyAssignment(current.parent)) return current.parent.name.getText();
    }
  }
  return '<module>';
}

function sourceFiles(root) {
  const files = [];
  const walk = directory => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(directory, entry.name));
      else if (/\.tsx?$/.test(entry.name)) files.push(join(directory, entry.name));
    }
  };
  walk(join(root, 'src'));
  return files.sort();
}

/** Finite values resolve through TS symbols, actual call arguments and bounded
 * pure CSS builders. HTML templates are never evaluated as whole combinations. */
export function createSourceAnalysis(root) {
  root = resolve(root);
  const paths = sourceFiles(root);
  const program = ts.createProgram(paths, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, noEmit: true, types: [] });
  const checker = program.getTypeChecker();
  const sources = paths.map(path => program.getSourceFile(path)).filter(Boolean);
  const calls = new Map(), nodes = [], writes = new Map();
  const symbol = node => {
    let result = checker.getSymbolAtLocation(node);
    if (result?.flags & ts.SymbolFlags.Alias) result = checker.getAliasedSymbol(result);
    return result;
  };
  const declaration = node => symbol(node)?.valueDeclaration || symbol(node)?.declarations?.[0];
  for (const source of sources) {
    const visit = node => {
      nodes.push(node);
      if (ts.isCallExpression(node)) {
        const fn = checker.getResolvedSignature(node)?.declaration;
        if (fn) { const list = calls.get(fn) || []; list.push(node); calls.set(fn, list); }
      }
      const target = ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(node.operatorToken.kind) && ts.isIdentifier(node.left)
        ? node.left : ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && ['push','unshift'].includes(node.expression.name.text) && ts.isIdentifier(node.expression.expression)
          ? node.expression.expression : null;
      if (target) { const key = symbol(target); if (key) { const rows = writes.get(key) || []; rows.push(node); writes.set(key, rows); } }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const typeCache = new Map();
  const finiteType = node => {
    if (typeCache.has(node)) return typeCache.get(node);
    const type = checker.getTypeAtLocation(node);
    const parts = type.isUnion() ? type.types : [type];
    if (parts.length > 128) return [UNKNOWN];
    const values = parts.flatMap(part => part.isStringLiteral() || part.isNumberLiteral() ? [part.value]
      : part.flags & ts.TypeFlags.BooleanLiteral ? [part.intrinsicName === 'true']
        : part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Never) ? [] : [UNKNOWN]);
    const result = values.length ? [...new Set(values)] : [UNKNOWN];
    typeCache.set(node, result); return result;
  };
  const narrow = (values, node) => {
    if (values.some(value => value === UNKNOWN || typeof value === 'string' && value.includes('__HP_DYNAMIC__'))) {
      const type = finiteType(node);
      if (type.every(value => value !== UNKNOWN)) return type;
    }
    return [...new Set(values)];
  };
  const deferred = (node, env, stack) => ({ [DEFERRED]: { node, env: new Map(env), stack } });
  const force = value => alternatives(value).flatMap(item => item && typeof item === 'object' && item[DEFERRED]
    ? evaluate(item[DEFERRED].node, item[DEFERRED].env, item[DEFERRED].stack) : [item]);
  const arrayWrites = (node, values, env, stack) => {
    const array = values.some(Array.isArray);
    if (!array && !writes.has(symbol(node))) return values;
    const result = values.flatMap(value => Array.isArray(value) ? value : [value]);
    let strings = [...new Set(values)];
    for (const write of writes.get(symbol(node)) || []) {
      if (stack.has(write)) continue;
      let reachable = true;
      for (let current = write; current.parent && !isFunction(current.parent); current = current.parent) {
        const parent = current.parent;
        if (!ts.isIfStatement(parent)) continue;
        const tests = evaluate(parent.expression, env, new Set(stack).add(write));
        if (tests.some(value => value === UNKNOWN)) continue;
        if (current === parent.thenStatement && tests.every(value => !value)
          || current === parent.elseStatement && tests.every(Boolean)) reachable = false;
      }
      if (!reachable) continue;
      const expressions = ts.isCallExpression(write) ? write.arguments : [write.right];
      for (const expr of expressions) {
        const added = evaluate(expr, env, new Set(stack).add(write));
        if (!array && ts.isBinaryExpression(write)) {
          const append = write.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken;
          const next = append ? strings.flatMap(a => added.map(b => typeof a === 'string' || typeof b === 'string'
            ? textOf(a) + textOf(b) : UNKNOWN)) : added;
          strings = [...new Set([...strings, ...next])];
          if (strings.length > 256) return [UNKNOWN];
        } else for (const value of added)
          if (ts.isCallExpression(write)) result.push(value);
          else if (Array.isArray(value)) result.push(...value);
      }
    }
    return array ? [[...new Set(result)]] : strings;
  };
  const bind = (name, value, env) => {
    if (ts.isIdentifier(name)) env.set(name.text, value);
    else if (ts.isObjectBindingPattern(name)) for (const element of name.elements) {
      const key = propertyName(element.propertyName || element.name);
      const items = force(value).flatMap(object => object === UNKNOWN ? [UNKNOWN]
        : object && key in Object(object) ? alternatives(object[key])
          : element.initializer ? evaluate(element.initializer, env) : [undefined]);
      bind(element.name, choice(items), env);
    }
  };
  const parameterValues = (decl, env, stack) => {
    const fn = decl.parent;
    if (!isFunction(fn)) return [UNKNOWN];
    const index = fn.parameters.indexOf(decl);
    // Callback parameters are fed by the actual array/repeat input, not by
    // unrelated strings that happen to share their broad interface type.
    if (ts.isCallExpression(fn.parent) && fn.parent.arguments.includes(fn)) {
      const call = fn.parent;
      const input = ts.isPropertyAccessExpression(call.expression)
        && ['map', 'flatMap', 'filter', 'forEach'].includes(call.expression.name.text) ? call.expression.expression
        : call.expression.getText() === 'repeat' ? call.arguments[0] : null;
      if (input && index === 0) {
        const arrays = evaluate(input, env, stack);
        return arrays.flatMap(value => Array.isArray(value) ? value : [UNKNOWN]);
      }
    }
    const uses = calls.get(fn) || [];
    if (!uses.length) return [UNKNOWN];
    return uses.flatMap(call => call.arguments[index] ? evaluate(call.arguments[index], env, stack)
      : decl.initializer ? evaluate(decl.initializer, env, stack) : [undefined]);
  };
  const forOfValues = (decl, env, stack) => {
    const loop = decl.parent?.parent;
    return loop && ts.isForOfStatement(loop)
      ? evaluate(loop.expression, env, stack).flatMap(value => Array.isArray(value) ? value : [UNKNOWN]) : [UNKNOWN];
  };
  let observer = null, evaluationSteps = 0, evaluationMode = 'class';
  function evaluate(input, env = new Map(), stack = new Set()) {
    if (!stack.size) evaluationSteps = 0;
    const node = unwrap(input);
    if (!node || stack.has(node) || stack.size > 60 || ++evaluationSteps > 10000) return [UNKNOWN];
    observer?.(node);
    const next = new Set(stack).add(node), ev = child => evaluate(child, env, next);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return [ts.isNumericLiteral(node) ? Number(node.text) : node.text];
    if (node.kind === ts.SyntaxKind.TrueKeyword) return [true];
    if (node.kind === ts.SyntaxKind.FalseKeyword) return [false];
    if (node.kind === ts.SyntaxKind.NullKeyword) return [null];
    if (ts.isIdentifier(node)) {
      if (node.text === 'undefined' || node.text === 'nothing') return [''];
      if (env.has(node.text)) return narrow(arrayWrites(node, force(env.get(node.text)), env, next), node);
      const decl = declaration(node);
      if (decl && ts.isVariableDeclaration(decl) && decl.initializer) return narrow(arrayWrites(node, ev(decl.initializer), env, next), node);
      if (decl && ts.isVariableDeclaration(decl)) return narrow(forOfValues(decl, env, next), node);
      if (decl && ts.isParameter(decl)) return narrow(parameterValues(decl, env, next), node);
      if (decl && ts.isBindingElement(decl)) {
        const pattern = decl.parent, owner = pattern.parent;
        const values = ts.isParameter(owner) ? parameterValues(owner, env, next)
          : owner.initializer ? ev(owner.initializer) : forOfValues(owner, env, next);
        const key = ts.isArrayBindingPattern(pattern) ? pattern.elements.indexOf(decl)
          : propertyName(decl.propertyName || decl.name);
        return narrow(values.flatMap(value => value === UNKNOWN ? [UNKNOWN]
          : value && value[key] !== undefined ? force(value[key])
            : decl.initializer ? ev(decl.initializer) : [UNKNOWN]), node);
      }
      return finiteType(node);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const key = ts.isPropertyAccessExpression(node) ? node.name.text : ev(node.argumentExpression)[0];
      if (key === 'cssText') return ev(node.expression);
      if (evaluationMode === 'class') {
        const finite = finiteType(node);
        if (finite.every(value => typeof value === 'string')) return finite;
      }
      const declared = ts.isPropertyAccessExpression(node) && declaration(node.name);
      // Broad runtime scalar fields do not provide a finite recipe. Walking a
      // whole device/state graph to read a color/coordinate is both unnecessary
      // and can exhaust the bound before the surrounding literal CSS survives.
      // Object-literal fields and finite unions still resolve at actual callers.
      if (declared && ts.isPropertySignature(declared) && ts.isInterfaceDeclaration(declared.parent)) {
        const type = checker.getTypeAtLocation(node), parts = type.isUnion() ? type.types : [type];
        if (parts.some(part => part.flags & (ts.TypeFlags.String | ts.TypeFlags.Number))) return [UNKNOWN];
      }
      if (declared && ts.isPropertyDeclaration(declared) && declared.initializer
        && declared.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) return ev(declared.initializer);
      const values = ev(node.expression).flatMap(value => value !== UNKNOWN && value != null ? force(value[key] ?? UNKNOWN) : [UNKNOWN]);
      return narrow(values, node);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const item of node.properties) {
        if (ts.isPropertyAssignment(item)) result[propertyName(item.name)] = deferred(item.initializer, env, next);
        else if (ts.isShorthandPropertyAssignment(item)) result[item.name.text] = deferred(item.name, env, next);
        else if (ts.isSpreadAssignment(item)) for (const value of ev(item.expression)) if (value && typeof value === 'object') {
          for (const [key, field] of Object.entries(value)) result[key] = result[key] === undefined ? field
            : choice([...alternatives(result[key]), ...alternatives(field)]);
        }
      }
      return [result];
    }
    if (ts.isArrayLiteralExpression(node)) return [node.elements.flatMap(item => ts.isSpreadElement(item)
      ? ev(item.expression).flatMap(value => Array.isArray(value) ? value : [UNKNOWN]) : ev(item))];
    if (ts.isConditionalExpression(node)) {
      // A runtime string/object condition cannot narrow the finite branches.
      // Avoid traversing its entire presentation graph merely for truthiness.
      const conditions = finiteType(node.condition).includes(UNKNOWN) ? [UNKNOWN] : [...new Set(ev(node.condition))];
      return [...new Set(conditions.flatMap(value => value === UNKNOWN
        ? [...ev(node.whenTrue), ...ev(node.whenFalse)] : ev(value ? node.whenTrue : node.whenFalse)))];
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
      return ev(node.operand).map(value => value === UNKNOWN ? UNKNOWN : !value);
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const equality = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken];
      if (![ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.AmpersandAmpersandToken, ...equality].includes(op)) return finiteType(node);
      const left = ev(node.left), right = ev(node.right);
      if (op === ts.SyntaxKind.PlusToken && left.length * right.length <= 256)
        return left.flatMap(a => right.map(b => typeof a === 'string' || typeof b === 'string' ? textOf(a) + textOf(b)
          : a === UNKNOWN || b === UNKNOWN ? UNKNOWN
            : typeof a === 'number' && typeof b === 'number' ? a + b : UNKNOWN));
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken)
        return left.flatMap(value => value === UNKNOWN ? [...right, UNKNOWN] : (op === ts.SyntaxKind.BarBarToken ? !value : value == null) ? right : [value]);
      if (op === ts.SyntaxKind.AmpersandAmpersandToken)
        return left.flatMap(value => value === UNKNOWN ? [...right, ''] : value ? right : ['']);
      if (equality.includes(op))
        return left.flatMap(a => right.map(b => a === UNKNOWN || b === UNKNOWN ? UNKNOWN
          : [ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(op) ? a !== b : a === b));
      return finiteType(node);
    }
    if (ts.isTemplateExpression(node)) {
      let values = [node.head.text];
      for (const part of node.templateSpans) {
        const alternatives = ev(part.expression);
        if (values.length * alternatives.length > 256) return [UNKNOWN];
        values = values.flatMap(prefix => alternatives.map(value => prefix + textOf(value) + part.literal.text));
      }
      return values;
    }
    if (ts.isTaggedTemplateExpression(node)) return ev(node.template);
    if (ts.isCallExpression(node)) {
      const name = symbol(node.expression)?.getName() || node.expression.getText();
      if (/^(?:unsafeCSS|String|literal)$/.test(name)) return ev(node.arguments[0]);
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text, receivers = ev(node.expression.expression);
        if (method === 'join') {
          const separator = node.arguments[0] ? ev(node.arguments[0])[0] : ',';
          return receivers.map(value => Array.isArray(value) && separator !== UNKNOWN ? value.map(textOf).join(separator) : UNKNOWN);
        }
        if (method === 'trim') return receivers.map(value => typeof value === 'string' ? value.trim() : UNKNOWN);
        if (method === 'replace' || method === 'replaceAll') {
          const [from, to] = node.arguments.map(argument => ev(argument)[0]);
          return receivers.map(value => typeof value === 'string' && typeof from === 'string' && typeof to === 'string'
            ? method === 'replace' ? value.replace(from, to) : value.replaceAll(from, to) : UNKNOWN);
        }
        if (method === 'filter' && node.arguments[0]?.getText() === 'Boolean')
          return receivers.map(value => Array.isArray(value) ? value.filter(item => item === UNKNOWN || !!item) : UNKNOWN);
        if (method === 'map' && node.arguments[0] && ts.isArrowFunction(node.arguments[0]) && !ts.isBlock(node.arguments[0].body)) {
          const callback = node.arguments[0];
          return receivers.map(value => {
            if (!Array.isArray(value)) return UNKNOWN;
            return value.flatMap(item => {
              const local = new Map(env); if (callback.parameters[0]) bind(callback.parameters[0].name, item, local);
              return evaluate(callback.body, local, next);
            });
          });
        }
      }
      const fn = checker.getResolvedSignature(node)?.declaration;
      if (fn && fn.body && !relative(root, fn.getSourceFile().fileName).startsWith('..')) {
        if (ts.isBlock(fn.body) && !supportedStatements(fn.body.statements)) return finiteType(node);
        const local = new Map(env);
        for (let i = 0; i < fn.parameters.length; i++) {
          const parameter = fn.parameters[i];
          const value = node.arguments[i] ? deferred(node.arguments[i], env, next)
            : parameter.initializer ? deferred(parameter.initializer, local, next) : undefined;
          bind(parameter.name, value, local);
        }
        const returned = []; let uncertain = false;
        const execute = statements => {
          for (const statement of statements) {
            if (ts.isVariableStatement(statement)) for (const item of statement.declarationList.declarations)
              bind(item.name, deferred(item.initializer, local, next), local);
            else if (ts.isReturnStatement(statement)) return evaluate(statement.expression, local, next);
            else if (ts.isIfStatement(statement)) {
              const tests = evaluate(statement.expression, local, next);
              const condition = tests.some(value => value === UNKNOWN) || tests.some(Boolean) && tests.some(value => !value) ? UNKNOWN : tests.some(Boolean);
              if (condition !== UNKNOWN) {
                const selected = condition ? statement.thenStatement : statement.elseStatement;
                if (selected) { const result = execute(ts.isBlock(selected) ? selected.statements : [selected]); if (result) return result; }
              } else {
                for (const branch of [statement.thenStatement, statement.elseStatement]) if (branch) {
                  const result = execute(ts.isBlock(branch) ? branch.statements : [branch]);
                  if (result) returned.push(...result);
                }
              }
            } else if (!ts.isEmptyStatement(statement) && !arrayMutationStatement(statement)) uncertain = true;
          }
          return null;
        };
        const direct = ts.isBlock(fn.body) ? execute(fn.body.statements) || [] : evaluate(fn.body, local, next);
        const result = [...returned, ...direct, ...(uncertain ? [UNKNOWN] : [])];
        if (!result.length) return [UNKNOWN];
        return result.every(Array.isArray) ? [[...new Set(result.flat())]] : result;
      }
      return finiteType(node);
    }
    return finiteType(node);
  }
  const site = node => ({ file: relative(root, node.getSourceFile().fileName).replaceAll('\\', '/'),
    line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1, owner: namedOwner(node) });
  const traceEvaluation = node => {
    const segments = [], seen = new Set(), previous = observer, previousMode = evaluationMode;
    evaluationMode = 'css';
    observer = current => {
      if ((ts.isStringLiteralLike(current) || ts.isTemplateExpression(current)) && !seen.has(current)) {
        seen.add(current); segments.push({ ...site(current), raw: current.getText(), node: current });
      }
    };
    try { return { values: evaluate(node), segments }; }
    finally { observer = previous; evaluationMode = previousMode; }
  };
  return { root, program, checker, sources, nodes, evaluate, traceEvaluation, site, UNKNOWN,
    hasWrites: node => writes.has(symbol(node)),
    callName: node => symbol(node)?.getName() || node.getText() };
}

export function analyzeCssSources(root) {
  const analysis = createSourceAnalysis(root);
  const { nodes, evaluate, traceEvaluation, site, checker, callName } = analysis;
  const css = [], classes = new Set(), classSites = new Map(), dynamic = [], diagnostics = [];
  const animations = [], variables = new Map(), annotations = [], usedAnnotations = new Set(), boundValues = new Map();
  const cssRoots = new Set();
  const addCss = (node, value, declarations = false, segments = []) => {
    if (typeof value !== 'string' || value.trim() === '__HP_DYNAMIC__') {
      diagnostics.push({ ...site(node), kind: 'dynamic-css', name: 'CSS text',
        message: 'Actual CSS-bearing sink has no complete finite recipe', expression: node.getText().slice(0, 160) });
      return;
    }
    if (!value.trim()) return;
    css.push({ ...site(node), text: declarations ? `:root{${value}}` : value, node, segments });
  };
  const emitCss = (node, expression, declarations = false) => {
    const { values, segments } = traceEvaluation(expression);
    for (const value of values) addCss(node, value, declarations, segments);
  };
  const addClass = (name, node) => {
    if (!name || name.includes('__HP_')) return;
    classes.add(name);
    const sites = classSites.get(name) || []; sites.push(site(node)); classSites.set(name, sites);
  };
  const boundary = node => {
    for (let current = node; current; current = current.parent)
      if (ts.isStatement(current) || ts.isPropertyDeclaration(current)) return current;
    return node;
  };
  // Only AST-attached leading comments are candidates. Arbitrary strings or
  // detached comments cannot grant a class consumer.
  const seenComments = new Set();
  for (const node of nodes) {
    for (const range of ts.getLeadingCommentRanges(node.getSourceFile().text, node.getFullStart()) || []) {
      const key = node.getSourceFile().fileName + ':' + range.pos;
      if (seenComments.has(key)) continue;
      const raw = node.getSourceFile().text.slice(range.pos, range.end);
      if (!raw.includes('css-uses')) continue;
      seenComments.add(key);
      const found = /^\/\*\s*css-uses\s+([^]*)\*\/$/.exec(raw);
      try {
        if (!found) throw Error('Expected /* css-uses JSON */');
        const value = JSON.parse(found[1]);
        if (!value || Object.keys(value).sort().join(',') !== 'kind,owner,reason,values'
          || typeof value.owner !== 'string' || !value.owner.trim()
          || !['class', 'keyframes'].includes(value.kind) || typeof value.reason !== 'string' || !value.reason.trim()
          || !Array.isArray(value.values) || !value.values.length || new Set(value.values).size !== value.values.length
          || value.values.some(v => typeof v !== 'string' || !/^[-_\p{L}][-_\p{L}\p{N}]*$/u.test(v)))
          throw Error('Exact owner/kind/unique finite values/reason required; wildcards are forbidden');
        annotations.push({ ...value, source: node.getSourceFile(), end: range.end, pos: range.pos });
      } catch (error) { diagnostics.push({ ...site(node), kind: 'annotation', name: 'css-uses', message: error.message }); }
    }
  }
  const annotationFor = (node, kind, pattern) => {
    const start = boundary(node).getStart(), own = namedOwner(node);
    const matches = annotations.filter(a => a.source === node.getSourceFile() && a.kind === kind
      && a.end <= start && !a.source.text.slice(a.end, start).trim());
    for (const annotation of matches) {
      if (annotation.owner !== own) {
        diagnostics.push({ ...site(node), kind: 'annotation', name: annotation.owner,
          message: 'Annotation owner or finite prefix/suffix does not match actual producer' });
        usedAnnotations.add(annotation); continue;
      }
      const matching = annotation.values.filter(value => pattern.test(value));
      if (!matching.length) continue;
      usedAnnotations.add(annotation);
      const bound = boundValues.get(annotation) || new Set();
      for (const value of matching) bound.add(value);
      boundValues.set(annotation, bound);
      return matching;
    }
    return null;
  };
  const classExpression = (node, prefix = '', suffix = '', producer = node) => {
    node = unwrap(node);
    if (!node) return;
    if (ts.isCallExpression(node) && callName(node.expression) === 'classMap') {
      const objectKeys = (input, seen = new Set()) => {
        const object = unwrap(input);
        if (!object || seen.has(object)) return false;
        seen = new Set(seen).add(object);
        if (ts.isIdentifier(object)) {
          let symbol = checker.getSymbolAtLocation(object);
          if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          const declared = symbol?.valueDeclaration;
          if (declared && ts.isVariableDeclaration(declared) && declared.initializer) return objectKeys(declared.initializer, seen);
        }
        if (!ts.isObjectLiteralExpression(object)) return false;
        let complete = true;
        for (const prop of object.properties) {
          if (ts.isSpreadAssignment(prop)) complete = objectKeys(prop.expression, seen) && complete;
          else if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
            if (ts.isComputedPropertyName(prop.name)) classExpression(prop.name.expression, prefix, suffix, producer);
            else for (const word of words(propertyName(prop.name) || '')) addClass(prefix + word + suffix, producer);
          }
        }
        return complete;
      };
      if (!objectKeys(node.arguments[0])) {
        const finite = annotationFor(producer, 'class', new RegExp('^' + escapeRegex(prefix) + '[-_\\p{L}\\p{N}]+' + escapeRegex(suffix) + '$', 'u'));
        if (finite) for (const name of finite) addClass(name, producer);
        else dynamic.push({ ...site(producer), kind: 'dynamic-class', name: prefix + '${…}' + suffix,
          expression: node.getText().slice(0, 160) });
      }
      return;
    }
    const values = evaluate(node);
    let unknown = false;
    for (const value of values) {
      if (value === UNKNOWN || typeof value !== 'string' || value.includes('__HP_DYNAMIC__')) { unknown = true; continue; }
      for (const word of words(prefix + value + suffix)) addClass(word, producer);
    }
    if (unknown) {
      const pattern = new RegExp('^' + escapeRegex(prefix) + '[-_\\p{L}\\p{N}]+' + escapeRegex(suffix) + '$', 'u');
      const finite = annotationFor(producer, 'class', pattern);
      if (finite) for (const value of finite) addClass(value, producer);
      else dynamic.push({ ...site(producer), kind: 'dynamic-class', name: prefix + '${…}' + suffix,
        expression: node.getText().slice(0, 160) });
    }
  };
  const pieces = template => {
    if (ts.isNoSubstitutionTemplateLiteral(template) || ts.isStringLiteralLike(template)) return { text: template.text, expressions: [] };
    if (!ts.isTemplateExpression(template)) return null;
    const expressions = template.templateSpans.map(part => part.expression);
    return { text: template.head.text + template.templateSpans.map((part, i) => `__HP_EXPR_${i}__` + part.literal.text).join(''), expressions };
  };
  const classAttribute = (value, expressions, producer) => {
    const unknowns = [];
    const marker = node => { const id = unknowns.push(node) - 1; return `__HP_UNKNOWN_${id}__`; };
    const emit = word => {
      if (!word) return;
      const hits = [...word.matchAll(/__HP_UNKNOWN_(\d+)__/g)];
      if (!hits.length) { addClass(word, producer); return; }
      const pattern = new RegExp('^' + word.split(/__HP_UNKNOWN_\d+__/).map(escapeRegex).join('[-_\\p{L}\\p{N}]+') + '$', 'u');
      const finite = annotationFor(producer, 'class', pattern);
      if (finite) for (const name of finite) addClass(name, producer);
      else dynamic.push({ ...site(producer), kind: 'dynamic-class', name: word.replace(/__HP_UNKNOWN_\d+__/g, '${…}'),
        expression: hits.map(hit => unknowns[Number(hit[1])]?.getText().slice(0, 100)).join(' + ') });
    };
    const literal = (text, states) => {
      const chunks = text.split(/([\t\n\f\r ]+)/);
      for (const chunk of chunks) {
        if (/^[\t\n\f\r ]+$/.test(chunk)) { for (const state of states) emit(state); states = ['']; }
        else states = states.map(state => state + chunk);
      }
      return states;
    };
    const expression = (input, states, stack = new Set()) => {
      const node = unwrap(input);
      if (!node || stack.has(node)) return literal(marker(node || producer), states);
      const next = new Set(stack).add(node);
      if (ts.isStringLiteralLike(node)) return literal(node.text, states);
      if (ts.isSpreadElement(node)) {
        const values = evaluate(node.expression);
        return [...new Set(values.flatMap(value => {
          let branch = [...states];
          if (!Array.isArray(value)) return literal(' ', literal(marker(node), branch));
          for (const item of value) branch = literal(' ', literal(textOf(item).replaceAll('__HP_DYNAMIC__', marker(node)), branch));
          return branch;
        }))];
      }
      if (ts.isConditionalExpression(node)) return [...new Set([
        ...expression(node.whenTrue, [...states], next), ...expression(node.whenFalse, [...states], next)])];
      if (ts.isTemplateExpression(node)) {
        states = literal(node.head.text, states);
        for (const part of node.templateSpans) states = literal(part.literal.text, expression(part.expression, states, next));
        return states;
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
        return expression(node.right, expression(node.left, states, next), next);
      if (ts.isIdentifier(node)) {
        const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && !analysis.hasWrites(node))
          return expression(declaration.initializer, states, next);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join') {
        let receiver = unwrap(node.expression.expression);
        if (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression)
          && receiver.expression.name.text === 'filter' && receiver.arguments[0]?.getText() === 'Boolean') receiver = unwrap(receiver.expression.expression);
        if (ts.isArrayLiteralExpression(receiver) && evaluate(node.arguments[0])[0] === ' ') {
          for (const item of receiver.elements) states = literal(' ', expression(item, states, next));
          return states;
        }
      }
      if (ts.isCallExpression(node) && callName(node.expression) === 'classMap') {
        classExpression(node, '', '', producer); return states;
      }
      const values = evaluate(node);
      if (values.length * states.length > 256) return literal(marker(node), states);
      return [...new Set(values.flatMap(item => literal(item === UNKNOWN || typeof item !== 'string'
        ? marker(node) : item.replaceAll('__HP_DYNAMIC__', marker(node)), [...states])))];
    };
    let states = [''], from = 0;
    for (const match of value.matchAll(/__HP_EXPR_(\d+)__/g)) {
      states = expression(expressions[Number(match[1])], literal(value.slice(from, match.index), states));
      from = match.index + match[0].length;
    }
    states = literal(value.slice(from), states);
    for (const state of states) emit(state);
  };
  const markup = (template, producer) => {
    const data = pieces(template);
    if (!data) { for (const value of evaluate(template)) if (typeof value === 'string') markupText(value, [], producer); return; }
    markupText(data.text, data.expressions, producer);
  };
  const markupText = (text, expressions, producer) => {
    const inlineDeclarations = text => {
      let states = [''], from = 0;
      const literal = fragment => {
        const next = [];
        for (const state of states) {
          const chunks = splitCssFragments(state + fragment, ';');
          for (const chunk of chunks.slice(0, -1)) addCss(producer, chunk, true);
          next.push(chunks.at(-1));
        }
        states = [...new Set(next)];
      };
      for (const match of text.matchAll(/__HP_EXPR_(\d+)__/g)) {
        literal(text.slice(from, match.index));
        const parts = [...new Set(evaluate(expressions[Number(match[1])]).map(textOf))];
        if (states.length * parts.length > 256) { addCss(producer, UNKNOWN, true); return; }
        const prior = states; states = [];
        for (const part of parts) {
          const branches = states; states = [...prior]; literal(part); states = [...branches, ...states];
        }
        states = [...new Set(states)]; from = match.index + match[0].length;
      }
      literal(text.slice(from));
      for (const state of states) addCss(producer, state, true);
    };
    const interpolate = (text, segments = []) => {
      let values = [''], from = 0;
      for (const match of text.matchAll(/__HP_EXPR_(\d+)__/g)) {
        const trace = traceEvaluation(expressions[Number(match[1])]); segments.push(...trace.segments);
        const parts = [...new Set(trace.values.map(textOf))];
        if (values.length * parts.length > 256) return [UNKNOWN];
        values = [...new Set(values.flatMap(prefix => parts.map(value => prefix + text.slice(from, match.index) + value)))];
        from = match.index + match[0].length;
      }
      return [...new Set(values.map(value => value + text.slice(from)))];
    };
    for (const attribute of htmlAttributes(text)) {
      if (attribute.name === 'class') classAttribute(attribute.value, expressions, producer);
      if (attribute.name === 'style') {
        const placeholder = /^__HP_EXPR_(\d+)__$/.exec(attribute.value);
        const expression = placeholder && unwrap(expressions[Number(placeholder[1])]);
        if (expression && ts.isCallExpression(expression) && callName(expression.expression) === 'styleMap'
          && ts.isObjectLiteralExpression(expression.arguments[0])) {
          for (const property of expression.arguments[0].properties) if (ts.isPropertyAssignment(property))
            styleAssignment(propertyName(property.name), property.initializer, producer);
        } else {
          inlineDeclarations(attribute.value);
        }
      }
    }
    for (const match of text.matchAll(/<style(?:\s[^>]*)?>([^]*?)<\/style\s*>/gi)) {
      const segments = [{ ...site(producer), raw: producer.getText(), node: producer }];
      for (const value of interpolate(match[1], segments)) addCss(producer, value, false, segments);
    }
  };
  const styleAssignment = (key, expression, producer) => {
    const values = evaluate(expression).filter(value => typeof value === 'string');
    if (key === 'animation' || key === 'animationName' || key === 'animation-name')
      animations.push(...values.map(value => ({ value, nameOnly: key !== 'animation' })));
    else if (typeof key === 'string' && key.startsWith('--')) variables.set(key, [...(variables.get(key) || []), ...values]);
    if (!values.length && ['animation', 'animationName', 'animation-name'].includes(key)) {
      const finite = annotationFor(producer, 'keyframes', /^[-_\p{L}][-_\p{L}\p{N}]*$/u);
      if (finite) animations.push(...finite.map(value => ({ value, nameOnly: true })));
    }
  };
  const styleDeclaration = node => ts.isPropertyAccessExpression(node) && node.name.text === 'style'
    || /\bCSSStyleDeclaration\b/.test(checker.typeToString(checker.getTypeAtLocation(node)));
  for (const node of nodes) {
    if (ts.isTaggedTemplateExpression(node) && ['html', 'svg'].includes(callName(node.tag))) markup(node.template, node);
    if (ts.isTaggedTemplateExpression(node) && callName(node.tag) === 'css') {
      let parent = node, current = node;
      while (current.parent && (ts.isPropertyAccessExpression(current.parent) && current.parent.name.text === 'cssText'
        || ts.isTemplateSpan(current.parent) || ts.isTemplateExpression(current.parent)
        || ts.isBinaryExpression(current.parent) && current.parent.operatorToken.kind === ts.SyntaxKind.PlusToken
        || ts.isCallExpression(current.parent) && callName(current.parent.expression) === 'unsafeCSS')) { parent = current.parent; current = parent; }
      if (![...functionAncestors(parent)].length && !cssRoots.has(parent)) {
        cssRoots.add(parent); emitCss(parent, parent);
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)) {
      const left = node.left, name = left.name.text;
      if (name === 'className') classExpression(node.right, '', '', node);
      if (name === 'innerHTML') markup(node.right, node);
      if (name === 'cssText') emitCss(node, node.right, true);
      if (name === 'textContent') {
        const type = checker.typeToString(checker.getTypeAtLocation(left.expression));
        if (/HTMLStyleElement/.test(type)) emitCss(node, node.right);
      }
      if (styleDeclaration(left.expression)) styleAssignment(name, node.right, node);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text, receiver = node.expression.expression;
      if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'classList') {
        const args = method === 'add' ? node.arguments : method === 'toggle' ? node.arguments.slice(0, 1) : method === 'replace' ? node.arguments.slice(1, 2) : [];
        for (const arg of args) classExpression(arg, '', '', node);
      }
      if (method === 'setAttribute' && evaluate(node.arguments[0])[0] === 'class') classExpression(node.arguments[1], '', '', node);
      if (method === 'replaceSync' && /\bCSSStyleSheet\b/.test(checker.typeToString(checker.getTypeAtLocation(receiver)))) emitCss(node, node.arguments[0]);
      if (method === 'setProperty' && styleDeclaration(receiver)) styleAssignment(evaluate(node.arguments[0])[0], node.arguments[1], node);
    }
  }
  for (const annotation of annotations) if (!usedAnnotations.has(annotation)
    || boundValues.has(annotation) && annotation.values.some(value => !boundValues.get(annotation).has(value))) diagnostics.push({
    file: relative(analysis.root, annotation.source.fileName).replaceAll('\\', '/'),
    line: annotation.source.getLineAndCharacterOfPosition(annotation.pos).line + 1,
    kind: 'annotation', name: annotation.owner, message: 'Annotation is not bound to a supported unresolved producer' });
  return { ...analysis, css, classes, classSites, dynamic, diagnostics, animations, variables };
}

function* functionAncestors(node) {
  for (let current = node.parent; current; current = current.parent) if (isFunction(current)) yield current;
}

/** AST extraction for the compatible ownership/equivalence leaf-source API. */
export function cssOfSource(source, file = 'inline.ts') {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const chunks = [], tags = new Set(['css']);
  for (const statement of ast.statements) if (ts.isImportDeclaration(statement)) {
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements)
      if ((binding.propertyName || binding.name).text === 'css') tags.add(binding.name.text);
  }
  const visit = node => {
    if (ts.isTaggedTemplateExpression(node) && tags.has(node.tag.getText(ast))) {
      if (!ts.isNoSubstitutionTemplateLiteral(node.template)) throw Error('interpolation in css``');
      chunks.push(node.template.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return chunks.join('\n');
}
