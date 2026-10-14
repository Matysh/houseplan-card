/**
 * #850: the render-device snapshot of one HA frame, captured for the card.
 *
 * Moved out of `houseplan-card.ts` without a change of meaning, plus one seam:
 * the lazily loaded live runtime may lend a `RenderSnapshotReuse`. It records
 * which HA state rows each device's presentations read and, when a tick
 * changed nothing but some of those rows, rebuilds only the affected
 * presentations and keeps every unchanged row of the previous snapshot by
 * identity. Without it — before the live chunk lands, or never (#848) — every
 * capture is a complete rebuild, exactly as before.
 */
import { createDeviceBatteryContext } from './device-battery';
import { createDeviceSignalContext } from './device-signal';
import { deviceBatteryModeOf, showDeviceBatteryOf } from './device-battery-settings';
import {
  resolveDevicePresentation, type PresentationActivityRuntime, type ResolvePresentationOptions,
  type ResolvedDevicePresentation,
} from './device-presentation';
import { isRemovedPlanEntity, removedPlanBindings, resolvedLightSources } from './devices';
import { ledStripsByMarker } from './led-strip-gate';
import { liveText, liveTextReference, openingEntityReferences } from './logic';
import {
  createRenderDeviceSnapshot, presentationSnapshotKey, renderDeviceSnapshotPositions,
  type RenderDeviceSnapshot,
} from './render-device-snapshot';
import { readVacTelemetry } from './vacuum';
import { effectiveRoutes, observedMapIds, resolveRoute } from './vacuum-routes';
import type { VirtualLightSnapshot } from './virtual-light-state';
import type { DevItem, Marker, SpaceModel } from './types';

/** The card members a capture reads; the card passes itself. */
export interface RenderSnapshotHost {
  hass: any; // any-ok: the HA object as the card received it
  _planHass: any; // any-ok: active-registry projection of the card
  _fullRegistryHass: any; // any-ok: full-registry projection of the card
  _hassSequence: number;
  _cfgEpoch: number;
  _devices: readonly DevItem[];
  _layout: unknown;
  _settings: any; // any-ok: the installation settings record of the card
  _config: { live_states?: boolean; show_temperature?: boolean } | null | undefined;
  _model: readonly SpaceModel[];
  _serverCfg: { spaces?: readonly any[]; settings?: unknown } | null; // any-ok: raw stored spaces
  _markers: readonly Marker[];
  _summary?: { entityIds(): Iterable<string> } | null;
  _vacFit?: { source?: string | null } | null;
  _virtualLights: VirtualLightSnapshot;
  _activityRt: ReadonlyMap<string, PresentationActivityRuntime>;
  _reducedMotion: boolean;
  _vacRt: ReadonlyMap<string, { material: unknown; lastTs: number; moving: boolean; jump: boolean }>;
  _vacSrvTrails: Record<string, unknown>;
  _isVacDev(device: DevItem): boolean;
  _vacSource(device: DevItem, planHass: any): string | null; // any-ok: card projection
  _vacObservedMapId(device: DevItem, source: string, planHass: any): string | undefined; // any-ok: card projection
  _vacMapId(device: DevItem, telemetry: any, planHass: any): string; // any-ok: card projection
  _livePos(device: DevItem): { x: number; y: number };
}

/** What a reuse window lends one capture. */
export interface RenderSnapshotWindow {
  /** The projections every presentation resolves against (their state reads are recorded). */
  hass: any; // any-ok: the card's HA projection
  registry: any; // any-ok: the card's full-registry projection
  /** Source object → its frozen clone, valid while the window stays open. */
  memo: WeakMap<object, unknown>;
  /** The previous snapshot when this capture changes only state rows, else null. */
  previous: RenderDeviceSnapshot | null;
}

/** The live runtime's incremental capture (render-snapshot-reuse.ts). */
export interface RenderSnapshotReuse {
  begin(host: RenderSnapshotHost, lightSources: unknown): RenderSnapshotWindow;
  present(id: string, showLqi: boolean, build: () => ResolvedDevicePresentation): ResolvedDevicePresentation;
  end(snapshot: RenderDeviceSnapshot): void;
}

/**
 * One presentation of a plan device: the snapshot and the card's own fallback
 * (no snapshot yet, the design preview) share these options, so they cannot
 * disagree. `options` adds what differs: battery, light graph, registry.
 */
export function presentDevice(
  host: Pick<RenderSnapshotHost, '_config' | '_activityRt' | '_reducedMotion'>,
  hass: any, device: DevItem, showLqi: boolean, // any-ok: the card's HA projection
  options: Omit<ResolvePresentationOptions, 'liveStates' | 'showTemperature' | 'showSignal'>,
): ResolvedDevicePresentation {
  return resolveDevicePresentation(hass, device, {
    liveStates: host._config?.live_states !== false,
    showTemperature: host._config?.show_temperature !== false,
    // A per-space show_lqi value is an explicit override of the card
    // default. Snapshot both projections exactly as requested so the
    // full card, preview and static card cannot disagree.
    showSignal: showLqi,
    activityRuntime: host._activityRt.get(device.id),
    sourceDetails: false,
    reducedMotion: host._reducedMotion,
    ...options,
  });
}

export function captureRenderDeviceSnapshot(
  host: RenderSnapshotHost, reuse?: RenderSnapshotReuse | null,
): RenderDeviceSnapshot {
  // One plan-wide light graph per capture; the reuse window keys on it.
  const planLightSources = resolvedLightSources(
    host._planHass, host._devices, null, host._virtualLights,
  );
  const window = reuse?.begin(host, planLightSources);
  const planHass = window?.hass || host._planHass;
  const registryHass = window?.registry || host._fullRegistryHass;
  const presentations = new Map<string, ResolvedDevicePresentation>();
  const showBattery = showDeviceBatteryOf(host._settings);
  const batteryLowOnly = deviceBatteryModeOf(host._settings) === 'low';
  const batteryContext = showBattery ? createDeviceBatteryContext(planHass, registryHass) : undefined;
  const signalContext = createDeviceSignalContext(planHass, registryHass);
  const ledMarkerIds = showBattery
    ? new Set(host._model.flatMap((space) => [...ledStripsByMarker(space).keys()])) : new Set<string>();
  const facts = new Map<string, unknown>();
  const entityIds = new Set<string>(['sun.sun']); for (const id of host._summary?.entityIds() || []) entityIds.add(id);
  if (host._vacFit?.source) entityIds.add(host._vacFit.source);
  const deviceIds = new Set<string>();
  const areaIds = new Set<string>();
  const addSource = (source: string | null | undefined): void => {
    if (!source) return;
    const separator = source.indexOf(':');
    if (separator < 0) { entityIds.add(source); return; }
    const kind = source.slice(0, separator), reference = source.slice(separator + 1);
    if (kind === 'device') deviceIds.add(reference);
    else if (kind === 'entity') entityIds.add(reference);
  };
  for (const space of host._model) for (const room of space.rooms) {
    if (room.area) areaIds.add(room.area);
    addSource(room.settings?.temp_source);
    addSource(room.settings?.hum_source);
  }
  for (const rawSpace of host._serverCfg?.spaces || []) for (const opening of rawSpace.openings || []) {
    for (const entityId of openingEntityReferences(opening)) entityIds.add(entityId);
  }
  // Inline HA variables on the decorative layer are part of the painted
  // frame too. Capture both the current token format and the legacy
  // one-entity fields so a reconnect cannot update a label ahead of the
  // rooms, devices and light layers around it.
  for (const rawSpace of host._serverCfg?.spaces || []) {
    for (const shape of rawSpace.decor || []) {
      if (shape.kind !== 'text') continue;
      for (const match of String(shape.text || '').matchAll(/\{([^{}\r\n]+)\}/g)) {
        const reference = liveTextReference(match[1]);
        if (reference?.entity) entityIds.add(reference.entity);
      }
      if (shape.entity) entityIds.add(shape.entity);
      // HA's formatter functions are runtime capabilities and must not cross
      // the immutable render-snapshot boundary. Freeze the already formatted
      // caption instead, so locale/precision/unit and every surrounding plan
      // layer belong to one atomic HA frame.
      facts.set(`decor:${rawSpace.id}:${shape.id}`, liveText(
        shape.text, shape, planHass,
        (entityId) => !!planHass.entities?.[entityId] && !!planHass.states?.[entityId]
          && !isRemovedPlanEntity(planHass, entityId, removedPlanBindings(host._markers)),
      ));
    }
  }
  for (const device of host._devices) {
    for (const showLqi of [false, true]) {
      const build = (): ResolvedDevicePresentation => presentDevice(host, planHass, device, showLqi, {
        showBattery: showBattery && !ledMarkerIds.has(device.id),
        batteryLowOnly,
        batteryContext,
        signalContext,
        lightDevices: host._devices,
        lightSources: planLightSources,
        registryHass,
      });
      presentations.set(presentationSnapshotKey(device.id, showLqi),
        reuse ? reuse.present(device.id, showLqi, build) : build());
    }
    if (host._isVacDev(device)) {
      const source = host._vacSource(device, planHass);
      const telemetry = source ? readVacTelemetry(planHass?.states?.[source]?.attributes) : null;
      const runtime = host._vacRt.get(device.id);
      // One routing authority per frame: render() must not re-derive which
      // map the robot is on, or two answers become possible (#162).
      const routes = effectiveRoutes(device.id, device.marker?.vacuum ?? null, device.space, source);
      const resolution = resolveRoute({
        routes,
        observed: observedMapIds(routes, [source], (src) => host._vacObservedMapId(device, src, planHass)),
        spaceIds: new Set(host._model.map((space) => space.id)),
      });
      facts.set(`vacuum:${device.id}`, {
        source,
        telemetry,
        routes,
        resolution,
        mapId: telemetry ? host._vacMapId(device, telemetry, planHass) : null,
        runtime: runtime ? {
          trail: runtime.material,
          lastTs: runtime.lastTs,
          moving: runtime.moving,
          jump: runtime.jump,
        } : null,
        server: host._vacSrvTrails[device.id] || null,
      });
    }
  }
  const snapshot = createRenderDeviceSnapshot({
    sourceSequence: host._hassSequence, hass: planHass,
    devices: host._devices, presentations,
    positions: renderDeviceSnapshotPositions(
      host._model.length > 0,
      host._devices,
      (device) => host._livePos(device),
    ),
    facts,
    showBattery,
    batteryContext,
    signalContext,
    entityIds,
    deviceIds,
    areaIds,
    geometry: host._cfgEpoch,
    window,
  });
  reuse?.end(snapshot);
  return snapshot;
}
