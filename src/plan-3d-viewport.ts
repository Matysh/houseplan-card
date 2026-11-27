import { Camera, Color, Frustum, Matrix4, Mesh, MeshBasicMaterial, NoColorSpace, Scene, SRGBColorSpace,
  WebGLRenderer, WebGLRenderTarget, type Material, type Object3D } from 'three';
import { startupWebpFromCanvas } from './startup-floor-wire';
import { Plan3dRestoreBudget } from './plan-3d-recovery-budget';

export interface Plan3dFrame {
  scene: Scene;
  camera: Camera;
  motion?: boolean;
  complete?: boolean;
  stamp?: string;
}

export type Plan3dOutputEvent = 'webgl-lost' | 'webgl-restored' | 'canvas-lost' | 'canvas-restored' | 'display-geometry';
export interface Plan3dPickSurface {
  id?: string;
  occludes?: boolean;
  /** The material map is opaque paint on an actual cap, not a cutout. */
  geometryOnly?: boolean;
}

type Size = { width: number; height: number };
const PIXEL_LIMIT = 8_300_000;
const sharedByDocument = new WeakMap<Document, Plan3dOutput>();

/** The GPU canvas is detached. Each card keeps its last painted frame in a
 * separate display canvas, while the document shares one WebGL context. */
class Plan3dOutput {
  private readonly renderer: WebGLRenderer;
  private readonly pickTarget = new WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
  private readonly pickCamera = new Camera();
  private readonly pickCrop = new Matrix4();
  private readonly pickFrustum = new Frustum();
  private readonly pixel = new Uint8Array(4);
  private readonly views = new Set<Plan3dViewport>();
  private readonly pending = new Set<Plan3dViewport>();
  private request = 0;
  private lost = false;
  private readonly restoreBudget: Plan3dRestoreBudget;

  constructor(private readonly document: Document) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!context) throw new Error('Plan 3D requires WebGL2');
    try {
      this.renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    } catch (error) {
      context.getExtension('WEBGL_lose_context')?.loseContext();
      throw error;
    }
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0, 0);
    this.pickTarget.texture.colorSpace = NoColorSpace;
    this.restoreBudget = new Plan3dRestoreBudget({
      now: () => document.defaultView!.performance.now(),
      setTimeout: (callback, delay) => document.defaultView!.setTimeout(callback, delay),
      clearTimeout: (id) => document.defaultView!.clearTimeout(id),
    }, () => { for (const view of [...this.views]) view.fail(); });
    canvas.addEventListener('webglcontextlost', this.contextLost);
    canvas.addEventListener('webglcontextrestored', this.contextRestored);
    document.addEventListener('visibilitychange', this.visibility);
  }

  private readonly contextLost = (event: Event) => {
    event.preventDefault();
    if (this.lost) return;
    this.lost = true;
    this.document.defaultView?.cancelAnimationFrame(this.request);
    this.request = 0;
    this.pending.clear();
    this.restoreBudget.begin(!this.document.hidden);
    for (const view of this.views) view.gpuLost();
  };

  private readonly contextRestored = () => {
    if (!this.lost || !this.views.size) return;
    // Three's own listener was registered first; it has rebuilt the GL state.
    // Existing scenes own the CPU objects used to refill GPU resources.
    this.renderer.setClearColor(0, 0);
    this.lost = false;
    for (const view of this.views) view.gpuRestored();
  };

  get unavailable(): boolean { return this.lost || this.renderer.getContext().isContextLost(); }
  completePaint(): void { this.restoreBudget.finish(); }

  private readonly visibility = () => {
    this.restoreBudget.visibility(!this.document.hidden);
    for (const view of this.views) view.visibilityChanged();
    if (this.document.hidden) {
      this.document.defaultView?.cancelAnimationFrame(this.request);
      this.request = 0;
      return;
    }
    for (const view of this.views) view.resume();
  };

  attach(view: Plan3dViewport): void {
    this.views.add(view);
    if (this.unavailable) view.gpuLost();
  }

  queue(view: Plan3dViewport): void {
    if (this.unavailable || !this.views.has(view)) return;
    this.pending.add(view);
    if (!this.request && !this.document.hidden) {
      this.request = this.document.defaultView?.requestAnimationFrame(() => {
        this.request = 0;
        const batch = [...this.pending];
        this.pending.clear();
        for (const target of batch) if (this.views.has(target)) target.paint();
      }) ?? 0;
    }
  }

  paintNow(view: Plan3dViewport): void {
    if (this.unavailable || !this.views.has(view)) return;
    this.pending.delete(view);
    if (!this.pending.size && this.request) {
      this.document.defaultView?.cancelAnimationFrame(this.request);
      this.request = 0;
    }
    if (!this.document.hidden) view.paint();
  }

  draw(frame: Plan3dFrame, context: CanvasRenderingContext2D, size: Size): boolean {
    if (this.unavailable || context.isContextLost?.()) return false;
    const source = this.renderer.domElement;
    if (source.width !== size.width || source.height !== size.height) {
      this.renderer.setSize(size.width, size.height, false);
    }
    this.renderer.render(frame.scene, frame.camera);
    if (this.unavailable || context.isContextLost?.()) return false;

    const target = context.canvas;
    if (target.width !== size.width) target.width = size.width;
    if (target.height !== size.height) target.height = size.height;
    // Replace even transparent pixels in the same operation; don't clear
    // a still-usable display while the detached GPU is being restored.
    const compositing = context.globalCompositeOperation;
    context.globalCompositeOperation = 'copy';
    try { context.drawImage(source, 0, 0); }
    finally { context.globalCompositeOperation = compositing; }
    return !context.isContextLost?.();
  }

  pick(frame: Plan3dFrame, x: number, y: number, size: Size): string | undefined {
    // Crop the same projection to the device pixel under the pointer. Meshes
    // below reuse the visible scene's world matrices and geometry.
    const px = Math.floor(x * size.width), py = Math.floor(y * size.height);
    this.pickCrop.set(
      size.width, 0, 0, size.width - 2 * px - 1,
      0, size.height, 0, 2 * py + 1 - size.height,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    frame.camera.updateMatrixWorld(true);
    this.pickCamera.matrixAutoUpdate = false;
    this.pickCamera.matrix.copy(frame.camera.matrixWorld);
    this.pickCamera.updateMatrixWorld(true);
    this.pickCamera.projectionMatrix.multiplyMatrices(this.pickCrop, frame.camera.projectionMatrix);
    this.pickCamera.projectionMatrixInverse.copy(this.pickCamera.projectionMatrix).invert();
    this.pickFrustum.setFromProjectionMatrix(this.pickCrop.multiplyMatrices(
      this.pickCamera.projectionMatrix, this.pickCamera.matrixWorldInverse));
    frame.scene.updateMatrixWorld(true);

    const scene = new Scene();
    const ids = new Map<string, number>();
    const keys = [''];
    const materials = new Map<string, MeshBasicMaterial>();
    const pickMaterial = (number: number, source: Material, policy: Plan3dPickSurface | undefined) => {
      const visible = source.visible && source.opacity > 0 && (number !== 0
        || (policy?.occludes ?? (!source.transparent || source.opacity >= 1)));
      const texture = !policy?.geometryOnly && source instanceof MeshBasicMaterial ? source.map : null;
      const alphaTest = texture ? Math.max(.05, source.alphaTest) : source.alphaTest;
      const key = [number, visible, source.side, texture?.id, alphaTest].join('/');
      let material = materials.get(key);
      if (material) return material;
      const color = new Color().setRGB((number & 255) / 255, ((number >> 8) & 255) / 255, ((number >> 16) & 255) / 255);
      material = new MeshBasicMaterial({ color, visible, side: source.side, map: texture, alphaTest, toneMapped: false });
      if (texture) {
        // Preserve cutout coverage, but keep the identifier independent of
        // the tint and artwork painted over the marker's geometry.
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
            'diffuseColor.a *= texture2D(map, vMapUv).a;');
        };
        material.customProgramCacheKey = () => 'houseplan-pick-alpha';
      }
      materials.set(key, material);
      return material;
    };
    frame.scene.traverseVisible((object: Object3D) => {
      if (!(object instanceof Mesh)) return;
      if (object.frustumCulled && !this.pickFrustum.intersectsObject(object)) return;
      const policy = object.userData.plan3dPick as Plan3dPickSurface | undefined;
      if (!policy?.id && policy?.occludes === false) return;
      const id = policy?.id;
      let number = id ? ids.get(id) ?? 0 : 0;
      if (id && !number) {
        number = keys.push(id) - 1;
        ids.set(id, number);
      }
      const material = Array.isArray(object.material)
        ? object.material.map(source => pickMaterial(number, source, policy))
        : pickMaterial(number, object.material, policy);
      const mesh = new Mesh(object.geometry, material);
      mesh.renderOrder = object.renderOrder;
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(object.matrixWorld);
      scene.add(mesh);
    });

    const target = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(this.pickTarget);
      this.renderer.render(scene, this.pickCamera);
      this.renderer.readRenderTargetPixels(this.pickTarget, 0, 0, 1, 1, this.pixel);
      return keys[this.pixel[0] | (this.pixel[1] << 8) | (this.pixel[2] << 16)] || undefined;
    } finally {
      this.renderer.setRenderTarget(target);
      for (const material of materials.values()) material.dispose();
    }
  }

  detach(view: Plan3dViewport): void {
    this.views.delete(view);
    this.pending.delete(view);
    if (this.views.size) return;
    this.document.defaultView?.cancelAnimationFrame(this.request);
    this.document.removeEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored);
    this.restoreBudget.finish();
    this.pickTarget.dispose();
    this.renderer.dispose();
    if (!this.lost) this.renderer.forceContextLoss();
    if (sharedByDocument.get(this.document) === this) sharedByDocument.delete(this.document);
  }
}

export class Plan3dViewport {
  private readonly context: CanvasRenderingContext2D;
  private readonly output: Plan3dOutput;
  private readonly resize: ResizeObserver;
  private readonly intersection: IntersectionObserver | undefined;
  private frame: Plan3dFrame | undefined;
  private painted: Plan3dFrame | undefined;
  private cssSize: Size = { width: 0, height: 0 };
  private visible = true;
  private disposed = false;
  private drawMs = 0;
  private motionScale = 1;
  private displayLost = false;
  private recoveryPending = false;
  private fullCopy = false;
  private readonly displayBudget: Plan3dRestoreBudget;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly failure: () => void,
    private readonly onPaint: (frame: Plan3dFrame) => void, private readonly onResume?: () => void,
    private readonly onOutput?: (event: Plan3dOutputEvent) => void) {
    const document = canvas.ownerDocument;
    const window = document.defaultView;
    const context = canvas.getContext('2d');
    if (!window?.ResizeObserver || !context) throw new Error('Plan 3D output cannot be measured');
    this.context = context;
    let output = sharedByDocument.get(document);
    if (!output) {
      output = new Plan3dOutput(document);
      sharedByDocument.set(document, output);
    }
    this.output = output;
    this.displayBudget = new Plan3dRestoreBudget({
      now: () => window.performance.now(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (id) => window.clearTimeout(id),
    }, () => this.fail());
    canvas.addEventListener('contextlost', this.canvasLost);
    canvas.addEventListener('contextrestored', this.canvasRestored);
    this.resize = new window.ResizeObserver(([entry]) => {
      if (!entry) return;
      const resized = entry.contentRect.width !== this.cssSize.width || entry.contentRect.height !== this.cssSize.height;
      this.cssSize = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (resized && this.recoveryPending) this.onOutput?.('display-geometry');
      this.painted = undefined;
      if (!this.frame?.motion) this.onResume?.();
      this.output.queue(this);
    });
    this.resize.observe(canvas);
    if (window.IntersectionObserver) {
      this.intersection = new window.IntersectionObserver(([entry]) => {
        this.visible = entry?.isIntersecting === true;
        if (this.visible) this.output.queue(this);
      });
      this.intersection.observe(canvas);
    }
    output.attach(this);
  }

  get blocked(): boolean { return this.output.unavailable || this.displayLost || !!this.context.isContextLost?.(); }
  get keepsFullPixels(): boolean { return this.fullCopy && !this.displayLost && !this.context.isContextLost?.(); }

  gpuLost(): void { this.recoveryPending = true; this.onOutput?.('webgl-lost'); }

  gpuRestored(): void {
    this.painted = undefined;
    this.onOutput?.('webgl-restored');
    this.resume();
  }

  visibilityChanged(): void { this.displayBudget.visibility(!this.canvas.ownerDocument.hidden); }

  private readonly canvasLost = () => {
    if (this.displayLost || this.disposed) return;
    this.displayLost = this.recoveryPending = true;
    this.fullCopy = false;
    this.painted = undefined;
    // Unlike WebGL, cancelling the Canvas2D event prevents its restoration.
    this.displayBudget.begin(!this.canvas.ownerDocument.hidden);
    this.onOutput?.('canvas-lost');
  };

  private readonly canvasRestored = () => {
    if (!this.displayLost || this.disposed) return;
    this.displayLost = false;
    this.onOutput?.('canvas-restored');
    this.resume();
  };

  present(frame: Plan3dFrame, immediate = false): void {
    if (this.disposed || this.frame === frame) return;
    this.frame = frame;
    if (immediate) this.output.paintNow(this);
    else this.output.queue(this);
  }

  resume(): void {
    if (this.disposed) return;
    this.onResume?.();
    this.output.queue(this);
  }

  pixelSize(motionScale = 1): Size {
    const width = this.cssSize.width || this.canvas.clientWidth;
    const height = this.cssSize.height || this.canvas.clientHeight;
    const dpr = this.canvas.ownerDocument.defaultView?.devicePixelRatio || 1;
    const density = motionScale * Math.min(dpr, 2, Math.sqrt(PIXEL_LIMIT / width / height));
    return { width: Math.max(1, Math.floor(width * density)), height: Math.max(1, Math.floor(height * density)) };
  }

  paint(): void {
    const frame = this.frame;
    const { width, height } = this.cssSize;
    if (!frame || frame === this.painted || !this.visible || width <= 0 || height <= 0 || this.disposed) return;
    if (this.context.isContextLost?.()) this.canvasLost();
    if (this.blocked || this.recoveryPending && frame.complete === false) return;
    const window = this.canvas.ownerDocument.defaultView;
    // Copying the shared WebGL backing store is synchronous. On a slow
    // device reduce only raster resolution during motion, never the camera.
    // Latch until the exact frame so adjacent samples don't resize the GPU
    // surface back and forth. A fast view keeps the ordinary raster.
    if (!frame.motion) this.motionScale = 1;
    else if (this.drawMs > 36) this.motionScale = .5;
    try {
      const start = window?.performance.now() ?? 0;
      if (!this.output.draw(frame, this.context, this.pixelSize(this.motionScale))) {
        if (this.context.isContextLost?.()) this.canvasLost();
        return;
      }
      this.drawMs = (window?.performance.now() ?? 0) - start;
      this.painted = frame;
      this.fullCopy = frame.complete !== false;
      if (this.fullCopy) {
        this.recoveryPending = false;
        this.output.completePaint();
        this.displayBudget.finish();
      }
      this.onPaint(frame);
    } catch {
      this.fail();
    }
  }

  /** Coordinates are fractions of the visible canvas, from its top left. */
  pick(x: number, y: number): string | undefined {
    if (this.disposed || !this.visible || !this.painted || this.recoveryPending || this.blocked || this.canvas.ownerDocument.hidden
      || !(x >= 0 && x < 1 && y >= 0 && y < 1)) return undefined;
    try {
      return this.output.pick(this.painted, x, y, this.canvas);
    } catch {
      this.fail();
      return undefined;
    }
  }

  snapshot(frame: Plan3dFrame, size: Size): Promise<Blob | null> {
    if (this.disposed || this.blocked || this.recoveryPending) return Promise.resolve(null);
    const canvas = this.canvas.ownerDocument.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return Promise.resolve(null);
    const scale = Math.min(1, Math.sqrt(2_000_000 / size.width / size.height));
    if (!this.output.draw(frame, context, { width: Math.max(1, Math.floor(size.width * scale)),
      height: Math.max(1, Math.floor(size.height * scale)) })) return Promise.resolve(null);
    return new Promise<Blob | null>(resolve => canvas.toBlob(blob => {
      canvas.width = canvas.height = 0;
      resolve(blob);
    }, 'image/webp', .85)).then(startupWebpFromCanvas);
  }

  fail(): void {
    if (this.disposed) return;
    this.dispose();
    this.failure();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.displayBudget.finish();
    this.canvas.removeEventListener('contextlost', this.canvasLost);
    this.canvas.removeEventListener('contextrestored', this.canvasRestored);
    this.resize.disconnect();
    this.intersection?.disconnect();
    this.frame = undefined;
    this.painted = undefined;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.output.detach(this);
  }
}
