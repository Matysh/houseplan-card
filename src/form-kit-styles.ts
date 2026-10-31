/** One shared stylesheet owner for editable and read-only UI Kit surfaces.
 * Shared with cold kiosk/confirmation rendering; adoption happens only when
 * a surface opens. The full editor runtime and its commands remain lazy.
 */
import { CARD_DIALOG_FORM_KIT, cardDialogFormKitTokens, formKitCss } from './styles/form-kit.styles';
import { dialogCompositionCss } from './styles/dialog-composition.styles';

const FORM_KIT_CSS = cardDialogFormKitTokens
  + formKitCss(CARD_DIALOG_FORM_KIT, { withSwitch: false }) + dialogCompositionCss;
const adopted = new WeakSet<ShadowRoot>();
let sheet: CSSStyleSheet | null = null;

export interface FormKitStyleHost {
  renderRoot: DocumentFragment | HTMLElement;
}

/**
 * Идемпотентно вносит лист набора в теневой корень карточки.
 *
 * Документ берётся у самого корня, а не у хоста: тип хоста редактора его не
 * обещает, а `ShadowRoot` всегда знает свой документ.
 */
export function ensureFormKitStyles(host: FormKitStyleHost): void {
  const root = host.renderRoot as ShadowRoot;
  if (!root || adopted.has(root)) return;
  const doc = root.ownerDocument ?? globalThis.document;
  const Sheet = doc?.defaultView?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(FORM_KIT_CSS); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    adopted.add(root);
    return;
  }
  if (root.querySelector('style[data-hp-form-kit]')) { adopted.add(root); return; }
  const style = doc.createElement('style');
  style.dataset.hpFormKit = 'true';
  style.textContent = FORM_KIT_CSS;
  root.appendChild(style);
  adopted.add(root);
}

