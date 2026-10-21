/** #1002: presentation only; never owns routes, samples or a config write. */
import type { Marker } from './types';

export interface VacuumTrailStyle { color: string; opacity: number }
export interface VacuumTrailDraft { devId?: string; vacuumTrail?: VacuumTrailStyle }
export const VACUUM_TRAIL_DEFAULT: Readonly<VacuumTrailStyle> = Object.freeze({ color: '#64B5F6', opacity: 0.7 });
const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const alpha = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function vacuumTrailStyle(vacuum: Marker['vacuum']): VacuumTrailStyle {
  return {
    color: color(vacuum?.trail_color) ? vacuum.trail_color.toUpperCase() : VACUUM_TRAIL_DEFAULT.color,
    opacity: alpha(vacuum?.trail_opacity) ? vacuum.trail_opacity : VACUUM_TRAIL_DEFAULT.opacity,
  };
}

/** The owning dialog alone may preview an edit; absence never writes defaults. */
export function previewVacuumTrailStyle(id: string, vacuum: Marker['vacuum'], draft?: VacuumTrailDraft | null): VacuumTrailStyle {
  const value = draft?.devId === id ? draft.vacuumTrail : undefined;
  return value ? vacuumTrailStyle({ trail_color: value.color, trail_opacity: value.opacity }) : vacuumTrailStyle(vacuum);
}

/** Merge with the latest accepted vacuum, not the one captured at dialog open. */
export function vacuumTrailWriteFields(vacuum: Marker['vacuum'], draft: VacuumTrailDraft): Pick<Marker, 'vacuum'> {
  if (!draft.vacuumTrail) return {};
  const value = draft.vacuumTrail;
  if (!color(value.color) || !alpha(value.opacity)) throw new Error('Invalid vacuum trail appearance');
  return { vacuum: { ...vacuum, trail_color: value.color.toUpperCase(), trail_opacity: value.opacity } };
}

export function vacuumTrailCss(value: VacuumTrailStyle): string {
  return `--hp-vacuum-trail-color:${value.color};--hp-vacuum-trail-opacity:${value.opacity}`;
}
