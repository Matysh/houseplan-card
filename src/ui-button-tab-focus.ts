/** UI Kit button paint follows a real Tab traversal, not the browser's sticky
 * :focus-visible heuristic. Actual focus/order/activation remain native. */
const sessions = new WeakMap<Document, ButtonFocusSession>();
const marker = 'hpf-tab-focus';

class ButtonFocusSession {
  readonly owners = new Set<HTMLElement>();
  private current: HTMLElement | null = null;
  private tabPending = false;
  private readonly controller = new AbortController();

  constructor(private readonly document: Document) {
    const options = { capture: true, signal: this.controller.signal };
    document.addEventListener('keydown', this.keydown, options);
    document.addEventListener('keyup', this.keyup, options);
    document.addEventListener('pointerdown', this.reset, options);
    document.defaultView?.addEventListener('blur', this.reset, options);
  }

  private readonly clearPaint = (): void => {
    this.current?.removeEventListener('blur', this.clearPaint);
    this.current?.classList.remove(marker);
    this.current = null;
  };

  readonly reset = (): void => { this.tabPending = false; this.clearPaint(); };

  private readonly keydown = (event: KeyboardEvent): void => {
    this.reset();
    this.tabPending = event.isTrusted && event.key === 'Tab'
      && !event.ctrlKey && !event.altKey && !event.metaKey;
  };
  private readonly keyup = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !this.tabPending) return;
    this.tabPending = false;
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
    if (!button || button.matches(':disabled,[aria-disabled=true]')) return;
    this.current = button;
    button.classList.add(marker);
    button.addEventListener('blur', this.clearPaint, {once:true});
  };

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
