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
    /**
     * #649: select Flat or 2.5D for geometry smokes. Current bundles read the
     * installation-wide `settings.volumetric_view`; this assigns it exactly as a
     * General settings save does (`_serverCfg = { ...cfg, settings }`, spaces
     * untouched, so a smoke's local fixture edits survive). Bundles before
     * #649 keep their per-device `_setProjection`.
     */
    window.__hpHarnessProjection = async (card, projection) => {
      if (typeof card._setProjection === 'function') card._setProjection(projection);
      else {
        const cfg = card._serverCfg;
        card._serverCfg = { ...cfg, settings: { ...(cfg?.settings || {}), volumetric_view: projection === 'iso' } };
        card.requestUpdate();
      }
      await card.updateComplete;
      if (projection === 'iso') await window.__hpEnsureHarnessIsoRuntime(card);
      await card.updateComplete;
    };
  });
}
