import { LitElement, html } from 'lit';

import './hp-dialog';
import type { HpConfirmDecision, HpConfirmRequest } from './danger-confirm';

/** Presentation-only confirmation surface; state and mutations stay in the card. */
export class HpConfirm extends LitElement {
  static properties = {
    hass: { attribute: false },
    request: { attribute: false },
    token: { type: Number },
  };

  hass: unknown = null;
  request: Readonly<HpConfirmRequest> | null = null;
  token = 0;

  // Keep the dialog in the card's shadow tree so the shared .btn/.row tokens
  // apply without duplicating the entire dialog stylesheet in the eager graph.
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _decide(accepted: boolean): void {
    this.dispatchEvent(new CustomEvent<HpConfirmDecision>('hp-confirm-decision', {
      detail: { token: this.token, accepted },
      bubbles: true,
      composed: true,
    }));
  }

  protected render() {
    const request = this.request;
    if (!request) return null;
    const destructive = request.kind === 'destructive';
    return html`<hp-dialog class="danger-confirm-dialog"
      .hass=${this.hass}
      .title=${request.title}
      .icon=${request.icon || (destructive
        ? 'mdi:alert-outline' : 'mdi:lock-open-alert-outline')}
      dismiss-on-scrim
      @hp-close=${() => this._decide(false)}>
        <div class="body danger-confirm-body" data-confirm-key=${request.key}>
          ${request.objectName
            ? html`<strong class="danger-confirm-object">${request.objectName}</strong>`
            : null}
          <p>${request.message}</p>
        </div>
        <div class="row dialog-action-footer danger-confirm-footer" slot="footer">
          <span class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" type="button" autofocus
              @click=${() => this._decide(false)}>${request.cancelLabel}</button>
            <button class="btn ${destructive ? 'danger' : 'on'}" type="button"
              @click=${() => this._decide(true)}>
              <ha-icon icon=${destructive
                ? 'mdi:trash-can-outline' : 'mdi:lock-open-variant'}></ha-icon>
              ${request.confirmLabel}
            </button>
          </span>
        </div>
    </hp-dialog>`;
  }
}

if (!customElements.get('hp-confirm')) customElements.define('hp-confirm', HpConfirm);

declare global {
  interface HTMLElementTagNameMap {
    'hp-confirm': HpConfirm;
  }
}
