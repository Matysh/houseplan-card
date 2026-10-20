import { nothing, noChange, type ChildPart } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import type { HpDialog } from './hp-dialog';

/** A dialog's owner may retire its state only after accepting Close/Save.
 * Retain that owner's last presentation until the shell completes its exit;
 * do not retain model/write authority or intercept DOM removal globally.
 */
class DialogPresence extends AsyncDirective {
  private value: unknown = nothing;
  private epoch = 0;
  private departing: HpDialog | null = null;
  private pendingRemoval = false;

  render(value: unknown, _animate = true): unknown { return value; }

  update(part: ChildPart, [value, animate = true]: [unknown, boolean?]): unknown {
    if (!animate) {
      this.epoch++;
      this.departing?.cancelExit();
      this.departing = null;
      this.pendingRemoval = false;
      this.value = value;
      return value;
    }
    if (value !== nothing && value != null && value !== false) {
      this.epoch++;
      this.pendingRemoval = false;
      this.departing?.cancelExit();
      this.departing = null;
      this.value = value;
      return value;
    }
    if (this.pendingRemoval) return noChange;
    if (this.value === nothing) return nothing;
    const shell = this.findShell(part);
    if (!shell) { this.value = nothing; return nothing; }
    const epoch = ++this.epoch;
    this.departing = shell;
    this.pendingRemoval = true;
    void shell.beginExit().then(() => {
      if (this.epoch !== epoch || !this.isConnected) return;
      this.departing = null;
      this.pendingRemoval = false;
      this.value = nothing;
      this.setValue(nothing);
    });
    return noChange;
  }

  private findShell(part: ChildPart): HpDialog | null {
    const find = (node: Node): HpDialog | null => {
      if (!(node instanceof Element)) return null;
      if (node.localName === 'hp-dialog') return node as HpDialog;
      // PDF owns an extra shadow root. Search only this retained Lit part,
      // once at the accepted boundary; no card-wide observer or polling.
      for (const child of [...node.children, ...(node.shadowRoot?.children || [])]) {
        const shell = find(child);
        if (shell) return shell;
      }
      return null;
    };
    for (let node = part.startNode?.nextSibling; node && node !== part.endNode; node = node.nextSibling) {
      const shell = find(node);
      if (shell) return shell;
    }
    return null;
  }

  protected disconnected(): void {
    this.epoch++;
    this.departing?.cancelExit();
    this.departing = null;
  }

  protected reconnected(): void {
    if (!this.pendingRemoval) return;
    this.pendingRemoval = false;
    this.value = nothing;
    this.setValue(nothing);
  }
}

export const dialogPresence = directive(DialogPresence);
