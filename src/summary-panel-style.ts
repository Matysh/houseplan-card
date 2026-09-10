import { summaryPanelEditorCss } from './summary-panel-editor-style';

/** Lazy screen-space styles. The stage, not the viewport, chooses the anchor. */
export const summaryPanelCss = String.raw`
  .summary-control {
    display: inline-flex;
    flex: 0 0 auto;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
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
    transition: background-color 160ms ease;
  }
  .summary-control > button:last-child { border-right: 0; }
  .summary-control > button:hover { background: var(--secondary-background-color); }
  .summary-control > button.on {
    color: var(--text-primary-color, #fff);
    background: var(--primary-color);
  }
  .summary-control > button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -3px;
  }
  svg.summary-icon {
    display: block;
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    fill: none;
  }
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
    font-size: .875rem;
    line-height: 1.35;
    color: var(--primary-text-color);
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    box-shadow: 0 8px 26px rgb(0 0 0 / 16%);
  }
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
  .summary-overlay h2,
  .summary-measure h2 {
    box-sizing: border-box;
    flex: 0 0 auto;
    min-height: 48px;
    margin: 0;
    padding: 14px;
    font-size: 1rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
    background: var(--card-background-color, #fff);
    border-bottom: 1px solid var(--divider-color);
  }
  .summary-scroll {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px;
  }
  .summary-block {
    min-width: 0;
    margin: 0 0 9px;
    border: 1px solid var(--divider-color);
    border-radius: 11px;
    background: var(--card-background-color, #fff);
  }
  .summary-block:last-child { margin-bottom: 0; }
  .summary-block h3 {
    box-sizing: border-box;
    min-height: 43px;
    margin: 0;
    padding: 12px 14px;
    border-bottom: 1px solid var(--divider-color);
    font-size: .875rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .summary-value {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    gap: 10px;
    align-items: baseline;
    min-height: 36px;
    margin: 0 11px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color);
  }
  .summary-value:last-child { border-bottom: 0; }
  .summary-value span,
  .summary-value strong { min-width: 0; overflow-wrap: anywhere; }
  .summary-value span { color: var(--secondary-text-color); }
  .summary-value strong { text-align: right; font-weight: 700; }
  /* Значение появляется плавно, а не скачком после скелета (#509). */
  .summary-value strong:not(.summary-value-pending) { animation: summary-value-in 140ms ease both; }
  /* Скелет: прямоугольник в высоту строки на месте значения. Плашка, сетка и
     высота строки те же, что с готовым значением, — панель не прыгает. */
  .summary-value-pending {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 1.2em;
  }
  .summary-value-pending i {
    display: block;
    width: 4.5em;
    max-width: 100%;
    height: 1.2em;
    border-radius: 5px;
    background: var(--secondary-text-color, #7a7f87);
    opacity: 0.18;
    animation: summary-skeleton-pulse 1200ms ease-in-out infinite;
  }
  @keyframes summary-skeleton-pulse {
    0%, 100% { opacity: 0.12; }
    50% { opacity: 0.28; }
  }
  @keyframes summary-value-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    /* Прямоугольник остаётся — исчезает только моторика (#509). */
    .summary-value-pending i { animation: none; opacity: 0.18; }
    .summary-value strong:not(.summary-value-pending) { animation: none; }
  }
  .summary-empty { margin: 0; padding: 10px 11px; color: var(--secondary-text-color); }
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
  @media (prefers-reduced-motion: reduce) {
    .summary-control > button { transition: none; }
  }
  ${summaryPanelEditorCss}
`;
