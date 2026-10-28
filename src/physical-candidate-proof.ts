/** One physical proof belongs to one exact writer candidate, never a later edit. */
import { spacePhysicalGeometryFingerprint, type SpacePhysicalGeometryResult } from './plan-geometry-preflight';
import { commitWallSegmentModel, adoptWallSegmentModelCandidateInPlace, WALL_SEGMENT_MODEL_VERSION } from './wall-segment-model';
import type { WallSegmentCommitOptions } from './wall-segment-model';
import type { wallBodiesGeometry } from './wall-thickness';
import type { ServerConfig } from './types';

export interface PhysicalCandidateProof {
  fingerprint: string;
  modelVersion: number;
  result: SpacePhysicalGeometryResult;
  geometry: ReturnType<typeof wallBodiesGeometry> | null;
}

/** Keep geometry out of the serialized verdict; consumers receive the exact successful pass. */
export function physicalCandidateProof(
  config: ServerConfig, spaceId: string,
  check: (config: ServerConfig, spaceId: string, capture: (geometry: ReturnType<typeof wallBodiesGeometry>) => void) => SpacePhysicalGeometryResult,
  previous?: PhysicalCandidateProof | null,
): PhysicalCandidateProof {
  const raw = config.spaces.find(space => space.id === spaceId);
  const fingerprint = spacePhysicalGeometryFingerprint(raw);
  const modelVersion = Number(config.model_version || 0);
  if (previous?.result.ok && previous.fingerprint === fingerprint && previous.modelVersion === modelVersion) return previous;
  let geometry: ReturnType<typeof wallBodiesGeometry> | null = null;
  const result = check({ ...config, spaces: raw ? [raw] : [] }, spaceId, value => { geometry = value; });
  return { fingerprint, modelVersion, result, geometry };
}

/** Current models are space-local; older documents retain their atomic all-space migration. */
export function commitEditedSpaceModel(
  config: ServerConfig, spaceId: string, options: WallSegmentCommitOptions = {},
): ServerConfig {
  if (Number(config.model_version || 0) < WALL_SEGMENT_MODEL_VERSION)
    return commitWallSegmentModel(config, options).config;
  const space = config.spaces.find(item => item.id === spaceId);
  if (!space) return commitWallSegmentModel(config, options).config;
  // The model reads geometry only. Markers and unrelated floors need neither a copy nor migration.
  const committed = commitWallSegmentModel({ model_version: config.model_version, spaces: [space] }, options).config;
  return { ...config, model_version: committed.model_version,
    spaces: config.spaces.map(item => item === space ? committed.spaces[0] : item) };
}

/** Current one-space commits never visit unrelated rooms or live marker objects. */
export function adoptEditedSpaceModelInPlace(target: ServerConfig, candidate: ServerConfig, spaceId: string): void {
  if (Number(target.model_version || 0) < WALL_SEGMENT_MODEL_VERSION || target.markers !== candidate.markers) {
    adoptWallSegmentModelCandidateInPlace(target, candidate);
    return;
  }
  const current = target.spaces.find(space => space.id === spaceId);
  const next = candidate.spaces.find(space => space.id === spaceId);
  if (!current || !next) throw new Error('missing edited space');
  adoptWallSegmentModelCandidateInPlace(current, next);
}