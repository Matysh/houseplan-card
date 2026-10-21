// #980: one path domain shared by generated push filters and event proofs.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp, BUILD_OUTPUT } from './check-inputs.mjs';

export const DOCS_PATHS = ['docs/**', '*.md'];
export const TOOLING_PATHS = ['scripts/**', '.github/**', '.githooks/**'];
export function profilePaths(toolingTests) {
  const tooling = [...TOOLING_PATHS, ...toolingTests].sort();
  // Unknown inputs are product-conservative; known docs/tooling/output paths
  // are the only exclusions. All BUILD_INPUTS/job roots consequently remain
  // covered, including newly introduced product roots and deleted paths.
  return { docs: DOCS_PATHS, tooling,
    product: ['**', ...[...DOCS_PATHS, ...tooling, ...BUILD_OUTPUT].map(p => '!' + p)] };
}
export function matchesPaths(file, patterns) {
  let included = false;
  for (const pattern of patterns) {
    const exclude = pattern.startsWith('!');
    if (globToRegExp(exclude ? pattern.slice(1) : pattern).test(file)) included = !exclude;
  }
  return included;
}
export function profilesForFiles(files, paths = readProfilePaths()) {
  return ['product', 'tooling', 'docs'].filter(profile => files.some(file => matchesPaths(file, paths[profile])));
}
export function readProfilePaths(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  return JSON.parse(readFileSync(resolve(root, 'scripts/ci-profile-paths.json'), 'utf8'));
}
