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
  anchor: LiveViewportAnchor | null;
}

/**
 * Кадр, чей `viewBox` сейчас записан в сцену, и момент записи (#531).
 *
 * Перезапись `viewBox` — это инвалидация растеризации всего плана: слой нельзя
 * сдвинуть, его надо нарисовать заново. Профиль владельца на панораме: краска
 * заканчивается, и до композиции проходит 94 мс медианы при незагруженном GPU,
 * а драйвер пропускает 124–144 тика в секунду с пометкой «ждём краску».
 * Поэтому кадр жеста двигает сцену трансформом, а `viewBox` переписывается по
 * бюджету — иначе на набегающем крае осталась бы пустая полоса.
 */
export interface LiveViewportAnchor {
  frame: LiveViewportFrame;
  at: number;
}

interface LiveViewportHost {
  _viewOr: (viewBox: number[]) => LiveViewBox;
  _baseVb: () => number[];
  _floorView: (view: LiveViewBox) => LiveViewBox;
  _zoom: number;
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

/** Как часто сцена догоняет жест содержимым, а не сдвигом пикселей. */
export const LIVE_VIEWBOX_REFRESH_MS = 100;
/** Доля видимой области, после которой ждать бюджет времени уже поздно. */
export const LIVE_VIEWBOX_REFRESH_SHIFT = 0.15;

/**
 * Пора ли записать новый `viewBox`. Два условия, оба нужны: по времени —
 * обычное перетаскивание, по сдвигу — рывок, за который план уезжает на
 * полэкрана раньше, чем истечёт бюджет времени.
 */
export function needsViewBoxRefresh(
  anchor: LiveViewportAnchor, current: LiveViewportFrame, now: number,
): boolean {
  if (now - anchor.at >= LIVE_VIEWBOX_REFRESH_MS) return true;
  const before = anchor.frame.view;
  const after = current.view;
  if (Math.abs(after.x - before.x) >= after.w * LIVE_VIEWBOX_REFRESH_SHIFT) return true;
  if (Math.abs(after.y - before.y) >= after.h * LIVE_VIEWBOX_REFRESH_SHIFT) return true;
  const scale = before.w / after.w;
  return Math.abs(1 - scale) >= LIVE_VIEWBOX_REFRESH_SHIFT;
}

const finiteView = (view: LiveViewBox): boolean =>
  [view.x, view.y, view.w, view.h].every(Number.isFinite) && view.w > 0 && view.h > 0;

const projectionText = (projection: LiveLayerProjection): string =>
  `translate(${projection.translateXPercent}%,${projection.translateYPercent}%)`
  + ` scale(${projection.scaleX},${projection.scaleY})`;

const setLayerProjection = (
  layer: ElementCSSInlineStyle,
  projection: LiveLayerProjection | null,
  options: { exposeSceneOverflow?: boolean } = {},
): void => {
  const style = layer.style;
  if (!projection) {
    // #544: the SVG viewport may be opened only while it is being projected.
    // `.stage` remains the outer clip, while removing this inline value keeps
    // the settled DOM and filter/compositing path byte-equivalent to #531.
    if (options.exposeSceneOverflow && style.overflow === 'visible') {
      style.removeProperty('overflow');
    }
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
  // complete card, so no scene pixels escape the visible plan surface.
  if (options.exposeSceneOverflow && style.overflow !== 'visible') {
    style.overflow = 'visible';
  }
  const text = projectionText(projection);
  if (style.transform === text) return;
  style.transformOrigin = '0 0';
  style.willChange = 'transform';
  style.transform = text;
};

/** Атрибут пишется только когда строка действительно другая (#531). */
const setViewBox = (svg: SVGElement, text: string): void => {
  if (svg.getAttribute('viewBox') !== text) svg.setAttribute('viewBox', text);
};

/**
 * Один атомарный кадр живого вьюпорта (#451, #531).
 *
 * Каждый кадр сцена едет трансформом от своего якоря, а слои устройств и
 * подписей — от последнего осевшего кадра Lit: базы у них разные, потому что
 * содержимое слоёв спозиционировано в процентах осевшего вида. Новый `viewBox`
 * пишется только когда наступил бюджет (`needsViewBoxRefresh`) либо когда
 * вызывающий требует этого явно (терминальное примирение). Возвращается якорь,
 * который после этого кадра действительно записан в DOM.
 */
export function paintLiveViewport(
  root: ParentNode,
  painted: LiveViewportFrame,
  current: LiveViewportFrame,
  anchor?: LiveViewportAnchor | null,
  options: { now?: number; force?: boolean } = {},
): LiveViewportAnchor {
  const now = options.now ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const base: LiveViewportAnchor = anchor ?? { frame: painted, at: -Infinity };
  if (!finiteView(painted.view) || !finiteView(current.view) || !finiteView(current.floor)) {
    return base;
  }
  const refresh = options.force === true || !finiteView(base.frame.view)
    || !finiteView(base.frame.floor) || needsViewBoxRefresh(base, current, now);
  const next: LiveViewportAnchor = refresh ? { frame: current, at: now } : base;
  if (refresh) {
    const viewBox = liveViewBoxText(current.view);
    const floorBox = liveViewBoxText(current.floor);
    for (const svg of root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="camera"]')) {
      setViewBox(svg, viewBox);
    }
    for (const svg of root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="floor"]')) {
      setViewBox(svg, floorBox);
    }
  }
  // Сцена: от записанного якоря к текущему кадру. После перезаписи `viewBox`
  // это тождество, и трансформ снимается в том же кадре.
  const sceneCamera = liveLayerProjection(next.frame.view, current.view);
  const sceneFloor = liveLayerProjection(next.frame.floor, current.floor);
  for (const svg of root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="camera"]')) {
    setLayerProjection(
      svg,
      isIdentityLiveLayerProjection(sceneCamera) ? null : sceneCamera,
      { exposeSceneOverflow: true },
    );
  }
  for (const svg of root.querySelectorAll<SVGElement>('[data-hp-live-viewbox="floor"]')) {
    setLayerProjection(
      svg,
      isIdentityLiveLayerProjection(sceneFloor) ? null : sceneFloor,
      { exposeSceneOverflow: true },
    );
  }
  const projection = liveLayerProjection(painted.view, current.view);
  for (const layer of root.querySelectorAll<HTMLElement>('[data-hp-live-layer="camera"]')) {
    // Keeping an identity transform after terminal reconciliation changes the
    // browser compositing path and therefore the settled raster by a few colour
    // levels. The fast path must leave byte-equivalent DOM/CSS when it is idle.
    setLayerProjection(layer, isIdentityLiveLayerProjection(projection) ? null : projection);
  }
  const badge = root.querySelector<HTMLElement>('[data-hp-live-zoom]');
  if (badge) {
    const hidden = current.zoom <= 1;
    if (badge.hidden !== hidden) badge.hidden = hidden;
    const value = badge.querySelector<HTMLElement>('[data-hp-live-zoom-value]');
    const text = `${Math.round(current.zoom * 100)}%`;
    if (value && value.textContent !== text) value.textContent = text;
  }
  return next;
}

const frameOf = (host: LiveViewportHost): LiveViewportFrame => {
  const view = host._viewOr(host._baseVb());
  return { view: { ...view }, floor: { ...host._floorView(view) }, zoom: host._zoom };
};

/** Coalesce camera input into one lightweight paint per animation frame. */
export function scheduleHouseplanViewport(value: object, now = false): void {
  const host = value as LiveViewportHost;
  const state = stateOf(value);
  const next = frameOf(host);
  if (now) {
    if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
    state.raf = 0; state.pending = null;
    if (!state.painted) state.painted = next;
    state.anchor = paintLiveViewport(host.renderRoot, state.painted, next, state.anchor);
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
    state.anchor = paintLiveViewport(root, state.painted, next, state.anchor);
  });
}

/** Record a complete Lit frame and remove any temporary HTML projection. */
export function commitHouseplanViewport(value: object): void {
  const host = value as LiveViewportHost;
  const state = stateOf(value);
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  state.raf = 0;
  state.pending = null;
  state.painted = frameOf(host);
  const root = host.renderRoot as ParentNode | undefined;
  if (!root) return;
  for (const layer of root.querySelectorAll<HTMLElement>('[data-hp-live-layer="camera"]')) {
    setLayerProjection(layer, null);
  }
  // Осевший кадр: `viewBox` записывается принудительно, трансформы сцены
  // снимаются вместе с ним — дальше кадр принадлежит Lit, а не живому пути.
  state.anchor = paintLiveViewport(root, state.painted, state.painted, state.anchor, { force: true });
}

export function disposeHouseplanViewport(host: object): void {
  const state = states.get(host);
  if (state?.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  states.delete(host);
}
