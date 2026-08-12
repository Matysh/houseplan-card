import { LitElement, css, html, nothing, type PropertyValues } from 'lit';

type FocusSession = {
  dialogs: Set<HpDialog>;
  opener: HTMLElement | null;
};

export type HpOverlayCloseReason = 'escape' | 'exclusive' | 'outside' | 'scroll' | 'toast' | 'disconnect';

export type HpOverlayRegistration = {
  owner: HTMLElement;
  close: (reason: HpOverlayCloseReason) => void;
  group?: 'transient' | string;
};

type OverlayEntry = HpOverlayRegistration & { token: symbol };

// A card can replace one dialog with another in the same Lit update (for
// example, device info -> device editor) or open a child dialog above a parent.
// Keep the original opener per render root so those transitions do not lose it.
const focusSessions = new WeakMap<Node, FocusSession>();
let dialogSequence = 0;

/**
 * Shared modal shell for Houseplan.
 *
 * Home Assistant provides the visual surface and focus trap through ha-dialog.
 * The native dialog branch keeps the standalone demo usable without mocking HA
 * frontend internals. Both branches expose the same `hp-close` contract and
 * restore focus to the control that opened the dialog.
 */
export class HpDialog extends LitElement {
  static properties = {
    title: { type: String },
    icon: { type: String },
    wide: { type: Boolean, reflect: true },
    dismissOnScrim: { type: Boolean, attribute: 'dismiss-on-scrim' },
    hass: { attribute: false },
  };

  static styles = css`
    :host {
      display: contents;
      color: var(--primary-text-color, #e6e7eb);
      font: inherit;
    }

    ha-dialog {
      --dialog-content-padding: 0;
      --dialog-surface-background: var(--card-background-color, var(--hp-bg, #202126));
      --ha-dialog-border-radius: var(--rad-l, 18px);
      /* HA's ha-dialog-header defaults this custom property to a one-line
         fixed height.  Our localized slot is intentionally allowed to wrap,
         so leaving that default in place clips every line after the first at
         the bottom of the header.  auto is HA's public sizing hook and also
         stays harmless on older ha-dialog implementations that do not consume
         it. */
      --ha-dialog-header-title-height: auto;
      color: inherit;
    }

    ha-dialog::part(dialog) {
      border: 1px solid var(--hp-accent, #d89300);
      box-shadow: var(--shadow-3, 0 18px 48px rgb(0 0 0 / 0.34));
      overflow: hidden;
    }

    /* The HA header slot is a flex item with a constrained inline size.  The
       old inline-flex title kept its min-content width, so HA clipped the last
       word instead of giving it a second line.  Keep every wrapper shrinkable
       and let the text wrap; this applies to every hp-dialog, including long
       device names and translated titles. */
    .header-title-slot {
      display: block;
      flex: 1 1 auto;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      white-space: normal;
    }

    .title {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--sp-4, 12px);
      width: 100%;
      max-width: 100%;
      min-width: 0;
      font-weight: 600;
      line-height: 1.25;
      white-space: normal;
    }

    .title ha-icon {
      flex: none;
      color: var(--hp-accent, #d89300);
    }

    .title-text {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .footer {
      /* ha-dialog lays out its footer slot as a flex row. display: contents
         exposed the consumer's action row as a shrink-to-fit flex item, so a
         wide device dialog got a half-width divider and its Hide action slid
         toward the centre. Keep one full-width slot item in both HA and the
         native fallback. */
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    ::slotted([slot='footer']) {
      width: 100%;
      box-sizing: border-box;
    }

    dialog {
      width: auto;
      max-width: none;
      max-height: none;
      margin: auto;
      padding: 0;
      border: 0;
      overflow: visible;
      color: inherit;
      background: transparent;
    }

    dialog::backdrop {
      background: rgb(0 0 0 / 0.45);
    }

    .surface {
      width: min(360px, 92vw);
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      color: inherit;
      background: var(--card-background-color, var(--hp-bg, #202126));
      border: 1px solid var(--hp-accent, #d89300);
      border-radius: var(--rad-l, 18px);
      box-shadow: var(--shadow-3, 0 18px 48px rgb(0 0 0 / 0.34));
    }

    :host([wide]) .surface {
      width: min(500px, 94vw);
    }

    .header {
      min-height: 56px;
      display: flex;
      align-items: center;
      gap: var(--sp-4, 12px);
      padding: var(--sp-4, 12px) var(--sp-5, 16px);
      box-sizing: border-box;
      border-bottom: 1px solid var(--hp-line, rgb(255 255 255 / 0.12));
    }

    .header .title {
      flex: 1;
    }

    .close {
      width: 40px;
      height: 40px;
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: inherit;
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .close:hover,
    .close:focus-visible {
      background: rgb(127 127 127 / 0.16);
    }

    .content {
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .overlay-portal {
      position: fixed;
      z-index: 2147483647;
      inset: 0;
      overflow: visible;
      pointer-events: none;
    }

    .overlay-portal:empty {
      display: none;
    }

    .overlay-portal > * {
      pointer-events: auto;
    }
  `;

  title = '';
  icon = '';
  wide = false;
  dismissOnScrim = false;
  hass: any = null;

  private _opener: HTMLElement | null = null;
  private _focusRoot: Node | null = null;
  private _useHaDialog = false;
  private _closing = false;
  private _overlays: OverlayEntry[] = [];
  private readonly _titleId = `hp-dialog-title-${++dialogSequence}`;

  connectedCallback(): void {
    super.connectedCallback();
    this._opener = this._deepActiveElement();
    const root = this.getRootNode();
    this._focusRoot = root;
    const current = focusSessions.get(root);
    const session = current || { dialogs: new Set<HpDialog>(), opener: this._opener };
    session.dialogs.add(this);
    focusSessions.set(root, session);
    this._useHaDialog = !!customElements.get('ha-dialog');
    this.addEventListener('keydown', this._onKeyDown, true);
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this._onKeyDown, true);
    const overlays = [...this._overlays];
    this._overlays = [];
    for (const entry of overlays.reverse()) entry.close('disconnect');
    const root = this._focusRoot;
    const opener = this._opener;
    this._opener = null;
    this._focusRoot = null;
    const session = root ? focusSessions.get(root) : undefined;
    session?.dialogs.delete(this);
    super.disconnectedCallback();
    if (!root || !session) return;
    requestAnimationFrame(() => {
      const latest = focusSessions.get(root);
      if (!latest) return;
      if (!latest.dialogs.size) {
        if (latest.opener?.isConnected) latest.opener.focus({ preventScroll: true });
        focusSessions.delete(root);
        return;
      }
      // Closing a child dialog returns to its trigger inside the parent. A
      // dialog-to-dialog replacement intentionally waits for the last dialog,
      // then restores the original trigger outside the whole modal session.
      const owner = opener?.closest('hp-dialog') as HpDialog | null;
      if (opener?.isConnected && owner && latest.dialogs.has(owner)) {
        opener.focus({ preventScroll: true });
      }
    });
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (!this._useHaDialog) {
      const dialog = this.renderRoot.querySelector('dialog');
      if (dialog && !dialog.open) dialog.showModal();
    }
    queueMicrotask(() => this._focusInitial());
  }

  private _deepActiveElement(): HTMLElement | null {
    let active = document.activeElement as HTMLElement | null;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement as HTMLElement;
    return active && active !== document.body ? active : null;
  }

  private _focusableElements(): HTMLElement[] {
    const selector = [
      '[autofocus]',
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const out: HTMLElement[] = [];
    const seen = new Set<Node>();
    const visit = (node: Node): void => {
      if (seen.has(node)) return;
      seen.add(node);
      if (node instanceof HTMLElement) {
        if (node.matches(selector)) out.push(node);
        if (node instanceof HTMLSlotElement) {
          for (const assigned of node.assignedNodes({ flatten: true })) visit(assigned);
          return;
        }
        if (node.shadowRoot) {
          for (const child of node.shadowRoot.childNodes) visit(child);
          return;
        }
      }
      for (const child of node.childNodes) visit(child);
    };
    for (const child of this.childNodes) visit(child);
    const portal = this.overlayPortal();
    if (portal) visit(portal);
    return out.filter((el) => {
      let current: HTMLElement | null = el;
      while (current) {
        const style = getComputedStyle(current);
        if (current.hidden || current.inert || current.getAttribute('aria-hidden') === 'true'
            || style.display === 'none' || style.visibility === 'hidden') return false;
        current = current.assignedSlot
          || current.parentElement
          || (current.getRootNode() instanceof ShadowRoot
            ? (current.getRootNode() as ShadowRoot).host as HTMLElement
            : null);
        if (current === this) break;
      }
      return true;
    });
  }

  private _focusInitial = (): void => {
    const focusable = this._focusableElements();
    const autofocus = focusable.find((el) => el.hasAttribute('autofocus'));
    const target = autofocus || focusable[0]
      || (!this._useHaDialog ? this.renderRoot.querySelector<HTMLElement>('.close') : null)
      || this.renderRoot.querySelector<HTMLElement>('.surface')
      || this.renderRoot.querySelector<HTMLElement>('ha-dialog');
    target?.focus({ preventScroll: true });
  };

  private _requestClose = (): void => {
    if (this._closing) return;
    this._closing = true;
    this.dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  };

  private _pruneOverlays(): void {
    this._overlays = this._overlays.filter((entry) => entry.owner.isConnected);
  }

  private _closeOverlay(entry: OverlayEntry, reason: HpOverlayCloseReason): void {
    const index = this._overlays.findIndex((item) => item.token === entry.token);
    if (index >= 0) this._overlays.splice(index, 1);
    entry.close(reason);
  }

  public registerOverlay(registration: HpOverlayRegistration): () => void {
    this._pruneOverlays();
    const priorOwner = this._overlays.find((entry) => entry.owner === registration.owner);
    if (priorOwner) this._overlays.splice(this._overlays.indexOf(priorOwner), 1);
    const group = registration.group || 'transient';
    for (const entry of [...this._overlays].reverse()) {
      if (entry.group === group) this._closeOverlay(entry, 'exclusive');
    }
    const entry: OverlayEntry = { ...registration, group, token: Symbol('hp-overlay') };
    this._overlays.push(entry);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const index = this._overlays.findIndex((item) => item.token === entry.token);
      if (index >= 0) this._overlays.splice(index, 1);
    };
  }

  public closeTransientOverlays(reason: HpOverlayCloseReason = 'outside'): boolean {
    this._pruneOverlays();
    const entries = [...this._overlays].filter((entry) => (entry.group || 'transient') === 'transient');
    for (const entry of entries.reverse()) this._closeOverlay(entry, reason);
    return entries.length > 0;
  }

  public overlayPortal(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.overlay-portal');
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this._pruneOverlays();
      const overlay = this._overlays[this._overlays.length - 1];
      if (overlay) {
        this._closeOverlay(overlay, 'escape');
        return;
      }
      this._requestClose();
      return;
    }
    if (event.key !== 'Tab' || this._useHaDialog) return;
    const close = this.renderRoot.querySelector<HTMLElement>('.close');
    const focusable = close ? [close, ...this._focusableElements()] : this._focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      this.renderRoot.querySelector<HTMLElement>('.surface')?.focus({ preventScroll: true });
      return;
    }
    const active = this._deepActiveElement();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (active === first || !focusable.includes(active!))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  private _onFallbackCancel = (event: Event): void => {
    event.preventDefault();
    this._requestClose();
  };

  private _onFallbackClick = (event: MouseEvent): void => {
    if (this.dismissOnScrim && event.target === event.currentTarget) this._requestClose();
  };

  protected render() {
    const title = html`<span class="title" id=${this._titleId}>
      ${this.icon ? html`<ha-icon icon=${this.icon}></ha-icon>` : nothing}
      <span class="title-text">${this.title}</span>
    </span>`;

    if (this._useHaDialog) {
      return html`<ha-dialog
        .hass=${this.hass}
        .open=${true}
        width=${this.wide ? 'medium' : 'small'}
        .preventScrimClose=${!this.dismissOnScrim}
        .ariaLabelledBy=${this._titleId}
        @opened=${this._focusInitial}
        @closed=${this._requestClose}
      >
        <span class="header-title-slot" slot="headerTitle">${title}</span>
        <slot></slot>
        <span class="footer" slot="footer"><slot name="footer"></slot></span>
      </ha-dialog><div class="overlay-portal"></div>`;
    }

    return html`<dialog
      role="dialog"
      aria-modal="true"
      aria-labelledby=${this._titleId}
      @cancel=${this._onFallbackCancel}
      @click=${this._onFallbackClick}
    >
      <section class="surface" tabindex="-1">
        <header class="header">
          ${title}
          <button class="close" type="button"
            aria-label=${this.hass?.localize?.('ui.common.close') || 'Close'}
            @click=${this._requestClose}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="content"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </section>
      <div class="overlay-portal"></div>
    </dialog>`;
  }
}

if (!customElements.get('hp-dialog')) customElements.define('hp-dialog', HpDialog);

declare global {
  interface HTMLElementTagNameMap {
    'hp-dialog': HpDialog;
  }
}
