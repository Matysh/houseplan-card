#!/usr/bin/env node
// #654: render and 2.5D pure helpers must not force browser layout. This is an
// AST contract, not a regex anchor: formatting and comments cannot satisfy it.
// #725: a forced layout is a call (`getComputedStyle`, `getBoundingClientRect`)
// or a read of a layout property (`clientWidth`, `offsetTop`, …). The contract
// also judges `_isoScene` in the card (reached from `_renderBody` through
// `_effectiveProjection`) and the whole summary-panel runtime, whose render and
// lifecycle methods run on every card pass; only its one measurement method
// may read layout.
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

const forbiddenCallNames = new Set(['getComputedStyle', 'getBoundingClientRect']);
const forbiddenReads = new Set([
  'clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft',
  'scrollWidth', 'scrollHeight',
]);
/** The summary-panel runtime method allowed to measure (#725). */
const SUMMARY_MEASURE_METHOD = 'measureLayout';

const source = (path) => ts.createSourceFile(
  path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'),
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

const problems = [];
const card = source('src/houseplan-card.ts');
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
let measureMethods = 0;
const summaryReads = layoutReads(source(summaryFile), (node) => {
  if (methodName(node) !== SUMMARY_MEASURE_METHOD) return false;
  measureMethods += 1;
  return true;
});
if (measureMethods !== 1) {
  problems.push(`${summaryFile}: expected one measurement method ${SUMMARY_MEASURE_METHOD}, found ${measureMethods}`);
}
if (summaryReads.length) {
  problems.push(`${summaryFile} forces layout outside ${SUMMARY_MEASURE_METHOD}: ${summaryReads.join(', ')}`);
}

for (const file of readdirSync(new URL('../src', import.meta.url)).filter((name) => /^iso-.*\.ts$/.test(name))) {
  const reads = layoutReads(source(`src/${file}`));
  if (reads.length) problems.push(`${file} forces layout: ${reads.join(', ')}`);
}
if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log('render/layout-read AST contract: OK');
