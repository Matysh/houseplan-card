import { wallCmToUnits } from './wall-thickness';

/** Historical plan-cell size whose raw SVG constants define the visual baseline. */
export const GRID_VISUAL_REFERENCE_CELL_CM = 5;

/** Canonical centimetres in one imperial grid cell (one inch). */
export const GRID_IMPERIAL_CELL_CM = 2.54;

/** Scale a legacy SVG visual unit without changing physical or screen-space sizes. */
export function gridVisualScale(cellCm: unknown): number {
  const value = typeof cellCm === 'number' ? cellCm : NaN;
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (value === GRID_VISUAL_REFERENCE_CELL_CM) return 1;
  return GRID_VISUAL_REFERENCE_CELL_CM / value;
}

export function gridVisualUnits(baseUnits: number, cellCm: unknown): number {
  return baseUnits * gridVisualScale(cellCm);
}

/** Half-width of the Plan-editor wall-thickness hover strip, in plan units. */
export function wallThickHoverHalfUnits(
  cm: number, cellCm: number, gridPitch: number,
): number {
  const thicknessCm = Number.isFinite(cm) && cm > 0 ? cm : 0;
  const normalizedCellCm = Number.isFinite(cellCm) && cellCm > 0
    ? cellCm
    : GRID_VISUAL_REFERENCE_CELL_CM;
  const normalizedPitch = Number.isFinite(gridPitch) && gridPitch > 0 ? gridPitch : 0;
  return thicknessCm > 0
    ? wallCmToUnits(thicknessCm, normalizedCellCm, normalizedPitch) / 2
    : gridVisualUnits(normalizedPitch * 1.5, normalizedCellCm);
}

/** Default only for newly-created spaces. Read compatibility keeps its own 5 cm fallback. */
export function newSpaceCellCm(imperial: boolean): number {
  return imperial ? GRID_IMPERIAL_CELL_CM : 1;
}

/** Human-sized field projection; the canonical draft remains separate and lossless. */
export function gridCellFieldValue(cellCm: number, imperial: boolean): string {
  if (!imperial) return String(cellCm);
  const inches = cellCm / GRID_IMPERIAL_CELL_CM;
  return String(Math.round(inches * 1_000_000) / 1_000_000);
}

export function gridCellFieldToCm(value: number, imperial: boolean): number {
  return imperial ? value * GRID_IMPERIAL_CELL_CM : value;
}
