export type SpacePlanSource = 'file' | 'draw';

export interface SpaceDisplayDraft {
  source: SpacePlanSource;
  showBorders: boolean;
  showNames: boolean;
  /** Ephemeral create-dialog guard; never persisted in the House Plan config. */
  displayTouched: boolean;
}

/**
 * A current empty space is still a complete wall-model document.  In
 * particular, model v8+ forbids using an absent catalogue to mean "no walls":
 * absence means an outdated/partial writer, while an empty array is the
 * canonical empty catalogue.
 */
export function createEmptySpaceConfig(id: string, title: string): Record<string, unknown> {
  return {
    id,
    title,
    plan_url: null,
    view_box: [0, 0, 1, 1],
    rooms: [],
    wall_segments: [],
  };
}

/** Source-specific visible defaults for a fresh create/onboarding step. */
export function initialSpaceDisplayDraft(source: SpacePlanSource = 'file'): SpaceDisplayDraft {
  const visible = source === 'draw';
  return {
    source,
    showBorders: visible,
    showNames: visible,
    displayTouched: false,
  };
}

/**
 * Project source defaults only while the owner has not changed either display
 * switch. Once touched, the pair is one user choice and must survive switches.
 */
export function switchSpacePlanSource<T extends SpaceDisplayDraft>(
  draft: T,
  source: SpacePlanSource,
): T {
  if (draft.displayTouched) return { ...draft, source };
  const visible = source === 'draw';
  return { ...draft, source, showBorders: visible, showNames: visible };
}

/** Changing either switch protects the complete pair from source projection. */
export function touchSpaceDisplay<T extends SpaceDisplayDraft>(
  draft: T,
  field: 'showBorders' | 'showNames',
  value: boolean,
): T {
  return { ...draft, [field]: value, displayTouched: true };
}
