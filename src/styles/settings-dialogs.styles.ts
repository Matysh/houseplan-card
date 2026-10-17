/** Shared, editor-only presentation for the four approved settings forms (#944). */
export const settingsDialogCss = `
  hp-dialog[settings-layout] { --hp-dialog-wide-width:610px; --hp-dialog-icon-size:40.48px; --hp-dialog-close-transition:160ms ease; --hp-dialog-close-hover-transform:rotate(90deg) scale(1.12); }
  hp-dialog .hpf-form.hpf-settings-form { display:block; padding:0; }
  .hpf-settings-layout { display:grid; grid-template-columns:155px minmax(0,1fr); min-width:0; align-items:start; }
  .hpf-settings-nav { position:sticky; top:0; display:grid; gap:4px; padding:18px 8px; min-width:0; }
  .hpf-settings-nav button { min-height:42px; padding:10px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--primary-text-color); font:inherit; font-size:13px; text-align:start; white-space:normal; overflow-wrap:anywhere; cursor:pointer; transition:background 160ms ease,color 160ms ease; }
  .hpf-settings-nav button:hover { background:var(--hpf-canvas); }
  .hpf-settings-nav button[aria-current=page] { background:var(--hpf-tint); color:var(--hpf-accent); border-color:var(--hpf-tint-line); }
  .hpf-settings-nav hr { width:100%; border:0; border-top:1px solid var(--hpf-line); margin:14px 0; }
  .hpf-settings-content { min-width:0; border-inline-start:1px solid var(--hpf-line); padding:20px; }
  .hpf-settings-pane[hidden] { display:none!important; }
  .hpf-settings-pane .hpf-card { border:0; border-radius:0; background:transparent; overflow:visible; }
  .hpf-settings-pane .hpf-head { padding:0 0 18px; margin:0 0 18px; border-bottom:1px solid var(--hpf-line); }
  .hpf-settings-pane .hpf-head h3 { font-size:16px; }
  .hpf-settings-pane .hpf-body { padding:0; gap:0; }
  .hpf-settings-pane .hpf-body > * + * { margin-top:18px; padding-top:18px; border-top:1px solid var(--hpf-line); }
  .hpf-settings-pane .hpf-sub { min-height:0; }
  .hpf-settings-pane .hpf-sub h4 { font-size:14px; }
  .hpf-settings-pane .hpf-labelrow,.hpf-settings-pane .hpf-field > .hpf-label { color:var(--primary-text-color); font-size:13px; }
  .hpf-settings-pane .hpf-toggle { grid-template-columns:minmax(0,1fr) 44px; }
  .hpf-settings-pane .hpf-toggle-icon { display:none; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > .hpf-toggle-title { grid-column:1; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > .hpf-toggle-caption { grid-column:1; }
  .hpf-settings-form .hpf-settings-pane .hpf-toggle > input { grid-column:2; }
  .hpf-settings-pane .hpf-callout { border-inline-start:3px solid var(--info-color,var(--primary-color)); border-radius:0; background:color-mix(in srgb,var(--info-color,var(--primary-color)) 10%,var(--hpf-surface)); }
  .hpf-settings-pane .hpf-callout > ha-icon { display:none; }
  .hpf-settings-pane .hpf-callout p { margin:0; }
  .hpf-settings-form button:not(:disabled),.hpf-settings-form select:not(:disabled),.hpf-footer button:not(:disabled),.hpf-footer a { cursor:pointer; }
  .hpf-settings-form button:not(:disabled):hover,.hpf-footer button:not(:disabled):hover { filter:brightness(1.08); }
  .hpf-settings-form :disabled,.hpf-footer button:disabled { cursor:not-allowed; }
  .hpf-settings-form input:not([type=checkbox]):not([type=radio]):not([type=range]) { cursor:text; }
  .hpf-settings-form input[type=range] { cursor:pointer; }
  .hpf-settings-mobile { display:none; }
  .hpf-color-with-action { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:12px; }
  .hpf-color-with-action > button { min-height:48px; }
  .hpf-color-with-action > .hpf-colorfield { box-sizing:border-box; min-height:48px; }
  .hpf-background-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .hpf-ray-examples { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .hpf-ray-examples figure { margin:0; min-width:0; border:1px solid var(--hpf-line); border-radius:8px; overflow:hidden; }
  .hpf-ray-examples figure.is-selected { border-color:var(--hpf-accent); }
  .hpf-ray-examples svg { display:block; width:100%; height:auto; }
  .hpf-ray-examples figcaption { font-size:12px; text-align:center; padding:6px; }
  .hpf-background-grid figure { margin:0; min-width:0; }
  .hpf-background-stage { position:relative; border-radius:8px; min-height:90px; overflow:hidden; }
  .hpf-background-stage svg { display:block; width:100%; height:90px; opacity:.85; }
  .hpf-background-stage ha-icon { position:absolute; inset:7px 7px auto auto; color:var(--primary-text-color); --mdc-icon-size:18px; }
  .hpf-background-grid figcaption { margin-top:5px; color:var(--secondary-text-color); font-size:12px; }
  .hpf-settings-pane .hpf-background-examples > .hpf-hint { margin-top:12px; }
  .hpf-north-control { display:grid; grid-template-columns:148px minmax(0,1fr); align-items:center; gap:18px; }
  .hpf-north-dial { width:148px; height:148px; min-width:0; border:0; padding:0; border-radius:50%; background:transparent; color:var(--primary-text-color); cursor:pointer; touch-action:none; }
  .hpf-north-dial svg { width:100%; height:100%; font-size:10px; }
  .hpf-north-dial.hpf-unset { opacity:.45; }
  .hpf-north-values { display:grid; gap:18px; min-width:0; }
  .hpf-north-values input[type=range] { width:100%; min-width:0; accent-color:var(--hpf-accent); }
  .hpf-settings-single { grid-template-columns:minmax(0,1fr); }
  .hpf-settings-single .hpf-settings-content { border:0; }
  .hpf-settings-single .hpf-card + .hpf-card { margin-top:24px; }
  .hpf-sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  .hpf-settings-form select { transition:background 160ms ease,border-color 160ms ease; }
  @supports (appearance:base-select) {
    .hpf-settings-form select,.hpf-settings-form select::picker(select) { appearance:base-select; }
    .hpf-settings-form select::picker-icon { margin-inline-start:12px; transition:rotate 160ms ease; }
    .hpf-settings-form select:open::picker-icon { rotate:180deg; }
    .hpf-settings-form select::picker(select) { color:var(--primary-text-color); background:var(--hpf-surface); border:1px solid var(--hpf-line); border-radius:10px; padding:5px; box-shadow:0 8px 28px #0003; opacity:0; transform:translateY(-5px) scale(.985); transition:opacity 160ms,transform 160ms,display 160ms allow-discrete,overlay 160ms allow-discrete; }
    .hpf-settings-form select:open::picker(select) { opacity:1; transform:none; }
    @starting-style { .hpf-settings-form select:open::picker(select) { opacity:0; transform:translateY(-5px) scale(.985); } }
    .hpf-settings-form option { padding:10px 12px; border-radius:6px; white-space:normal; }
    .hpf-settings-form option:hover { background:var(--hpf-tint); }
  }
  @media(max-width:600px) {
    .hpf-settings-layout { grid-template-columns:minmax(0,1fr); }
    .hpf-settings-nav { display:none; }
    .hpf-settings-mobile { display:block; position:sticky; top:0; z-index:2; padding:10px 14px; border-bottom:1px solid var(--hpf-line); background:var(--hpf-surface); }
    .hpf-settings-content { border:0; padding:18px 14px; }
    .hpf-settings-form input,.hpf-settings-form select,.hpf-settings-form textarea { font-size:16px!important; }
    .hpf-settings-pane .hpf-colortiles { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .hpf-north-control { grid-template-columns:112px minmax(0,1fr); gap:12px; }
    .hpf-north-dial { width:112px; height:112px; }
  }
  @media(prefers-reduced-motion:reduce) {
    hp-dialog[settings-layout] { --hp-dialog-close-transition:none; --hp-dialog-close-hover-transform:none; }
    .hpf-settings-form *,.hpf-settings-form *::picker(select) { transition:none!important; animation:none!important; }
  }
`;
