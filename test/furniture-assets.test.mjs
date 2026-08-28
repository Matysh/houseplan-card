import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GENERATED_FURNITURE_PLAN } from '../test-build/furniture-plan-art.generated.js';
import { FURNITURE } from '../test-build/furniture.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'assets', 'furniture', 'houseplan-0.3.0', 'pack.json'), 'utf8'));

test('the vendored designer pack and generated modules stay in sync', () => {
  const result = spawnSync(process.execPath, ['scripts/generate-furniture-assets.mjs', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /44 plan symbols, 33 menu icons/);
});

test('the designer pack has the reviewed cardinality and operations', () => {
  assert.equal(GENERATED_FURNITURE_PLAN.length, 44);
  assert.equal(MANIFEST.menu_icons.length, 33);
  assert.equal(MANIFEST.symbols.filter((s) => s.operation === 'replace').length, 18);
  assert.equal(MANIFEST.symbols.filter((s) => s.operation === 'add').length, 26);
  assert.equal(FURNITURE.length, 56);
});

test('menu-only artwork never becomes an empty user-facing category', () => {
  const categories = new Set(FURNITURE.map((symbol) => symbol.category));
  for (const id of ['computer', 'oven', 'hood', 'exercise']) assert.equal(categories.has(id), false);
  for (const id of ['coffee_table', 'bed', 'kitchen_cabinet', 'toilet']) assert.equal(categories.has(id), true);
});

test('front-view menu artwork is reachable only through the lazy editor graph', () => {
  const card = fs.readFileSync(path.join(ROOT, 'src', 'houseplan-card.ts'), 'utf8');
  const furniture = fs.readFileSync(path.join(ROOT, 'src', 'furniture.ts'), 'utf8');
  const runtime = fs.readFileSync(path.join(ROOT, 'src', 'houseplan-editor-runtime.ts'), 'utf8');
  assert.doesNotMatch(card, /furniture-menu-art\.generated/);
  assert.doesNotMatch(furniture, /furniture-menu-art\.generated/);
  assert.match(runtime, /from '\.\/furniture-menu-art\.generated'/);
});

test('release provenance is normalized to the repository MIT grant', () => {
  assert.equal(MANIFEST.author, 'Sergey Matyushin (Matysh)');
  assert.equal(MANIFEST.license, 'MIT');
  assert.match(fs.readFileSync(
    path.join(ROOT, 'assets', 'furniture', 'houseplan-0.3.0', 'README.md'), 'utf8'),
  /issuecomment-5454085168/);
});
