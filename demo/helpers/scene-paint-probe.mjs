/** Read actual retained-scene paint/input, not mere presence in the DOM. */
export async function installScenePaintProbe(page) {
  await page.evaluate(() => {
    window.__hpSceneOpacity = element => {
      if (!element?.isConnected) return 0;
      let opacity = 1;
      for (let node = element; node instanceof Element; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return 0;
        opacity *= Number(style.opacity);
      }
      return opacity;
    };
    window.__hpScenePaintedOrInteractive = element => {
      if (!element?.isConnected) return false;
      let painted = true;
      for (let node = element; node instanceof Element; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden'
          || style.visibility === 'collapse' || Number(style.opacity) === 0) painted = false;
      }
      const interactive = !element.closest('[inert]')
        && getComputedStyle(element).pointerEvents !== 'none'
        && element.getClientRects().length > 0;
      return painted || interactive;
    };
  });
}
