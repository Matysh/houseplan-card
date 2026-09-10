/**
 * Config/layout adoption boundary (#500).
 *
 * One owner for the structural identity of the card: the server config with
 * its revision and content fingerprint, and the device layout with its own
 * pair. Before #500 these six fields lived on the host and were assigned from
 * eight modules; every new path that received an authoritative response
 * re-implemented the pre-adoption gate (backdrop readiness → continuity
 * candidate) by hand, and one of them forgot it (#490 M1). Here the identity
 * changes in exactly three ways — adopting an authoritative response,
 * accepting the response to our own write, restoring the warm cache — and the
 * gated sequence exists once, in `adoptAuthoritativeGated`.
 *
 * The module owns identity and order, not the host subsystems touched when a
 * structure changes (geometry history, camera, gestures, virtual lights):
 * those stay on the host and are called through `ConfigAdoptionHostPort` in
 * the order the host used before the extraction.
 */
import type { DeviceLayout } from './device-position-history';
import type { ServerConfig } from './types';
import type { AuthoritativeConfigResponse } from './version-recovery-card';
import { contentFingerprint } from './visual-continuity';
import {
  adoptVirtualLightServerSnapshot,
  virtualLightFingerprint,
  type VirtualLightSnapshot,
  type VirtualLightWireSnapshot,
} from './virtual-light-state';
import { optimisticAttempt, type OptimisticAttempt } from './serialized-write-queue';

export interface LayoutResponse {
  readonly layout?: DeviceLayout | null;
  readonly rev?: number;
  readonly can_optimize_undo?: boolean;
  readonly undo_kind?: string | null;
}

/** Wire shape of the `LS_CFG` warm-start cache. Keys are a persisted contract. */
export interface CachedStructuralSnapshot {
  config: ServerConfig;
  rev: number;
  config_fingerprint: string;
  layout: DeviceLayout;
  layout_rev: number;
  layout_fingerprint: string;
  virtual_lights?: unknown;
}

const configOf = (cfgResp: AuthoritativeConfigResponse | undefined | null): ServerConfig | null => {
  const raw = cfgResp?.config;
  return raw && Array.isArray((raw as ServerConfig).spaces) ? raw as ServerConfig : null;
};

const finiteRevision = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Identity owner. Bodies are stored by reference: the editor mutates the config
 * in place and compares `host._serverCfg === cfg`, so cloning here would break
 * both (#500 I4). Every other module sees the `ConfigAdoption` type below, where
 * the six fields are `readonly`; only the methods of this class write them.
 */
export class MutableConfigAdoption {
  config: ServerConfig | null = null;
  configRev = 0;
  /** Fingerprint of the accepted/sent body; '' until anything was accepted. */
  configFingerprint = '';
  layout: DeviceLayout = {};
  layoutRev = 0;
  layoutFingerprint = '';

  /** Accepted fingerprint, or the live body's when nothing was accepted yet. */
  currentConfigFingerprint(): string {
    return this.configFingerprint || contentFingerprint(this.config);
  }
  currentLayoutFingerprint(): string {
    return this.layoutFingerprint || contentFingerprint(this.layout);
  }

  // --- authoritative responses -------------------------------------------

  /**
   * Adopt an authoritative response pair. Equal content is an echo: the body
   * reference stays, only the revision moves (I3). Different content replaces
   * the body; the matching `onReplace` hook runs between the decision and the
   * replacement so the host can retire state bound to the old baseline. A
   * `layResp` of `undefined` leaves layout identity alone.
   */
  adoptResponses(
    cfgResp: AuthoritativeConfigResponse,
    layResp: LayoutResponse | null | undefined,
    onConfigReplace: () => void,
    onLayoutReplace: () => void,
  ): { configChanged: boolean; layoutChanged: boolean } {
    const next = configOf(cfgResp);
    const nextFingerprint = contentFingerprint(next);
    const configChanged = nextFingerprint !== this.currentConfigFingerprint();
    if (configChanged) {
      onConfigReplace();
      this.config = next;
      this.configFingerprint = nextFingerprint;
    }
    this.configRev = cfgResp?.rev ?? this.configRev;
    let layoutChanged = false;
    if (layResp !== undefined) {
      const nextLayout = layResp?.layout ?? {};
      const nextLayoutFingerprint = contentFingerprint(nextLayout);
      layoutChanged = nextLayoutFingerprint !== this.currentLayoutFingerprint();
      if (layoutChanged) {
        onLayoutReplace();
        this.layout = nextLayout;
        this.layoutFingerprint = nextLayoutFingerprint;
      }
      this.layoutRev = layResp?.rev ?? this.layoutRev;
    }
    return { configChanged, layoutChanged };
  }

  /**
   * `layout/get` merged with positions this card still owns (`_reloadLayoutOnly`):
   * the merged body is what the card shows, the response revision is what the
   * server holds. Reference is kept when content is equal.
   */
  adoptMergedLayout(merged: DeviceLayout, layResp: LayoutResponse, onReplace?: () => void): boolean {
    const fingerprint = contentFingerprint(merged);
    const changed = fingerprint !== contentFingerprint(this.layout);
    if (changed) {
      onReplace?.();
      this.layout = merged;
    }
    this.layoutFingerprint = fingerprint;
    this.layoutRev = layResp?.rev ?? this.layoutRev;
    return changed;
  }

  // --- our own writes -----------------------------------------------------

  /**
   * Expose the canonical candidate the writer is about to send. The reactive
   * root is replaced only when canonicalization actually changed content
   * (#224 review H1); the accepted fingerprint becomes the candidate's.
   */
  stageConfigCandidate(candidate: ServerConfig): void {
    const fingerprint = contentFingerprint(candidate);
    if (fingerprint !== contentFingerprint(this.config)) this.config = candidate;
    this.configFingerprint = fingerprint;
  }

  /**
   * The server answered our `config/set` for `candidate`. The revision is taken
   * together with the body it belongs to (I2). A reply without `rev` keeps the
   * historical `+1` guess — centralized here, see #500 §15 п.3.
   */
  acceptConfigWrite(candidate: ServerConfig, response: { rev?: unknown } | null | undefined): void {
    this.configFingerprint = contentFingerprint(candidate);
    this.configRev = finiteRevision(response?.rev, this.configRev + 1);
  }

  /** Paired write (`plan/optimize`, copy, import): both bodies with both revisions. */
  acceptPairWrite(
    config: ServerConfig,
    layout: DeviceLayout,
    response: { config_rev?: unknown; layout_rev?: unknown } | null | undefined,
  ): void {
    this.config = config;
    this.configFingerprint = contentFingerprint(config);
    this.layout = layout;
    this.layoutFingerprint = contentFingerprint(layout);
    this.configRev = finiteRevision(response?.config_rev, this.configRev + 1);
    this.layoutRev = finiteRevision(response?.layout_rev, this.layoutRev + 1);
  }

  /** Our own `layout/update` reply, or its event: revisions are monotonic. */
  noteLayoutRevision(rev: unknown): void {
    if (typeof rev === 'number' && rev > this.layoutRev) this.layoutRev = rev;
  }

  // --- local staging (bodies only; identity untouched) --------------------

  /** Editor replaced the working config before a write; revision/fingerprint stay. */
  stageLocalConfig(config: ServerConfig | null): void { this.config = config; }
  stageLocalLayout(layout: DeviceLayout): void { this.layout = layout; }

  /**
   * Re-pair fingerprints with the live bodies. Local edits mutate nested
   * config/layout before the debounced write; the cache and the rollback of a
   * rejected physical write need the identity to describe what is actually
   * held (`_cacheSnapshot`, `_rollbackRejectedPhysicalWrites`).
   */
  refreshConfigFingerprint(): void {
    this.configFingerprint = contentFingerprint(this.config);
  }
  refreshLayoutFingerprint(): void {
    this.layoutFingerprint = contentFingerprint(this.layout);
  }

  // --- optimistic writes (#314) -------------------------------------------

  beginOptimistic(previous: ServerConfig, attempted: ServerConfig): OptimisticAttempt<ServerConfig> {
    return optimisticAttempt(previous, attempted, this.configFingerprint, this.configRev, contentFingerprint);
  }

  /**
   * Roll back only the failed candidate this attempt describes. A conflict
   * reload or a newer edit owns a different revision/content and must win.
   */
  rollbackOptimistic(attempt: OptimisticAttempt<ServerConfig>): boolean {
    const current = this.config;
    if (!current || this.configRev !== attempt.revision
        || contentFingerprint(current) !== attempt.attemptedFingerprint) return false;
    this.config = attempt.previous;
    this.configFingerprint = attempt.previousFingerprint;
    return true;
  }

  // --- warm cache -----------------------------------------------------------

  /** Restore from `LS_CFG`; a cache written before fingerprints recomputes them. */
  restoreCached(cached: Partial<CachedStructuralSnapshot> | null | undefined): boolean {
    const config = cached?.config;
    if (!config || !Array.isArray(config.spaces)) return false;
    this.config = config;
    this.configRev = cached?.rev || 0;
    this.configFingerprint = cached?.config_fingerprint || contentFingerprint(config);
    this.layout = cached?.layout || {};
    this.layoutRev = cached?.layout_rev || 0;
    this.layoutFingerprint = cached?.layout_fingerprint || contentFingerprint(this.layout);
    return true;
  }

  /** Snapshot for `LS_CFG`. Re-pairs fingerprints with the cached bodies first. */
  snapshot(virtualLights: unknown): CachedStructuralSnapshot | null {
    if (!this.config) return null;
    this.refreshConfigFingerprint();
    this.refreshLayoutFingerprint();
    return {
      config: this.config,
      rev: this.configRev,
      config_fingerprint: this.configFingerprint,
      layout: this.layout,
      layout_rev: this.layoutRev,
      layout_fingerprint: this.layoutFingerprint,
      virtual_lights: virtualLights,
    };
  }
}

/** What every other module holds: the owner with its identity fields read-only. */
export type ConfigAdoption = Readonly<MutableConfigAdoption>;
export const createConfigAdoption = (): ConfigAdoption => new MutableConfigAdoption();

// ---------------------------------------------------------------------------
// Host side effects and the single gated sequence.

interface Clearable { clear(): void }

export interface ConfigAdoptionHostPort {
  hass: unknown;
  _adoption: ConfigAdoption;
  _space: string;
  _model: unknown[];
  _virtualLights: VirtualLightSnapshot;
  _capturedSnapshotVirtual: string;
  _geometryHistory: Clearable;
  _devicePositionHistory: Clearable;
  _pendingPhysicalWrites: Clearable;
  _canOptimizeUndo: boolean;
  _undoKind: 'optimize' | 'import' | null;
  _serverCanWrite: boolean | null;
  _regSignature: string;
  _continuity: {
    readonly hasCompleteFrame: boolean;
    readonly state: string;
    note(event: string, detail?: Record<string, unknown>): void;
  };
  _signer: { prepareImage(hass: unknown, url: string): Promise<boolean> };
  _cancelDeviceDrag(): unknown;
  _clearRoomFocus(pointer?: boolean): void;
  _cancelCameraTransition(commitTarget?: boolean, keepPresented?: boolean): void;
  _clearGeometryGesture(): void;
  _seedDecorStyle(cfg: ServerConfig | null): void;
  _adoptConfigCapabilities(response: unknown): void;
  _candidateBackdrop(config: ServerConfig | null): string;
  _scheduleLoadRetry(force?: boolean): void;
  _beginContinuityCandidate(reason: string, dataReady: boolean): number;
  _syncDecorAssets(config: ServerConfig | null): Promise<void>;
  _adoptInitialSpace(models: unknown[], authoritative?: boolean): unknown;
  _resumePendingNavMode(): boolean;
  _cacheSnapshot(): void;
}

/**
 * Turn authoritative responses into host state — the former
 * `_adoptStructuralResponses`, side effects in the same order. Equal payloads
 * keep their object references and geometry epoch; equal revisions never hide
 * changed content (#73 §9.4).
 */
export function adoptStructuralResponses(
  host: ConfigAdoptionHostPort,
  cfgResp: AuthoritativeConfigResponse | null | undefined,
  layResp?: LayoutResponse | null,
): { configChanged: boolean; layoutChanged: boolean } {
  const adoption = host._adoption;
  const hadConfig = !!adoption.config;
  const { configChanged, layoutChanged } = adoption.adoptResponses(cfgResp ?? {}, layResp,
    () => {
      // A genuinely different baseline invalidates local geometry undo. A
      // reconnect echo with identical content deliberately does not.
      host._geometryHistory.clear();
      host._devicePositionHistory.clear();
      host._cancelDeviceDrag();
      host._pendingPhysicalWrites.clear();
      host._clearRoomFocus(true);
      // #82: a new structural baseline owns the viewport. Freeze the last
      // painted camera frame before replacing geometry so an obsolete target
      // cannot settle against the new content frame.
      host._cancelCameraTransition(false);
      if (hadConfig) host._clearGeometryGesture();
    },
    () => {
      host._cancelCameraTransition(false);
      host._devicePositionHistory.clear();
      host._cancelDeviceDrag();
    });
  if (configChanged) host._seedDecorStyle(adoption.config);
  if (cfgResp && ('virtual_lights' in cfgResp || 'config' in cfgResp)) {
    const nextVirtualLights = adoptVirtualLightServerSnapshot(
      host._virtualLights,
      cfgResp.virtual_lights as VirtualLightWireSnapshot | null | undefined,
      adoption.configRev,
      'virtual_lights' in cfgResp,
    );
    if (virtualLightFingerprint(nextVirtualLights) !== virtualLightFingerprint(host._virtualLights)) {
      host._virtualLights = nextVirtualLights;
      host._capturedSnapshotVirtual = '';
    }
  }

  host._canOptimizeUndo = !!(cfgResp?.can_optimize_undo || layResp?.can_optimize_undo);
  host._adoptConfigCapabilities(cfgResp);
  host._undoKind = (cfgResp?.undo_kind || layResp?.undo_kind || null) as 'optimize' | 'import' | null;
  if (typeof cfgResp?.can_write === 'boolean') host._serverCanWrite = cfgResp.can_write;
  if (configChanged) host._continuity.note('config-candidate', { configRev: adoption.configRev });
  if (layoutChanged) host._continuity.note('layout-candidate', { layoutRev: adoption.layoutRev });
  return { configChanged, layoutChanged };
}

export type AdoptionReason =
  | 'structural-response' | 'config-reload' | 'summary-recovery'
  | 'space-delete' | 'optimize-undo' | 'import-apply';

export interface GatedAdoptionInput {
  cfgResp?: AuthoritativeConfigResponse | null;
  layResp?: LayoutResponse | null;
  reason: AdoptionReason;
  /**
   * `reload` — the three re-read paths; after adoption the shared tail runs
   * (decor assets, initial space, pending nav mode, cache snapshot).
   * `post-write` — a path that just completed its own paired write and
   * re-reads; the sequence ends at adoption, the caller keeps its own tail.
   */
  profile: 'reload' | 'post-write';
  /** Runs once the gate passed, before adoption (connection flags of the initial load). */
  beforeAdopt?: () => void;
}

export type GatedAdoptionResult =
  | { status: 'asset-wait' }
  | { status: 'adopted'; spaceChanged: boolean };

/**
 * The one adoption sequence (#500 §6.3): compare → backdrop readiness gate →
 * continuity candidate → adopt → profile tail. On `asset-wait` nothing was
 * adopted; a load retry is already scheduled.
 */
export async function adoptAuthoritativeGated(
  host: ConfigAdoptionHostPort,
  input: GatedAdoptionInput,
): Promise<GatedAdoptionResult> {
  const { cfgResp, layResp } = input;
  const adoption = host._adoption;
  const candidateConfig = configOf(cfgResp);
  const structuralChanged = (cfgResp != null
      && contentFingerprint(candidateConfig) !== adoption.currentConfigFingerprint())
    || (layResp != null && contentFingerprint(layResp.layout ?? {}) !== adoption.currentLayoutFingerprint());
  if (structuralChanged) {
    const assetReady = await host._signer.prepareImage(host.hass, host._candidateBackdrop(candidateConfig));
    if (!assetReady) {
      host._continuity.note('asset-failed');
      host._scheduleLoadRetry(true);
      return { status: 'asset-wait' };
    }
  }
  if (structuralChanged && host._continuity.hasCompleteFrame && host._continuity.state === 'steady') {
    host._beginContinuityCandidate(input.reason, true);
  }
  input.beforeAdopt?.();
  const visibleSpace = host._space;
  adoptStructuralResponses(host, cfgResp, layResp);
  if (input.profile === 'reload') {
    void host._syncDecorAssets(candidateConfig).catch(() => undefined);
    host._adoptInitialSpace(host._model, true);
    host._resumePendingNavMode();
    host._cacheSnapshot();
  }
  return { status: 'adopted', spaceChanged: host._space !== visibleSpace };
}
