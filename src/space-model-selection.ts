/**
 * Active-space selection is allowed to preserve the legacy first-space
 * fallback while the model is non-empty. Explicit/stable ids use the exact
 * selector so a stale object can never silently target another floor.
 */
export function selectActiveSpaceModel<T extends { id: string }>(
  models: readonly T[],
  activeId: string | null | undefined,
): T | undefined {
  return models.find((space) => space.id === activeId) ?? models[0];
}

export function selectSpaceModelById<T extends { id: string }>(
  models: readonly T[],
  id: string | null | undefined,
): T | undefined {
  if (!id) return undefined;
  return models.find((space) => space.id === id);
}
