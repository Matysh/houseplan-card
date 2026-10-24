import { nothing, type ElementPart } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';

const duration = 220;
const easing = 'cubic-bezier(.2,0,.2,1)';

/** Follow slot assignment, including the authentic HA shell, without private
 * HA selectors. Never fall through to scrolling the host page. */
function parentOf(node: Element): Element | null {
  if (node.assignedSlot) return node.assignedSlot;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function scrollHeading(summary: HTMLElement, reduced: boolean): void {
  const doc = summary.ownerDocument;
  for (let node = parentOf(summary); node; node = parentOf(node)) {
    if (node.localName === 'hp-dialog' || node === doc.body || node === doc.documentElement) return;
    if (!(node instanceof HTMLElement) || !/^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) continue;
    const top = node.scrollTop + summary.getBoundingClientRect().top
      - node.getBoundingClientRect().top - node.clientTop;
    node.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    return;
  }
}

/** The owning details keeps its content mounted through Close. Only the
 * presentation is animated; native semantics, content and callbacks stay local. */
class DisclosureMotion extends AsyncDirective {
  private element: HTMLDetailsElement | null = null;
  private expanded = false;
  private expectedNativeOpen = false;
  private controlled: boolean | undefined;
  private onToggle: ((open: boolean) => void) | undefined;
  private animation: Animation | null = null;
  private listening = false;

  render(_open?: boolean, _onToggle?: (open: boolean) => void): unknown { return nothing; }

  update(part: ElementPart, [open, onToggle]: [boolean | undefined, ((open: boolean) => void) | undefined]): unknown {
    const element = part.element as HTMLDetailsElement;
    this.onToggle = onToggle;
    if (this.element !== element) {
      this.detach();
      this.element = element;
      this.controlled = open;
      this.expanded = open ?? false;
      this.expectedNativeOpen = this.expanded;
      element.open = this.expanded;
      this.paintState();
      this.attach();
      queueMicrotask(() => { if (this.element === element && this.isConnected) this.paintState(); });
    } else if (open !== undefined && open !== this.controlled) {
      this.controlled = open;
      this.change(open, false, false);
    }
    return nothing;
  }

  private get summary(): HTMLElement | null {
    return this.element?.querySelector<HTMLElement>(':scope > summary') ?? null;
  }
  private get content(): HTMLElement | null {
    return this.element?.querySelector<HTMLElement>(':scope > .hpf-disclosure-content') ?? null;
  }
  private paintState(): void {
    const element = this.element, summary = this.summary, content = this.content;
    if (!element) return;
    element.dataset.expanded = String(this.expanded);
    summary?.setAttribute('aria-expanded', String(this.expanded));
    if (content) {
      content.inert = !this.expanded;
      content.setAttribute('aria-hidden', String(!this.expanded));
    }
  }
  private readonly click = (event: MouseEvent): void => {
    const summary = this.summary;
    if (event.defaultPrevented || !summary || !event.composedPath().includes(summary)) return;
    event.preventDefault();
    this.change(!this.expanded, true, true);
  };
  private readonly toggle = (): void => {
    const element = this.element;
    if (!element || element.open === this.expectedNativeOpen) return;
    // An existing owner's explicit native open/close is immediate.
    this.change(element.open, false, false);
  };
  private change(next: boolean, animate: boolean, scroll: boolean): void {
    const element = this.element, summary = this.summary, content = this.content;
    if (!element || !summary || !content || next === this.expanded) return;
    const from = content.getBoundingClientRect().height;
    this.animation?.cancel();
    this.animation = null;
    content.style.removeProperty('overflow');
    this.expanded = next;
    this.paintState();
    const reduced = element.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
    if (!animate || reduced || typeof content.animate !== 'function') {
      this.expectedNativeOpen = next;
      element.open = next;
      if (scroll) scrollHeading(summary, reduced);
      this.onToggle?.(next);
      return;
    }
    this.expectedNativeOpen = true;
    element.open = true;
    const full = content.getBoundingClientRect().height;
    content.style.overflow = 'hidden';
    const animation = content.animate([{ height: from + 'px' }, { height: (next ? full : 0) + 'px' }],
      { duration, easing, fill: 'both' });
    this.animation = animation;
    if (scroll) scrollHeading(summary, reduced);
    this.onToggle?.(next);
    void animation.finished.then(() => {
      if (this.animation !== animation) return;
      this.animation = null;
      this.expectedNativeOpen = this.expanded;
      element.open = this.expanded;
      animation.cancel();
      content.style.removeProperty('overflow');
      if (scroll && element.isConnected) scrollHeading(summary, reduced);
    }).catch(() => undefined);
  }
  private attach(): void {
    if (!this.element || this.listening) return;
    this.element.addEventListener('click', this.click);
    this.element.addEventListener('toggle', this.toggle);
    this.listening = true;
  }
  private detach(): void {
    if (this.element && this.listening) {
      this.element.removeEventListener('click', this.click);
      this.element.removeEventListener('toggle', this.toggle);
    }
    this.listening = false;
    this.animation?.cancel();
    this.animation = null;
    this.content?.style.removeProperty('overflow');
  }
  protected disconnected(): void { this.detach(); }
  protected reconnected(): void {
    if (this.element) {
      this.expectedNativeOpen = this.expanded;
      this.element.open = this.expanded;
      this.paintState();
    }
    this.attach();
  }
}

export const disclosureMotion = directive(DisclosureMotion);
