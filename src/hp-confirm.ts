import { LitElement, html, type PropertyValues } from 'lit';

import './hp-dialog';
import type { HpConfirmDecision, HpConfirmRequest } from './danger-confirm';
import { prepareDialogReturnFocus } from './dialog-return-focus';

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

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('request') && !changed.has('token')) return;
    if (!this.request?.key.startsWith('discard-')) return;
    // Keep safe cancel autofocus; suppress only its automatic paint until the
    // next real input/blur, just like focus returned from a closed dialog.
    const button = this.querySelector<HTMLButtonElement>('[autofocus]');
    prepareDialogReturnFocus(button);
  }

  protected render() {
    const request = this.request;
    if (!request) return null;
    const destructive = request.kind === 'destructive';
    const descriptionId = `hp-confirm-description-${this.token}`;
    const discard = request.key.startsWith('discard-');
    const compact = request.key.startsWith('remove-marker');
    return html`<hp-dialog class=${`danger-confirm-dialog${discard ? ' discard-confirm-dialog' : ''}${compact ? ' ui-dialog' : ''}`} data-kind="confirm"
      ?form-shell=${compact} ?settings-layout=${compact} ?compact=${compact} ?wide=${compact}
      .hass=${this.hass}
      .title=${request.title}
      .alert=${true}
      .describedBy=${descriptionId}
      .icon=${request.icon || (destructive
        ? 'mdi:alert-outline' : 'mdi:lock-open-alert-outline')}
      dismiss-on-scrim
      @hp-close=${() => this._decide(false)}>
        <div id=${descriptionId} class="body danger-confirm-body" data-confirm-key=${request.key}>
          ${request.objectName
            ? html`<strong class="danger-confirm-object">${request.objectName}</strong>`
            : null}
          <p>${request.message}</p>
        </div>
        <div class=${`row dialog-action-footer danger-confirm-footer${compact ? ' hpf-footer' : ''}`} slot="footer">
          <span class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" type="button" autofocus data-hp="dialog-cancel"
              @click=${() => this._decide(false)}>${request.cancelLabel}</button>
            <button class="btn ${destructive ? 'danger' : 'on'}" type="button"
              data-hp="dialog-confirm"
              @click=${() => this._decide(true)}>
              <ha-icon icon=${request.confirmIcon || (destructive
                ? 'mdi:trash-can-outline' : 'mdi:lock-open-variant')}></ha-icon>
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
