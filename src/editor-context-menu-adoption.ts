/** The same menu sheet is shared by lazy View and editor owners, once per root. */
import { dialogsStyles } from './styles/dialogs.styles';
import { editorContextMenuStyles } from './editor-context-menu.styles';

const roots = new WeakSet<object>();
const sheets = new WeakMap<Document, CSSStyleSheet>();
export function adoptEditorContextMenuStyles(host: { renderRoot?: DocumentFragment | HTMLElement }): boolean {
  const root = host.renderRoot as ShadowRoot | undefined;
  if (!root) return false;
  if (roots.has(root)) return true;
  const doc = root.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && root.adoptedStyleSheets) {
    let sheet = sheets.get(doc);
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(editorContextMenuStyles.cssText); sheets.set(doc, sheet); }
    const list = [...root.adoptedStyleSheets];
    list.splice(list.indexOf(dialogsStyles.styleSheet!) + 1 || list.length, 0, sheet);
    root.adoptedStyleSheets = list;
  } else {
    const style = doc.createElement('style'); style.textContent = editorContextMenuStyles.cssText;
    const anchor = [...root.children].find(node => node.localName === 'style' && node.textContent === dialogsStyles.cssText);
    if (anchor) anchor.after(style); else root.append(style);
  }
  roots.add(root); return true;
}
