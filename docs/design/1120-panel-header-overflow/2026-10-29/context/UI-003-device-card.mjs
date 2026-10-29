// UI-003: local visual adapter for the device information card.
// Reuses the release hp-dialog and form-kit; original nodes/actions stay intact.
(() => {
  const installed = new WeakSet();
  const install = card => {
    const root = card?.shadowRoot;
    if (!root || installed.has(root)) return;
    installed.add(root);
    const style = document.createElement('style');
    style.textContent = `
      hp-dialog[data-kind="info"].ui003-card .body.hpf-form {padding:20px!important;display:grid;gap:16px}
      hp-dialog[data-kind="info"] .inforow.hpf-row {display:grid;grid-template-columns:112px minmax(0,1fr);gap:16px;margin:0;padding:0;align-items:start}
      hp-dialog[data-kind="info"] .inforow .hpf-label {width:auto;min-width:0;line-height:1.55}
      hp-dialog[data-kind="info"] .inforow > :last-child {min-width:0;overflow-wrap:anywhere;line-height:1.55}
      hp-dialog[data-kind="info"] .hpf-link {text-align:left;white-space:normal;overflow-wrap:anywhere}
      hp-dialog[data-kind="info"] .infodesc {margin:0;line-height:1.6;white-space:pre-wrap}
      hp-dialog[data-kind="info"] .infodesc.hpf-note {padding:12px 14px}
      hp-dialog[data-kind="info"] .entlist {display:grid;gap:0;margin:0}
      hp-dialog[data-kind="info"] .entrow {gap:12px;padding:12px 0;border:0;background:transparent;min-height:44px}
      hp-dialog[data-kind="info"] .entrow + .entrow {border-top:1px solid var(--hpf-line,var(--divider-color))}
      hp-dialog[data-kind="info"] .entrow .en {min-width:0;overflow-wrap:anywhere;line-height:1.5}
      hp-dialog[data-kind="info"] .entrow .ev {font-variant-numeric:tabular-nums;color:var(--primary-text-color);text-align:right}
      hp-dialog[data-kind="info"] .entrow .btn {min-width:88px;flex-shrink:0}
      hp-dialog[data-kind="info"] .entlist + .inforow {padding-top:16px;border-top:1px solid var(--hpf-line,var(--divider-color))}
      hp-dialog[data-kind="info"] .pdflist {display:grid;gap:8px}
      hp-dialog[data-kind="info"] .pdflist .hpf-link {display:inline-flex;align-items:center;gap:8px}
      hp-dialog[data-kind="info"] .infofooter.hpf-footer {display:flex;align-items:center;gap:8px;padding:12px 16px;margin:0;flex-wrap:wrap}
      hp-dialog[data-kind="info"] .infofooter .infofooter-close {margin-left:auto}
      @media(max-width:480px){hp-dialog[data-kind="info"] .inforow.hpf-row{grid-template-columns:1fr;gap:5px}}
    `;
    root.append(style);
    let kit;
    const decorate = async dialog => {
      // The editor constructor installs the actual shared sheets. Loading it here
      // is a lab shortcut; production should load only the required UI primitives.
      kit ||= card._ensureEditorRuntime();
      if (!await kit || !dialog.isConnected) return;
      for (const attr of ['form-shell','settings-layout','compact']) {
        if (!dialog.hasAttribute(attr)) dialog.setAttribute(attr,'');
      }
      dialog.classList.add('ui-dialog','ui003-card');
      if (!dialog.subtitle) dialog.subtitle = 'Карточка устройства';
      dialog.querySelector('.body')?.classList.add('hpf-form','hpf-settings-form');
      dialog.querySelector('.infofooter')?.classList.add('hpf-footer');
      for (const row of dialog.querySelectorAll('.inforow')) {
        row.classList.add('hpf-row');
        row.querySelector('.k')?.classList.add('hpf-label');
      }
      for (const link of dialog.querySelectorAll('.inforow a')) link.classList.add('hpf-link');
      for (const note of dialog.querySelectorAll('.infodesc')) note.classList.add('hpf-note');
      for (const button of dialog.querySelectorAll('.entbtn')) {
        button.classList.add('btn');
        button.classList.toggle('ghost',!button.classList.contains('on'));
      }
    };
    const scan = () => {
      for (const dialog of root.querySelectorAll('hp-dialog[data-kind="info"]')) void decorate(dialog);
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
