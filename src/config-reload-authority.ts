/**
 * Ownership for overlapping authoritative config reads (#543).
 *
 * A revision is monotonic only inside one live HA authority context. Restore,
 * reconnect or an explicit conflict recovery may legitimately establish a new
 * context with a smaller number, so this owner combines a request sequence
 * with a lifecycle generation instead of treating the revision as a global
 * clock.
 */
import type {
  ConfigAdoption,
  GatedAdoptionInput,
  GatedAdoptionResult,
} from './config-adoption';

export interface ConfigReloadContext {
  readonly connection: unknown;
  readonly userId: string | null;
  readonly route: string;
}

export interface ConfigReloadClaim {
  readonly sequence: number;
  readonly lifecycle: number;
  readonly force: boolean;
  readonly context: ConfigReloadContext;
  readonly baselineRevision: number;
  readonly baselineFingerprint: string;
}

export interface ConfigReloadClaimState {
  readonly claim: ConfigReloadClaim;
  readonly context: ConfigReloadContext;
  readonly connected: boolean;
  readonly baselineRevision: number;
  readonly baselineFingerprint: string;
  readonly writePending: boolean;
}

export interface ConfigReloadEventReservation {
  readonly sequence: number;
  readonly lifecycle: number;
  readonly context: ConfigReloadContext;
  readonly observedRevision: number;
}

const sameContext = (left: ConfigReloadContext, right: ConfigReloadContext): boolean =>
  left.connection === right.connection
  && left.userId === right.userId
  && left.route === right.route;

const finiteRevision = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export class ConfigReloadAuthority {
  private sequence = 0;
  private currentSequence = 0;
  private lifecycle = 0;
  private observedHighWater: number | null = null;
  private context: ConfigReloadContext | null = null;

  /**
   * Observe identity even when no read starts. Going away and back is two new
   * generations; an old promise can therefore never revive by string equality.
   */
  observeContext(next: ConfigReloadContext): void {
    if (!this.context) {
      this.context = { ...next };
      return;
    }
    if (sameContext(this.context, next)) return;
    this.context = { ...next };
    this.invalidateLifecycle();
  }

  /** Disconnect, route departure or another explicit authority boundary. */
  invalidateLifecycle(): void {
    this.lifecycle += 1;
    this.currentSequence = ++this.sequence;
    this.observedHighWater = null;
  }

  /**
   * Reserve an ordinary event revision before write deferral. This prevents a
   * later, lower event from replacing the retry timer or superseding the read
   * already reserved for the higher observation.
   */
  observeRevision(
    observed: unknown,
    accepted: unknown,
    context: ConfigReloadContext,
  ): ConfigReloadEventReservation | null {
    this.observeContext(context);
    const revision = finiteRevision(observed);
    if (revision === null) return null;
    const acceptedRevision = finiteRevision(accepted) ?? Number.NEGATIVE_INFINITY;
    const floor = Math.max(acceptedRevision, this.observedHighWater ?? Number.NEGATIVE_INFINITY);
    if (revision <= floor) return null;
    this.observedHighWater = revision;
    return Object.freeze({
      sequence: this.currentSequence,
      lifecycle: this.lifecycle,
      context: { ...context },
      observedRevision: revision,
    });
  }

  /**
   * A config event deferred behind a local writer may start its read only if
   * nothing else claimed the authority meanwhile and the event did not become
   * the accepted write's echo.
   */
  isReservationCurrent(
    reservation: ConfigReloadEventReservation,
    context: ConfigReloadContext,
    accepted: unknown,
  ): boolean {
    this.observeContext(context);
    const acceptedRevision = finiteRevision(accepted) ?? Number.NEGATIVE_INFINITY;
    return reservation.sequence === this.currentSequence
      && reservation.lifecycle === this.lifecycle
      && sameContext(reservation.context, context)
      && reservation.observedRevision === this.observedHighWater
      && reservation.observedRevision > acceptedRevision;
  }

  /** Claim the read before its first network await. */
  begin(input: {
    readonly force: boolean;
    readonly context: ConfigReloadContext;
    readonly baselineRevision: number;
    readonly baselineFingerprint: string;
  }): ConfigReloadClaim {
    this.observeContext(input.context);
    if (input.force) this.invalidateLifecycle();
    const sequence = ++this.sequence;
    this.currentSequence = sequence;
    return Object.freeze({
      sequence,
      lifecycle: this.lifecycle,
      force: input.force,
      context: { ...input.context },
      baselineRevision: input.baselineRevision,
      baselineFingerprint: input.baselineFingerprint,
    });
  }

  /** O(1), side-effect-free for an unchanged context. */
  isCurrent(state: ConfigReloadClaimState): boolean {
    this.observeContext(state.context);
    const claim = state.claim;
    return state.connected
      // Conflict recovery deliberately starts while the rejected writer is
      // still unwinding. Its accepted baseline still protects the claim below;
      // only an ordinary read is disqualified by newly pending local work.
      && (claim.force || !state.writePending)
      && claim.sequence === this.currentSequence
      && claim.lifecycle === this.lifecycle
      && sameContext(claim.context, state.context)
      && claim.baselineRevision === state.baselineRevision
      && claim.baselineFingerprint === state.baselineFingerprint;
  }
}

interface FlushableDebounce {
  pending(): boolean;
  flush(): void;
}

/** Narrow host surface for the complete config-only reload transaction. */
export interface ConfigReloadHostPort {
  hass?: unknown;
  readonly isConnected: boolean;
  readonly _configReloadAuthority: ConfigReloadAuthority;
  readonly _adoption: ConfigAdoption;
  readonly _cfgRev: number;
  readonly _cfgWriting: boolean;
  readonly _saveConfigDebounced: FlushableDebounce;
  _reloadRetry?: number;
  _regSignature: string;
  _continuityDataReady: boolean;
  _getAuthoritativeConfig(): Promise<NonNullable<GatedAdoptionInput['cfgResp']>>;
  _adoptAuthoritative(input: GatedAdoptionInput): Promise<GatedAdoptionResult>;
  _maybeRebuildDevices(): void;
  _restoreZoom(): void;
  _showToast(message: string): void;
  _t(key: string, variables?: Record<string, unknown>): string;
  _errText(error: unknown): string;
  requestUpdate(): void;
}

export const configReloadContext = (
  host: { readonly hass?: unknown },
): ConfigReloadContext => {
  const hass = host.hass as {
    readonly connection?: unknown;
    readonly user?: { readonly id?: unknown } | null;
  } | null | undefined;
  const userId = hass?.user?.id;
  return {
    connection: hass?.connection ?? null,
    userId: typeof userId === 'string' ? userId : null,
    route: location.pathname,
  };
};

const claimCurrent = (host: ConfigReloadHostPort, claim: ConfigReloadClaim): boolean =>
  host._configReloadAuthority.isCurrent({
    claim,
    context: configReloadContext(host),
    connected: host.isConnected,
    baselineRevision: host._cfgRev,
    baselineFingerprint: host._adoption.currentConfigFingerprint(),
    writePending: host._saveConfigDebounced.pending() || host._cfgWriting,
  });

/**
 * Config-only authoritative read, including ownership of every async gap.
 * Kept outside the card core so all request/lifecycle rules remain one small
 * transaction instead of another state machine embedded in the renderer.
 */
export async function reloadConfigOnly(
  host: ConfigReloadHostPort,
  force = false,
  observedRev?: number,
): Promise<void> {
  let reservation: ConfigReloadEventReservation | null = null;
  const owner = host._configReloadAuthority;
  if (!force) {
    if (observedRev !== undefined) {
      reservation = owner.observeRevision(observedRev, host._cfgRev, configReloadContext(host));
      if (!reservation) return;
    }
    if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
    if (host._cfgWriting) {
      clearTimeout(host._reloadRetry);
      host._reloadRetry = window.setTimeout(() => {
        if (reservation && !owner.isReservationCurrent(
          reservation, configReloadContext(host), host._cfgRev,
        )) return;
        void reloadConfigOnly(host, false);
      }, 400);
      return;
    }
  }
  const claim = owner.begin({
    force,
    context: configReloadContext(host),
    baselineRevision: host._cfgRev,
    baselineFingerprint: host._adoption.currentConfigFingerprint(),
  });
  const isCurrent = (): boolean => claimCurrent(host, claim);
  let settleCurrentAttempt = false;
  try {
    const resp = await host._getAuthoritativeConfig();
    if (!isCurrent()) return;
    const adopted = await host._adoptAuthoritative({
      cfgResp: resp,
      reason: 'config-reload',
      profile: 'reload',
      isCurrent,
      afterAdopt: () => { host._regSignature = ''; host._maybeRebuildDevices(); },
    });
    if (adopted.status === 'superseded') return;
    settleCurrentAttempt = true;
    if (adopted.status !== 'adopted') return;
    if (adopted.spaceChanged) host._restoreZoom();
    host.requestUpdate();
  } catch (error: unknown) {
    if (!isCurrent()) return;
    settleCurrentAttempt = true;
    host._showToast(host._t('toast.cfg_reload_failed', { err: host._errText(error) }));
  } finally {
    // Adoption changes its own baseline, so remember the owned outcome rather
    // than re-evaluating the pre-adoption fingerprint after success.
    if (settleCurrentAttempt || isCurrent()) {
      host._continuityDataReady = true;
      host.requestUpdate();
    }
  }
}
