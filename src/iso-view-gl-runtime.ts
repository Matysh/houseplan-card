import { BufferGeometry, Camera, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
  Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { isoViewClipMatrix } from './iso-view-gl-projection';
import { buildIsoGlBatch, isoGlArchitecture, isoGlFurniture, isoGlOpeningPanels } from './iso-view-gl-mesh';
import type { IsoGlFace } from './iso-view-gl-mesh';
import type { IsoOpeningPanel } from './iso-openings';
import type { IsoRenderScene } from './iso-scene-geometry';
import type { DecorFurniture } from './editors/decor/types';
import type { ViewRect } from './iso-projection';
import type { SpaceDisplay } from './logic';

export const REAL_3D_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export interface Real3dFrame {
  scene: IsoRenderScene;
  panels: readonly IsoOpeningPanel[];
  display: SpaceDisplay;
  cellCm: number;
  shapes: readonly DecorFurniture[];
  decorWidth: number;
  decorHeight: number;
  visualScale: number;
}

/** Data-only scene consumer. The card owns hit testing, gestures and camera. */
export class Real3dRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly opaque = new Mesh(new BufferGeometry(), new MeshBasicMaterial({
    vertexColors: true, side: DoubleSide, toneMapped: false,
  }));
  private readonly blended = new Mesh(new BufferGeometry(), new MeshBasicMaterial({
    vertexColors: true, side: DoubleSide, transparent: true, depthWrite: false, toneMapped: false,
  }));
  private frame: Real3dFrame | null = null;
  private sceneSvg: SVGSVGElement | null = null;
  private layer: SVGForeignObjectElement | null = null;
  private resize: ResizeObserver | undefined;
  private observer: MutationObserver | undefined;
  private intersection: IntersectionObserver | undefined;
  private inViewport = true;
  private updateId = 0;
  private disposed = false;
  private bounds: readonly [number, number] = [-1, 1];
  private viewportWidth = 0;
  private viewportHeight = 0;
  private width = 0;
  private height = 0;
  private pixelRatio = 0;
  private sceneKey: readonly unknown[] = [];
  private poseKey = '';
  private cameraKey: readonly unknown[] = [];
  private staticFaces: IsoGlFace[] = [];
  private shapeKey: readonly unknown[] = [];
  private shapeFaces: IsoGlFace[] = [];
  private frames = 0;

  constructor(private readonly doc: Document, private readonly failure: () => void) {
    const canvas = doc.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, depth: true,
      premultipliedAlpha: true, powerPreference: 'default' });
    if (!context) throw new Error('WebGL2 unavailable');
    try {
      this.renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    } catch (error) {
      context.getExtension('WEBGL_lose_context')?.loseContext();
      throw error;
    }
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.doc.addEventListener('visibilitychange', this.onVisibility);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0, 0);
    this.opaque.frustumCulled = this.blended.frustumCulled = false;
    this.scene.add(this.opaque, this.blended);
  }

  private readonly contextLost = (event: Event) => {
    event.preventDefault();
    if (!this.disposed) this.failure();
  };

  private readonly onVisibility = () => {
    if (this.doc.hidden) this.cancel();
    else this.queue();
  };

  private cancel(): void {
    if (this.updateId) this.doc.defaultView?.cancelAnimationFrame(this.updateId);
    this.updateId = 0;
  }

  private readonly queue = () => {
    if (!this.updateId && !this.disposed && !this.doc.hidden && this.inViewport && this.frame) {
      this.updateId = this.doc.defaultView?.requestAnimationFrame(() => {
        this.updateId = 0;
        this.draw();
      }) ?? 0;
    }
  };

  private disconnectObservers(): void {
    this.resize?.disconnect();
    this.observer?.disconnect();
    this.intersection?.disconnect();
    this.resize = undefined;
    this.observer = undefined;
    this.intersection = undefined;
  }

  present(svg: SVGSVGElement, layer: SVGForeignObjectElement, frame: Real3dFrame): void {
    if (this.disposed) return;
    const changedBasis = this.frame?.scene.geometry !== frame.scene.geometry
      || this.frame?.scene.camera !== frame.scene.camera;
    this.frame = frame;
    if (this.layer !== layer) {
      this.layer?.removeAttribute('data-real-3d-ready');
      this.disconnectObservers();
      this.sceneSvg = svg;
      this.layer = layer;
      this.inViewport = true;
      this.cameraKey = [];
      this.viewportWidth = this.viewportHeight = 0;
      layer.append(this.renderer.domElement);
      const win = this.doc.defaultView;
      if (!win?.ResizeObserver) {
        this.failure();
        return;
      }
      // Install observers only after the view has a valid owner.
      {
        // Lit and the live gesture owner can update viewBox and hit targets
        // together. Redraw before paint, not a requestAnimationFrame later.
        this.observer = new win.MutationObserver(() => this.draw());
        this.observer.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
        this.resize = new win.ResizeObserver(([entry]) => {
          if (!entry || this.sceneSvg !== svg || this.layer !== layer) return;
          // Use the observed SVG viewport, never force layout in a camera frame.
          this.viewportWidth = Math.round(entry.contentRect.width);
          this.viewportHeight = Math.round(entry.contentRect.height);
          this.draw();
        });
        this.resize.observe(svg);
        if (win.IntersectionObserver) {
          this.intersection = new win.IntersectionObserver(([entry]) => {
            this.inViewport = entry?.isIntersecting === true;
            if (this.inViewport) this.queue(); else this.cancel();
          });
          this.intersection.observe(svg);
        }
      }
    }
    if (changedBasis || !layer.hasAttribute('data-real-3d-ready')) this.draw();
    else this.queue();
  }

  clearPresentation(): void {
    this.cancel();
    this.disconnectObservers();
    this.frame = null;
    this.sceneSvg = null;
    this.layer?.removeAttribute('data-real-3d-ready');
    this.layer = null;
    this.renderer.domElement.remove();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPresentation();
    this.doc.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.opaque.geometry.dispose();
    this.blended.geometry.dispose();
    this.opaque.material.dispose();
    this.blended.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private refreshGeometry(frame: Real3dFrame): boolean {
    const { scene, display, cellCm, shapes, decorWidth, decorHeight, visualScale, panels } = frame;
    const appearance = {
      roomColor: display.color, roomOpacity: display.opacity, wallColor: display.wallFill.c,
      wallOpacity: display.wallFill.a, openingColor: display.openingAccent3d?.c, openingOpacity: display.openingAccent3d?.a,
    };
    const key = [scene.geometry, scene.floor, scene.camera, appearance.roomColor, appearance.roomOpacity,
      appearance.wallColor, appearance.wallOpacity, appearance.openingColor, appearance.openingOpacity, cellCm,
      display.hideOpenings];
    const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const structureChanged = !same(key, this.sceneKey);
    if (structureChanged) {
      this.staticFaces = isoGlArchitecture(scene, appearance, cellCm, !display.hideOpenings);
      this.sceneKey = key;
    }
    const shapeKey = [scene.camera, decorWidth, decorHeight, visualScale, ...shapes];
    const shapesChanged = !same(shapeKey, this.shapeKey);
    if (shapesChanged) {
      this.shapeKey = shapeKey;
      this.shapeFaces = shapes.flatMap(shape => isoGlFurniture(shape, decorWidth, decorHeight, visualScale, scene.camera));
    }
    const pose = panels.map(panel => panel.surfaces.map(surface => surface.kind + surface.d).join(';')).join('|');
    if (!structureChanged && !shapesChanged && pose === this.poseKey) return false;
    this.poseKey = pose;
    const batch = buildIsoGlBatch([...this.staticFaces, ...this.shapeFaces,
      ...isoGlOpeningPanels(scene, appearance, panels)], scene.camera);
    this.bounds = [batch.minDepth, batch.maxDepth];
    for (const [mesh, data] of [[this.opaque, batch.opaque], [this.blended, batch.blended]] as const) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(data.colors, 4));
      mesh.geometry.dispose();
      mesh.geometry = geometry;
    }
    return true;
  }

  private draw(): void {
    if (this.disposed || this.doc.hidden || !this.inViewport || !this.frame || !this.sceneSvg || !this.layer) return;
    try {
      const { x, y, width: w, height: h } = this.sceneSvg.viewBox.baseVal;
      const pixelW = this.viewportWidth, pixelH = this.viewportHeight;
      if (!(w > 0 && h > 0 && pixelW > 0 && pixelH > 0)) return;
      const density = Math.min(this.doc.defaultView?.devicePixelRatio || 1, 2);
      const contentChanged = this.refreshGeometry(this.frame);
      const key = [this.frame.scene.camera, x, y, w, h, pixelW, pixelH, density];
      if (!contentChanged && key.every((v, i) => this.cameraKey[i] === v)) return;
      this.cameraKey = key;
      const view: ViewRect = { x, y, w, h };
      if (pixelW !== this.width || pixelH !== this.height || density !== this.pixelRatio) {
        this.renderer.setPixelRatio(density);
        this.renderer.setSize(pixelW, pixelH, false);
        this.width = pixelW; this.height = pixelH; this.pixelRatio = density;
      }
      this.camera.projectionMatrix.fromArray(isoViewClipMatrix(this.frame.scene.camera, view, ...this.bounds));
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      this.renderer.render(this.scene, this.camera);
      for (const [attribute, value] of Object.entries({ x, y, width: w, height: h })) this.layer.setAttribute(attribute, String(value));
      this.layer.setAttribute('data-real-3d-ready', '');
      this.layer.dataset.real3dFrames = String(++this.frames);
    } catch {
      this.failure();
    }
  }
}
