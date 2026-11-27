import type { TemplateResult } from 'lit';
import { rawCardHeaderHeight } from './boot-soft-layout';
import type { DecorTool, WarmEntry } from './card-runtime';
import type { ConfigFingerprintPass } from './config-fingerprint-pass';
import { HeaderMotion, type HeaderPosition } from './header-motion';
import type { HouseplanEditorRuntime } from './houseplan-editor-runtime';
import type { LiveRuntime } from './live-interaction-runtime';
import { commitHouseplanViewport, liveLayerProjection, isIdentityLiveLayerProjection, paintedHouseplanViewBox, scheduleHouseplanViewport } from './live-viewport';
import type { SpaceDisplay } from './logic';
import { ModePresentation } from './mode-presentation';
import { modeStageHeight, modeRasterExposureClip, modeRasterOriginBias,
  type HouseplanMode, type ModeTransitionController, type ModeTransitionState, type ModeVisualState, type ModeViewBox,
} from './mode-transition';
import type { PanelHeaderMeasurement } from './panel-header-flow';
import { physicalViewCamera, type ProjectionViewFrame } from './projection-view-camera';
import type { LoadedSummaryPanelRuntime } from './summary-panel-runtime-loaded';
import type { SpaceModel } from './types';
import { controlMotion } from './ui-motion';
import type { PlanProjection, PlanRotation } from './view-frame';
import type { CameraState } from './viewport-transition';

interface ModeTransitionPresentationHost {
  readonly owner: object;
  readonly mode: HouseplanMode;
  readonly stageEl: HTMLElement | null;
  readonly containerOwnedHeight: boolean;
  readonly decorTool: DecorTool;
  hdrH: number;
  zoom: number;
  readonly cfgPass: ConfigFingerprintPass;
  readonly modeEditorInk: Pick<Map<string, TemplateResult>, 'clear'>;
  readonly modeTransition: ModeTransitionController;
  readonly modeTransitionBusy: boolean;
  modeTransitionVisual: ModeVisualState | null;
  readonly viewFrame: ProjectionViewFrame | null;
  modeTransitionPreparing: boolean;
  isoProjectionSnapshot: PlanProjection | null;
  lastValidStageSize: [number, number] | null;
  readonly liveRt: Pick<LiveRuntime, 'prepareContacts'> | null;
  modeProjectionCrossing: boolean;
  modeProjectionSource: PlanProjection | null;
  modeSceneFinishPending: boolean;
  readonly modeTransitionRequest: number;
  readonly summary: Pick<LoadedSummaryPanelRuntime, 'settleModeLayout'> | undefined;
  view: ModeViewBox | null;
  compactSpaces: boolean;
  readonly editorRuntime: Pick<HouseplanEditorRuntime, 'modeLayoutFor' | '_modeHeaderHeight' | 'properties'> | null;
  modeTransitionForceAtomic: boolean;
  modeTransitionTargetZoom: number;
  panelHeaderChoice: PanelHeaderMeasurement;
  readonly reducedMotion: boolean;
  readonly renderProjection: PlanProjection;
  readonly rotation: PlanRotation;
  readonly spaceSelectLoad: Promise<unknown> | null;
  readonly modeSceneRevision: number;
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly isConnected: boolean;
  readonly updateComplete: Promise<boolean>;
  baseVb(): number[];
  cameraView(base: number[]): ModeViewBox;
  physicalCamera(camera: ModeVisualState['viewport'], width: number, height: number): CameraState;
  projectionViewFrame(): ProjectionViewFrame;
  spaceModel(): SpaceModel | undefined;
  spaceDisplayForRender(): SpaceDisplay;
  stageBg(display: SpaceDisplay): string;
  cssColor(value: string, fallback: string): string;
  viewOr(base: number[]): ModeViewBox;
  requestModeSceneUpdate(): void;
  saveZoom(): void;
  warmPatch(patch: Partial<WarmEntry>): void;
  requestUpdate(): void;
  cancelModeTransition(commitTarget: boolean): void;
  settlePanelHeader(preparing: boolean): Promise<void>;
}

/** Owns measurement and DOM presentation for mode handoffs. The card retains
 * the shared navigation, projection and committed camera state. */
export class ModeTransitionPresentation {
  readonly styles = new ModePresentation();
  readonly headerMotion = new HeaderMotion();
  private origin: [number, number] | null = null;
  rasterSize: [number, number] | null = null;
  clip: string | null = null;
  projectionOpacity = 1;
  preparingStageClass: string | null = null;
  preparedStageClass = '';
  private headerPositions = new Map<string, HeaderPosition>();

  constructor(private readonly host: ModeTransitionPresentationHost) {}

  adoptRenderedStyles(): void {
    this.nodeCache.clear();
    this.styles.adoptRenderedStyles();
  }

  current(mode = this.host.mode): ModeVisualState | null {
    return this.host.cfgPass.run(() => { this.colors(); return this.readVisual(mode); });
  }
  private readVisual(mode: HouseplanMode): ModeVisualState | null {
    this.headerPositions = this.headerMotion.capture(this.host.renderRoot.querySelector('.head'));
    if (mode === 'view' && !this.host.modeTransitionBusy) this.host.modeEditorInk.clear();
    // During the one-frame target measurement the controller has not started
    // yet, but `_modeTransitionVisual` is already the exact painted endpoint.
    // A rapid second click must retarget from that frame instead of rebuilding
    // an approximation from the newly committed logical mode.
    const presented = this.host.modeTransition.presented || this.host.modeTransitionVisual;
    if (presented) return { ...presented, viewport: {
      ...presented.viewport, viewBox: this.host.physicalCamera(presented.viewport, presented.stageWidth, presented.stageHeight).viewBox,
    } };
    const stage = this.host.stageEl;
    if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) return null;
    const chrome = this.host.renderRoot.querySelector('.editorchrome') as HTMLElement | null;
    const view = this.host.cameraView(this.host.baseVb());
    const paper = this.host.renderRoot.querySelector('.hp-paper') as SVGElement | null;
    const backdrop = this.host.renderRoot.querySelector('.hp-backdrop') as SVGElement | null;
    const zoomwrap = this.host.renderRoot.querySelector('.zoomwrap') as HTMLElement | null;
    const filter = zoomwrap ? getComputedStyle(zoomwrap).filter : '';
    const brightness = Number(/brightness\(([^)]+)\)/.exec(filter)?.[1]);
    const headerHeight = this.host.renderRoot.querySelector('.hdr > .head')?.getBoundingClientRect().height || 0;
    const chromeHeight = mode === 'view' ? 0 : chrome?.getBoundingClientRect().height || 0;
    const rawBudget = rawCardHeaderHeight(this.host.renderRoot, stage, this.host.containerOwnedHeight) ?? this.host.hdrH;
    return {
      presentedMode: mode,
      headerHeight,
      headerBudget: this.host.hdrH,
      headerFixedBudget: rawBudget - headerHeight - chromeHeight,
      editorChromeHeight: chromeHeight,
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
      viewport: { ...physicalViewCamera(view, this.host.zoom,
        {...(this.host.viewFrame ?? this.host.projectionViewFrame()),
          size: [stage.clientWidth, stage.clientHeight]}), viewBox: {...view} },
      stageColor: getComputedStyle(stage).backgroundColor || 'rgb(255, 255, 255)',
      paperColor: paper ? getComputedStyle(paper).fill : 'rgb(255, 255, 255)',
      sceneBrightness: Number.isFinite(brightness) ? brightness : 1,
      architectureOpacity: mode === 'decor' ? 0.35 : 1,
      backdropOpacity: backdrop && (this.host.spaceModel()?.bg?.opacity ?? 1) > 0
        ? Number(getComputedStyle(backdrop).opacity) / (this.host.spaceModel()?.bg?.opacity ?? 1)
        : mode === 'decor' && this.host.decorTool !== 'backdrop' ? 0.5 : 1,
      viewWeight: mode === 'view' ? 1 : 0,
      glowWeight: mode === 'view' || mode === 'devices' ? 1 : 0,
      editorWeight: mode === 'view' ? 0 : 1,
      planWeight: mode === 'plan' ? 1 : 0,
      toolbarContentOpacity: mode === 'view' ? 0 : 1,
    };
  }

  private themeColors: { revision: number; stage: string; paper: string } | null = null;
  private colors(): { revision: number; stage: string; paper: string } {
    if (this.themeColors?.revision === this.host.modeSceneRevision) return this.themeColors;
    const paper = this.host.cssColor('var(--ha-card-background, var(--card-background-color, #111))', 'rgb(17, 17, 17)');
    return this.themeColors = { revision: this.host.modeSceneRevision,
      stage: this.host.cssColor(this.host.stageBg(this.host.spaceDisplayForRender()), paper), paper };
  }
  captureSource(): void { this.colors(); }
  private targetStageColor(mode: HouseplanMode): string {
    return mode === 'view' ? this.colors().stage : 'rgb(255, 255, 255)';
  }


  private readonly nodeCache = new Map<string, (HTMLElement | SVGElement)[]>();
  nodes(selector: string): (HTMLElement | SVGElement)[] {
    let nodes = this.nodeCache.get(selector);
    if (!nodes) {
      nodes = [...this.host.renderRoot.querySelectorAll<HTMLElement | SVGElement>(selector)];
      this.nodeCache.set(selector, nodes);
    }
    return nodes;
  }
  paint(visual: ModeVisualState): void {
    const root = this.host.renderRoot;
    const owner = this.styles;
    const planFade = this.host.mode === 'plan' || !!visual.planWeight || !!this.host.modeTransition.state?.from.planWeight;
    const devices = planFade ? this.nodes('.devlayer .dev') : [];
    const motion = this.host.modeTransition.state;
    const moving = motion?.phase === 'running';
    const varies = (weight: (value: ModeVisualState) => number): boolean => !!motion && weight(motion.from) !== weight(motion.to);
    const set = (selector: string, name: string, value: string, important = false, animate = moving): void => {
      for (const node of this.nodes(selector)) {
        if (name === 'opacity') owner.opacity(node, value, animate, important ? 'important' : '');
        else owner.set(node, name, value, important ? 'important' : '');
      }
    };
    set('.hdr > .head', 'height', visual.headerHeight + 'px');
    set('.editorchrome', 'height', visual.editorChromeHeight + 'px');
    set('.editorchrome', 'opacity', String(visual.editorWeight));
    set('.editorchrome-inner', 'opacity', String(visual.toolbarContentOpacity));
    const stage = this.host.stageEl;
    owner.set(stage, 'height', visual.stageHeight + 'px');
    owner.set(stage, 'width', visual.stageWidth + 'px');
    owner.set(stage, 'background', visual.stageColor);
    owner.setInert(stage, true);
    const plan = visual.planWeight ?? 0;
    const surfaces = root.querySelector('.hp-mode-scene-svg');
    if (surfaces) {
      const layer = (id: string, weight: (value: ModeVisualState) => number): void => {
        const animated = moving && varies(weight);
        set('[data-hp-mode-layer="' + id + '"]', 'opacity', String(weight(visual)), false, animated);
        if (animated) set('[data-hp-mode-layer="' + id + '"]', 'will-change', 'opacity');
      };
      // Opacity is on independent SVG surfaces, never on their internal ink.
      set('.hp-mode-scene-svg :is(.room,.hp-mode-room), .hp-mode-scene-svg :is(.room-outline,.hp-mode-room-outline), .hp-mode-scene-svg .wallbodies, .hp-mode-scene-svg .opening, .hp-mode-scene-svg .zero-walls, .hp-mode-scene-svg .hp-stairs-layer', 'opacity', '1', false, false);
      set('.hp-mode-scene-svg .hp-view-only-layer, .hp-mode-scene-svg .hp-editor-only-layer, .hp-mode-scene-svg .hp-plan-only-layer, .hp-mode-scene-svg .glow-pools-frame, .hp-mode-scene-svg .led-fields', 'opacity', '1', true, false);
      layer('rooms', v => v.architectureOpacity * (1 - (v.planWeight ?? 0)));
      layer('room-ink', v => v.architectureOpacity * (v.planWeight ?? 0));
      if (!this.host.spaceDisplayForRender().showBorders)
        set('[data-hp-mode-layer="rooms"] :is(.room,.hp-mode-room):not([data-area])', 'opacity', String(visual.viewWeight));
      for (const id of ['walls', 'openings', 'stairs', 'room-hover'])
        layer(id, v => v.architectureOpacity);
      layer('zero-view', v => v.architectureOpacity * v.viewWeight);
      layer('zero-editor', v => v.architectureOpacity * v.editorWeight);
      layer('editor-guides', v => v.editorWeight);
      layer('plan-base', v => v.planWeight ?? 0);
      layer('plan-ink', v => v.planWeight ?? 0);
      layer('glow', v => v.glowWeight ?? v.viewWeight);
      layer('led', () => 1);
      // Add premultiplied room endpoint coverage inside one temporary isolation.
      const roomCrossfade = varies(v => v.planWeight ?? 0);
      set('[data-hp-mode-pair="rooms"]', 'isolation', roomCrossfade ? 'isolate' : 'auto');
      set('[data-hp-mode-pair="rooms"] > svg', 'mix-blend-mode', roomCrossfade ? 'plus-lighter' : 'normal');
      const paperColor = this.targetPaperColor('view');
      const sharedPaper = paperColor === 'rgb(255, 255, 255)';
      // Identical opaque paper has one antialiased silhouette. Blending two
      // identical full-viewport rasters adds GPU work without changing ink.
      // Keep the paired path for genuinely different endpoint materials.
      set('[data-hp-mode-pair="paper"]', 'isolation', sharedPaper ? 'auto' : 'isolate');
      set('[data-hp-mode-pair="paper"] > svg', 'mix-blend-mode', sharedPaper ? 'normal' : 'plus-lighter');
      layer('paper', v => sharedPaper ? 1 : v.viewWeight);
      set('[data-hp-mode-layer="paper"] .hp-paper', 'fill', paperColor, true);
      set('[data-hp-mode-layer="paper-ink"] .hp-paper', 'fill', 'rgb(255, 255, 255)', true);
      layer('paper-ink', v => sharedPaper ? 0 : v.editorWeight);
      set('.hp-backdrop', 'opacity', '1', false, false);
      layer('backdrop', v => v.backdropOpacity);
    } else {
      // Projection crossing retains its existing one-scene fade/atomic path.
      set('.room, .opening, .room-outline, .wallbodies, .zero-walls, .hp-stairs-layer',
        'opacity', String(visual.architectureOpacity));
      set('.hp-view-only-layer, .glow-pools-frame, .led-fields', 'opacity', String(visual.viewWeight), true);
      set('.hp-plan-only-layer', 'opacity', String(plan), true);
      set('.hp-editor-only-layer', 'opacity', String(visual.editorWeight), true);
      set('.hp-paper', 'fill', visual.paperColor, true);
      set('.hp-backdrop', 'opacity', String((this.host.spaceModel()?.bg?.opacity ?? 1) * visual.backdropOpacity));
    }
    set('.devlayer', 'opacity', String(visual.architectureOpacity), false, moving && varies(v => v.architectureOpacity));
    set('.hp-day-cycle-env, .hp-moon-sky', 'opacity', String(visual.viewWeight), true);
    for (const device of devices)
      owner.filterOpacity(device, Math.max(0, 1 - .65 * plan / visual.architectureOpacity),
        moving || this.host.modeTransitionPreparing);
    const properties = root.querySelector<HTMLElement>('.hp-properties');
    owner.setInert(properties, true);
    owner.set(properties, 'transform', 'translateX(' + (1 - visual.editorWeight) * 100 + '%)');
    owner.opacity(properties, String(visual.editorWeight), moving);
    const terminal = this.host.modeTransition.state?.phase === 'settling';
    const raster = this.rasterSize;
    if (raster) {
      const scene = root.querySelector<HTMLElement>('.zoomwrap');
      owner.set(scene, 'translate', 'none');
      const dx = (visual.stageWidth - raster[0]) / 2, dy = (visual.stageHeight - raster[1]) / 2;
      const left = this.origin ? dx - this.origin[0] : Math.round(dx);
      const top = this.origin ? dy - this.origin[1] : Math.round(dy);
      // The target-snapped raster translates without changing its camera.
      // Both endpoint coordinates are integers on the ordinary to path.
      owner.set(scene, 'left', moving ? '0px' : Math.round(left) + 'px');
      owner.set(scene, 'top', moving ? '0px' : Math.round(top) + 'px');
      owner.set(scene, 'transform', moving ? `translate(${left}px,${top}px)` : 'none');
      owner.set(scene, 'will-change', moving ? 'transform' : 'auto');
    }
    if (terminal) {
      // Present the endpoint with the ordinary raster path, while the same
      // controller still owns inert until its next RAF.
      const from = paintedHouseplanViewBox(this.host.owner);
      const endpoint = this.host.viewOr(this.host.baseVb());
      commitHouseplanViewport(this.host.owner);
      // The plan and the HTML layers both use display coordinates. The mode
      // controller's canonical box is unrotated, including at settlement.
      this.rebaseHtml(from ?? endpoint, endpoint, raster);
      set('.hp-mode-scene-svg', 'clip-path', this.clip || 'inset(-25%)');
      set('.hp-mode-scene-svg', 'will-change', 'auto');
      set('.hp-mode-crossfade', 'isolation', 'auto');
      set('.hp-mode-crossfade > svg', 'mix-blend-mode', 'normal');
    } else scheduleHouseplanViewport(this.host.owner, true);
  }

  private rebaseHtml(from: ModeViewBox, current: ModeViewBox, raster: readonly [number, number] | null): void {
    const owner = this.styles, projection = liveLayerProjection(from, current);
    const reposition = !isIdentityLiveLayerProjection(projection);
    for (const layer of this.host.renderRoot.querySelectorAll<HTMLElement>('[data-hp-live-layer="camera"]')) {
      if (layer.style.transform && layer.style.transform !== 'none') owner.set(layer, 'transform', 'none');
      if (raster) { owner.set(layer, 'width', raster[0] + 'px'); owner.set(layer, 'height', raster[1] + 'px'); }
      if (reposition) for (const node of layer.querySelectorAll<HTMLElement>(
        ':scope > [style], :scope > .iso-room-label-plane > .roomlabel',
      )) {
        const left = node.style.left, top = node.style.top;
        if (!left?.endsWith('%') || !top?.endsWith('%')) continue;
        owner.set(node, 'left', (parseFloat(left) * projection.scaleX + projection.translateXPercent) + '%');
        owner.set(node, 'top', (parseFloat(top) * projection.scaleY + projection.translateYPercent) + '%');
      }
      const text = `${current.x} ${current.y} ${current.w} ${current.h}`;
      for (const svg of layer.querySelectorAll<SVGElement>('[data-hp-live-inherited-scene="camera"]')) {
        if (svg.getAttribute('viewBox') !== text) svg.setAttribute('viewBox', text);
      }
      owner.set(layer, 'left', '0px'); owner.set(layer, 'top', '0px');
    }
  }

  clear(): void {
    this.origin = null;
    this.preparingStageClass = null;
    this.nodeCache.clear();
    this.styles.clear();
    // Projection crossing and the raster camera use these outside paint().
    for (const [selector, names] of [
      ['.zoomwrap', ['width', 'height', 'opacity']],
      ['.stage', ['width']],
    ] as const) for (const element of this.host.renderRoot.querySelectorAll<HTMLElement>(selector)) {
      for (const name of names) element.style.removeProperty(name);
    }
  }

  private targetPaperColor(mode: HouseplanMode): string {
    if (mode !== 'view' || !this.host.spaceModel()?.bg) return 'rgb(255, 255, 255)';
    return this.colors().paper;
  }

  apply(state: ModeTransitionState): void {
    this.host.cfgPass.run(() => this.paintFrame(state));
  }
  private paintFrame(state: ModeTransitionState): void {
    if (state.targetMode !== this.host.mode) return;
    if (this.host.modeProjectionCrossing) {
      const progress = state.duration > 0 ? Math.min(1, Math.max(0, (performance.now() - state.startedAt) / state.duration)) : 1;
      if (progress >= .5 && this.host.modeProjectionSource) {
        // One projection commit while the real scene is transparent. No
        // overlaid scenes or copied DOM, and no per-frame scene construction.
        this.host.modeProjectionSource = null; this.host.isoProjectionSnapshot = null;
        this.host.requestUpdate();
      }
      this.projectionOpacity = Math.abs(progress * 2 - 1);
      const scene = this.host.renderRoot.querySelector<HTMLElement>('.zoomwrap');
      if (scene) scene.style.opacity = String(this.projectionOpacity);
    }
    const size = this.rasterSize ?? [state.presented.stageWidth, state.presented.stageHeight];
    const dx = (state.presented.stageWidth - size[0]) / 2;
    const dy = (state.presented.stageHeight - size[1]) / 2;
    const origin = this.origin ?? [dx - Math.round(dx), dy - Math.round(dy)];
    const viewport = { ...state.presented.viewport,
      centerX: state.presented.viewport.centerX - origin[0] / state.presented.viewport.pixelsPerUnit,
      centerY: state.presented.viewport.centerY - origin[1] / state.presented.viewport.pixelsPerUnit };
    const camera = this.host.physicalCamera(viewport, size[0], size[1]);
    state.presented.viewport.viewBox = { ...camera.viewBox };
    this.host.modeTransitionVisual = state.presented;
    this.host.view = { ...camera.viewBox };
    this.host.zoom = camera.zoom;
    this.paint(state.presented);
  }

  settle(state: ModeTransitionState): void {
    this.host.cfgPass.run(() => this.finish(state));
  }
  private finish(state: ModeTransitionState): void {
    if (state.targetMode !== this.host.mode) return;
    const settledRequest = this.host.modeTransitionRequest;
    this.host.modeSceneFinishPending = true;
    this.host.modeProjectionSource = null; this.host.modeProjectionCrossing = false; this.projectionOpacity = 1; this.host.isoProjectionSnapshot = null;
    // The controller has released busy, but the endpoint dimensions are still
    // presented. Store summary's final box before the one terminal Lit update.
    this.host.summary?.settleModeLayout();
    this.host.liveRt?.prepareContacts();
    this.clear();
    const targetCamera = this.host.physicalCamera(state.to.viewport, state.to.stageWidth, state.to.stageHeight);
    this.host.view = targetCamera.viewBox;
    this.host.zoom = targetCamera.zoom;
    this.rasterSize = null;
    this.clip = null;
    this.host.hdrH = Math.round(state.to.headerBudget);
    this.host.modeTransitionVisual = null;
    this.host.modeTransitionPreparing = false;
    this.host.lastValidStageSize = [state.to.stageWidth, state.to.stageHeight];
    if (this.host.mode === 'view') {
      this.host.saveZoom();
    }
    this.host.requestModeSceneUpdate();
    void this.host.updateComplete.then(() => {
      if (!this.host.isConnected || settledRequest !== this.host.modeTransitionRequest
          || this.host.modeTransitionBusy || state.targetMode !== this.host.mode) return;
      // Natural responsive layout remains the final authority. A breakpoint,
      // font load or outer resize may land while ResizeObserver is suppressed
      // by the transition; reconcile it before the next visible interaction.
      const stage = this.host.stageEl;
      if (stage && stage.clientWidth > 0 && stage.clientHeight > 0
          && (Math.abs(stage.clientWidth - state.to.stageWidth) > 0.5
            || Math.abs(stage.clientHeight - state.to.stageHeight) > 0.5)) {
        const camera = this.host.physicalCamera(state.to.viewport, stage.clientWidth, stage.clientHeight);
        this.host.lastValidStageSize = [stage.clientWidth, stage.clientHeight];
        this.host.view = camera.viewBox; this.host.zoom = camera.zoom;
        this.host.saveZoom();
        this.host.requestUpdate();
      }
      // ResizeObserver may have consumed the last size change while the
      // controller was holding to. Publish the accepted pair here as well.
      if (this.host.lastValidStageSize?.[0] === state.to.stageWidth
          && this.host.lastValidStageSize[1] === state.to.stageHeight)
        this.host.warmPatch({ hdrH: this.host.hdrH, stageH: state.to.stageHeight,
          ownHdrH: state.to.headerHeight + state.to.editorChromeHeight });
      const focused = (this.host.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
      const lostWithOutgoingUi = !focused || !focused.isConnected
        || !!focused.closest?.('.editorchrome, .stage');
      if (lostWithOutgoingUi) {
        (this.host.renderRoot.querySelector('.modetab.active') as HTMLElement | null)
          ?.focus?.({ preventScroll: true });
      }
    });
  }


  prepare(
    request: number,
    from: ModeVisualState,
    targetMode: HouseplanMode,
  ): void {
    const layout = this.host.editorRuntime?.modeLayoutFor(targetMode);
    if (layout) {
      this.host.panelHeaderChoice = layout.header;
      this.host.compactSpaces = layout.header.phase >= 3;
    }
    this.preparingStageClass = this.host.modeProjectionCrossing ? null : this.host.stageEl?.className.replace(/\s+mode-transition\b/g, '') ?? null;
    void this.host.updateComplete.then(async () => {
      if (!this.host.isConnected || request !== this.host.modeTransitionRequest || this.host.mode !== targetMode) {
        // Only clean the generation that still owns the preparing flag. A
        // stale callback must not cancel a newer transition, but a config or
        // recovery mode adoption in the measurement window must never strand
        // the scene in its inert/busy state.
        if (request === this.host.modeTransitionRequest) {
          this.host.cancelModeTransition(false);
          this.host.requestUpdate();
        }
        return;
      }
      // The prepared Lit frame already owns source dimensions. Measure target
      // chrome before presentation writes invalidate the scene layout.
      if (!layout) {
        const headerReady = this.host.settlePanelHeader(true);
        if (this.host.spaceSelectLoad && !customElements.get('hp-settings-select')) {
          if (this.host.stageEl) this.host.stageEl.inert = true;
          this.paint(from);
        }
        await headerReady;
      }
      if (!this.host.isConnected || request !== this.host.modeTransitionRequest || this.host.mode !== targetMode) {
        if (request === this.host.modeTransitionRequest) {
          this.host.cancelModeTransition(false); this.host.requestUpdate();
        }
        return;
      }
      this.host.cfgPass.run(() => {
        const inner = this.host.renderRoot.querySelector('.editorchrome-inner') as HTMLElement | null;
        const targetChromeHeight = targetMode === 'view' ? 0 : layout?.chromeHeight ?? inner?.scrollHeight ?? 0;
        const headerHeight = layout?.header.height ?? (this.host.panelHeaderChoice?.height > 0 ? this.host.panelHeaderChoice.height
          : this.host.editorRuntime?._modeHeaderHeight(targetMode) ?? from.headerHeight);
        // The hidden frame preserves source sizes; keep the header + stage + chrome budget
        // constant so every RAF moves both edges without a final layout jump.
        const targetStageHeight = modeStageHeight(from, headerHeight, targetChromeHeight);
        const card = this.host.renderRoot.querySelector<HTMLElement>('ha-card');
        const properties = this.host.renderRoot.querySelector<HTMLElement>('.hp-properties');
        const targetStageWidth = layout?.width ?? (card?.clientWidth
          ? card.clientWidth - (this.host.editorRuntime?.properties.wide ? properties?.offsetWidth || 0 : 0)
          : this.host.stageEl?.clientWidth || from.stageWidth);
        const targetCamera = this.host.physicalCamera(from.viewport, targetStageWidth, targetStageHeight);
        const targetView = targetCamera.viewBox;
        this.host.modeTransitionTargetZoom = targetCamera.zoom;
        const to: ModeVisualState = {
          presentedMode: targetMode,
          headerHeight,
          headerBudget: from.headerBudget + from.stageHeight - targetStageHeight,
          headerFixedBudget: from.headerFixedBudget,
          editorChromeHeight: targetChromeHeight,
          stageWidth: targetStageWidth,
          stageHeight: targetStageHeight,
          viewport: { ...from.viewport, viewBox: targetView },
          stageColor: this.targetStageColor(targetMode),
          paperColor: this.targetPaperColor(targetMode),
          sceneBrightness: 1,
          architectureOpacity: targetMode === 'decor' ? 0.35 : 1,
          backdropOpacity: targetMode === 'decor' && this.host.decorTool !== 'backdrop' ? 0.5 : 1,
          viewWeight: targetMode === 'view' ? 1 : 0,
          glowWeight: targetMode === 'view' || targetMode === 'devices' ? 1 : 0,
          editorWeight: targetMode === 'view' ? 0 : 1,
          planWeight: targetMode === 'plan' ? 1 : 0,
          toolbarContentOpacity: targetMode === 'view' ? 0 : 1,
        };
        this.host.modeTransitionPreparing = false;
        const forceAtomic = this.host.modeTransitionForceAtomic;
        this.host.modeTransitionForceAtomic = false;
        this.headerMotion.start(this.host.renderRoot.querySelector('.head'), this.headerPositions, this.host.reducedMotion || forceAtomic, layout?.header.positions);
        // Source dimensions are already accepted. Publishing this basis must
        // not query freshly invalidated scene client metrics.
        // Take the marker basis before the viewport adopts measured editor
        // chrome. The existing HTML percentages can still be in the View box.
        const htmlFrom = paintedHouseplanViewBox(this.host.owner);
        this.rasterSize = [from.stageWidth, from.stageHeight];
        if (!this.host.modeProjectionSource) commitHouseplanViewport(this.host.owner);
        // Publish the stage's phase-owned inert baseline after the read batch,
        // before any motion or rendering opportunity. Presentation retains it
        // until the final Lit commit, exactly like a prepared inert binding.
        if (this.host.stageEl) this.host.stageEl.inert = true;
        if (this.host.stageEl) this.host.stageEl.className = this.preparedStageClass + ' mode-transition';
        this.preparingStageClass = null;
        // Keep the already-rendered HTML and SVG raster coordinates fixed.
        // Enlarging only their parent here would stretch marker faces on Y.
        this.origin = !this.host.reducedMotion && !forceAtomic && !this.host.modeProjectionCrossing
          && this.host.renderProjection === 'flat' && this.host.rotation === 0 ? modeRasterOriginBias(from, to) : null;
        this.clip = modeRasterExposureClip(from, to);
        const scene = this.host.renderRoot.querySelector<HTMLElement>('.zoomwrap');
        if (scene) {
          scene.style.width = `${this.rasterSize[0]}px`; scene.style.height = `${this.rasterSize[1]}px`;
        }
        const origin = this.origin ?? [0, 0];
        const rasterCamera = this.host.physicalCamera({ ...from.viewport,
          centerX: from.viewport.centerX - origin[0] / from.viewport.pixelsPerUnit,
          centerY: from.viewport.centerY - origin[1] / from.viewport.pixelsPerUnit }, ...this.rasterSize);
        this.host.view = rasterCamera.viewBox; this.host.zoom = rasterCamera.zoom;
        if (this.origin && htmlFrom) {
          this.rebaseHtml(htmlFrom, this.host.viewOr(this.host.baseVb()), this.rasterSize);
          commitHouseplanViewport(this.host.owner, true);
        } else scheduleHouseplanViewport(this.host.owner, true, true);
        this.host.modeTransition.start(from, to, targetMode,
          this.host.reducedMotion || forceAtomic ? 0 : controlMotion.mode.duration);
      });
    });
  }
}
