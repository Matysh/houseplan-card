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
:host([panel-host]) .hdr[data-panel-flow] .head > .modes {
  display:inline-flex; align-items:center; flex:none; width:auto; padding:0; gap:0;
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
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-in'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-in'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-out'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-fit'],
:host([panel-host]) .hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-in'] { display:none; }
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
.panel-menu { flex:0 0 44px; }
`;
