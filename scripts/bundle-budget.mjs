#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// #352: the budget guards the CLASS of regression — tens of kilobytes from
// an accidentally imported dependency or an eagerly bundled dictionary —
// not every byte. v1.69.0-beta.1 shipped at 255 993 B gzip against a
// 256 000 B ceiling: seven bytes of headroom turned the gate into a
// lottery where the unlucky LAST commit goes red, not the one that grew
// the bundle (5740324b was exactly that). The ceiling therefore keeps a
// deliberate ~10% allowance over the measured fact; the fact and headroom
// are printed on every run so the trend is visible long before the wall.
// Measured fact at calibration (v1.69.0-beta.1): 255 993 B gzip.
export const INITIAL_VIEW_GZIP_BUDGET = 282_000;

export function assertBundleBudget(manifest, budget = INITIAL_VIEW_GZIP_BUDGET) {
  if (manifest?.schema !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('invalid houseplan-assets.json');
  }
  if (!manifest.lazyEditorFiles?.length) {
    throw new Error('bundle has no lazy editor graph');
  }
  if (!manifest.lazyLocaleFiles?.length) {
    throw new Error('bundle has no lazy locale graph');
  }
  if (manifest.initialViewFiles.some((path) => manifest.lazyEditorFiles.includes(path))) {
    throw new Error('initial View graph overlaps lazy editor graph');
  }
  if (manifest.initialViewFiles.some((path) => manifest.lazyLocaleFiles.includes(path))) {
    throw new Error('initial View graph overlaps lazy locale graph');
  }
  if (manifest.lazyLocaleFiles.some((path) => manifest.lazyEditorFiles.includes(path)
      || manifest.lazyOnboardingFiles?.includes(path))) {
    throw new Error('lazy locale graph overlaps an editor graph');
  }
  if (manifest.initialViewGzipBytes > budget) {
    throw new Error(
      `initial View graph ${manifest.initialViewGzipBytes} B gzip exceeds ${budget} B budget`,
    );
  }
  return {
    initialViewGzipBytes: manifest.initialViewGzipBytes,
    lazyEditorGzipBytes: manifest.lazyEditorGzipBytes,
    lazyLocaleGzipBytes: manifest.lazyLocaleGzipBytes,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const manifest = JSON.parse(readFileSync(resolve('dist/houseplan-assets.json'), 'utf8'));
    const result = assertBundleBudget(manifest);
    const headroom = INITIAL_VIEW_GZIP_BUDGET - result.initialViewGzipBytes;
    const lines = [
      `initial View: ${result.initialViewGzipBytes} B gzip`
        + ` (budget ${INITIAL_VIEW_GZIP_BUDGET} B, headroom ${headroom} B)`,
      `lazy editor: ${result.lazyEditorGzipBytes} B gzip`,
      `lazy locale: ${result.lazyLocaleGzipBytes} B gzip`,
    ];
    for (const line of lines) console.log(line);
    // #352: the trend belongs where humans look — the run summary.
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
        '### Бюджет бандла',
        `| граф | gzip | бюджет | запас |`,
        `|---|---|---|---|`,
        `| initial View | ${result.initialViewGzipBytes} B | ${INITIAL_VIEW_GZIP_BUDGET} B | ${headroom} B |`,
        '',
      ].join('\n'));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
