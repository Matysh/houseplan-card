// Executed only by static capture. Dynamic/native transition smokes never
// import this installer. Styles follow open and subsequently attached roots.
export function installStaticStability() {
  window.__hpGoldenStability?.reset();
  const styles = new Set(), roots = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'attachShadow');
  const css = ':host,*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
  let active = true;
  const visit = (root) => {
    if (!active) return;
    if (root instanceof ShadowRoot) {
      let style = roots.get(root);
      if (!style) {
        style = document.createElement('style');
        style.dataset.hpCaptureStability = '';
        style.textContent = css; roots.set(root, style); styles.add(style);
        observer.observe(root, { childList: true, subtree: true });
      }
      if (style.parentNode !== root) root.append(style);
    }
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
  };
  const observer = new MutationObserver(() => {
    visit(document);
    for (const root of roots.keys()) visit(root);
  });
  function attachShadow(options) {
    const root = descriptor.value.call(this, options);
    if (options.mode === 'open') visit(root);
    return root;
  }
  Object.defineProperty(Element.prototype, 'attachShadow', { ...descriptor, value: attachShadow });
  observer.observe(document, { childList: true, subtree: true });
  visit(document);
  window.__hpGoldenStability = {
    reset() {
      active = false; observer.disconnect();
      if (Element.prototype.attachShadow === attachShadow)
        Object.defineProperty(Element.prototype, 'attachShadow', descriptor);
      for (const style of styles) style.remove();
      styles.clear(); delete window.__hpGoldenStability;
    },
  };
}

export async function resetGoldenStability(page) {
  await page.evaluate(() => {
    window.__hpGoldenStability?.reset();
    document.getElementById('hp-golden-stability')?.remove();
    if (window.__hpGoldenNativeDate) window.Date = window.__hpGoldenNativeDate;
    if (window.__hpGoldenNativeCssSupports) CSS.supports = window.__hpGoldenNativeCssSupports;
  });
}
