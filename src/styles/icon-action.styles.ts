import { css, unsafeCSS } from 'lit';
import { settingsActionHover, settingsActionTransition } from './settings-action.styles';
import { controlReducedMotionCss } from './ui-motion.styles';

/** Icon actions and joined groups. Placement belongs to the caller; paint to the kit. */
export const iconActionStyles = unsafeCSS(css`
  button.hpf-icon-action {
    box-sizing:border-box; display:inline-flex; flex:none;
    align-items:center; justify-content:center; width:44px; min-width:44px;
    height:44px; min-height:44px; margin:0; padding:0;
    border:1px solid var(--hpf-line,var(--divider-color));
    border-radius:var(--hpf-action-radius,7px); background:transparent;
    color:var(--primary-text-color); font:inherit; font-size:13px; line-height:20px;
  }
  button.hpf-icon-action:not(:disabled) { cursor:pointer; }
  button.hpf-icon-action.on { background:transparent; color:var(--primary-text-color); border-color:var(--primary-color); z-index:1; }
  button.hpf-icon-action:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; z-index:2; }
  button.hpf-icon-action:not(:disabled):active { background:color-mix(in srgb,var(--primary-color) 16%,transparent); }
  button.hpf-icon-action:disabled { opacity:.5; cursor:not-allowed; }
  button.hpf-icon-action[hidden],.hpf-icon-group[hidden] { display:none!important; }
  button.hpf-icon-action ha-icon { margin:0; --mdc-icon-size:20px; }
  .hpf-icon-glyph { display:block; width:20px; height:20px; flex:none; fill:none; }
  button.hpf-icon-action > .hpf-icon-glyph-large { width:24px; height:24px; transform:translate(1.5px,1.5px); pointer-events:none; }
  .hpf-icon-group { display:inline-flex; flex:none; height:44px; gap:0; padding:0; border:0; background:transparent; overflow:visible; }
  .hpf-icon-group > button.hpf-icon-action { position:relative; border-radius:0; }
  .hpf-icon-group > button.hpf-icon-action + button.hpf-icon-action { margin-inline-start:-1px; }
  .hpf-icon-group > button.hpf-icon-action:first-child { border-radius:var(--hpf-action-radius,7px) 0 0 var(--hpf-action-radius,7px); }
  .hpf-icon-group > button.hpf-icon-action:last-child { border-radius:0 var(--hpf-action-radius,7px) var(--hpf-action-radius,7px) 0; }
  /* The primary-panel camera has two joined groups separated by 10px (#1132). */
  :host([panel-host]) .hpf-camera-group > [data-hp='rotate-right'] { border-radius:0 var(--hpf-action-radius,7px) var(--hpf-action-radius,7px) 0; }
  :host([panel-host]) .hpf-camera-group > button[data-hp='zoom-out'] { margin-inline-start:10px; border-radius:var(--hpf-action-radius,7px) 0 0 var(--hpf-action-radius,7px); }
  button.hpf-icon-action.hpf-icon-plain { border-color:transparent; border-radius:50%; }
  button.hpf-icon-action.hpf-icon-plain ha-icon { --mdc-icon-size:24px; }
  button.hpf-icon-action.hpf-icon-navigation { border-radius:50%; border-color:var(--primary-color); background:var(--card-background-color); color:var(--primary-color); opacity:.9; }
  button.hpf-icon-action.hpf-icon-navigation ha-icon { --mdc-icon-size:22px; }
`.cssText + `
  button.hpf-icon-action { ${settingsActionTransition} }
  :host([data-pointer-hover]) button.hpf-icon-action:not(:disabled):hover { ${settingsActionHover} z-index:1; }
  ${controlReducedMotionCss('button.hpf-icon-action')}
`);
