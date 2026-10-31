/** Shared compact UI Kit; usable without an editor/settings runtime. */
import { css } from 'lit';
import { cardDialogFormKitTokens } from './styles/form-kit-tokens';
import { settingsActionsCss } from './styles/settings-action.styles';

export interface CompactDialogHost { readonly renderRoot: HTMLElement | DocumentFragment }
const adopted = new WeakSet<Node>();
const sheets = new WeakMap<Document, CSSStyleSheet>();
export const compactDialogCss = cardDialogFormKitTokens.replace('hp-dialog .hpf-form', 'hp-dialog.ui-dialog')
  + settingsActionsCss('hp-dialog.ui-dialog .btn') + css`
hp-dialog.ui-dialog{--hpf-control-surface:var(--hpf-surface);}
hp-dialog.ui-dialog[settings-layout]{--hp-dialog-icon-size:40.48px;--hp-dialog-close-transition:160ms ease;--hp-dialog-close-hover-transform:rotate(90deg) scale(1.12);}
hp-dialog.ui-dialog.danger-confirm-dialog{--hp-dialog-icon-size:28px;}
hp-dialog.ui-dialog[compact]{--hp-dialog-wide-width:560px;}
hp-dialog.ui-dialog *:is(.body,.device-inbox){box-sizing:border-box;min-width:0;max-height:none;overflow:visible;padding:var(--hpf-kit-body-inset,20px);background:var(--hpf-surface);font-size:13px;line-height:1.5;}
:where(hp-dialog.ui-dialog) .body{display:flex;flex-direction:column;gap:12px;}
:where(hp-dialog.ui-dialog) .row{display:flex;gap:12px;min-width:0;}
:where(hp-dialog.ui-dialog) .row .spacer{flex:1;}
:where(hp-dialog.ui-dialog) > .row[slot=footer]:where(:not(.hpf-footer-space)){display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;margin:0;padding:12px 16px;border:0;background:var(--hpf-surface);}
hp-dialog.ui-dialog input[type=checkbox]{width:18px;height:18px;margin:0;flex:none;accent-color:var(--hpf-accent);cursor:pointer;}
hp-dialog.ui-dialog .rhint{margin:0 0 18px;padding:8px 10px;border-inline-start:3px solid var(--info-color,var(--hpf-accent));background:color-mix(in srgb,var(--info-color,var(--hpf-accent)) 10%,var(--hpf-surface));font-size:12px;line-height:1.5;}
/* Existing floor-import presentation, shared by both runtime entry paths. */
hp-dialog[data-kind=import].ui-dialog{--hp-dialog-icon-size:32px;}
hp-dialog[data-kind=import].ui-dialog .body{display:flex;flex-direction:column;gap:0;padding:20px;}
hp-dialog[data-kind=import].ui-dialog .rhint{margin:0 0 16px;font-size:13px;line-height:1.6;color:var(--secondary-text-color);}
hp-dialog[data-kind=import].ui-dialog .floorrow{display:flex;align-items:center;gap:12px;min-height:44px;box-sizing:border-box;margin:0;padding:10px 12px;border-radius:7px;font-size:14px;line-height:24px;cursor:pointer;transition:background 160ms ease;}
hp-dialog[data-kind=import].ui-dialog .floorrow:hover{background:var(--hpf-canvas,var(--secondary-background-color));}
hp-dialog[data-kind=import].ui-dialog .floorlvl{margin-inline-start:auto;color:var(--secondary-text-color);font-size:12px;border:1px solid var(--hpf-line);border-radius:5px;padding:0 8px;}
@media(max-width:680px){
hp-dialog.ui-dialog *:is(.body,.device-inbox){padding:var(--hpf-kit-body-inset,18px 14px);}
:where(hp-dialog.ui-dialog) > .row[slot=footer]:where(:not(.hpf-footer-space)){padding:12px 14px;}
}
@media(max-width:360px){
hp-dialog.ui-dialog.hpf-stack-actions .row[slot=footer]{display:grid;grid-template-columns:minmax(0,1fr);}
hp-dialog.ui-dialog.hpf-stack-actions .row[slot=footer] .spacer{display:none;}
}
@media(prefers-reduced-motion:reduce){
hp-dialog.ui-dialog[settings-layout]{--hp-dialog-close-transition:none;--hp-dialog-close-hover-transform:none;}
hp-dialog[data-kind=import].ui-dialog .floorrow{transition:none;}
}
`.cssText;

export function ensureCompactDialogStyles(host: CompactDialogHost): void {
  const root = host.renderRoot as ShadowRoot;
  if (!root || adopted.has(root)) return;
  const doc = root.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    let sheet = sheets.get(doc);
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(compactDialogCss); sheets.set(doc, sheet); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else {
    const style = doc.createElement('style'); style.dataset.hpCompactDialogStyles = 'true';
    style.textContent = compactDialogCss; root.appendChild(style);
  }
  adopted.add(root);
}
