import { LitElement, css, html, svg, nothing, type PropertyValues } from 'lit';
import { langOf } from './i18n';
import { lqiColor } from './logic';
import { topologyT } from './i18n/topology';
import {
  mapTopologies, resolveMappedTopologyHover, type ZigbeeHoverResolution, type ZigbeeMappedTopology,
} from './zigbee-topology';
import {
  subscribeZigbeeTopology, zigbeeTopologyRuntimeSnapshot,
  type ZigbeeTopologyHass, type ZigbeeTopologyRuntimeSnapshot,
} from './zigbee-topology-runtime';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';

const EMPTY_RUNTIME: ZigbeeTopologyRuntimeSnapshot = { revision: 0, topologies: [], states: {} };
const EMPTY_HOVER: ZigbeeHoverResolution = { lines: [], remoteCount: 0, omittedCount: 0 };

export class HpZigbeeTopologyOverlay extends LitElement {
  static properties = {
    hass: { attribute: false },
    devices: { attribute: false },
    registry: { attribute: false },
    currentSpace: { type: String, attribute: 'current-space' },
    viewKey: { attribute: false },
  };

  hass!: ZigbeeTopologyHass;
  devices: readonly DevItem[] = [];
  registry!: HaRegistrySnapshot;
  currentSpace = '';
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
    .halo {
      position: absolute; width: calc(var(--device-base-size, 4cqw) * 1.22);
      height: calc(var(--device-base-size, 4cqw) * 1.22); transform: translate(-50%, -50%);
      box-sizing: border-box; border: 2px solid rgba(120, 190, 220, .82); border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(120, 190, 220, .16);
    }
    .remote {
      position: absolute; transform: translate(12px, calc(-100% - 12px));
      border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
      padding: 3px 7px; color: #fff; background: rgba(28,31,36,.88);
      box-shadow: 0 2px 7px rgba(0,0,0,.28); white-space: nowrap;
      font: 600 11px/1.2 system-ui, sans-serif;
    }
    @media (forced-colors: active) {
      line { stroke: Highlight !important; }
      .halo { border-color: Highlight; box-shadow: none; }
      .remote { color: CanvasText; background: Canvas; border-color: CanvasText; }
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

  private _position(id: string): { x: number; y: number; width: number; height: number } | null {
    const marker = [...(this._parent?.querySelectorAll<HTMLElement>('.dev[data-id]') || [])]
      .find((item) => item.dataset.id === id);
    if (!marker) return null;
    const x = Number.parseFloat(marker.style.left);
    const y = Number.parseFloat(marker.style.top);
    const rect = marker.getBoundingClientRect();
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x, y, width: rect.width, height: rect.height } : null;
  }

  protected render() {
    if (!this._hovered || !this.registry || !this._runtime.topologies.length) return nothing;
    const memo = this._mappedMemo;
    const mapped = memo && memo.runtime === this._runtime && memo.devices === this.devices
      && memo.registry === this.registry ? memo.mapped : mapTopologies(this._runtime.topologies, this.devices, this.registry);
    if (!memo || mapped !== memo.mapped) this._mappedMemo = { runtime: this._runtime, devices: this.devices, registry: this.registry, mapped };
    const hover = resolveMappedTopologyHover(mapped, this.currentSpace, this._hovered);
    const origin = this._position(this._hovered);
    if (!origin) return nothing;
    const lines = hover.lines.map((line) => ({ ...line, point: this._position(line.neighborMarkerId) }))
      .filter((line) => !!line.point);
    return html`
      ${lines.length ? svg`<svg viewBox="0 0 100 100" preserveAspectRatio="none"
        aria-hidden="true" data-hp="zigbee-topology-lines">
        ${lines.map((line) => svg`<line x1=${origin.x} y1=${origin.y}
          x2=${line.point!.x} y2=${line.point!.y}
          stroke=${line.lqi === undefined ? 'rgba(145,155,165,.85)' : lqiColor(line.lqi)}
          stroke-width=${line.lqi === undefined ? 2 : 2.2}
          stroke-dasharray=${line.lqi === undefined ? '5 5' : nothing} opacity=".9"></line>`)}
      </svg>` : nothing}
      ${lines.map((line) => html`<div class="halo" data-hp="zigbee-topology-neighbor"
        data-id=${line.neighborMarkerId} style="left:${line.point!.x}%;top:${line.point!.y}%;width:${line.point!.width * 1.22}px;height:${line.point!.height * 1.22}px"></div>`)}
      ${hover.remoteCount ? html`<div class="remote" data-hp="zigbee-topology-remote"
        style="left:${origin.x}%;top:${origin.y}%">${topologyT(
          langOf(this.hass), 'remote_count', { n: hover.remoteCount },
        )}</div>` : nothing}
    `;
  }
}

if (!customElements.get('hp-zigbee-topology-overlay')) {
  customElements.define('hp-zigbee-topology-overlay', HpZigbeeTopologyOverlay);
}
