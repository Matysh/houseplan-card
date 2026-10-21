/** #1002 UI-015: one separator/spacing owner, confined to the vacuum profile. */
export const vacuumSettingsCss = `
.vacuum-profile{--vacuum-section-space:18px;min-width:0;}
.vacuum-profile [data-card=vacuum] > .hpf-head{display:block;margin-bottom:0;}
.vacuum-profile .vacuum-source-status{margin-top:6px;color:var(--secondary-text-color);font-size:13px;line-height:1.4;font-weight:400;}
.vacuum-profile .hpf-body{gap:0;}
.vacuum-profile .hpf-body > :is(.hpf-field,.hpf-toggle,.vacuum-trail-color,.vacbtns,.hpf-profile-maproutes,.hpf-profile-diagnostics){margin:0;padding:var(--vacuum-section-space) 0;border-top:1px solid var(--hpf-line,var(--divider-color));}
.vacuum-profile .hpf-body > .hpf-field:first-child{border-top:0;}
.vacuum-profile .hpf-body > .hpf-sub{margin:0;padding:var(--vacuum-section-space) 0 0;border-top:1px solid var(--hpf-line,var(--divider-color));}
.hpf-settings-pane .vacuum-profile .hpf-body > .vacuum-source-controls{display:flex;align-items:flex-start;gap:8px;margin:0;padding:12px 0 var(--vacuum-section-space);border:0;min-width:0;}
.vacuum-profile .vacuum-source-controls > .vacpicker{margin:0;min-width:0;}
.vacuum-profile .vacuum-source-controls > .vacpicker > summary{margin:0;width:max-content;max-width:100%;}
.vacuum-profile .vacuum-source-controls > hp-help{flex:none;margin-top:11px;}
.vacuum-profile .hpf-toggle:has(.hpf-toggle-caption) > input[type=checkbox]{margin-block:-11px;}
.vacuum-profile .vacuum-trail-color{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.vacuum-profile .vacuum-trail-color > span:first-child{font-weight:500;}
.vacuum-profile .vacuum-trail-color hp-color-opacity{flex:none;}
.vacuum-profile .vacuum-trail-readout{color:var(--secondary-text-color);font-size:12px;overflow-wrap:anywhere;}
.vacuum-profile .hpf-profile-maproutes > .hpf-sub{margin:0 0 16px;}
.vacuum-profile .vacroutes{display:grid;gap:16px;border:0;margin:0;padding:0;min-width:0;}
.vacuum-profile .vacroutes > .vacdiag{margin:0;padding:0;}
.vacuum-profile .vacuum-map-summary{margin:0;color:var(--secondary-text-color);line-height:1.5;white-space:normal;}
.vacuum-profile .vacroute-list{display:grid;gap:12px;list-style:none;margin:0;padding:0;}
.vacuum-profile .vacroute{display:grid;gap:12px;min-width:0;margin:0;padding:16px;border:1px solid var(--divider-color);border-radius:12px;}
.vacuum-profile .vacroute-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.vacuum-profile .vacroute-active{color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 12%,transparent);padding:3px 8px;border-radius:6px;font-size:12px;}
.vacuum-profile .vacroute > small{overflow-wrap:anywhere;color:var(--secondary-text-color);}
.vacuum-profile .vacroute-status{font-size:12px;color:var(--secondary-text-color);}
.vacuum-profile .vacroute .srcrow{display:grid;gap:8px;margin:0;align-items:center;}
.vacuum-profile .vacroute .srcrow > hp-settings-select{min-width:0;width:100%;}
.vacuum-profile .vacroute .srcrow select{width:100%;}
.vacuum-profile .vacroute > .vacbtns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;}
.vacuum-profile .vacroute .vacbtns > button{width:100%;min-width:0;justify-content:center;margin:0;}
.vacuum-profile .vacuum-add-current{display:flex;margin:0;}
.vacuum-profile .vacuum-add-current > button{width:100%;justify-content:center;margin:0;}
.vacuum-profile .vacuum-map-note{margin:0;color:var(--secondary-text-color);font-size:12px;line-height:1.5;}
.vacuum-profile .vacuum-add-reason{margin-top:-8px;}
.vacuum-profile :is(.vacroute-sources,.hpf-profile-diagnostics) > summary{display:list-item;list-style-position:inside;min-height:44px;box-sizing:border-box;padding:10px 0;cursor:pointer;color:var(--secondary-text-color);font-weight:500;transition:color 160ms ease;}
.vacuum-profile .vacroute-sources{border-block:1px solid var(--divider-color);padding-block:6px;}
.vacuum-profile :is(.vacroute-sources,.hpf-profile-diagnostics) > summary:hover{color:var(--primary-text-color);}
.vacuum-profile :is(.vacroute-sources,.hpf-profile-diagnostics) > summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px;}
.vacuum-profile .vacroute-sources > .rhint{margin:6px 0 12px;line-height:1.5;}
.vacuum-profile .vacsource-list{display:grid;gap:8px;}
.vacuum-profile .vacsource-list > button{width:100%;text-align:left;padding:12px;}
.vacuum-profile .hpf-profile-diagnostics > .vacdiag{display:grid;gap:0;padding-top:8px;}
.vacuum-profile .hpf-profile-diagnostics .vacdiag > div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:14px;padding:10px 0;border-bottom:1px solid var(--divider-color);align-items:start;}
.vacuum-profile .hpf-profile-diagnostics .vacdiag > div > b{text-align:right;overflow-wrap:anywhere;font-weight:400;}
@media(max-width:480px){.vacuum-profile .vacroute{padding:12px;}.vacuum-profile .vacroute > .vacbtns{grid-template-columns:1fr;}.vacuum-profile .hpf-profile-diagnostics .vacdiag > div{grid-template-columns:1fr;gap:4px;}.vacuum-profile .hpf-profile-diagnostics .vacdiag > div > b{text-align:left;}}
@media(prefers-reduced-motion:reduce){.vacuum-profile summary{transition:none;}}
`;
