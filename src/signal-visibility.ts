/** #876: one O(1) policy for every system LQI surface. No HA reads or writes. */
export const SIGNAL_VISIBILITY_MODES = ['inherit', 'on', 'off'] as const;
export type SignalVisibilityMode = typeof SIGNAL_VISIBILITY_MODES[number];

export interface SignalSpaceSettings {
  show_lqi?: unknown;
  show_lqi_mode?: unknown;
}

/** A historical true was emitted by every form Save; it is not an override. */
export function signalVisibilityModeOf(settings: SignalSpaceSettings | null | undefined): SignalVisibilityMode {
  const mode = settings?.show_lqi_mode;
  if (mode === 'inherit' || mode === 'on' || mode === 'off') return mode;
  return settings?.show_lqi === false ? 'off' : 'inherit';
}

/** Resolved local override, also used by the live space-dialog projection. */
export function signalVisibilityOverrideOf(mode: SignalVisibilityMode): boolean | null {
  return mode === 'inherit' ? null : mode === 'on';
}

export function globalSignalVisibleOf(settings: { show_lqi?: unknown } | null | undefined): boolean {
  return settings?.show_lqi !== false;
}

/** Explicit new space on/off wins; only exact YAML false is a card exception. */
export function effectiveShowLqi(
  settings: { show_lqi?: unknown } | null | undefined,
  local: boolean | null | undefined,
  card: unknown,
): boolean {
  return typeof local === 'boolean' ? local : card === false ? false : globalSignalVisibleOf(settings);
}

/** Inherit removes the legacy mirror, preserving every unrelated extension. */
export function writeSpaceSignalVisibility<T extends SignalSpaceSettings>(
  settings: T, mode: SignalVisibilityMode,
): T {
  const next = { ...settings };
  delete next.show_lqi;
  delete next.show_lqi_mode;
  if (mode !== 'inherit') {
    next.show_lqi_mode = mode;
    next.show_lqi = mode === 'on';
  }
  return next;
}

export function writeGlobalSignalVisibility(settings: { show_lqi?: unknown }, visible: boolean): void {
  if (visible) delete settings.show_lqi;
  else settings.show_lqi = false;
}
