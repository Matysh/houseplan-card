// UI-008: editor button variants follow House Plan's own header width.
(() => {
  const installed = new WeakSet();
  const labels = {plan:'План', devices:'Устройства', decor:'Подложка'};
  const install = card => {
    const root = card?.shadowRoot;
    if (!root || installed.has(root)) return;
    installed.add(root);
    const style = document.createElement('style');
    style.textContent = `
      .hdr .modetab > .ml,
      .hdr .modetab > [data-ui008-wide] {display:none}
      @container hp-head (width > 1480px) {
        .hdr .modetab > ha-icon:not([data-ui008-wide]) {display:none}
        .hdr .modetab > [data-ui008-wide] {display:inline-flex}
      }
    `;
    root.append(style);
    const scan = () => {
      for (const button of root.querySelectorAll('.modetab[data-mode]')) {
        const label = labels[button.dataset.mode];
        if (!label || button.querySelector('[data-ui008-wide]')) continue;
        // Preserve Lit-owned labels/icons and all existing handlers, tooltips,
        // active state and hover styles. Only the expanded visual is replaced.
        const icon = document.createElement('ha-icon');
        icon.setAttribute('icon','mdi:pencil');
        icon.setAttribute('aria-hidden','true');
        icon.dataset.ui008Wide = '';
        const text = document.createElement('span');
        text.dataset.ui008Wide = '';
        text.textContent = label;
        button.append(icon,text);
      }
    };
    new MutationObserver(scan).observe(root,{childList:true,subtree:true});
    scan();
  };
  const panel = document.querySelector('houseplan-panel');
  if (panel?.shadowRoot) {
    const scan = () => install(panel.shadowRoot.querySelector('houseplan-card'));
    new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});
    scan();
  }
})();
