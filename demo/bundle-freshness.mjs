import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';

const fingerprintForTree = async (root) => {
  const modulePath = resolve(root, 'scripts/source-fingerprint.mjs');
  if (!existsSync(modulePath)) return sourceFingerprint(root);
  const module = await import(pathToFileURL(modulePath).href);
  if (typeof module.sourceFingerprint !== 'function') {
    throw new Error(`${modulePath} does not export sourceFingerprint`);
  }
  return module.sourceFingerprint(root);
};

/** Refuse measurements/screenshots made by a committed bundle from old source. */
export async function assertFreshDemoBundle(page, root = process.cwd()) {
  // A comparative performance run may load an older tree whose fingerprint
  // contract is intentionally different from the candidate's. Validate that
  // tree with the implementation that built it, not with today's algorithm.
  const expected = await fingerprintForTree(root);
  const loaded = await page.evaluate(() => globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__ ?? null);
  if (loaded !== expected) {
    throw new Error(
      'demo/srv/assets/houseplan-card.js is stale. Run npm run build and copy '
      + 'dist/houseplan-card.js to demo/srv/assets/houseplan-card.js first. '
      + `Expected ${expected}, loaded ${loaded || 'no fingerprint'}.`,
    );
  }
  return expected;
}
