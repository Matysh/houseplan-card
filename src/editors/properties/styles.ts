import { css, unsafeCSS } from 'lit';
import { settingsActionTransition, settingsActionHover } from '../../styles/settings-action.styles';

/** Local geometry and palette from the immutable #931 approved reference. */
export const propertiesStyles = unsafeCSS(css`
  ha-card[data-hp-properties-wide] { position: relative; }
  ha-card[data-hp-properties-wide] > .stage,
  ha-card[data-hp-properties-wide] .editorchrome { width: calc(100% - 360px); }
  ha-card[data-hp-properties-wide] > .hdr > .head { width: calc(100% - 360px); box-sizing: border-box; padding-block: 8px; }
  .hp-properties {
    color-scheme: light dark;
    --prop-ink: light-dark(#28343c,var(--primary-text-color,#e6edf3));
    --prop-muted: light-dark(#74818a,var(--secondary-text-color,#8aa0b3));
    --prop-line: light-dark(#e1e6e9,var(--divider-color,#2b3d4f));
    --prop-accent: light-dark(#078a9e,var(--primary-color,#3ea6ff));
    --prop-soft: light-dark(#e8f5f6,var(--secondary-background-color,#1d2b3a));
    --prop-disabled: light-dark(#f5f7f8,var(--secondary-background-color,#1d2b3a));
    --prop-bg: light-dark(#fff,var(--card-background-color,#16212e));
    --prop-input: light-dark(#fbfcfc,var(--secondary-background-color,#1d2b3a));
    --prop-border: light-dark(#d6dfe4,var(--divider-color,#2b3d4f));
    --prop-value: light-dark(#33424c,var(--primary-text-color,#e6edf3));
    --prop-ro: light-dark(#63717b,var(--secondary-text-color,#8aa0b3));
    --prop-unit: light-dark(#89959d,var(--secondary-text-color,#8aa0b3));
    --prop-disabled-ink: light-dark(#bdc5cb,var(--disabled-text-color,#5c7184));
    --prop-disabled-line: light-dark(#edf0f2,var(--divider-color,#2b3d4f));
    --prop-label: light-dark(#78868f,var(--secondary-text-color,#8aa0b3));
    --prop-disabled-label: light-dark(#aab3ba,var(--disabled-text-color,#5c7184));
    --prop-read-border: light-dark(#e7ecef,var(--divider-color,#2b3d4f));
    --prop-hint: light-dark(#8a969e,var(--secondary-text-color,#8aa0b3));
    --hpf-surface: var(--card-background-color,#fff);
    --hpf-accent: var(--hp-accent,var(--primary-color));
    --hpf-tint: color-mix(in srgb,var(--hpf-accent) 10%,var(--hpf-surface));
    --hpf-tint-line: color-mix(in srgb,var(--hpf-accent) 38%,var(--hpf-surface));
    --hpf-danger: var(--error-color,#db543d);
    position: absolute; right: 0; top: 0; bottom: 0;
    width: 360px; min-height: 0; display: flex; flex-direction: column;
    border-left: 1px solid var(--prop-border); background: var(--prop-bg);
    color: var(--prop-ink); font: 14px/1.4 'Segoe UI', Arial, sans-serif;
    box-sizing: border-box; z-index: 21; text-align: left;
  }
  .hp-properties[data-theme='light'] { color-scheme: light; }
  .hp-properties[data-theme='dark'] { color-scheme: dark; }
  .hp-properties *, .hp-properties *::before, .hp-properties *::after { box-sizing: border-box; }
  .hp-properties button, .hp-properties input, .hp-properties textarea, .hp-properties select { font-family: inherit; }
  .hp-properties button { cursor: pointer; }
  .hp-prop-icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  .hp-prop-head { flex: 0 0 auto; padding: 17px 23px 15px; }
  .hp-prop-title { font-size: 17px; font-weight: 600; letter-spacing: -.25px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hp-prop-meta { font-size: 12px; color: var(--prop-muted); margin-top: 3px; overflow-wrap: anywhere; }
  .hp-prop-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; }
  .hp-prop-group { position: relative; padding: 16px 23px; border-top: 1px solid var(--prop-line); display: flex; flex-direction: column; }
  .hp-prop-group { min-height: 0; height: auto; }
  .hp-prop-group > * { flex-shrink: 0; }
  .hp-prop-group-title { display: flex; align-items: center; gap: 7px; margin: 0 0 12px; padding: 0; border: 0; background: none; color: inherit; font-size: 13px; line-height:1.4; font-weight: 650; letter-spacing: .08px; text-align: left; }
  .hp-prop-group-title .hp-prop-icon { width: 15px; height: 15px; color: var(--prop-muted); }
  .hp-prop-fields { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); column-gap: 12px; row-gap: 10px; }
  .hp-prop-field { min-width: 0; }
  .hp-prop-field.wide { grid-column: 1 / -1; }
  .hp-prop-field > label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--prop-label); margin-bottom: 5px; height: 16px; white-space: nowrap; }
  .hp-prop-field > label .hp-prop-icon { width: 10px; height: 10px; margin-left: auto; }
  .hp-prop-control, .hp-properties .hpf-unit, .hp-properties .hpf-colorfield {
    height: 36px; display: flex; align-items: center; gap: 7px; border: 1px solid var(--prop-border); border-radius: 5px;
    background: var(--prop-input); padding: 0 10px; font-size: 14px; color: var(--prop-value); font-variant-numeric: tabular-nums;
    width: 100%; min-width: 0; min-height: 0; flex-wrap: nowrap;
  }
  .hp-properties .hpf-unit > input { width: 100%; min-width: 0; padding: 0; border: 0; background: none; height: 34px; outline: none; color: inherit; font-size: 14px; -moz-appearance: textfield; box-shadow: none; }
  .hp-properties input::-webkit-inner-spin-button, .hp-properties input::-webkit-outer-spin-button { appearance: none; margin: 0; }
  .hp-properties .hpf-unit > span, .hp-prop-unit { color: var(--prop-unit); margin-left: auto; font-size: 11px; padding: 0; }
  .hp-properties .hpf-unit:focus-within, .hp-prop-text:focus { border-color: var(--prop-accent); outline: 1px solid var(--prop-accent); outline-offset: -1px; }
  .hp-prop-field.readonly .hpf-unit { background: var(--prop-bg); border-color: var(--prop-read-border); color: var(--prop-ro); }
  .hp-prop-field.disabled { color: var(--prop-disabled-ink); }
  .hp-prop-field.disabled > label { color: var(--prop-disabled-label); }
  .hp-prop-field.disabled .hp-prop-control { background: var(--prop-disabled); border-color: var(--prop-disabled-line); color: var(--prop-disabled-ink); }
  .hp-prop-field.disabled .hp-prop-unit { color: inherit; }
  .hp-prop-group > .hp-prop-hint { position: static; font-size: 11px; line-height: 1.45; color: var(--prop-hint); margin: 12px 0 0; padding: 0; overflow-wrap: anywhere; }
  .hp-properties .hpf-colorfield { padding: 0 8px; gap: 5px; font-size: 12px; }
  .hp-properties .hpf-colorfield hp-color-opacity { width: 15px; height: 15px; flex: 0 0 15px; }
  .hp-properties .hpf-colorfield .hpf-hex { font-size: 12px; font-family: inherit; padding: 0; color: var(--prop-value); }
  .hp-properties .hpf-colorfield .hpf-opacity { font-size: 11px; color: var(--prop-muted); margin-left: auto; }
  .hp-properties .hpf-colorfield:has(.hpf-inline-hex) { display:grid; grid-template-columns:24px minmax(56px,1fr) 28px 8px; gap:2px; padding-inline:4px; cursor:default; }
  .hp-properties .hpf-colorfield > .hpf-opacity.hpf-inline-opacity, .hp-properties .hpf-inline-opacity > .hpf-unit { display:contents; }
  .hp-properties .hpf-colorfield .hpf-inline-hex,
  .hp-properties .hpf-colorfield .hpf-inline-opacity .hpf-unit > input {
    box-sizing:border-box; min-width:0; width:100%; height:28px; margin:0; padding:3px 2px;
    border:0; border-radius:4px; background:transparent; color:var(--primary-text-color);
    font:inherit; font-size:12px; line-height:20px; font-variant-numeric:tabular-nums; cursor:text; outline:0;
  }
  .hp-properties .hpf-colorfield .hpf-inline-alpha { text-align:right; appearance:textfield; }
  .hp-properties .hpf-colorfield .hpf-inline-alpha::-webkit-inner-spin-button { appearance:none; }
  .hp-properties .hpf-inline-opacity .hpf-unit > span { margin:0; font-size:12px; color:var(--secondary-text-color); }
  .hp-properties .hpf-colorfield:has(.hpf-inline-hex):focus-within { border-color:var(--primary-color); }
  .hp-properties .hpf-colorfield .hpf-inline-hex:hover,
  .hp-properties .hpf-colorfield .hpf-inline-alpha:hover { background:color-mix(in srgb,var(--primary-color) 8%,transparent); }
  .hp-properties .hpf-colorfield input[aria-invalid=true] { box-shadow:inset 0 -2px var(--error-color); }
  .hp-properties .hp-prop-group-color .hpf-colorfield { display:grid; grid-template-columns:24px minmax(100px,1fr) minmax(100px,1fr) 8px; gap:2px; padding-inline:4px; }
  .hp-properties .hp-prop-group-color .hpf-colorfield:not(:has(.hpf-inline-hex)) { grid-template-columns:24px minmax(100px,1fr) 8px; }
  .hp-prop-swatch { width: 15px; height: 15px; border: 1px solid var(--prop-line); border-radius: 3px; }
  .hp-prop-swatch-empty { background: linear-gradient(135deg,transparent 45%,var(--prop-line) 46%,var(--prop-line) 53%,transparent 54%); flex: 0 0 15px; }
  .hp-prop-text { display:block; height: 66px; width: 100%; min-width: 0; padding: 9px 10px; border: 1px solid var(--prop-border); border-radius: 5px; background: var(--prop-input); color: var(--prop-value); font-size: 14px; line-height: 1.5; resize: vertical; overflow-wrap: anywhere; }
  .hp-prop-choice, .hp-prop-variable { width: 100%; border: 1px solid var(--prop-border); background: var(--prop-input); color: var(--prop-ro); border-radius: 5px; min-height: 35px; padding: 5px; font-size: 12px; }
  .hp-prop-choice { display: flex; align-items: center; justify-content: center; gap: 7px; }
  .hp-prop-choice .hp-prop-icon { width: 16px; height: 16px; }
  .hp-prop-feature-label { grid-column: 1 / -1; font-size: 12px; line-height: 16px; color: var(--prop-muted); margin-bottom: -4px; }
  .hp-prop-group.features .hp-prop-fields { row-gap: 8px; column-gap:8px; }
  .hp-prop-group.features .hp-prop-group-title { margin-bottom: 10px; }
  .hp-prop-choice.active { border-color: var(--prop-accent); background: var(--prop-soft); color: var(--prop-accent); }
  .hp-prop-choices { display: flex; gap: 8px; }
  .hp-prop-choices > button { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .hp-prop-settings { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 39px; width: 100%; padding: 5px; border: 1px solid light-dark(#a4ccd2,var(--prop-accent)); background: light-dark(#f5fbfb,var(--prop-soft)); color: light-dark(#187e8d,var(--prop-accent)); border-radius: 5px; font-size: 12px; font-weight: 550; }
  .hp-prop-settings .hp-prop-icon { width: 16px; height: 16px; }
  .hp-prop-group.features .hp-prop-hint { text-align: justify; text-align-last: left; }
  .hp-prop-variable { display: flex; align-items: center; justify-content: center; gap: 8px; height: 33px; min-height: 0; margin-top: 9px; color: var(--prop-accent); }
  .hp-prop-variable .hp-prop-icon { width: 16px; height: 16px; }
  .hp-prop-foot { flex: 0 0 auto; min-height: 122px; padding: 15px 23px; border-top: 1px solid var(--prop-line); background: var(--prop-bg); }
  .hp-prop-actions { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; margin-bottom: 13px; }
  .hp-prop-actions.solo { grid-template-columns: 1fr; }
  .hp-prop-action-wrap.wide { grid-column: 1 / -1; }
  .hp-prop-action-wrap { position: relative; min-width: 0; }
  .hp-prop-action { width: 100%; min-height: 36px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--prop-border); border-radius: 5px; color: var(--prop-ro); background: var(--prop-bg); padding: 3px 6px; font-size: 12px; line-height: 1.25; }
  .hp-prop-action .hp-prop-icon { width: 16px; height: 16px; }
  .hp-prop-action.delete { color: #a25757; border-color: var(--hpf-danger); }
  .hp-prop-action.display_device span { white-space:pre-line; }
  .hp-prop-action[aria-disabled='true'] { color: var(--prop-disabled-ink); background: var(--prop-disabled); border-color: var(--prop-line); cursor: default; }
  .hp-prop-action.delete[aria-disabled='true'] { border-color: color-mix(in srgb,var(--hpf-danger) 35%,var(--prop-bg)); }
  .hp-properties .hp-prop-action.delete:not(:disabled):not([aria-disabled='true']):is(:hover,:focus-visible) {
    background: color-mix(in srgb,var(--hpf-danger) 9%,var(--hpf-surface)); color: var(--hpf-danger); border-color: var(--hpf-danger);
  }
  .hp-prop-help { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; color: var(--prop-muted); font-size: 10px; }
  .hp-prop-help > div { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
  .hp-prop-help kbd { border: 1px solid var(--prop-line); border-radius: 3px; background: var(--prop-input); font: 10px/1.4 inherit; padding: 0 5px; }
  .hp-prop-error { font-size: 11px; line-height: 1.4; color: var(--error-color,#b64b45); padding-top: 5px; overflow-wrap: anywhere; }
  .hp-prop-pending { font-size: 11px; color: var(--prop-muted); }
  .hp-properties button:focus-visible, .hp-properties select:focus-visible { outline: 2px solid var(--prop-accent); outline-offset: 2px; }
  .hp-prop-selection { stroke: #078a9e; fill: none; pointer-events: none; vector-effect: non-scaling-stroke; stroke-width: 1.7px; }
  .hp-prop-selection * { pointer-events: none; vector-effect: non-scaling-stroke; }
  @media(prefers-reduced-motion:reduce) { .hp-properties button { transition: none; } }
  ha-card[data-hp-properties-wide] .dtframe:not(.hp-stair-frame):not(.hp-column-frame) .dtbox,
  ha-card[data-hp-properties-wide] .dtframe:not(.hp-stair-frame):not(.hp-column-frame) .dtstem,
  ha-card[data-hp-properties-wide] .dtframe:not(.hp-stair-frame):not(.hp-column-frame) .dtknob,
  ha-card[data-hp-properties-wide] .bdframe .bdbox,
  ha-card[data-hp-properties-wide] .bdframe .dtstem,
  ha-card[data-hp-properties-wide] .bdframe .bdknob { opacity: 0; }
  ha-card[data-hp-properties-wide] .physical-hit.selected { fill:rgb(7 138 158 / .16); }
  ha-card[data-hp-properties-wide] .hp-stair.selected .hp-stair-outline { stroke:#078a9e; }
  ha-card[data-hp-properties-wide] .hp-stair-frame { --hp-accent:#078a9e; }
  .hp-properties-variable { --hp-dialog-wide-width: 560px; font: 14px/1.4 'Segoe UI',Arial,sans-serif; color: var(--primary-text-color,#28343c); }
  hp-dialog.hp-properties-variable .hp-prop-variable-body { display: block; padding: 22px 24px; margin: 0; }
  hp-dialog.hp-properties-variable .hp-prop-variable-label { display: block; font-size: 13px; line-height: 1.4; color: var(--secondary-text-color,#687b86); margin: 0 0 6px; }
  .hp-prop-variable-body .hpf-picker { margin-bottom: 18px; }
  hp-dialog.hp-properties-variable .hp-prop-variable-body .hpf-select { min-height: 42px; border: 1px solid var(--divider-color,#cbd8de); border-radius: 6px; padding: 10px 12px; color: inherit; }
  hp-dialog.hp-properties-variable .hp-prop-variable-body .hpf-pick { display: grid; grid-template-columns:20px minmax(0,1fr); grid-template-rows: auto auto; column-gap:12px; row-gap:3px; min-height:62px; padding-right:32px; }
  .hp-prop-variable-body .hpf-pick > .hp-prop-icon { grid-column:1; grid-row:1 / 3; color:#358d9d; }
  .hp-prop-variable-body .hpf-pick > b { grid-column:2; grid-row:1; font-size:14px; line-height:1.4; }
  .hp-prop-variable-body .hpf-pick > .hpf-pick-ref { grid-column:2; grid-row:2; font-size:12px; line-height:1.4; }
  .hp-prop-variable-body select { width: 100%; font: inherit; }
  .hp-prop-preview { background: var(--secondary-background-color,#f1f7f8); border: 1px solid var(--divider-color,#e2edef); border-radius: 6px; padding: 12px 14px; margin-top: 20px; overflow-wrap: anywhere; }
  .hp-prop-preview > div { font-size: 12px; color: var(--secondary-text-color,#78909a); margin-bottom: 6px; }
  .hp-prop-preview strong { font-size: 16px; font-weight: 500; color: var(--primary-text-color,#355460); }
  .hp-prop-variable-footer { display: flex; justify-content: flex-end; gap: 10px; width: 100%; padding: 16px 24px; }
  .hp-prop-variable-footer button { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 19px; border: 1px solid var(--divider-color,#d3dfe3); border-radius: 5px; font: 13px/1.4 'Segoe UI',Arial,sans-serif; background: var(--card-background-color,#fff); color: inherit; cursor: pointer; }
  .hp-prop-variable-footer .insert { background: #078a9e; color: #fff; border-color: #078a9e; }
  .hp-prop-variable-footer .hp-prop-icon { width:16px; height:16px; }
  .hp-prop-variable-footer button:disabled { opacity: .45; cursor: default; }
`.cssText + `
.hp-properties button{${settingsActionTransition}}
.hp-properties button:not(:disabled):not([aria-disabled="true"]):is(:hover,:focus-visible){${settingsActionHover}}
@media(prefers-reduced-motion:reduce){.hp-properties button{transition:none}}
`);
