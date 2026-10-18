/** Shared, editor-only presentation for the four approved settings forms (#944). */
import { settingsActionHover, settingsActionTransition, settingsPrimaryActionHover } from './settings-action.styles';
export const settingsDialogCss = `
  hp-dialog[settings-layout] { --hp-dialog-wide-width:610px; --hp-dialog-icon-size:40.48px; --hp-settings-help-size:22px; --hp-settings-help-scale:1.06; --hp-dialog-close-transition:160ms ease; --hp-dialog-close-hover-transform:rotate(90deg) scale(1.12); }
  hp-dialog:is([data-kind=space],[data-kind=marker])[settings-layout] { --hp-dialog-settings-height:780px; --hp-settings-chrome-height:176px; }
  hp-dialog .hpf-form.hpf-settings-form { display:block; padding:0; background:var(--hpf-surface); --hpf-control-surface:var(--hpf-surface); }
  .hpf-settings-layout { display:grid; grid-template-columns:155px minmax(0,1fr); min-width:0; align-items:start; }
  .hpf-settings-nav { position:sticky; top:0; display:grid; gap:4px; padding:13px 8px; min-width:0; }
  .hpf-settings-nav button { min-height:38px; padding:9px 10px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--primary-text-color); font:inherit; font-size:12px; line-height:1.35; text-align:start; white-space:normal; overflow-wrap:anywhere; cursor:pointer; transition:background 160ms ease,color 160ms ease; }
  .hpf-settings-nav button:hover { background:var(--hpf-canvas); }
  .hpf-settings-nav button[aria-current=page] { background:var(--hpf-tint); color:var(--hpf-accent); font-weight:600; }
  .hpf-settings-nav hr { width:100%; border:0; border-top:1px solid var(--hpf-line); margin:14px 0; }
  .hpf-settings-content { min-width:0; align-self:stretch; border-inline-start:1px solid var(--hpf-line); padding:20px; }
  .hpf-settings-pane[hidden] { display:none!important; }
  .hpf-settings-form .hpf-settings-pane .hpf-card { border:0; border-radius:0; background:transparent; overflow:visible; }
  .hpf-settings-pane .hpf-head { padding:0 0 18px; margin:0 0 18px; border-bottom:1px solid var(--hpf-line); }
  .hpf-settings-pane .hpf-head h3 { font-size:16px; line-height:1.45; }
  .hpf-settings-pane .hpf-body { padding:0; gap:0; }
  .hpf-settings-pane .hpf-body > * + * { margin-top:18px; padding-top:18px; border-top:1px solid var(--hpf-line); }
  .hpf-settings-pane .hpf-sub { min-height:0; }
  .hpf-settings-pane .hpf-sub h4 { font-size:14px; }
  .hpf-settings-pane .hpf-body > .hpf-sub + * { margin-top:12px; padding-top:0; border-top:0; }
  .hpf-button-help { display:inline-flex; align-items:center; gap:4px; }
  .hpf-settings-form .vacpicker > summary { position:relative; margin-inline-end:24px; }
  .hpf-settings-form .vacpicker > summary > hp-help { position:absolute; inset-inline-start:calc(100% + 4px); top:50%; transform:translateY(-50%); }
  .hpf-settings-pane .hpf-labelrow,.hpf-settings-pane .hpf-field > .hpf-label { min-height:20px; color:var(--primary-text-color); font-size:13px; font-weight:600; }
  .hpf-settings-form .hpf-settings-pane .hpf-grid-stacked { grid-template-columns:minmax(0,1fr); gap:0; }
  .hpf-settings-form .hpf-settings-pane .hpf-grid-stacked > .hpf-field + .hpf-field { margin-top:18px; padding-top:18px; border-top:1px solid var(--hpf-line); }
  .hpf-settings-pane .hpf-colorrow { grid-template-columns:minmax(0,1fr); align-items:stretch; min-height:0; }
  .hpf-settings-pane .hpf-colorrow > .hpf-colorfield { justify-self:stretch; width:100%; box-sizing:border-box; }
  .hpf-settings-pane .hpf-colortile-labelled { padding:10px; gap:8px; align-content:start; }
  .hpf-colortile-heading { display:flex; align-items:center; gap:4px; min-height:38px; font-size:12px; font-weight:600; line-height:1.45; color:var(--primary-text-color); }
  .hpf-colortile-heading > span { min-width:0; }
  .hpf-colortile-heading hp-help { display:inline-flex; vertical-align:middle; margin-inline-start:3px; }
  .hpf-settings-pane .hpf-colortile-labelled > .hpf-colortile-swatch { min-height:34px; }
  .hpf-settings-pane .hpf-colortile-labelled .hpf-colortile-meta { justify-content:flex-start; gap:4px; font-size:12px; }
  .hpf-settings-pane .hpf-colortile-labelled .hpf-hex { font-size:12px; }
  .hpf-settings-pane [data-card=fills] .hpf-body > .hpf-sub { border-top:0; padding-top:0; }
  .hpf-settings-pane .hpf-colorfield,.hpf-settings-form .hpf-input { background:var(--hpf-surface); }
  .hpf-settings-pane .hpf-colorfield { cursor:pointer; transition:border-color 160ms; }
  .hpf-settings-pane .hpf-colorfield:hover { border-color:var(--hpf-accent); }
  .hpf-settings-pane .hpf-unit { box-sizing:border-box; }
  hp-dialog[settings-layout] .hpf-footer .hpf-status { margin:0 auto 0 0; font-size:11px; }
  .hpf-settings-pane .hpf-toggle { grid-template-columns:minmax(0,1fr) 44px; min-height:44px; padding:0; }
  .hpf-settings-pane .hpf-body > .hpf-toggle:not(:first-child) { padding-top:18px; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > .hpf-toggle-title { display:flex; align-items:center; font-size:13px; line-height:1.45; text-wrap:balance; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > .hpf-toggle-title > span { overflow-wrap:normal; word-break:normal; }
  .hpf-settings-pane .hpf-toggle-title hp-help { display:inline-flex; vertical-align:middle; margin-inline-start:3px; }
  .hpf-settings-pane .hpf-toggle-icon { display:none; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > .hpf-toggle-title { grid-column:1; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > .hpf-toggle-caption { grid-column:1; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > input { grid-column:2; grid-row:1; }
  .hpf-settings-pane .hpf-body > #gs-moon-status { border-top:0; margin-top:8px; padding-top:8px; }
  .hpf-settings-pane .hpf-callout { padding:8px 10px; font-size:12px; line-height:1.45; border-inline-start:3px solid var(--info-color,var(--primary-color)); border-radius:0; background:color-mix(in srgb,var(--info-color,var(--primary-color)) 10%,var(--hpf-surface)); }
  .hpf-settings-pane .hpf-callout > ha-icon { display:none; }
  .hpf-settings-pane .hpf-callout p { margin:0; font-size:inherit; }
  .hpf-settings-pane .hpf-hint,.hpf-settings-pane .hpf-toggle-caption { font-size:12px; line-height:1.45; }
  .hpf-settings-form button:not(:disabled),.hpf-settings-form select:not(:disabled),.hpf-footer button:not(:disabled),.hpf-footer a { cursor:pointer; }
  .hpf-settings-form button:not(:disabled):hover,.hpf-footer button:not(:disabled):hover { filter:brightness(1.08); }
  :is(.hpf-settings-form,hp-dialog[settings-layout] .hpf-footer,.danger-confirm-footer) .btn:not(:disabled) { cursor:pointer; ${settingsActionTransition} }
  :is(.hpf-settings-form,hp-dialog[settings-layout] .hpf-footer,.danger-confirm-footer) .btn:not(:disabled):is(:hover,:focus-visible) { ${settingsActionHover} }
  :is(.hpf-settings-form,hp-dialog[settings-layout] .hpf-footer,.danger-confirm-footer) .btn.on:not(:disabled):is(:hover,:focus-visible) { ${settingsPrimaryActionHover} }
  :is(.hpf-settings-form,hp-dialog[settings-layout] .hpf-footer,.danger-confirm-footer) .btn.danger:not(:disabled):is(:hover,:focus-visible) { background:color-mix(in srgb,var(--hpf-danger) 9%,var(--hpf-surface)); color:var(--hpf-danger); border-color:var(--hpf-danger); }
  .hpf-settings-form :disabled,.hpf-footer button:disabled { cursor:not-allowed; }
  .hpf-settings-form input:not([type=checkbox]):not([type=radio]):not([type=range]) { cursor:text; }
  .hpf-settings-form input[type=range] { cursor:pointer; }
  .hpf-settings-mobile { display:none; }
  .hpf-temperature-range { display:flex; gap:12px; align-items:start; margin-top:12px; }
  .hpf-temperature-range > .hpf-field { display:flex; flex:1; min-width:0; gap:8px; align-items:center; }
  .hpf-temperature-range .hpf-unit { flex:1; min-width:0; }
  .hpf-temperature-range .hpf-label { flex:none; }
  .hpf-plan-image { display:flex; align-items:center; gap:10px; min-height:148px; padding:12px; box-sizing:border-box; background:var(--hpf-canvas); border:1px solid var(--hpf-line); border-radius:7px; }
  .hpf-plan-image .planprev { width:210px; max-width:60%; height:124px; max-height:none; object-fit:contain; border:0; border-radius:0; padding:0; background:transparent; }
  .hpf-plan-filename { min-width:0; overflow-wrap:anywhere; color:var(--hpf-muted); font-size:13px; }
  .hpf-plan-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .hpf-plan-actions .fileupload { display:block; min-width:0; }
  .hpf-plan-actions .btn { width:100%; min-height:44px; height:100%; box-sizing:border-box; justify-content:center; padding-inline:8px; font-size:12px; }
  .hpf-inherited-swatch { display:inline-block; width:24px; height:24px; border:1px solid var(--hpf-line); border-radius:5px; }
  .hpf-inherited-color { display:flex; align-items:center; gap:8px; color:var(--hpf-muted); font-size:12px; }
  .hpf-room-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px 14px; margin-top:10px; }
  .hpf-settings-pane .hpf-body > .hpf-context-links { margin-top:8px; padding-top:0; border-top:0; }
  .hpf-context-links .hpf-link { font-size:12px; }
  hp-dialog[settings-layout] .hpf-footer-object { display:grid; grid-template-columns:auto auto minmax(0,1fr) auto; column-gap:8px; row-gap:10px; padding:12px 16px; }
  hp-dialog[settings-layout] .hpf-footer-object .hpf-status { grid-column:1 / -1; grid-row:1; }
  hp-dialog[settings-layout] .hpf-footer-object .dialog-action-copy { grid-column:1; grid-row:2; }
  hp-dialog[settings-layout] .hpf-footer-object .dialog-action-danger { grid-column:2; grid-row:2; margin:0; }
  hp-dialog[settings-layout] .hpf-footer-object .dialog-action-commit { grid-column:4; grid-row:2; margin:0; }
  hp-dialog[settings-layout] .hpf-footer-object .hpf-action-label { display:inline; }
  hp-dialog[settings-layout] .hpf-footer-object .hpf-mobile-icon { width:auto; min-width:0; padding-inline:10px; }
  hp-dialog[settings-layout] .hpf-footer-object .btn { white-space:normal; }
  hp-dialog[settings-layout] .hpf-footer-object .dialog-action-danger .btn:not(:hover):not(:focus-visible) { border-color:transparent; }
  .hpf-color-with-action { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:12px; }
  .hpf-color-with-action > button { min-height:48px; }
  .hpf-color-with-action > .hpf-colorfield { box-sizing:border-box; min-height:48px; }
  .hpf-background-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 10px; margin-top:17px; }
  .hpf-ray-examples { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .hpf-ray-choice { position:relative; min-width:0; border-radius:8px; cursor:pointer; }
  .hpf-ray-examples figure { margin:0; min-width:0; border:1px solid var(--hpf-line); border-radius:8px; overflow:hidden; }
  .hpf-ray-examples figure.is-selected { border-color:var(--hpf-accent); }
  .hpf-ray-choice:is(:hover,:focus-within) { box-shadow:0 0 0 2px var(--hpf-tint-line); }
  .hpf-ray-choice:hover figure { border-color:var(--hpf-accent); }
  .hpf-ray-examples svg { display:block; width:100%; height:auto; }
  .hpf-ray-examples figcaption { font-size:12px; text-align:center; padding:6px; }
  .hpf-background-grid figure { margin:0; min-width:0; }
  .hpf-settings-pane .hpf-body > .hpf-background-examples { border-top:0; padding-top:0; margin-top:0; }
  .hpf-background-stage { position:relative; border-radius:7px; height:100px; overflow:hidden; }
  .hpf-background-stage svg { position:absolute; inset:12px 10%; width:80%; height:76px; }
  .hpf-mini-floor { fill:color-mix(in srgb,var(--hpf-surface) 72%,transparent); stroke:var(--secondary-text-color); stroke-width:2; }
  .hpf-mini-wall { fill:none; stroke:var(--secondary-text-color); stroke-width:2; }
  .hpf-background-grid figcaption { margin-top:5px; color:var(--primary-text-color); font-size:12px; font-weight:600; }
  .hpf-background-rules { margin-top:14px; }
  .hpf-background-rules .hpf-hint { margin:0 0 7px; }
  .hpf-settings-pane [data-card=data] .hpf-actions { gap:10px; }
  .hpf-settings-pane [data-card=data] .hpf-actions .btn { font-size:12px; padding-inline:10px; }
  .hpf-converter .hpf-link { display:inline-block; font-size:12px; padding:0; margin-bottom:7px; transition:color 150ms ease,background 150ms ease; }
  .hpf-converter .hpf-link:hover { color:var(--primary-text-color); background:var(--hpf-tint); }
  .hpf-north-control { display:grid; grid-template-columns:148px minmax(0,1fr); align-items:center; gap:18px; }
  .hpf-north-dial { width:148px; height:148px; min-width:0; border:0; padding:0; border-radius:50%; background:transparent; color:var(--primary-text-color); cursor:pointer; touch-action:none; }
  .hpf-north-dial svg { width:100%; height:100%; font-size:10px; }
  .hpf-north-dial.hpf-unset { opacity:.45; }
  .hpf-north-values { display:grid; gap:18px; min-width:0; }
  .hpf-north-values .hpf-hint { margin:0; font-size:12px; }
  .hpf-north-values input[type=range] { width:100%; min-width:0; accent-color:var(--hpf-accent); }
  .hpf-settings-single { grid-template-columns:minmax(0,1fr); }
  .hpf-settings-single .hpf-settings-content { border:0; }
  .hpf-settings-single .hpf-card + .hpf-card { margin-top:18px; padding-top:18px; border-top:1px solid var(--hpf-line); }
  .hpf-settings-single .hpf-head { padding:0; margin:0 0 18px; border:0; }
  .hpf-settings-single .hpf-head h3 { font-size:14px; }
  .hpf-temperature-range.hpf-range-compact { max-width:360px; gap:32px; }
  .hpf-settings-pane .hpf-temprange { min-width:0; grid-template-columns:minmax(0,1fr); }
  .hpf-range-compact .hpf-unit { width:112px; max-width:112px; }
  hp-dialog[data-kind=room][settings-layout] .hpf-grid { grid-template-columns:minmax(0,1fr); }
  .hpf-settings-form .cardpreview { border:0; width:100%; margin:0; color:var(--hpf-accent); }
  .hpf-settings-form .cardpreview .cpmeta > span { display:inline-flex; align-items:center; gap:.2em; white-space:nowrap; }
  .hpf-settings-form .iconbtn { width:44px; height:44px; min-width:44px; padding:0; display:inline-flex; align-items:center; justify-content:center; border:0; border-radius:50%; color:inherit; background:transparent; transition:background 160ms; }
  .hpf-settings-form .iconbtn:hover { background:var(--hpf-tint); }
  .hpf-settings-form .hpf-seg:has(input[name=bmode]) { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .hpf-settings-form .hpf-seg:has(input[name=bmode]) label { min-width:0; white-space:nowrap; font-size:12px; }
  .hpf-settings-form .led-representation > .row { justify-content:flex-start; }
  .hpf-settings-form .hpf-toolbar { flex-wrap:wrap; }
  .hpf-settings-form .hpf-toolbar > .hpf-callout { flex-basis:100%; }
  .hpf-settings-form .hpf-note { display:block; border-inline-start:3px solid var(--info-color,var(--primary-color)); background:color-mix(in srgb,var(--info-color,var(--primary-color)) 10%,var(--hpf-surface)); padding:10px 12px; }
  .hpf-settings-form .hpf-note-warning { border-color:var(--warning-color); background:color-mix(in srgb,var(--warning-color) 10%,var(--hpf-surface)); }
  .hpf-settings-pane[data-settings-section=details] .hpf-field > .hpf-hint { margin-top:12px; }
  .hpf-settings-form .hpf-chip > button { flex:0 0 28px; width:28px; height:28px; min-width:28px; min-height:28px; padding:0; border-radius:50%; }
  .hpf-settings-form .hpf-iconfield:focus-within { outline:2px solid var(--hpf-accent); outline-offset:2px; border-radius:8px; }
  .hpf-settings-form .hpf-iconfield .hpf-input:focus-visible { outline:none; box-shadow:none; }
  .hpf-settings-form ha-icon-picker { --mdc-outlined-text-field-focus-outline-color:var(--hpf-accent); }
  .hpf-settings-pane .radargroup { border:0; margin:0; padding:0; min-width:0; }
  .hpf-settings-pane .radarsetup-head { height:112px; align-items:start; }
  .hpf-settings-pane .radarsetup-head strong { max-height:112px; overflow:auto; }
  .hpf-settings-pane[data-settings-section=details] .hpf-grid { grid-template-columns:minmax(0,1fr); align-items:start; }
  .hpf-settings-pane .radargroup > legend { padding:0 0 18px; margin:0 0 18px; border-bottom:1px solid var(--hpf-line); width:100%; box-sizing:border-box; }
  .hpf-settings-pane .radargroup > label:not(.hpf-toggle):not(.srcrow) { display:block; margin:18px 0 8px; }
  .hpf-settings-pane .radartargetheading { display:flex; align-items:center; justify-content:space-between; }
  .hpf-settings-pane .radargroup { display:block; }
  .hpf-settings-pane .hpf-profile-target-heading { display:grid; gap:12px; justify-content:start; }
  .hpf-settings-pane .hpf-profile-target > * + * { margin-top:18px; padding-top:18px; border-top:1px solid var(--hpf-line); }
  .hpf-settings-pane .hpf-profile-diagnostics > .vacdiag,.hpf-settings-pane .hpf-profile-maproutes > .vacroutes { margin-top:12px; }
  .hpf-settings-pane .hpf-profile-diagnostics .vacdiag > div { padding:6px 0; }
  .hpf-settings-pane .hpf-profile-target-heading .btn { justify-self:start; }
  .hpf-settings-pane .radarcoordinates { display:flex; flex-wrap:wrap; gap:12px; }
  .hpf-settings-pane .radarcoordinates > label { flex:1; min-width:72px; }
  .hpf-settings-pane .radarcoordinates input { width:100%; box-sizing:border-box; }
  .hpf-sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  .hpf-settings-form select { transition:background 160ms ease,border-color 160ms ease; }
  @supports (appearance:base-select) {
    .hpf-settings-form select { background-image:none; }
    .hpf-settings-form select,.hpf-settings-form select::picker(select) { appearance:base-select; }
    .hpf-settings-form select::picker-icon { margin-inline-start:12px; transition:rotate 160ms ease; }
    .hpf-settings-form select:open::picker-icon { rotate:180deg; }
    .hpf-settings-form select::picker(select) { color:var(--primary-text-color); background:var(--hpf-surface); border:1px solid var(--hpf-line); border-radius:10px; padding:5px; box-shadow:0 8px 28px #0003; opacity:0; transform:translateY(-5px) scale(.985); transition:opacity 160ms,transform 160ms,display 160ms allow-discrete,overlay 160ms allow-discrete; }
    .hpf-settings-form select:open::picker(select) { opacity:1; transform:none; }
    @starting-style { .hpf-settings-form select:open::picker(select) { opacity:0; transform:translateY(-5px) scale(.985); } }
    .hpf-settings-form option { padding:10px 12px; border-radius:6px; white-space:normal; }
    .hpf-settings-form option:hover { background:var(--hpf-tint); }
  }
  @media(min-width:551px) {
    .hpf-settings-layout:not(.hpf-settings-single) { min-height:calc(min(var(--hp-dialog-settings-height,756px),100dvh - 48px) - var(--hp-settings-chrome-height,152px)); }
  }
  @media(max-width:550px) {
    .hpf-settings-layout { grid-template-columns:minmax(0,1fr); }
    .hpf-settings-nav { display:none; }
    .hpf-settings-mobile { display:block; position:sticky; top:0; z-index:2; padding:10px 14px; border-bottom:1px solid var(--hpf-line); background:var(--hpf-surface); }
    .hpf-settings-content { border:0; padding:18px 14px; }
    .hpf-room-metrics { grid-template-columns:minmax(0,1fr); gap:20px; }
    hp-dialog[settings-layout] .hpf-footer-object { grid-template-columns:auto auto minmax(0,1fr); padding:12px 14px; }
    hp-dialog[settings-layout] .hpf-footer-object .dialog-action-commit { grid-column:1 / -1; grid-row:3; justify-content:flex-end; }
    .hpf-settings-form input,.hpf-settings-form select,.hpf-settings-form textarea { font-size:16px!important; }
    .hpf-settings-pane .hpf-colortiles { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .hpf-north-control { grid-template-columns:112px minmax(0,1fr); gap:12px; }
    .hpf-north-dial { width:112px; height:112px; }
  }
  @media(prefers-reduced-motion:reduce) {
    hp-dialog[settings-layout] { --hp-dialog-close-transition:none; --hp-dialog-close-hover-transform:none; }
    .hpf-settings-form *,hp-dialog[settings-layout] .hpf-footer .btn,.danger-confirm-footer .btn,.hpf-settings-form *::picker(select) { transition:none!important; animation:none!important; }
  }
`;
