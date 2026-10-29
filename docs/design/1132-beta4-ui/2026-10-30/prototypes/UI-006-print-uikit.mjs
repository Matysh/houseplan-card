// UI-006 r1. Local visual adapter; reuse the beta4 shared UI Kit stylesheet.
// Keep Lit nodes and their change/disabled/save handlers intact.
void customElements.whenDefined('hp-pdf-dialog').then(async PdfDialog => {
  const { e: ensureFormKitStyles } = await import('/assets/houseplan-assets/form-kit-styles-Cadt5rxn.js');
  const wired = new WeakSet();
  const decorate = host => {
    const root = host.shadowRoot;
    if (!root) return;
    ensureFormKitStyles(host);
    root.querySelector('.body')?.classList.add('hpf-form');
    for (const input of root.querySelectorAll('.body > label > input[type="checkbox"]')) {
      input.parentElement.classList.add('hpf-toggle', 'hpf-noicon', 'hpf-compact');
      input.parentElement.querySelector('span')?.classList.add('hpf-toggle-title');
    }
    const dialog = root.querySelector('hp-dialog');
    if (dialog && !wired.has(dialog)) {
      wired.add(dialog);
      const syncPointer = event => {
        if (!event.pointerType) return;
        dialog.toggleAttribute('data-pointer-hover', event.pointerType === 'mouse'
          && !event.sourceCapabilities?.firesTouchEvents
          && matchMedia('(any-hover: hover) and (any-pointer: fine)').matches);
      };
      dialog.addEventListener('pointerover', syncPointer, true);
      dialog.addEventListener('pointerdown', syncPointer, true);
      dialog.addEventListener('pointermove', syncPointer, true);
    }
  };
  const updated = PdfDialog.prototype.updated;
  PdfDialog.prototype.updated = function(changed) {
    updated?.call(this, changed);
    decorate(this);
  };
  for (const dialog of window.__lab?.card?.shadowRoot?.querySelectorAll('hp-pdf-dialog') || []) decorate(dialog);
});
