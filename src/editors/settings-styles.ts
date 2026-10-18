import '../hp-settings-select';
import { ensureFormKitStyles, type FormKitStyleHost } from './form-kit';
import { settingsDialogCss } from '../styles/settings-dialogs.styles';
import { cardDialogFormKitTokens } from '../styles/form-kit.styles';

// The footer is a sibling of the form. Share the same theme tokens at its
// settings-dialog owner instead of maintaining a second colour palette.
const SETTINGS_DIALOG_CSS = cardDialogFormKitTokens.replace('hp-dialog .hpf-form', 'hp-dialog:is([settings-layout],.danger-confirm-dialog)') + settingsDialogCss;
import type { HpColorOpacity } from '../hp-color-opacity';

const adopted = new WeakSet<ShadowRoot>();
const sheets = new WeakMap<Document, CSSStyleSheet>();

/** Settings-only CSS must not enter the separate onboarding graph. */
export function ensureSettingsDialogStyles(host: FormKitStyleHost): void {
  ensureFormKitStyles(host);
  const root = host.renderRoot as ShadowRoot;
  if (!root || adopted.has(root)) return;
  // Editor-only delegation: leave onboarding and ordinary colour fields alone.
  root.addEventListener('click', event => {
    const path=event.composedPath();
    if (path.some(node => node instanceof HTMLElement && node.matches('button,input,hp-color-opacity'))) return;
    const target=path.find((node): node is HTMLElement => node instanceof HTMLElement);
    const plate=target?.closest('.hpf-colorfield');
    if (plate?.closest('hp-dialog[settings-layout]')) void plate.querySelector<HpColorOpacity>('hp-color-opacity')?.togglePicker();
  });
  const doc = root.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    let sheet = sheets.get(doc);
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(SETTINGS_DIALOG_CSS); sheets.set(doc, sheet); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else {
    const style = doc.createElement('style');
    style.dataset.hpSettingsStyles = 'true'; style.textContent = SETTINGS_DIALOG_CSS; root.appendChild(style);
  }
  adopted.add(root);
}
