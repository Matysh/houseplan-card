import { flatPlanRotation, validFlatPlanRotation, validPlanRotation } from './view-frame';
export interface CardEditorSpaceOption { value: string; label: string }
export const cardRotationOptions = [0, 90, 180, 270].map(value => ({ value: String(value), label: `${value}°` }));
export const invalidCardRotation = (config: { rotation?: unknown }): boolean =>
  config.rotation !== undefined && !validFlatPlanRotation(config.rotation);
export const rotationFormValue = (value: unknown): string => value === undefined ? '0' : String(value);
export const rotationConfigValue = (value: unknown): unknown =>
  typeof value === 'string' && cardRotationOptions.some(option => option.value === value) ? Number(value) : value;

/** Missing persisted default_floor, but only after an authoritative load. */
export function invalidDefaultFloor(
  config: any,
  spaces: readonly CardEditorSpaceOption[] | null,
  authoritative: boolean,
): string | null {
  if (!authoritative || spaces === null) return null;
  const raw = typeof config?.default_floor === 'string' ? config.default_floor : '';
  if (!raw || spaces.some((space) => space.value === raw)) return null;
  return raw;
}


/** A new full-card override is authored explicitly. Older rotation YAML stays intact. */
export function fullCardPresentationConfig(
  previous: Record<string, unknown>, value: Record<string, unknown>,
): Record<string, unknown> {
  const config = { ...previous, ...value };
  if (config.view === '') delete config.view;
  if (config.plan_rotation === '') delete config.plan_rotation;
  else if (typeof config.plan_rotation === 'string' && /^\d+$/.test(config.plan_rotation)) {
    const angle = Number(config.plan_rotation);
    if (validPlanRotation(angle)) config.plan_rotation = angle;
  }
  if (config.view === 'flat' && previous.view !== 'flat' && validPlanRotation(config.plan_rotation)) {
    config.plan_rotation = flatPlanRotation(config.plan_rotation);
  }
  return config;
}

export function invalidFullCardPresentation(config: { view?: unknown; plan_rotation?: unknown }): boolean {
  return config.view !== undefined && config.view !== 'flat' && config.view !== 'iso'
    || config.plan_rotation !== undefined && (!validPlanRotation(config.plan_rotation)
      || config.view === 'flat' && !validFlatPlanRotation(config.plan_rotation));
}
