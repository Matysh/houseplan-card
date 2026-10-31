


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
  }
  .summary-editor *,
  .summary-editor-footer * { box-sizing: border-box; }
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
    overflow-wrap: anywhere;
  }
  .summary-editor-blocks { display: grid; min-width: 0; gap: 10px; }
  .summary-editor-block {
    min-width: 0;
  }
  .summary-block-head {
    display: grid;
    grid-template-columns: 44px 92px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px;

    border-radius: 10px 10px 0 0;
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
  }
  .summary-value-label,
  .summary-source-field { min-width: 0; }
  .summary-source-picker {
    min-width: 0;
    margin-top: 7px;
  }
  .summary-source-results {
    display: grid;
    max-height: min(360px, 48vh);
    margin-top: 8px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .summary-source-group { margin:9px 8px 4px; }
  .summary-refine { margin:9px; }
  .summary-problem { margin:5px 0; overflow-wrap:anywhere; }
  .summary-block-footer { display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 9px;  }
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

