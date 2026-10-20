/** Shared interaction paint for settings actions, confirmations and pickers. */
export const settingsActionTransition = 'transition:background 160ms ease,color 160ms ease,border-color 160ms ease,box-shadow 160ms ease;';
export const settingsActionHover = 'background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 10%,transparent));color:var(--hpf-accent,var(--primary-color,#03a9f4));border-color:var(--hpf-accent,var(--primary-color,#03a9f4));box-shadow:0 0 0 1px var(--hpf-tint-line,var(--primary-color,#03a9f4));filter:brightness(1.08);';
export const settingsPrimaryActionHover = `${settingsActionHover}background:color-mix(in srgb,var(--hpf-accent,var(--primary-color,#03a9f4)) 90%,#000);color:var(--text-primary-color,#fff);`;

export function settingsInteractiveCss(selector: string): string {
  return `${selector}{cursor:pointer;${settingsActionTransition}}
    ${selector}:is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${settingsActionHover}outline:none;text-decoration:none;}`;
}

/** The same controls in card-owned forms and the PDF component's own root. */
export function settingsActionsCss(selector: string, primary = '.on'): string {
  return `
    ${selector}{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;min-width:0;max-width:100%;padding:10px 14px;border:1px solid var(--hpf-line,var(--divider-color));border-radius:7px;background:transparent;color:var(--primary-text-color);font:inherit;font-size:13px;line-height:20px;white-space:normal;overflow-wrap:anywhere;${settingsActionTransition}}
    ${selector}${primary}{background:var(--hpf-accent,var(--primary-color));color:var(--text-primary-color,#fff);border-color:var(--hpf-accent,var(--primary-color));}
    ${selector}.danger{color:var(--error-color);border-color:var(--error-color);}
    ${selector}:not(:disabled){cursor:pointer;}
    ${selector}:not(:disabled):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${settingsActionHover}}
    ${selector}${primary}:not(:disabled):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${settingsPrimaryActionHover}}
    ${selector}.danger:not(:disabled):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){background:color-mix(in srgb,var(--error-color) 10%,transparent);color:var(--error-color);border-color:var(--error-color);box-shadow:0 0 0 1px color-mix(in srgb,var(--error-color) 38%,transparent);}
    ${selector}:disabled{cursor:not-allowed;opacity:.5;}
    ${selector} ha-icon{margin:0;flex:none;--mdc-icon-size:20px;}
    @media(prefers-reduced-motion:reduce){${selector}{transition:none;}}
  `;
}
