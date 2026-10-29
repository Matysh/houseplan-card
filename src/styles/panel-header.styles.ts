import { css } from 'lit';

export const panelHeaderStyles = css`
/* #1132: the main panel shares the outlined 44px action treatment. */
:host([panel-host]) .hdr .head > .tabs,
:host([panel-host]) .hdr .head > .modes { padding:0; background:transparent; align-items:center; }
:host([panel-host]) .hdr .head > .tabs { gap:10px; }
:host([panel-host]) .hdr .tabs .tab {
  box-sizing:border-box; height:44px; min-height:44px; padding:0; gap:0;
  border:1px solid var(--hp-line); border-radius:var(--rad-m);
  background:transparent; color:var(--hp-txt); position:relative;
  transition:border-color 140ms ease,color 140ms ease;
}
:host([panel-host]) .hdr .tabs .tabtitle { padding-inline:12px; line-height:42px; }
:host([panel-host]) .hdr .tabs .tab > .tabedit {
  box-sizing:border-box; width:44px; height:42px; min-width:44px; margin:0;
  border-inline-start:1px solid var(--hp-line);
  border-radius:0 calc(var(--rad-m) - 1px) calc(var(--rad-m) - 1px) 0;
  justify-content:center; opacity:1; --mdc-icon-size:20px;
}
:host([panel-host]) .hdr .tabs .tab.active { border-color:var(--hp-accent); }
:host([panel-host]) .hdr .tabs .tabadd,
:host([panel-host]) .hdr .tabs .compact-space-settings { width:44px; min-width:44px; justify-content:center; --mdc-icon-size:20px; }
:host([panel-host]) .hdr .tabs .tabadd ha-icon { --mdc-icon-size:20px; }
:host([panel-host]) .hdr .head > .tabs.compact-spaces { gap:0; }
:host([panel-host]) .hdr .compact-space-select::part(control) {
  box-sizing:border-box; height:44px; min-height:44px; background:transparent;
  border:1px solid var(--hp-line); border-radius:var(--rad-m) 0 0 var(--rad-m);
}
:host([panel-host]) .hdr .tabs .compact-space-settings { margin-inline-start:-1px; border-radius:0 var(--rad-m) var(--rad-m) 0; }
:host([panel-host]) .hdr .tabs.compact-spaces .tabadd { margin-inline-start:10px; }
:host([panel-host]) .hdr .modes { --hp-editor-close-size:44px; }
:host([panel-host]) .hdr .modes .modetab,
:host([panel-host]) .hdr .modes .editor-close-slot:not([aria-hidden='true']) {
  box-sizing:border-box; position:relative; height:44px; min-height:44px; min-width:44px;
  border:1px solid var(--hp-line); border-radius:0; background:transparent; color:var(--hp-txt);
}
:host([panel-host]) .hdr .modes .modetab { padding:0 12px; justify-content:center; transition:background-color 140ms ease,color 140ms ease,border-color 140ms ease; }
:host([panel-host]) .hdr .modes .modetab ha-icon { --mdc-icon-size:20px; }
:host([panel-host]) .hdr .modes > * + * { margin-inline-start:-1px; }
:host([panel-host]) .hdr .modes .modetab:first-child { border-radius:var(--rad-m) 0 0 var(--rad-m); }
:host([panel-host]) .hdr .modes .modetab:last-child,
:host([panel-host]) .hdr .modes .modetab:has(+ .editor-close-slot[aria-hidden='true']),
:host([panel-host]) .hdr .modes .editor-close-slot:last-child:not([aria-hidden='true']) { border-radius:0 var(--rad-m) var(--rad-m) 0; }
:host([panel-host]) .hdr .modes .editor-close-slot[aria-hidden='true'] { display:none; }
:host([panel-host]) .hdr .modes .editor-close-slot:not([aria-hidden='true']) { width:44px; }
:host([panel-host]) .hdr .modes .editor-close-slot .closex { position:absolute; inset:-1px; width:44px; height:44px; color:var(--hp-txt); opacity:1; }
:host([panel-host]) .hdr .modes .modetab.active { border-color:var(--hp-accent); z-index:1; }
:host([panel-host]) .hdr .modes .modetab.active::after { display:none; }
/* Replace the UA ring, retaining an explicit kit-coloured keyboard indicator. */
:host([panel-host]) .hdr .modes .modetab:focus-visible { outline:2px solid var(--hp-accent); outline-offset:2px; }
:host([panel-host][data-pointer-hover]) .hdr .tabs .tab:hover,
:host([panel-host][data-pointer-hover]) .hdr .modes .modetab:not(:disabled):hover,
:host([panel-host][data-pointer-hover]) .hdr .modes .editor-close-slot:not([aria-hidden='true']):hover {
  border-color:var(--hp-accent); background:transparent; color:var(--hp-txt); z-index:2;
}
:host([panel-host][data-pointer-hover]) .hdr .tabs .tab > .tabedit:hover { border-inline-start-color:var(--hp-accent); background:rgba(127,127,127,.14); }
:host([panel-host]) .hdr > .head .zoomctl .zb[data-hp='zoom-out'] { margin-inline-start:10px; border-radius:var(--rad-m) 0 0 var(--rad-m); }
@media (prefers-reduced-motion: reduce) {
  :host([panel-host]) .hdr .tabs .tab,
  :host([panel-host]) .hdr .modes .modetab { transition:none; }
}
/* #1120: only the primary panel replaces fixed header adaptation. */
.panel-header-metrics .panel-icon-metric { display:inline-flex; flex:none; }
:host([panel-host]) .hdr[data-panel-flow] > .head {
  display:flex; flex-wrap:nowrap; gap:10px; padding:10px 12px;
  height:auto; overflow:visible;
}
:host([panel-host]) .hdr[data-panel-flow] .head > * { flex-shrink:0; }
:host([panel-host]) .hdr[data-panel-flow] .head > .tabs {
  display:flex; flex:none; width:auto; min-width:0; max-width:none; overflow:visible; flex-wrap:nowrap;
}
:host([panel-host]) .hdr[data-panel-flow] .head > .tabs .tab {
  display:inline-flex; flex:none; white-space:nowrap; max-width:none;
}
:host([panel-host]) .hdr[data-panel-flow] .tabs .tabedit { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow] .compact-space-select {
  display:block; flex:0 0 180px; width:180px; min-width:180px; max-width:180px;
}
:host([panel-host]) .hdr[data-panel-flow] .compact-space-select::part(control) {
  min-width:44px; padding-inline:12px; gap:8px;
}
:host([panel-host]) .hdr[data-panel-flow] .head > .modes {
  display:inline-flex; align-items:center; flex:none; width:auto; padding:0; gap:0;
  background:transparent;
}
:host([panel-host]) .hdr[data-panel-flow] .head .modetab { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow] .editor-close-slot ha-icon { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow] .modetab > .ml { display:none; }
:host([panel-host]) .hdr[data-panel-flow] .panel-mode-full { display:none; }
:host([panel-host]) .hdr[data-panel-flow] .panel-mode-compact { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow='0'] .panel-mode-full { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow='0'] .panel-mode-compact { display:none; }
:host([panel-host]) .hdr[data-panel-flow] .head > .spacer { display:block; flex:1 0 30px; margin:0; }
:host([panel-host]) .hdr[data-panel-flow] .head > .header-actions {
  display:inline-flex; flex:none; gap:10px; margin:0; max-width:none; justify-content:flex-start;
}
:host([panel-host]) .hdr[data-panel-flow] .header-actions > .header-action,
:host([panel-host]) .hdr[data-panel-flow] .header-actions > .summary-control { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow] .header-menu-wrap { display:none; margin:0; }
:host([panel-host]) .hdr[data-panel-flow] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow] .zoomctl [data-hp='zoom-in'] { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-flow] .zoomctl [data-hp='rotate-right'] { border-radius:0 var(--rad-m) var(--rad-m) 0; }
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-in'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-in'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-in'] { display:none; }
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='rotate-right'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='rotate-right'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='rotate-right'] {
  border-radius:0 var(--rad-m) var(--rad-m) 0;
}
/* Cancel the spacer's second gap so the physical minimum is one10px gap. */
:host([panel-host]) .hdr[data-panel-flow='3'] .head > .spacer {
  flex:1 0 0; margin-inline-start:-10px;
}
:host([panel-host]) .hdr[data-panel-flow='4'] > .head { flex-wrap:wrap; }
:host([panel-host]) .hdr[data-panel-flow='4'] .head > .spacer { display:none; }
:host([panel-host]) .hdr[data-panel-flow='4'] .head > .header-actions { flex:1 0 100%; }
/* Wrapping is the final phase: remaining actions never disappear into a phone menu. */
:host([panel-host]) .hdr[data-panel-flow='4'] .head > .modes { min-width:0; max-width:100%; flex-wrap:wrap; }
:host([panel-host]) .hdr[data-panel-flow='4'] .head > .tabs { max-width:100%; flex-shrink:1; }
:host([panel-host]) .hdr[data-panel-flow='4'] .compact-space-select { flex:1 1 180px; min-width:44px; }
:host([panel-host]) .hdr[data-panel-flow='4'] .head > .header-actions { min-width:0; max-width:100%; flex-wrap:wrap; }
/* This existing intrinsic signal selects row ordering, not a viewport breakpoint. */
:host([panel-host]) .hdr[data-panel-flow='4'][data-panel-phone] .head > .header-actions { display:contents; }
:host([panel-host]) .hdr[data-panel-flow='4'][data-panel-phone] .head > .modes,
:host([panel-host]) .hdr[data-panel-flow='4'][data-panel-phone] .header-actions > .zoomctl { order:1; flex:0 0 auto; }
:host([panel-host]) .hdr[data-panel-flow='4'][data-panel-phone] > .head::after { content:''; order:2; flex:0 0 100%; height:0; margin-block:-5px; pointer-events:none; }
:host([panel-host]) .hdr[data-panel-flow='4'][data-panel-phone] .header-actions > .header-action,
:host([panel-host]) .hdr[data-panel-flow='4'][data-panel-phone] .header-actions > .summary-control { order:3; flex:0 0 auto; }
.panel-menu {
  box-sizing:border-box; width:44px; height:44px; min-width:44px; min-height:44px;
  flex:0 0 44px; padding:0; border:0; border-radius:50%; background:transparent;
  color:var(--hp-txt); display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
  transition:background 150ms ease;
}
.panel-menu ha-icon { --mdc-icon-size:24px; }
:host([data-pointer-hover]) .hdr[data-panel-flow] .panel-menu:hover { background:rgba(127,127,127,.16); }
.panel-menu:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { .panel-menu { transition:none; } }
`;
