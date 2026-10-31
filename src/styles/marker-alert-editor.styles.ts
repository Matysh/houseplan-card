/** Approved 9db1e66f table/constructor geometry, editor-only. */
export const markerAlertEditorCss = `
    [data-settings-section="alarms"] .alarm-heading {display:flex;align-items:center;justify-content:space-between;gap:12px}
    [data-settings-section="alarms"] .alarm-heading h3 {margin:0}
    [data-settings-section="alarms"] .alarm-table .alarm-empty {height:150px;text-align:center}
    [data-settings-section="alarms"] .alarm-empty-content {display:grid;justify-items:center;gap:14px}
    [data-settings-section="alarms"] .alarm-condition {display:grid;gap:4px}
    [data-settings-section="alarms"] .alarm-condition small {overflow-wrap:anywhere}
    hp-dialog[data-kind="alarm-constructor"] .alarm-source-field {grid-column:1/-1}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome {display:grid;gap:8px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome-heading {display:flex;align-items:center;gap:8px;line-height:20px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome-heading ha-icon {display:inline-flex;align-items:center;flex:none;margin:0;--mdc-icon-size:16px;color:var(--hpf-accent)}

.alarm-condition > span{white-space:pre-wrap;}
`;
