import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('docs/data-hp-contract.json', root), 'utf8'));

const sourceFiles = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? sourceFiles(join(dir, entry.name))
    : extname(entry.name) === '.ts' ? [join(dir, entry.name)] : []);

const srcDir = fileURLToPath(new URL('src/', root));
const sources = sourceFiles(srcDir).map((path) => ({
  path,
  relative: relative(srcDir, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));

function stringResults(expression, file) {
  if (ts.isStringLiteralLike(expression)) return [expression.text];
  if (ts.isConditionalExpression(expression)) {
    return [
      ...stringResults(expression.whenTrue, file),
      ...stringResults(expression.whenFalse, file),
    ];
  }
  if (ts.isParenthesizedExpression(expression)
      || ts.isAsExpression(expression)
      || ts.isNonNullExpression(expression)
      || ts.isSatisfiesExpression(expression)) {
    return stringResults(expression.expression, file);
  }
  if (ts.isIdentifier(expression) && expression.text === 'nothing') return [];
  throw new Error(`Unsupported dynamic data-hp expression in ${file}: ${expression.getText()}`);
}

function collectTemplateValues(source, file) {
  const found = new Set();
  const unit = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const inspectStatic = (text) => {
    for (const match of text.matchAll(/\bdata-hp\s*=\s*["']([^"']+)["']/g)) found.add(match[1]);
  };
  const visit = (node) => {
    if (ts.isTaggedTemplateExpression(node)) {
      const template = node.template;
      if (ts.isNoSubstitutionTemplateLiteral(template)) {
        inspectStatic(template.text);
      } else {
        let preceding = template.head.text;
        inspectStatic(preceding);
        for (const span of template.templateSpans) {
          if (/\bdata-hp\s*=\s*$/.test(preceding)) {
            for (const value of stringResults(span.expression, file)) found.add(value);
          }
          preceding = span.literal.text;
          inspectStatic(preceding);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(unit);

  for (const match of source.matchAll(/\.setAttribute\(\s*["']data-hp["']\s*,\s*["']([^"']+)["']\s*\)/g)) {
    found.add(match[1]);
  }
  for (const match of source.matchAll(/\.dataset\.hp\s*=\s*["']([^"']+)["']/g)) {
    found.add(match[1]);
  }
  return found;
}

const sourceValues = new Set(sources.flatMap(({ text, relative: file }) =>
  [...collectTemplateValues(text, file)]));

const publicValues = new Set(Object.keys(contract.hooks));
const internalValue = (value) => contract.internalExactValues.includes(value)
  || contract.internalPrefixes.some((prefix) => value.startsWith(prefix));

function validateValues(values) {
  const undeclared = [...values].filter((value) => !publicValues.has(value) && !internalValue(value));
  assert.deepEqual(undeclared, [], `undeclared data-hp values: ${undeclared.join(', ')}`);
  const missing = [...publicValues].filter((value) => !values.has(value));
  assert.deepEqual(missing, [], `declared data-hp values missing from src: ${missing.join(', ')}`);
}

test('#489 inventory has a versioned, machine-readable shape', () => {
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.attribute, 'data-hp');
  assert.equal(contract.stability.removalPolicy, 'changelog-and-one-stable-version-transition');
  assert.equal(contract.stability.additionsAreCompatible, true);
  assert.ok(Object.keys(contract.hooks).length > 20);
  for (const [value, entry] of Object.entries(contract.hooks)) {
    assert.match(value, /^[a-z][a-z0-9-]*$/);
    assert.ok(Array.isArray(entry.elements) && entry.elements.length > 0, `${value}: elements`);
    assert.ok(typeof entry.since === 'string' && entry.since.length > 0, `${value}: since`);
    assert.ok(Array.isArray(entry.audience) && entry.audience.length > 0, `${value}: audience`);
    assert.ok(entry.audience.every((audience) => ['styling', 'test'].includes(audience)),
      `${value}: unknown audience`);
  }
  for (const [attribute, entry] of Object.entries(contract.rootAttributes)) {
    assert.match(attribute, /^data-hp-/);
    assert.equal(entry.element, 'ha-card');
    assert.ok(Array.isArray(entry.values) && entry.values.length > 0, `${attribute}: values`);
    assert.ok(typeof entry.since === 'string' && entry.since.length > 0, `${attribute}: since`);
  }
});

test('#489 every source data-hp value is public or explicitly internal, and every public hook exists', () => {
  validateValues(sourceValues);
});

test('#489 a renamed public hook is rejected by the same validator', () => {
  const mutant = new Set([...sourceValues].map((value) => value === 'settings' ? 'settings-renamed' : value));
  assert.throws(() => validateValues(mutant), /undeclared data-hp values: settings-renamed/);
});

test('#489 every hp-dialog call site declares a documented broad kind', () => {
  const allowed = new Set(contract.hooks.dialog.attributes['data-kind']);
  let count = 0;
  for (const { text, relative: file } of sources) {
    for (const match of text.matchAll(/<hp-dialog\b[\s\S]*?>/g)) {
      count += 1;
      const kind = match[0].match(/\bdata-kind=["']([^"']+)["']/)?.[1];
      assert.ok(kind, `${file}: hp-dialog without data-kind`);
      assert.ok(allowed.has(kind), `${file}: undocumented dialog kind ${kind}`);
    }
  }
  assert.ok(count >= 30, `expected the complete dialog surface, found ${count}`);
});

test('#489 root readiness and mode attributes cover every full-card ha-card branch', () => {
  const card = sources.find((entry) => entry.relative === 'houseplan-card.ts')?.text || '';
  const cards = [...card.matchAll(/<ha-card\b/g)].length;
  assert.equal(cards, 4, 'new root render branches must extend this contract test');
  assert.equal([...card.matchAll(/\bdata-hp-state=/g)].length, cards);
  assert.equal([...card.matchAll(/\bdata-hp-mode=/g)].length, cards);
  assert.deepEqual(contract.rootAttributes['data-hp-state'].values, ['booting', 'ready']);
  assert.deepEqual(contract.rootAttributes['data-hp-mode'].values, ['view', 'plan', 'devices', 'decor']);
  assert.match(card, /_mode:\s*'view'\s*\|\s*'plan'\s*\|\s*'devices'\s*\|\s*'decor'\s*=\s*'view'/);
});

test('#489 dialog actions, editor tool vocabulary and panel hooks remain represented', () => {
  const all = sources.map((entry) => entry.text).join('\n');
  assert.ok([...all.matchAll(/data-hp="dialog-confirm"/g)].length >= 30);
  assert.ok([...all.matchAll(/data-hp="dialog-cancel"/g)].length >= 30);
  const dialog = sources.find((entry) => entry.relative === 'hp-dialog.ts')?.text || '';
  assert.match(dialog, /connectedCallback\(\): void \{[\s\S]*this\.setAttribute\('data-hp', 'dialog'\);[\s\S]*super\.connectedCallback\(\);/);
  assert.match(dialog, /<button class="close" type="button"[\s\S]*data-hp="dialog-cancel"/);

  const toolValues = new Set(contract.hooks.tool.attributes['data-tool']);
  for (const required of [
    'select', 'draw', 'column', 'merge', 'split', 'resize', 'wall-thickness',
    'delete-room', 'opening', 'add-device', 'device-inbox', 'icon-rules',
    'backdrop', 'line', 'rect', 'ellipse', 'text', 'furniture', 'image', 'erase',
  ]) assert.ok(toolValues.has(required), `missing data-tool ${required}`);

  const panel = sources.find((entry) => entry.relative === 'houseplan-panel.ts')?.text || '';
  assert.match(panel, /menu\.dataset\.hp = 'panel-menu'/);
  assert.match(panel, /title\.dataset\.hp = 'panel-title'/);
});
