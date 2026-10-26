// Local beta.2 experiment; product persistence and file upload stay unchanged.
export function installSpaceDialog(card, enabled) {
  // Set the initial draft before the product records its unchanged baseline.
  // Later source changes remain the user's choice and must not be reset.
  let owner = card, descriptor;
  while (owner && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(owner, '_spaceDialog');
    owner = Object.getPrototypeOf(owner);
  }
  if (descriptor?.get && descriptor?.set) {
    Object.defineProperty(card, '_spaceDialog', {
      configurable: true,
      get() { return descriptor.get.call(this); },
      set(value) {
        const previous = descriptor.get.call(this);
        if (enabled() && value?.mode === 'create' && (!previous || previous.mode !== 'create')
          && !value.planFile && !value.planUrl) {
          value = { ...value, source: 'draw', ...(!value.displayTouched ? { showBorders: true, showNames: true } : {}) };
        }
        descriptor.set.call(this, value);
      },
    });
  }
  const sessions = new WeakMap();
  function refresh() {
    if (!enabled()) return;
    const dialog = card.renderRoot.querySelector('hp-dialog[data-kind="space"]');
    const draft = card._spaceDialog;
    if (!dialog || !draft) return;
    let session = sessions.get(dialog);
    if (!session) {
      session = { available: false };
      sessions.set(dialog, session);
      if (draft.mode === 'create') {
        dialog.querySelector('[data-hp="settings-section"][data-section="basics"]')?.click();
      }
      void card.hass.callWS({ type: 'houseplan/plans/list' }).then(result => {
        session.available = Array.isArray(result?.plans) && result.plans.length > 0;
        if (dialog.isConnected) refresh();
      }, () => { session.available = false; if (dialog.isConnected) refresh(); });
    }
    const savedButton = dialog.querySelector('[data-action="backdrop-server-plans"]');
    if (savedButton) savedButton.disabled = !(Array.isArray(draft.saved) ? draft.saved.length > 0 : session.available);
    if (!draft.planFile && !draft.planUrl) {
      const placeholder = dialog.querySelector('.hpf-plan-image .planname.muted');
      for (const node of placeholder?.childNodes || []) {
        if (node.nodeType === Node.TEXT_NODE && node.data.trim() === 'нет подложки') {
          node.data = node.data.replace('нет подложки', 'Нет подложки');
        }
      }
    }
  }
  const observer = new MutationObserver(refresh);
  observer.observe(card.renderRoot, { childList: true, subtree: true });
  document.querySelector('#lab-styles').addEventListener('change', refresh);
  refresh();
}
