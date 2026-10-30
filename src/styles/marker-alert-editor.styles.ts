/** Approved 9db1e66f table/constructor geometry, editor-only. */
export const markerAlertEditorCss = `
    [data-settings-section="alarms"] .alarm-heading {display:flex;align-items:center;justify-content:space-between;gap:12px}
    [data-settings-section="alarms"] .alarm-heading h3 {margin:0}
    [data-settings-section="alarms"] .alarm-add {display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;padding:0;border:1px dashed var(--hpf-tint-line,var(--primary-color));border-radius:8px;color:var(--hpf-accent,var(--primary-color));background:var(--hpf-tint,transparent);cursor:pointer}
    [data-settings-section="alarms"] .alarm-add ha-icon {--mdc-icon-size:22px}
    [data-settings-section="alarms"] .alarm-table {width:100%;border-collapse:collapse;font-size:14px}
    [data-settings-section="alarms"] .alarm-table th {padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:var(--secondary-text-color);border-bottom:1px solid var(--hpf-line,var(--divider-color))}
    [data-settings-section="alarms"] .alarm-table td {padding:12px;border-bottom:1px solid var(--hpf-line,var(--divider-color));vertical-align:middle}
    [data-settings-section="alarms"] .alarm-table tr:last-child td {border-bottom:0}
    [data-settings-section="alarms"] .alarm-table .alarm-empty {height:150px;text-align:center;color:var(--secondary-text-color)}
    [data-settings-section="alarms"] .alarm-empty-content {display:grid;justify-items:center;gap:14px}
    [data-settings-section="alarms"] .alarm-create {padding:8px 16px}
    [data-settings-section="alarms"] .alarm-condition {display:grid;gap:4px}
    [data-settings-section="alarms"] .alarm-condition small {font-size:12px;color:var(--secondary-text-color);overflow-wrap:anywhere}
    [data-settings-section="alarms"] .alarm-remove {display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--error-color,#db4437);cursor:pointer}
    [data-settings-section="alarms"] .alarm-remove:hover {background:color-mix(in srgb,var(--error-color,#db4437) 10%,transparent)}
    [data-settings-section="alarms"] .alarm-remove ha-icon {--mdc-icon-size:19px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-source-field {grid-column:1/-1}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome {display:grid;gap:8px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome-heading {display:flex;align-items:center;gap:8px;line-height:20px}
    hp-dialog[data-kind="alarm-constructor"] .alarm-outcome-heading ha-icon {display:inline-flex;align-items:center;flex:none;margin:0;--mdc-icon-size:16px;color:var(--hpf-accent)}

.alarm-condition-edit{display:block;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer;}
.alarm-condition-edit:hover{text-decoration:underline;}
.alarm-condition > span{white-space:pre-wrap;}
`;
