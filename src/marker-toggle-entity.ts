import type { Marker } from './types';

export interface ToggleEntityWriteState {
  touched: boolean;
  originalHas: boolean;
  original: string | null | undefined;
  value: string;
}

/** Lossless transactional write policy for marker.toggle_entity. */
export function toggleEntityWriteFields(
  state: ToggleEntityWriteState,
): Pick<Marker, 'toggle_entity'> | Record<string, never> {
  if (!state.touched) {
    return state.originalHas ? { toggle_entity: state.original ?? null } : {};
  }
  return state.value ? { toggle_entity: state.value } : {};
}
