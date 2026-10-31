import { css, unsafeCSS } from 'lit';
import { controlReducedMotionCss } from './styles/ui-motion.styles';
import { settingsActionTransition } from './styles/settings-action.styles';

export const editorContextMenuStyles = unsafeCSS(css`
  .hpf-context-menu {
    position: fixed; z-index: 10000; display: grid; gap: 0;
    box-sizing: border-box; min-width: 0; padding: 0; border: 0; border-radius: 0;
    background: var(--card-background-color,#fff); color: var(--primary-text-color,#222);
    box-shadow: 0 6px 24px #0004; overflow: auto;
    font-family: inherit; font-size: 12px; line-height: 18px;
  }
  .hpf-context-menu > button {
    box-sizing: border-box; display: flex; align-items: center; justify-content: flex-start; gap: 6px;
    width: 100%; min-width: 0; min-height: 32px; margin: 0; padding: 6px 14px;
    border: 0; border-radius: 0; color: inherit; background: transparent;
    font: inherit; line-height: 18px; text-align: start; white-space:normal; cursor: pointer;
    box-shadow: none; outline: none; `.cssText + settingsActionTransition + css` }
  .hpf-context-menu > button + button { border-top: 2px solid var(--primary-color,#03a9f4); }
  :host([data-pointer-hover]) .hpf-context-menu > button:hover:not(:disabled),
  .hpf-context-menu > button:focus-visible:not(:disabled) {
    color: var(--primary-color,#03a9f4);
    background: color-mix(in srgb,var(--primary-color,#03a9f4) 12%,transparent);
  }
  .hpf-context-menu > button:disabled { opacity: 1; color: color-mix(in srgb,var(--primary-text-color,#222) 40%,transparent); cursor: not-allowed; }
  .hpf-context-menu-touch { font-size:13px; line-height:20px; }
  .hpf-context-menu-touch > button { min-height:44px; padding:12px 14px; gap:10px; line-height:20px; }
  .hpf-context-menu-touch > button > :is(ha-icon, svg) { --mdc-icon-size:20px; width:20px; height:20px; flex:none; }
  .hpf-context-menu > button:is([aria-current='true'], [aria-pressed='true']) { color:var(--primary-color,#03a9f4); font-weight:600; }
  .hpf-context-menu-scrim { position:fixed; inset:0; z-index:1; background:transparent; }
  .hpf-context-menu[inert] { pointer-events: none; }
`.cssText + controlReducedMotionCss('.hpf-context-menu > button'));
