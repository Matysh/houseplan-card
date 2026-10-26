import { validPlanRotation } from './view-frame';
export interface CardEditorSpaceOption { value: string; label: string }
export const cardRotationOptions = [0, 90, 180, 270].map(value => ({ value: String(value), label: `${value}°` }));
export const invalidCardRotation = (config: { rotation?: unknown }): boolean =>
  config.rotation !== undefined && !validPlanRotation(config.rotation);
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
