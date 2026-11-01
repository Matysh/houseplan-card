import { cardDialogFormKitTokens } from './form-kit-tokens';
import { CARD_DIALOG_FORM_KIT, textFieldsCss } from './form-kit.styles';
import { formKitCheckboxCss } from './form-input.styles';
import { readingTextCss, readingSeparatorCss } from './reading-kit.styles';
import { settingsActionsCss } from './settings-action.styles';

/** Desktop editor density uses the same actions; dialog and View recipes stay 44px. */
export const editorFormKitCss = cardDialogFormKitTokens.replace('hp-dialog .hpf-form',
  ':is(.editbar,.editor-secondary,.hp-properties,.wallthick-dlg)')
  + settingsActionsCss('.editbar .btn', '.on', { density: 'editor' })
  + settingsActionsCss('.editbar .btn.ghost', '.on', { density: 'history' })
  + settingsActionsCss('.editbar .btn.barclose', '.on', { density: 'editor-close' })
  + settingsActionsCss('.editor-secondary .btn', '.on', { density:'editor' })
  + settingsActionsCss('.editor-secondary .btn.furnback', '.on', { density:'editor-back' })
  + settingsActionsCss('.editor-secondary .btn.imageassetdelete', '.on', { density:'editor-delete' })
  + textFieldsCss({ ...CARD_DIALOG_FORM_KIT, parameterized:true }, '.editor-secondary input[type=number]', 'editor', '74px')
  + textFieldsCss({ ...CARD_DIALOG_FORM_KIT, parameterized:true }, '.editor-secondary .drawwall input', 'editor', '4.2em')
  + textFieldsCss({ ...CARD_DIALOG_FORM_KIT, parameterized:true }, '.wallthick-dlg input[type=number]', 'editor', '5.5em')
  + formKitCheckboxCss('.editor-secondary input[type=checkbox]', 'editor')
  + readingTextCss('.editor-secondary :is(label,.hint,.bdhint),.editor-context-label:not(.hpf-heading),.furnhint')
  + readingTextCss('.editor-context-label.hpf-heading', 'action-heading', 'primary')
  + readingSeparatorCss('.editor-context-label:not(.hpf-heading)', 'inline-end')
  + readingSeparatorCss('.furnsize')
  + readingTextCss('.furnunit', 'note')
  + readingTextCss('.furngroup', 'category')
  + readingTextCss('.furnhd', 'heading', 'primary')
  + readingTextCss('.furnpalette', 'caption', 'primary')
  + settingsActionsCss(':is(.editor-group-launcher,.editor-group-item)', '.on', { density: 'editor' });

/** Shared transparency preview; scene artwork is unaffected. */
export function editorImagePreviewCss(selector: string, size: 'tile' | 'property' = 'tile'): string {
  const width = size === 'tile' ? 64 : 72;
  return `${selector} { width:${width}px; height:54px; object-fit:contain; border-radius:4px; background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 50% / 12px 12px; }`;
}

/** Media tiles share action state paint while their artwork keeps its own dimensions. */
export function editorTilesCss(selector: string, format: 'symbol' | 'category' | 'asset' = 'symbol'): string {
  const size = { symbol: { width:74, min:0 }, category: { width:92, min:76 }, asset: { width:104, min:92 } }[format];
  return settingsActionsCss(selector, '.on', { density:'editor', variant:'choice', intrinsicContent:true }) + editorImagePreviewCss(`${selector} > .hpf-tile-image`) + `
  ${selector} { flex-direction:column; gap:2px; width:${size.width}px; min-height:${size.min}px; padding:4px 2px; border-color:transparent; background:var(--hpf-canvas,var(--secondary-background-color)); font-size:12px; line-height:1.15; text-align:center; }
  ${selector}.on { border-color:var(--hpf-accent,var(--primary-color)); }
  ${selector} > .hpf-tile-art { width:40px; height:40px; color:var(--primary-text-color); }
  ${selector} > .hpf-tile-art-large { width:48px; height:48px; }
  ${selector} > small { color:var(--secondary-text-color); font-size:10px; }
`;
}
