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
  hp-summary-weather { display:block; }
  .summary-weather { margin-top:12px; }
  .summary-scroll > hp-summary-weather:first-child .summary-weather { margin-top:0; }
  .summary-weather-now { display:flex; align-items:center; gap:10px; margin:0 0 12px; }
  .summary-weather-now > ha-icon { --mdc-icon-size:36px; color:var(--primary-color); }
  .summary-weather-now > strong { font-size:32px; font-weight:500; line-height:1.2; white-space:nowrap; }
  .summary-weather-now > span { color:var(--secondary-text-color); font-size:var(--fs-m,12px); }
  .summary-weather-meta { display:grid; gap:5px; font-size:var(--fs-m,12px); }
  .summary-weather-forecast { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:0; padding-top:12px; }
  .summary-weather-forecast > div { display:flex; flex-direction:column; align-items:center; gap:5px; font-size:var(--fs-m,12px); }
  .summary-weather-forecast ha-icon { --mdc-icon-size:24px; color:var(--secondary-text-color); }
  .summary-weather-forecast small { color:var(--secondary-text-color); }
  .summary-weather-settings { padding-top:14px; margin-top:14px; }
  .summary-weather-setting-row { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  .summary-weather-setting-row > hp-settings-select { flex:1; min-width:min(220px,100%); }
  .summary-weather-setting-row > .hpf-check { flex-shrink:0; }
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
