import { plan3dCamera } from './plan-3d-camera';
import { Plan3dWorld, type Plan3dWorldInput } from './plan-3d-world';
import { Plan3dViewport } from './plan-3d-viewport';
import type { IsoCamera, ViewRect } from './iso-projection';

export interface Plan3dPresentation {
  world: Plan3dWorldInput;
  preset: Readonly<IsoCamera>;
  bounds: ViewRect;
  content: ViewRect;
  sectionHeight: number;
}

/** Joins the 3D camera to the viewport already used by House Plan gestures.
 * Updating viewBox only changes the crop. Existing geometry stays resident. */
export class Plan3dHost {
  private readonly world: Plan3dWorld;
  private readonly viewport: Plan3dViewport;
  private readonly observer: MutationObserver;
  private presentation: Plan3dPresentation | undefined;
  private disposed = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly view: SVGSVGElement,
    normalOffset: number, private readonly onFailure: () => void, onPaint: () => void) {
    const document = canvas.ownerDocument;
    const window = document.defaultView;
    if (!window?.MutationObserver) throw new Error('Plan 3D camera cannot be observed');
    this.world = new Plan3dWorld(document, normalOffset, () => this.draw());
    try {
      this.viewport = new Plan3dViewport(canvas, () => this.fail(), onPaint);
    } catch (error) {
      this.world.dispose();
      throw error;
    }
    this.observer = new window.MutationObserver(() => this.draw());
    this.observer.observe(view, { attributes: true, attributeFilter: ['viewBox'] });
  }

  present(presentation: Plan3dPresentation): void {
    if (this.disposed) return;
    try {
      this.world.present(presentation.world);
      this.presentation = presentation;
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
      this.viewport.present({ scene: this.world.scene, camera });
    } catch {
      this.fail();
    }
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
    this.viewport.dispose();
    this.world.dispose();
    this.presentation = undefined;
  }
}
