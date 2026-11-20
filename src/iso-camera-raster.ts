import type { LiveViewBox } from './live-viewport';
import { forecastExposure, viewportExposure, viewportNeedsAnchor, type ViewportExposureLimits } from './viewport-exposure';

export interface RasterViewport extends ViewportExposureLimits {
  stageSize: readonly [width: number, height: number];
  dpr: number;
}

export type RasterStyle = readonly (readonly [string, string])[];

const enoughPixels = 1_200_000;
const imageWidth = 'hp-raster-width';
const imageHeight = 'hp-raster-height';
const imageViewBox = 'hp-raster-view-box';
const namespace = 'http://www.w3.org/2000/svg';
const intersects = (a: LiveViewBox, b: LiveViewBox) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function rasterCovers(bounds: LiveViewBox, view: LiveViewBox, content = view): boolean {
  const epsilon = 1e-6;
  return !intersects(view, content) || (
    bounds.x <= Math.max(view.x, content.x) + epsilon && bounds.y <= Math.max(view.y, content.y) + epsilon
    && bounds.x + bounds.w + epsilon >= Math.min(view.x + view.w, content.x + content.w)
    && bounds.y + bounds.h + epsilon >= Math.min(view.y + view.h, content.y + content.h)
  );
}

export function rasterSize({ stageSize: [w, h], dpr }: RasterViewport): readonly [number, number] {
  // Two 1.2-Mpixel RGBA images use at most 9.6 MB before browser overhead. The
  // live SVG and markers still have their own separate compositor budget.
  const scale = Math.min(dpr, Math.sqrt(enoughPixels / (w * h)));
  return [Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale))];
}

function rasterSource(scene: SVGSVGElement, stage: Element, inherited: RasterStyle): string | undefined {
  // SVG image documents can't load external resources. If the live scene
  // depends on them, leave it on the vector path for the entire gesture.
  const resources = [...scene.querySelectorAll('image, feImage, use')];
  if (scene.querySelector('foreignObject') || resources.some(item => {
    const href = item.getAttribute('href') || item.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    return href && !href.startsWith('data:image/') && !(href.startsWith('#') &&
      scene.querySelector(`[id="${CSS.escape(href.slice(1))}"]`));
  })) return undefined;
  const root = scene.getRootNode();
  if (!(root instanceof ShadowRoot)) return undefined;
  const doc = scene.ownerDocument;
  const outer = doc.createElementNS(namespace, 'svg');
  outer.setAttribute('width', imageWidth);
  outer.setAttribute('height', imageHeight);
  const context = doc.createElementNS(namespace, 'g');
  context.setAttribute('class', stage.className);
  if (stage.hasAttribute('data-hp-iso-floor-markers')) context.setAttribute('data-hp-iso-floor-markers', 'true');
  for (const [property, value] of inherited) context.style.setProperty(property, value);
  const css = doc.createElementNS(namespace, 'style');
  css.textContent = [...root.styleSheets, ...root.adoptedStyleSheets]
    .flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n')
    + '\ng.stage, g.zoomwrap { opacity:1; transform:none; filter:none; clip-path:none; }';
  const wrap = doc.createElementNS(namespace, 'g');
  wrap.setAttribute('class', 'zoomwrap');
  const clone = scene.cloneNode(true) as SVGSVGElement;
  clone.style.removeProperty('opacity');
  clone.setAttribute('viewBox', imageViewBox);
  clone.setAttribute('preserveAspectRatio', 'none');
  wrap.append(clone);
  context.append(wrap);
  outer.append(css, context);
  return new XMLSerializer().serializeToString(outer);
}

interface RasterSession {
  scene: SVGSVGElement;
  surface: HTMLElement;
  stage: Element;
  canvas: HTMLCanvasElement;
  renderer: ImageBitmapRenderingContext;
  limits: RasterViewport;
  inherited: RasterStyle;
  observer: MutationObserver;
  view: LiveViewBox;
  target: LiveViewBox;
  active?: { anchor: LiveViewBox; bounds: LiveViewBox };
  source?: string;
  failed?: boolean;
}

/** Passive SVG paint only. The one camera continues to publish every input
 * frame, and the original SVG and marker DOM retain their hit targets. */
export class IsoCameraRaster {
  private session?: RasterSession;
  private unsupportedScene?: SVGSVGElement;
  private preparing?: HTMLImageElement;
  private timer?: number;

  public paint(scene: SVGSVGElement, view: LiveViewBox, target: LiveViewBox, limits: RasterViewport,
    inherited: RasterStyle): void {
    const current = this.session;
    if (current && (current.scene !== scene || current.limits.stageSize[0] !== limits.stageSize[0] ||
        current.limits.stageSize[1] !== limits.stageSize[1] || current.limits.dpr !== limits.dpr ||
        current.inherited !== inherited)) this.clear();
    const session = this.session ?? this.open(scene, view, target, limits, inherited);
    if (!session) return;
    session.view = view;
    session.target = target;
    this.display(session);
    if (session.failed || this.preparing || this.timer !== undefined) return;
    const active = session.active;
    if (active && active.anchor.w < target.w * 1.85 &&
        !viewportNeedsAnchor(active.anchor, active.bounds, view, limits, forecastExposure(view, target))) return;
    const win = scene.ownerDocument.defaultView!;
    // Preparation runs after camera publication. Input always has a vector or
    // a fully available bitmap, even when decoding misses its prediction.
    this.timer = win.setTimeout(() => {
      this.timer = undefined;
      void this.prepare(session);
    }, 0);
  }

  private open(scene: SVGSVGElement, view: LiveViewBox, target: LiveViewBox,
    limits: RasterViewport, inherited: RasterStyle): RasterSession | undefined {
    if (this.unsupportedScene === scene || typeof createImageBitmap !== 'function') return;
    const surface = scene.parentElement;
    const stage = surface?.closest('.stage');
    if (!surface || !stage || surface.hasAttribute('data-hp-light-mixing')) return;
    const canvas = scene.ownerDocument.createElement('canvas');
    const renderer = canvas.getContext('bitmaprenderer');
    if (!renderer) { this.unsupportedScene = scene; return; }
    canvas.className = 'hp-iso-raster';
    canvas.inert = true;
    canvas.setAttribute('aria-hidden', 'true');
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target !== scene || record.attributeName !== 'viewBox')) this.clear();
    });
    observer.observe(scene, { attributes: true, childList: true, subtree: true, characterData: true });
    observer.observe(surface, { attributes: true, attributeFilter: ['data-hp-light-mixing'], childList: true });
    observer.observe(stage, { attributes: true, attributeFilter: ['class', 'style'] });
    return this.session = { scene, surface, stage, canvas, renderer, view, target, limits, inherited, observer };
  }

  private async prepare(session: RasterSession): Promise<void> {
    const { scene, stage, canvas, limits, view, target } = session;
    // Aim ahead at a wider pose during zoom out. The reserve then stretches
    // farther towards incoming content while the old bitmap is still valid.
    const anchor = forecastExposure(view, target);
    if (this.session !== session || !scene.isConnected || this.preparing ||
        (limits.content && !intersects(anchor, limits.content))) return;
    const bounds = viewportExposure(anchor, limits);
    // The bounds of the plan already include its paint overflow. Use the
    // pixel budget for that content and the reserve that can reveal it.
    const content = limits.content;
    if (content) {
      const x = Math.max(bounds.x, content.x), y = Math.max(bounds.y, content.y);
      bounds.w = Math.min(bounds.x + bounds.w, content.x + content.w) - x;
      bounds.h = Math.min(bounds.y + bounds.h, content.y + content.h) - y;
      bounds.x = x;
      bounds.y = y;
    }
    const [width, height] = rasterSize({
      stageSize: [limits.stageSize[0] * bounds.w / anchor.w, limits.stageSize[1] * bounds.h / anchor.h],
      dpr: limits.dpr,
    });
    let url: string | undefined;
    let frame: ImageBitmap | undefined;
    try {
      session.source ??= rasterSource(scene, stage, session.inherited);
      if (!session.source) { session.failed = true; return; }
      const { x, y, w, h } = bounds;
      const xml = session.source.replace(imageWidth, String(width)).replace(imageHeight, String(height))
        .replace(`viewBox="${imageViewBox}"`, `viewBox="${x} ${y} ${w} ${h}"`);
      url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const image = this.preparing = new Image();
      image.src = url;
      performance.mark('houseplan.iso.raster.prepare', { detail: { bounds, pixels: width * height } });
      await image.decode();
      if (this.session !== session) return;
      frame = await createImageBitmap(image);
      if (this.session !== session || !rasterCovers(bounds, session.view, limits.content)) return;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      session.renderer.transferFromImageBitmap(frame);
      frame = undefined;
      const previous = session.active;
      session.active = { anchor, bounds };
      if (!canvas.isConnected) session.surface.after(canvas);
      this.display(session);
      performance.mark(previous ? 'houseplan.iso.raster.swap' : 'houseplan.iso.raster.show', { detail: { bounds, view: session.view } });
    } catch {
      session.failed = true;
    } finally {
      frame?.close();
      if (url) URL.revokeObjectURL(url);
      this.preparing = undefined;
    }
  }

  private display(session: RasterSession): void {
    const { active, canvas, surface, view, limits } = session;
    if (!active) return;
    const bounds = active.bounds;
    const mode = rasterCovers(bounds, view, limits.content) ? 'active' : 'waiting';
    if (canvas.dataset.hpIsoRaster !== mode) {
      surface.toggleAttribute('data-hp-raster-display', mode === 'active');
      canvas.dataset.hpIsoRaster = mode;
    }
    if (mode !== 'active') return;
    const [w, h] = limits.stageSize;
    const x = (bounds.x - view.x) / view.w * w, y = (bounds.y - view.y) / view.h * h;
    const sx = bounds.w / view.w * w / canvas.width, sy = bounds.h / view.h * h / canvas.height;
    const pose = `translate(${x}px,${y}px) scale(${sx},${sy})`;
    if (canvas.style.transform !== pose) canvas.style.transform = pose;
  }

  public clear(): void {
    const session = this.session;
    if (!session) return;
    this.session = undefined;
    if (this.timer !== undefined) session.scene.ownerDocument.defaultView?.clearTimeout(this.timer);
    this.timer = undefined;
    session.observer.disconnect();
    if (this.preparing) this.preparing.removeAttribute('src');
    session.surface.removeAttribute('data-hp-raster-display');
    session.canvas.remove();
    if (session.active) {
      session.renderer.transferFromImageBitmap(null);
      performance.mark('houseplan.iso.raster.release');
    }
  }
}
