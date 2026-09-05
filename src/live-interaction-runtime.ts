import {
  commitHouseplanViewport, disposeHouseplanViewport, scheduleHouseplanViewport,
} from './live-viewport';
import { resetHouseplanHover, syncHouseplanHover } from './live-hover';
import {
  classifyHassRenderChange, type HassRenderDependencies, type HassRenderSnapshot,
} from './render-invalidation';
import type { RenderLifecycle } from './houseplan-render-lifecycle';

interface LiveRuntimeHost {
  _renderLife: RenderLifecycle;
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
  public constructor(private readonly host: object) {}
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
  public active(): boolean {
    const host = this.host as LiveRuntimeHost;
    return host._pointers.size > 0 || host._cameraTransition.active || !!host._deviceDrag
      || !!host._physicalDrag || !!host._physicalRotate || !!host._decorMove
      || !!host._decorDraft || !!host._dtDrag || !!host._bdDrag || !!host._opDrag
      || !!host._resize?.dragging;
  }
  public commit(): void {
    commitHouseplanViewport(this.host);
    resetHouseplanHover(this.host);
    syncHouseplanHover(this.host);
  }
  public dispose(): void {
    disposeHouseplanViewport(this.host);
    resetHouseplanHover(this.host);
  }
}
