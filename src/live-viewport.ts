import { exposureClip, forecastExposure, viewportExposure, viewportNeedsAnchor,
  type ViewportExposureLimits } from './viewport-exposure';

export interface LiveViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LiveViewportFrame {
  view: LiveViewBox;
  floor: LiveViewBox;
  grid?: LiveViewBox;
  zoom: number;
  target?: LiveViewBox;
  badge?: { percent: number; hidden: boolean };
}

interface LiveViewportState {
  painted: LiveViewportFrame | null;
  pending: LiveViewportFrame | null;
  raf: number;
  anchor: LiveViewportAnchor | null;
  nodes?: ViewportNodes;
  limits?: ViewportExposureLimits;
  basis?: { key: string; view: LiveViewBox; retained: boolean };
}

/** World coordinates represented by the currently prepared scene. */
export interface LiveViewportAnchor {
  frame: LiveViewportFrame;
  coverage: LiveViewBox;
  clip?: string;
  target?: LiveViewBox;
}

interface LiveViewportHost {
  _viewOr: (viewBox: number[]) => LiveViewBox;
  _baseVb: () => number[];
  _floorView: (view: LiveViewBox) => LiveViewBox;
  _planVisibleRect?: (view: LiveViewBox) => LiveViewBox;
  _zoom: number;
  _liveViewportTarget?: () => LiveViewBox | undefined;
  _liveViewportLimits?: () => ViewportExposureLimits;
  readonly _renderProjection?: 'iso' | 'flat';
  readonly _zoomBadge?: { percent: number; hidden: boolean };
  readonly _modeSceneClip?: string | null;
  _editorRuntime?: {wallDimensions?: {paintCamera(view:LiveViewBox):void}} | null;
  renderRoot: ParentNode;
}

const states = new WeakMap<object, LiveViewportState>();
const stateOf = (host: object): LiveViewportState => {
  let state = states.get(host);
  if (!state) {
    state = { painted: null, pending: null, raf: 0, anchor: null };
    states.set(host, state);
  }
  return state;
};

/** Actual HTML coordinates of the last Lit commit, including data updates
 * accepted in the middle of a mode transition. */
export function paintedHouseplanViewBox(host: object): LiveViewBox | null {
  const view = states.get(host)?.painted?.view;
  return view ? { ...view } : null;
}

export const liveViewBoxText = (view: LiveViewBox): string =>
  `${view.x} ${view.y} ${view.w} ${view.h}`;

export interface LiveLayerProjection {
  translateXPercent: number;
  translateYPercent: number;
  scaleX: number;
  scaleY: number;
}

/** Map an HTML percentage layer painted for `before` onto `after`. */
export function liveLayerProjection(
  before: LiveViewBox,
  after: LiveViewBox,
): LiveLayerProjection {
  return {
    translateXPercent: ((before.x - after.x) / after.w) * 100,
    translateYPercent: ((before.y - after.y) / after.h) * 100,
    scaleX: before.w / after.w,
    scaleY: before.h / after.h,
  };
}

export const isIdentityLiveLayerProjection = (projection: LiveLayerProjection): boolean =>
  projection.translateXPercent === 0
  && projection.translateYPercent === 0
  && projection.scaleX === 1
  && projection.scaleY === 1;

const finiteView = (view: LiveViewBox): boolean =>
  [view.x, view.y, view.w, view.h].every(Number.isFinite) && view.w > 0 && view.h > 0;

const projectionText = (projection: LiveLayerProjection): string =>
  `translate(${projection.translateXPercent}%,${projection.translateYPercent}%)`
  + ` scale(${projection.scaleX},${projection.scaleY})`;

/** Grid paint covers the same maximum reserve as the plan. */
export function liveGridBounds(view: LiveViewBox): LiveViewBox { return viewportExposure(view, {}); }

const sceneExposureClips = new WeakMap<ElementCSSInlineStyle, { input: string; value: string }>();
const setLayerProjection = (
  layer: ElementCSSInlineStyle,
  projection: LiveLayerProjection | null,
  options: { exposeSceneOverflow?: boolean; exposureClip?: string } = {},
): void => {
  const style = layer.style;
  const expose = options.exposeSceneOverflow === true;
  if (!projection) {
    // #544: the SVG viewport may be opened only while it is being projected.
    // `.stage` remains the outer clip, while removing these inline values
    // keeps the settled DOM and filter/compositing path byte-equivalent to
    // #531. The bound (#689) leaves together with the exposure it bounds.
    if (sceneExposureClips.has(layer) && style.overflow === 'visible') {
      style.removeProperty('overflow');
    }
    if (style.clipPath && style.clipPath === sceneExposureClips.get(layer)?.value) {
      style.removeProperty('clip-path');
    }
    sceneExposureClips.delete(layer);
    // #531: снимать только то, что стоит. Лишняя запись в стиль — это
    // инвалидация, а тихий кадр обязан оставлять DOM нетронутым.
    if (style.transform) {
      style.removeProperty('transform');
      style.removeProperty('transform-origin');
      style.removeProperty('will-change');
    }
    return;
  }
  // A transformed SVG keeps its old viewport box. Without exposing the scene
  // beyond that internal box, the incoming edge shows `.stage` background
  // until the next budgeted viewBox refresh (#544). The stage still clips the
  // complete card, so no scene pixels escape the visible plan surface; the
  // clip keeps the promoted layer stage-sized at any zoom (#689).
  if (expose && style.overflow !== 'visible') {
    style.overflow = 'visible';
  }
  if (expose) {
    const clip = options.exposureClip ?? 'inset(0)';
    const previous = sceneExposureClips.get(layer);
    if (previous?.input !== clip || previous.value !== style.clipPath) style.clipPath = clip;
    sceneExposureClips.set(layer, { input: clip, value: style.clipPath });
  }
  const text = projectionText(projection);
  // Promotion is gesture-scoped, not a per-frame hint (#579). Avoid even
  // equal writes while the projection changes: WebViews may treat them as
  // compositor lifecycle changes rather than harmless string assignments.
  if (style.transformOrigin !== '0 0' && style.transformOrigin !== '0px 0px') {
    style.transformOrigin = '0 0';
  }
  // A mode surface owns opacity as well as this camera's transform. Do not
  // alternate its promotion hint on every frame.
  if (style.willChange !== 'transform' && style.willChange !== 'transform, opacity')
    style.willChange = 'transform';
  if (style.transform !== text) style.transform = text;
};

/** Атрибут пишется только когда строка действительно другая (#531). */
const setViewBox = (svg: SVGElement, text: string): void => {
  if (svg.getAttribute('viewBox') !== text) svg.setAttribute('viewBox', text);
};

const findViewportNodes = (root: ParentNode) => {
  const camera = [...root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="camera"]')];
  const cameraLayers = [...new Set(camera.map(svg =>
    svg.closest?.<HTMLElement>('[data-hp-live-scene="camera"]') ?? svg))];
  return {
    camera, cameraLayers,
    floor: [...root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="floor"]')],
    grid: [...root.querySelectorAll<SVGElement>('[data-hp-live-grid]')],
    floorScene: [...root.querySelectorAll<HTMLElement>('[data-hp-live-scene="floor"]')],
    inherited: [...root.querySelectorAll<SVGElement>('[data-hp-live-inherited-scene="camera"]')],
    markerLayer: [...root.querySelectorAll<HTMLElement>('[data-hp-live-layer="camera"]')],
    badge: root.querySelector<HTMLElement>('[data-hp-live-zoom]'),
    badgeValue: root.querySelector<HTMLElement>('[data-hp-live-zoom-value]'),
  };
};
type ViewportNodes = ReturnType<typeof findViewportNodes>;

function sameViewport(a: LiveViewBox | undefined, b: LiveViewBox | undefined): boolean {
  return a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Synchronously publish one camera frame. DOM discovery belongs to the commit,
 * while motion uses the cached nodes and rebases only at a coverage boundary. */
export function paintLiveViewport(
  root: ParentNode,
  painted: LiveViewportFrame,
  current: LiveViewportFrame,
  anchor?: LiveViewportAnchor | null,
  options: { force?: boolean; keepSceneLayer?: boolean; sceneExposureClip?: string; lockSceneAnchor?: boolean;
    nodes?: ViewportNodes; limits?: ViewportExposureLimits; keepMarkerLayer?: boolean } = {},
): LiveViewportAnchor {
  const limits = options.limits ?? {};
  const nodes = options.nodes ?? findViewportNodes(root);
  const base = anchor ?? { frame: painted, coverage: viewportExposure(painted.view, limits) };
  if (!finiteView(painted.view) || !finiteView(current.view) || !finiteView(current.floor)) return base;
  const forecast = current.target && !sameViewport(current.target, base.target)
    ? forecastExposure(current.view, current.target) : current.view;
  const refresh = options.force === true || !anchor || !finiteView(base.frame.view) || !finiteView(base.frame.floor)
    || (!options.lockSceneAnchor && viewportNeedsAnchor(base.frame.view, base.coverage, current.view, limits, forecast));
  const next: LiveViewportAnchor = refresh
    ? { frame: current, coverage: viewportExposure(current.view, limits), target: current.target } : base;
  const sceneClip = options.sceneExposureClip ?? (next.clip ??= exposureClip(next.frame.view, next.coverage));
  if (refresh) {
    const viewBox = liveViewBoxText(current.view);
    const floorBox = liveViewBoxText(current.floor);
    for (const svg of nodes.camera) {
      setViewBox(svg, viewBox);
    }
    for (const svg of nodes.floor) {
      setViewBox(svg, floorBox);
    }
    const grid = liveGridBounds(current.grid || current.view);
    for (const rect of nodes.grid) {
      for (const [name, value] of [['x', grid.x], ['y', grid.y], ['width', grid.w], ['height', grid.h]] as const) {
        const text = String(value);
        if (rect.getAttribute(name) !== text) rect.setAttribute(name, text);
      }
    }
  }
  // Сцена: от записанного якоря к текущему кадру. Budget refresh делает
  // проекцию тождественной, но активная live-сессия сохраняет compositor layer
  // до terminal commit (#579), не демотирует и не промотирует SVG каждые 100 мс.
  const sceneCamera = liveLayerProjection(next.frame.view, current.view);
  const sceneFloor = liveLayerProjection(next.frame.floor, current.floor);
  const keepSceneLayer = options.keepSceneLayer === true;
  for (const layer of nodes.cameraLayers) {
    setLayerProjection(
      layer,
      isIdentityLiveLayerProjection(sceneCamera) && !keepSceneLayer ? null : sceneCamera,
      { exposeSceneOverflow: true, exposureClip: sceneClip },
    );
  }
  const floorScenes = options.sceneExposureClip ? [] : nodes.floorScene;
  const floorProjection = isIdentityLiveLayerProjection(sceneFloor) && !keepSceneLayer ? null : sceneFloor;
  for (const scene of floorScenes) {
    const exposed = floorProjection !== null;
    if (scene.hasAttribute('data-hp-live-scene-exposed') !== exposed) scene.toggleAttribute('data-hp-live-scene-exposed', exposed);
    setLayerProjection(scene, floorProjection, { exposeSceneOverflow:true, exposureClip:sceneClip });
  }
  for (const svg of nodes.floor) {
    // One bounded camera surface promotes the contiguous scene during gestures.
    // Opacity surfaces remain independent for mode transitions.
    if (floorScenes.some(scene => scene.contains(svg))) continue;
    setLayerProjection(
      svg,
      isIdentityLiveLayerProjection(sceneFloor) && (!keepSceneLayer || !!options.sceneExposureClip) ? null : sceneFloor,
      { exposeSceneOverflow: true, exposureClip: sceneClip },
    );
  }
  const projection = liveLayerProjection(painted.view, current.view);
  // These SVGs are deliberately NOT live-viewbox participants: the enclosing
  // HTML layer is their sole camera owner. Moving a bounded clip on the usual
  // anchor budget exposes incoming content without double projection or a
  // promoted unbounded route surface. The idle DOM remains unchanged.
  for (const svg of nodes.inherited) {
    if (!refresh && keepSceneLayer && svg.style.clipPath) continue;
    const active = keepSceneLayer || !isIdentityLiveLayerProjection(projection);
    if (active) {
      const clip = exposureClip(painted.view, next.coverage);
      if (svg.style.clipPath !== clip) svg.style.clipPath = clip;
    } else if (svg.style.clipPath) svg.style.removeProperty('clip-path');
  }
  for (const layer of nodes.markerLayer) {
    const still = isIdentityLiveLayerProjection(projection) && !options.keepMarkerLayer;
    const markerExposure = options.keepMarkerLayer
      ? { exposeSceneOverflow: true, exposureClip: exposureClip(painted.view, next.coverage) } : undefined;
    setLayerProjection(layer, still ? null : projection, markerExposure);
  }
  const badge = nodes.badge;
  if (badge) {
    const hidden = current.badge?.hidden ?? current.zoom <= 1;
    if (badge.hidden !== hidden) badge.hidden = hidden;
    const value = nodes.badgeValue;
    const text = `${current.badge?.percent ?? Math.round(current.zoom * 100)}%`;
    if (value && value.textContent !== text) value.textContent = text;
  }
  return next;
}

/** Frame supplied to Lit. HA updates during movement keep the authored basis.
 * The displayed camera remains the synchronous owner of hit testing. */
export function authoredHouseplanViewport(host: object, current: LiveViewBox, key: string, active: boolean): LiveViewBox {
  const state = stateOf(host);
  const previous = state.basis;
  const retained = active && previous?.key === key && !!state.painted;
  const view = retained ? state.painted!.view : current;
  state.basis = { key, view, retained };
  return view;
}

const frameOf = (host: LiveViewportHost, view = host._viewOr(host._baseVb())): LiveViewportFrame => {
  return { view: { ...view }, floor: { ...host._floorView(view) }, zoom: host._zoom, badge: host._zoomBadge,
    target: host._liveViewportTarget?.(),
    ...(host._renderProjection !== 'iso' && host._planVisibleRect ? { grid: host._planVisibleRect(view) } : {}) };
};

/** Coalesce camera input into one lightweight paint per animation frame. */
export function scheduleHouseplanViewport(value: object, now = false, force = false): void {
  const host = value as LiveViewportHost;
  const state = stateOf(value);
  const next = frameOf(host);
  if (now) {
    if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
    state.raf = 0; state.pending = null;
    if (!state.painted) state.painted = next;
    state.anchor = paintLiveViewport(
      host.renderRoot, state.painted, next, state.anchor, { keepSceneLayer: true, keepMarkerLayer: host._renderProjection === 'iso', force, sceneExposureClip: host._modeSceneClip ?? undefined, lockSceneAnchor: !!host._modeSceneClip,
        nodes: state.nodes ??= findViewportNodes(host.renderRoot), limits: state.limits ??= host._liveViewportLimits?.() ?? {} },
    );
    host._editorRuntime?.wallDimensions?.paintCamera(next.view);
    return;
  }
  state.pending = next;
  if (state.raf || typeof requestAnimationFrame !== 'function') return;
  state.raf = requestAnimationFrame(() => {
    state.raf = 0;
    const next = state.pending;
    state.pending = null;
    const root = host.renderRoot as ParentNode | undefined;
    if (!next || !root) return;
    if (!state.painted) state.painted = next;
    state.anchor = paintLiveViewport(
      root, state.painted, next, state.anchor, { keepSceneLayer: true, keepMarkerLayer: host._renderProjection === 'iso', sceneExposureClip: host._modeSceneClip ?? undefined, lockSceneAnchor: !!host._modeSceneClip,
        nodes: state.nodes ??= findViewportNodes(host.renderRoot), limits: state.limits ??= host._liveViewportLimits?.() ?? {} },
    );
    host._editorRuntime?.wallDimensions?.paintCamera(next.view);
  });
}

/** Record a complete Lit frame and reconcile gesture-scoped projections. */
export function commitHouseplanViewport(value: object, keepSceneLayer = false): void {
  const host = value as LiveViewportHost;
  const state = stateOf(value);
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  state.raf = 0;
  state.pending = null;
  const current = frameOf(host);
  const basis = state.basis;
  const root = host.renderRoot as ParentNode | undefined;
  if (!root) return;
  const previous = state.nodes;
  const nodes = state.nodes = findViewportNodes(root);
  state.limits = host._liveViewportLimits?.() ?? {};
  if (basis?.retained && state.painted && state.anchor && previous
    && nodes.camera.length === previous.camera.length && nodes.camera.every((node, i) => node === previous.camera[i])
    && nodes.floor.length === previous.floor.length && nodes.floor.every((node, i) => node === previous.floor[i])) {
    state.anchor = paintLiveViewport(root, state.painted, current, state.anchor, {
      keepSceneLayer: true, keepMarkerLayer: host._renderProjection === 'iso', nodes, limits: state.limits, lockSceneAnchor: !!host._modeSceneClip,
      sceneExposureClip: host._modeSceneClip ?? undefined,
    });
    return;
  }
  state.painted = basis ? frameOf(host, basis.view) : current;
  // A full Lit frame may arrive while a pointer or programmatic camera is still
  // active. It becomes the new exact anchor, but must not demote the scene in
  // the middle of that session (#579). The terminal Lit frame passes false and
  // restores the authored, transform-free idle DOM.
  state.anchor = paintLiveViewport(root, state.painted, current, state.anchor, {
    force: true, keepSceneLayer: keepSceneLayer || host._renderProjection === 'iso',
    keepMarkerLayer: host._renderProjection === 'iso',
    sceneExposureClip: host._modeSceneClip ?? undefined, nodes: state.nodes, limits: host._liveViewportLimits?.(),
  });
}

/** A compositor-owned surface can retire without a Lit update. */
export function refreshHouseplanViewportNodes(host: object): void {
  const state = states.get(host);
  const root = (host as LiveViewportHost).renderRoot;
  if (state && root) state.nodes = findViewportNodes(root);
}

export function disposeHouseplanViewport(host: object): void {
  const state = states.get(host);
  if (state?.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  states.delete(host);
}
