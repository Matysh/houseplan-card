import { nothing, render, svg, type TemplateResult } from 'lit';
import { cancelHouseplanPointerMove } from './pointer-move-queue';
import { gridVisualUnits } from './grid-scale';
import type { RenderOpening } from './interaction-types';
import type { SpaceDisplay } from './logic';
import type { SpaceModel, WallEntry } from './types';
import {
  wallBodyNeedsSolid, wallCmToUnits, wallEdgePathD,
  wallHatchNeedsSolid, wallHatchStepUnits,
  type WallEdgeBody,
} from './wall-thickness';
import { NORM_W } from './space-geometry';

interface LiveEditorState {
  raf: number;
  hidden: HTMLElement[];
  transparent: HTMLElement[];
  dimmed: HTMLElement[];
}

interface LiveEditorHost {
  isConnected: boolean;
  renderRoot: ParentNode;
  requestUpdate: () => void;
  _mode: 'view' | 'plan' | 'devices' | 'decor';
  _tool: string;
  _deviceDrag: { id: string } | null;
  _physicalDrag?: unknown;
  _physicalRotate?: unknown;
  _decorDraft?: unknown;
  _decorMove?: { id: string } | null;
  _dtDrag?: { id: string } | null;
  _bdDrag?: unknown;
  _opDrag?: unknown;
  _resize?: { dragging: boolean; plan?: { roomIds: string[]; movingOpeningIds: string[] } | null };
  _layout: unknown;
  _dtBox: { id: string; x: number; y: number; w: number; h: number } | null;
  _dtSel: { id: string; kind: string } | null;
  _opMeasureView: { guide: unknown } | null;
  _devices: { id: string }[];
  _liveEditorPaintCount: number;
  _baseVb: () => number[];
  _viewOr: (viewBox: number[]) => { x: number; y: number; w: number; h: number };
  _spaceDisplayForRender: () => SpaceDisplay;
  _renderWallBodies: (display: unknown) => unknown;
  _renderResizeMeasurements: () => unknown;
  _renderOpenings: (display: unknown, onlyIds?: readonly string[]) => unknown;
  _renderResizeLayer: (view: unknown, roomIds?: readonly string[]) => unknown;
  _renderMarkupLayer: (viewBox: number[]) => unknown;
  _renderHiddenWallDiagnosticOverlay: () => unknown;
  _renderOpeningPlacementPreview: () => unknown;
  _renderOpeningDimensionGuides: (measure: unknown) => unknown;
  _renderOpeningCenterTick: (guide: unknown) => unknown;
  _renderActiveChainInk: () => unknown;
  _renderPlanSnapOverlay: () => unknown;
  _renderWallThickUi: () => unknown;
  _renderDecorLayer: (onlyId?: string | null) => unknown;
  _renderBackdropFrame: (view: unknown) => unknown;
  _renderTextFrame: (view: unknown) => unknown;
  _renderLiveEditorMeasurements: (view: unknown) => unknown;
  _livePos: (device: { id: string }) => { x: number; y: number };
  _scenePoint: (point: number[]) => number[];
  _renderProjection: string;
  _spaceModel: () => SpaceModel | null;
  _spaceWalls: WallEntry[];
  _cellCm: number;
  _gridPitch: number;
  _openingsR: RenderOpening[];
  _stageEl: HTMLElement | null;
  _fillColors: { wall_fill: { c: string; a: number } };
}

const states = new WeakMap<object, LiveEditorState>();

const liveProperties = new Set<PropertyKey>([
  '_cursorPt', '_opMeasure', '_physicalDrag', '_physicalRotate',
  '_decorDraft', '_dtBox', '_dtDrag', '_bdDrag', '_furnPreviewInput', '_layout',
]);
const hoverProperties = new Set<PropertyKey>(['_cursorPt', '_opMeasure', '_furnPreviewInput']);
const gestureProperties = new Set<PropertyKey>([
  '_physicalDrag', '_physicalRotate', '_decorDraft', '_dtDrag', '_bdDrag',
]);

const stateOf = (host: object): LiveEditorState => {
  let state = states.get(host);
  if (!state) {
    state = { raf: 0, hidden: [], transparent: [], dimmed: [] };
    states.set(host, state);
  }
  return state;
};

const activeEditorGesture = (host: LiveEditorHost): boolean => host._mode !== 'view' && (
  !!host._deviceDrag || !!host._physicalDrag || !!host._physicalRotate
  || !!host._decorDraft || !!host._decorMove || !!host._dtDrag || !!host._bdDrag
  || !!host._opDrag
  || !!host._resize?.dragging
);

/**
 * ReactiveElement calls `requestUpdate(name, oldValue)` from generated state
 * setters. Only pointer-owned values are diverted; selection, dialogs, toasts
 * and terminal null assignments still receive a normal host update.
 */
export function routeHouseplanEditorUpdate(
  value: object,
  name?: PropertyKey,
  oldValue?: unknown,
): boolean {
  const host = value as LiveEditorHost;
  if (!host?.isConnected || host._mode === 'view') return false;
  const namedLive = name !== undefined && liveProperties.has(name);
  if (name === '_layout' && !host._deviceDrag) return false;
  if (name === '_dtBox' && !host._dtDrag) return false;
  if (name !== undefined && gestureProperties.has(name)
      && oldValue == null
      && (host as unknown as Record<PropertyKey, unknown>)[name] != null
      && activeEditorGesture(host)) {
    // Pointerdown may change selection/chrome once. Subsequent moves stay live.
    return false;
  }
  if (name !== undefined && gestureProperties.has(name) && host[name] == null) return false;
  const route = (namedLive && (hoverProperties.has(name!) || activeEditorGesture(host)))
    || (name === undefined && activeEditorGesture(host));
  if (!route) return false;
  scheduleHouseplanEditor(host);
  return true;
}

const hide = (state: LiveEditorState, root: ParentNode, selector: string): void => {
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[data-hp-live-editor]')) continue;
    if (element.style.visibility === 'hidden') continue;
    element.style.visibility = 'hidden';
    state.hidden.push(element);
  }
};

/** Keep the captured source hittable while only its live copy stays visible. */
const makeTransparent = (state: LiveEditorState, root: ParentNode, selector: string): void => {
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[data-hp-live-editor]')) continue;
    if (element.style.opacity === '0') continue;
    element.style.opacity = '0';
    state.transparent.push(element);
  }
};

const restore = (state: LiveEditorState): void => {
  for (const element of state.hidden) element.style.removeProperty('visibility');
  state.hidden.length = 0;
  for (const element of state.transparent) element.style.removeProperty('opacity');
  state.transparent.length = 0;
  for (const element of state.dimmed) element.style.removeProperty('opacity');
  state.dimmed.length = 0;
};

/** Resize moves paint individual wall strips; pointerup still validates the canonical union. */
const resizePreviewWalls = (
  host: LiveEditorHost, display: SpaceDisplay, roomIds: readonly string[] = [],
): TemplateResult => {
  if (host._renderProjection === 'iso') return svg``;
  const space = host._spaceModel();
  if (!space) return svg``;
  const affected = new Set(roomIds);
  const boundary = (space.rooms || []).filter((room) => !!room.id && affected.has(room.id))
    .flatMap((room) => {
      const poly = room.poly || [];
      return poly.map((point: number[], index: number) => [
        point, poly[(index + 1) % poly.length],
      ]);
    });
  const onSegment = (point: number[], segment: number[][]): boolean => {
    const [a, b] = segment;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length2 = dx * dx + dy * dy;
    if (!(length2 > 0)) return false;
    const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2;
    const clamped = Math.max(0, Math.min(1, t));
    return Math.hypot(point[0] - a[0] - dx * clamped, point[1] - a[1] - dy * clamped) < 1e-4;
  };
  const edge = (a: number[], b: number[], cm: number, key: string): WallEdgeBody | null => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 1e-9) || !(cm > 0)) return null;
    const half = wallCmToUnits(cm, host._cellCm, host._gridPitch) / 2;
    const nx = -(b[1] - a[1]) / length * half;
    const ny = (b[0] - a[0]) / length * half;
    return {
      key, kind: 'outer', cm, a, b, depthUnits: half * 2,
      quad: [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
        [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]],
    };
  };
  const edges = [
    ...host._spaceWalls.filter((wall) => {
      const a = (wall.a || []).map((value: number) => value * NORM_W);
      const b = (wall.b || []).map((value: number) => value * NORM_W);
      return boundary.some((segment: number[][]) => onSegment(a, segment) && onSegment(b, segment));
    }).map((wall, index) => edge(
      (wall.a || []).map((value: number) => value * NORM_W),
      (wall.b || []).map((value: number) => value * NORM_W),
      wall.cm, wall.key || `wall-${index}`,
    )),
  ].filter((item): item is WallEdgeBody => !!item);
  const openings = host._openingsR.map((opening) => ({
    x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
  }));
  const paths = edges.map((edge) => wallEdgePathD(edge, openings)).filter(Boolean);
  if (!paths.length) return svg``;
  const depth = Math.max(...edges.map((edge) => edge.depthUnits), 0);
  const view = host._viewOr(host._baseVb());
  const px = host._stageEl?.clientWidth && view.w ? host._stageEl.clientWidth / view.w : 1;
  const solid = wallBodyNeedsSolid(depth, px)
    || wallHatchNeedsSolid(wallHatchStepUnits(host._cellCm), px);
  const stroke = display?.color || '#607d8b';
  const fill = host._fillColors.wall_fill;
  const d = paths.join(' ');
  return svg`<g class="wallbodies hp-resize-preview-walls"
      style="--room-stroke:${stroke};--wall-fill:${fill.c};--wall-fill-op:${fill.a}">
    <path class="wallbody-fill" data-component="preview" d=${d}
      fill=${fill.c} fill-opacity=${fill.a} fill-rule="nonzero" stroke="none"></path>
    <path class="wallbody ${solid ? 'solid' : ''}" data-hp="wall"
      data-id="preview" data-kind="preview" d=${d}
      fill=${solid ? 'none' : 'url(#hp-wall-hatch)'} fill-rule="nonzero"
      stroke=${stroke} stroke-width=${gridVisualUnits(0.6, host._cellCm)}></path>
  </g>`;
};

const planTemplate = (host: LiveEditorHost): TemplateResult => {
  const vb = host._baseVb();
  const view = host._viewOr(vb);
  const measure = host._opMeasureView;
  if (host._resize?.dragging) {
    const display = host._spaceDisplayForRender();
    const plan = host._resize.plan;
    return svg`<g class="hp-live-resize" aria-hidden="true" pointer-events="none">
      ${resizePreviewWalls(host, display, plan?.roomIds)}
      ${host._renderResizeMeasurements()}
      ${host._renderOpenings(display, plan?.movingOpeningIds)}
      ${host._renderResizeLayer(view, plan?.roomIds)}
    </g>`;
  }
  const display = host._spaceDisplayForRender();
  return svg`<g class="hp-live-plan" aria-hidden="true" pointer-events="none">
    ${host._opDrag ? host._renderWallBodies(display) : nothing}
    ${host._renderMarkupLayer(vb)}
    ${host._renderHiddenWallDiagnosticOverlay()}
    ${host._renderOpeningPlacementPreview()}
    ${measure ? host._renderOpeningDimensionGuides(measure) : nothing}
    ${measure?.guide ? host._renderOpeningCenterTick(measure.guide) : nothing}
    ${host._renderActiveChainInk()}
    ${host._tool === 'draw' ? nothing : host._renderPlanSnapOverlay()}
    ${host._renderWallThickUi()}
    ${host._opDrag ? host._renderOpenings(display) : nothing}
  </g>`;
};

const editorTemplate = (host: LiveEditorHost): TemplateResult | typeof nothing => {
  if (host._mode === 'plan') return planTemplate(host);
  if (host._mode === 'decor') {
    const view = host._viewOr(host._baseVb());
    const activeId = host._dtDrag?.id || host._decorMove?.id || null;
    return svg`<g class="hp-live-decor" aria-hidden="true" pointer-events="none">
      ${host._renderDecorLayer(activeId)}
      ${host._renderBackdropFrame(view)}
      ${host._renderTextFrame(view)}
    </g>`;
  }
  return nothing;
};

const paintDevice = (host: LiveEditorHost, root: ParentNode): void => {
  const drag = host._deviceDrag;
  if (!drag) return;
  const device = host._devices.find((candidate) => candidate.id === drag.id);
  const element = [...root.querySelectorAll<HTMLElement>('[data-hp="device"]')]
    .find((candidate) => candidate.dataset.id === drag.id);
  if (!device || !element) return;
  const position = host._livePos(device);
  const point = host._scenePoint([position.x, position.y]);
  const view = host._viewOr(host._baseVb());
  element.style.left = `${((point[0] - view.x) / view.w) * 100}%`;
  element.style.top = `${((point[1] - view.y) / view.h) * 100}%`;
};

const makeDecorShapeTransparent = (
  state: LiveEditorState, root: ParentNode, id: string,
): void => {
  for (const element of root.querySelectorAll<HTMLElement>('.decorlayer [data-hp="decor"]')) {
    if (element.closest('[data-hp-live-editor]') || element.dataset.id !== id) continue;
    if (element.style.opacity === '0') continue;
    element.style.opacity = '0';
    state.transparent.push(element);
  }
};

const makeMovingOpeningsTransparent = (
  state: LiveEditorState, root: ParentNode, ids: readonly string[],
): void => {
  const moving = new Set(ids);
  for (const element of root.querySelectorAll<HTMLElement>('.openinglayer [data-hp="opening"]')) {
    if (!element.closest('[data-hp-live-editor]') && moving.has(element.dataset.id || '')) {
      element.style.opacity = '0';
      state.transparent.push(element);
    }
  }
};

const dim = (state: LiveEditorState, root: ParentNode, selector: string): void => {
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[data-hp-live-editor]')) continue;
    element.style.opacity = '0.35';
    state.dimmed.push(element);
  }
};

/** One editor-only render root per card; the settled scene remains untouched. */
export function paintHouseplanEditor(value: object): void {
  const host = value as LiveEditorHost;
  const root = host.renderRoot;
  if (!root) return;
  const state = stateOf(host);
  restore(state);
  paintDevice(host, root);
  const target = root.querySelector<SVGElement>('[data-hp-live-editor]');
  if (!target) return;
  if (host._mode === 'plan') {
    makeTransparent(state, root, '.hp-editor-only-layer:not(.hp-plan-snap-layer)');
    if (host._opDrag) hide(state, root, '.wallbodies');
    if (host._resize?.dragging) {
      dim(state, root, '.wallbodies');
      makeTransparent(state, root, '.resize-layer');
      makeMovingOpeningsTransparent(state, root, host._resize.plan?.movingOpeningIds || []);
    }
    if (host._opDrag) makeTransparent(state, root, '.openinglayer');
  } else if (host._mode === 'decor') {
    const activeId = host._dtDrag?.id || host._decorMove?.id;
    if (activeId) makeDecorShapeTransparent(state, root, activeId);
    makeTransparent(state, root, '.dtframe, .backdropframe');
  }
  render(editorTemplate(host), target);
  const htmlTarget = root.querySelector<HTMLElement>('[data-hp-live-editor-html]');
  if (htmlTarget) {
    const view = host._viewOr(host._baseVb());
    render(host._renderLiveEditorMeasurements(view), htmlTarget);
  }
  host._liveEditorPaintCount = (host._liveEditorPaintCount || 0) + 1;
}

export function scheduleHouseplanEditor(value: object): void {
  const state = stateOf(value);
  if (state.raf || typeof requestAnimationFrame !== 'function') return;
  state.raf = requestAnimationFrame(() => {
    state.raf = 0;
    paintHouseplanEditor(value);
  });
}

/** Only text needs a DOM measurement; every box-like item owns its config box. */
export function measureHouseplanDecorText(value: object): void {
  const host = value as LiveEditorHost;
  const shape = host._dtSel;
  if (!shape) {
    if (host._dtBox) { host._dtBox = null; host.requestUpdate(); }
    return;
  }
  if (shape.kind !== 'text') return;
  const element = host.renderRoot.querySelector(
    `text.dtext[data-id="${shape.id}"]`,
  ) as SVGGraphicsElement | null;
  if (!element || typeof element.getBBox !== 'function') return;
  let measured: DOMRect;
  try { measured = element.getBBox(); } catch { return; }
  if (!measured || (!measured.width && !measured.height)) return;
  const box = {
    id: shape.id, x: measured.x, y: measured.y,
    w: measured.width, h: measured.height,
  };
  const current = host._dtBox;
  if (current?.id === box.id && Math.abs(current.x - box.x) < 0.01
      && Math.abs(current.y - box.y) < 0.01 && Math.abs(current.w - box.w) < 0.01
      && Math.abs(current.h - box.h) < 0.01) return;
  host._dtBox = box;
  host.requestUpdate();
}

export function commitHouseplanEditor(value: object): void {
  const host = value as LiveEditorHost;
  const state = stateOf(value);
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  state.raf = 0;
  restore(state);
  const target = (host.renderRoot as ParentNode | undefined)
    ?.querySelector<SVGElement>('[data-hp-live-editor]');
  if (target) render(nothing, target);
  const htmlTarget = (host.renderRoot as ParentNode | undefined)
    ?.querySelector<HTMLElement>('[data-hp-live-editor-html]');
  if (htmlTarget) {
    const view = host._viewOr(host._baseVb());
    render(host._renderLiveEditorMeasurements(view), htmlTarget);
  }
}

export function disposeHouseplanEditor(host: object): void {
  cancelHouseplanPointerMove(host);
  const state = states.get(host);
  if (!state) return;
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  restore(state);
  states.delete(host);
}
