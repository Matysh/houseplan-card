/** Shared compact UI Kit; usable without an editor/settings runtime. */
import { css } from 'lit';
import { cardDialogFormKitTokens } from './styles/form-kit-tokens';
import { calloutSurfaceCss, CARD_DIALOG_FORM_KIT } from './styles/form-kit.styles';
import { formKitCheckboxCss } from './styles/form-input.styles';
import { settingsActionsCss } from './styles/settings-action.styles';

export interface CompactDialogHost { readonly renderRoot: HTMLElement | DocumentFragment }
const adopted = new WeakSet<Node>();
const sheets = new WeakMap<Document, CSSStyleSheet>();
export const compactDialogCss = cardDialogFormKitTokens.replace('hp-dialog .hpf-form', 'hp-dialog.ui-dialog')
  + settingsActionsCss('hp-dialog.ui-dialog .btn') + formKitCheckboxCss(':where(hp-dialog.ui-dialog input[type=checkbox])')
  + calloutSurfaceCss(CARD_DIALOG_FORM_KIT, 'hp-dialog.ui-dialog .rhint', 'compact') + css`
hp-dialog.ui-dialog{--hpf-control-surface:var(--hpf-surface);}
hp-dialog.ui-dialog[settings-layout]{--hp-dialog-icon-size:40.48px;--hp-dialog-close-transition:160ms ease;--hp-dialog-close-hover-transform:rotate(90deg) scale(1.12);}
hp-dialog.ui-dialog.danger-confirm-dialog{--hp-dialog-icon-size:28px;}
hp-dialog.ui-dialog[compact]{--hp-dialog-wide-width:560px;}
hp-dialog.ui-dialog *:is(.body,.device-inbox){box-sizing:border-box;min-width:0;max-height:none;overflow:visible;padding:var(--hpf-kit-body-inset,20px);background:var(--hpf-surface);font-size:13px;line-height:1.5;}
:where(hp-dialog.ui-dialog) .body{display:flex;flex-direction:column;gap:12px;}
:where(hp-dialog.ui-dialog) .row{display:flex;gap:12px;min-width:0;}
:where(hp-dialog.ui-dialog) .row .spacer{flex:1;}
:where(hp-dialog.ui-dialog) > .row[slot=footer]:where(:not(.hpf-footer-space)){display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;margin:0;padding:12px 16px;border:0;background:var(--hpf-surface);}
hp-dialog.ui-dialog .rhint{margin:0 0 18px;}
/* Existing floor-import presentation, shared by both runtime entry paths. */
hp-dialog[data-kind=import].ui-dialog{--hp-dialog-icon-size:32px;}
hp-dialog[data-kind=import].ui-dialog .floorhint{margin:0 0 16px;}
hp-dialog[data-kind=import].ui-dialog .floorlvl{margin-inline-start:auto;}
hp-dialog[data-kind=import].ui-dialog .body{display:flex;flex-direction:column;gap:0;padding:20px;}

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
