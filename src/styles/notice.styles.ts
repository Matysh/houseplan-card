import { css, unsafeCSS } from 'lit';
import { settingsActionsCss } from './settings-action.styles';

/** One notice surface in the card and in its actual modal toast portals. */
export const noticeStyles = unsafeCSS(css`
  .hpf-notice {
    box-sizing: border-box;
    padding: 12px 14px;
    border: 1px solid var(--hpf-accent, var(--primary-color, #03a9f4));
    border-radius: 10px;
    background: var(--hpf-surface, var(--card-background-color, #202126));
    color: var(--primary-text-color, #e6e7eb);
    box-shadow: var(--shadow-2, 0 8px 24px #0004);
    font: inherit;
    font-size: var(--fs-m, 13px);
    line-height: 1.4;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .hpf-notice-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .hpf-notice-muted { color: var(--secondary-text-color, #8aa0b3); }
  .hpf-notice-icon { flex: none; color: var(--hpf-accent, var(--primary-color, #03a9f4)); }
`.cssText + settingsActionsCss('.hpf-notice .btn'));
