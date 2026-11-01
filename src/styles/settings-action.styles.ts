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
export function settingsTextLinkCss(selector: string, accent: string, hover = 'var(--primary-text-color)', guardAria = true): string {
  const enabled = `${selector}:not(:disabled)${guardAria ? ':not([aria-disabled=true])' : ''}`;
  return `${enabled} { color:${accent}; background:transparent; border-color:transparent; box-shadow:none; filter:none; cursor:pointer; transition:color ${paint}; }
  ${enabled}${guardAria ? ':is(:hover,:focus-visible:not(.hp-dialog-return-focus))' : ':is(:hover,:focus-visible)'} { color:${hover}; background:transparent; border-color:transparent; box-shadow:none; filter:none; }
  ${controlReducedMotionCss(selector)}`;
}

/** Inline anchor variant, also usable in independently owned help roots. */
export function settingsInlineLinkCss(selector: string): string {
  return `${selector}{display:inline;padding:0;border:0;border-radius:0;text-decoration:underline;font:inherit;font-size:.875rem;font-weight:500;text-underline-offset:3px;touch-action:manipulation;}`
    + settingsTextLinkCss(selector, 'var(--primary-color)');
}

/** Compile-time density recipes. They never leak through an inherited form variable. */
export type ActionDensity = 'standard' | 'editor' | 'history' | 'editor-close'
  | 'editor-back' | 'editor-delete' | 'property' | 'property-choice' | 'property-settings' | 'property-variable';
const standardAction = {
  min: 'var(--hpf-action-height,44px)', padding: '10px var(--hpf-kit-action-padding-inline,14px)',
  border: '1px solid var(--hpf-line,var(--divider-color))', radius: 'var(--hpf-action-radius,7px)',
  gap: '8px', font: 'var(--hpf-kit-action-font-size,13px)', line: 'var(--hpf-kit-action-line-height,20px)',
  icon: '20px', width: 'var(--hpf-kit-action-width,auto)', height: 'var(--hpf-kit-action-height,auto)',
};
const editorAction = { ...standardAction, min: '0', padding: '6px 10px', radius: '7px',
  gap: '6px', font: '13px', line: 'normal', icon: '17px', width: 'auto', height: 'auto' };
const propertyAction = { ...standardAction, min: '36px', padding: '3px 6px', radius: '5px',
  font: '12px', line: '1.25', icon: '16px', width: '100%', height: 'auto' };
const actionDensity = {
  standard: standardAction,
  editor: editorAction,
  history: { ...editorAction, border: '0' },
  'editor-back': { ...editorAction, min:'34px', border:'0', gap:'5px' },
  'editor-delete': { ...editorAction, min:'30px', width:'30px', height:'30px', padding:'3px', border:'0' },
  'editor-close': { ...editorAction, min: '40px', padding: '0', gap: '0', line: '0', width: '40px', height: '40px' },
  property: propertyAction,
  'property-choice': { ...propertyAction, min: '35px', padding: '5px', gap: '7px', line: 'normal' },
  'property-settings': { ...propertyAction, min: '39px', padding: '5px', line: 'normal' },
  'property-variable': { ...propertyAction, min: '0', padding: '5px', line: 'normal', height: '33px' },
};

/** The same controls in card-owned forms and the PDF component's own root. */
export function settingsActionsCss(selector: string, primary = '.on', { variant = 'standard', density = 'standard', intrinsicContent = false }: { intrinsicContent?: boolean; variant?: 'standard' | 'navigation' | 'choice'; density?: ActionDensity } = {}): string {
  const recipe = actionDensity[density];
  const intrinsicWords = !intrinsicContent && (density === 'editor' || density === 'history' || density === 'editor-back');
  const navigation = variant === 'navigation';
  const enabled = `${selector}:not(:disabled):not([aria-disabled=true])`;
  const tinted = navigation || variant === 'choice';
  return `
    ${selector}{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:${navigation ? 'flex-start' : 'center'};gap:${recipe.gap};min-height:${recipe.min};min-width:${density === 'editor-close' ? '40px' : density === 'editor-delete' ? '30px' : intrinsicWords ? 'auto' : '0'};max-width:100%;width:${recipe.width};height:${recipe.height};justify-self:var(--hpf-kit-action-justify-self,auto);padding:${navigation ? '9px 10px' : recipe.padding};border:${navigation ? '0' : recipe.border};border-radius:${recipe.radius};background:transparent;color:var(--primary-text-color);font:inherit;font-size:${navigation ? '12px' : recipe.font};line-height:${navigation ? '1.35' : recipe.line};${navigation ? 'text-align:start;' : ''}white-space:normal;overflow-wrap:${intrinsicWords ? 'normal' : 'anywhere'};${settingsActionTransition}}
    ${selector}${primary}{background:${tinted ? 'var(--hpf-tint,color-mix(in srgb,var(--primary-color) 10%,transparent))' : 'var(--hpf-accent,var(--primary-color))'};color:${tinted ? 'var(--hpf-accent,var(--primary-color))' : 'var(--text-primary-color,#fff)'};border-color:${tinted ? 'transparent' : 'var(--hpf-accent,var(--primary-color))'};${navigation ? 'font-weight:600;' : ''}}
    ${selector}.danger{color:var(--hpf-danger,var(--error-color,#db543d));border-color:var(--hpf-danger,var(--error-color,#db543d));}
    ${selector}.danger:not(:hover):not(:focus-visible){border-color:var(--hpf-kit-action-idle-danger-border,var(--hpf-danger,var(--error-color,#db543d)));}
    ${enabled}{cursor:pointer;}
    ${enabled}:is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${settingsActionHover}}
    ${selector}${primary}:not(:disabled):not([aria-disabled=true]):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){${tinted ? settingsActionHover : settingsPrimaryActionHover}}
    ${selector}.danger:not(:disabled):not([aria-disabled=true]):is(:hover,:focus-visible:not(.hp-dialog-return-focus)){background:color-mix(in srgb,var(--hpf-danger,var(--error-color,#db543d)) 10%,transparent);color:var(--hpf-danger,var(--error-color,#db543d));border-color:var(--hpf-danger,var(--error-color,#db543d));box-shadow:0 0 0 1px color-mix(in srgb,var(--hpf-danger,var(--error-color,#db543d)) 38%,transparent);}
    ${selector}:is(:disabled,[aria-disabled=true]){cursor:not-allowed;opacity:.5;}
    ${selector} ha-icon{display:${density === 'standard' ? 'inline-flex' : 'inline-block'};align-items:center;line-height:${density === 'standard' ? '1' : 'normal'};margin:0;flex:none;--mdc-icon-size:${recipe.icon};}
    ${selector} ha-icon.hpf-action-chevron{--mdc-icon-size:16px;transition:transform var(--hpf-appear-duration,180ms) var(--hpf-appear-easing,ease-out);}
    ${selector}[aria-expanded=true] ha-icon.hpf-action-chevron{transform:rotate(180deg);}
    ${selector}.hpf-action-wide{min-width:88px;}
    ${selector}.hpf-action-fill{width:100%;}
    ${selector}.hpf-action-icon{width:44px;min-width:44px;padding:0;}
    ${selector}.hpf-action-picker{justify-content:space-between;text-align:start;}
    ${selector}.hpf-action-option{display:grid;justify-content:stretch;align-content:center;text-align:start;border-color:transparent;box-shadow:none;}
    ${selector}.hpf-action-option[aria-selected=true],${selector}.hpf-action-toggle[aria-pressed=true]{color:var(--hpf-accent,var(--primary-color));border-color:var(--hpf-accent,var(--primary-color));background:var(--hpf-tint);}
    ${selector}.hpf-action-warning{color:var(--warning-color);}
    ${intrinsicContent ? '' : `${selector} svg{display:block;flex:none;width:${recipe.icon};height:${recipe.icon};}`}
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
