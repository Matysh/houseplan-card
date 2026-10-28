// UI-009: compact zoom controls follow the House Plan header width.
(() => {
  const installed = new WeakSet();
  const panel = document.querySelector('houseplan-panel');
  const scan = () => {
    const root = panel?.shadowRoot?.querySelector('houseplan-card')?.shadowRoot;
    if (!root || installed.has(root)) return;
    installed.add(root);
    const style = document.createElement('style');
    style.textContent = `
      @container hp-head (max-width:1120px) {
        .hdr > .head .zoomctl .btn.zb:is([data-hp="zoom-in"],[data-hp="zoom-out"],[data-hp="zoom-fit"]) {display:none}
        .hdr > .head .zoomctl .btn.zb[data-hp="rotate-right"] {border-radius:0 var(--rad-m) var(--rad-m) 0}
      }
    `;
    root.append(style);
  };
  if (panel?.shadowRoot) new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});
  scan();
})();
