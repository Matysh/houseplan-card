#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const INITIAL_VIEW_GZIP_BUDGET = 256_000;

export function assertBundleBudget(manifest, budget = INITIAL_VIEW_GZIP_BUDGET) {
  if (manifest?.schema !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('invalid houseplan-assets.json');
  }
  if (!manifest.lazyEditorFiles?.length) {
    throw new Error('bundle has no lazy editor graph');
  }
  if (manifest.initialViewFiles.some((path) => manifest.lazyEditorFiles.includes(path))) {
    throw new Error('initial View graph overlaps lazy editor graph');
  }
  if (manifest.initialViewGzipBytes > budget) {
    throw new Error(
      `initial View graph ${manifest.initialViewGzipBytes} B gzip exceeds ${budget} B budget`,
    );
  }
  return {
    initialViewGzipBytes: manifest.initialViewGzipBytes,
    lazyEditorGzipBytes: manifest.lazyEditorGzipBytes,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const manifest = JSON.parse(readFileSync(resolve('dist/houseplan-assets.json'), 'utf8'));
    const result = assertBundleBudget(manifest);
    console.log(`initial View: ${result.initialViewGzipBytes} B gzip`);
    console.log(`lazy editor: ${result.lazyEditorGzipBytes} B gzip`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
