import { css, unsafeCSS } from 'lit';
import { settingsActionsCss } from '../../styles/settings-action.styles';
import { CARD_DIALOG_FORM_KIT, textFieldsCss, unitFieldsCss, colorFieldsCss } from '../../styles/form-kit.styles';
import { formKitTextareaCss } from '../../styles/form-input.styles';
import { readingTextCss, readingSidePanelCss, readingSeparatorCss, readingShortcutCss, readingGlyphCss } from '../../styles/reading-kit.styles';

/** Local placement from #931/#963; fields, actions and reading paint belong to UI Kit. */
export const propertiesStyles = unsafeCSS(css`
  ha-card[data-hp-properties-wide] { position: relative; }
  ha-card[data-hp-properties-wide] > .stage,
  ha-card[data-hp-properties-wide] .editorchrome { width: calc(100% - 360px); }
  ha-card[data-hp-properties-wide] > .hdr > .head { width: calc(100% - 360px); box-sizing: border-box; padding-block: 8px; }
  .hp-properties {
    color-scheme: light dark;
    position: absolute; right: 0; top: 0; bottom: 0;
    width: 360px; min-height: 0; display: flex; flex-direction: column;
    z-index: 21;
  }
  .hp-properties[data-theme='light'] { color-scheme: light; }
  .hp-properties[data-theme='dark'] { color-scheme: dark; }
  .hp-properties *, .hp-properties *::before, .hp-properties *::after { box-sizing: border-box; }
  .hp-prop-icon { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .hp-prop-head { flex: 0 0 auto; padding: 17px 23px 15px; }
  .hp-prop-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hp-prop-meta { margin-top: 3px; }
  .hp-prop-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; }
  .hp-prop-group { position: relative; padding: 16px 23px; display: flex; flex-direction: column; }
  .hp-prop-group { min-height: 0; height: auto; }
  .hp-prop-group > * { flex-shrink: 0; }
  .hp-prop-group-title { display: flex; align-items: center; gap: 7px; margin: 0 0 12px; padding: 0; border: 0; background: none; text-align: left; }

.hp-prop-fields { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); column-gap: 12px; row-gap: 10px; }
  .hp-prop-field { min-width: 0; }
  .hp-prop-field.wide { grid-column: 1 / -1; }
  .hp-prop-field > label { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; height: 16px; white-space: nowrap; }
  .hp-prop-field > label .hp-prop-icon { margin-left:auto; }
  .hp-prop-group > .hp-prop-hint { position: static; margin: 12px 0 0; padding: 0; overflow-wrap: anywhere; }
  .hp-properties .hp-prop-group-color .hpf-colorfield { display:grid; grid-template-columns:24px minmax(100px,1fr) minmax(100px,1fr) 8px; }
  .hp-properties .hp-prop-group-color .hpf-colorfield:not(:has(.hpf-inline-hex)) { grid-template-columns:24px minmax(100px,1fr) 8px; }

.hp-prop-feature-label { grid-column: 1 / -1; margin-bottom: -4px; }
  .hp-prop-group.features .hp-prop-fields { row-gap: 8px; column-gap:8px; }
  .hp-prop-group.features .hp-prop-group-title { margin-bottom: 10px; }
  .hp-prop-choices { display: flex; gap: 8px; }
  .hp-prop-choices > button { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .hp-prop-group.features .hp-prop-hint { text-align: justify; text-align-last: left; }
  .hp-prop-variable { margin-top:9px; }
  .hp-prop-foot { flex: 0 0 auto; min-height: 122px; padding: 15px 23px; }
  .hp-prop-actions { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; margin-bottom: 13px; }
  .hp-prop-actions.solo { grid-template-columns: 1fr; }
  .hp-prop-action-wrap.wide { grid-column: 1 / -1; }
  .hp-prop-action-wrap { position: relative; min-width: 0; }
  .hp-prop-action.display_device span { white-space:pre-line; }
  .hp-prop-help { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .hp-prop-help > div { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
  .hp-prop-error { padding-top:5px; }
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
  .hp-properties-variable { --hp-dialog-wide-width:560px; }
  hp-dialog.hp-properties-variable .hp-prop-variable-body { display: block; padding: 22px 24px; margin: 0; }
  hp-dialog.hp-properties-variable .hp-prop-variable-label { display: block; margin: 0 0 6px; }
  .hp-prop-variable-body .hpf-picker { margin-bottom: 18px; }
  .hp-prop-variable-body select { width: 100%; font: inherit; }
  .hp-prop-preview { margin-top:20px; }
  .hp-prop-preview > div { margin-bottom:6px; }

`.cssText
  + readingGlyphCss('.hp-prop-icon')
  + readingGlyphCss('.hp-prop-group-title .hp-prop-icon', 'section')
  + readingGlyphCss('.hp-prop-field > label .hp-prop-icon', 'lock')
  + readingSidePanelCss('.hp-properties')
  + readingSeparatorCss('.hp-prop-group,.hp-prop-foot')
  + readingTextCss('.hp-prop-title', 'title', 'primary')
  + readingTextCss('.hp-prop-meta,.hp-prop-variable-label,.hp-prop-preview > div')
  + readingTextCss('.hp-prop-group-title', 'heading', 'primary')
  + readingTextCss('.hp-prop-field > label', 'label')
  + readingTextCss('.hp-prop-feature-label', 'feature')
  + readingTextCss('.hp-prop-hint,.hp-prop-pending', 'note')
  + readingTextCss('.hp-prop-help', 'tiny')
  + readingTextCss('.hp-prop-error', 'note', 'error')
  + readingShortcutCss('.hp-prop-help kbd')
  + textFieldsCss({ ...CARD_DIALOG_FORM_KIT, parameterized:true }, '.hp-properties .hp-prop-control,.hp-properties .hp-prop-text', 'property')
  + formKitTextareaCss('.hp-properties .hp-prop-text', 'property')
  + unitFieldsCss(CARD_DIALOG_FORM_KIT, '.hp-properties .hpf-unit', 'property')
  + colorFieldsCss(CARD_DIALOG_FORM_KIT, '.hp-properties .hpf-colorfield', 'property')
  + settingsActionsCss('.hp-properties .hp-prop-action', '.on', { density:'property' })
  + settingsActionsCss('.hp-properties .hp-prop-choice', '.active', { density:'property-choice', variant:'choice' })
  + settingsActionsCss('.hp-properties .hp-prop-settings', '', { density:'property-settings', variant:'choice' })
  + settingsActionsCss('.hp-properties .hp-prop-variable', '.on', { density:'property-variable' }));
