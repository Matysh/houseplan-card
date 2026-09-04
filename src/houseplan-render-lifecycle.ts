import {
  haRegistryDiagnostics,
  type HaBindingStatus,
} from './ha-binding-status';
import type { HassRenderDependencies } from './render-invalidation';

export interface HouseplanDiagnosticsCore {
  registry: ReturnType<typeof haRegistryDiagnostics>;
  bindings: Record<HaBindingStatus['kind'], number>;
}

type DiagnosticMarker = { removed?: boolean; binding: string };

/** State kept outside the already oversized card element (#34). */
export class RenderLifecycle {
  private seen: any = null;
  private diagnosticsCache: HouseplanDiagnosticsCore | null = null;

  observe(
    before: any,
    after: any,
    dependencies: HassRenderDependencies | null,
    intake: () => void,
  ): void {
    this.invalidateDiagnosticsForHass(before, after, dependencies);
    this.intake(after, intake);
  }

  intake(snapshot: any, run: () => void): void {
    if (!snapshot || this.seen === snapshot) return;
    this.seen = snapshot;
    run();
  }

  invalidate(): void {
    this.diagnosticsCache = null;
  }

  private invalidateDiagnosticsForHass(
    before: any, after: any, dependencies: HassRenderDependencies | null,
  ): void {
    if (!this.diagnosticsCache) return;
    if (before?.entities !== after?.entities || before?.devices !== after?.devices
        || [...(dependencies?.entityIds || [])].some((entityId) =>
          !!before?.states?.[entityId] !== !!after?.states?.[entityId])) {
      this.invalidate();
    }
  }

  diagnostics(
    hass: any,
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
export function intakeHass(host: any): void {
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
