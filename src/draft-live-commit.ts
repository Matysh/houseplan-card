import type { JunctionSharedGeometry } from './junction-limits';
import type { I18nKey } from './i18n';
import type { ServerConfig } from './types';
import type { GraphEditIntent } from './graph-edit-intent';
import type { PlanGraph } from './plan-graph';
import {
  WALL_SEGMENT_MODEL_VERSION,
  adoptWallSegmentModelCandidateInPlace,
  commitWallSegmentModel,
  wallModelOffGridValueCount,
} from './wall-segment-model';
import { spacePhysicalGeometryFingerprint } from './plan-geometry-preflight';
import {
  wallChainLiveCandidateSpace,
  type WallChainLiveSeed,
} from './draft-live-preflight';

const NORM_W = 1000;

interface WallChainLiveHost<State, Geometry> {
  _serverCfg: ServerConfig | null;
  _activeWallChainPartitionIds: string[];
  _path: number[][];
  _pendingPhysicalWrites: Map<string, { fingerprint: string; before: State }>;
  _checkSpacePhysicalGeometry: (
    config: ServerConfig, spaceId: string,
    captureWallGeometry?: (geometry: Geometry) => void,
  ) => { ok: boolean };
  _showToast: (message: string, id?: string) => void;
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export interface WallChainLiveCommitRuntime<
  State extends { spaceId: string },
  Geometry extends JunctionSharedGeometry,
  Violation extends { readonly rule: string },
> {
  host: WallChainLiveHost<State, Geometry>;
  _commitPhysicalGeometry: (
    name: string, before: State | null,
    additionalAuthoredPoints?: readonly (readonly number[])[], recordHistory?: boolean,
    intent?: GraphEditIntent | { kind: 'prepared'; base: PlanGraph },
  ) => boolean;
  _clearGeometryGesture: () => void;
  _restoreGeometryStateInConfig: (config: ServerConfig, state: State) => boolean;
  _restoreGeometryStateLocal: (state: State) => boolean;
  _showWallModelMigrationBlocked: (error: unknown) => void;
  _junctionLimitsIntroduced: (
    candidate: ServerConfig, previous: ServerConfig, spaceId: string,
    geometry?: Geometry | null, roomIds?: readonly string[],
  ) => Violation[];
  _junctionLimitLabel: (violation: Violation) => string;
  _saveConfig: () => void;
}

/**
 * #477 finish transaction for a chain which has already been normalised on a
 * clone.  It uses the same production physical/junction proof as a terminal
 * click, centred on the pre-normalisation seed.  Unlike a click it records no
 * extra history command: all segment commands already exist.
 */
export function commitWallChainFinishGeometry<
  State extends { spaceId: string },
  Geometry extends JunctionSharedGeometry,
  Violation extends { readonly rule: string },
>(
  runtime: WallChainLiveCommitRuntime<State, Geometry, Violation>,
  name: string,
  before: State | null,
  seed: WallChainLiveSeed | null,
): boolean {
  const { host } = runtime;
  const liveCandidate = host._serverCfg;
  const graphBefore = (before as { plan_graph?: PlanGraph } | null)?.plan_graph;
  const fallback = () => runtime._commitPhysicalGeometry(name, before, [], false,
    graphBefore ? { kind: 'prepared', base: graphBefore }
      : { kind: 'partitions', ids: [...host._activeWallChainPartitionIds] });
  // Current finish has already produced its graph with explicit operations.
  // The projection-only local fast path is a historical codec path.
  if (graphBefore) return fallback();
  if (!before || !liveCandidate || !seed
      || Number(liveCandidate.model_version || 0) !== WALL_SEGMENT_MODEL_VERSION) return fallback();

  let committedCandidate: ServerConfig;
  try {
    committedCandidate = commitWallSegmentModel(liveCandidate).config;
  } catch (error) {
    runtime._clearGeometryGesture();
    runtime._restoreGeometryStateLocal(before);
    runtime._showWallModelMigrationBlocked(error);
    return false;
  }
  const committedSpace = committedCandidate.spaces.find((space) => space.id === before.spaceId);
  const previousConfig = JSON.parse(JSON.stringify(liveCandidate)) as ServerConfig;
  if (!committedSpace || !runtime._restoreGeometryStateInConfig(previousConfig, before)) {
    return fallback();
  }
  const previousSpace = previousConfig.spaces.find((space) => space.id === before.spaceId);
  const candidateProjection = wallChainLiveCandidateSpace(committedSpace, seed);
  const previousProjection = wallChainLiveCandidateSpace(previousSpace, seed);
  if (!candidateProjection || !previousProjection) return fallback();
  const localCandidate = {
    ...committedCandidate, spaces: [candidateProjection.space],
  } as unknown as ServerConfig;
  const localPrevious = {
    ...previousConfig, spaces: [previousProjection.space],
  } as unknown as ServerConfig;

  let geometry: Geometry | null = null;
  let safe = false;
  try {
    const authoredPoints = host._path.length >= 2
      ? host._path.map((point) => [point[0] / NORM_W, point[1] / NORM_W]) : [];
    safe = wallModelOffGridValueCount(committedSpace)
      <= wallModelOffGridValueCount(before, authoredPoints)
      && host._checkSpacePhysicalGeometry(
        localCandidate, before.spaceId, (value) => { geometry = value; },
      ).ok;
  } catch {
    safe = false;
  }
  if (!safe) return rejectUnsafe(runtime, before);
  const introduced = runtime._junctionLimitsIntroduced(
    localCandidate, localPrevious, before.spaceId, geometry, candidateProjection.roomIds,
  );
  if (introduced.length) {
    runtime._clearGeometryGesture();
    runtime._restoreGeometryStateLocal(before);
    host._showToast(runtime._junctionLimitLabel(introduced[0]), `junction.limit_${introduced[0].rule}`);
    return false;
  }

  adoptWallSegmentModelCandidateInPlace(liveCandidate, committedCandidate);
  const acceptedSpace = liveCandidate.spaces.find((space) => space.id === before.spaceId);
  const pending = host._pendingPhysicalWrites.get(before.spaceId);
  host._pendingPhysicalWrites.set(before.spaceId, {
    before: pending?.before || before,
    fingerprint: spacePhysicalGeometryFingerprint(acceptedSpace),
  });
  runtime._saveConfig();
  return true;
}

const rejectUnsafe = <State extends { spaceId: string }, Geometry extends JunctionSharedGeometry,
  Violation extends { readonly rule: string }>(runtime: WallChainLiveCommitRuntime<State, Geometry, Violation>, before: State): false => {
  runtime._clearGeometryGesture();
  runtime._restoreGeometryStateLocal(before);
  runtime.host._showToast(runtime.host._t('toast.geometry_unsafe'), 'toast.geometry_unsafe');
  return false;
};
