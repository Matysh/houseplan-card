/** Read-only device card composition on the same UI Kit as settings. */
import { css } from 'lit';
import { ensureFormKitStyles, type FormKitStyleHost } from './form-kit-styles';
import { ensureCompactDialogStyles } from './compact-dialog-styles';

const infoCardCss = css`
  hp-dialog[data-kind="info"][settings-layout] { --hp-dialog-icon-size:40.48px; }
  hp-dialog[data-kind="info"] .inforow.hpf-row { display:grid; grid-template-columns:112px minmax(0,1fr); gap:16px; margin:0; padding:0; align-items:start; }
  hp-dialog[data-kind="info"] .inforow .hpf-label { width:auto; min-width:0; }
  hp-dialog[data-kind="info"] .inforow > :last-child { min-width:0; overflow-wrap:anywhere; }
  hp-dialog[data-kind="info"] .hpf-link { text-align:left; white-space:normal; overflow-wrap:anywhere; }
  hp-dialog[data-kind="info"] .infodesc { margin:0; white-space:pre-wrap; }
  hp-dialog[data-kind="info"] .entlist { display:grid; gap:0; margin:0; }
  hp-dialog[data-kind="info"] .entrow .btn { flex-shrink:0; }
  hp-dialog[data-kind="info"] .pdflist { display:grid; gap:8px; }
  hp-dialog[data-kind="info"] .pdflist .hpf-link { display:inline-flex; align-items:center; gap:8px; text-decoration:none; }
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
