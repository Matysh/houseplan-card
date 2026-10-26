import { PLAN_CONVERTER } from './plan-converter.mjs';

// UI Lab only: preserve native floor selection, creation and cancellation.
export function installFirstSpaceConverter(card, enabled) {
  const root = card.renderRoot;
  let kitPending;
  function loadKit() {
    // Reuse the published settings sheet. The beta exposes it only through
    // editor renderers; no editor instance or draft is created by this adapter.
    kitPending ||= import('/assets/houseplan-assets/houseplan-editor-runtime-CXU9tdWn.js')
      .then(({ HouseplanEditorRuntime }) => {
        HouseplanEditorRuntime.prototype._renderDecorEraseConfirm.call({ host: {
          renderRoot: root, hass: card.hass,
          _decorEraseConfirm: { kind: 'rect' }, _t: card._t.bind(card),
        } });
      });
  }
  function hint() {
    const paragraph = document.createElement('p');
    paragraph.className = 'lab-plan-converter';
    const link = document.createElement('a');
    link.className = 'hpf-link';
    link.textContent = 'ссылке';
    link.href = PLAN_CONVERTER.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const formats = PLAN_CONVERTER.formats
      .map(format => `${format.name} (${format.extensions.join(' / ')})`).join(', ');
    paragraph.append(
      'Если у вас есть план дома в другом формате, вы можете сконвертировать его по ',
      link, `. На текущий момент поддерживаются форматы: ${formats}.`,
    );
    return paragraph;
  }
  function refresh() {
    const active = enabled();
    const emptyActions = root.querySelector('[data-hp="empty"] .empty-actions');
    const dialog = root.querySelector('hp-dialog[data-kind="import"]');
    if (active && (emptyActions || dialog)) loadKit();
    if (emptyActions && active && !emptyActions.parentElement.querySelector('.lab-plan-converter')) {
      emptyActions.after(hint());
    }
    if (!active) root.querySelectorAll('.lab-plan-converter').forEach(node => node.remove());
    if (!dialog) return;
    dialog.classList.toggle('ui-dialog', active);
    for (const name of ['form-shell', 'settings-layout', 'compact', 'wide']) {
      dialog.toggleAttribute(name, active);
    }
    dialog.querySelector('[slot="footer"]')?.classList.toggle('hpf-footer', active);
    const body = dialog.querySelector('.body');
    if (active && body && !body.querySelector('.lab-plan-converter')) body.append(hint());
  }
  new MutationObserver(refresh).observe(root, { childList: true, subtree: true });
  document.querySelector('#lab-styles').addEventListener('change', refresh);
  refresh();
}
