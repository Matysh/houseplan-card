export interface LiveViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LiveViewportFrame {
  view: LiveViewBox;
  floor: LiveViewBox;
  zoom: number;
}

interface LiveViewportState {
  painted: LiveViewportFrame | null;
  pending: LiveViewportFrame | null;
  raf: number;
}

const states = new WeakMap<object, LiveViewportState>();
const stateOf = (host: object): LiveViewportState => {
  let state = states.get(host);
  if (!state) {
    state = { painted: null, pending: null, raf: 0 };
    states.set(host, state);
  }
  return state;
};

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

const finiteView = (view: LiveViewBox): boolean =>
  [view.x, view.y, view.w, view.h].every(Number.isFinite) && view.w > 0 && view.h > 0;

const setLayerProjection = (
  layer: HTMLElement,
  projection: LiveLayerProjection | null,
): void => {
  if (!projection) {
    layer.style.removeProperty('transform');
    layer.style.removeProperty('transform-origin');
    layer.style.removeProperty('will-change');
    return;
  }
  layer.style.transformOrigin = '0 0';
  layer.style.willChange = 'transform';
  layer.style.transform = `translate(${projection.translateXPercent}%,${projection.translateYPercent}%) scale(${projection.scaleX},${projection.scaleY})`;
};

/** One atomic DOM-only viewport paint; no Lit host update is involved. */
export function paintLiveViewport(
  root: ParentNode,
  painted: LiveViewportFrame,
  current: LiveViewportFrame,
): void {
  if (!finiteView(painted.view) || !finiteView(current.view) || !finiteView(current.floor)) return;
  const viewBox = liveViewBoxText(current.view);
  const floorBox = liveViewBoxText(current.floor);
  for (const svg of root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="camera"]')) {
    svg.setAttribute('viewBox', viewBox);
  }
  for (const svg of root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="floor"]')) {
    svg.setAttribute('viewBox', floorBox);
  }
  const projection = liveLayerProjection(painted.view, current.view);
  for (const layer of root.querySelectorAll<HTMLElement>('[data-hp-live-layer="camera"]')) {
    setLayerProjection(layer, projection);
  }
  const badge = root.querySelector<HTMLElement>('[data-hp-live-zoom]');
  if (badge) {
    badge.hidden = current.zoom <= 1;
    const value = badge.querySelector<HTMLElement>('[data-hp-live-zoom-value]');
    if (value) value.textContent = `${Math.round(current.zoom * 100)}%`;
  }
}

const frameOf = (host: any): LiveViewportFrame => {
  const view = host._viewOr(host._baseVb());
  return { view: { ...view }, floor: { ...host._floorView(view) }, zoom: host._zoom };
};

/** Coalesce camera input into one lightweight paint per animation frame. */
export function scheduleHouseplanViewport(host: any): void {
  const state = stateOf(host);
  state.pending = frameOf(host);
  if (state.raf || typeof requestAnimationFrame !== 'function') return;
  state.raf = requestAnimationFrame(() => {
    state.raf = 0;
    const next = state.pending;
    state.pending = null;
    const root = host.renderRoot as ParentNode | undefined;
    if (!next || !root) return;
    if (!state.painted) state.painted = next;
    paintLiveViewport(root, state.painted, next);
  });
}

/** Record a complete Lit frame and remove any temporary HTML projection. */
export function commitHouseplanViewport(host: any): void {
  const state = stateOf(host);
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  state.raf = 0;
  state.pending = null;
  state.painted = frameOf(host);
  const root = host.renderRoot as ParentNode | undefined;
  if (!root) return;
  for (const layer of root.querySelectorAll<HTMLElement>('[data-hp-live-layer="camera"]')) {
    setLayerProjection(layer, null);
  }
  paintLiveViewport(root, state.painted, state.painted);
}

export function disposeHouseplanViewport(host: object): void {
  const state = states.get(host);
  if (state?.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  states.delete(host);
}
