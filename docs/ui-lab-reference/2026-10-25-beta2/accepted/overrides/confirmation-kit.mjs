// Local prototype: opt the existing confirmation into the shared compact UI Kit.
// Keep alert semantics, native cancel/confirm callbacks and focus/exit lifecycle.
export function installConfirmationKit(card, enabled) {
  let kitLoaded = false;
  function refresh() {
    const dialogs = card.renderRoot.querySelectorAll('hp-confirm > hp-dialog.danger-confirm-dialog');
    if (enabled() && dialogs.length && !kitLoaded && card._editorRuntime) {
      // This beta does not expose ensureSettingsDialogStyles. Its existing
      // compact-confirm renderer installs that exact shared sheet. Evaluate
      // only the template with a read-only presentation host; never mount it
      // or change the card's draft, selection or confirmation request.
      card._editorRuntime._renderDecorEraseConfirm.call({ host: {
        renderRoot: card.renderRoot, hass: card.hass,
        _decorEraseConfirm: { kind: 'rect' }, _t: card._t.bind(card),
      } });
      kitLoaded = true;
    }
    for (const dialog of dialogs) {
      const active = enabled();
      dialog.classList.toggle('ui-dialog', active);
      for (const attribute of ['form-shell', 'settings-layout', 'compact', 'wide']) {
        dialog.toggleAttribute(attribute, active);
      }
      dialog.querySelector('.danger-confirm-footer')?.classList.toggle('hpf-footer', active);
    }
  }
  new MutationObserver(refresh).observe(card.renderRoot, { childList: true, subtree: true });
  document.querySelector('#lab-styles').addEventListener('change', refresh);
  refresh();
}
