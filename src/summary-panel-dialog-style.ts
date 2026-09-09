/** Installed into this summary dialog's shadow root by the lazy runtime.
 * Keeping even the scoped shell CSS lazy preserves the initial View budget. */
export const summaryPanelDialogCss = String.raw`
    /* #505: the summary form follows its own neutral, wide design. Keep
       every override scoped so the other editor/dialog surfaces stay intact. */
    :host([data-kind='summary']) ha-dialog {
      --ha-dialog-surface-background: var(--card-background-color, #fff);
      --ha-dialog-border-radius: 15px;
      --ha-icon-button-size: 44px;
      --dialog-box-shadow: inset 0 0 0 1px var(--divider-color, #dce5e7),
        0 18px 60px rgb(25 34 38 / 26%);
    }

    :host([data-kind='summary']) .surface {
      border: 1px solid var(--divider-color, #dce5e7);
      border-radius: 15px;
      box-shadow: 0 18px 60px rgb(25 34 38 / 26%);
    }

    :host([data-kind='summary']) .header {
      min-height: 70px;
      flex-shrink: 0;
      padding: 12px 17px;
      border-color: var(--divider-color, #dce5e7);
    }

    :host([data-kind='summary']) .title {
      font-size: 1.375rem;
      font-weight: 600;
    }

    :host([data-kind='summary']) .close {
      width: 44px;
      height: 44px;
      border-radius: 8px;
    }

    :host([data-kind='summary']) .content { flex: 1 1 auto; }
    :host([data-kind='summary']) .footer { flex-shrink: 0; }
`;
