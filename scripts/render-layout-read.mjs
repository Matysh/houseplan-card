#!/usr/bin/env node
// #654: render and 2.5D pure helpers must not force browser layout. This is an
// AST contract, not a regex anchor: formatting and comments cannot satisfy it.
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

const forbidden = new Set(['getComputedStyle', 'getBoundingClientRect']);
const source = (path) => ts.createSourceFile(
  path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true,
);
const callName = (node) => !ts.isCallExpression(node) ? null
  : ts.isIdentifier(node.expression) ? node.expression.text
    : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null;
const forbiddenCalls = (node) => {
  const found = [];
  const visit = (child) => {
    const name = callName(child);
    if (name && forbidden.has(name)) found.push(name);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

const card = source('src/houseplan-card.ts');
const required = new Set(['render', '_renderBody', 'willUpdate']);
const checked = new Set();
const visit = (node) => {
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)
      && required.has(node.name.text)) {
    checked.add(node.name.text);
    const calls = forbiddenCalls(node.body);
    if (calls.length) throw new Error(`${node.name.text} forces layout: ${calls.join(', ')}`);
  }
  ts.forEachChild(node, visit);
};
visit(card);
if ([...required].some((name) => !checked.has(name))) throw new Error('guarded lifecycle method is missing');

for (const file of readdirSync(new URL('../src', import.meta.url)).filter((name) => /^iso-.*\.ts$/.test(name))) {
  const calls = forbiddenCalls(source(`src/${file}`));
  if (calls.length) throw new Error(`${file} forces layout: ${calls.join(', ')}`);
}
console.log('render/layout-read AST contract: OK');
