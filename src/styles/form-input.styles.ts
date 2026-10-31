
/** Native checkbox paint shared by dialog and independently owned field roots. */
export function formKitCheckboxCss(selector: string): string {
  return `${selector}{width:18px;height:18px;margin:0;flex:none;accent-color:var(--hpf-accent,var(--primary-color));cursor:pointer;}`;
}

/** Validation copy uses the same readable size in a dialog and a self-owned field. */
export function formKitErrorCss(selector: string, danger = '--hpf-danger'): string {
  return `  ${selector} { margin: 0; font-size: .875rem; line-height: 1.5; color: var(${danger}); }`;
}

/** Multiline fields share the same readable/resize contract across owning roots. */
export function formKitTextareaCss(selector: string): string {
  return `  ${selector} { min-height: 96px; resize: vertical; line-height: 1.5; }`;
}
