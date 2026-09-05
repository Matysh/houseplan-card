/**
 * Install one browser-side preload helper for demo harnesses that opt into Iso.
 *
 * Current builds keep the isometric renderer in a lazy, fingerprint-checked
 * runtime. Older comparison bundles are monolithic and expose no preload
 * method, so absence remains a compatible no-op. A current runtime, however,
 * must load successfully and settle before a smoke inspects Iso DOM/geometry.
 */
export async function installHarnessIsoRuntimeHelper(page) {
  await page.evaluate(() => {
    window.__hpEnsureHarnessIsoRuntime = async (card = window.__card) => {
      if (!card) throw new Error('isometric smoke has no card to preload');
      const ensure = card._ensureIsoSceneRuntime;
      if (typeof ensure !== 'function') return true;
      if (!await ensure.call(card)) {
        throw new Error('isometric smoke runtime did not load');
      }
      await card.updateComplete;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      return true;
    };
  });
}
