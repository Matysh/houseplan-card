// UI-006: suppress light spill in plan/backdrop editors only.
(() => {
  const roots = new WeakSet();
  const panel = document.querySelector('houseplan-panel');
  const scan = () => {
    const root = panel?.shadowRoot?.querySelector('houseplan-card')?.shadowRoot;
    if (!root || roots.has(root)) return;
    roots.add(root);
    const style = document.createElement('style');
    style.textContent = `
      .stage:is(.mode-plan,.mode-decor) :is(.glow-pools-frame,.led-fields) {display:none;}
    `;
    root.append(style);
  };
  if (panel?.shadowRoot) new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});
  scan();
})();
