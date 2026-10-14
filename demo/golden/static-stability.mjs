// Executed only by static capture. Dynamic/native transition smokes never
// import this installer. Styles follow open and subsequently attached roots.
export function installStaticStability() {
  window.__hpGoldenStability?.reset();
  const roots = new Set();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'attachShadow');
  const css = ':host,*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
  const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
  let active = true;
  const visit = (root) => {
    if (!active) return;
    if (root instanceof ShadowRoot) {
      if (!roots.has(root)) {
        roots.add(root);
        observer.observe(root, { childList: true, subtree: true });
      }
      // Never insert a DOM style before Lit creates its root part: Lit may
      // adopt that node as renderBefore, and removing it would detach its end
      // anchor. A constructed sheet has no position in the managed DOM.
      if (!root.adoptedStyleSheets.includes(sheet))
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
  };
  const observer = new MutationObserver(() => {
    visit(document);
    // Lit's createRenderRoot may replace adoptedStyleSheets after attachShadow.
    // Its first DOM commit restores membership without touching template nodes.
    for (const root of roots) visit(root);
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
      for (const root of roots)
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter(item => item !== sheet);
      roots.clear(); delete window.__hpGoldenStability;
    },
  };
}

export async function resetGoldenStability(page) {
  const media = await page.evaluate(() => {
    window.__hpGoldenStability?.reset();
    document.getElementById('hp-golden-stability')?.remove();
    if (window.__hpGoldenNativeDate) window.Date = window.__hpGoldenNativeDate;
    if (window.__hpGoldenNativeCssSupports) CSS.supports = window.__hpGoldenNativeCssSupports;
    const prior = window.__hpGoldenMediaBefore ?? null;
    delete window.__hpGoldenMediaBefore;
    return prior;
  });
  if (media) await page.emulateMedia(media);
}
