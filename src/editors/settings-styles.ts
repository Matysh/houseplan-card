import '../hp-settings-select';
import { ensureFormKitStyles, type FormKitStyleHost } from './form-kit';
import { settingsDialogCss } from '../styles/settings-dialogs.styles';

const adopted = new WeakSet<ShadowRoot>();
const sheets = new WeakMap<Document, CSSStyleSheet>();

/** Settings-only CSS must not enter the separate onboarding graph. */
export function ensureSettingsDialogStyles(host: FormKitStyleHost): void {
  ensureFormKitStyles(host);
  const root = host.renderRoot as ShadowRoot;
  if (!root || adopted.has(root)) return;
  const doc = root.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    let sheet = sheets.get(doc);
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(settingsDialogCss); sheets.set(doc, sheet); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else {
    const style = doc.createElement('style');
    style.dataset.hpSettingsStyles = 'true'; style.textContent = settingsDialogCss; root.appendChild(style);
  }
  adopted.add(root);
}
