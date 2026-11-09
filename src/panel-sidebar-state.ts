/** Read the containing HA drawer, including scrim/Escape/route-driven closes.
 * The custom panel never owns a second sidebar toggle state. HA reflects open. */
export function observePanelSidebar(panel: HTMLElement, changed: (open: boolean) => void): () => void {
  let node: Node | null = panel, drawer: Element | null = null;
  while (node) {
    if (node instanceof Element && node.localName === 'ha-drawer') { drawer = node; break; }
    node = node.parentNode || (node instanceof ShadowRoot ? node.host : null);
  }
  const sync = () => changed(!!drawer?.hasAttribute('open'));
  sync();
  if (!drawer) return () => undefined;
  const observer = new MutationObserver(sync);
  observer.observe(drawer, { attributes: true, attributeFilter: ['open'] });
  return () => observer.disconnect();
}
