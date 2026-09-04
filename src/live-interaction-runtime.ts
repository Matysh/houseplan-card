import {
  commitHouseplanViewport, disposeHouseplanViewport, scheduleHouseplanViewport,
} from './live-viewport';
import { resetHouseplanHover, syncHouseplanHover } from './live-hover';
import {
  classifyHassRenderChange, type HassRenderDependencies,
} from './render-invalidation';

/** Lazily loaded DOM-only fast paths; the card keeps a full-render fallback. */
export class LiveRuntime {
  private deferredHass = false;
  public constructor(private readonly host: any) {}
  public hass(
    before: any, after: any, dependencies: HassRenderDependencies | null, intake: () => void,
  ): boolean {
    const change = classifyHassRenderChange(before, after, dependencies);
    const defer = change === 'state' && this.active();
    if (defer) this.deferredHass = true;
    this.host._renderLife.observe(before, after, dependencies, intake);
    return change !== 'none' && !defer;
  }
  public clear(): void { this.deferredHass = false; }
  public take(): boolean {
    const pending = this.deferredHass;
    this.deferredHass = false;
    return pending;
  }
  public viewport(): void { scheduleHouseplanViewport(this.host); }
  public hover(): void { syncHouseplanHover(this.host); }
  public active(): boolean {
    const host = this.host;
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
