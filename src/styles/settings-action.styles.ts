/** Shared interaction paint for settings actions, confirmations and pickers. */
export const settingsActionTransition = 'transition:background 160ms ease,color 160ms ease,border-color 160ms ease,box-shadow 160ms ease;';
export const settingsActionHover = `
  background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 10%,transparent));
  color:var(--hpf-accent,var(--primary-color,#03a9f4));
  border-color:var(--hpf-accent,var(--primary-color,#03a9f4));
  box-shadow:0 0 0 1px var(--hpf-tint-line,var(--primary-color,#03a9f4));
  filter:brightness(1.08);
`;
export const settingsPrimaryActionHover = `
  ${settingsActionHover}
  background:color-mix(in srgb,var(--hpf-accent,var(--primary-color,#03a9f4)) 90%,#000);
  color:var(--text-primary-color,#fff);
`;
