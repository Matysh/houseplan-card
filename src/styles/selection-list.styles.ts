import { settingsActionTransition } from './settings-action.styles';
import { controlReducedMotionCss } from './ui-motion.styles';

/** Shared choice paint for native-select enhancement and source-picker rows. */
export function selectionListCss(selector: string, selected: string, active?: string,
  tokens: { accent?: string; tint?: string } = {}): string {
  const item = `:is(${selector})`, enabled = `${item}:not(:disabled):not([aria-disabled=true])`;
  const accent = tokens.accent ?? 'var(--hpf-accent,var(--primary-color,#03a9f4))';
  const tint = tokens.tint ?? 'var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 12%,transparent))';
  return `
  ${item} { flex-shrink:0; ${settingsActionTransition} }
  ${item}${selected} { color:${accent}; background:${tint}; }
  @media (hover:hover) and (pointer:fine) {
    ${enabled}:hover { box-shadow:inset 0 0 0 1px ${accent}; }
  }
  ${enabled}:focus-visible${active ? `,${enabled}${active}` : ''} { outline:2px solid ${accent}; outline-offset:-2px; }
  ${item}[aria-disabled=true],${item}:disabled { box-shadow:none; outline:none; }
  ${controlReducedMotionCss(item)}
`;
}
