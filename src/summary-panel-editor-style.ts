import { SUMMARY_PANEL_FORM_KIT, formKitSwitchRowCss, formKitSwitchCaptionCss } from './styles/form-kit.styles';


/** Summary content layout; dialog and controls are owned by UI Kit. */
export const summaryPanelEditorCss = `
  hp-dialog[data-kind='summary'] {
    --hp-dialog-wide-width: 920px;
    --ha-dialog-width-md: 920px;
    --summary-editor-surface: var(--card-background-color, #fff);
    --summary-editor-muted: color-mix(in srgb, var(--summary-editor-surface) 96%, var(--primary-text-color, #303638));
    --summary-editor-line: var(--divider-color, #dce5e7);
    --summary-editor-accent: var(--primary-color, var(--hp-accent));
    --summary-editor-accent-soft: color-mix(in srgb, var(--summary-editor-surface) 94%, var(--summary-editor-accent));
  }
  hp-dialog[data-kind='summary'] .summary-editor {
    box-sizing: border-box;
    container: summary-editor / inline-size;
    width: 100%;
    min-width: 0;
    min-height: 0;
    grid-auto-rows: max-content;
    max-height: none;
    gap: 12px;
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    color: var(--primary-text-color);
    background: var(--hpf-surface);
    font-size: 13px;
    line-height: 1.5;
  }
  .summary-editor *,
  .summary-editor-footer * { box-sizing: border-box; }
  .summary-editor h3 { margin: 0; font-size: 1rem; line-height: 1.3; }
  .summary-editor p { margin: 0; overflow-wrap: anywhere; }
  .summary-general-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 18px;
    margin-top: 12px;
  }
  .summary-general-grid:has(> .summary-switch:only-child) { grid-template-columns: minmax(0, 1fr); }
  .summary-editor .summary-field { min-width: 0; }
  .summary-editor svg { display: block; flex: 0 0 auto; width: 20px; height: 20px; }
${formKitSwitchRowCss(SUMMARY_PANEL_FORM_KIT)}
${formKitSwitchCaptionCss(SUMMARY_PANEL_FORM_KIT)}
  /* The native checkbox itself is the visible 44px hit target. No hidden
     duplicate control or optimistic storage write is needed for the switch. */
  hp-dialog[data-kind='summary'].ui-dialog .summary-switch input[type='checkbox'] {
    appearance: none;
    position: relative;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .summary-switch input::before {
    content: '';
    position: absolute;
    width: 36px;
    height: 22px;
    inset: 11px 4px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 12px;
    background: color-mix(in srgb, var(--summary-editor-surface) 65%, var(--secondary-text-color));
  }
  .summary-switch input::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    top: 14px;
    left: 7px;
    border-radius: 50%;
    background: var(--text-primary-color, #fff);
    box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  }
  .summary-switch input:checked::before {
    background: var(--summary-editor-accent);
    border-color: var(--summary-editor-accent);
  }
  .summary-switch input:checked::after { left: 21px; }
  .summary-switch:has(input:disabled) { cursor: default; }
  .summary-switch:has(input:disabled) .summary-switch-caption { opacity: .6; }
  .summary-blocks-heading {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  .summary-blocks-heading > div { min-width: 0; flex: 1 1 220px; }
  .summary-blocks-heading p { margin-top: 4px; color: var(--secondary-text-color); font-size: .8125rem; }
  .summary-block-count {
    padding: 4px 8px;
    border-radius: 10px;
    color: var(--primary-text-color);
    background: var(--summary-editor-accent-soft);
    font-size: .75rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .summary-editor-blocks { display: grid; min-width: 0; gap: 10px; }
  .summary-editor-block {
    min-width: 0;
    border: 1px solid var(--summary-editor-line);
    border-radius: 10px;
    background: var(--summary-editor-muted);
  }
  .summary-block-head {
    display: grid;
    grid-template-columns: 44px 92px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px;
    border-bottom: 1px solid var(--summary-editor-line);
    border-radius: 10px 10px 0 0;
    background: var(--summary-editor-surface);
  }
  .summary-drag { display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; cursor:grab; user-select:none; }
  .summary-drag:active { cursor:grabbing; }
  .summary-drag[draggable=false] { cursor:default; }
  .summary-order { display: grid; grid-template-columns: repeat(2, 44px); gap: 4px; }
  .summary-scope {
    display: grid;
    grid-column: 3 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }
  .summary-scope > select:only-child { grid-column: 1 / -1; }
  .summary-block-title-error,
  .summary-scope-problem { grid-column: 3 / -1; }
  .summary-block-body { min-width: 0; padding: 10px; }
  .summary-editor-values { display: grid; min-width: 0; gap: 7px; }
  .summary-editor-value {
    display: grid;
    grid-template-columns: 44px 92px minmax(0, .9fr) minmax(0, 1.2fr) 44px;
    align-items: start;
    min-width: 0;
    padding: 5px;
    gap: 7px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 8px;
    background: var(--summary-editor-surface);
  }
  .summary-value-label,
  .summary-source-field { min-width: 0; }
  .summary-source-picker {
    min-width: 0;
    margin-top: 7px;
    padding: 10px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 10px;
    background: var(--summary-editor-surface);
    box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
  }
  .summary-source-results {
    display: grid;
    max-height: min(360px, 48vh);
    margin-top: 8px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .summary-source-group {
    padding: 9px 8px 4px;
    color: var(--secondary-text-color);
    font-size: .8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .summary-refine { padding: 9px; color: var(--secondary-text-color); overflow-wrap: anywhere; }
  .summary-problem { margin: 5px 0; font-size: .8125rem; overflow-wrap: anywhere; }
  .summary-problem.error { color: var(--error-color, #db4437); }
  .summary-problem.warning { color: var(--warning-color, #f59e0b); }
  .summary-local-hint { color: var(--secondary-text-color); }
  .summary-block-footer { display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--summary-editor-line); }
  .summary-add-block { margin-top:10px; }
  .summary-reload { margin-top:8px; }
  @container summary-editor (max-width: 800px) {
    .summary-general-grid { grid-template-columns: minmax(0, 1fr); }
    .summary-editor-value { grid-template-columns: 44px 92px minmax(0, 1fr) 44px; }
    .summary-value-label { grid-column: 3; }
    .summary-source-field { grid-column: 3; }
    .summary-value-remove { grid-column: 4; grid-row: 1; }
    .summary-scope { grid-template-columns: minmax(0, 1fr); }
  }
  @container summary-editor (max-width: 480px) {
    .summary-block-head { grid-template-columns: 44px minmax(0, 1fr) 44px; }
    .summary-block-head > .summary-order { grid-column: 2; }
    .summary-block-title { grid-column: 1 / 3; grid-row: 2; }
    .summary-visibility { grid-column: 3; grid-row: 2; }
    .summary-scope,
    .summary-block-title-error,
    .summary-scope-problem { grid-column: 1 / -1; }
    .summary-editor-value { grid-template-columns: 44px minmax(0, 1fr) 44px; }
    .summary-editor-value > .summary-order { grid-column: 2; }
    .summary-value-label { grid-column: 1 / -1; grid-row: 2; }
    .summary-source-field { grid-column: 1 / -1; grid-row: 3; }
    .summary-value-remove { grid-column: 3; grid-row: 1; }
  }
`;

