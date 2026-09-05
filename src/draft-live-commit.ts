import type { JunctionSharedGeometry } from './junction-limits';
import type { I18nKey } from './i18n';
import type { ServerConfig } from './types';
import {
  WALL_SEGMENT_MODEL_VERSION,
  adoptWallSegmentModelCandidateInPlace,
  commitWallSegmentModel,
  wallModelOffGridValueCount,
} from './wall-segment-model';
import { spacePhysicalGeometryFingerprint } from './plan-geometry-preflight';
import {
  draftLiveCandidateSpace, draftLiveSeed, isSingleDraftAppend,
} from './draft-live-preflight';

const NORM_W = 1000;

interface DraftLiveHost<State, Geometry> {
  _serverCfg: ServerConfig | null;
  _activeDraftId: string | null;
  _path: number[][];
  _draftSegmentCms: number[];
  _pendingPhysicalWrites: Map<string, { fingerprint: string; before: State }>;
  _checkSpacePhysicalGeometry: (
    config: ServerConfig, spaceId: string,
    captureWallGeometry?: (geometry: Geometry) => void,
  ) => { ok: boolean };
  _showToast: (message: string) => void;
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export interface DraftLiveCommitRuntime<
  State extends { spaceId: string },
  Geometry extends JunctionSharedGeometry,
  Violation,
> {
  host: DraftLiveHost<State, Geometry>;
  _commitPhysicalGeometry: (name: string, before: State | null) => boolean;
  _clearGeometryGesture: () => void;
  _restoreGeometryStateInConfig: (config: ServerConfig, state: State) => boolean;
  _restoreGeometryStateLocal: (state: State) => boolean;
  _showWallModelMigrationBlocked: (error: unknown) => void;
  _junctionLimitsIntroduced: (
    candidate: ServerConfig, previous: ServerConfig, spaceId: string,
    geometry?: Geometry | null, roomIds?: readonly string[],
  ) => Violation[];
  _junctionLimitLabel: (violation: Violation) => string;
  _recordGeometry: (name: string, before: State) => void;
  _saveConfig: () => void;
}

const rejectUnsafe = <State extends { spaceId: string }, Geometry extends JunctionSharedGeometry,
  Violation>(runtime: DraftLiveCommitRuntime<State, Geometry, Violation>, before: State): false => {
  runtime._clearGeometryGesture();
  runtime._restoreGeometryStateLocal(before);
  runtime.host._showToast(runtime.host._t('toast.geometry_unsafe'));
  return false;
};

/**
 * #461 current-model intermediate draft append transaction. Only this exact
 * writer receives a bounded proof; every uncertain shape falls back to the
 * generic full-space barrier owned by the runtime.
 */
export function commitDraftSegmentGeometry<
  State extends { spaceId: string },
  Geometry extends JunctionSharedGeometry,
  Violation,
>(
  runtime: DraftLiveCommitRuntime<State, Geometry, Violation>,
  name: string,
  before: State | null,
): boolean {
  const { host } = runtime;
  const liveCandidate = host._serverCfg;
  const draftId = host._activeDraftId;
  const fallback = () => runtime._commitPhysicalGeometry(name, before);
  if (!before || !liveCandidate || !draftId
      || Number(liveCandidate.model_version || 0) !== WALL_SEGMENT_MODEL_VERSION) return fallback();
  const liveSpace = liveCandidate.spaces.find((space) => space.id === before.spaceId);
  if (!liveSpace || !isSingleDraftAppend(before, liveSpace, draftId)) return fallback();

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
  const seed = draftLiveSeed(committedSpace, draftId);
  if (!committedSpace || !seed) return fallback();

  const previousConfig = JSON.parse(JSON.stringify(liveCandidate)) as ServerConfig;
  if (!runtime._restoreGeometryStateInConfig(previousConfig, before)) return fallback();
  const previousSpace = previousConfig.spaces.find((space) => space.id === before.spaceId);
  const candidateProjection = draftLiveCandidateSpace(committedSpace, seed);
  const previousProjection = draftLiveCandidateSpace(previousSpace, seed);
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
    localCandidate, localPrevious, before.spaceId,
    geometry, candidateProjection.roomIds,
  );
  if (introduced.length) {
    runtime._clearGeometryGesture();
    runtime._restoreGeometryStateLocal(before);
    host._showToast(runtime._junctionLimitLabel(introduced[0]));
    return false;
  }

  adoptWallSegmentModelCandidateInPlace(liveCandidate, committedCandidate);
  const acceptedSpace = liveCandidate.spaces.find((space) => space.id === before.spaceId);
  const acceptedDraft = acceptedSpace?.room_drafts?.find((draft) => draft.id === draftId);
  if (acceptedDraft?.points?.length === host._path.length
      && acceptedDraft?.segments?.length === host._draftSegmentCms.length) {
    // Keep the transient chain on the exact canonical coordinates just
    // adopted into config. Otherwise an IEEE last-bit difference is replayed
    // by the next click and the draft-only diff can no longer be proven.
    host._path = acceptedDraft.points.map((point) => [point[0] * NORM_W, point[1] * NORM_W]);
    host._draftSegmentCms = acceptedDraft.segments.map((segment) => Number(segment.cm));
  }
  runtime._recordGeometry(name, before);
  const pending = host._pendingPhysicalWrites.get(before.spaceId);
  host._pendingPhysicalWrites.set(before.spaceId, {
    before: pending?.before || before,
    fingerprint: spacePhysicalGeometryFingerprint(acceptedSpace),
  });
  runtime._saveConfig();
  return true;
}
