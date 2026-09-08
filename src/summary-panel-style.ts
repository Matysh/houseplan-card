/** Lazy screen-space styles for the #437 summary surface and settings form. */
export const summaryPanelCss = String.raw`
  .summary-control {
    display: inline-flex;
    flex: 0 0 auto;
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    overflow: hidden;
    background: var(--card-background-color, #fff);
  }
  .summary-control > button {
    width: 46px;
    height: 46px;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-right: 1px solid var(--divider-color);
    color: var(--primary-text-color);
    background: transparent;
    cursor: pointer;
  }
  .summary-control > button:last-child { border-right: 0; }
  .summary-control > button.on {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color);
  }
  .summary-control > button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -3px;
  }
  .summary-control ha-icon { --mdc-icon-size: 21px; }
  .summary-control.kiosk {
    position: absolute;
    z-index: 31;
    top: calc(12px + env(safe-area-inset-top));
    right: calc(12px + env(safe-area-inset-right));
    box-shadow: 0 4px 14px rgb(0 0 0 / 22%);
  }
  .summary-overlay,
  .summary-measure {
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.35;
    color: var(--primary-text-color);
    background: color-mix(in srgb, var(--card-background-color, #fff) 94%, transparent);
    border: 1px solid var(--divider-color);
    border-radius: 16px;
    box-shadow: 0 8px 28px rgb(0 0 0 / 24%);
  }
  .summary-overlay {
    position: absolute;
    z-index: 24;
    display: flex;
    flex-direction: column;
    min-width: 280px;
    max-height: var(--summary-height-cap);
    overflow: hidden;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    pointer-events: auto;
    touch-action: pan-y;
  }
  .summary-overlay.right {
    top: var(--summary-top);
    right: calc(12px + env(safe-area-inset-right));
    bottom: var(--summary-bottom);
    width: clamp(280px, 31cqw, 420px);
    max-width: var(--summary-width-cap);
    animation: hp-summary-in-right 190ms ease-out;
  }
  .summary-overlay.bottom {
    right: auto;
    bottom: var(--summary-bottom);
    left: 50%;
    width: max-content;
    min-width: min(360px, var(--summary-width-cap));
    max-width: var(--summary-width-cap);
    transform: translateX(-50%);
    animation: hp-summary-in-bottom 190ms ease-out;
  }
  .summary-overlay h2,
  .summary-measure h2 {
    margin: 0;
    padding: 14px 16px 12px;
    font-size: 1.16em;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .summary-scroll {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0 10px 12px;
  }
  .summary-block,
  .summary-measure section {
    margin: 0 0 9px;
    padding: 10px;
    border-radius: 11px;
    background: var(--secondary-background-color);
  }
  .summary-block:last-child { margin-bottom: 0; }
  .summary-block h3,
  .summary-measure h3 {
    margin: 0 0 7px;
    font-size: 1em;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .summary-value {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(min-content, auto);
    gap: 10px;
    align-items: baseline;
    padding: 4px 0;
  }
  .summary-value span,
  .summary-value strong { min-width: 0; overflow-wrap: anywhere; }
  .summary-value strong { text-align: right; font-weight: 600; }
  .summary-empty { padding: 8px 0; color: var(--secondary-text-color); }
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
  .summary-measure section { margin: 0 10px 12px; }
  @keyframes hp-summary-in-right {
    from { opacity: 0; translate: 10px 0; }
    to { opacity: 1; translate: 0 0; }
  }
  @keyframes hp-summary-in-bottom {
    from { opacity: 0; translate: 0 10px; }
    to { opacity: 1; translate: 0 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .summary-overlay { animation: none; }
  }

  .summary-editor { min-width: min(640px, calc(100vw - 56px)); }
  .summary-editor > label:not(.summary-switch) {
    display: block;
    margin: 12px 0 5px;
    font-weight: 600;
  }
  .summary-editor input[type='text'],
  .summary-editor input[type='search'],
  .summary-editor select {
    box-sizing: border-box;
    min-width: 0;
    min-height: 44px;
    padding: 7px 9px;
    color: var(--primary-text-color);
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
  }
  .summary-editor input[type='text'],
  .summary-editor input[type='search'] { width: 100%; }
  .summary-editor [aria-invalid='true'] { border-color: var(--error-color, #db4437); }
  .summary-switch {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    gap: 8px;
    margin: 8px 0;
  }
  .summary-switch input { width: 18px; height: 18px; }
  .summary-editor input[type='range'] { min-height: 44px; }
  .summary-editor button,
  hp-dialog > .row[slot='footer'] button { min-height: 44px; }
  .summary-local-sizes {
    display: grid;
    grid-template-columns: max-content minmax(140px, 1fr) 48px;
    gap: 8px 14px;
    align-items: center;
  }
  .summary-sizes-title { margin: 14px 0 8px; font-size: 1em; }
  .summary-size-reset { grid-column: 1 / -1; justify-self: start; }
  .summary-editor-blocks { display: grid; gap: 12px; margin-top: 10px; }
  .summary-editor-block {
    padding: 12px;
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    background: var(--secondary-background-color);
  }
  .summary-editor-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
  .summary-block-head { flex-wrap: nowrap; }
  .summary-block-head input { flex: 1 1 180px; }
  .summary-editor-row button {
    min-width: 44px;
    height: 44px;
    padding: 0 7px;
    border: 0;
    border-radius: 7px;
    color: var(--primary-text-color);
    background: var(--card-background-color, #fff);
    cursor: pointer;
  }
  .summary-editor-row button:disabled { opacity: .4; cursor: default; }
  .summary-drag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 44px;
    color: var(--secondary-text-color);
    cursor: grab;
    letter-spacing: -4px;
  }
  .summary-editor-values { display: grid; gap: 8px; margin-top: 10px; }
  .summary-editor-value { padding-top: 8px; border-top: 1px solid var(--divider-color); }
  .summary-editor-value input { flex: 1 1 180px; }
  .summary-source { width: 100%; margin-top: 7px; }
  .summary-problem { margin: 5px 0; font-size: .9em; }
  .summary-problem.error { color: var(--error-color, #db4437); }
  .summary-problem.warning { color: var(--warning-color, #f59e0b); }
  .summary-add { margin-top: 9px; }
  .summary-reload { margin-top: 8px; }
  @media (max-width: 600px) {
    .summary-editor { min-width: 0; width: calc(100vw - 44px); }
    .summary-block-head { flex-wrap: wrap; }
    .summary-block-head input { order: -1; flex-basis: 100%; }
  }`;
