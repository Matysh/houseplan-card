import { plan3dCamera } from './plan-3d-camera';
import { Plan3dWorld, type Plan3dOutline, type Plan3dWorldInput } from './plan-3d-world';
import { Plan3dViewport, type Plan3dFrame } from './plan-3d-viewport';
import type { Plan3dMarker } from './plan-3d-markers';
import { Plan3dLightMotion } from './plan-3d-light-motion';
import type { IsoCamera, ViewRect } from './iso-projection';

export interface Plan3dPresentation {
  world: Plan3dWorldInput;
  preset: Readonly<IsoCamera>;
  bounds: ViewRect;
  content: ViewRect;
  sectionHeight: number;
  lightScope?: string;
  animateLights?: boolean;
}

/** Joins the 3D camera to the viewport already used by House Plan gestures.
 * Updating viewBox only changes the crop. Existing geometry stays resident. */
export class Plan3dHost {
  private readonly world: Plan3dWorld;
  private readonly viewport: Plan3dViewport;
  private readonly observer: MutationObserver;
  private presentation: Plan3dPresentation | undefined;
  private markers: readonly Plan3dMarker[] = [];
  private outlineMembers: ReadonlySet<string> = new Set();
  private readonly light = new Plan3dLightMotion();
  private animate = 0;
  private frame?: Plan3dFrame;
  private markerDensity = 0;
  private paintedMarkers?: readonly Plan3dMarker[];
  private disposed = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly view: SVGSVGElement,
    normalOffset: number, private readonly onFailure: () => void,
    onPaint: (markers: ReadonlySet<string>, outlines: ReadonlySet<string>) => void) {
    const document = canvas.ownerDocument;
    const window = document.defaultView;
    if (!window?.MutationObserver) throw new Error('Plan 3D camera cannot be observed');
    this.world = new Plan3dWorld(document, normalOffset, () => this.draw());
    try {
      this.viewport = new Plan3dViewport(canvas, () => this.fail(), () => {
        if (canvas.hasAttribute('data-hp-plan-3d-ready') || !this.world.loading)
          onPaint(new Set(this.markers.map(marker => marker.id)), this.outlineMembers);
      });
    } catch (error) {
      this.world.dispose();
      throw error;
    }
    this.observer = new window.MutationObserver(() => this.draw());
    this.observer.observe(view, { attributes: true, attributeFilter: ['viewBox'] });
  }

  present(presentation: Plan3dPresentation, markers: readonly Plan3dMarker[] = [], outlines: readonly Plan3dOutline[] = []): void {
    if (this.disposed) return;
    try {
      this.light.set(presentation.world.lights, presentation.lightScope ?? '', this.now(), presentation.animateLights === true);
      this.world.present({ ...presentation.world, lights: this.light.frame(this.now()).sources });
      this.world.presentOutlines(outlines, presentation.sectionHeight);
      this.outlineMembers = new Set(outlines.filter(outline => outline.outline).flatMap(outline => outline.members));
      this.presentation = presentation;
      this.markers = markers;
      this.draw();
    } catch {
      this.fail();
    }
  }

  private draw(): void {
    const presentation = this.presentation;
    if (this.disposed || !presentation) return;
    try {
      const { x, y, width: w, height: h } = this.view.viewBox.baseVal;
      if (!(w > 0 && h > 0)) return;
      const { bounds, content, preset, sectionHeight } = presentation;
      const camera = plan3dCamera(preset, bounds, content, sectionHeight, { x, y, w, h });
      const density = this.viewport.density(w);
      if (density !== this.markerDensity || this.markers !== this.paintedMarkers) {
        this.markerDensity = density;
        this.paintedMarkers = this.markers;
        this.world.presentMarkers(this.markers, density);
      }
      this.updateLights();
      this.frame = { scene: this.world.scene, camera };
      this.viewport.present(this.frame);
    } catch {
      this.fail();
    }
  }

  private now(): number { return this.canvas.ownerDocument.defaultView?.performance.now() ?? 0; }

  private updateLights(): void {
    const state = this.light.frame(this.now());
    this.world.presentLights(state.sources);
    if (state.active && !this.animate && !this.canvas.ownerDocument.hidden) {
      this.animate = this.canvas.ownerDocument.defaultView?.requestAnimationFrame(() => {
        this.animate = 0;
        if (this.disposed || !this.frame) return;
        try {
          this.updateLights();
          this.viewport.present({ ...this.frame });
        } catch { this.fail(); }
      }) ?? 0;
    }
  }

  pick(clientX: number, clientY: number): string | undefined {
    const box = this.canvas.getBoundingClientRect();
    return this.viewport.pick((clientX - box.left) / box.width, (clientY - box.top) / box.height);
  }

  async snapshot(presentation: Plan3dPresentation, view: ViewRect, size: readonly [number, number],
    signal: AbortSignal): Promise<Blob | null> {
    if (this.disposed || signal.aborted) return null;
    const world = new Plan3dWorld(this.canvas.ownerDocument, 0);
    try {
      world.present(presentation.world);
      if (!await world.ready() || this.disposed || signal.aborted) return null;
      const { bounds, content, preset, sectionHeight } = presentation;
      const camera = plan3dCamera(preset, bounds, content, sectionHeight, view);
      const blob = await this.viewport.snapshot({ scene: world.scene, camera }, { width: size[0], height: size[1] });
      return signal.aborted ? null : blob;
    } finally {
      world.dispose();
    }
  }

  private fail(): void {
    if (this.disposed) return;
    this.dispose();
    this.onFailure();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.canvas.ownerDocument.defaultView?.cancelAnimationFrame(this.animate);
    this.viewport.dispose();
    this.world.dispose();
    this.presentation = undefined;
    this.markers = [];
    this.paintedMarkers = this.frame = undefined;
  }
}
