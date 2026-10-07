/**
 * Editor-only CSS arrives with the lazy editor runtime (#805).
 *
 * The cold View never matches the editor's dialog rules or the contextual
 * editor tray, so neither ships in the card's `static styles`: the
 * `HouseplanEditorRuntime` constructor adopts both sheets into the card's
 * shadow root. That is the loader's `create()` step — after the exact-build
 * fingerprint check, before `install` — and every editor surface renders only
 * once the runtime is installed, so the first frame of any editor surface
 * already has its styles. Evaluating this module adopts nothing: a module of
 * another build that fails the fingerprint check never touches a root.
 *
 * Cascade position is part of the contract (`src/styles.ts`): the moved
 * dialog rules sit right after the eager `dialogs` sheet and the tray sheet
 * right after the last `cardStyles` sheet — exactly where they were before the
 * move, and ahead of sheets adopted later (form kit #594, summary panel #437).
 */
import type { CSSResult, CSSResultGroup } from 'lit';
import { cardStyles } from './styles';
import { dialogsStyles } from './styles/dialogs.styles';
import { editorDialogsStyles } from './styles/editor-dialogs.styles';
import { editorSecondaryStyles } from './editor-secondary.styles';

export interface EditorStyleHost {
  renderRoot?: DocumentFragment | HTMLElement;
}

/** Accounting per root: a second card has its own root and adopts again. */
const adoptedRoots = new WeakSet<object>();
/** One sheet object per document, shared by every card on the page (#594 precedent). */
const documentSheets = new WeakMap<Document, CSSStyleSheet[]>();

const flatten = (group: CSSResultGroup): CSSResult[] =>
  Array.isArray(group) ? group.flatMap((item) => flatten(item as CSSResultGroup)) : [group as CSSResult];

/** [Lit sheet to follow, editor sheet] in cascade order. */
const placements = (): Array<[CSSResult, CSSResult]> => [
  [dialogsStyles, editorDialogsStyles],
  [flatten(cardStyles).pop()!, editorSecondaryStyles],
];

/**
 * Adopt the editor sheets into the host's shadow root; idempotent per root.
 * Returns `false` only while the host has no render root yet.
 */
export function adoptEditorStyles(host: EditorStyleHost): boolean {
  const root = host.renderRoot as ShadowRoot | undefined;
  if (!root) return false;
  if (adoptedRoots.has(root)) return true;
  const doc = root.ownerDocument;
  const Sheet = doc.defaultView?.CSSStyleSheet;
  if (Sheet && root.adoptedStyleSheets) {
    let sheets = documentSheets.get(doc);
    if (!sheets) {
      sheets = placements().map(([, result]) => {
        const sheet = new Sheet();
        sheet.replaceSync(result.cssText);
        return sheet;
      });
      documentSheets.set(doc, sheets);
    }
    const list = [...root.adoptedStyleSheets];
    placements().forEach(([anchor], i) => {
      // Right after the anchor Lit adopted; last if it is absent.
      list.splice(list.indexOf(anchor.styleSheet!) + 1 || list.length, 0, sheets![i]);
    });
    root.adoptedStyleSheets = list;
  } else {
    // Lit's own fallback renders one <style> per sheet; keep the same order.
    const styles = [...root.children];
    for (const [anchor, result] of placements()) {
      const style = doc.createElement('style');
      style.textContent = result.cssText;
      const at = styles.find((node) => node.localName === 'style' && node.textContent === anchor.cssText);
      if (at) at.after(style); else root.append(style);
    }
  }
  adoptedRoots.add(root);
  return true;
}
