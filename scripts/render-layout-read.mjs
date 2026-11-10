#!/usr/bin/env node
// #654: render and 2.5D pure helpers must not force browser layout. This is an
// AST contract, not a regex anchor: formatting and comments cannot satisfy it.
// #725: a forced layout is a call (`getComputedStyle`, `getBoundingClientRect`)
// or a read of a layout property (`clientWidth`, `offsetTop`, …). The contract
// also judges `_isoScene` in the card (reached from `_renderBody` through
// `_effectiveProjection`) and the whole summary-panel runtime, whose render and
// lifecycle methods run on every card pass. Its two post-render measurement
// owners may read layout, but render/layout/willUpdate must never reach them.
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { isMainModule } from './spawn-portable.mjs';

const forbiddenCallNames = new Set(['getComputedStyle', 'getBoundingClientRect']);
const forbiddenReads = new Set([
  'clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft',
  'scrollWidth', 'scrollHeight',
]);
const SUMMARY_MEASURE_METHODS = new Set(['measureLayout', 'measurePanelBox']);

const source = (path, text) => ts.createSourceFile(
  path, text,
  ts.ScriptTarget.Latest, true,
);
const callName = (node) => !ts.isCallExpression(node) ? null
  : ts.isIdentifier(node.expression) ? node.expression.text
    : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null;
const readName = (node) => ts.isPropertyAccessExpression(node) ? node.name.text
  : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
    ? node.argumentExpression.text
    : ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)
      ? (node.propertyName ?? node.name).getText() : null;
const methodName = (node) => (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node))
  && node.name && ts.isIdentifier(node.name) ? node.name.text : null;
/** Forced-layout calls and reads under `node`, skipping subtrees `skip` accepts. */
const layoutReads = (node, skip = () => false) => {
  const found = [];
  const visit = (child) => {
    if (skip(child)) return;
    const call = callName(child);
    if (call && forbiddenCallNames.has(call)) found.push(call);
    const read = readName(child);
    if (read && forbiddenReads.has(read)) found.push(read);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

export function inspectLayoutReads({ cardText, summaryText, isoTexts = [] }) {
  const problems = [];
  const card = source('src/houseplan-card.ts', cardText);
  const required = new Set(['render', '_renderBody', 'willUpdate', '_isoScene']);
  const checked = new Set();
  const visit = (node) => {
    const name = methodName(node);
    if (name && required.has(name) && ts.isMethodDeclaration(node)) {
      checked.add(name);
      const reads = layoutReads(node.body);
      if (reads.length) problems.push(`${name} forces layout: ${reads.join(', ')}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(card);
  for (const name of required) if (!checked.has(name)) problems.push(`guarded method is missing: ${name}`);

  const summaryFile = 'src/summary-panel-runtime-loaded.ts';
  const summary = source(summaryFile, summaryText), measures = new Map();
  const summaryReads = layoutReads(summary, (node) => {
    const name = methodName(node);
    if (!SUMMARY_MEASURE_METHODS.has(name)) return false;
    measures.set(name, (measures.get(name) ?? 0) + 1);
    return true;
  });
  for (const name of SUMMARY_MEASURE_METHODS) if (measures.get(name) !== 1)
    problems.push(`${summaryFile}: expected one measurement method ${name}, found ${measures.get(name) ?? 0}`);
  if (summaryReads.length) {
    problems.push(`${summaryFile} forces layout outside measurement owners: ${summaryReads.join(', ')}`);
  }

  // Exempting a helper body alone would let layout() call that helper on every
  // render. Follow local calls/getters from the pure entry points as well.
  const methods = new Map();
  const collect = node => {
    const name = methodName(node);
    if (name && node.body) methods.set(name, node);
    ts.forEachChild(node, collect);
  };
  collect(summary);
  const thisMember = node => (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    && node.expression.kind === ts.SyntaxKind.ThisKeyword ? readName(node) : null;
  const follow = (name, path, seen) => {
    if (seen.has(name)) return;
    seen.add(name);
    if (SUMMARY_MEASURE_METHODS.has(name)) {
      problems.push(`${summaryFile} render path reaches measurement: ${[...path, name].join(' -> ')}`);
      return;
    }
    const method = methods.get(name);
    if (!method) return;
    const visit = node => {
      // Registered callbacks and Promise continuations run after this render,
      // unlike immediate callbacks such as map()/forEach(). Direct layout reads
      // are still checked by layoutReads above, regardless of callback shape.
      if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node))
        && ['then', 'catch', 'finally', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'addEventListener']
          .includes(callName(node.parent))) return;
      const called = ts.isCallExpression(node) ? thisMember(node.expression) : null;
      const getter = thisMember(node);
      if (called) follow(called, [...path, name], seen);
      if (getter && ts.isGetAccessorDeclaration(methods.get(getter) ?? summary)) follow(getter, [...path, name], seen);
      ts.forEachChild(node, visit);
    };
    visit(method.body);
  };
  for (const entry of ['render', 'layout', 'willUpdate']) follow(entry, [], new Set());

  for (const [file, text] of isoTexts) {
    const reads = layoutReads(source(`src/${file}`, text));
    if (reads.length) problems.push(`${file} forces layout: ${reads.join(', ')}`);
  }
  return problems;
}

if (isMainModule(import.meta.url)) {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const problems = inspectLayoutReads({
    cardText: read('src/houseplan-card.ts'), summaryText: read('src/summary-panel-runtime-loaded.ts'),
    isoTexts: readdirSync(new URL('../src', import.meta.url)).filter(name => /^iso-.*\.ts$/.test(name))
      .map(name => [name, read(`src/${name}`)]),
  });
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
}
console.log('render/layout-read AST contract: OK');
}
