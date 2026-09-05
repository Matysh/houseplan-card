import { LitElement, css, html, svg, nothing, type PropertyValues } from 'lit';
import { langOf } from './i18n';
import { lqiColor } from './logic';
import { topologyT } from './i18n/topology';
import {
  mapTopologies, resolveMappedTopologyHover, type ZigbeeMappedTopology,
  type ZigbeeParentTarget,
} from './zigbee-topology';
import { zigbeeArrowGeometry, type ZigbeePixelPoint } from './zigbee-topology-geometry';
import {
  subscribeZigbeeTopology, zigbeeTopologyRuntimeSnapshot,
  type ZigbeeTopologyHass, type ZigbeeTopologyRuntimeSnapshot,
} from './zigbee-topology-runtime';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';

const EMPTY_RUNTIME: ZigbeeTopologyRuntimeSnapshot = { revision: 0, topologies: [], states: {} };
type MarkerPosition = ZigbeePixelPoint & { width: number; height: number };

export class HpZigbeeTopologyOverlay extends LitElement {
  static properties = {
    hass: { attribute: false },
    devices: { attribute: false },
    registry: { attribute: false },
    currentSpace: { type: String, attribute: 'current-space' },
    spaceTitles: { attribute: false },
    viewKey: { attribute: false },
  };

  hass!: ZigbeeTopologyHass;
  devices: readonly DevItem[] = [];
  registry!: HaRegistrySnapshot;
  currentSpace = '';
  spaceTitles: Readonly<Record<string, string>> = {};
  viewKey: unknown;
  private _runtime = EMPTY_RUNTIME;
  private _hovered = '';
  private _release?: () => void;
  private _parent?: HTMLElement;
  private _hoverGateObserver?: MutationObserver;
  private _mappedMemo?: { runtime: ZigbeeTopologyRuntimeSnapshot; devices: readonly DevItem[];
    registry: HaRegistrySnapshot; mapped: ZigbeeMappedTopology[] };

  static styles = css`
    :host { position: absolute; inset: 0; z-index: 5; display: block; pointer-events: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    line { vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .route-arrow { vector-effect: non-scaling-stroke; }
    .halo {
      position: absolute; width: calc(var(--device-base-size, 4cqw) * 1.22);
      height: calc(var(--device-base-size, 4cqw) * 1.22); transform: translate(-50%, -50%);
      box-sizing: border-box; border: 2px solid rgba(120, 190, 220, .82); border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(120, 190, 220, .16);
    }
    .remote, .parent-bubble {
      position: absolute; transform: translate(12px, calc(-100% - 12px));
      border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
      padding: 3px 7px; color: #fff; background: rgba(28,31,36,.88);
      box-shadow: 0 2px 7px rgba(0,0,0,.28); white-space: nowrap;
      font: 600 11px/1.2 system-ui, sans-serif;
    }
    .parent-bubble.right { transform: translate(0, -50%); }
    .parent-bubble.left { transform: translate(-100%, -50%); }
    @media (forced-colors: active) {
      line { stroke: Highlight !important; }
      .route-arrow { fill: Highlight !important; }
      .halo { border-color: Highlight; box-shadow: none; }
      .remote, .parent-bubble { color: CanvasText; background: Canvas; border-color: CanvasText; }
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
  }

  disconnectedCallback(): void {
    this._release?.();
    this._release = undefined;
    this._disconnectParent();
    this._hoverGateObserver?.disconnect();
    this._hoverGateObserver = undefined;
    this._hovered = '';
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('hass')) {
      this._release?.();
      this._runtime = zigbeeTopologyRuntimeSnapshot(this.hass);
      this._mappedMemo = undefined;
      this._release = subscribeZigbeeTopology(this.hass, () => {
        this._runtime = zigbeeTopologyRuntimeSnapshot(this.hass);
        this._mappedMemo = undefined;
        this.requestUpdate();
      });
    }
    if (changed.has('currentSpace') || changed.has('devices') || changed.has('registry')) {
      this._mappedMemo = undefined;
      if (!this.devices.some((item) => item.id === this._hovered && item.space === this.currentSpace)) {
        this._hovered = '';
      }
    }
  }

  private _connectParent(): void {
    const parent = this.parentElement;
    if (!parent || parent === this._parent) return;
    this._disconnectParent();
    this._parent = parent;
    parent.addEventListener('pointerover', this._pointerOver);
    parent.addEventListener('pointerout', this._pointerOut);
    parent.addEventListener('pointerdown', this._pointerDown, true);
  }

  private _disconnectParent(): void {
    this._parent?.removeEventListener('pointerover', this._pointerOver);
    this._parent?.removeEventListener('pointerout', this._pointerOut);
    this._parent?.removeEventListener('pointerdown', this._pointerDown, true);
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
    if (!this._hovered) return;
    this._hovered = '';
    this.requestUpdate();
  }

  private _position(id: string, width: number, height: number): MarkerPosition | null {
    const marker = [...(this._parent?.querySelectorAll<HTMLElement>('.dev[data-id]') || [])]
      .find((item) => item.dataset.id === id);
    if (!marker) return null;
    const x = Number.parseFloat(marker.style.left);
    const y = Number.parseFloat(marker.style.top);
    const rect = marker.getBoundingClientRect();
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x: x * width / 100, y: y * height / 100, width: rect.width, height: rect.height } : null;
  }

  private _targetText(target: ZigbeeParentTarget): string {
    if (target.kind === 'remote-space') {
      return this.spaceTitles[target.spaceId]?.trim()
        || topologyT(langOf(this.hass), 'route_other_space');
    }
    return topologyT(langOf(this.hass), target.kind === 'unplaced-coordinator'
      ? 'route_coordinator_not_on_plan' : 'route_device_not_on_plan');
  }

  private _markerClearance(position: MarkerPosition): number {
    return Math.max(position.width, position.height) * 0.61 + 3;
  }

  private _points(points: readonly ZigbeePixelPoint[]): string {
    return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  }

  protected render() {
    if (!this._hovered || !this.registry || !this._runtime.topologies.length) return nothing;
    const memo = this._mappedMemo;
    const mapped = memo && memo.runtime === this._runtime && memo.devices === this.devices
      && memo.registry === this.registry ? memo.mapped : mapTopologies(this._runtime.topologies, this.devices, this.registry);
    if (!memo || mapped !== memo.mapped) this._mappedMemo = { runtime: this._runtime, devices: this.devices, registry: this.registry, mapped };
    const hover = resolveMappedTopologyHover(mapped, this.currentSpace, this._hovered);
    const width = this.clientWidth || this._parent?.clientWidth || 1;
    const height = this.clientHeight || this._parent?.clientHeight || 1;
    const origin = this._position(this._hovered, width, height);
    if (!origin) return nothing;
    const lines = hover.lines.map((line) => ({
      ...line,
      point: this._position(line.neighborMarkerId, width, height),
    })).filter((line) => !!line.point).map((line) => {
      const color = line.lqi === undefined ? 'rgba(145,155,165,.85)' : lqiColor(line.lqi);
      const arrow = line.routeDirection ? zigbeeArrowGeometry(
        origin, line.point!, this._markerClearance(origin), this._markerClearance(line.point!),
        line.routeDirection,
      ) : null;
      return { ...line, color, arrow };
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
    return html`
      ${lines.length || bubbles.length ? svg`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${lines.map((line) => svg`<line x1=${origin.x} y1=${origin.y}
          x2=${line.point!.x} y2=${line.point!.y}
          stroke=${line.color} data-direction=${line.routeDirection || 'none'}
          stroke-width=${line.lqi === undefined ? 2 : 2.2}
          stroke-dasharray=${line.lqi === undefined ? '5 5' : nothing} opacity=".9"></line>
          ${line.arrow ? svg`<polygon class="route-arrow" data-hp="zigbee-topology-arrow"
            data-direction=${line.routeDirection} points=${this._points(line.arrow.points)}
            fill=${line.color}></polygon>` : nothing}`)}
        ${bubbles.map((bubble) => svg`<line class="parent-route" x1=${origin.x} y1=${origin.y}
          x2=${bubble.point.x} y2=${bubble.point.y} stroke="rgba(145,155,165,.92)"
          stroke-width="2" opacity=".9"></line>
          ${bubble.arrow ? svg`<polygon class="route-arrow" data-hp="zigbee-topology-parent-arrow"
            data-direction="toward-neighbor" points=${this._points(bubble.arrow.points)}
            fill="rgba(145,155,165,.92)"></polygon>` : nothing}`)}
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
    `;
  }
}

if (!customElements.get('hp-zigbee-topology-overlay')) {
  customElements.define('hp-zigbee-topology-overlay', HpZigbeeTopologyOverlay);
}
