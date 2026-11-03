import { css, unsafeCSS } from 'lit';
import { settingsActionHover, settingsActionTransition } from './settings-action.styles';
import { controlReducedMotionCss } from './ui-motion.styles';

/** Common outlined navigation segments for both placements. */
export const navigationStyles = unsafeCSS(css`
  .hpf-navigation { display:inline-flex; align-items:center; border-radius:9px; isolation:isolate; }
  .hpf-navigation > .hpf-nav-item {
    box-sizing:border-box; position:relative; display:inline-flex; align-items:center; justify-content:center;
    gap:8px; min-width:44px; min-height:44px; border:1px solid transparent; border-radius:7px;
    font:inherit; font-size:13px; font-weight:600; line-height:20px; cursor:pointer;
  }
  .hpf-navigation > .hpf-nav-item:disabled { opacity:.5; cursor:not-allowed; }
  .hpf-navigation > .hpf-nav-item:not(:disabled):active { box-shadow:inset 0 0 0 2px var(--primary-color); }
  .hpf-nav-item ha-icon { --mdc-icon-size:20px; }
  .hpf-nav-item > .tabedit { --mdc-icon-size:20px; cursor:pointer; }
  .hpf-nav-compact > .hpf-nav-item { padding:0; }
  .hpf-nav-modes > .editor-close-slot { box-sizing:border-box; display:inline-flex; flex:none; align-items:center; justify-content:center; }
  .hpf-nav-modes .closex { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; padding:0; margin:0; border:0; border-radius:5px; background:transparent; font:inherit; cursor:pointer; }
  .hpf-nav-modes .closex ha-icon { --mdc-icon-size:13px; }
  .hpf-nav-modes .closex:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px; }
  .hpf-navigation { padding:0; gap:10px; background:transparent; }
  .hpf-navigation > .hpf-nav-item { height:44px; padding:0 12px; border-color:var(--divider-color); background:transparent; color:var(--primary-text-color); }
  .hpf-navigation > .hpf-nav-item.active { border-color:var(--primary-color); z-index:1; }
  .hpf-navigation.hpf-nav-floating {
    gap:var(--sp-2); padding:var(--sp-2); background:var(--hp-bg);
    border:1px solid var(--hp-line); border-radius:var(--rad-l); box-shadow:var(--shadow-2);
  }
  .hpf-navigation.hpf-nav-vertical { display:flex; flex-direction:column; overflow-y:auto; touch-action:pan-y; overscroll-behavior:contain; }
  .hpf-nav-vertical > .hpf-nav-item { flex:0 0 44px; }
  .hpf-navigation.hpf-nav-flush-left { border-top-left-radius:0; border-bottom-left-radius:0; }
  .hpf-nav-floating > .hpf-nav-item.active {
    color:var(--hp-accent); background:var(--hpf-tint, color-mix(in srgb, var(--hp-accent) 12%, transparent));
  }
  .hpf-navigation > .hpf-nav-item:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  .hpf-navigation > .hpf-nav-item.hp-dialog-return-focus:focus-visible { outline:none; }
  .hpf-nav-item > .tabtitle { line-height:42px; }
  .hpf-nav-item:has(> .tabedit) { padding:0; gap:0; }
  .hpf-nav-item:has(> .tabedit) > .tabtitle { padding-inline:12px; }
  .hpf-nav-item > .tabedit { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:44px; height:42px; min-width:44px; margin:0; border-inline-start:1px solid var(--divider-color); border-radius:0 6px 6px 0; opacity:1; }
  .hpf-nav-compact { gap:0; }
  .hpf-nav-compact > .compact-space-settings { margin-inline-start:-1px; border-radius:0 7px 7px 0; }
  .hpf-nav-compact > .tabadd { margin-inline-start:10px; }
  .hpf-nav-compact > .hpf-nav-item, .tabs > .tabadd { padding:0; width:44px; }
  .hpf-nav-modes { --hp-editor-close-size:44px; gap:0; }
  .hpf-nav-modes > .hpf-nav-item { border-radius:0; }
  .hpf-nav-modes > * + * { margin-inline-start:-1px; }
  .hpf-nav-modes > .hpf-nav-item:first-child { border-radius:7px 0 0 7px; }
  .hpf-nav-modes > .hpf-nav-item:last-child,
  .hpf-nav-modes > .hpf-nav-item:has(+ .editor-close-slot[aria-hidden='true']) { border-radius:0 7px 7px 0; }
  .hpf-nav-modes > .hpf-nav-item.active::after { display:none; }
  .hpf-nav-modes > .editor-close-slot[aria-hidden='true'] { display:none; }
  .hpf-nav-modes > .editor-close-slot:not([aria-hidden='true']) { position:relative; width:44px; height:44px; border:1px solid var(--divider-color); border-radius:0; }
  .hpf-nav-modes > .editor-close-slot:last-child:not([aria-hidden='true']) { border-radius:0 7px 7px 0; }
  .hpf-nav-modes .closex { position:absolute; inset:-1px; width:44px; height:44px; border:1px solid transparent; border-radius:inherit; color:var(--primary-text-color); opacity:1; }
`.cssText + `
  .hpf-navigation > .hpf-nav-item, .hpf-nav-modes .closex { ${settingsActionTransition} }
  :host([data-pointer-hover]) .hpf-navigation > .hpf-nav-item:not(:disabled):hover { ${settingsActionHover} z-index:2; }
  :host([data-pointer-hover]) .hpf-nav-modes .closex:not(:disabled):hover { ${settingsActionHover} }
  :host([data-pointer-hover]) .hpf-nav-modes > .editor-close-slot:has(.closex:hover),
  :host([data-pointer-hover]) .hpf-nav-compact > .compact-space-select:hover { position:relative; z-index:3; }
  ${controlReducedMotionCss('.hpf-navigation > .hpf-nav-item, .hpf-nav-modes .closex')}
`);
