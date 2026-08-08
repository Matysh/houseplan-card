import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';

/** Refuse measurements/screenshots made by a committed bundle from old source. */
export async function assertFreshDemoBundle(page, root = process.cwd()) {
  const expected = sourceFingerprint(root);
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
