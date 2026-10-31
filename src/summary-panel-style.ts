import { css } from 'lit';
import { summaryPanelEditorCss } from './summary-panel-editor-style';

/** Lazy screen-space styles. The stage, not the viewport, chooses the anchor. */
export const summaryPanelCss = `
  ${css`
  .summary-overlay {
    position: absolute;
    z-index: 24;
    display: flex;
    flex-direction: column;
    height: fit-content;
    max-height: var(--summary-height-cap);
    overflow: hidden;
    pointer-events: auto;
    touch-action: pan-y;
  }
  .summary-overlay[inert] { pointer-events: none; }
  .summary-overlay.right {
    top: var(--summary-top);
    right: calc(12px + env(safe-area-inset-right));
    bottom: auto;
    width: max-content;
    min-width: min(280px, var(--summary-width-cap));
    max-width: min(420px, var(--summary-width-cap));
  }
  .summary-overlay.bottom {
    right: auto;
    bottom: var(--summary-bottom);
    left: 50%;
    width: max-content;
    min-width: min(360px, var(--summary-width-cap));
    max-width: var(--summary-width-cap);
    transform: translateX(-50%);
  }
  .summary-block { margin:0 0 9px; }
  .summary-block:last-child { margin-bottom:0; }
  .summary-value { margin:0 11px; }
  .summary-measure {
    position: fixed;
    z-index: -1;
    top: -10000px;
    left: -10000px;
    width: 280px;
    visibility: hidden;
    pointer-events: none;
  }
  .summary-safe-probe {
    position: fixed;
    z-index: -1;
    top: -10000px;
    left: -10000px;
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
      env(safe-area-inset-bottom) env(safe-area-inset-left);
    visibility: hidden;
    pointer-events: none;
  }
`.cssText}
  ${summaryPanelEditorCss}
`;
