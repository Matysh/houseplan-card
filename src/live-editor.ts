import { nothing, render, svg, type TemplateResult } from 'lit';
import { cancelHouseplanPointerMove } from './pointer-move-queue';

interface LiveEditorState {
  raf: number;
  hidden: HTMLElement[];
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
    state = { raf: 0, hidden: [] };
    states.set(host, state);
  }
  return state;
};

const activeEditorGesture = (host: any): boolean => host._mode !== 'view' && (
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
  host: any,
  name?: PropertyKey,
  oldValue?: unknown,
): boolean {
  if (!host?.isConnected || host._mode === 'view') return false;
  const namedLive = name !== undefined && liveProperties.has(name);
  if (name === '_layout' && !host._deviceDrag) return false;
  if (name === '_dtBox' && !host._dtDrag) return false;
  if (name !== undefined && gestureProperties.has(name)
      && oldValue == null && host[name] != null && activeEditorGesture(host)) {
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

const restore = (state: LiveEditorState): void => {
  for (const element of state.hidden) element.style.removeProperty('visibility');
  state.hidden.length = 0;
};

const planTemplate = (host: any): TemplateResult => {
  const vb = host._baseVb();
  const view = host._viewOr(vb);
  const measure = host._opMeasureView;
  if (host._resize?.dragging) {
    const display = host._spaceDisplayForRender();
    return svg`<g class="hp-live-resize" aria-hidden="true" pointer-events="none">
      ${host._renderWallBodies(display)}
      ${host._renderResizeMeasurements()}
      ${host._renderOpenings(display)}
      ${host._renderResizeLayer(view)}
    </g>`;
  }
  return svg`<g class="hp-live-plan" aria-hidden="true" pointer-events="none">
    ${host._renderMarkupLayer(vb)}
    ${host._renderHiddenWallDiagnosticOverlay()}
    ${host._renderOpeningPlacementPreview()}
    ${measure ? host._renderOpeningDimensionGuides(measure) : nothing}
    ${measure?.guide ? host._renderOpeningCenterTick(measure.guide) : nothing}
    ${host._renderActiveChainInk()}
    ${host._renderPlanSnapOverlay()}
    ${host._renderWallThickUi()}
  </g>`;
};

const editorTemplate = (host: any): TemplateResult | typeof nothing => {
  if (host._mode === 'plan') return planTemplate(host);
  if (host._mode === 'decor') {
    const view = host._viewOr(host._baseVb());
    return svg`<g class="hp-live-decor" aria-hidden="true" pointer-events="none">
      ${host._renderDecorLayer()}
      ${host._renderBackdropFrame(view)}
      ${host._renderTextFrame(view)}
    </g>`;
  }
  return nothing;
};

const paintDevice = (host: any, root: ParentNode): void => {
  const drag = host._deviceDrag;
  if (!drag) return;
  const device = host._devices.find((candidate: any) => candidate.id === drag.id);
  const element = [...root.querySelectorAll<HTMLElement>('[data-hp="device"]')]
    .find((candidate) => candidate.dataset.id === drag.id);
  if (!device || !element) return;
  const position = host._livePos(device);
  const point = host._scenePoint([position.x, position.y]);
  const view = host._viewOr(host._baseVb());
  element.style.left = `${((point[0] - view.x) / view.w) * 100}%`;
  element.style.top = `${((point[1] - view.y) / view.h) * 100}%`;
};

/** One editor-only render root per card; the settled scene remains untouched. */
export function paintHouseplanEditor(host: any): void {
  const root = host.renderRoot as ParentNode | undefined;
  if (!root) return;
  const state = stateOf(host);
  restore(state);
  paintDevice(host, root);
  const target = root.querySelector<SVGElement>('[data-hp-live-editor]');
  if (!target) return;
  if (host._mode === 'plan') {
    hide(state, root, '.hp-editor-only-layer');
    if (host._resize?.dragging) hide(state, root, '.wallbodies');
  } else if (host._mode === 'decor') {
    hide(state, root, '.decorlayer');
    hide(state, root, '.dtframe, .backdropframe');
  }
  render(editorTemplate(host), target);
  host._liveEditorPaintCount = (host._liveEditorPaintCount || 0) + 1;
}

export function scheduleHouseplanEditor(host: any): void {
  const state = stateOf(host);
  if (state.raf || typeof requestAnimationFrame !== 'function') return;
  state.raf = requestAnimationFrame(() => {
    state.raf = 0;
    paintHouseplanEditor(host);
  });
}

/** Only text needs a DOM measurement; every box-like item owns its config box. */
export function measureHouseplanDecorText(host: any): void {
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

export function commitHouseplanEditor(host: any): void {
  const state = stateOf(host);
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  state.raf = 0;
  restore(state);
  const target = (host.renderRoot as ParentNode | undefined)
    ?.querySelector<SVGElement>('[data-hp-live-editor]');
  if (target) render(nothing, target);
}

export function disposeHouseplanEditor(host: object): void {
  cancelHouseplanPointerMove(host);
  const state = states.get(host);
  if (!state) return;
  if (state.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.raf);
  restore(state);
  states.delete(host);
}
