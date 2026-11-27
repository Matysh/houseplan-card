import { Box3, Mesh, type Scene } from 'three';
import { plan3dCamera, plan3dPaintBounds } from './plan-3d-camera';
import { Plan3dWorld, type Plan3dContactShadow, type Plan3dOutline, type Plan3dWorldInput } from './plan-3d-world';
import { Plan3dViewport, type Plan3dFrame, type Plan3dOutputEvent } from './plan-3d-viewport';
import { readPlan3dMarkerFaces, type Plan3dMarker } from './plan-3d-markers';
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
  labelShadows?: readonly Plan3dContactShadow[];
}

function* snapshotBoxes(scene: Scene): Iterable<Box3> {
  scene.updateMatrixWorld(true);
  const children: Mesh[] = [];
  scene.traverseVisible(object => { if (object instanceof Mesh) children.push(object); });
  const box = new Box3();
  for (const mesh of children) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (bounds) yield box.copy(bounds).applyMatrix4(mesh.matrixWorld);
  }
}

/** Joins the 3D camera to the viewport already used by House Plan gestures.
 * Updating viewBox only changes the crop. Existing geometry stays resident. */
export class Plan3dHost {
  private readonly world: Plan3dWorld;
  private readonly viewport: Plan3dViewport;
  private presentation: Plan3dPresentation | undefined;
  private crop: ViewRect | undefined;
  private markers: readonly Plan3dMarker[] = [];
  private markerIds: ReadonlySet<string> = new Set();
  private outlineMembers: ReadonlySet<string> = new Set();
  private readonly light = new Plan3dLightMotion();
  private animate = 0;
  private frame?: Plan3dFrame;
  private markerFrame = '';
  private paintedMarkers?: readonly Plan3dMarker[];
  private disposed = false;
  private stamp?: string;

  constructor(readonly canvas: HTMLCanvasElement, readonly view: SVGSVGElement,
    normalOffset: number, private readonly onFailure: () => void,
    onPaint: (markers: ReadonlySet<string>, outlines: ReadonlySet<string>, complete: boolean, stamp?: string) => void,
    onOutput?: (event: Plan3dOutputEvent) => void) {
    const document = canvas.ownerDocument;
    this.world = new Plan3dWorld(document, normalOffset, () => this.draw());
    try {
      this.viewport = new Plan3dViewport(canvas, () => this.fail(), (frame) => {
        if (canvas.hasAttribute('data-hp-plan-3d-ready') || frame.complete)
          onPaint(this.markerIds, this.outlineMembers, !!frame.complete, frame.stamp);
      }, () => this.draw(), (event) => {
        if (event === 'webgl-lost' || event === 'canvas-lost') {
          document.defaultView?.cancelAnimationFrame(this.animate);
          this.animate = 0;
        }
        onOutput?.(event);
      });
    } catch (error) {
      this.world.dispose();
      throw error;
    }
  }

  get keepsFullPixels(): boolean { return this.viewport.keepsFullPixels; }
  get outputBlocked(): boolean { return this.viewport.blocked; }

  /** Replaying an unchanged, retained DOM scene can prove the new recovery
   * generation after an actual copy, without replacing the on-screen DOM. */
  retagRetained(stamp: string): void { this.stamp = stamp; }

  present(presentation: Plan3dPresentation, crop: ViewRect, markers: readonly Plan3dMarker[] = [],
    outlines: readonly Plan3dOutline[] = [], stamp?: string): void {
    if (this.disposed) return;
    try {
      this.light.set(presentation.world.lights, presentation.lightScope ?? '', this.now(), presentation.animateLights === true);
      this.world.present({ ...presentation.world, lights: this.light.frame(this.now()).sources });
      this.world.presentOutlines(outlines, presentation.sectionHeight);
      const contrast = !!presentation.world.contrastColors;
      this.world.presentContacts(presentation.world.physical.floor, presentation.bounds,
        contrast ? [] : markers, contrast ? [] : presentation.labelShadows ?? []);
      this.outlineMembers = new Set(outlines.filter(outline => outline.outline).flatMap(outline => outline.members));
      this.presentation = presentation;
      this.markers = markers;
      this.markerIds = new Set(markers.map(marker => marker.id));
      this.crop = crop;
      this.stamp = stamp;
      this.draw(true);
    } catch {
      this.fail();
    }
  }

  paintCamera(crop: ViewRect): void {
    const previous = this.crop;
    if (previous && crop.x === previous.x && crop.y === previous.y && crop.w === previous.w && crop.h === previous.h) return;
    this.crop = crop;
    this.draw(true, true);
  }

  /** DOM hit ownership is live, not a Lit update. Refresh only the two
   * faces whose CSS hover state actually changed, using the current crop. */
  refreshMarkerFaces(elements: readonly (Element | null)[]): void {
    const preset = this.presentation?.preset;
    if (!preset || this.disposed) return;
    let changed = false;
    const markers = this.markers.map(marker => {
      const element = elements.find((node): node is HTMLElement =>
        node instanceof HTMLElement && node.hasAttribute('data-hp-3d-native') && node.dataset.id === marker.id);
      if (!element) return marker;
      const faces = readPlan3dMarkerFaces(element, marker.faces, preset.rotDeg);
      if (!faces) return marker;
      changed = true;
      return { ...marker, faces };
    });
    if (!changed) return;
    this.markers = markers;
    this.draw();
  }

  private draw(immediate = false, cameraOnly = false): void {
    const { presentation, crop } = this;
    if (this.disposed || !presentation || !crop) return;
    try {
      if (!(crop.w > 0 && crop.h > 0)) return;
      const { bounds, content, preset, sectionHeight } = presentation;
      const camera = plan3dCamera(preset, bounds, content, sectionHeight, crop);
      // The gesture moves existing meshes. Reconcile glyph raster density on
      // the next authored frame instead of touching every marker each tick.
      if (!cameraOnly) {
        const { width, height } = this.viewport.pixelSize();
        const markerFrame = [width, height, crop.x, crop.y, crop.w, crop.h, preset.rotDeg, preset.tiltDeg].join('|');
        if (markerFrame !== this.markerFrame || this.markers !== this.paintedMarkers) {
          this.markerFrame = markerFrame;
          this.paintedMarkers = this.markers;
          this.world.presentMarkers(this.markers, width / crop.w, { camera, width, height });
        }
        this.updateLights();
      }
      this.frame = {
        scene: this.world.scene, camera, motion: cameraOnly,
        complete: !this.world.loading, stamp: cameraOnly ? undefined : this.stamp,
      };
      this.viewport.present(this.frame, immediate);
    } catch {
      this.fail();
    }
  }

  private now(): number { return this.canvas.ownerDocument.defaultView?.performance.now() ?? 0; }

  private updateLights(): void {
    const state = this.light.frame(this.now());
    this.world.presentLights(state.sources);
    if (state.active && !this.animate && !this.canvas.ownerDocument.hidden && !this.viewport.blocked) {
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

  screenCoreSilhouettes(ids: ReadonlySet<string>): readonly (readonly (readonly [number, number])[])[] {
    const camera = this.frame?.camera;
    if (!camera || !this.canvas.hasAttribute('data-hp-plan-3d-ready')) return [];
    return this.world.screenCoreSilhouettes(ids, camera, this.canvas.getBoundingClientRect());
  }

  async snapshot(presentation: Plan3dPresentation, view: ViewRect, size: readonly [number, number],
    signal: AbortSignal, portable: boolean): Promise<{ image: Blob | null; full?: { image: Blob; rect: ViewRect } }> {
    if (this.disposed || signal.aborted) return { image: null };
    const world = new Plan3dWorld(this.canvas.ownerDocument, 0);
    try {
      world.present(presentation.world);
      if (!await world.ready() || this.disposed || signal.aborted) return { image: null };
      const { bounds, content, preset, sectionHeight } = presentation;
      const camera = plan3dCamera(preset, bounds, content, sectionHeight, view);
      const image = await this.viewport.snapshot({ scene: world.scene, camera }, { width: size[0], height: size[1] });
      if (signal.aborted || this.disposed) return { image: null };
      if (!portable) return { image };
      const rect = plan3dPaintBounds(camera, view, snapshotBoxes(world.scene));
      if (!rect) return { image };
      // Bounded independently of the source device's screen. The target
      // repositions and clips this image without a second GPU pass.
      const scale = 1500 / Math.max(rect.w, rect.h);
      const full = await this.viewport.snapshot({
        scene: world.scene, camera: plan3dCamera(preset, bounds, content, sectionHeight, rect),
      }, { width: Math.max(1, Math.round(rect.w * scale)), height: Math.max(1, Math.round(rect.h * scale)) });
      if (signal.aborted || this.disposed) return { image: null };
      return { image, full: full ? { image: full, rect } : undefined };
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
    this.canvas.ownerDocument.defaultView?.cancelAnimationFrame(this.animate);
    this.viewport.dispose();
    this.world.dispose();
    this.presentation = undefined;
    this.crop = undefined;
    this.markers = [];
    this.paintedMarkers = this.frame = undefined;
  }
}
