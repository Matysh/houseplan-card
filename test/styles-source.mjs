/**
 * #266: the style sheet is being split into surface files. Contract tests
 * that grep the CSS source must see the WHOLE sheet regardless of the split
 * state, so they read src/styles.ts plus every surface file it imports.
 */
import { readFileSync } from 'node:fs';

export function readAllStylesSource() {
  const aggregatorUrl = new URL('../src/styles.ts', import.meta.url);
  const aggregator = readFileSync(aggregatorUrl, 'utf8');
  const parts = [aggregator];
  for (const m of aggregator.matchAll(/from '\.\/styles\/([\w-]+)\.styles'/g)) {
    parts.push(readFileSync(new URL(`../src/styles/${m[1]}.styles.ts`, import.meta.url), 'utf8'));
  }
  return parts.join('\n');
}
