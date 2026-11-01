import { css } from 'lit';

export const panelHeaderStyles = css`
/* #1184: one intrinsic header for panel and Lovelace. */
.panel-header-metrics .panel-icon-metric { display:inline-flex; flex:none; }
.hdr[data-panel-flow] > .head {
  display:flex; flex-wrap:nowrap; gap:10px; padding:10px 12px;
  height:auto; overflow:visible;
}
.hdr[data-panel-flow] .head > * { flex-shrink:0; }
.hdr[data-panel-flow] .head > .tabs {
  display:flex; flex:none; width:auto; min-width:0; max-width:none; overflow:visible; flex-wrap:nowrap;
}
.hdr[data-panel-flow] .head > .tabs .tab {
  display:inline-flex; flex:none; white-space:nowrap; max-width:none;
}
.hdr[data-panel-flow] .tabs .tabedit { display:inline-flex; }
.hdr[data-panel-flow] .compact-space-select {
  display:block; flex:0 0 180px; width:180px; min-width:180px; max-width:180px;
}
.hdr[data-panel-flow] .head > .modes {
  display:inline-flex; align-items:center; flex:none; width:auto; padding:0; gap:0;
}
.hdr[data-panel-flow] .head .modetab { display:inline-flex; }
.hdr[data-panel-flow] .editor-close-slot ha-icon { display:inline-flex; }
.hdr[data-panel-flow] .panel-mode-full { display:none; }
.hdr[data-panel-flow] .panel-mode-compact { display:inline-flex; }
.hdr[data-panel-flow='0'] .panel-mode-full { display:inline-flex; }
.hdr[data-panel-flow='0'] .panel-mode-compact { display:none; }
.hdr[data-panel-flow] .head > .spacer { display:block; flex:1 0 30px; margin:0; }
.hdr[data-panel-flow] .head > .header-actions {
  display:inline-flex; flex:none; gap:10px; margin:0; max-width:none; justify-content:flex-start;
}
.hdr[data-panel-flow] .header-actions > .header-action,
.hdr[data-panel-flow] .header-actions > .summary-control { display:inline-flex; }
.hdr[data-panel-flow] .zoomctl [data-hp='zoom-out'],
.hdr[data-panel-flow] .zoomctl [data-hp='zoom-fit'],
.hdr[data-panel-flow] .zoomctl [data-hp='zoom-in'] { display:inline-flex; }
.hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-out'],
.hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-fit'],
.hdr[data-panel-flow='2'] .zoomctl [data-hp='zoom-in'],
.hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-out'],
.hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-fit'],
.hdr[data-panel-flow='3'] .zoomctl [data-hp='zoom-in'],
.hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-out'],
.hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-fit'],
.hdr[data-panel-flow='4'] .zoomctl [data-hp='zoom-in'] { display:none; }
/* Cancel the spacer's second gap so the physical minimum is one10px gap. */
.hdr[data-panel-flow='3'] .head > .spacer {
  flex:1 0 0; margin-inline-start:-10px;
}
.hdr[data-panel-flow='4'] > .head { flex-wrap:wrap; }
.hdr[data-panel-flow='4'] .head > .spacer { display:none; }
.hdr[data-panel-flow='4'] .head > .header-actions { flex:1 0 100%; }
/* Wrapping is the final phase: remaining actions never disappear into a phone menu. */
.hdr[data-panel-flow='4'] .head > .modes { min-width:0; max-width:100%; flex-wrap:wrap; }
.hdr[data-panel-flow='4'] .head > .tabs { max-width:100%; flex-shrink:1; }
.hdr[data-panel-flow='4'] .compact-space-select { flex:1 1 180px; min-width:44px; }
.hdr[data-panel-flow='4'] .head > .header-actions { min-width:0; max-width:100%; flex-wrap:wrap; }
/* This existing intrinsic signal selects row ordering, not a viewport breakpoint. */
.hdr[data-panel-flow='4'][data-panel-phone] .head > .header-actions { display:contents; }
.hdr[data-panel-flow='4'][data-panel-phone] .head > .modes,
.hdr[data-panel-flow='4'][data-panel-phone] .header-actions > .zoomctl { order:1; flex:0 0 auto; }
.hdr[data-panel-flow='4'][data-panel-phone] > .head::after { content:''; order:2; flex:0 0 100%; height:0; margin-block:-5px; pointer-events:none; }
.hdr[data-panel-flow='4'][data-panel-phone] .header-actions > .header-action,
.hdr[data-panel-flow='4'][data-panel-phone] .header-actions > .summary-control { order:3; flex:0 0 auto; }
/* Fixed bounds also apply in the max-content metrics tree. */
.hdr[data-panel-flow] .head > .title { display:flex; flex:0 1 auto; min-width:0; max-width:180px; }
.hdr[data-panel-flow] .head > .title > ha-icon { flex:none; }
.hdr[data-panel-flow] .head > .title > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hdr[data-panel-flow='4'] .head > .title { flex:1 0 100%; max-width:100%; }
.panel-menu { flex:0 0 44px; }
`;
