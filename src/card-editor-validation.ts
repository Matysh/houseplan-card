export interface CardEditorSpaceOption { value: string; label: string }

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
