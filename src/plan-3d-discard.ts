/** Document-scoped, not card-scoped: Chromium leaves wasDiscarded set for
 * the whole lifetime of a restored document, including HA SPA remounts. */
const inspected = new WeakSet<Document>();

export function takeDiscardedPanel(document: Document, prefix: string): boolean {
  if (inspected.has(document)) return false;
  inspected.add(document);
  if (!(document as Document & { wasDiscarded?: boolean }).wasDiscarded) return false;
  const win = document.defaultView;
  const navigation = win?.performance.getEntriesByType('navigation')[0]?.name;
  if (!win || !navigation) return false;
  try {
    const initial = new URL(navigation);
    const current = new URL(win.location.href);
    const path = '/' + prefix.replace(/^\/+|\/+$/g, '');
    const within = (url: URL) => url.pathname === path || url.pathname.startsWith(path + '/');
    // A rewrite from / (including HA's default panel) is deliberately not
    // evidence that the destroyed document was showing this panel.
    return path !== '/' && initial.origin === current.origin
      && initial.pathname === current.pathname && within(initial);
  } catch { return false; }
}
