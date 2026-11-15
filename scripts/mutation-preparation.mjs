// Preparation policy shared by registry readiness and the nightly runner.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { guardRuntimeFiles } from './mutation-environment.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const repository = {
  exists: file => existsSync(join(root, file)),
  read: file => readFileSync(join(root, file), 'utf8'),
};

export function guardNeedsTestBuild(guard, io = repository) {
  if (guard.includes('tsconfig.test.json')) return false;
  if (/(^|[\s&|;])node --test\b/.test(guard)) return true;
  // A browser entry can reach compiled model fixtures through shared scene
  // helpers. Inspect their runtime imports even in a fresh, unbuilt checkout.
  return guardRuntimeFiles(guard, { ...io, exists: file => !file.startsWith('test-build/') && io.exists(file) }).some(file => /\.[cm]?js$/.test(file)
    && String(io.read(file) || '').includes('test-build/'));
}

/** #830: browser/wrapper entries importing model fixtures need explicit preparation. */
export function preparationProblems(guard, read, entries) {
  const problems = [];
  for (const file of new Set(entries)) {
    const source = read(file);
    if (source === null) { problems.push(`declared guard input is missing: ${file}`); continue; }
    if (file.endsWith('.mjs') && source.includes('test-build/')
      && !guard.includes('tsconfig.test.json') && !guardNeedsTestBuild(guard, { read, exists: file => read(file) !== null }))
      problems.push(`guard ${file} imports test-build/ without tsc + fix-test-build preparation (#830)`);
  }
  if (guard.includes('tsconfig.test.json') && !guard.includes('scripts/fix-test-build.mjs'))
    problems.push('test-build compilation requires scripts/fix-test-build.mjs');
  return problems;
}
