#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { verifyBundleTree } from './bundle-tree.mjs';
import { isMainModule } from './spawn-portable.mjs';

/** #1407: judge ownership in the emitted graph, independently of byte budgets. */
export function assertFurnitureArtLazy(manifest) {
  assert.ok(manifest.lazyFurnitureArtFiles?.length, 'bundle has no lazy furniture artwork graph');
  const initial = new Set(manifest.initialViewFiles);
  assert.deepEqual(manifest.lazyFurnitureArtFiles.filter(path => initial.has(path)), [],
    'initial View graph overlaps lazy furniture artwork graph');
}

if (isMainModule(import.meta.url)) {
  assertFurnitureArtLazy(verifyBundleTree(resolve(process.argv[2] ?? 'dist')));
  console.log('Furniture artwork is outside the initial View graph; bundle hashes verified.');
}
