import { css, nothing, type ElementPart } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive } from 'lit/directive.js';
import { controlMotionStyles, controlReducedMotionCss } from './styles/ui-motion.styles';

// Only presentation of this mounted native HA dialog. HA keeps open/close,
// modal authority, focus, scrolling and its public events. No global hooks.
const motionCss = controlMotionStyles.cssText + css`
  [part~='dialog'].show {
    animation: hp-ui-appear var(--hpf-appear-duration) var(--hpf-appear-easing) both;
  }
  [part~='dialog'].hide {
    animation: hp-ui-leave var(--hpf-leave-duration) var(--hpf-leave-easing) both;
  }
  [part~='dialog'].show::backdrop {
    animation: hp-ui-leave var(--hpf-appear-duration) var(--hpf-appear-easing) reverse both;
  }
  [part~='dialog'].hide::backdrop {
    animation: hp-ui-leave var(--hpf-leave-duration) var(--hpf-leave-easing) both;
  }
`.cssText + controlReducedMotionCss("[part~='dialog'].show, [part~='dialog'].hide, [part~='dialog'].show::backdrop, [part~='dialog'].hide::backdrop");
type ReadyElement = HTMLElement & { updateComplete?: Promise<unknown> };
const sheets = new WeakMap<Document, CSSStyleSheet>();

class HaDialogMotion extends AsyncDirective {
  private element?: ReadyElement;
  private root?: ShadowRoot;
  private sheet?: CSSStyleSheet;
  private style?: HTMLStyleElement;
  private generation = 0;
  private pending = false;
  private inspected = false;
  render(): typeof nothing { return nothing; }
  update(part: ElementPart): typeof nothing {
    if (this.element !== part.element) { this.detach(); this.element = part.element as ReadyElement; }
    this.schedule(); return nothing;
  }
  private schedule(): void {
    if (!this.isConnected || this.pending || this.inspected) return;
    this.pending = true;
    const generation = this.generation, element = this.element;
    const current = (): boolean => this.isConnected && !!element?.isConnected
      && this.element === element && this.generation === generation;
    queueMicrotask(() => {
      void (async () => {
        try {
          if (!current() || !element) return;
          await element.updateComplete;
          if (!current()) return;
          const modal = element.shadowRoot?.querySelector<ReadyElement>('wa-dialog');
          if (!modal) return; // Older HA owns its native implementation.
          await modal.updateComplete;
          if (!current() || !modal.isConnected || !modal.shadowRoot) return;
          const root = this.root = modal.shadowRoot;
          const doc = element.ownerDocument, Sheet = doc.defaultView?.CSSStyleSheet;
          if (Sheet && 'adoptedStyleSheets' in root) {
            let sheet = sheets.get(doc);
            if (!sheet) { sheet = new Sheet(); sheet.replaceSync(motionCss); sheets.set(doc, sheet); }
            this.sheet = sheet; root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
          } else {
            this.style = doc.createElement('style'); this.style.textContent = motionCss; root.append(this.style);
          }
        } finally {
          if (generation === this.generation) { this.pending = false; this.inspected = true; }
        }
      })();
    });
  }
  private detach(): void {
    this.generation++; this.pending = false; this.inspected = false;
    if (this.root && this.sheet) this.root.adoptedStyleSheets = this.root.adoptedStyleSheets.filter(sheet => sheet !== this.sheet);
    this.style?.remove(); this.root = undefined; this.sheet = undefined; this.style = undefined;
  }
  disconnected(): void { this.detach(); }
  reconnected(): void { this.schedule(); }
}
export const haDialogMotion = directive(HaDialogMotion);
