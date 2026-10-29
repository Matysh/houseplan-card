/** Read-only device card composition on the same UI Kit as settings. */
import { css } from 'lit';
import { ensureFormKitStyles, type FormKitStyleHost } from './form-kit-styles';
import { ensureCompactDialogStyles } from './compact-dialog-styles';

const infoCardCss = css`
  hp-dialog[data-kind="info"][settings-layout] { --hp-dialog-icon-size:40.48px; }
  hp-dialog[data-kind="info"][settings-layout] .body.hpf-form { padding:20px; display:grid; gap:16px; }
  hp-dialog[data-kind="info"] .inforow.hpf-row { display:grid; grid-template-columns:112px minmax(0,1fr); gap:16px; margin:0; padding:0; align-items:start; }
  hp-dialog[data-kind="info"] .inforow .hpf-label { width:auto; min-width:0; color:var(--hp-muted); line-height:1.55; }
  hp-dialog[data-kind="info"] .inforow > :last-child { min-width:0; overflow-wrap:anywhere; line-height:1.55; }
  hp-dialog[data-kind="info"] .hpf-link { text-align:left; white-space:normal; overflow-wrap:anywhere; }
  hp-dialog[data-kind="info"] .infodesc { margin:0; line-height:1.6; white-space:pre-wrap; }
  hp-dialog[data-kind="info"] .infodesc.hpf-note { padding:12px 14px; }
  hp-dialog[data-kind="info"] .infodesc.muted { color:var(--hp-muted); }
  hp-dialog[data-kind="info"] .entlist { display:grid; gap:0; margin:0; }
  hp-dialog[data-kind="info"] .entrow { display:flex; align-items:center; gap:12px; padding:12px 0; border:0; background:transparent; min-height:44px; }
  hp-dialog[data-kind="info"] .entrow + .entrow { border-top:1px solid var(--hpf-line,var(--divider-color)); }
  hp-dialog[data-kind="info"] .entrow ha-icon { --mdc-icon-size:20px; color:var(--hp-muted); }
  hp-dialog[data-kind="info"] .entrow.on ha-icon { color:var(--hp-accent); }
  hp-dialog[data-kind="info"] .entrow .en { flex:1; min-width:0; overflow-wrap:anywhere; font-size:var(--fs-m); line-height:1.5; }
  hp-dialog[data-kind="info"] .entrow .ev { font-size:var(--fs-m); font-variant-numeric:tabular-nums; color:var(--primary-text-color); text-align:right; }
  hp-dialog[data-kind="info"] .entrow .btn { min-width:88px; flex-shrink:0; }
  hp-dialog[data-kind="info"] .entlist + .inforow { padding-top:16px; border-top:1px solid var(--hpf-line,var(--divider-color)); }
  hp-dialog[data-kind="info"] .pdflist { display:grid; gap:8px; }
  hp-dialog[data-kind="info"] .pdflist .hpf-link { display:inline-flex; align-items:center; gap:8px; text-decoration:none; }
  hp-dialog[data-kind="info"] .infofooter.hpf-footer { display:flex; align-items:center; gap:10px; padding:12px 16px; margin:0; flex-wrap:wrap; }
  hp-dialog[data-kind="info"] .infofooter .btn { flex-shrink:0; }
  hp-dialog[data-kind="info"] .infofooter .infofooter-close { margin-left:auto; }
  @media(max-width:480px) { hp-dialog[data-kind="info"] .inforow.hpf-row { grid-template-columns:1fr; gap:5px; } }
`.cssText;
const adopted = new WeakSet<Node>();
const sheets = new WeakMap<Document, CSSStyleSheet>();
export function ensureInfoCardStyles(host: FormKitStyleHost): void {
  const root = host.renderRoot as ShadowRoot | undefined;
  if (!root?.ownerDocument) return;
  ensureFormKitStyles(host);
  ensureCompactDialogStyles(host);
  if (adopted.has(root)) return;
  const doc = root.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    let sheet = sheets.get(doc);
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(infoCardCss); sheets.set(doc, sheet); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else {
    const style = doc.createElement('style'); style.textContent = infoCardCss; root.appendChild(style);
  }
  adopted.add(root);
}
