import {
  commitHouseplanViewport, disposeHouseplanViewport, scheduleHouseplanViewport,
} from './live-viewport';
import {
  clearDeviceFocusTip, clearPointerHover, deviceFocusTipActive, hideDeviceFocusTip,
  reconcileDeviceFocusTip, resetHouseplanHover, showDeviceFocusTip, showDevicePointerTip,
  syncHouseplanHover,
} from './live-hover';
import {
  classifyHassRenderChange, type HassRenderDependencies, type HassRenderSnapshot,
} from './render-invalidation';
import type { RenderLifecycle } from './houseplan-render-lifecycle';
import { lightWork } from './devices';
import { lightGeometryFingerprint } from './glow-scene';
import type { DevItem } from './types';

interface LiveRuntimeHost {
  _renderLife: RenderLifecycle;
  _mode: string;
  _cfgEpoch: number;
  _cellCm: number;
  _gridPitch: number;
  _pointers: { size: number };
  _cameraTransition: { active: boolean };
  _deviceDrag?: unknown;
  _physicalDrag?: unknown;
  _physicalRotate?: unknown;
  _decorMove?: unknown;
  _decorDraft?: unknown;
  _dtDrag?: unknown;
  _bdDrag?: unknown;
  _opDrag?: unknown;
  _resize?: { dragging: boolean };
}

/** Lazily loaded DOM-only fast paths; the card keeps a full-render fallback. */
export class LiveRuntime {
  private deferredHass = false;
  private fingerprints = new WeakMap<object, [number, number, number, string]>();
  private geometryBuilds = 0;
  public constructor(private readonly host: object) {}
  /** #850: exact work counters for the performance witness. */
  public work(): Record<string, number> {
    return { lightGraphs: lightWork[0], lightResolutions: lightWork[1],
      lightGeometry: this.geometryBuilds };
  }
  /**
   * #850: the architectural light fingerprint of the card's raw floor record
   * (`lightGeometryFingerprint`), once per record, config epoch and scale
   * instead of once per render pass. In View every config write bumps the
   * epoch and a replaced config brings new records (the #744 floor-key rule).
   * An editor may mutate the record during a gesture without a new epoch: its
   * passes never hit, and the entry they leave is never reused. Without this
   * chunk the card computes the fingerprint on every pass, as before (#848).
   */
  public geometry(record: unknown): string {
    const host = this.host as LiveRuntimeHost;
    const epoch = host._mode === 'view' ? host._cfgEpoch : Number.NaN;
    const cellCm = host._cellCm, gridPitch = host._gridPitch;
    const owner = record && typeof record === 'object' ? record : null;
    const hit = owner && this.fingerprints.get(owner);
    if (hit && hit[0] === epoch && hit[1] === cellCm && hit[2] === gridPitch) return hit[3];
    this.geometryBuilds++;
    const value = lightGeometryFingerprint(record, cellCm, gridPitch);
    if (owner) this.fingerprints.set(owner, [epoch, cellCm, gridPitch, value]);
    return value;
  }
  public hass(
    before: HassRenderSnapshot | null | undefined,
    after: HassRenderSnapshot | null | undefined,
    dependencies: HassRenderDependencies | null,
    intake: () => void,
  ): boolean {
    const change = classifyHassRenderChange(before, after, dependencies);
    const defer = change === 'state' && this.active();
    if (defer) this.deferredHass = true;
    const render = change !== 'none' && !defer;
    // Preserve ReactiveElement's ordering for snapshots which are about to
    // render: willUpdate owns their intake.  Tests, config editors and HA can
    // legitimately finish other same-turn mutations after assigning `hass`.
    // Only a deliberately skipped update needs operational intake here.
    if (!render) {
      (this.host as LiveRuntimeHost)._renderLife.observe(before, after, dependencies, intake);
    }
    return render;
  }
  public clear(): void { this.deferredHass = false; }
  public take(): boolean {
    const pending = this.deferredHass;
    this.deferredHass = false;
    return pending;
  }
  public viewport(now = false): void { scheduleHouseplanViewport(this.host, now); }
  public hover(): void { syncHouseplanHover(this.host); }
  public devicePointerTip(event: PointerEvent, device: DevItem): void {
    showDevicePointerTip(this.host, event, device);
  }
  public deviceFocusTip(target: HTMLElement | null, device: DevItem): void {
    showDeviceFocusTip(this.host, target, device);
  }
  public deviceBlur(deviceId: string): void { hideDeviceFocusTip(this.host, deviceId); }
  public pointerLeave(): void { clearPointerHover(this.host); }
  public deviceFocusActive(): boolean { return deviceFocusTipActive(this.host); }
  public clearDeviceFocus(): void { clearDeviceFocusTip(this.host); }
  public active(): boolean {
    const host = this.host as LiveRuntimeHost;
    return host._pointers.size > 0 || host._cameraTransition.active || !!host._deviceDrag
      || !!host._physicalDrag || !!host._physicalRotate || !!host._decorMove
      || !!host._decorDraft || !!host._dtDrag || !!host._bdDrag || !!host._opDrag
      || !!host._resize?.dragging;
  }
  public commit(): void {
    commitHouseplanViewport(this.host, this.active());
    reconcileDeviceFocusTip(this.host);
    resetHouseplanHover(this.host);
    syncHouseplanHover(this.host);
  }
  public dispose(): void {
    this.fingerprints = new WeakMap();
    disposeHouseplanViewport(this.host);
    clearDeviceFocusTip(this.host);
    resetHouseplanHover(this.host);
  }
}
