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
  };

  hass!: ZigbeeTopologyHass;
  devices: readonly DevItem[] = [];
  registry!: HaRegistrySnapshot;
  currentSpace = '';
  spaces?: readonly { id?: unknown; title?: unknown }[];
  viewKey: unknown;
  zoom = 1;
  private _runtime = EMPTY_RUNTIME;
  private _hovered = '';
  private _staleTimer?: ReturnType<typeof setTimeout>;
  private _release?: () => void;
  private _owner?: object;
  private _userIdentity = '';
  private _parent?: HTMLElement;
  private _hoverGateObserver?: MutationObserver;
  private _markerObserver?: MutationObserver;
  private _desiredEndpointIds = new Set<string>();
  private _endpointSetDirty = false;
  private _endpointElements = new Set<HTMLElement>();
  private _mappedMemo?: { runtime: ZigbeeTopologyRuntimeSnapshot; devices: readonly DevItem[];
    registry: HaRegistrySnapshot; mapped: ZigbeeMappedTopology[] };

  static styles = css`
    :host { position: absolute; inset: 0; z-index: 7; display: block; pointer-events: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    line { vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .route-arrow { vector-effect: non-scaling-stroke; }
    svg, line, polygon, .halo, .remote, .parent-bubble, .route-status { pointer-events: none; }
    .halo {
      position: absolute; width: calc(var(--device-base-size, 4cqw) * 1.22);
      height: calc(var(--device-base-size, 4cqw) * 1.22); transform: translate(-50%, -50%);
      box-sizing: border-box; border: 2px solid rgba(120, 190, 220, .82); border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(120, 190, 220, .16);
    }
    .remote, .parent-bubble, .route-status {
      position: absolute; transform: translate(12px, calc(-100% - 12px));
      border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
      padding: 3px 7px; color: #fff; background: rgba(28,31,36,.88);
      box-shadow: 0 2px 7px rgba(0,0,0,.28); white-space: nowrap;
      font: 600 11px/1.2 system-ui, sans-serif;
    }
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
      this._markerObserver = new MutationObserver(() => this._syncEndpointOwnership());
      this._markerObserver.observe(parent, { childList: true });
    }
    this._syncEndpointOwnership();
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
      return (typeof title === 'string' && title.trim())
        || topologyT(langOf(this.hass), 'route_other_space');
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
    arrow: ReturnType<typeof zigbeeArrowGeometry>, parent = false) {
    const color = zigbeeLinkColor(lqi);
    const outline = Number.isFinite(this.zoom) && this.zoom > 0 ? this.zoom : 1;
    return svg`${lqi === undefined ? svg`<line class="link-casing" data-hp="zigbee-topology-line-casing"
      x1=${origin.x} y1=${origin.y} x2=${point.x} y2=${point.y}
      stroke="#000000" stroke-width=${2 + 2 * outline} data-direction=${direction}></line>` : nothing}
      <line class=${parent ? 'parent-route' : 'link-core'}
        data-hp=${parent ? 'zigbee-topology-parent-line' : 'zigbee-topology-line'}
        x1=${origin.x} y1=${origin.y} x2=${point.x} y2=${point.y}
        stroke=${color} stroke-width=${lqi === undefined ? 2 : 2.2} data-direction=${direction}></line>
      ${arrow ? svg`<polygon class="route-arrow"
        data-hp=${parent ? 'zigbee-topology-parent-arrow' : 'zigbee-topology-arrow'}
        data-direction=${direction} points=${this._points(arrow.points)} fill=${color}
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
      hover.outgoing !== 'not-zigbee' && hover.partial ? topologyT(lang, 'route_partial') : '',
    ].filter(Boolean).join(' · ');
    this._setDesiredEndpointIds(lines.length || bubbles.length || hover.remoteCount
      ? [
        this._hovered,
        ...lines.map((line) => line.neighborMarkerId),
      ] : []);
    return html`
      ${lines.length || bubbles.length ? svg`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${lines.map((line) => this._route(origin, line.point!, line.lqi, line.routeDirection, line.arrow))}
        ${bubbles.map((bubble) => this._route(origin, bubble.point, bubble.target.lqi, 'toward-neighbor', bubble.arrow, true))}
      </svg>` : nothing}
      ${lines.map((line) => html`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${line.neighborMarkerId} style="left:${line.point!.x}px;top:${line.point!.y}px;width:${line.point!.width * 1.22}px;height:${line.point!.height * 1.22}px"></div>`)}
      ${bubbles.map((bubble) => html`<div class="parent-bubble ${placeLeft ? 'left' : 'right'}"
        data-hp="zigbee-topology-parent-bubble" data-kind=${bubble.target.kind}
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
