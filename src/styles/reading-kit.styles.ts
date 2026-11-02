import { css, unsafeCSS } from 'lit';
import { settingsActionsCss } from './settings-action.styles';
import { controlReducedMotionCss } from './ui-motion.styles';

/** Static reading copy never advertises an action or competes with selection. */
export function staticReadingCss(selector: string): string {
  return `${selector} { cursor:default; user-select:none; -webkit-user-select:none; }`;
}

/** Finite compact reading scale, shared by editor panels, trays and dense lists. */
export function readingTextCss(selector: string, variant: 'title' | 'heading' | 'caption' | 'label' | 'note' | 'tiny' | 'feature' | 'form-label' | 'body-note' | 'category' | 'action-heading' = 'caption', tone: 'primary' | 'secondary' | 'error' = 'secondary'): string {
  const scale = {
    title: { size: '17px', line: '1.4', weight: '600', spacing: '-.25px' },
    'action-heading': { size:'16px', line:'24px', weight:'600', spacing:'normal' },
    heading: { size: '13px', line: '1.4', weight: '650', spacing: '.08px' },
    caption: { size: '12px', line: '1.4', weight: '400', spacing: 'normal' },
    label: { size: '12px', line: '16px', weight: '400', spacing: 'normal' },
    note: { size: '11px', line: '1.45', weight: '400', spacing: 'normal' },
    tiny: { size: '10px', line: '1.4', weight: '400', spacing: 'normal' },
    'body-note': { size:'13px', line:'1.6', weight:'400', spacing:'normal' },
    category: { size:'12px', line:'1.4', weight:'400', spacing:'.04em' },
    'form-label': { size:'13px', line:'22px', weight:'600', spacing:'normal' },
    feature: { size: '12px', line: '16px', weight: '400', spacing: 'normal' },
  }[variant];
  const color = tone === 'primary' ? '--primary-text-color' : tone === 'error' ? '--error-color' : '--secondary-text-color';
  return `${selector} { color:var(${color}); font-size:${scale.size}; font-weight:${scale.weight}; line-height:${scale.line}; letter-spacing:${scale.spacing};${variant === 'body-note' ? 'font-family:inherit;' : ''}${variant === 'category' ? 'text-transform:uppercase;' : ''} overflow-wrap:anywhere; }`;
}

/** Glyph geometry for compact labels and section headings; path art stays with its icon. */
export function readingGlyphCss(selector: string, size: 'lock' | 'section' | 'normal' | 'preview' | 'avatar' = 'normal', tone: 'inherit' | 'primary' | 'secondary' | 'accent' = 'inherit'): string {
  const pixels = { lock:10, section:15, normal:20, preview:22, avatar:28 }[size];
  const color = tone === 'inherit' && size === 'section' ? 'secondary' : tone;
  const token = { primary:'--primary-text-color', secondary:'--secondary-text-color', accent:'--primary-color' };
  return `${selector} { width:${pixels}px; height:${pixels}px; flex:none;--mdc-icon-size:${pixels}px;${color === 'inherit' ? '' : `color:var(${token[color]});`} }`;
}

/** A docked editor is a reading surface, not an independent palette. */
export function readingSidePanelCss(selector: string): string {
  return `${selector} { color:var(--primary-text-color); background:var(--card-background-color); border-inline-start:1px solid var(--divider-color); font:14px/1.4 'Segoe UI',Arial,sans-serif; text-align:start; box-sizing:border-box; }`;
}

export function readingSeparatorCss(selector: string, edge: 'block-start' | 'inline-end' = 'block-start'): string {
  return `${selector} { border-${edge}:1px solid var(--divider-color); }`;
}

export function readingShortcutCss(selector: string): string {
  return `${selector} { border:1px solid var(--divider-color); border-radius:3px; background:var(--hpf-canvas,var(--secondary-background-color)); font:inherit; font-size:10px; line-height:1.4; padding:0 5px; }`;
}

/** Read-only kit: headings, cards, labelled values, status and floating badges. */
export const readingKitStyles = unsafeCSS(css`
  .hpf-divider-before { border-block-start:1px solid var(--divider-color); }
  .hpf-table { width:100%; border-collapse:collapse; font-size:14px; }
  .hpf-table th { padding:10px 12px; text-align:start; font-size:12px; font-weight:600; color:var(--secondary-text-color); border-bottom:1px solid var(--divider-color); }
  .hpf-table td { padding:12px; border-bottom:1px solid var(--divider-color); vertical-align:middle; }
  .hpf-table tr:last-child td { border-bottom:0; }
  .hpf-heading { box-sizing:border-box; margin:0; color:var(--primary-text-color); font-size:16px; font-weight:600; line-height:1.4; overflow-wrap:anywhere; }
  .hpf-heading-inline { display:flex; align-items:center; gap:8px; white-space:nowrap; }
  .hpf-heading-inline ha-icon { color:var(--primary-color); --mdc-icon-size:20px; flex:none; }
  .hpf-heading-banner { padding:10px 14px; }
  .hpf-heading-pane { flex:none; min-height:48px; padding:14px; background:var(--card-background-color); border-bottom:1px solid var(--divider-color); }
  .hpf-heading-section { min-height:43px; padding:12px 14px; font-size:14px; border-bottom:1px solid var(--divider-color); }
  .hpf-chrome-group { background:var(--card-background-color); border-bottom:1px solid var(--divider-color); border-radius:var(--ha-card-border-radius,12px) var(--ha-card-border-radius,12px) 0 0; }
  .hpf-reading-surface { box-sizing:border-box; color:var(--primary-text-color); background:var(--secondary-background-color); border:1px solid var(--divider-color); border-radius:12px; box-shadow:0 8px 26px rgb(0 0 0 / 16%); font-size:14px; line-height:1.4; }
  .hpf-reading-scroll { min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:10px; }
  .hpf-reading-block { min-width:0; border:1px solid var(--divider-color); border-radius:11px; background:var(--card-background-color); }
  .hpf-reading-padded { padding:14px; }
  .hpf-reading-entry { min-width:0; padding:12px 0; overflow-wrap:anywhere; }
  .hpf-reading-entry + .hpf-reading-entry { border-top:1px solid var(--divider-color); }
  .hpf-reading-entry > p { margin:4px 0; font-size:14px; line-height:1.5; white-space:pre-wrap; }
  .hpf-reading-entry code { display:block; min-width:0; font-size:12px; white-space:pre-wrap; overflow-wrap:anywhere; }
  .hpf-reading-row { display:flex; align-items:center; gap:12px; box-sizing:border-box; min-height:44px; font-size:13px; line-height:1.5; }
  .hpf-reading-row.hpf-reading-choice { margin:0; padding:10px 12px; border-radius:7px; font-size:14px; line-height:24px; cursor:pointer; transition:background var(--hpf-paint-duration,160ms) var(--hpf-paint-easing,ease); }
  .hpf-reading-choice:hover { background:var(--hpf-canvas,var(--secondary-background-color)); }
  .hpf-reading-row > ha-icon { flex:none; --mdc-icon-size:20px; color:var(--secondary-text-color); }
  .hpf-reading-row.on > ha-icon { color:var(--primary-color); }
  .hpf-reading-row > .hpf-reading-label { flex:1; }
  .hpf-reading-label { min-width:0; overflow-wrap:anywhere; color:var(--secondary-text-color); }
  .hpf-state-ok { color:var(--success-color,#4caf50); }
  .hpf-state-warn { color:var(--warning-color,#ff9800); }
  .hpf-reading-value { min-width:0; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; text-align:end; }
  .hpf-reading-pair { box-sizing:border-box; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,auto); align-items:baseline; gap:10px; min-height:36px; padding:8px 0; border-bottom:1px solid var(--divider-color); }
  .hpf-reading-pair:last-child { border-bottom:0; }
  .hpf-reading-pair > strong { font-weight:700; }
  .hpf-reading-pair > strong:not(.hpf-loading-value) { animation:hp-ui-appear var(--hpf-appear-duration) var(--hpf-appear-easing) both; }
  .hpf-reading-empty { margin:0; padding:10px 11px; color:var(--secondary-text-color); }
  .hpf-reading-copy { min-width:0; overflow-x:hidden; }
  .hpf-reading-copy > p { max-width:100%; min-width:0; margin:0; overflow-wrap:anywhere; white-space:normal; }
  .hpf-loading-value { display:flex; align-items:center; justify-content:flex-end; min-height:1.2em; }
  .hpf-loading-value > i { display:block; width:4.5em; max-width:100%; height:1.2em; border-radius:5px; background:var(--secondary-text-color); opacity:.18; --hpf-loading-low:.12; --hpf-loading-high:.28; animation:hp-ui-pulse var(--hpf-pulse-duration) var(--hpf-pulse-easing) infinite; }
  .hpf-state-chip { display:inline-flex; align-items:center; gap:8px; color:var(--secondary-text-color); font-size:13px; line-height:20px; }
  .hpf-state-chip.on { color:var(--primary-text-color); }
  .hpf-state-chip ha-icon { --mdc-icon-size:20px; }
  .hpf-floating-badge { box-sizing:border-box; display:flex; align-items:center; gap:8px; padding:4px 12px; border:1px solid var(--divider-color); border-radius:7px; background:var(--card-background-color); color:var(--primary-text-color); opacity:.94; font-size:13px; line-height:20px; }
  .hpf-floating-badge > ha-icon { --mdc-icon-size:20px; color:var(--warning-color,#ff9800); flex:none; }
  .hpf-floating-badge > span { min-width:0; white-space:normal; overflow-wrap:anywhere; }
  .hpf-floating-badge-scale { border-color:var(--primary-color); font-weight:600; opacity:.92; }
  .hpf-floating-badge[hidden] { display:none!important; }
  .hpf-dot { display:inline-block; width:9px; height:9px; border-radius:50%; background:var(--secondary-text-color); opacity:.55; }
  .hpf-dot.on { background:var(--primary-color); opacity:1; }
  .hpf-file-list { box-sizing:border-box; display:flex; flex:0 0 auto; flex-direction:column; gap:8px; min-height:2.6em; max-height:240px; overflow:auto; margin:8px 0 4px; padding:8px; border:1px solid var(--divider-color); border-radius:7px; background:var(--secondary-background-color); }
  .hpf-file-row { display:flex; flex-wrap:wrap; align-items:center; gap:10px; min-width:0; }
  .hpf-file-row.cur { outline:1px solid var(--primary-color); border-radius:5px; }
  .hpf-file-thumbnail { box-sizing:border-box; width:56px; height:40px; flex:none; object-fit:contain; border:1px solid var(--divider-color); border-radius:5px; background:#fff; }
  .hpf-file-preview { max-width:120px; max-height:70px; object-fit:contain; border:1px solid var(--divider-color); border-radius:5px; background:#fff; }
  .hpf-empty-state { box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:40px 24px; color:var(--primary-text-color); text-align:center; font-size:13px; line-height:1.5; }
  .hpf-empty-state-list { padding:16px; }
  .hpf-empty-state > .big { --mdc-icon-size:56px; color:var(--primary-color); opacity:.7; }
  .hpf-empty-state > .muted { margin:0; color:var(--secondary-text-color); font-size:13px; }
  .hpf-empty-state-error { color:var(--secondary-text-color); padding:24px; }
  .hpf-empty-state-overlay { padding:24px; background:linear-gradient(var(--ha-card-background,var(--card-background-color,#111)),var(--ha-card-background,var(--card-background-color,#111))),#111; color:var(--primary-text-color,#fff); transition:opacity var(--hpf-appear-duration) var(--hpf-appear-easing); }
  .hpf-empty-state-overlay.phase-entering,.hpf-empty-state-overlay.phase-leaving { opacity:0; }
  .hpf-empty-state-overlay.phase-fading-in,.hpf-empty-state-overlay.phase-opaque { opacity:1; }
  .hpf-empty-state-overlay.phase-leaving { transition-duration:var(--hpf-leave-duration); transition-timing-function:var(--hpf-leave-easing); }
  .hpf-empty-state-overlay > ha-icon { --mdc-icon-size:44px; color:var(--primary-color); }
  .hpf-loading-pill { display:flex; align-items:center; gap:8px; padding:8px 16px; border:1px solid color-mix(in srgb,var(--primary-color) 45%,transparent); border-radius:999px; background:color-mix(in srgb,var(--ha-card-background,var(--card-background-color,#111)) 92%,transparent); color:var(--primary-text-color); box-shadow:0 6px 22px rgb(0 0 0 / 18%); animation:hp-ui-appear var(--hpf-appear-duration) var(--hpf-appear-easing) both; }
  .hpf-loading-pill > ha-icon { --mdc-icon-size:22px; color:var(--primary-color); animation:hp-ui-spin var(--hpf-spin-duration) var(--hpf-spin-easing) infinite; }
  .hpf-spinner { animation:hp-ui-spin var(--hpf-spin-duration) var(--hpf-spin-easing) infinite; }
  .hpf-boot { color:var(--primary-color); background:var(--card-background-color,#16212e); opacity:1; transition:opacity var(--hpf-leave-duration) var(--hpf-leave-easing); }
  .hpf-boot.off { opacity:0; }
  .hpf-boot > svg { width:56px; height:56px; fill:currentColor; opacity:.85; animation:hp-ui-pulse var(--hpf-pulse-duration) var(--hpf-pulse-easing) infinite; }
`.cssText + staticReadingCss('.hpf-heading') + settingsActionsCss(':is(.hpf-empty-state, .hpf-floating-badge, .hpf-reading-entry) button.btn')
  + controlReducedMotionCss('.hpf-loading-value > i, .hpf-reading-pair > strong, .hpf-loading-pill, .hpf-loading-pill > ha-icon, .hpf-boot > svg, .hpf-empty-state-overlay, .hpf-spinner'));
