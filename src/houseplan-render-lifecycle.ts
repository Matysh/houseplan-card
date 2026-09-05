import {
  haRegistryDiagnostics,
  type HaBindingStatus,
} from './ha-binding-status';
import type { HassRenderDependencies, HassRenderSnapshot } from './render-invalidation';

export interface HouseplanDiagnosticsCore {
  registry: ReturnType<typeof haRegistryDiagnostics>;
  bindings: Record<HaBindingStatus['kind'], number>;
}

type DiagnosticMarker = { removed?: boolean; binding: string };

/** State kept outside the already oversized card element (#34). */
export class RenderLifecycle {
  private seen: unknown = null;
  private diagnosticsCache: HouseplanDiagnosticsCore | null = null;

  observe(
    before: HassRenderSnapshot | null | undefined,
    after: HassRenderSnapshot | null | undefined,
    dependencies: HassRenderDependencies | null,
    intake: () => void,
  ): void {
    this.invalidateDiagnosticsForHass(before, after, dependencies);
    this.intake(after, intake);
  }

  intake(snapshot: unknown, run: () => void): void {
    if (!snapshot || this.seen === snapshot) return;
    this.seen = snapshot;
    run();
  }

  invalidate(): void {
    this.diagnosticsCache = null;
  }

  private invalidateDiagnosticsForHass(
    before: HassRenderSnapshot | null | undefined,
    after: HassRenderSnapshot | null | undefined,
    dependencies: HassRenderDependencies | null,
  ): void {
    if (!this.diagnosticsCache) return;
    if (before?.entities !== after?.entities || before?.devices !== after?.devices
        || [...(dependencies?.entityIds || [])].some((entityId) =>
          !!before?.states?.[entityId] !== !!after?.states?.[entityId])) {
      this.invalidate();
    }
  }

  diagnostics(
    hass: unknown,
    markers: readonly DiagnosticMarker[],
    resolve: (binding: string) => HaBindingStatus,
  ): HouseplanDiagnosticsCore {
    if (this.diagnosticsCache) return this.diagnosticsCache;
    const bindings: Record<HaBindingStatus['kind'], number> = {
      active: 0, ha_disabled: 0, orphaned: 0, unverified: 0,
    };
    for (const marker of markers) {
      if (marker.removed || marker.binding === 'virtual') continue;
      bindings[resolve(marker.binding).kind]++;
    }
    this.diagnosticsCache = { registry: haRegistryDiagnostics(hass), bindings };
    return this.diagnosticsCache;
  }
}

/** Operational work that must survive a deliberately skipped visual update. */
interface HassIntakeHost {
  _hassSequence: number;
  _renderSnapshotAt: number;
  _continuity: { note: (reason: string) => void };
  _ensureHaRegistryAuthority: () => void;
  _planHassMemo: unknown;
  _hookConnection: () => void;
  _loadOk: boolean;
  _loading: boolean;
  _loadTries: number;
  _loadFromServer: () => unknown;
  _maybeRebuildDevices: () => void;
  _vacTick: () => void;
  _activityTick: () => void;
}

export function intakeHass(value: object): void {
  const host = value as HassIntakeHost;
  host._hassSequence++;
  host._renderSnapshotAt = Date.now();
  host._continuity.note('hass-snapshot');
  host._ensureHaRegistryAuthority();
  host._planHassMemo = null;
  host._hookConnection();
  if (!host._loadOk && !host._loading && host._loadTries < 8) host._loadFromServer();
  host._maybeRebuildDevices();
  host._vacTick();
  host._activityTick();
}
