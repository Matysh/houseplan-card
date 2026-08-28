import { polygonArea } from './logic';

/** View-safe area helpers kept separate from the lazy resize implementation. */
export function areaM2(poly: number[][], gridPitch: number, cellCm: number): number {
  const cmPerUnit = cellCm / gridPitch;
  return (polygonArea(poly) * cmPerUnit * cmPerUnit) / 1e4;
}

export function formatArea(m2: number, imperial: boolean): string {
  if (imperial) return `${Math.round(m2 * 10.7639)} ft²`;
  return `${(Math.round(m2 * 10) / 10).toFixed(1)} m²`;
}
