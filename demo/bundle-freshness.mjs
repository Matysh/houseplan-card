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

/** Env switch that lets a debugging session run against a stale bundle. */
export const ALLOW_STALE_BUNDLE = 'HP_ALLOW_STALE_BUNDLE';

/**
 * The freshness gate for every browser check, escape hatch included (#236).
 *
 * The smoke launcher had no freshness check at all, while golden runs and
 * benchmarks did. A smoke against a stale `demo/srv/assets/houseplan-card.js`
 * does not fail cleanly: on #234 three assertions went red and a fourth went
 * GREEN, because the old code was wrong in two places that agreed with each
 * other. A partly-red partly-green result looks like a logic defect and sends
 * the reader hunting in the wrong file.
 *
 * Skipping is allowed for debugging, but never silently: a skipped guard that
 * says nothing is the same silent success this project keeps digging out.
 */
export async function assertFreshDemoBundleUnlessAllowed(
  page, root = process.cwd(), env = process.env,
) {
  if (env[ALLOW_STALE_BUNDLE]) {
    console.warn(
      `[houseplan] ${ALLOW_STALE_BUNDLE} is set — bundle freshness NOT verified. `
      + 'A red result may mean a stale bundle rather than a defect (#236).',
    );
    return null;
  }
  return assertFreshDemoBundle(page, root);
}
