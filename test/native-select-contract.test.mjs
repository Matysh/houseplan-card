import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const source = readHouseplanProductionSource();
const walkTypescript = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkTypescript(path) : entry.name.endsWith('.ts') ? [path] : [];
  });

test('native selects explicitly project selection unless they are command menus', () => {
  const unsafe = [];
  for (const file of walkTypescript(srcRoot)) {
    const text = readFileSync(file, 'utf8');
    const blocks = [...text.matchAll(/<select\b[\s\S]*?<\/select>/g)].map((match) => match[0]);
    for (const block of blocks) {
      if (/(?:\?selected|\bselected\b)/.test(block)) continue;
      unsafe.push(`${relative(srcRoot, file).replaceAll('\\', '/')}:${
        block.match(/\bid="([^"]+)"/)?.[1] || '(missing id)'
      }`);
    }
  }

  // This is a command menu, not persisted state: it intentionally resets to
  // its empty first row after inserting an HA variable into decorative text.
  assert.deepEqual(unsafe, ['houseplan-editor-runtime.ts:decor-live-attribute']);
});

test('persisted dynamic marker selects project their selected option explicitly', () => {
  const blocks = [...source.matchAll(/<select\b[\s\S]*?<\/select>/g)].map((match) => match[0]);
  const byId = new Map(blocks.map((block) => [
    block.match(/\bid="([^"]+)"/)?.[1] || '', block,
  ]));
  for (const id of [
    'marker-room', 'marker-tap-action', 'marker-toggle-entity', 'marker-light-entity', 'marker-display',
    'marker-value-badge-source', 'marker-value-badge-position',
  ]) {
    const block = byId.get(id);
    assert.ok(block, id);
    assert.match(block, /(?:\?selected|\bselected\b)/, id);
  }
});
