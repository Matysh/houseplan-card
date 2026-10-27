/** Optional #1000 View feature. No subscriptions, writes, editor or dictionaries. */
import { ConfirmedMarkerAlerts, type AlertClock, type AlertObservation, type ConfirmedMarkerAlert } from './marker-alert-runtime';
import { normalizeMarkerAlerts, type MarkerThresholdAlert } from './marker-alert';
import { readMarkerAlertSource, type MarkerAlertHass } from './marker-alert-source';
import { displayIsNeutral, normalizeDeviceDisplay } from './logic';
import type { ConfigWriteContext } from './config-write-context';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem, Marker } from './types';
import { thresholdIssues } from './marker-alert-presentation';
import { langOf } from './i18n';

export const MARKER_ALERT_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const EMPTY: readonly ConfirmedMarkerAlert[] = Object.freeze([]);
interface AlertProjectionHost {
  readonly isConnected: boolean;
  readonly ownerDocument?: { visibilityState?: string };
  readonly _routeDepartureHandled?: boolean;
  readonly _space?: string;
  readonly _mode?: string;
  readonly _showAll?: boolean;
  readonly hass: MarkerAlertHass & { callWS?: unknown; connection?: unknown; user?: { id?: string } };
  readonly _planHass: MarkerAlertHass;
  readonly _fullRegistryHass: MarkerAlertHass;
  readonly _haRegistry?: HaRegistrySnapshot;
  readonly _configWriteContext: Pick<ConfigWriteContext, 'claim' | 'current'>;
  readonly _connectionWasLost: boolean;
  readonly _config: { live_states?: boolean; language?: string } | null | undefined;
  readonly _markers: readonly Marker[];
  readonly _devices: readonly DevItem[];
  readonly _displayDevices?: readonly DevItem[];
  _capturedSeq: number;
  requestUpdate(): unknown;
}

/** Confirmation belongs to one card/HA generation and each exact stored rule. */
export class MarkerAlertViewRuntime {
  private readonly host: AlertProjectionHost;
  private readonly confirmations: ConfirmedMarkerAlerts;
  private connected = false;
  private owner: object | null = null;
  private owners = new Map<string, string>();
  private frames = new Map<string, readonly ConfirmedMarkerAlert[]>();
  version = 0;

  constructor(host: object, clock?: AlertClock) {
    this.host = host as AlertProjectionHost;
    this.confirmations = new ConfirmedMarkerAlerts(() => this.changed(), clock);
  }

  connect(): void {
    this.connected = true; this.reconcile(); this.host._capturedSeq = -1;
    if (this.hasDemand()) this.host.requestUpdate();
  }
  disconnect(): void {
    this.connected = false; this.owners.clear();
    this.confirmations.update(this.host._configWriteContext.claim(), [], false);
  }

  private permitted(owner: object): boolean {
    const host = this.host;
    return this.connected && host.isConnected && !host._connectionWasLost
      && host._config?.live_states !== false && host._configWriteContext.current(owner, host.hass);
  }

  private demanded(device: DevItem): boolean {
    const host = this.host;
    if (host.ownerDocument?.visibilityState === 'hidden' || host._routeDepartureHandled) return false;
    const displayed = host._displayDevices?.find(item => item.id === device.id) || device;
    return (host._space === undefined || displayed.space === host._space)
      && (!displayed.hidden || host._mode === 'devices' && host._showAll === true);
  }

  private hasDemand(): boolean { return this.host._devices.some(device => this.demanded(device)); }

  /** Checks live membership/configuration before any HA state is accessed. */
  private current(id: string, expected: MarkerThresholdAlert, identity: string): DevItem | null {
    if (!this.owner || !this.permitted(this.owner)) return null;
    const marker = this.host._markers.find(item => item.id === id);
    const device = this.host._devices.find(item => item.id === id);
    if (!marker || !device || marker.removed || device.marker?.removed
      || displayIsNeutral(normalizeDeviceDisplay(marker.display))
      || this.identity(device, marker) !== identity) return null;
    const registry = this.host._haRegistry;
    // The roster may intentionally lag while hidden. Recheck exact authority
    // without constructing the all-state active render projection or roster.
    if (registry?.authoritative) {
      const binding = marker.binding, entity = registry.entities[expected.entity_id];
      if (binding.startsWith('device:') && !registry.devices[binding.slice(7)]
        || entity?.device_id && !registry.devices[entity.device_id]
        || binding.startsWith('entity:') && !registry.entities[binding.slice(7)] && !this.host.hass.states?.[binding.slice(7)]) return null;
    }
    const rule = normalizeMarkerAlerts(marker.alert_sources)?.find(item => item.id === expected.id);
    return rule && JSON.stringify(rule) === JSON.stringify(expected) ? { ...device, marker } : null;
  }

  private identity(device: DevItem, marker: Marker): string {
    return JSON.stringify([marker.id, marker.binding, marker.space ?? device.space, marker.area, marker.room_id]);
  }

  reconcile(): void {
    const host = this.host, owner = host._configWriteContext.claim();
    this.owner = owner;
    const inputs: AlertObservation[] = [], owners = new Map<string, string>();
    if (this.permitted(owner)) for (const device of host._devices) {
      const marker = host._markers.find(item => item.id === device.id);
      if (!marker || marker.removed || displayIsNeutral(normalizeDeviceDisplay(marker.display))) continue;
      const rules = normalizeMarkerAlerts(marker.alert_sources);
      if (!rules?.length) continue;
      const identity = this.identity(device, marker);
      for (const rule of rules) {
        const key = JSON.stringify([marker.id, rule.id]); owners.set(key, marker.id);
        inputs.push({ key, identity, rule, demanded: this.demanded(device), read: () => {
          const current = this.current(marker.id, rule, identity);
          if (!current) return { permitted: false };
          const registry = host._haRegistry;
          // readMarkerAlertSource proves binding ownership and disabled state
          // before its one selected state/attribute read. No active-state map
          // or geometry projection is needed for this authoritative producer.
          // Ecovacs can publish scalar attributes through its coherent map
          // projection; keep that existing source contract instead of silently
          // reading a different raw field for a configured condition.
          if (registry?.entities[rule.entity_id]?.platform === 'ecovacs')
            return readMarkerAlertSource(host._planHass, host._fullRegistryHass, current, rule);
          return registry ? readMarkerAlertSource(host.hass,
            { ...host.hass, entities: registry.entities, devices: registry.devices }, current, rule)
            : readMarkerAlertSource(host._planHass, host._fullRegistryHass, current, rule);
        } });
      }
    }
    this.owners = owners;
    this.confirmations.update(owner, inputs, this.permitted(owner));
  }

  forDevice(id: string): readonly ConfirmedMarkerAlert[] {
    const rows = this.frames.get(id);
    return rows?.filter(row => this.current(id, row.rule, row.identity)) || EMPTY;
  }

  issuesForDevice(id: string) {
    return thresholdIssues(this.forDevice(id), langOf(this.host.hass, this.host._config?.language));
  }

  private changed(): void {
    const frames = new Map<string, ConfirmedMarkerAlert[]>();
    for (const row of this.confirmations.snapshot()) {
      const id = this.owners.get(row.key); if (!id) continue;
      const group = frames.get(id) || []; group.push(row); frames.set(id, group);
    }
    const changedVisible = this.host._devices.some(device => this.demanded(device)
      && JSON.stringify(this.frames.get(device.id) || []) !== JSON.stringify(frames.get(device.id) || []));
    this.frames = frames; this.version++;
    this.host._capturedSeq = -1;
    if (this.host.isConnected && changedVisible) this.host.requestUpdate();
  }
}
