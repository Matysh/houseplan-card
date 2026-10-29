// UI-007: local visual contract: off dims the icon, unavailable dims the marker.
(() => {
  const installed = new WeakSet();
  const install = card => {
    const root = card?.shadowRoot;
    if (!root || installed.has(root)) return;
    installed.add(root);
    const style = document.createElement('style');
    style.textContent = `
      .dev[data-ui007-state="unavailable"] {opacity:.35}
      .dev.unavail[data-ui007-state="unavailable"] .device-core > ha-icon,
      .dev.unavail[data-ui007-state="unavailable"] .device-core > .valtext,
      .dev.unavail[data-ui007-state="unavailable"] .value-badge-content {opacity:1}
      .dev[data-ui007-state="off"] .device-core > ha-icon {opacity:.35}
    `;
    root.append(style);
    const powerDomains = new Set(['light','switch','fan','climate','media_player','humidifier','water_heater','remote']);
    const markerStatus = marker => {
      // Keep beta's resolved own availability; a failed foreign value source
      // must not make the entire device unavailable.
      if (marker.classList.contains('ghost')) return '';
      if (marker.classList.contains('unavail')) return 'unavailable';
      if (marker.classList.contains('static-icon')) return '';
      const eid = marker.dataset.entity;
      const state = String(card._renderPlanHass?.states?.[eid]?.state || '').trim().toLowerCase();
      return state === 'off' && powerDomains.has(eid?.split('.')[0]) ? 'off' : '';
    };
    const sync = () => {
      const markers = [...root.querySelectorAll('[data-hp="device"]')];
      for (const marker of markers) {
        const status = markerStatus(marker);
        if (marker.dataset.ui007State !== status) marker.dataset.ui007State = status;
      }
      const tip = card._tip;
      const element = root.querySelector('[data-hp-live-tip]');
      if (!element || element.hidden) return;
      let row = element.querySelector('[data-ui007-status]');
      const marker = tip?.deviceId && markers.find(node => node.dataset.id === tip.deviceId);
      const status = !tip?.room && marker
        ? marker.dataset.ui007State === 'unavailable' ? 'Недоступно'
          : marker.dataset.ui007State === 'off' ? 'Выключено' : ''
        : '';
      if (!status) { row?.remove(); return; }
      if (!row) {
        row = document.createElement('span');
        row.className = 'm';
        row.dataset.ui007Status = '';
        row.textContent = status;
        const after = tip.meta ? element.children[1] : element.children[0];
        after?.after(row);
      } else if (row.textContent !== status) row.textContent = status;
      // Account for the extra line at the bottom edge of the viewport.
      const rect = element.getBoundingClientRect();
      if (rect.bottom > innerHeight - 8) element.style.top = `${Math.max(8, parseFloat(element.style.top) - (rect.bottom - innerHeight + 8))}px`;
    };
    new MutationObserver(sync).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-state','data-entity','class','hidden']});
    // off and idle can have identical native DOM; update after each Lit frame too.
    const updated = card.updated;
    card.updated = function (...args) {
      const result = updated?.apply(this,args);
      sync();
      return result;
    };
    sync();
  };
  const panel = document.querySelector('houseplan-panel');
  if (panel?.shadowRoot) {
    const scan = () => install(panel.shadowRoot.querySelector('houseplan-card'));
    new MutationObserver(scan).observe(panel.shadowRoot,{childList:true,subtree:true});
    scan();
  }
})();
