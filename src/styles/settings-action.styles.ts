import { controlMotion } from '../ui-motion';
import { controlReducedMotionCss } from './ui-motion.styles';

/** Shared interaction paint for settings actions, confirmations and pickers. */
const paint = `${controlMotion.paint.duration}ms ${controlMotion.paint.easing}`;
export const settingsActionTransition = `transition:background ${paint},color ${paint},border-color ${paint},box-shadow ${paint};`;
export const settingsActionHover = 'background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 10%,transparent));color:var(--hpf-accent,var(--primary-color,#03a9f4));border-color:var(--hpf-accent,var(--primary-color,#03a9f4));box-shadow:0 0 0 1px var(--hpf-tint-line,var(--primary-color,#03a9f4));filter:brightness(1.08);';
export const settingsPrimaryActionHover = `${settingsActionHover}background:color-mix(in srgb,var(--hpf-accent,var(--primary-color,#03a9f4)) 90%,#000);color:var(--text-primary-color,#fff);`;

export function settingsInteractiveCss(selector: string): string {
  return `${selector}{cursor:pointer;${settingsActionTransition}}
    ${selector}:is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${settingsActionHover}outline:none;text-decoration:none;}`;
}

/** Text links change ink only, including in a compact dialog or an empty view. */
export function settingsTextLinkCss(selector: string, accent: string, hover = 'var(--primary-text-color)'): string {
  const enabled = `${selector}:not(:disabled)`;
  return `${enabled} { color:${accent}; background:transparent; border-color:transparent; box-shadow:none; filter:none; cursor:pointer; transition:color ${paint}; }
  ${enabled}:is(:hover,:focus-visible) { color:${hover}; background:transparent; border-color:transparent; box-shadow:none; filter:none; }
  ${controlReducedMotionCss(selector)}`;
}

/** Inline anchor variant, also usable in independently owned help roots. */
export function settingsInlineLinkCss(selector: string): string {
  return `${selector}{display:inline;padding:0;border:0;border-radius:0;text-decoration:underline;font:inherit;font-size:.875rem;font-weight:500;text-underline-offset:3px;touch-action:manipulation;}`
    + settingsTextLinkCss(selector, 'var(--primary-color)');
}

/** The same controls in card-owned forms and the PDF component's own root. */
export function settingsActionsCss(selector: string, primary = '.on', { variant = 'standard' }: { variant?: 'standard' | 'navigation' | 'choice' } = {}): string {
  const navigation = variant === 'navigation';
  const tinted = navigation || variant === 'choice';
  return `
    ${selector}{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:${navigation ? 'flex-start' : 'center'};gap:8px;min-height:var(--hpf-action-height,44px);min-width:0;max-width:100%;width:var(--hpf-kit-action-width,auto);height:var(--hpf-kit-action-height,auto);justify-self:var(--hpf-kit-action-justify-self,auto);padding:${navigation ? '9px 10px' : '10px var(--hpf-kit-action-padding-inline,14px)'};border:${navigation ? '0' : '1px solid var(--hpf-line,var(--divider-color))'};border-radius:var(--hpf-action-radius,7px);background:transparent;color:var(--primary-text-color);font:inherit;font-size:${navigation ? '12px' : 'var(--hpf-kit-action-font-size,13px)'};line-height:${navigation ? '1.35' : 'var(--hpf-kit-action-line-height,20px)'};${navigation ? 'text-align:start;' : ''}white-space:normal;overflow-wrap:anywhere;${settingsActionTransition}}
    ${selector}${primary}{background:${tinted ? 'var(--hpf-tint,color-mix(in srgb,var(--primary-color) 10%,transparent))' : 'var(--hpf-accent,var(--primary-color))'};color:${tinted ? 'var(--hpf-accent,var(--primary-color))' : 'var(--text-primary-color,#fff)'};border-color:${tinted ? 'transparent' : 'var(--hpf-accent,var(--primary-color))'};${navigation ? 'font-weight:600;' : ''}}
    ${selector}.danger{color:var(--error-color);border-color:var(--error-color);}
    ${selector}.danger:not(:hover):not(:focus-visible){border-color:var(--hpf-kit-action-idle-danger-border,var(--error-color));}
    ${selector}:not(:disabled){cursor:pointer;}
    ${selector}:not(:disabled):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${settingsActionHover}}
    ${selector}${primary}:not(:disabled):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${tinted ? settingsActionHover : settingsPrimaryActionHover}}
    ${selector}.danger:not(:disabled):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){background:color-mix(in srgb,var(--error-color) 10%,transparent);color:var(--error-color);border-color:var(--error-color);box-shadow:0 0 0 1px color-mix(in srgb,var(--error-color) 38%,transparent);}
    ${selector}:disabled{cursor:not-allowed;opacity:.5;}
    ${selector} ha-icon{display:inline-flex;align-items:center;line-height:1;margin:0;flex:none;--mdc-icon-size:20px;}
    ${selector}.hpf-action-wide{min-width:88px;}
    ${selector}.hpf-action-fill{width:100%;}
    ${selector}.hpf-action-icon{width:44px;min-width:44px;padding:0;}
    ${selector}.hpf-action-picker{justify-content:space-between;text-align:start;}
    ${selector}.hpf-action-option{display:grid;justify-content:stretch;align-content:center;text-align:start;border-color:transparent;box-shadow:none;}
    ${selector}.hpf-action-option[aria-selected=true],${selector}.hpf-action-toggle[aria-pressed=true]{color:var(--hpf-accent,var(--primary-color));border-color:var(--hpf-accent,var(--primary-color));background:var(--hpf-tint);}
    ${selector}.hpf-action-warning{color:var(--warning-color);}
    ${selector} svg{display:block;flex:none;width:20px;height:20px;}
    ${selector} .hpf-action-caption{display:grid;min-width:0;gap:2px;}
    ${selector} .hpf-action-caption strong{font-size:14px;font-weight:600;overflow-wrap:anywhere;}
    ${selector} :is(small,.hpf-action-caption small){color:var(--secondary-text-color);font-size:12px;overflow-wrap:anywhere;}
    @media(max-width:480px){
      ${selector}.hpf-mobile-icon{width:var(--hpf-kit-mobile-icon-width,44px);min-width:var(--hpf-kit-mobile-icon-min-width,44px);padding-inline:var(--hpf-kit-mobile-icon-padding,0);justify-content:center;}
      ${selector}.hpf-mobile-icon .hpf-action-label{display:var(--hpf-kit-mobile-label-display,none);}
    }
    ${controlReducedMotionCss(selector)}
  `;
}
