import type { LiveViewBox } from './live-viewport';
import { captureIsoRasterSource, decodeIsoRaster, isoRasterHoverSelector } from './iso-raster-source';
import { planIsoRaster, planIsoUnderlay, rasterCovers, rasterDensity, rasterImproves, rasterSmoothing, rasterUnderlayClip,
  type IsoRasterFrame, type RasterViewport } from './iso-raster-geometry';
import { forecastExposure } from './viewport-exposure';

export type IsoRasterInput = 'wheel' | 'pan' | 'pinch';

interface Surface {
  canvas: HTMLCanvasElement;
  context: ImageBitmapRenderingContext;
  frame?: IsoRasterFrame;
  revision?: number;
}

interface RasterSession {
  scene: SVGSVGElement;
  surface: HTMLElement;
  stage: HTMLElement;
  win: Window;
  limits: RasterViewport;
  authority: string;
  styleKey: string;
  observer: MutationObserver;
  sceneImage: Surface;
  underlay: Surface;
  view: LiveViewBox;
  vector: IsoRasterFrame;
  active: boolean;
  failed: boolean;
  revision: number;
  source?: string;
  job?: AbortController;
  timer?: number;
  prepareMs: number;
  forecast?: LiveViewBox;
  requested?: IsoRasterFrame;
  newestTarget?: { view: LiveViewBox; at: number };
  prepared?: { frame: IsoRasterFrame; bitmap: ImageBitmap; revision: number };
}

const samePose = (a: LiveViewBox, b: LiveViewBox) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function makeSurface(doc: Document, type: string): Surface | undefined {
  const canvas = doc.createElement('canvas');
  const context = canvas.getContext('bitmaprenderer');
  if (!context) return;
  canvas.className = 'hp-iso-raster ' + type;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.inert = true;
  return { canvas, context };
}

function clearSurface(surface: Surface): void {
  surface.canvas.remove();
  surface.context.transferFromImageBitmap(null);
  surface.frame = undefined;
  surface.revision = undefined;
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

function vectorFrame(view: LiveViewBox, coverage: LiveViewBox, limits: RasterViewport): IsoRasterFrame {
  const [w, h] = limits.stageSize;
  return { bounds: coverage, width: w * limits.dpr * coverage.w / view.w, height: h * limits.dpr * coverage.h / view.h };
}

function place(surface: Surface, view: LiveViewBox, limits: RasterViewport, overview = false): void {
  const { bounds, width, height } = surface.frame!;
  const [w, h] = limits.stageSize;
  const x = (bounds.x - view.x) / view.w * w, y = (bounds.y - view.y) / view.h * h;
  const pose = 'translate(' + x + 'px,' + y + 'px) scale(' + [bounds.w / view.w * w / width, bounds.h / view.h * h / height].join(',') + ')';
  if (surface.canvas.style.transform !== pose) surface.canvas.style.transform = pose;
  const density = rasterDensity(surface.frame!, view, limits);
  const blur = overview && density < 1.5 ? 0 : rasterSmoothing(density);
  const filter = blur ? 'blur(' + blur.toFixed(2) + 'px)' : '';
  if (surface.canvas.style.filter !== filter) surface.canvas.style.filter = filter;
}

function projectTarget(view: LiveViewBox, target: LiveViewBox, input: IsoRasterInput,
  earlier: RasterSession['newestTarget'], at: number, prepareMs: number): LiveViewBox {
  const prior = earlier?.view ?? view;
  const oldW = prior.w, nextW = target.w;
  const interval = Math.max(60, Math.min(320, earlier ? at - earlier.at : 140));
  const steps = Math.max(1, Math.min(6, prepareMs / interval + (input === 'wheel' ? 1 : 0)));
  if (Math.abs(nextW / oldW - 1) < 1e-6) {
    return { ...target, x: target.x + (target.x - prior.x) * Math.min(steps, 2),
      y: target.y + (target.y - prior.y) * Math.min(steps, 2) };
  }
  const ratio = Math.max(.49, Math.min(2.04, (nextW / oldW) ** steps));
  const amount = (ratio - 1) / (1 - oldW / nextW);
  const forecast = {
    x: target.x + (target.x - prior.x) * amount, y: target.y + (target.y - prior.y) * amount,
    w: nextW * ratio, h: target.h * ratio,
  };
  return nextW > view.w && ratio < 1.15 ? forecastExposure(view, target) : forecast;
}

/** Passive paint. Camera state and hit testing continue to belong to the live viewport. */
export class IsoCameraRaster {
  private session?: RasterSession;
  private unsupported?: Document;
  private busy = false;

  public configure(scene: SVGSVGElement, view: LiveViewBox, coverage: LiveViewBox, limits: RasterViewport,
    styleKey: string, authority: string): void {
    const current = this.session;
    if (current && (current.scene !== scene || current.authority !== authority || current.limits.dpr !== limits.dpr ||
      current.limits.stageSize[0] !== limits.stageSize[0] || current.limits.stageSize[1] !== limits.stageSize[1])) this.clear();
    if (this.session) {
      this.session.limits = limits;
      if (this.session.styleKey !== styleKey) {
        this.session.styleKey = styleKey;
        this.invalidate(this.session);
      }
      return;
    }
    const doc = scene.ownerDocument, surface = scene.parentElement, stage = surface?.closest<HTMLElement>('.stage');
    const win = doc.defaultView;
    if (this.unsupported === doc || !win || !surface || !stage || typeof createImageBitmap !== 'function') return;
    const sceneImage = makeSurface(doc, 'hp-iso-gesture-image');
    const underlay = makeSurface(doc, 'hp-iso-gesture-underlay');
    if (!sceneImage || !underlay) { this.unsupported = doc; return; }
    const observer = new MutationObserver(records => {
      if (records.some(({ target, attributeName }) =>
        (target !== scene || attributeName !== 'viewBox') &&
        !(target instanceof Element && target.matches(isoRasterHoverSelector)))) this.invalidate(session);
    });
    const session: RasterSession = {
      scene, surface, stage, win, limits, authority, styleKey, observer, sceneImage, underlay,
      view, vector: vectorFrame(view, coverage, limits), active: false, failed: false, revision: 0, prepareMs: 280,
    };
    this.session = session;
    observer.observe(scene, { attributes: true, childList: true, subtree: true, characterData: true });
    this.queue(session);
  }

  public settle(view: LiveViewBox, coverage: LiveViewBox): void {
    const session = this.session;
    if (!session) return;
    if (!session.active && samePose(view, session.view) && samePose(coverage, session.vector.bounds)) return;
    session.view = view;
    session.vector = vectorFrame(view, coverage, session.limits);
    session.requested = session.forecast = session.newestTarget = undefined;
    session.job?.abort();
    this.pause();
    this.queue(session);
  }

  public supports(scene: SVGSVGElement): boolean {
    return !!this.session && this.session.scene === scene && !this.session.failed;
  }

  public paint(view: LiveViewBox, target: LiveViewBox, input: IsoRasterInput, anchor: LiveViewBox,
    coverage: LiveViewBox): void {
    const session = this.session;
    if (!session || session.failed) return;
    session.view = view;
    const initial = !session.active;
    session.active = true;
    if (initial) session.vector = vectorFrame(anchor, coverage, session.limits);
    const accepted = !session.newestTarget || !samePose(session.newestTarget.view, target);
    if (accepted) {
      const at = performance.now();
      session.forecast = projectTarget(view, target, input, session.newestTarget, at, session.prepareMs);
      session.newestTarget = { view: target, at };
    }
    this.presentPrepared(session);
    this.display(session);
    if (accepted && !session.prepared) this.queue(session);
  }

  private queue(session: RasterSession): void {
    if (this.session !== session || session.failed || session.timer !== undefined ||
        session.surface.hasAttribute('data-hp-light-mixing')) return;
    session.timer = session.win.setTimeout(() => {
      session.timer = undefined;
      if (this.busy) {
        this.queue(session);
        return;
      }
      void this.prepare(session);
    }, this.busy ? 24 : 0);
  }

  private nextFrame(session: RasterSession): IsoRasterFrame | undefined {
    const { view, limits, sceneImage, underlay } = session;
    const current = sceneImage.frame ?? session.vector;
    const forecast = session.forecast ?? view;
    const density = rasterDensity(current, forecast, limits);
    if (!session.active) {
      if (sceneImage.revision === session.revision && rasterCovers(current.bounds, view, limits.content)
        && rasterDensity(current, view, limits) >= .99) return;
      return planIsoRaster(view, limits, undefined, false, 0);
    }
    if (sceneImage.revision === session.revision && density > 1 / 1.5 && density < 1.5 &&
      rasterCovers(current.bounds, forecast, limits.content)) return;
    const margin = forecast.w > view.w ? .06 : 0;
    return planIsoRaster(forecast, limits, undefined, !!underlay.frame, margin) ?? planIsoRaster(view, limits);
  }

  private async prepare(session: RasterSession): Promise<void> {
    if (this.session !== session || !session.scene.isConnected || session.failed) return;
    const job = session.job = new AbortController();
    const revision = session.revision;
    const stillRelevant = () => this.session === session && !job.signal.aborted && revision === session.revision;
    this.busy = true;
    try {
      session.source ??= await captureIsoRasterSource(session.scene, session.stage, job.signal);
      if (!stillRelevant()) { session.source = undefined; return; }
      const needUnderlay = session.underlay.revision !== revision;
      if (needUnderlay) {
        const underlay = planIsoUnderlay(session.view, session.limits);
        const bitmap = await decodeIsoRaster(session.source, underlay, job.signal, Math.min(1, session.limits.dpr), true);
        if (!stillRelevant()) { bitmap.close(); return; }
        this.upload(session.underlay, underlay, bitmap, revision);
        performance.mark('houseplan.iso.raster.underlay', { detail: { bounds: underlay.bounds } });
        this.display(session);
      }
      const frame = this.nextFrame(session);
      const previous = session.requested;
      if (!frame || previous && samePose(frame.bounds, previous.bounds) &&
          frame.width === previous.width && frame.height === previous.height) return;
      session.requested = frame;
      const start = performance.now();
      performance.mark('houseplan.iso.raster.prepare', { detail: { bounds: frame.bounds, pixels: frame.width * frame.height } });
      const bitmap = await decodeIsoRaster(session.source, frame, job.signal, session.limits.dpr);
      if (!stillRelevant()) { bitmap.close(); return; }
      session.prepareMs = session.prepareMs * .4 + (performance.now() - start) * .6;
      if (session.active) {
        session.prepared?.bitmap.close();
        session.prepared = { frame, bitmap, revision };
        this.presentPrepared(session);
        this.display(session);
      } else {
        this.upload(session.sceneImage, frame, bitmap, revision);
        performance.mark('houseplan.iso.raster.ready', { detail: { bounds: frame.bounds, view: session.view } });
      }
    } catch {
      if (stillRelevant()) {
        session.failed = true;
        this.pause();
        clearSurface(session.sceneImage);
        clearSurface(session.underlay);
        performance.mark('houseplan.iso.raster.fallback');
      }
    } finally {
      this.busy = false;
      if (session.job === job) session.job = undefined;
    }
  }

  private upload(surface: Surface, frame: IsoRasterFrame, bitmap: ImageBitmap, revision: number): void {
    if (surface.canvas.width !== frame.width) surface.canvas.width = frame.width;
    if (surface.canvas.height !== frame.height) surface.canvas.height = frame.height;
    surface.context.transferFromImageBitmap(bitmap);
    surface.frame = frame;
    surface.revision = revision;
  }

  private presentPrepared(session: RasterSession): void {
    const candidate = session.prepared;
    if (!candidate) return;
    const { sceneImage, view, limits } = session;
    const covers = rasterCovers(candidate.frame.bounds, view, limits.content);
    if (candidate.revision !== session.revision || (!covers && !session.underlay.frame)) {
      candidate.bitmap.close();
      session.prepared = undefined;
      return;
    }
    if (sceneImage.frame && sceneImage.revision === candidate.revision
      && !rasterImproves(sceneImage.frame, candidate.frame, view, limits)) {
      // A forecast frame can be useful a few frames later, while the current
      // compression still makes it visibly softer. Keep preparing on new input.
      if (session.forecast && rasterImproves(sceneImage.frame, candidate.frame, session.forecast, limits)) return;
      candidate.bitmap.close();
      session.prepared = undefined;
      return;
    }
    const previous = sceneImage.canvas.isConnected;
    session.prepared = undefined;
    this.upload(sceneImage, candidate.frame, candidate.bitmap, candidate.revision);
    performance.mark(previous ? 'houseplan.iso.raster.swap' : 'houseplan.iso.raster.show', {
      detail: { bounds: candidate.frame.bounds, view, density: rasterDensity(candidate.frame, view, limits) },
    });
  }

  private display(session: RasterSession): void {
    if (!session.active || session.failed || session.surface.hasAttribute('data-hp-light-mixing')) return;
    const { surface, sceneImage, underlay, view, limits } = session;
    const frame = sceneImage.frame;
    const cover = frame && rasterCovers(frame.bounds, view, limits.content);
    const underlayReady = !!underlay.frame && rasterCovers(underlay.frame.bounds, view, limits.content);
    const showRaster = !!frame && (!!cover || underlayReady);
    if (surface.hasAttribute('data-hp-raster-display') !== showRaster)
      surface.toggleAttribute('data-hp-raster-display', showRaster);
    const vectorBlur = showRaster ? 0 : rasterSmoothing(rasterDensity(session.vector, view, limits)) / limits.dpr;
    const blurVariable = '--hp-iso-gesture-blur';
    if (vectorBlur) {
      const filter = 'blur(' + vectorBlur.toFixed(2) + 'px)';
      if (surface.style.getPropertyValue(blurVariable) !== filter) surface.style.setProperty(blurVariable, filter);
    } else if (surface.style.getPropertyValue(blurVariable)) {
      surface.style.removeProperty(blurVariable);
    }
    const coverage = showRaster ? frame!.bounds : session.vector.bounds;
    if (underlayReady && !rasterCovers(coverage, view, limits.content)) {
      place(underlay, view, limits, true);
      const clip = rasterUnderlayClip(underlay.frame!.bounds, coverage);
      if (underlay.canvas.style.clipPath !== clip) underlay.canvas.style.clipPath = clip;
      if (!underlay.canvas.isConnected) surface.before(underlay.canvas);
    } else underlay.canvas.remove();
    if (showRaster) {
      place(sceneImage, view, limits);
      if (!sceneImage.canvas.isConnected) {
        surface.after(sceneImage.canvas);
        sceneImage.canvas.dataset.hpIsoRaster = 'active';
      }
    } else sceneImage.canvas.remove();
  }

  private invalidate(session: RasterSession): void {
    if (this.session !== session) return;
    session.revision++;
    session.source = undefined;
    session.requested = undefined;
    session.failed = false;
    session.job?.abort();
    session.prepared?.bitmap.close();
    session.prepared = undefined;
    this.queue(session);
  }

  public pause(): void {
    const session = this.session;
    if (!session) return;
    session.active = false;
    session.prepared?.bitmap.close();
    session.prepared = undefined;
    if (session.surface.hasAttribute('data-hp-raster-display')) session.surface.removeAttribute('data-hp-raster-display');
    if (session.surface.style.getPropertyValue('--hp-iso-gesture-blur'))
      session.surface.style.removeProperty('--hp-iso-gesture-blur');
    if (session.sceneImage.canvas.isConnected) performance.mark('houseplan.iso.raster.release');
    session.sceneImage.canvas.remove();
    session.underlay.canvas.remove();
  }

  public clear(): void {
    const session = this.session;
    if (!session) return;
    this.pause();
    this.session = undefined;
    session.job?.abort();
    if (session.timer !== undefined) session.win.clearTimeout(session.timer);
    session.observer.disconnect();
    clearSurface(session.sceneImage);
    clearSurface(session.underlay);
  }
}
