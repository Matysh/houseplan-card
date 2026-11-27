import { ENTRY_BUILD_FINGERPRINT, EditorRuntimeLoader, safeRuntimeDiagnostic } from './editor-runtime-loader';
import type { IsoOverlayPlacement } from './iso-overlays';
import type { LiveRuntime } from './live-interaction-runtime';
import type { PlanHost } from './plan-host';
import type { Plan3dHost, Plan3dPresentation } from './plan-3d-host';
import type { Plan3dMarker } from './plan-3d-markers';
import { unprojectFloorPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import { markerHeightGeometry } from './marker-height';
import type { FrameRect } from './view-frame';
import { PAINT_BARRIER_MAX_MS, RECOVERY_OVERLAY_DELAY_MS } from './visual-continuity';
import type { Plan3dOutputEvent } from './plan-3d-viewport';

export type Plan3dRuntime = typeof import('./plan-3d-runtime');
const ISO_RETRY_ASSET = '__HOUSEPLAN_ISO_RETRY_ASSET__';
const vacuumSelector = '.vacpuck[data-hp-3d-vacuum]';
// Internal pick IDs must not resolve to the placed dock or any other device.
const vacuumPickId = (mid: string) => '\0vacuum:' + mid;

interface Plan3dVacuumFrame {
  camera: IsoCamera;
  view: FrameRect;
  diameter: number;
  cellCm: number;
}

interface CardPlan3dPort {
  root(): ParentNode;
  authority(): PlanHost['authorityKey'];
  pitch(): number;
  switchPhase(): 'leaving' | 'waiting' | 'entering' | undefined;
  floorKey(): string;
  structureScope(): string | undefined;
  frameScope(): string | undefined;
  continuityToken(): number;
  needsPaintProof(): boolean;
  recoverySceneReady(): boolean;
  recoveryAssetsReady(): boolean;
  protectScene(hold: boolean): void;
  report(event: string, generation: number): void;
  reducedMotion(): boolean;
  contacts(): LiveRuntime['contacts'] | undefined;
  view(): FrameRect;
  redraw(): void;
  connected(): boolean;
  space(): string;
  setRetryNonce(url: URL): void;
  loading(): void;
  install(installRuntime: () => void): void;
  failedLoad(): void;
  failedPaint(): void;
  retry(key: string): void;
  reload(): void;
}

type PreviewWorld = Pick<Plan3dPresentation['world'], 'floorInk' | 'rooms' | 'panels'>;
type PreviewSources = { [K in keyof PreviewWorld]-?: () => PreviewWorld[K] };
type Recovery = { retained?: string; showStatus: boolean; timer?: number; assetsTimer?: number; assetsTimedOut?: boolean };

/** Owns the optional renderer and its canvas. Imports of the renderer are
 * deferred until the card asks for an isometric View. */
export class CardPlan3d {
  runtime: Plan3dRuntime | null = null;
  host?: Plan3dHost;
  paintedFloor = '';
  presentation?: Plan3dPresentation;
  failure?: { key: string; space: string; load?: 'retry' | 'reload' };
  devices?: ReadonlyMap<string, IsoOverlayPlacement>;
  vacuumFrame?: Plan3dVacuumFrame;
  startupSource?: () => Plan3dPresentation;
  private authority?: PlanHost['authorityKey'];
  private submitted?: { stamp: string; scope: string; structure: string; floor: string };
  private lastScope?: string;
  private lastStructure?: string;
  private paintedStamp?: string;
  private generation = 0;
  private recovery?: Recovery;
  entering = false;

  constructor(private readonly port: CardPlan3dPort) {}

  get recovering(): boolean { return !!this.recovery; }
  get holding(): boolean {
    const owner = this.recovery?.retained;
    return !!owner && owner === this.port.frameScope() && this.authority === this.port.authority()
      && !!this.host?.keepsFullPixels;
  }
  get statusVisible(): boolean { return !!this.recovery?.showStatus && !this.holding; }

  hasCurrentPaint(): boolean {
    return !!this.paintedStamp && this.authority === this.port.authority()
      && !this.host?.outputBlocked && !!this.host?.keepsFullPixels && this.paintedStamp === this.stamp();
  }

  private stamp(scope = this.port.frameScope()): string | undefined {
    return scope === undefined ? undefined : JSON.stringify([scope, this.port.floorKey(), this.port.continuityToken(), this.generation]);
  }

  private startRecovery(event: string, retained?: string): void {
    this.entering = false;
    if (!this.recovery) {
      this.generation++;
      const recovery: Recovery = this.recovery = { retained, showStatus: false };
      recovery.timer = window.setTimeout(() => {
        if (this.recovery !== recovery) return;
        recovery.showStatus = true;
        if (!this.holding && this.port.connected()) this.port.redraw();
      }, RECOVERY_OVERLAY_DELAY_MS);
    } else if (!retained) this.recovery.retained = undefined;
    this.paintedStamp = undefined;
    this.port.report(event, this.generation);
    this.port.protectScene(this.holding);
    if (this.port.connected()) this.port.redraw();
  }

  startDiscard(): void {
    if (!this.recovery) this.startRecovery('3d-discard');
  }

  coverChangedCandidate(): void {
    const scope = this.port.structureScope();
    if (!this.recovery && this.lastStructure && scope && scope !== this.lastStructure)
      this.startRecovery('3d-structure-candidate');
  }

  invalidateHeldFrame(): void {
    if (!this.recovery) return;
    this.recovery.retained = undefined;
    this.paintedStamp = undefined;
    this.port.protectScene(false);
  }

  finishEntrance(): void { this.entering = false; }

  /** A settled flat/fallback scene must not wait for an impossible GPU copy. */
  abandonRecovery(): void {
    this.finishRecovery(false);
    this.finishEntrance();
  }

  private finishRecovery(reveal: boolean): void {
    const recovery = this.recovery;
    if (!recovery) return;
    this.entering = reveal && !this.holding && !this.port.reducedMotion();
    window.clearTimeout(recovery.timer);
    window.clearTimeout(recovery.assetsTimer);
    this.recovery = undefined;
  }

  private revealRecovery(): boolean {
    const recovery = this.recovery;
    if (!recovery || !this.hasCurrentPaint()) return false;
    if (!this.holding) {
      if (!this.port.recoverySceneReady()) return false;
      if (!this.port.recoveryAssetsReady()) {
        if (!recovery.assetsTimedOut) {
          // Only optional assets get a deadline, after the current geometry
          // has actually been copied. Never reveal an old or blocked canvas.
          recovery.assetsTimer ??= window.setTimeout(() => {
            if (this.recovery !== recovery) return;
            recovery.assetsTimedOut = true;
            if (this.port.connected() && this.revealRecovery()) this.port.redraw();
          }, PAINT_BARRIER_MAX_MS);
          return false;
        }
        this.port.report('3d-recovery-assets-timeout', this.generation);
      }
    }
    this.port.report('3d-recovery-complete', this.generation);
    this.finishRecovery(true);
    return true;
  }

  private prepareScope(): CardPlan3d['submitted'] {
    const structure = this.port.structureScope(), scope = this.port.frameScope(), stamp = this.stamp(scope);
    return structure !== undefined && scope !== undefined && stamp !== undefined
      ? { stamp, scope, structure, floor: this.port.floorKey() } : undefined;
  }

  private onOutput(event: Plan3dOutputEvent): void {
    if (event === 'display-geometry') {
      if (this.recovery && !this.holding) {
        this.invalidateHeldFrame();
        this.port.redraw();
      }
      return;
    }
    if (event === 'webgl-lost' || event === 'canvas-lost') {
      this.startRecovery(event, event === 'webgl-lost' && this.host?.keepsFullPixels ? this.lastScope : undefined);
      return;
    }
    this.port.report(event, this.generation);
    if (this.holding && this.host) {
      // The matching DOM has not been replaced. Wait for a real new copy
      // of that scene before allowing ordinary Lit/HA submissions again.
      this.submitted = this.prepareScope();
      if (this.submitted) this.host.retagRetained(this.submitted.stamp);
    } else if (this.port.connected()) this.port.redraw();
  }

  readonly loader = new EditorRuntimeLoader<Plan3dRuntime>({
    expectedFingerprint: ENTRY_BUILD_FINGERPRINT,
    load: async (attempt) => {
      const module = attempt === 0
        ? await import('./plan-3d-runtime')
        : await import(/* @vite-ignore */ (() => {
            const url = new URL(ISO_RETRY_ASSET, import.meta.url);
            this.port.setRetryNonce(url);
            return url.href;
          })()) as Plan3dRuntime;
      return { fingerprint: module.ISO_SCENE_RUNTIME_FINGERPRINT, create: () => module };
    },
    install: (runtime) => {
      this.port.install(() => {
        this.runtime = runtime;
        if (this.failure?.load) this.failure = undefined;
      });
      if (this.port.connected()) this.port.redraw();
    },
    failed: (_ignored, info) => {
      this.port.failedLoad();
      this.abandonRecovery();
      console.warn('[houseplan] hidden isometric runtime diagnostic',
        safeRuntimeDiagnostic('runtime-load', 'unverified', info.terminal));
      const space = this.port.space();
      if (space) this.failure = { key: 'load', space, load: info.terminal ? 'reload' : 'retry' };
      if (this.port.connected()) this.port.redraw();
    },
  });

  ensure(): Promise<boolean> {
    if (this.loader.state === 'idle') {
      this.port.loading();
      this.port.redraw();
    }
    return this.loader.ensure();
  }

  readonly retry = (): void => {
    const failed = this.failure;
    if (!failed || failed.space !== this.port.space()) return;
    if (failed.load === 'reload') { this.port.reload(); return; }
    this.failure = undefined;
    this.port.retry(failed.key);
    if (failed.load === 'retry') void this.ensure();
    this.port.redraw();
  };

  resetPresentation(): void {
    this.presentation = undefined;
    this.startupSource = undefined;
    this.devices = undefined;
    this.vacuumFrame = undefined;
  }

  prepareStartupPreview(sources: PreviewSources): void {
    const live = this.presentation;
    if (!live) return;
    this.startupSource = () => ({ ...live, world: {
      ...live.world, contrastColors: undefined, lights: [], ribbons: [], roomHover: undefined,
      floorInk: sources.floorInk(), rooms: sources.rooms(), panels: sources.panels(),
    } });
  }

  snapshot(source: () => Plan3dPresentation, view: FrameRect, size: readonly [number, number], signal: AbortSignal, portable: boolean) {
    return this.host?.snapshot(source(), view, size, signal, portable);
  }

  dispose(): void {
    this.abandonRecovery();
    this.disposeHost();
  }

  private disposeHost(): void {
    if (this.host) for (const marker of this.port.root().querySelectorAll('[data-hp-3d-native],[data-hp-3d-native-outline]')) {
      marker.removeAttribute('data-hp-3d-native');
      marker.removeAttribute('data-hp-3d-native-outline');
    }
    this.host?.canvas.removeAttribute('data-hp-plan-3d-ready');
    this.host?.dispose();
    this.host = undefined;
    this.authority = undefined;
    this.paintedFloor = '';
    this.submitted = undefined;
    this.lastScope = this.lastStructure = this.paintedStamp = undefined;
  }

  private vacuumCenter(puck: HTMLElement, frame: Plan3dVacuumFrame): PlanPoint | undefined {
    const layer = puck.offsetParent, win = puck.ownerDocument.defaultView;
    if (!(layer instanceof HTMLElement) || !win || !layer.clientWidth || !layer.clientHeight) return;
    const { left, top } = win.getComputedStyle(puck), x = parseFloat(left), y = parseFloat(top);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    // Read the existing CSS transition in its authored camera plane, not a
    // raised pixel or the temporary screen transform of a pan/zoom gesture.
    const { view, camera } = frame;
    return unprojectFloorPoint([view.x + x / layer.clientWidth * view.w, view.y + y / layer.clientHeight * view.h], camera);
  }

  private vacuumMarkers(root: ParentNode, presentation: Plan3dPresentation): Plan3dMarker[] {
    const frame = this.vacuumFrame;
    if (!frame || !this.runtime) return [];
    const { diameter, cellCm } = frame;
    const height = markerHeightGeometry(0, cellCm, presentation.sectionHeight, diameter);
    return Array.from(root.querySelectorAll<HTMLElement>(vacuumSelector)).flatMap(puck => {
      const id = puck.dataset.mid, center = this.vacuumCenter(puck, frame);
      const face = this.runtime?.readPlan3dVacuumFace(puck, presentation.preset.rotDeg);
      return id && center && face ? [{ id: vacuumPickId(id), center, diameter, height: height.top,
        thickness: height.thickness, opacity: puck.classList.contains('stale') ? .45 : 1,
        contactShadow: false, faces: [face] }] : [];
    });
  }

  /** The old floor anchor still owns interpolation and the SVG trail tip. */
  followVacuumPucks(): boolean {
    const frame = this.vacuumFrame;
    if (!frame || !this.host || this.recovering || this.port.switchPhase() === 'leaving') return false;
    const centers = new Map<string, PlanPoint>();
    let transitioning = false;
    for (const puck of this.port.root().querySelectorAll<HTMLElement>(vacuumSelector)) {
      const mid = puck.dataset.mid;
      const center = mid && this.vacuumCenter(puck, frame);
      if (!mid || !center) continue;
      centers.set(vacuumPickId(mid), center);
      transitioning ||= puck.getAnimations().some(animation =>
        'transitionProperty' in animation && (animation.pending || animation.playState === 'running'));
    }
    this.host.moveVacuumPucks(centers);
    return transitioning;
  }

  vacuumAt(x: number, y: number): string | undefined {
    if (!this.vacuumFrame || !this.host || this.recovering) return;
    const entities = new Map<string, string>();
    for (const puck of this.port.root().querySelectorAll<HTMLElement>(vacuumSelector + '[data-hp-3d-native]')) {
      const { mid, entity } = puck.dataset;
      if (mid && entity) entities.set(vacuumPickId(mid), entity);
    }
    if (!entities.size) return;
    // Most presses are on the plan or other controls. Only a possible
    // puck hit needs the depth-tested GPU pick.
    const near = this.host.screenCoreSilhouettes(new Set(entities.keys())).some(hull => {
      const xs = hull.map(point => point[0]), ys = hull.map(point => point[1]);
      return x >= Math.min(...xs) && x <= Math.max(...xs)
        && y >= Math.min(...ys) && y <= Math.max(...ys);
    });
    return near ? entities.get(this.host.pick(x, y) ?? '') : undefined;
  }

  sync(): void {
    if (this.holding || this.port.switchPhase() === 'leaving') return;
    const { runtime, presentation } = this;
    const authority = this.port.authority();
    const root = this.port.root();
    const canvas = root.querySelector<HTMLCanvasElement>('canvas[data-hp-plan-3d]');
    const view = root.querySelector<SVGSVGElement>('svg[data-hp="stage"]');
    if (!presentation || !runtime || !canvas || !view) {
      if (this.port.frameScope() === undefined) this.dispose();
      else this.disposeHost();
      return;
    }
    const fail = () => {
      this.port.failedPaint();
      this.dispose();
      if (this.port.connected()) this.port.redraw();
    };
    try {
      if (this.host?.canvas !== canvas || this.host?.view !== view || this.authority !== authority) {
        this.disposeHost();
        this.authority = authority;
        let host: Plan3dHost | undefined;
        let openingEvent: Plan3dOutputEvent | undefined;
        let paintedMarkers: ReadonlySet<string> | undefined;
        host = new runtime.Plan3dHost(canvas, view, this.port.pitch() * .002, fail, (nativeMarkers, outlines, complete, stamp) => {
          if (this.host !== host || this.authority !== this.port.authority()) return;
          const submitted = this.submitted;
          if (complete && stamp && submitted?.stamp === stamp && stamp === this.stamp()) {
            const floorChanged = this.paintedFloor !== submitted.floor;
            const frameChanged = this.paintedStamp !== stamp;
            this.paintedFloor = submitted.floor;
            this.lastScope = submitted.scope;
            this.lastStructure = submitted.structure;
            this.paintedStamp = stamp;
            const reveal = this.revealRecovery();
            if (reveal || frameChanged && this.port.needsPaintProof()
                || floorChanged && this.port.switchPhase() === 'waiting') this.port.redraw();
          }
          if (paintedMarkers === nativeMarkers) return;
          paintedMarkers = nativeMarkers;
          for (const element of this.port.root().querySelectorAll<HTMLElement>('.dev[data-hp-3d-device]')) {
            const id = element.dataset.id ?? '';
            element.toggleAttribute('data-hp-3d-native', nativeMarkers.has(id));
            element.toggleAttribute('data-hp-3d-native-outline', outlines.has(id));
          }
          for (const puck of this.port.root().querySelectorAll<HTMLElement>(vacuumSelector))
            puck.toggleAttribute('data-hp-3d-native', !!puck.dataset.mid && nativeMarkers.has(vacuumPickId(puck.dataset.mid)));
          if (canvas.hasAttribute('data-hp-plan-3d-ready')) return;
          canvas.setAttribute('data-hp-plan-3d-ready', '');
          this.port.redraw();
        }, (event) => {
          if (!host) openingEvent = event;
          else if (this.host === host) this.onOutput(event);
        });
        this.host = host;
        if (openingEvent) this.onOutput(openingEvent);
      }
      const contacts = this.port.contacts();
      const markers = [...root.querySelectorAll<HTMLElement>('.dev[data-hp-3d-device]')].flatMap(element => {
        const id = element.dataset.id ?? '', placement = this.devices?.get(id);
        const geometry = contacts?.volumeFaces(id);
        const diameter = placement?.deviceSize;
        if (!placement || !diameter || !geometry) return [];
        const faces = runtime.readPlan3dMarkerFaces(element, geometry, presentation.preset.rotDeg);
        const opacity = element.matches('.unavail:not(.led-badge)')
          ? Number.parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element)
            .getPropertyValue('--hp-device-offline-opacity') ?? '') || 1 : 1;
        return faces?.length ? [{ id, center: placement.floorAnchor, diameter, height: placement.deviceHeight ?? presentation.sectionHeight, thickness: placement.deviceThickness,
          faces, opacity }] : [];
      });
      const opacityByMarker = new Map(markers.map(marker => [marker.id, marker.opacity]));
      const outlines = contacts?.volumeOutlines(new Set(opacityByMarker.keys()), new Map(markers.map(marker => [marker.id, this.devices?.get(marker.id)?.deviceHeightLevel ?? 'auto']))).map(group => ({
        ...group, height: this.devices?.get(group.members[0])?.deviceHeight,
        thickness: this.devices?.get(group.members[0])?.deviceHeightLevel === 'auto' ? undefined : this.devices?.get(group.members[0])?.deviceThickness,
        opacity: Math.max(...group.members.map(id => opacityByMarker.get(id) ?? 1)),
      }));
      this.submitted = this.prepareScope();
      this.host.present(presentation, this.port.view(), [...markers, ...this.vacuumMarkers(root, presentation)], outlines, this.submitted?.stamp);
    } catch {
      fail();
    }
  }

  paintCamera(view: FrameRect): void {
    if (this.presentation) this.host?.paintCamera(view);
  }
}
