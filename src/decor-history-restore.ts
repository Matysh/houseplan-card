/** A presentation-only history step cannot rewrite or retire physical carriers. */
import type { SpaceGeometryState } from './geometry-history-state';
import type { ServerConfig } from './types';
import { contentFingerprint } from './visual-continuity';
import { WALL_SEGMENT_MODEL_VERSION } from './wall-segment-model';

const withoutDecor = ({ decor: _decor, ...physical }: SpaceGeometryState) => physical;
const guarded = (state: SpaceGeometryState) => state.nodeMove || state.wallChainSeedIds || state.roomReferences;
const withoutPresentation = ({ decor: _decor, stairs: _stairs, plan_transform: _plan, ...physical }: SpaceGeometryState) => physical;
const planKeys = ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle', 'plan_opacity'] as const;

/** Preserve the decor lane's current-model and complete-carrier boundary. */
function restorableSpace(config: ServerConfig, before: SpaceGeometryState, target: SpaceGeometryState) {
  if (config.model_version !== WALL_SEGMENT_MODEL_VERSION || guarded(before) || guarded(target)) return;
  const space = config.spaces.find(item => item.id === target.spaceId);
  if (!space || config.spaces.some(item => !Array.isArray(item.wall_segments)
      || 'room_drafts' in item || 'open_spans' in item
      || item.rooms.some(room => 'open_to' in room || !Array.isArray(room.wall_ids)))) return;
  return space;
}

/** False leaves the entire candidate untouched and selects the existing strict lane. */
export function restoreDecorOnlyHistory(config: ServerConfig, before: SpaceGeometryState, target: SpaceGeometryState): boolean {
  if (contentFingerprint(withoutDecor(before)) !== contentFingerprint(withoutDecor(target))) return false;
  const space = restorableSpace(config, before, target);
  if (!space) return false;
  if (Object.prototype.hasOwnProperty.call(target, 'decor') && !Array.isArray(target.decor)) return false;
  if (Object.prototype.hasOwnProperty.call(target, 'decor')) space.decor = structuredClone(target.decor);
  else delete space.decor;
  return true;
}

/** Nonphysical history retains physical record identities, including foreign floors. */
export function restoreNonPhysicalHistory(config: ServerConfig, before: SpaceGeometryState, target: SpaceGeometryState): boolean {
  if (contentFingerprint(withoutPresentation(before)) !== contentFingerprint(withoutPresentation(target))) return false;
  const space = restorableSpace(config, before, target);
  if (!space || ['decor', 'stairs'].some(key => Object.prototype.hasOwnProperty.call(target, key)
      && !Array.isArray(target[key as 'decor' | 'stairs']))) return false;
  const plan = target.plan_transform || {};
  if (typeof plan !== 'object' || Array.isArray(plan) || Object.keys(plan).some(key => !planKeys.some(known => known === key))) return false;
  if (Object.prototype.hasOwnProperty.call(target, 'decor')) space.decor = structuredClone(target.decor);
  else delete space.decor;
  if (Object.prototype.hasOwnProperty.call(target, 'stairs')) space.stairs = structuredClone(target.stairs);
  else delete space.stairs;
  for (const key of planKeys) delete space[key];
  Object.assign(space, structuredClone(plan));
  return true;
}
