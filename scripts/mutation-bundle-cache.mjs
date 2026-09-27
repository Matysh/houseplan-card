// One clean frontend bundle can serve every browser mutant whose patch does
// not touch a bundle input. Keep this policy outside the execution lifecycle:
// the runner applies it, while tests can judge it without making worktrees.
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fingerprintCorpus } from './source-fingerprint.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const BUNDLE_CORPUS = new Set(fingerprintCorpus(repoRoot));
const BUNDLE_TREES = ['dist', 'demo/srv/assets'];

export function guardNeedsBundle(guard) {
  return guard.includes('demo/') || guard.includes('bundle:sync');
}

export function mutantPatchesNeedBundle(patches, corpus = BUNDLE_CORPUS) {
  const bundled = corpus instanceof Set ? corpus : new Set(corpus);
  return patches.some((patch) => bundled.has(patch.file.replaceAll('\\', '/')));
}

export function mutantBundleStrategy(mutant, { seedAvailable = false, corpus } = {}) {
  if (!guardNeedsBundle(mutant.guard)) return 'none';
  if (seedAvailable && !mutantPatchesNeedBundle(mutant.patches, corpus)) return 'seed';
  return 'build';
}

export const planNeedsBundleSeed = (mutants) => mutants.some((mutant) => (
  guardNeedsBundle(mutant.guard) && !mutantPatchesNeedBundle(mutant.patches)
));

export const makeBundleSeed = () => mkdtempSync(join(tmpdir(), 'hp-mutant-bundle-'));

export function dropBundleSeed(dir) {
  if (dir) rmSync(dir, { recursive: true, force: true });
}

export function captureBundleSeed(root, seed) {
  for (const name of BUNDLE_TREES) {
    const from = join(root, name);
    if (!existsSync(from)) throw new Error(`bundle seed source is missing: ${name}`);
    const to = join(seed, name);
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
  }
}

export function restoreBundleSeed(seed, root) {
  for (const name of BUNDLE_TREES) {
    const from = join(seed, name);
    if (!existsSync(from)) throw new Error(`shared bundle seed is missing: ${name}`);
    const to = join(root, name);
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
  }
}
