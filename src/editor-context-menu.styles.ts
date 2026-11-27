import { css, unsafeCSS } from 'lit';
import { floatingSurfaceCss } from './styles/floating-surface.styles';
import { controlReducedMotionCss } from './styles/ui-motion.styles';
import { settingsActionTransition } from './styles/settings-action.styles';

export const editorContextMenuStyles = unsafeCSS(css`
  .hpf-context-menu {
    position: fixed; z-index: 10000; display: grid; gap: 0;
    min-width:0; overflow:auto;
    font-family: inherit; font-size: 12px; line-height: 18px;
  }
  .hpf-context-menu > button {
    box-sizing: border-box; display: flex; align-items: center; justify-content: flex-start; gap: 6px;
    width: 100%; min-width: 0; min-height: 32px; margin: 0; padding: 5px 13px;
    border: 1px solid transparent; border-radius: 0; color: inherit; background: transparent;
    font: inherit; line-height: 18px; text-align: start; white-space:normal; cursor: pointer;
    box-shadow: none; outline: none; `.cssText + settingsActionTransition + css` }
  .hpf-context-menu > button + button { border-top: 2px solid var(--primary-color,#03a9f4); padding-block-start:6px; }
  :host([data-pointer-hover]) .hpf-context-menu > button:hover:not(:disabled),
  .hpf-context-menu > button:is(.hpf-tab-focus,.hpf-keyboard-current):focus:not(:disabled) {
    background: color-mix(in srgb,var(--primary-color,#03a9f4) 12%,transparent);
  }
  .hpf-context-menu > button:disabled { opacity: 1; color: color-mix(in srgb,var(--primary-text-color,#222) 40%,transparent); cursor: not-allowed; }
  .hpf-context-menu-touch { font-size:13px; line-height:20px; }
  .hpf-context-menu-touch > button { min-height:44px; padding:11px 13px; gap:10px; line-height:20px; }
  .hpf-context-menu-touch > button + button { padding-block-start:12px; }
  .hpf-context-menu-touch > button > :is(ha-icon, svg) { --mdc-icon-size:20px; width:20px; height:20px; flex:none; }
  .hpf-context-menu > button:is([aria-current='true'], [aria-pressed='true']) { color:var(--primary-color,#03a9f4); font-weight:600; }
  .hpf-context-menu.hpf-context-menu-disclosure {
    display:flex; flex-direction:column; overscroll-behavior:contain;
    border-radius:0; box-shadow:none; margin:0; padding:0;
  }
  .hpf-context-menu-disclosure > button { flex-shrink:0; }
  .hpf-context-menu-disclosure .header-menu-label { display:flex; align-items:center; gap:10px; min-width:0; line-height:20px; }
  .hpf-context-menu-disclosure .header-menu-label > :is(ha-icon,svg) { --mdc-icon-size:18px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 18px; width:18px; height:18px; pointer-events:none; }
  .hpf-context-menu-disclosure > button[data-action='summary-toggle'] { font-weight:inherit; color:var(--primary-text-color); }
  .hpf-context-menu-scrim { position:fixed; inset:0; z-index:1; background:transparent; }
  .hpf-context-menu[inert] { pointer-events: none; }
`.cssText + floatingSurfaceCss('.hpf-context-menu', '0') + controlReducedMotionCss('.hpf-context-menu > button'));
