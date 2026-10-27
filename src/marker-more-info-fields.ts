import type { Marker } from './types';
import { moreInfoEntityFailure, type MoreInfoHass } from './device-more-info';

/** Untouched null/absence remains exact; explicitly choosing Auto removes the key. */
export function markerMoreInfoFields(draft: {
  moreInfoEntity?: Marker['more_info_entity']; moreInfoTouched?: boolean;
}): Pick<Marker, 'more_info_entity'> {
  if (draft.moreInfoTouched) return draft.moreInfoEntity ? { more_info_entity: draft.moreInfoEntity } : {};
  return draft.moreInfoEntity === undefined ? {} : { more_info_entity: draft.moreInfoEntity };
}

export function moreInfoDraftInvalid(draft: {
  binding: string; moreInfoEntity?: Marker['more_info_entity']; moreInfoTouched?: boolean;
}, hass: MoreInfoHass, registry: MoreInfoHass): boolean {
  if (!draft.moreInfoTouched || !draft.moreInfoEntity) return false;
  return !!moreInfoEntityFailure(draft.binding, draft.moreInfoEntity, registry)
    || !hass.states?.[draft.moreInfoEntity];
}
