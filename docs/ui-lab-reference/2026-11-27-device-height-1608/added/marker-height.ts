import { GRID_PITCH, GRID_VISUAL_REFERENCE_CELL_CM, NORM_W } from './canvas-constants';
import { DEFAULT_DEVICE_BASE_SIZE } from './device-marker-geometry';
import { ISO_VIEW_PROFILE } from './iso-lab-camera';
import { strictNumber } from './space-dialog';

// Fixed reference body: standard marker on the reference canvas, without zoom/size multipliers.
export const MARKER_BODY_HEIGHT_CM = DEFAULT_DEVICE_BASE_SIZE / 100 * NORM_W * .24 * GRID_VISUAL_REFERENCE_CELL_CM / GRID_PITCH;
export const LED_BODY_HEIGHT_CM = MARKER_BODY_HEIGHT_CM * .075 / .24;
export function markerHeightMaxCm(bodyHeightCm = MARKER_BODY_HEIGHT_CM, wallHeightCm: number = ISO_VIEW_PROFILE.sectionHeightCm) {
  return Math.max(0, wallHeightCm - bodyHeightCm);
}
export const MARKER_HEIGHT_MAX_CM = markerHeightMaxCm();
export function markerHeightLevel(value: unknown, maxCm = MARKER_HEIGHT_MAX_CM): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maxCm
    ? String(value) : 'auto';
}
export function markerHeightValid(raw: string | undefined, imperial: boolean, maxCm = MARKER_HEIGHT_MAX_CM): boolean {
  if (!raw?.trim()) return true;
  const n = strictNumber(raw);
  return n != null && n >= 0 && n * (imperial ? 2.54 : 1) <= maxCm + 1e-9;
}
export function markerHeightFields(d: { heightText?: string; originalHeightCm?: number | null; heightTouched?: boolean }, imperial: boolean) {
  if (!d.heightTouched) return d.originalHeightCm == null ? {} : { height_cm: d.originalHeightCm };
  const n = strictNumber(d.heightText ?? '');
  return { height_cm: n == null ? null : n * (imperial ? 2.54 : 1) };
}
export function markerHeightGeometry(value: unknown, cellCm: number, automaticTop: number, diameter: number, bodyHeightCm = MARKER_BODY_HEIGHT_CM) {
  const units = GRID_PITCH / cellCm;
  const level = markerHeightLevel(value, markerHeightMaxCm(bodyHeightCm, automaticTop / units));
  if (level === 'auto')
    return { top: automaticTop, thickness: diameter * .24, level: 'auto' };
  return { top: (Number(value) + bodyHeightCm) * units, thickness: bodyHeightCm * units, level };
}
