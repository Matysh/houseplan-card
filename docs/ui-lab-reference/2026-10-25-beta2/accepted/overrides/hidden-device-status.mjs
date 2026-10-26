// Local status paint only: the shared show-hidden toggle and data stay native.
export function installHiddenDeviceStatus(card, enabled) {
  function refresh() {
    const hidden = new Set(enabled() && card._showHidden
      ? card._devices.filter(device => device.hidden).map(device => device.id) : []);
    for (const element of card.renderRoot.querySelectorAll('.dev[data-hp="device"][data-id]')) {
      element.toggleAttribute('data-lab-hidden-status', hidden.has(element.dataset.id));
    }
  }
  const updated = card.updated;
  card.updated = function (...args) {
    const result = updated.apply(this, args);
    refresh();
    return result;
  };
  new MutationObserver(refresh).observe(card.renderRoot, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['data-id'],
  });
  document.querySelector('#lab-styles').addEventListener('change', refresh);
  refresh();
}
