// UI-005: local-only shared UI Kit shell for the summary settings form.
(() => {
  const roots = new WeakSet();
  const install = card => {
    const root = card?.shadowRoot;
    if (!root || roots.has(root)) return;
    roots.add(root);
    let kit;
    const style = document.createElement('style');
    style.textContent = `
      hp-dialog[data-kind="summary"].ui005-summary {--hp-dialog-wide-width:920px;--hp-dialog-close-transition:160ms ease;--hp-dialog-close-hover-transform:rotate(90deg) scale(1.12)}
      hp-dialog[data-kind="summary"].ui005-summary .summary-icon-button.btn {width:44px;min-width:44px;padding:0}
      hp-dialog[data-kind="summary"].ui005-summary .summary-source.btn {justify-content:space-between;text-align:left;padding:7px 9px}
      hp-dialog[data-kind="summary"].ui005-summary .summary-source-results .btn {display:grid;justify-content:stretch;text-align:left;padding:7px 9px}
      hp-dialog[data-kind="summary"].ui005-summary .summary-editor-footer {margin:0;padding:12px 16px}
      hp-dialog[data-kind="summary"].ui005-summary .summary-switch input[type="checkbox"] {width:44px;height:44px;flex:0 0 44px}
      hp-dialog[data-kind="summary"].ui005-summary .summary-visibility[aria-pressed="true"] {color:var(--primary-color);border-color:var(--primary-color);background:var(--summary-editor-accent-soft)}
      @media(prefers-reduced-motion:reduce){hp-dialog[data-kind="summary"].ui005-summary {--hp-dialog-close-transition:none;--hp-dialog-close-hover-transform:none}}
    `;
    root.append(style);
    const decorated = new WeakSet();
    const decorate = async dialog => {
      kit ||= card._ensureEditorRuntime();
      if (!await kit || !dialog.isConnected) return;
      if (!decorated.has(dialog)) {
        decorated.add(dialog);
        dialog.classList.add('ui-dialog','ui005-summary');
        // Select hp-dialog's own header and guarded hp-close flow, also used by
        // settings dialogs. HA still owns the accepted exit animation.
        for (const attr of ['form-shell','settings-layout','compact']) dialog.setAttribute(attr,'');
        dialog.style.setProperty('--hp-dialog-wide-width','920px');
        dialog.requestUpdate();
        const shellStyle = document.createElement('style');
        shellStyle.textContent = `
          :host([data-kind="summary"].ui005-summary) .header {min-height:78px;padding:12px 16px}
          :host([data-kind="summary"].ui005-summary) .close {border-radius:50%}
          :host([data-kind="summary"].ui005-summary) ha-dialog {--ha-dialog-border-radius:13px}
        `;
        dialog.shadowRoot.append(shellStyle);
      }
      for (const button of dialog.querySelectorAll('button')) {
        button.classList.add('btn');
        if (button.classList.contains('summary-value-remove')) button.classList.add('danger');
      }
    };
    const scan = () => { for (const dialog of root.querySelectorAll('hp-dialog[data-kind="summary"]')) void decorate(dialog); };
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
