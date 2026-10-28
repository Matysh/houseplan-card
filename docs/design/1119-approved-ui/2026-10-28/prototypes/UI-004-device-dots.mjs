// UI-004: new/hidden dots must paint above the device shell (z-index: 2).
(() => {
  const roots = new WeakSet();
  const panel = document.querySelector('houseplan-panel');
  const scan = () => {
    const root = panel?.shadowRoot?.querySelector('houseplan-card')?.shadowRoot;
    if (!root || roots.has(root)) return;
    roots.add(root);
    const style = document.createElement('style');
    // Higher specificity than the adopted component stylesheet, which cascades after style tags.
    style.textContent = '.dev .newdot.newdot { z-index: 3; }';
    root.append(style);
  };
  if (panel?.shadowRoot) new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});
  scan();
})();