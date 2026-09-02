import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dictionary = {
  ...JSON.parse(readFileSync(join(repoRoot, 'src/i18n/en.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(repoRoot, 'src/i18n/support/en.json'), 'utf8')),
};
const dictionaryKeys = Object.keys(dictionary);

const sourceFiles = [];
const visitDirectory = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visitDirectory(path);
    else if (entry.isFile() && entry.name.endsWith('.ts')) sourceFiles.push(path);
  }
};
visitDirectory(join(repoRoot, 'src'));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Convert a string-producing expression into a dictionary-key matcher. */
const expressionPattern = (node) => {
  if (ts.isStringLiteralLike(node)) return { source: escapeRegExp(node.text), dynamic: false };
  if (ts.isParenthesizedExpression(node)) return expressionPattern(node.expression);
  if (ts.isTemplateExpression(node)) {
    let source = escapeRegExp(node.head.text);
    for (const span of node.templateSpans) {
      source += '.+' + escapeRegExp(span.literal.text);
    }
    return { source, dynamic: true };
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = expressionPattern(node.left);
    const right = expressionPattern(node.right);
    if (!left && !right) return null;
    return {
      source: (left?.source || '.+') + (right?.source || '.+'),
      dynamic: (left?.dynamic ?? true) || (right?.dynamic ?? true),
    };
  }
  return null;
};

const literalConsumers = new Set();
const dynamicConsumers = [];
const derivedHelpAria = new Set();

for (const path of sourceFiles) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) literalConsumers.add(node.text);

    if (ts.isTemplateExpression(node)
        || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      const pattern = expressionPattern(node);
      if (pattern?.dynamic && /[A-Za-z]/.test(pattern.source)) {
        dynamicConsumers.push(new RegExp(`^${pattern.source}$`));
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
  visit(source);
}

test('every i18n key has a literal, dynamic-family or derived help consumer', () => {
  const unused = dictionaryKeys.filter((key) => !literalConsumers.has(key)
    && !derivedHelpAria.has(key)
    && !dynamicConsumers.some((pattern) => pattern.test(key)));
  assert.deepEqual(unused, [], unused.length
    ? `Unused i18n keys: ${unused.join(', ')}. Use each key from src/ or delete it from every locale.`
    : undefined);
});

test('help accessibility copy is derived from every literal help consumer', () => {
  assert.equal(derivedHelpAria.size, 19, 'the current settings surface has 19 help descriptions');
  for (const key of derivedHelpAria) {
    assert.equal(typeof dictionary[key], 'string', `${key} must accompany its .help consumer`);
  }
});
