/** A presentation-only history step cannot rewrite or retire physical carriers. */
import type { SpaceGeometryState } from './geometry-history-state';
import type { ServerConfig } from './types';
import { contentFingerprint } from './visual-continuity';
import { WALL_SEGMENT_MODEL_VERSION } from './wall-segment-model';

const withoutDecor = ({ decor: _decor, ...physical }: SpaceGeometryState) => physical;
const guarded = (state: SpaceGeometryState) => state.nodeMove || state.wallChainSeedIds || state.roomReferences;

/** False leaves the entire candidate untouched and selects the existing strict lane. */
export function restoreDecorOnlyHistory(config: ServerConfig, before: SpaceGeometryState, target: SpaceGeometryState): boolean {
  if (config.model_version !== WALL_SEGMENT_MODEL_VERSION || guarded(before) || guarded(target)
      || contentFingerprint(withoutDecor(before)) !== contentFingerprint(withoutDecor(target))) return false;
  const space = config.spaces.find(item => item.id === target.spaceId);
  if (!space || config.spaces.some(item => !Array.isArray(item.wall_segments)
      || 'room_drafts' in item || 'open_spans' in item
      || item.rooms.some(room => 'open_to' in room || !Array.isArray(room.wall_ids)))) return false;
  if (Object.prototype.hasOwnProperty.call(target, 'decor') && !Array.isArray(target.decor)) return false;
  if (Object.prototype.hasOwnProperty.call(target, 'decor')) space.decor = structuredClone(target.decor);
  else delete space.decor;
  return true;
}
