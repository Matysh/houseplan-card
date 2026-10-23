// #980: one path domain shared by generated push filters and event proofs.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp, BUILD_OUTPUT } from './check-inputs.mjs';

export const DOCS_PATHS = ['docs/**', '*.md'];
export const TOOLING_PATHS = ['scripts/**', '.github/**', '.githooks/**'];
export function profilePaths(toolingTests, toolingDependencies = []) {
  const ownedTooling = [...TOOLING_PATHS, ...toolingTests];
  const owned = pathMatcher(ownedTooling);
  const tooling = [...new Set([...ownedTooling, ...toolingDependencies.filter(file => !owned(file))])].sort();
  // Unknown inputs are product-conservative; known docs/tooling/output paths
  // are the only exclusions. All BUILD_INPUTS/job roots consequently remain
  // covered, including newly introduced product roots and deleted paths.
  return { docs: DOCS_PATHS, tooling,
    // A product-owned helper can also feed tooling tests. Its dependency
    // trigger starts the companion profile without removing product coverage.
    product: ['**', ...[...DOCS_PATHS, ...ownedTooling.sort(), ...BUILD_OUTPUT].map(p => '!' + p)] };
}
export function matchesPaths(file, patterns) {
  return pathMatcher(patterns)(file);
}
/** Compile a stable policy once for bulk tree/key comparisons. */
export function pathMatcher(patterns) {
  const rules = patterns.map(pattern => ({ exclude: pattern.startsWith('!'),
    regexp: globToRegExp(pattern.startsWith('!') ? pattern.slice(1) : pattern) }));
  return file => {
  let included = false;
  for (const rule of rules) if (rule.regexp.test(file)) included = !rule.exclude;
  return included;
  };
}
export function profilesForFiles(files, paths = readProfilePaths()) {
  return ['product', 'tooling', 'docs'].filter(profile => files.some(file => matchesPaths(file, paths[profile])));
}
export function readProfilePaths(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  return JSON.parse(readFileSync(resolve(root, 'scripts/ci-profile-paths.json'), 'utf8'));
}
