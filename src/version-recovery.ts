/**
 * Runtime frontend/backend version reconciliation for the full House Plan card.
 *
 * This module deliberately has no DOM, Lit or Home Assistant dependency.  The
 * card supplies the clock, session storage, safety snapshot and reload seam;
 * tests can therefore prove the reload-loop and lifecycle rules without a
 * browser.  Keeping it in the eager graph lets View/kiosk recover even when a
 * stale lazy editor chunk cannot be imported (#462).
 */

export const VERSION_RELOAD_ATTEMPT_KEY = 'houseplan-card:version-reload-target:v1';
export const VERSION_RECOVERY_CHECK_MS = 250;

export type VersionRelation =
  | { kind: 'unknown' }
  | { kind: 'equal'; frontend: string; backend: string }
  | { kind: 'mismatch'; frontend: string; backend: string };

export interface VersionReloadSafetySnapshot {
  connected: boolean;
  initialFrameSettled: boolean;
  viewOnly: boolean;
  surfacesIdle: boolean;
  configWritesIdle: boolean;
  physicalWritesIdle: boolean;
  layoutWritesIdle: boolean;
  gesturesIdle: boolean;
  interactionPauseElapsed: boolean;
  baseZoom: boolean;
}

export interface VersionRecoveryInput {
  frontendVersion: unknown;
  backendVersion: unknown;
  kiosk: boolean;
  reducedMotion: boolean;
}

export interface VersionBannerNotice {
  frontend: string;
  backend: string;
  phase: 'visible' | 'leaving';
  /** Rejects a late animationend after the target or phase changed. */
  token: number;
}

export interface VersionRecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface VersionRecoveryClock {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
}

export interface VersionRecoveryHooks {
  clock: VersionRecoveryClock;
  storage: () => VersionRecoveryStorage | null | undefined;
  safety: () => VersionReloadSafetySnapshot;
  reload: () => void;
  changed: () => void;
}

type ReloadAttemptState = 'fresh' | 'attempted' | 'unavailable';
type ClaimResult = 'claimed' | 'attempted' | 'unavailable';

/** Whitespace is not a version, and comparisons never infer SemVer ordering. */
export function normalizeRuntimeVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function compareRuntimeVersions(frontend: unknown, backend: unknown): VersionRelation {
  const normalizedFrontend = normalizeRuntimeVersion(frontend);
  const normalizedBackend = normalizeRuntimeVersion(backend);
  if (!normalizedFrontend || !normalizedBackend) return { kind: 'unknown' };
  if (normalizedFrontend === normalizedBackend) {
    return { kind: 'equal', frontend: normalizedFrontend, backend: normalizedBackend };
  }
  return { kind: 'mismatch', frontend: normalizedFrontend, backend: normalizedBackend };
}

/**
 * A fulfilled config/get is authoritative even when a concurrently requested
 * layout or a later asset preparation fails.  Adoption therefore belongs to
 * this individual promise, never after an enclosing Promise.all.
 */
export async function fetchAuthoritativeConfig<T>(
  request: () => Promise<T>,
  adopt: (response: T) => void,
): Promise<T> {
  const response = await request();
  adopt(response);
  return response;
}

export function isVersionReloadSafe(snapshot: VersionReloadSafetySnapshot): boolean {
  return snapshot.connected
    && snapshot.initialFrameSettled
    && snapshot.viewOnly
    && snapshot.surfacesIdle
    && snapshot.configWritesIdle
    && snapshot.physicalWritesIdle
    && snapshot.layoutWritesIdle
    && snapshot.gesturesIdle
    && snapshot.interactionPauseElapsed
    && snapshot.baseZoom;
}

/**
 * Read the exact normalized backend target.  Access to the sessionStorage
 * getter itself may throw in privacy-restricted/webview contexts, hence the
 * provider lives inside the try block as well.
 */
function attemptedTarget(
  storageProvider: VersionRecoveryHooks['storage'],
  target: string,
): ReloadAttemptState {
  try {
    const storage = storageProvider();
    if (!storage) return 'unavailable';
    return storage.getItem(VERSION_RELOAD_ATTEMPT_KEY) === target ? 'attempted' : 'fresh';
  } catch {
    return 'unavailable';
  }
}

/**
 * Atomic within one browser event loop: every card re-reads immediately before
 * claiming, writes the target synchronously, and only then may reload.
 */
function claimReloadTarget(
  storageProvider: VersionRecoveryHooks['storage'],
  target: string,
): ClaimResult {
  try {
    const storage = storageProvider();
    if (!storage) return 'unavailable';
    if (storage.getItem(VERSION_RELOAD_ATTEMPT_KEY) === target) return 'attempted';
    storage.setItem(VERSION_RELOAD_ATTEMPT_KEY, target);
    return 'claimed';
  } catch {
    return 'unavailable';
  }
}

const sameRelation = (a: VersionRelation, b: VersionRelation): boolean =>
  a.kind === b.kind
    && (a.kind === 'unknown'
      || (b.kind !== 'unknown' && a.frontend === b.frontend && a.backend === b.backend));

const sameInput = (a: VersionRecoveryInput, b: VersionRecoveryInput): boolean =>
  a.frontendVersion === b.frontendVersion
    && a.backendVersion === b.backendVersion
    && a.kiosk === b.kiosk
    && a.reducedMotion === b.reducedMotion;

export class VersionRecoveryController {
  private _input: VersionRecoveryInput = {
    frontendVersion: null,
    backendVersion: null,
    kiosk: false,
    reducedMotion: false,
  };
  private _relation: VersionRelation = { kind: 'unknown' };
  private _banner: VersionBannerNotice | null = null;
  private _connected = false;
  private _attemptTarget: string | null = null;
  private _attemptState: ReloadAttemptState | null = null;
  private _timer: number | undefined;
  private _noticeToken = 0;

  public constructor(private readonly hooks: VersionRecoveryHooks) {}

  public get relation(): VersionRelation {
    return this._relation;
  }

  public get banner(): VersionBannerNotice | null {
    return this._banner;
  }

  /** True only for a currently actionable mismatch, never for an exit frame. */
  public get hasCurrentMismatchNotice(): boolean {
    return this._relation.kind === 'mismatch' && this._banner?.phase === 'visible';
  }

  public connect(): void {
    if (this._connected) return;
    this._connected = true;
    // Another full card may have claimed this target while this one was away.
    this._attemptTarget = null;
    this._attemptState = null;
    this._reconcile();
  }

  public disconnect(): void {
    if (!this._connected && !this._banner) return;
    this._connected = false;
    this._cancelTimer();
    // A detached element cannot be trusted to deliver animationend.  Reconnect
    // reconstructs the right notice from the retained semantic input.
    if (this._banner) this._banner = null;
  }

  public update(next: VersionRecoveryInput): void {
    const normalized: VersionRecoveryInput = {
      frontendVersion: normalizeRuntimeVersion(next.frontendVersion),
      backendVersion: normalizeRuntimeVersion(next.backendVersion),
      kiosk: next.kiosk === true,
      reducedMotion: next.reducedMotion === true,
    };
    const relation = compareRuntimeVersions(
      normalized.frontendVersion,
      normalized.backendVersion,
    );
    const semanticChanged = !sameInput(this._input, normalized)
      || !sameRelation(this._relation, relation);
    this._input = normalized;
    this._relation = relation;
    if (semanticChanged) this._reconcile();
  }

  /** Complete only the exit animation that still owns this token. */
  public finishBannerExit(token: number): void {
    if (!this._banner || this._banner.phase !== 'leaving' || this._banner.token !== token) return;
    this._banner = null;
    this.hooks.changed();
  }

  private _reconcile(): void {
    this._cancelTimer();
    if (!this._connected || this._relation.kind !== 'mismatch') {
      this._attemptTarget = null;
      this._attemptState = null;
      this._hideBanner();
      return;
    }

    if (!this._input.kiosk) {
      this._attemptTarget = null;
      this._attemptState = null;
      this._showBanner(this._relation.frontend, this._relation.backend);
      return;
    }

    const target = this._relation.backend;
    if (this._attemptTarget !== target || this._attemptState === null) {
      this._attemptTarget = target;
      this._attemptState = attemptedTarget(this.hooks.storage, target);
    }
    if (this._attemptState === 'fresh') {
      this._hideBanner();
      this._armTimer();
      return;
    }
    this._showBanner(this._relation.frontend, target);
  }

  private _armTimer(): void {
    if (!this._connected || this._timer !== undefined
        || this._relation.kind !== 'mismatch' || !this._input.kiosk
        || this._attemptState !== 'fresh') return;
    this._timer = this.hooks.clock.setTimeout(() => {
      this._timer = undefined;
      this._tick();
    }, VERSION_RECOVERY_CHECK_MS);
  }

  private _cancelTimer(): void {
    if (this._timer === undefined) return;
    this.hooks.clock.clearTimeout(this._timer);
    this._timer = undefined;
  }

  private _tick(): void {
    if (!this._connected || this._relation.kind !== 'mismatch'
        || !this._input.kiosk || this._attemptState !== 'fresh') return;
    if (!isVersionReloadSafe(this.hooks.safety())) {
      this._armTimer();
      return;
    }

    const target = this._relation.backend;
    const claim = claimReloadTarget(this.hooks.storage, target);
    this._attemptTarget = target;
    this._attemptState = claim === 'claimed' ? 'attempted' : claim;
    if (claim !== 'claimed') {
      this._showBanner(this._relation.frontend, target);
      return;
    }

    // The attempt is already durable at this point.  If a test seam, browser
    // policy or embedding shell prevents navigation, the same instance falls
    // back to the manual notice rather than silently trying again.
    this._showBanner(this._relation.frontend, target);
    try {
      this.hooks.reload();
    } catch {
      // The target is already durably claimed. A hostile embedding shell or a
      // test seam may reject navigation synchronously; manual recovery remains
      // visible and this card must never arm a second automatic attempt.
    }
  }

  private _showBanner(frontend: string, backend: string): void {
    if (this._banner?.phase === 'visible'
        && this._banner.frontend === frontend && this._banner.backend === backend) return;
    this._banner = {
      frontend,
      backend,
      phase: 'visible',
      token: ++this._noticeToken,
    };
    this.hooks.changed();
  }

  private _hideBanner(): void {
    if (!this._banner) return;
    if (this._input.reducedMotion) {
      this._banner = null;
      this.hooks.changed();
      return;
    }
    if (this._banner.phase === 'leaving') return;
    this._banner = { ...this._banner, phase: 'leaving', token: ++this._noticeToken };
    this.hooks.changed();
  }
}
