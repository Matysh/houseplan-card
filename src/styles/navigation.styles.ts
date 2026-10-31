import { css, unsafeCSS } from 'lit';
import { settingsActionHover, settingsActionTransition } from './settings-action.styles';
import { controlReducedMotionCss } from './ui-motion.styles';

/** Navigation segments: filled card variant and outlined primary-panel variant. */
export const navigationStyles = unsafeCSS(css`
  .hpf-navigation {
    display:inline-flex; align-items:center; gap:4px; padding:0;
    border-radius:9px; background:color-mix(in srgb,var(--secondary-text-color) 12%,transparent);
    isolation:isolate;
  }
  .hpf-navigation > .hpf-nav-item {
    box-sizing:border-box; position:relative; display:inline-flex; align-items:center;
    justify-content:center; gap:8px; min-width:44px; min-height:44px; padding:6px 10px;
    border:1px solid transparent; border-radius:7px; background:transparent;
    color:var(--secondary-text-color); font:inherit; font-size:13px; font-weight:600; line-height:20px;
    cursor:pointer;
  }
  .hpf-navigation > .hpf-nav-item.active { background:var(--primary-color); color:var(--text-primary-color,#fff); }
  .hpf-navigation > .hpf-nav-item:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  .hpf-navigation > .hpf-nav-item:disabled { opacity:.5; cursor:not-allowed; }
  .hpf-navigation > .hpf-nav-item:not(:disabled):active { box-shadow:inset 0 0 0 2px var(--primary-color); }
  .hpf-nav-item ha-icon { --mdc-icon-size:20px; }
  .hpf-nav-item > .tabedit { --mdc-icon-size:20px; margin-inline-start:6px; opacity:.6; cursor:pointer; }
  :host([data-pointer-hover]) .hpf-nav-item:hover > .tabedit { opacity:1; }
  .hpf-navigation.hpf-nav-compact { padding:0; gap:4px; background:transparent; }
  .hpf-nav-compact > .hpf-nav-item { padding:0; }
  .hpf-nav-modes { --hp-editor-close-size:24px; }
  .hpf-nav-modes > .hpf-nav-item.active { background:transparent; }
  .hpf-nav-modes > .hpf-nav-item.active::after {
    content:''; position:absolute; inset:0 calc(-1 * (4px + var(--hp-editor-close-size))) 0 0;
    z-index:-1; border-radius:7px; background:var(--primary-color); pointer-events:none;
  }
  .hpf-nav-modes > .hpf-nav-item.active:focus-visible { outline:none; }
  .hpf-nav-modes > .hpf-nav-item.active:focus-visible::after { outline:2px solid var(--primary-color); outline-offset:2px; }
  .hpf-nav-modes > .editor-close-slot { box-sizing:border-box; display:inline-flex; flex:none; align-items:center; justify-content:center; width:var(--hp-editor-close-size); height:var(--hp-editor-close-size); }
  .hpf-nav-modes > .editor-close-slot[aria-hidden='true'] { pointer-events:none; }
  .hpf-nav-modes .closex { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:100%; height:100%; padding:0; margin:0; border:0; border-radius:5px; background:transparent; color:var(--secondary-text-color); opacity:.75; font:inherit; cursor:pointer; }
  .hpf-nav-modes .closex ha-icon { --mdc-icon-size:13px; }
  .hpf-nav-modes .closex:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px; opacity:1; }
  :host([data-pointer-hover]) .hpf-nav-modes .closex:hover { opacity:1; }
  @media(min-width:481px) {
    .hpf-nav-modes > .hpf-nav-item.active + .editor-close-slot .closex { color:var(--text-primary-color,#fff); opacity:.9; }
    .hpf-nav-modes > .hpf-nav-item.active + .editor-close-slot .closex:focus-visible { outline-color:var(--text-primary-color,#fff); }
  }
  :host([panel-host]) .hpf-navigation { padding:0; gap:10px; background:transparent; }
  :host([panel-host]) .hpf-navigation > .hpf-nav-item { height:44px; padding:0 12px; border-color:var(--divider-color); background:transparent; color:var(--primary-text-color); }
  :host([panel-host]) .hpf-navigation > .hpf-nav-item.active { border-color:var(--primary-color); z-index:1; }
  :host([panel-host]) .hpf-nav-item > .tabtitle { line-height:42px; }
  :host([panel-host]) .hpf-nav-item:has(> .tabedit) { padding:0; gap:0; }
  :host([panel-host]) .hpf-nav-item:has(> .tabedit) > .tabtitle { padding-inline:12px; }
  :host([panel-host]) .hpf-nav-item > .tabedit { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:44px; height:42px; min-width:44px; margin:0; border-inline-start:1px solid var(--divider-color); border-radius:0 6px 6px 0; opacity:1; }
  :host([panel-host]) .hpf-nav-compact { gap:0; }
  :host([panel-host]) .hpf-nav-compact > .compact-space-settings { margin-inline-start:-1px; border-radius:0 7px 7px 0; }
  :host([panel-host]) .hpf-nav-compact > .tabadd { margin-inline-start:10px; }
  :host([panel-host]) .hpf-nav-modes { --hp-editor-close-size:44px; gap:0; }
  :host([panel-host]) .hpf-nav-modes > .hpf-nav-item { border-radius:0; }
  :host([panel-host]) .hpf-nav-modes > * + * { margin-inline-start:-1px; }
  :host([panel-host]) .hpf-nav-modes > .hpf-nav-item:first-child { border-radius:7px 0 0 7px; }
  :host([panel-host]) .hpf-nav-modes > .hpf-nav-item:last-child,
  :host([panel-host]) .hpf-nav-modes > .hpf-nav-item:has(+ .editor-close-slot[aria-hidden='true']) { border-radius:0 7px 7px 0; }
  :host([panel-host]) .hpf-nav-modes > .hpf-nav-item.active::after { display:none; }
  :host([panel-host]) .hpf-nav-modes > .hpf-nav-item:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  :host([panel-host]) .hpf-nav-modes > .editor-close-slot[aria-hidden='true'] { display:none; }
  :host([panel-host]) .hpf-nav-modes > .editor-close-slot:not([aria-hidden='true']) { position:relative; width:44px; height:44px; border:1px solid var(--divider-color); border-radius:0 7px 7px 0; }
  :host([panel-host]) .hpf-nav-modes .closex { position:absolute; inset:-1px; width:44px; height:44px; color:var(--primary-text-color); opacity:1; }
`.cssText + `
  .hpf-navigation > .hpf-nav-item { ${settingsActionTransition} }
  :host([data-pointer-hover]) .hpf-navigation > .hpf-nav-item:not(:disabled):hover { ${settingsActionHover} z-index:2; }
  ${controlReducedMotionCss('.hpf-navigation > .hpf-nav-item, .hpf-nav-modes .closex')}
`);
