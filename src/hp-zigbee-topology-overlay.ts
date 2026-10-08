import { LitElement, css, html, svg, nothing, type PropertyValues } from 'lit';
import { langOf } from './i18n';
import { zigbeeLinkColor } from './zigbee-topology-style';
import { TOPOLOGY_LANGUAGE_RUNTIME, topologyT } from './i18n/topology';
import {
  mapTopologies, resolveMappedTopologyHover, type ZigbeeMappedTopology,
  TOPOLOGY_STALE_MS, type ZigbeeParentTarget,
} from './zigbee-topology';
import { zigbeeArrowGeometry, type ZigbeePixelPoint } from './zigbee-topology-geometry';
import {
  subscribeZigbeeTopology, zigbeeTopologyRuntimeSnapshot,
  zigbeeTopologyUserIdentity,
  type ZigbeeTopologyHass, type ZigbeeTopologyRuntimeSnapshot,
} from './zigbee-topology-runtime';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';
import { placeDeviceTooltip, type TipRect } from './live-tip-placement';

const EMPTY_RUNTIME: ZigbeeTopologyRuntimeSnapshot = { revision: 0, topologies: [], states: {} };
const ENDPOINT_ATTRIBUTE = 'data-hp-zigbee-topology-endpoint';
type MarkerPosition = ZigbeePixelPoint & { width: number; height: number };

export class HpZigbeeTopologyOverlay extends LitElement {
  static properties = {
    hass: { attribute: false },
    devices: { attribute: false },
    registry: { attribute: false },
    currentSpace: { type: String, attribute: 'current-space' },
    spaces: { attribute: false },
    viewKey: { attribute: false },
    zoom: { type: Number },
    onLayout: { attribute: false },
  };

  hass!: ZigbeeTopologyHass;
  devices: readonly DevItem[] = [];
  registry!: HaRegistrySnapshot;
  currentSpace = '';
  spaces?: readonly { id?: unknown; title?: unknown }[];
  viewKey: unknown;
  zoom = 1;
  onLayout?: () => void;
  private _runtime = EMPTY_RUNTIME;
  private _hovered = '';
  private _staleTimer?: ReturnType<typeof setTimeout>;
  private _release?: () => void;
  private _owner?: object;
  private _userIdentity = '';
  private _parent?: HTMLElement;
  private _hoverGateObserver?: MutationObserver;
  private _markerObserver?: MutationObserver;
  private _layoutFrame = 0;
  private _layoutResize?: ResizeObserver;
  private _desiredEndpointIds = new Set<string>();
  private _endpointSetDirty = false;
  private _endpointElements = new Set<HTMLElement>();
  private _mappedMemo?: { runtime: ZigbeeTopologyRuntimeSnapshot; devices: readonly DevItem[];
    registry: HaRegistrySnapshot; mapped: ZigbeeMappedTopology[] };

  static styles = css`
    /* No host stacking context: endpoint cores stay above routes (8 > 7),
       while information captions also stay above passive batteries (9 > 8).
       #808/#829: a copy of the routes clipped to endpoint battery and value
       badge frames paints over those batteries and badges (9 > 8) and under
       captions (same 9, earlier DOM). */
    :host { position: absolute; inset: 0; z-index: auto; display: block; pointer-events: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; z-index: 7; }
    svg.over-battery { z-index: 9; }
    line { vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .route-arrow { vector-effect: non-scaling-stroke; }
    svg, line, polygon, .halo, .remote, .parent-bubble, .route-status { pointer-events: none; }
    .halo {
      z-index: 7;
      position: absolute; width: calc(var(--device-base-size, 4cqw) * 1.22);
      height: calc(var(--device-base-size, 4cqw) * 1.22); transform: translate(-50%, -50%);
      box-sizing: border-box; border: 2px solid rgba(120, 190, 220, .82); border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(120, 190, 220, .16);
    }
    .remote, .parent-bubble, .route-status {
      z-index: 9;
      position: absolute; transform: translate(12px, calc(-100% - 12px));
      border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
      padding: 3px 7px; color: #fff; background: rgba(28,31,36,.88);
      box-shadow: 0 2px 7px rgba(0,0,0,.28); white-space: nowrap;
      font: 600 11px/1.2 system-ui, sans-serif;
    }
    .parent-bubble { width: max-content; white-space: normal; overflow-wrap: anywhere; box-sizing: border-box; border-radius: 12px; }
    .parent-bubble.right { transform: translate(0, -50%); }
    .parent-bubble.left { transform: translate(-100%, -50%); }
    .route-status { transform: translate(-50%, 12px); max-width: 240px; white-space: normal; text-align: center; }
    @media (forced-colors: active) {
      line { stroke: Highlight !important; }
      .route-arrow { fill: Highlight !important; stroke: CanvasText !important; }
      .halo { border-color: Highlight; box-shadow: none; }
      .remote, .parent-bubble, .route-status { color: CanvasText; background: Canvas; border-color: CanvasText; }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const root = this.getRootNode() as ShadowRoot;
    if (root.host && typeof MutationObserver !== 'undefined') {
      this._hoverGateObserver = new MutationObserver(() => {
        if (!root.host.hasAttribute('data-pointer-hover')) this._clear();
      });
      this._hoverGateObserver.observe(root.host, { attributes: true, attributeFilter: ['data-pointer-hover'] });
    }
    queueMicrotask(() => this._connectParent());
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    clearTimeout(this._staleTimer);
    this._release?.();
    this._release = undefined;
    this._owner = undefined;
    this._runtime = EMPTY_RUNTIME;
    this._disconnectParent();
    this._hoverGateObserver?.disconnect();
    this._hoverGateObserver = undefined;
    this._hovered = '';
    this._desiredEndpointIds.clear();
    this.removeAttribute('data-tooltip-owner');
    this._stopLayout();
    this.onLayout?.();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues<this>): void {
    const owner = this.hass?.connection || this.hass;
    const identity = zigbeeTopologyUserIdentity(this.hass || {});
    const observing = this.isConnected && this.hass?.user?.is_admin === true;
    if (this._owner && (owner !== this._owner || identity !== this._userIdentity || !observing)) {
      this._release?.();
      this._release = undefined;
      this._owner = undefined;
      this._acceptRuntime(EMPTY_RUNTIME);
    }
    if (observing && !this._owner) {
      this._owner = owner;
      this._userIdentity = identity;
      this._acceptRuntime(zigbeeTopologyRuntimeSnapshot(this.hass));
      this._release = subscribeZigbeeTopology(this.hass, () => {
        this._acceptRuntime(zigbeeTopologyRuntimeSnapshot(this.hass));
      });
    }
    const markerInputsChanged = changed.has('currentSpace')
      || changed.has('devices') || changed.has('registry');
    if (markerInputsChanged) {
      this._mappedMemo = undefined;
      if (!this.devices.some((item) => item.id === this._hovered && item.space === this.currentSpace)) {
        this._clear();
      }
    }
    this._connectParent();
    if (this._endpointSetDirty || markerInputsChanged) this._syncEndpointOwnership();
    this.toggleAttribute('data-tooltip-owner', !!this._hovered);
    if (this._hovered) this.setAttribute('data-tooltip-owner', this._hovered);
    this._scheduleLayout();
    if (!this._hovered) this.onLayout?.();
  }

  private _stopLayout(): void {
    cancelAnimationFrame(this._layoutFrame);
    this._layoutFrame = 0;
    this._layoutResize?.disconnect();
    this._layoutResize = undefined;
    window.removeEventListener('resize', this._scheduleLayout);
    window.removeEventListener('scroll', this._scheduleLayout, true);
  }

  private _scheduleLayout = (): void => {
    if (!this.isConnected || !this._hovered) return;
    if (!this._layoutResize && typeof ResizeObserver !== 'undefined') {
      this._layoutResize = new ResizeObserver(this._scheduleLayout);
      this._layoutResize.observe(this);
      const stage = (this.getRootNode() as ShadowRoot).querySelector('.stage');
      if (stage) this._layoutResize.observe(stage);
      window.addEventListener('resize', this._scheduleLayout);
      window.addEventListener('scroll', this._scheduleLayout, true);
    }
    if (this._layoutFrame) return;
    this._layoutFrame = requestAnimationFrame(() => {
      this._layoutFrame = 0;
      if (!this.isConnected || !this._hovered) return;
      this._clipRouteCopies();
      this._fitParentCaptions();
      this.onLayout?.();
    });
  };

  /** DOM-only layout, not a card render or network refresh. */
  private _fitParentCaptions(): void {
    const stage = (this.getRootNode() as ShadowRoot).querySelector('.stage')?.getBoundingClientRect();
    if (!stage) return;
    const layer = this.getBoundingClientRect();
    const scaleX = this.clientWidth ? layer.width / this.clientWidth : 1;
    const scaleY = this.clientHeight ? layer.height / this.clientHeight : 1;
    if (scaleX <= 0 || scaleY <= 0) return;
    const left = Math.max(0, stage.left) + 8;
    const right = Math.min(window.innerWidth, stage.right) - 8;
    const top = Math.max(0, stage.top) + 8;
    const bottom = Math.min(window.innerHeight, stage.bottom) - 8;
    const marker = this._marker(this._hovered)?.getBoundingClientRect();
    const blockers: TipRect[] = [...this.renderRoot.querySelectorAll<HTMLElement>('.remote,.route-status')]
      .map((node) => node.getBoundingClientRect());
    if (marker) blockers.push(marker);
    for (const caption of this.renderRoot.querySelectorAll<HTMLElement>('.parent-bubble')) {
      caption.style.marginLeft = '0px';
      caption.style.marginTop = '0px';
      caption.style.maxWidth = `${Math.max(1, Math.min(300, (right - left) / scaleX))}px`;
      let rect = caption.getBoundingClientRect();
      const placement = () => placeDeviceTooltip({
        preferred: { x: rect.left, y: rect.top },
        size: rect, bounds: { left, top, right, bottom, width: right - left, height: bottom - top },
        blockers, edge: 0, gap: 8,
      });
      let position = placement();
      if (!position && right > left) {
        caption.style.maxWidth = `${(right - left) / scaleX}px`;
        rect = caption.getBoundingClientRect();
        position = placement();
      }
      const dx = (position?.left ?? Math.max(left, Math.min(rect.left, right - rect.width))) - rect.left;
      const dy = (position?.top ?? Math.max(top, Math.min(rect.top, bottom - rect.height))) - rect.top;
      caption.style.marginLeft = `${dx / scaleX}px`;
      caption.style.marginTop = `${dy / scaleY}px`;
      blockers.push({ left: rect.left + dx, right: rect.right + dx,
        top: rect.top + dy, bottom: rect.bottom + dy, width: rect.width, height: rect.height });
      // Keep the short outgoing arrow attached to the nearest label edge after
      // a long caption wraps/shifts at the stage boundary.
      const line = this.renderRoot.querySelector<SVGLineElement>(
        `[data-parent-index="${caption.dataset.parentIndex}"][data-hp="zigbee-topology-parent-line"]`,
      );
      if (!line) continue;
      const origin = { x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) };
      const screenOrigin = { x: layer.left + origin.x * scaleX, y: layer.top + origin.y * scaleY };
      const point = {
        x: (Math.max(rect.left + dx, Math.min(screenOrigin.x, rect.right + dx)) - layer.left) / scaleX,
        y: (Math.max(rect.top + dy, Math.min(screenOrigin.y, rect.bottom + dy)) - layer.top) / scaleY,
      };
      for (const part of this.renderRoot.querySelectorAll<SVGLineElement>(
        `line[data-parent-index="${caption.dataset.parentIndex}"]`,
      )) { part.setAttribute('x2', String(point.x)); part.setAttribute('y2', String(point.y)); }
      const arrow = zigbeeArrowGeometry(origin, point,
        marker ? Math.max(marker.width, marker.height) * .61 + 3 : 0, 0, 'toward-neighbor');
      for (const polygon of this.renderRoot.querySelectorAll<SVGPolygonElement>(
        `polygon[data-parent-index="${caption.dataset.parentIndex}"]`,
      )) polygon.setAttribute('points', arrow ? this._points(arrow.points) : '');
    }
  }

  /** #808/#829: routes paint over the passive battery and the value badge of
   *  their own endpoints too. An endpoint marker rises above the route layer
   *  as a whole (#464), so the route copy one level higher is clipped to those
   *  frames only; cores and captions keep their order (#792 AC7). A battery
   *  frame keeps 2px for its drop shadow; a badge gets none, since only the
   *  flex gap (0.1 of the core) separates it from the core. DOM-only, inside
   *  the existing layout frame. */
  private _clipRouteCopies(): void {
    const clip = this.renderRoot.querySelector<SVGClipPathElement>('#hp-zigbee-route-clip');
    if (!clip) return;
    const layer = this.getBoundingClientRect();
    const scaleX = this.clientWidth ? layer.width / this.clientWidth : 1;
    const scaleY = this.clientHeight ? layer.height / this.clientHeight : 1;
    const boxes = scaleX > 0 && scaleY > 0 ? [...this._endpointElements]
      .flatMap((marker) => [...marker.querySelectorAll('.device-battery, .value-badge')])
      .map((node) => ({ rect: node.getBoundingClientRect(), pad: node.classList.contains('value-badge') ? 0 : 2 }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .map(({ rect, pad }) => [(rect.left - layer.left) / scaleX - pad, (rect.top - layer.top) / scaleY - pad,
        rect.width / scaleX + 2 * pad, rect.height / scaleY + 2 * pad].map((value) => value.toFixed(2))) : [];
    const key = boxes.join(';');
    if (clip.dataset.boxes === key) return;
    clip.dataset.boxes = key;
    clip.replaceChildren(...boxes.map(([x, y, width, height]) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [name, value] of Object.entries({ x, y, width, height })) rect.setAttribute(name, value);
      return rect;
    }));
  }

  private _acceptRuntime(next: ZigbeeTopologyRuntimeSnapshot): void {
    if (next.revision === this._runtime.revision
        && next.topologies === this._runtime.topologies && next.states === this._runtime.states) return;
    this._setDesiredEndpointIds([]);
    this._clearEndpointOwnership();
    this._endpointSetDirty = false;
    this._runtime = next;
    this._mappedMemo = undefined;
    this._scheduleStaleUpdate();
    this.requestUpdate();
  }

  // Age changes without a new HA event; redraw once at expiry, never fetch.
  private _scheduleStaleUpdate(): void {
    clearTimeout(this._staleTimer);
    if (!this.isConnected || this.hass?.user?.is_admin !== true) return;
    const now = Date.now();
    const expiry = this._runtime.topologies.map((item) => item.obtainedAt + TOPOLOGY_STALE_MS + 1)
      .filter((value) => value > now);
    if (expiry.length) this._staleTimer = setTimeout(() => {
      if (!this.isConnected) return;
      this.requestUpdate();
      this._scheduleStaleUpdate();
    }, Math.min(...expiry) - now);
  }

  private _connectParent(): void {
    const parent = this.parentElement;
    if (!parent || parent === this._parent) return;
    this._disconnectParent();
    this._parent = parent;
    parent.addEventListener('pointerover', this._pointerOver);
    parent.addEventListener('pointerout', this._pointerOut);
    parent.addEventListener('pointerdown', this._pointerDown, true);
    if (typeof MutationObserver !== 'undefined') {
      this._markerObserver = new MutationObserver((records) => {
        if (records.some((record) => record.type === 'childList')) this._syncEndpointOwnership();
        if (records.some((record) => record.attributeName === 'data-hp-device-hover')) this._adoptPointerHover();
        this._scheduleLayout();
      });
      this._markerObserver.observe(parent, { childList: true, attributes: true, subtree: true,
        attributeFilter: ['style', 'data-hp-device-hover'] });
    }
    this._syncEndpointOwnership();
    this._adoptPointerHover();
  }

  private _adoptPointerHover(): void {
    const host = (this.getRootNode() as ShadowRoot).host;
    const id = host?.hasAttribute('data-pointer-hover')
      ? this._parent?.querySelector<HTMLElement>('[data-hp-device-hover]')?.dataset.id || '' : '';
    if (id === this._hovered) return;
    if (!id) { this._clear(); return; }
    this._hovered = id;
    this.requestUpdate();
  }

  private _disconnectParent(): void {
    this._parent?.removeEventListener('pointerover', this._pointerOver);
    this._parent?.removeEventListener('pointerout', this._pointerOut);
    this._parent?.removeEventListener('pointerdown', this._pointerDown, true);
    this._markerObserver?.disconnect();
    this._markerObserver = undefined;
    this._clearEndpointOwnership();
    this._parent = undefined;
  }

  private _deviceFromEvent(event: Event): HTMLElement | null {
    for (const value of event.composedPath()) {
      if (value instanceof HTMLElement && value.dataset.hp === 'device') return value;
    }
    return null;
  }

  private _mouseAllowed(event: PointerEvent): boolean {
    const root = this.getRootNode() as ShadowRoot;
    return event.pointerType === 'mouse' && root.host?.hasAttribute?.('data-pointer-hover');
  }

  private _pointerOver = (event: PointerEvent): void => {
    if (!this._mouseAllowed(event)) { this._clear(); return; }
    const device = this._deviceFromEvent(event);
    const id = device?.dataset.id || '';
    if (id && id !== this._hovered) { this._hovered = id; this.requestUpdate(); }
  };

  private _pointerOut = (event: PointerEvent): void => {
    const from = this._deviceFromEvent(event);
    if (!from || from.dataset.id !== this._hovered) return;
    const related = event.relatedTarget instanceof Element
      ? event.relatedTarget.closest<HTMLElement>('[data-hp="device"]') : null;
    if (related?.dataset.id === this._hovered) return;
    this._clear();
  };

  private _pointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') this._clear();
  };

  private _clear(): void {
    this.removeAttribute('data-tooltip-owner');
    this._stopLayout();
    this._setDesiredEndpointIds([]);
    this._clearEndpointOwnership();
    this._endpointSetDirty = false;
    if (!this._hovered) return;
    this._hovered = '';
    this.requestUpdate();
  }

  private _setDesiredEndpointIds(ids: Iterable<string>): void {
    const next = new Set(ids);
    if (next.size === this._desiredEndpointIds.size
        && [...next].every((id) => this._desiredEndpointIds.has(id))) return;
    this._desiredEndpointIds = next;
    this._endpointSetDirty = true;
  }

  private _marker(id: string): HTMLElement | null {
    return [...(this._parent?.querySelectorAll<HTMLElement>('.dev[data-hp="device"][data-id]') || [])]
      .find((item) => item.dataset.id === id) || null;
  }

  private _clearEndpointOwnership(): void {
    for (const marker of this._endpointElements) marker.removeAttribute(ENDPOINT_ATTRIBUTE);
    for (const marker of this._parent?.querySelectorAll<HTMLElement>(`[${ENDPOINT_ATTRIBUTE}]`) || []) {
      marker.removeAttribute(ENDPOINT_ATTRIBUTE);
    }
    this._endpointElements.clear();
  }

  private _syncEndpointOwnership(): void {
    const next = new Set<HTMLElement>();
    for (const id of this._desiredEndpointIds) {
      const marker = this._marker(id);
      if (marker) next.add(marker);
    }
    for (const marker of this._endpointElements) {
      if (!next.has(marker)) marker.removeAttribute(ENDPOINT_ATTRIBUTE);
    }
    for (const marker of this._parent?.querySelectorAll<HTMLElement>(`[${ENDPOINT_ATTRIBUTE}]`) || []) {
      if (!next.has(marker)) marker.removeAttribute(ENDPOINT_ATTRIBUTE);
    }
    for (const marker of next) {
      if (!this._endpointElements.has(marker) || !marker.hasAttribute(ENDPOINT_ATTRIBUTE)) {
        marker.setAttribute(ENDPOINT_ATTRIBUTE, '');
      }
    }
    this._endpointElements = next;
    this._endpointSetDirty = false;
  }

  private _position(id: string, width: number, height: number): MarkerPosition | null {
    const marker = this._marker(id);
    if (!marker) return null;
    const x = Number.parseFloat(marker.style.left);
    const y = Number.parseFloat(marker.style.top);
    const rect = marker.getBoundingClientRect();
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x: x * width / 100, y: y * height / 100, width: rect.width, height: rect.height } : null;
  }

  private _targetText(target: ZigbeeParentTarget): string {
    if (target.kind === 'remote-space') {
      const title = this.spaces?.find((space) => space.id === target.spaceId)?.title;
      const space = (typeof title === 'string' && title.trim())
        || topologyT(langOf(this.hass), 'route_other_space');
      return target.deviceName?.trim()
        ? topologyT(langOf(this.hass), 'route_other_space_named', { space, name: target.deviceName.trim() })
        : space;
    }
    if (target.kind === 'unplaced-coordinator') return topologyT(langOf(this.hass), 'route_coordinator_not_on_plan');
    return target.deviceName
      ? topologyT(langOf(this.hass), 'route_device_not_on_plan_named', { name: target.deviceName })
      : topologyT(langOf(this.hass), 'route_device_not_on_plan');
  }

  private _markerClearance(position: MarkerPosition): number {
    return Math.max(position.width, position.height) * 0.61 + 3;
  }

  private _points(points: readonly ZigbeePixelPoint[]): string {
    return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  }

  private _route(origin: ZigbeePixelPoint, point: ZigbeePixelPoint, lqi: number | undefined,
    direction: 'toward-neighbor' | 'toward-origin',
    arrow: ReturnType<typeof zigbeeArrowGeometry>, parent = false, parentIndex?: number, copy = false) {
    const color = zigbeeLinkColor(lqi);
    const outline = Number.isFinite(this.zoom) && this.zoom > 0 ? this.zoom : 1;
    return svg`${lqi === undefined ? svg`<line class="link-casing" data-hp=${copy ? nothing : 'zigbee-topology-line-casing'}
      data-parent-index=${parentIndex ?? nothing} x1=${origin.x} y1=${origin.y} x2=${point.x} y2=${point.y}
      stroke="#000000" stroke-width=${2 + 2 * outline} data-direction=${direction}></line>` : nothing}
      <line class=${parent ? 'parent-route' : 'link-core'}
        data-hp=${copy ? nothing : parent ? 'zigbee-topology-parent-line' : 'zigbee-topology-line'}
        data-parent-index=${parentIndex ?? nothing} x1=${origin.x} y1=${origin.y} x2=${point.x} y2=${point.y}
        stroke=${color} stroke-width=${lqi === undefined ? 2 : 2.2} data-direction=${direction}></line>
      ${arrow ? svg`<polygon class="route-arrow"
        data-hp=${copy ? nothing : parent ? 'zigbee-topology-parent-arrow' : 'zigbee-topology-arrow'}
        data-parent-index=${parentIndex ?? nothing} data-direction=${direction} points=${this._points(arrow.points)} fill=${color}
        stroke=${lqi === undefined ? '#000000' : nothing} stroke-width=${lqi === undefined ? 2 * outline : nothing}
        stroke-linejoin="round" paint-order="stroke fill"></polygon>` : nothing}`;
  }

  protected render() {
    // #627: the ru/de/fr topology strings are a lazy chunk. Request it once on
    // mount — before the first hover can paint a label — and draw nothing
    // until it settled (ready or bounded English fallback).
    const lang = langOf(this.hass);
    if (TOPOLOGY_LANGUAGE_RUNTIME.state(lang) === 'pending') {
      void TOPOLOGY_LANGUAGE_RUNTIME.ensure(lang).then(() => {
        if (this.isConnected) this.requestUpdate();
      });
      this._setDesiredEndpointIds([]);
      return nothing;
    }
    if (this.hass?.user?.is_admin !== true || !this._hovered || !this.registry || !this._runtime.topologies.length) {
      this._setDesiredEndpointIds([]);
      return nothing;
    }
    const memo = this._mappedMemo;
    const mapped = memo && memo.runtime === this._runtime && memo.devices === this.devices
      && memo.registry === this.registry ? memo.mapped : mapTopologies(this._runtime.topologies, this.devices, this.registry);
    if (!memo || mapped !== memo.mapped) this._mappedMemo = { runtime: this._runtime, devices: this.devices, registry: this.registry, mapped };
    const hover = resolveMappedTopologyHover(mapped, this.currentSpace, this._hovered);
    const width = this.clientWidth || this._parent?.clientWidth || 1;
    const height = this.clientHeight || this._parent?.clientHeight || 1;
    const origin = this._position(this._hovered, width, height);
    if (!origin) {
      this._setDesiredEndpointIds([]);
      return nothing;
    }
    const lines = hover.lines.map((line) => ({
      ...line,
      point: this._position(line.neighborMarkerId, width, height),
    })).filter((line) => !!line.point).map((line) => {
      const arrow = line.routeDirection ? zigbeeArrowGeometry(
        origin, line.point!, this._markerClearance(origin), this._markerClearance(line.point!),
        line.routeDirection,
      ) : null;
      return { ...line, arrow };
    });
    const placeLeft = origin.x > width / 2;
    const bubbleGap = this._markerClearance(origin) + 18;
    const bubbles = hover.parentTargets.map((target, index) => {
      const offset = (index - (hover.parentTargets.length - 1) / 2) * 30;
      const point = {
        x: origin.x + (placeLeft ? -bubbleGap : bubbleGap),
        y: Math.max(14, Math.min(height - 14, origin.y + offset)),
      };
      return { target, point, arrow: zigbeeArrowGeometry(
        origin, point, this._markerClearance(origin), 0, 'toward-neighbor',
      ) };
    });
    const involved = mapped.filter((item) => [...item.placements.values()]
      .some((placement) => placement.markerId === this._hovered && placement.space === this.currentSpace));
    const providerStates = involved.map(({ topology }) => {
      const key = topology.provider === 'zha' ? 'zha' : `z2m:${topology.instanceId}`;
      return this._runtime.states[key];
    });
    const stale = providerStates.some((state) => state?.stale)
      || involved.some(({ topology }) => Date.now() - topology.obtainedAt > TOPOLOGY_STALE_MS);
    const status = [
      hover.outgoing === 'unknown' ? topologyT(lang, 'route_unknown') : '',
      providerStates.some((state) => state?.phase === 'error') ? topologyT(lang, 'error_provider') : '',
      providerStates.some((state) => state?.phase === 'loading') ? topologyT(lang, 'status_loading') : '',
      hover.outgoing !== 'not-zigbee' && stale ? topologyT(lang, 'route_stale') : '',
      hover.showIncomplete ? topologyT(lang, 'route_partial') : '',
    ].filter(Boolean).join(' · ');
    this._setDesiredEndpointIds(lines.length || bubbles.length || hover.remoteCount
      ? [
        this._hovered,
        ...lines.map((line) => line.neighborMarkerId),
      ] : []);
    const routes = (copy: boolean) => [
      ...lines.map((line) => this._route(origin, line.point!, line.lqi, line.routeDirection, line.arrow,
        false, undefined, copy)),
      ...bubbles.map((bubble, index) => this._route(origin, bubble.point, bubble.target.lqi, 'toward-neighbor',
        bubble.arrow, true, index, copy)),
    ];
    return html`
      ${lines.length || bubbles.length ? svg`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">${routes(false)}</svg>
      <svg class="over-battery" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines-over-battery">
        <clipPath id="hp-zigbee-route-clip"></clipPath>
        <g clip-path="url(#hp-zigbee-route-clip)">${routes(true)}</g>
      </svg>` : nothing}
      ${lines.map((line) => html`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${line.neighborMarkerId} style="left:${line.point!.x}px;top:${line.point!.y}px;width:${line.point!.width * 1.22}px;height:${line.point!.height * 1.22}px"></div>`)}
      ${bubbles.map((bubble, index) => html`<div class="parent-bubble ${placeLeft ? 'left' : 'right'}"
        data-parent-index=${index} data-hp="zigbee-topology-parent-bubble" data-kind=${bubble.target.kind}
        style="left:${bubble.point.x}px;top:${bubble.point.y}px">${this._targetText(bubble.target)}</div>`)}
      ${hover.remoteCount ? html`<div class="remote" data-hp="zigbee-topology-remote"
        style="left:${origin.x}px;top:${origin.y}px">${topologyT(
          langOf(this.hass), 'remote_count', { n: hover.remoteCount },
        )}</div>` : nothing}
      ${status ? html`<div class="route-status" data-hp="zigbee-topology-status" data-outgoing=${hover.outgoing}
        style="left:${origin.x}px;top:${origin.y + this._markerClearance(origin)}px">${status}</div>` : nothing}
    `;
  }
}

if (!customElements.get('hp-zigbee-topology-overlay')) {
  customElements.define('hp-zigbee-topology-overlay', HpZigbeeTopologyOverlay);
}
