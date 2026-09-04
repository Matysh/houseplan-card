import {
  applySafeResize, clampSafeResize, safeResizePointerDisplacement,
  validateSafeResize,
  type SafeOpeningIn, type SafeResizeOptions, type SafeResizePlan,
  type SafeResizeResolution,
} from './resize';
import {
  checkWallRecordsPreserved,
  type WallRecordLike,
} from './wall-record-preservation';

export interface ResizeControllerRoom {
  id: string;
  poly: number[][];
  wall_ids?: string[];
}

export interface ResizeProjection<TPreview, TArtifact> {
  preview: TPreview;
  beforeWalls: readonly WallRecordLike[];
  afterWalls: readonly WallRecordLike[];
  artifact: TArtifact | null;
}

export type ResizeProjectionResult<TPreview, TArtifact> =
  | { ok: true; value: ResizeProjection<TPreview, TArtifact> }
  | { ok: false;
      // 'junction-limit' is #329: the step would ADD a wall-junction violation.
      reason: 'missing-context' | 'wall-metadata' | 'physical-geometry'
        | 'junction-limit' };

export type ResizeMoveOutcome<TPreview, TLabels, TArtifact> =
  | { kind: 'accepted'; preview: TPreview; labels: TLabels; artifact: TArtifact | null }
  | { kind: 'rejected'; notify: boolean }
  | { kind: 'no-op' };

export type ResizeFinishOutcome<TPreview, TBefore> =
  | { kind: 'commit'; preview: TPreview; before: TBefore }
  | { kind: 'rejected'; reason: 'stale-snapshot' | 'invalid-topology' | 'invalid-candidate' | 'wall-records' }
  | { kind: 'no-op' };

export type ResizeCancelOutcome<TWallUnion> =
  | { kind: 'cancelled'; restoreWallUnion: TWallUnion | null; restoreEpoch: number | null }
  | { kind: 'no-op' };

export interface ResizeBeginInput<TBefore, TWallUnion> {
  pointerId: number;
  start: [number, number];
  roomId: string;
  plan: SafeResizePlan;
  options: SafeResizeOptions;
  rooms: ResizeControllerRoom[];
  openings: SafeOpeningIn[];
  snapshotIdentity: string;
  before: TBefore;
  wallUnionBefore: TWallUnion | null;
  epochBefore: number;
}

interface AcceptedPreview<TPreview, TLabels, TArtifact> {
  preview: TPreview;
  labels: TLabels | null;
  artifact: TArtifact | null;
  beforeWalls: readonly WallRecordLike[];
  afterWalls: readonly WallRecordLike[];
}

interface ResizeSession<TPreview, TLabels, TBefore, TWallUnion, TArtifact> {
  pointerId: number;
  start: [number, number];
  roomId: string;
  plan: SafeResizePlan;
  options: SafeResizeOptions;
  rooms: ResizeControllerRoom[];
  openings: SafeOpeningIn[];
  snapshotIdentity: string;
  before: TBefore;
  moved: boolean;
  delta: number;
  changedRoomIds: string[];
  rejectionNotified: boolean;
  wallUnionBefore: TWallUnion | null;
  epochBefore: number;
  accepted: AcceptedPreview<TPreview, TLabels, TArtifact> | null;
}

/**
 * Synchronous state machine for the safe fixed-topology Resize transaction.
 * Browser events, Lit rendering and config/history writes deliberately stay in
 * the host; this class owns every mutable piece of the gesture itself.
 */
export class ResizeController<TPreview, TLabels, TBefore, TWallUnion, TArtifact> {
  private _selectedRoomId: string | null = null;
  private _session: ResizeSession<TPreview, TLabels, TBefore, TWallUnion, TArtifact> | null = null;
  private _eligibility: { context: string; values: Map<string, SafeResizeResolution> } | null = null;

  get dragging(): boolean { return this._session !== null; }
  ownsPointer(pointerId: number): boolean { return this._session?.pointerId === pointerId; }
  get selectedRoomId(): string | null { return this._selectedRoomId; }
  get snapshotIdentity(): string | null { return this._session?.snapshotIdentity || null; }
  get activePointerId(): number | null { return this._session?.pointerId ?? null; }
  get moved(): boolean { return this._session?.moved === true; }
  get delta(): number { return this._session?.delta || 0; }
  get rooms(): readonly ResizeControllerRoom[] | null { return this._session?.rooms || null; }
  get openings(): readonly SafeOpeningIn[] | null { return this._session?.openings || null; }
  get plan(): SafeResizePlan | null { return this._session?.plan || null; }
  get preview(): TPreview | null { return this._session?.accepted?.preview || null; }
  get liveLabels(): TLabels | null { return this._session?.accepted?.labels || null; }

  selectRoom(roomId: string | null): void { this._selectedRoomId = roomId; }
  restoreSelection(roomId: string | null): void { this._selectedRoomId = roomId; }

  /** Preserve the historical two-step Escape behavior of latent selection. */
  escapeIdle(): 'selection-cleared' | 'exit-tool' {
    if (this._selectedRoomId) {
      this._selectedRoomId = null;
      return 'selection-cleared';
    }
    return 'exit-tool';
  }

  resolve(
    context: string,
    key: string,
    compute: () => SafeResizeResolution,
  ): SafeResizeResolution {
    if (!this._eligibility || this._eligibility.context !== context) {
      this._eligibility = { context, values: new Map() };
    }
    const cached = this._eligibility.values.get(key);
    if (cached) return cached;
    const value = compute();
    this._eligibility.values.set(key, value);
    return value;
  }

  begin(input: ResizeBeginInput<TBefore, TWallUnion>): boolean {
    if (this._session) return false;
    this._session = {
      pointerId: input.pointerId,
      start: [...input.start],
      roomId: input.roomId,
      plan: input.plan,
      options: input.options,
      rooms: input.rooms,
      openings: input.openings,
      snapshotIdentity: input.snapshotIdentity,
      before: input.before,
      moved: false,
      delta: 0,
      changedRoomIds: [...input.plan.roomIds],
      rejectionNotified: false,
      wallUnionBefore: input.wallUnionBefore,
      epochBefore: input.epochBefore,
      accepted: null,
    };
    return true;
  }

  move(input: {
    pointerId: number;
    point: [number, number];
    step: number;
    snap: (point: [number, number]) => [number, number];
    project: (
      snapshotIdentity: string,
      polys: Record<string, number[][]>,
      openings: Record<string, [number, number]>,
      changedRoomIds: readonly string[],
      rooms: readonly ResizeControllerRoom[],
    ) => ResizeProjectionResult<TPreview, TArtifact>;
    measure: (
      candidate: { polys: Record<string, number[][]>; openings: Record<string, [number, number]> },
      plan: SafeResizePlan,
    ) => TLabels;
    publish: (preview: TPreview | null, artifact: TArtifact | null) => void;
  }): ResizeMoveOutcome<TPreview, TLabels, TArtifact> {
    const session = this._session;
    if (!session || session.pointerId !== input.pointerId) return { kind: 'no-op' };
    const dRaw = safeResizePointerDisplacement(session.start, input.point, session.plan.n);
    const snapped = input.snap([
      session.plan.a[0] + session.plan.n[0] * dRaw,
      session.plan.a[1] + session.plan.n[1] * dRaw,
    ]);
    const wanted = (snapped[0] - session.plan.a[0]) * session.plan.n[0]
      + (snapped[1] - session.plan.a[1]) * session.plan.n[1];
    const delta = clampSafeResize(
      session.rooms, session.openings, session.plan, wanted, input.step, session.options,
    );
    if (session.moved && delta === session.delta) return { kind: 'no-op' };

    const candidate = applySafeResize(session.rooms, session.openings, session.plan, delta);
    let projected: ResizeProjectionResult<TPreview, TArtifact>;
    try {
      projected = input.project(
        session.snapshotIdentity, candidate.polys, candidate.openings,
        session.changedRoomIds, session.rooms,
      );
      if (!projected.ok) return this._projectionRejected(session);
      if (checkWallRecordsPreserved(
        projected.value.beforeWalls, projected.value.afterWalls,
        { exactMultiplicity: true },
      ).length) return this._projectionRejected(session);
    } catch {
      return this._projectionRejected(session);
    }

    const previous = session.accepted;
    const accepted: AcceptedPreview<TPreview, TLabels, TArtifact> = {
      preview: projected.value.preview,
      labels: null,
      artifact: projected.value.artifact,
      beforeWalls: projected.value.beforeWalls,
      afterWalls: projected.value.afterWalls,
    };
    // Expose the exact candidate while the host derives labels from its normal
    // render model. Both assignments are synchronous; a failed adapter rolls
    // back the complete accepted tuple before control returns to the browser.
    session.accepted = accepted;
    try {
      input.publish(accepted.preview, accepted.artifact);
      accepted.labels = input.measure(candidate, session.plan);
    } catch {
      session.accepted = previous;
      try { input.publish(previous?.preview || null, previous?.artifact || null); } catch { /* bounded */ }
      return this._projectionRejected(session);
    }
    session.moved = true;
    session.delta = delta;
    return {
      kind: 'accepted', preview: projected.value.preview, labels: accepted.labels,
      artifact: projected.value.artifact,
    };
  }

  finish(input: {
    pointerId: number;
    currentSnapshotIdentity: string;
    validatePreview: (preview: TPreview) => boolean;
  }): ResizeFinishOutcome<TPreview, TBefore> {
    const session = this._session;
    if (!session || session.pointerId !== input.pointerId) return { kind: 'no-op' };
    const accepted = session.accepted;
    const wantedCommit = session.moved && Math.abs(session.delta) > 1e-9;
    let outcome: ResizeFinishOutcome<TPreview, TBefore>;
    if (!wantedCommit || !accepted) {
      outcome = { kind: 'no-op' };
    } else if (input.currentSnapshotIdentity !== session.snapshotIdentity) {
      outcome = { kind: 'rejected', reason: 'stale-snapshot' };
    } else if (!validateSafeResize(
      session.rooms, session.openings, session.plan, session.delta, session.options,
    )) {
      outcome = { kind: 'rejected', reason: 'invalid-topology' };
    } else if (checkWallRecordsPreserved(
      accepted.beforeWalls, accepted.afterWalls, { exactMultiplicity: true },
    ).length) {
      outcome = { kind: 'rejected', reason: 'wall-records' };
    } else {
      let valid = false;
      try { valid = input.validatePreview(accepted.preview); } catch { valid = false; }
      outcome = valid
        ? { kind: 'commit', preview: accepted.preview, before: session.before }
        : { kind: 'rejected', reason: 'invalid-candidate' };
    }
    this._session = null;
    if (outcome.kind === 'commit') this._eligibility = null;
    return outcome;
  }

  cancel(
    currentSnapshotIdentity: string, pointerId?: number,
  ): ResizeCancelOutcome<TWallUnion> {
    const session = this._session;
    if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) {
      return { kind: 'no-op' };
    }
    this._session = null;
    this._eligibility = null;
    const snapshotMatches = currentSnapshotIdentity === session.snapshotIdentity;
    return {
      kind: 'cancelled',
      restoreWallUnion: snapshotMatches ? session.wallUnionBefore : null,
      restoreEpoch: snapshotMatches ? session.epochBefore : null,
    };
  }

  reset(): void {
    this._selectedRoomId = null;
    this._session = null;
    this._eligibility = null;
  }

  private _projectionRejected(
    session: ResizeSession<TPreview, TLabels, TBefore, TWallUnion, TArtifact>,
  ): ResizeMoveOutcome<TPreview, TLabels, TArtifact> {
    const notify = !session.rejectionNotified;
    session.rejectionNotified = true;
    return { kind: 'rejected', notify };
  }
}
