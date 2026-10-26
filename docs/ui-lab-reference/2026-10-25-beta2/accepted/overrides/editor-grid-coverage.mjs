// Local prototype: cover the same bounded 25% exposure as live-viewport.ts.
// Rebase only when the native SVG anchor changes (normally <= once / 100 ms),
// never on pointermove. No extra rAF, layout measurement or card render.
export function installEditorGridCoverage(card, enabled) {
  const selector = 'rect[fill="url(#hp-grid-major)"]';
  let grids = [];
  let owners = [];
  const anchorObserver = new MutationObserver(() => paint());

  function paint() {
    for (const rect of grids) {
      const view = rect.ownerSVGElement?.viewBox.baseVal;
      if (!view || !rect.isConnected || ![view.x, view.y, view.width, view.height].every(Number.isFinite)
        || view.width <= 0 || view.height <= 0) continue;
      const margin = enabled() ? 0.25 : 0;
      const attributes = {
        x: view.x - view.width * margin, y: view.y - view.height * margin,
        width: view.width * (1 + margin * 2), height: view.height * (1 + margin * 2),
      };
      for (const [key, value] of Object.entries(attributes)) {
        const text = String(value);
        if (rect.getAttribute(key) !== text) rect.setAttribute(key, text);
      }
    }
  }

  function refresh() {
    grids = [...card.renderRoot.querySelectorAll(selector)];
    const next = [...new Set(grids.map(rect => rect.ownerSVGElement).filter(Boolean))];
    if (next.length !== owners.length || next.some((owner, i) => owner !== owners[i])) {
      anchorObserver.disconnect();
      owners = next;
      for (const owner of owners) anchorObserver.observe(owner, { attributes: true, attributeFilter: ['viewBox'] });
    }
    paint();
  }

  const updated = card.updated;
  card.updated = function (...args) {
    const result = updated.apply(this, args);
    refresh();
    return result;
  };
  document.querySelector('#lab-styles').addEventListener('change', refresh);
  refresh();
}
