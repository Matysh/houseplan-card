import { css } from 'lit';

export const panelHeaderStyles = css`
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
  display:inline-flex; align-items:center; flex:none; width:auto; padding:var(--sp-2); gap:var(--sp-1);
  background:rgba(127,127,127,.12);
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
:host([panel-host]) .hdr[data-panel-flow] .zoomctl [data-hp='rotate-right'] { border-radius:0; }
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
/* Only after the ordered reductions and wrapping: retain all phone actions. */
:host([panel-host]) .hdr[data-panel-phone] .head > .modes {
  flex:0 0 24px; width:24px; padding:0; gap:0; background:transparent;
}
:host([panel-host]) .hdr[data-panel-phone] .head .modetab,
:host([panel-host]) .hdr[data-panel-flow][data-panel-phone] .head > .tabs .tabedit,
:host([panel-host]) .hdr[data-panel-flow][data-panel-phone] .head > .tabs .tabadd,
:host([panel-host]) .hdr[data-panel-phone] .header-actions > .header-action { display:none; }
:host([panel-host]) .hdr[data-panel-phone][data-panel-mode='view'] .head > .modes { display:none; }
:host([panel-host]) .hdr[data-panel-phone] .header-menu-wrap { display:inline-flex; }
:host([panel-host]) .hdr[data-panel-phone] .header-actions > .summary-control { display:inline-flex; }
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
