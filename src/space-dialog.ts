import type { FillColorEntry } from './logic';
import type { ZeroWallStyle } from './types';

export type SpacePlanSource = 'file' | 'draw';

export interface SpaceCopyDraft {
  title: string;
  busy: boolean;
  token: number;
}

export interface SpaceDialogState {
  mode: 'edit' | 'create';
  spaceId?: string;
  title: string;
  planUrl: string | null;
  planFile: { ext: string; b64: string; aspect: number; name: string } | null;
  /** Server-side plan picker state; asset files are never inferred garbage. */
  pickSaved?: boolean;
  saved?: Array<{
    name: string; url: string; size: number; modified: number; used_by: string[];
  }> | null;
  savedBusy?: boolean;
  savedAspect?: number;
  source: SpacePlanSource;
  showBorders: boolean;
  showNames: boolean;
  zeroWallStyle: ZeroWallStyle;
  displayTouched: boolean;
  hideDecor: boolean;
  hideOpenings: boolean;
  roomColor: string;
  roomOpacity: number;
  bgColor: string | null;
  bgMode: 'static' | 'daynight' | null;
  northDeg: number | null;
  sunRays: boolean | null;
  fillMode: 'none' | 'lqi' | 'light' | 'temp' | 'custom';
  customFill: FillColorEntry | null;
  glowEnabled: boolean;
  tempMin: number;
  tempMax: number;
  showLqi: boolean;
  cardFontScale: number;
  labelTemp: boolean;
  labelHum: boolean;
  labelLqi: boolean;
  labelLight: boolean;
  cellCm: number;
  cellCmInput?: string;
  cellCmTouched?: boolean;
  deleteBlockers?: number;
  copy?: SpaceCopyDraft;
  busy: boolean;
}

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

/** Numeric dialog fields consume the complete value; decimal comma is valid. */
export function strictNumber(value: string): number | null {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
