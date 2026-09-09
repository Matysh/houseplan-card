/** The #505 settings composition; included only in the lazy summary sheet. */
export const summaryPanelEditorCss = String.raw`
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
    max-height: none;
    padding: 14px 17px 18px;
    gap: 12px;
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    color: var(--primary-text-color);
    background: var(--summary-editor-muted);
    font-size: .875rem;
    line-height: 1.4;
  }
  .summary-editor *,
  .summary-editor-footer * { box-sizing: border-box; }
  .summary-editor h3 { margin: 0; font-size: 1rem; line-height: 1.3; }
  .summary-editor p { margin: 0; overflow-wrap: anywhere; }
  .summary-general,
  .summary-blocks-card {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 11px;
    background: var(--summary-editor-surface);
  }
  .summary-general-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 18px;
    margin-top: 12px;
  }
  .summary-general-grid:has(> .summary-switch:only-child) { grid-template-columns: minmax(0, 1fr); }
  .summary-editor .summary-field { min-width: 0; }
  .summary-editor .summary-field > label {
    display: block;
    margin: 0 0 5px;
    color: var(--secondary-text-color);
    font-size: .8125rem;
    font-weight: 600;
  }
  .summary-editor input[type='text'],
  .summary-editor input[type='search'],
  .summary-editor select {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    margin: 0;
    padding: 8px 10px;
    color: var(--primary-text-color);
    background: var(--summary-editor-surface);
    border: 1px solid var(--summary-editor-line);
    border-radius: 7px;
    font: inherit;
    font-size: .875rem;
    line-height: 1.4;
  }
  .summary-editor select { cursor: pointer; }
  .summary-editor [aria-invalid='true'] {
    border-color: var(--error-color, #db4437);
  }
  .summary-editor input:focus-visible,
  .summary-editor select:focus-visible,
  .summary-editor button:focus-visible,
  .summary-editor-footer button:focus-visible {
    outline: 2px solid var(--summary-editor-accent);
    outline-offset: 2px;
  }
  .summary-editor button { font: inherit; }
  .summary-editor button:disabled,
  .summary-editor input:disabled,
  .summary-editor select:disabled { opacity: .4; cursor: default; }
  .summary-editor svg { display: block; flex: 0 0 auto; width: 20px; height: 20px; }
  .summary-editor .summary-switch {
    display: flex;
    min-width: 0;
    min-height: 54px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    color: var(--primary-text-color);
    cursor: pointer;
  }
  .summary-switch-caption { display: grid; min-width: 0; gap: 3px; }
  .summary-switch-caption strong { font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .summary-switch-caption small { font-size: .8125rem; color: var(--secondary-text-color); overflow-wrap: anywhere; }
  /* The native checkbox itself is the visible 44px hit target. No hidden
     duplicate control or optimistic storage write is needed for the switch. */
  .summary-editor .summary-switch input {
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
  .summary-editor .summary-block-title { font-weight: 700; }
  .summary-order { display: grid; grid-template-columns: repeat(2, 44px); gap: 4px; }
  .summary-icon-button,
  .summary-drag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    min-width: 44px;
    height: 44px;
    padding: 0;
    color: var(--secondary-text-color);
    border: 1px solid var(--summary-editor-line);
    border-radius: 7px;
    background: var(--summary-editor-surface);
    cursor: pointer;
  }
  .summary-drag { border: 0; background: transparent; cursor: grab; user-select: none; }
  .summary-drag:active { cursor: grabbing; }
  .summary-drag[draggable='false'] { cursor: default; }
  .summary-icon-button:hover:not(:disabled) {
    color: var(--summary-editor-accent);
    border-color: var(--summary-editor-accent);
    background: var(--summary-editor-accent-soft);
  }
  .summary-visibility[aria-pressed='true'] {
    color: var(--summary-editor-accent);
    border-color: color-mix(in srgb, var(--summary-editor-line) 45%, var(--summary-editor-accent));
    background: var(--summary-editor-accent-soft);
  }
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
  .summary-source {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    color: var(--primary-text-color);
    text-align: left;
    border: 1px solid var(--summary-editor-line);
    border-radius: 7px;
    background: var(--summary-editor-surface);
    cursor: pointer;
  }
  .summary-source-caption { display: grid; min-width: 0; gap: 2px; }
  .summary-source-caption strong { font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .summary-source-caption small { color: var(--secondary-text-color); font-size: .75rem; overflow-wrap: anywhere; }
  .summary-editor .summary-value-remove {
    color: var(--error-color, #db4437);
    border-color: transparent;
    background: color-mix(in srgb, var(--summary-editor-surface) 94%, var(--error-color, #db4437));
  }
  .summary-editor .summary-value-remove:hover:not(:disabled) { border-color: var(--error-color, #db4437); }
  .summary-source-picker {
    min-width: 0;
    margin-top: 7px;
    padding: 10px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 10px;
    background: var(--summary-editor-surface);
    box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
  }
  .summary-editor .summary-source-picker > label {
    display: block;
    margin: 0 0 5px;
    font-size: .8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .summary-source-results {
    display: grid;
    max-height: min(360px, 48vh);
    margin-top: 8px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .summary-source-results button {
    display: grid;
    min-width: 0;
    min-height: 44px;
    padding: 7px 9px;
    align-content: center;
    color: var(--primary-text-color);
    text-align: left;
    overflow-wrap: anywhere;
    background: transparent;
    border: 0;
    border-radius: 7px;
    cursor: pointer;
  }
  .summary-source-results button:hover:not(:disabled),
  .summary-source-results button[aria-selected='true'] { background: var(--summary-editor-accent-soft); }
  .summary-source-results button.broken { color: var(--warning-color, #f59e0b); }
  .summary-source-results small { color: var(--secondary-text-color); font-size: .75rem; overflow-wrap: anywhere; }
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
  .summary-delete-block {
    min-width: 44px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, var(--summary-editor-line) 35%, var(--error-color, #db4437));
    border-radius: 7px;
    color: var(--error-color, #db4437);
    background: var(--summary-editor-surface);
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .summary-add {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 8px 12px;
    border: 1px dashed color-mix(in srgb, var(--summary-editor-line) 40%, var(--summary-editor-accent));
    border-radius: 8px;
    color: var(--summary-editor-accent);
    background: var(--summary-editor-accent-soft);
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .summary-editor .summary-add,
  .summary-editor .summary-delete-block { font-weight: 600; }
  .summary-add-value { width: 100%; }
  .summary-add-block { margin-top: 10px; }
  .summary-add:hover:not(:disabled) { border-style: solid; }
  .summary-delete-block:hover:not(:disabled) { background: color-mix(in srgb, var(--summary-editor-surface) 94%, var(--error-color, #db4437)); }
  .summary-reload { margin-top: 8px; min-height: 44px; white-space: normal; }
  hp-dialog[data-kind='summary'] .summary-editor-footer {
    min-height: 66px;
    padding: 11px 17px;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    border-top: 1px solid var(--summary-editor-line);
    background: var(--summary-editor-surface);
  }
  hp-dialog[data-kind='summary'] .summary-editor-footer button {
    min-width: 44px;
    min-height: 44px;
    height: auto;
    margin: 0;
    padding: 9px 14px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 8px;
    color: var(--primary-text-color);
    background: var(--summary-editor-surface);
    font-size: .875rem;
    line-height: 1.4;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  hp-dialog[data-kind='summary'] .summary-editor-footer button.on {
    border-color: var(--summary-editor-accent);
    color: var(--text-primary-color, #fff);
    background: var(--summary-editor-accent);
  }
  hp-dialog[data-kind='summary'] .summary-editor-footer button:disabled { opacity: .4; cursor: default; }
  @container summary-editor (max-width: 800px) {
    .summary-general-grid { grid-template-columns: minmax(0, 1fr); }
    .summary-editor-value { grid-template-columns: 44px 92px minmax(0, 1fr) 44px; }
    .summary-value-label { grid-column: 3; }
    .summary-source-field { grid-column: 3; }
    .summary-value-remove { grid-column: 4; grid-row: 1; }
    .summary-scope { grid-template-columns: minmax(0, 1fr); }
  }
  @container summary-editor (max-width: 480px) {
    .summary-general,
    .summary-blocks-card { padding: 10px; }
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
