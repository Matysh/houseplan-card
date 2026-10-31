/** Read-only settling of actual finite paint, including nested genuine HA roots.
 * Infinite scene/loader animations keep running; no animation is suppressed. */
export async function waitForUiKitPaint(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    for (let round = 0; round < 5; round++) {
      await frame(); await frame();
      const animations = new Set();
      const visit = root => {
        for (const element of root.querySelectorAll('*')) {
          for (const animation of element.getAnimations()) {
            const timing = animation.effect?.getComputedTiming();
            if (animation.playState === 'running' && timing?.iterations !== Infinity && Number.isFinite(timing?.endTime)) animations.add(animation);
          }
          if (element.shadowRoot) visit(element.shadowRoot);
        }
      };
      visit(document);
      if (!animations.size) return;
      let timer;
      try {
        await Promise.race([
          Promise.allSettled([...animations].map(animation => animation.finished)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Finite UI paint did not settle')), 4000); }),
        ]);
      } finally { clearTimeout(timer); }
    }
    throw Error('UI paint kept starting after five bounded settling rounds');
  });
}
