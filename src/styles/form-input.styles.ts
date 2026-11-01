
/** Native checkbox paint shared by dialog and independently owned field roots. */
export function formKitCheckboxCss(selector: string, density: 'standard' | 'editor' = 'standard'): string {
  return `${selector}{width:${density === 'editor' ? '16px' : '18px'};height:${density === 'editor' ? '16px' : '18px'};margin:0;flex:none;accent-color:var(--hpf-accent,var(--primary-color));cursor:pointer;}`;
}

/** Validation copy uses the same readable size in a dialog and a self-owned field. */
export function formKitErrorCss(selector: string, danger = '--hpf-danger'): string {
  return `  ${selector} { margin: 0; font-size: .875rem; line-height: 1.5; color: var(${danger}); }`;
}

/** Multiline fields share the same readable/resize contract across owning roots. */
export function formKitTextareaCss(selector: string, density: 'standard' | 'property' | 'message' | 'data' = 'standard'): string {
  if (density === 'message') return `${selector} { min-height:120px; resize:vertical; line-height:1.5; }`;
  if (density === 'data') return `${selector} { min-height:220px; resize:none; font-family:monospace; white-space:pre; overflow:auto; }`;
  if (density === 'property') return `${selector} { display:block; height:66px; min-height:66px; padding:9px 10px; resize:vertical; line-height:1.5; overflow-wrap:anywhere; }`;
  return `  ${selector} { min-height: 96px; resize: vertical; line-height: 1.5; }`;
}
