/** Read actual retained-scene paint/input, not mere presence in the DOM. */
export async function installScenePaintProbe(page) {
  await page.evaluate(() => {
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
