import { noChange, type ElementPart } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import type { HpDialog } from '../hp-dialog';

/** Keep an inline picker in the dialog's existing Escape stack, not a new popup. */
class SourcePickerOverlay extends AsyncDirective {
  private element?: HTMLElement;
  private open = false;
  private onClose?: () => void;
  private dispose?: () => void;

  render(_open: boolean, _onClose?: () => void): unknown { return noChange; }

  update(part: ElementPart, [open, onClose]: [boolean, (() => void)?]): unknown {
    this.element = part.element as HTMLElement;
    this.open = open;
    this.onClose = onClose;
    this.sync();
    return noChange;
  }

  private sync(): void {
    if (!this.open || !this.onClose || !this.isConnected) {
      this.dispose?.(); this.dispose = undefined;
      return;
    }
    // The element part may run before a new picker is inserted into its dialog.
    queueMicrotask(() => {
      if (!this.open || !this.onClose || !this.isConnected || !this.element?.isConnected || this.dispose) return;
      const dialog = this.element.closest<HpDialog>('hp-dialog');
      this.dispose = dialog?.registerOverlay({ owner: this.element, group: 'transient', close: reason => {
        this.dispose = undefined;
        this.onClose?.();
        if (reason === 'escape') this.element?.querySelector<HTMLButtonElement>('.hpf-pick')?.focus({ preventScroll: true });
      } });
    });
  }

  protected disconnected(): void { this.dispose?.(); this.dispose = undefined; }
  protected reconnected(): void { this.sync(); }
}

export const sourcePickerOverlay = directive(SourcePickerOverlay);
