import { GRID_N, GRID_PITCH, GRID_VISUAL_REFERENCE_CELL_CM } from './canvas-constants';
import { DEFAULT_DEVICE_BASE_SIZE } from './device-marker-geometry';
import { GRID_IMPERIAL_CELL_CM, gridVisualScale } from './grid-scale';
import { ISO_VIEW_PROFILE } from './iso-lab-camera';
import { strictNumber } from './space-dialog';

export const ICON_DEPTH_RATIO = .24;
export const LED_DEPTH_RATIO = .075;
const REFERENCE_DIAMETER_CM = DEFAULT_DEVICE_BASE_SIZE / 100 * GRID_N * GRID_VISUAL_REFERENCE_CELL_CM;
export const MARKER_BODY_HEIGHT_CM = REFERENCE_DIAMETER_CM * ICON_DEPTH_RATIO;
export const LED_BODY_HEIGHT_CM = REFERENCE_DIAMETER_CM * LED_DEPTH_RATIO;

export interface MarkerHeightDraft {
  heightText?: string;
  originalHeightCm?: number | null;
  heightTouched?: boolean;
  heightBadInput?: boolean;
}

export function markerHeightMaxCm(bodyHeightCm = MARKER_BODY_HEIGHT_CM, wallHeightCm = ISO_VIEW_PROFILE.sectionHeightCm): number {
  return Math.max(0, wallHeightCm - bodyHeightCm);
}

export function markerHeightLimitCm(strip: boolean): number {
  return markerHeightMaxCm(strip ? LED_BODY_HEIGHT_CM : MARKER_BODY_HEIGHT_CM);
}

function storedHeight(value: unknown, maxCm: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maxCm ? value : null;
}

function enteredHeight(value: string, imperial: boolean, maxCm: number): number | null {
  const n = strictNumber(value);
  if (n == null || n < 0 || n > maxCm / (imperial ? GRID_IMPERIAL_CELL_CM : 1)) return null;
  return Math.min(maxCm, n * (imperial ? GRID_IMPERIAL_CELL_CM : 1));
}

export function markerHeightDraftText(draft: MarkerHeightDraft, imperial: boolean): string {
  if (draft.heightTouched) return draft.heightText ?? '';
  if (draft.originalHeightCm == null) return '';
  return String(draft.originalHeightCm / (imperial ? GRID_IMPERIAL_CELL_CM : 1));
}

export function markerHeightDraftValid(draft: MarkerHeightDraft, imperial: boolean, maxCm: number): boolean {
  if (!draft.heightTouched) return draft.originalHeightCm == null || storedHeight(draft.originalHeightCm, maxCm) != null;
  const raw = draft.heightText?.trim() ?? '';
  return !draft.heightBadInput && (!raw || enteredHeight(raw, imperial, maxCm) != null);
}

export function markerHeightFields(draft: MarkerHeightDraft, imperial: boolean, maxCm: number): { height_cm?: number } {
  const height = draft.heightTouched
    ? enteredHeight(draft.heightText ?? '', imperial, maxCm)
    : storedHeight(draft.originalHeightCm, maxCm);
  return height == null ? {} : { height_cm: height };
}

export function markerHeightGeometry(
  value: unknown, cellCm: number, automaticTop: number, diameter: number, strip = false,
): { top: number; thickness: number; level: string } {
  const height = storedHeight(value, markerHeightLimitCm(strip));
  if (height == null) {
    return { top: automaticTop, thickness: diameter * (strip ? LED_DEPTH_RATIO : ICON_DEPTH_RATIO), level: 'auto' };
  }
  const units = GRID_PITCH / GRID_VISUAL_REFERENCE_CELL_CM * gridVisualScale(cellCm);
  const bodyHeight = strip ? LED_BODY_HEIGHT_CM : MARKER_BODY_HEIGHT_CM;
  return { top: Math.min(automaticTop, (height + bodyHeight) * units), thickness: bodyHeight * units, level: String(height) };
}
