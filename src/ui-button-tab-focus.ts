/** UI Kit button paint follows a real Tab traversal, not the browser's sticky
 * :focus-visible heuristic. Actual focus/order/activation remain native. */
const sessions = new WeakMap<Document, ButtonFocusSession>();
const marker = 'hpf-tab-focus';
const compositeMarker = 'hpf-keyboard-current';

class ButtonFocusSession {
  readonly owners = new Set<HTMLElement>();
  private current: HTMLElement | null = null;
  private tabPending = false;
  private compositeIntent = false;
  private readonly controller = new AbortController();

  constructor(private readonly document: Document) {
    const options = { capture: true, signal: this.controller.signal };
    const keys = document.defaultView ?? document;
    keys.addEventListener('keydown', this.keydown as EventListener, options);
    keys.addEventListener('keyup', this.keyup as EventListener, options);
    document.addEventListener('pointerdown', this.reset, options);
    // Non-capturing: an element blur while Tab crosses shadow/card boundaries
    // is not the browser window losing focus and must not revoke the traversal.
    document.defaultView?.addEventListener('blur', this.reset, {signal:this.controller.signal});
  }

  private readonly clearPaint = (): void => {
    this.current?.removeEventListener('blur', this.clearPaint);
    this.current?.classList.remove(marker);
    this.current?.classList.remove(compositeMarker);
    this.current = null;
  };

  readonly reset = (): void => { this.tabPending = false; this.compositeIntent = false; this.clearPaint(); };

  private readonly keydown = (event: KeyboardEvent): void => {
    this.reset();
    this.tabPending = event.isTrusted && event.key === 'Tab'
      && !event.ctrlKey && !event.altKey && !event.metaKey;
    this.compositeIntent = event.isTrusted && !event.ctrlKey && !event.altKey && !event.metaKey
      && (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' ','ContextMenu'].includes(event.key)
        || event.key === 'F10' && event.shiftKey)
      && event.composedPath().some(node => this.owners.has(node as HTMLElement));
  };
  private readonly keyup = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !this.tabPending) return;
    this.tabPending = false;
    const button = this.focusedButton();
    if (button) this.paint(button, marker);
  };

  private focusedButton(): HTMLElement | null {
    // focusin/out are retargeted away when traversal stays inside one shadow
    // host. Inspect the native result after Tab's default action instead.
    let focused = this.document.activeElement;
    let owned = false;
    while (focused) {
      owned ||= this.owners.has(focused as HTMLElement);
      const inner = focused.shadowRoot?.activeElement;
      if (!inner) break;
      focused = inner;
    }
    const button = owned && focused?.localName === 'button' ? focused as HTMLElement : null;
    return button && !button.matches(':disabled,[aria-disabled=true]') ? button : null;
  }

  private paint(button: HTMLElement, className: string): void {
    this.clearPaint();
    this.current = button;
    button.classList.add(className);
    button.addEventListener('blur', this.clearPaint, {once:true});
  }

  /** Explicit composite navigation owns a current item, not generic Tab paint.
   * Ordinary arrows/Enter on ordinary buttons still cannot enable a frame. */
  compositeCurrent(button: HTMLElement): void {
    if (!this.compositeIntent || this.focusedButton() !== button) return;
    this.compositeIntent = false;
    this.paint(button, compositeMarker);
  }

  release(owner: HTMLElement): void {
    this.owners.delete(owner);
    if (this.current && !this.current.isConnected) this.clearPaint();
    if (!this.owners.size) {
      this.reset();
      this.controller.abort();
      sessions.delete(this.document);
    }
  }
}

/** One listener set per document; multiple cards/dialogs hold independent leases. */
export function acquireButtonTabFocus(owner: HTMLElement): () => void {
  const document = owner.ownerDocument;
  let session = sessions.get(document);
  if (!session) { session = new ButtonFocusSession(document); sessions.set(document, session); }
  session.owners.add(owner);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    session.release(owner);
  };
}

/** A programmatic return is not a new Tab traversal, even inside a key handler. */
export function retireButtonTabFocus(owner: HTMLElement): void {
  sessions.get(owner.ownerDocument)?.reset();
}

/** Only menu/group navigation calls this; never use it for automatic return. */
export function focusCompositeButton(button: HTMLElement | null | undefined): void {
  if (!button) return;
  button.focus({preventScroll:true});
  sessions.get(button.ownerDocument)?.compositeCurrent(button);
}
