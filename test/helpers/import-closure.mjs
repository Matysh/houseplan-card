import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { relativeDependencies } from '../../scripts/relative-dependencies.mjs';

/** Exact relative Node module paths, including scripts started via module URL.
 * Missing files throw: an incomplete sandbox must not silently become green.
 * Unlike the CI manifest, source-string data paths are not copied as code.
 */
export function importClosure(entry, seen = new Set()) {
  const file = resolve(entry);
  if (seen.has(file)) return seen;
  const text = readFileSync(file, 'utf8');
  seen.add(file);
  for (const spec of relativeDependencies(text)) importClosure(resolve(dirname(file), spec), seen);
  return seen;
}
