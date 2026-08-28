/**
 * Building the device list from HA registries: filtering, light groups,
 * markers (overrides/virtual). No Lit/DOM — only the hass object.
 */
import { iconFor, iconFromDeviceClasses, DOMAIN_PRIORITY, FALLBACK_ICON, type CompiledIconRule, EXCLUDED_DOMAINS } from './rules';
import { averageLqi, isControllable } from './logic';
import {
  applianceLifecycleRoleRank, isDevicePowerSwitch, isSemanticBinaryEntity,
} from './device-visual';
import type { DevItem, Marker, ServerConfig } from './types';
import {
  isManualVirtualLightMarker,
  virtualLightFingerprint,
  virtualLightIsOn,
  type VirtualLightSnapshot,
} from './virtual-light-state';
import {
  activeRegistryHass, fullRegistryHass, haRegistrySnapshot, isRegistryEntryEnabled,
  resolveHaBindingStatus, type HaRegistrySnapshot,
} from './ha-binding-status';

/** Build context: a slice of hass + config resolution. */
export interface BuildCtx {
  hass: any;
  /** Shared page-level full registry authority; omitted callers use its current snapshot. */
  registry?: HaRegistrySnapshot;
  /** area_id → space_id (only zones bound to rooms). */
  areaToSpace: Record<string, string>;
  markers: Marker[];
  settings: ServerConfig['settings'];
  excluded: Set<string>;
  /** LEGACY only: honoured while the config has no settings.filter_seeded.
   *  Seeded configs hide by explicit marker flags (docs/FILTERING.md). */
  showAll: boolean;
  firstSpaceId: string;
  /** Localized display strings for generated device names. */
  loc: (key: 'device.unnamed' | 'device.light_group' | 'device.fallback' | 'device.virtual') => string;
  /** Compiled icon rules (instance overrides or built-in defaults). */
  iconRules?: CompiledIconRule[];
}

export function entitiesByDevice(hass: any): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [eid, ent] of Object.entries<any>(hass.entities)) {
    if (!ent?.device_id || !isRegistryEntryEnabled(ent)) continue;
    const parent = hass.devices?.[ent.device_id];
    if (parent && !isRegistryEntryEnabled(parent)) continue;
    (map[ent.device_id] = map[ent.device_id] || []).push(eid);
  }
  return map;
}

function allEntitiesByDevice(hass: any): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [eid, ent] of Object.entries<any>(hass.entities || {})) {
    if (ent?.device_id) (map[ent.device_id] = map[ent.device_id] || []).push(eid);
  }
  return map;
}

interface EntityMarkerOwnership {
  byDevice: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Live entity markers own their exact entity inside an auto-discovered parent.
 * Tombstones deliberately do not: removing a standalone binding must return
 * that entity to the still-live HA device (docs/FILTERING.md).
 */
function entityMarkerOwnership(markers: readonly Marker[], fullHass: any): EntityMarkerOwnership {
  const mutableByDevice = new Map<string, Set<string>>();
  for (const marker of markers) {
    if (marker?.removed === true) continue;
    const binding = marker?.binding || '';
    if (!binding.startsWith('entity:')) continue;
    const entityId = binding.slice('entity:'.length);
    if (!entityId) continue;
    const deviceId = fullHass?.entities?.[entityId]?.device_id;
    if (!deviceId) continue;
    const owned = mutableByDevice.get(deviceId) || new Set<string>();
    owned.add(entityId);
    mutableByDevice.set(deviceId, owned);
  }
  return { byDevice: mutableByDevice };
}

/**
 * An untouched automatic device keeps its complete functional resolver,
 * including integration-hidden cover entities (#94). Once one of its entities
 * is placed explicitly, the residual auto marker contains only active,
 * HA-visible, unclaimed siblings.
 */
function residualAutoDeviceEntities(
  hass: any,
  deviceId: string,
  entityIds: readonly string[],
  ownership: EntityMarkerOwnership,
): { partial: boolean; entityIds: string[] } {
  const owned = ownership.byDevice.get(deviceId);
  if (!owned?.size) return { partial: false, entityIds: [...entityIds] };
  return {
    partial: true,
    entityIds: entityIds.filter((entityId) =>
      !owned.has(entityId) && !hass?.entities?.[entityId]?.hidden),
  };
}

export function domainOfDevice(hass: any, dev: any, entIds: string[]): string {
  if (dev.identifiers?.[0]?.[0]) return dev.identifiers[0][0];
  for (const eid of entIds) {
    const p = hass.entities[eid]?.platform;
    if (p) return p;
  }
  return '';
}

export function isTempEntity(hass: any, eid: string): boolean {
  // Температура чипа самого устройства — это диагностика, не комнатная температура.
  if (/_device_temperature$/.test(eid)) return false;
  // Диагностические/конфигурационные сущности (чип, батарея, калибровки) — не комната.
  if (hass.entities?.[eid]?.entity_category) return false;
  const st = hass.states[eid];
  if (!st) return /_temperature$/.test(eid);
  const a = st.attributes || {};
  return (
    a.device_class === 'temperature' || /°C|°F/.test(a.unit_of_measurement || '') || /_temperature$/.test(eid)
  );
}

/**
 * Domains which expose the state machine of a whole functional device. This
 * is a role order, not an entity-list order: an auxiliary switch may never
 * outrank the vacuum/climate/cover/etc. entity it configures.
 */
const DEVICE_STATE_DOMAINS = [
  'vacuum', 'lawn_mower', 'climate', 'media_player', 'light', 'cover', 'lock', 'valve',
  'alarm_control_panel', 'water_heater', 'fan', 'humidifier',
  'siren', 'camera', 'remote',
];

interface DeviceEntityCandidate {
  eid: string;
  reg: any;
}

const visibleFirst = (items: DeviceEntityCandidate[]): DeviceEntityCandidate[] => [
  ...items.filter((item) => !item.reg?.hidden),
  ...items.filter((item) => !!item.reg?.hidden),
];

/**
 * Effective entities which jointly describe one device's status.
 *
 * Home Assistant has no device state: it has entity states, while
 * entity_category marks config/diagnostic entities as non-primary. House Plan
 * therefore resolves a ROLE, not a first list item:
 *   1) uncategorised HA entities (all entities only as a fallback);
 *   2) a whole-device state domain, if present;
 *   3) semantic binary signals (presence/contact/motion/safety/running);
 *   4) for a recognised composite Power topology, a strict appliance
 *      lifecycle entity plus the Power availability gate;
 *   5) one representative switch when the device has no stronger role;
 *   6) passive entities together, so one unavailable sensor does not make the
 *      whole marker unavailable while another reading is alive.
 */
export function resolvedDeviceStateEntities(hass: any, entIds: readonly string[]): string[] {
  const all: DeviceEntityCandidate[] = entIds
    .map((eid) => ({ eid, reg: hass?.entities?.[eid] }))
    .filter((item) => !!item.reg);
  if (!all.length) return [];
  const haPrimary = all.filter((item) => !item.reg.entity_category);
  const pool = haPrimary.length ? haPrimary : all;

  for (const domain of DEVICE_STATE_DOMAINS) {
    const role = pool.filter((item) => item.eid.startsWith(domain + '.'));
    if (role.length) return visibleFirst(role).map((item) => item.eid);
  }

  const semanticBinary = pool.filter((item) => isSemanticBinaryEntity(hass, item.eid));
  if (semanticBinary.length) return visibleFirst(semanticBinary).map((item) => item.eid);

  const switches = pool.filter((item) => item.eid.startsWith('switch.'));
  if (switches.length) {
    // A switch-only integration commonly exposes one power relay plus a set
    // of feature toggles (night mode, voice enhancement, child lock, etc.).
    // HA gives us no device-level state and some third-party integrations do
    // not mark those feature entities as `entity_category: config`. Combining
    // every switch would therefore mean "any option enabled = device working".
    // Prefer a dedicated HA Power entity when metadata identifies one, then
    // use the same single representative that primaryEntity/actions use.
    // Entity-bound markers remain exact because their list has one member.
    const ordered = visibleFirst(switches);
    const power = ordered.find((item) => isDevicePowerSwitch(hass, item.eid));
    if (switches.length > 1 && power) {
      // Lifecycle metadata is allowed to take over only inside the same
      // composite-Power topology that already neutralises Power=on. This keeps
      // a lone relay authoritative even when it has a diagnostic Status peer.
      const eligible = all.filter((item) =>
        item.eid !== power.eid
        && item.reg?.entity_category !== 'config'
        && applianceLifecycleRoleRank(hass, item.eid) != null,
      );
      const uncategorised = eligible.filter((item) => !item.reg?.entity_category);
      const lifecyclePool = uncategorised.length ? uncategorised : eligible;
      for (const rank of [0, 1, 2]) {
        const role = visibleFirst(lifecyclePool.filter(
          (item) => applianceLifecycleRoleRank(hass, item.eid) === rank,
        ));
        if (role.length) return [role[0].eid, power.eid];
      }
    }
    return [(power || ordered[0]).eid];
  }

  // Passive/fallback entities are all useful for aggregate availability. Keep
  // the historical domain order only as a stable ordering for primaryEntity.
  const ordered: DeviceEntityCandidate[] = [];
  for (const domain of DOMAIN_PRIORITY)
    ordered.push(...visibleFirst(pool.filter((item) => item.eid.startsWith(domain + '.'))));
  ordered.push(...visibleFirst(pool.filter(
    (item) => !DOMAIN_PRIORITY.includes(item.eid.split('.')[0]),
  )));
  return ordered.map((item) => item.eid);
}

export function primaryEntity(hass: any, entIds: string[], icon: string): string | undefined {
  const all = entIds
    .map((eid) => ({ eid, reg: hass.entities[eid], st: hass.states[eid] }))
    .filter((e) => e.reg);
  // Temperature/air-monitor labels deliberately choose their measurement;
  // every other device delegates to the shared role resolver below.
  const tiers = [
    all.filter((e) => !e.reg.hidden && !e.reg.entity_category),
    all.filter((e) => !e.reg.entity_category),
    all.filter((e) => !e.reg.hidden),
    all,
  ];
  if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') {
    for (const tier of tiers) {
      const t = tier.find((e) => isTempEntity(hass, e.eid));
      if (t) return t.eid;
    }
  }
  const role = resolvedDeviceStateEntities(hass, entIds);
  // A composite appliance exposes [lifecycle, Power gate]. Keep the
  // controllable Power entity as the historical primary/action/value target;
  // presentation still consumes the complete resolved role.
  return role.find(isControllable) || role[0];
}

/** Minimal device shape accepted by the shared light-source resolver. */
export interface LightSourceDevice {
  id?: string;
  area: string;
  hidden?: boolean;
  entities: string[];
  primary?: string;
  /** Runtime-effective controls; marker.controls remains the persisted list. */
  controls?: string[];
  marker?: {
    id?: string;
    binding?: string;
    room_id?: string | null;
    is_light?: boolean | null;
    light_entity?: string | null;
    toggle_entity?: string | null;
    controls?: string[] | null;
    glow_radius_cm?: number | null;
    glow_color?: { c: string; bri?: number | null } | null;
  } | null;
}

export type LightSourceRoom = string | { id?: string | null; area?: string | null };

export interface ResolvedLightSource<D extends LightSourceDevice = LightSourceDevice> {
  /** Stable identity. A passive source deliberately has no HA entity id. */
  key: `entity:${string}` | `marker:${string}`;
  /** Compatibility projection for old consumers; empty for a passive source. */
  eid: string;
  /** Entities whose state determines this source. */
  stateEids: string[];
  /** Real HA entities which may be sent to callService. Never marker:* refs. */
  serviceEids: string[];
  /** Device/marker which declares or physically places this source on the plan. */
  device: D;
  /** Why this entity belongs to the light-source set. */
  via: 'controls' | 'forced' | 'light';
  /** False for remote controls: they describe room light but have no lamp position. */
  castsGlow: boolean;
  /** Always + no own controllable entity. */
  passive: boolean;
  on: boolean;
}

/** One controller's real HA drivers for an incoming `marker:*` link. */
export interface IncomingLightController<D extends LightSourceDevice = LightSourceDevice> {
  device: D;
  /** Real entity ids only. The linked marker id is never a service target. */
  driverEids: string[];
}

/** Plan-wide reverse edge for one forced source marker. */
export interface IncomingLightControl<D extends LightSourceDevice = LightSourceDevice> {
  markerId: string;
  controllers: IncomingLightController<D>[];
  /** Deterministic union of every controller's driver entities. */
  driverEids: string[];
}

/**
 * Controls are OTHER light targets operated by this marker. A marker already
 * operates its own bound entity/device through the normal tap action; storing
 * one of those same entities in controls made a plain fan/socket look like an
 * explicitly configured light source. `is_light` is the sole explicit way to
 * say that the bound switch itself drives a real fixture; `false` explicitly
 * suppresses the marker's own light role without touching external controls.
 */
export function effectiveMarkerControls(
  binding: string | null | undefined,
  controls: readonly string[] | null | undefined,
  ownEntities: readonly string[] = [],
): string[] {
  return [...new Set(persistedExternalControls(binding, controls, ownEntities))]
    .filter((eid) => isControllable(eid));
}

/**
 * Lossless controls list for marker editing/persistence.
 *
 * Runtime consumers deliberately discard unknown domains and duplicates, but
 * opening and saving the dialog must not rewrite YAML-only targets or collapse
 * repeated entries. Only the marker's own target is removed: it belongs to the
 * normal tap action. Classifying that relay as a lamp is a separate, explicit
 * tri-state `is_light` decision.
 */
export function persistedExternalControls(
  binding: string | null | undefined,
  controls: readonly string[] | null | undefined,
  ownEntities: readonly string[] = [],
): string[] {
  // An entity marker owns only its exact binding. Registry rebuilds may attach
  // sibling entities from the parent device to DevItem; treating every sibling
  // as self would silently drop an explicitly configured external target.
  const own = binding?.startsWith('entity:')
    ? new Set([binding.slice('entity:'.length)])
    : new Set(ownEntities);
  return (controls || []).filter((eid) => typeof eid === 'string' && !own.has(eid));
}

function lightSourceBelongsToRoom(d: LightSourceDevice, room: LightSourceRoom): boolean {
  if (typeof room === 'string') return d.area === room;
  // An explicit marker-to-room binding is more precise than the HA area and
  // therefore must not leak the source into every room sharing that area.
  const roomId = d.marker?.room_id;
  if (roomId) return !!room.id && roomId === room.id;
  return !!room.area && d.area === room.area;
}

interface LightEntityCandidate {
  eid: string | null;
  via: ResolvedLightSource['via'];
}

/** Controllable own entities in deterministic compatibility order. */
export function ownControllableEntities(d: LightSourceDevice): string[] {
  const bound = d.marker?.binding?.startsWith('entity:')
    ? d.marker.binding.slice('entity:'.length) : null;
  const controllable = d.entities.filter(isControllable);
  const primary = d.primary && isControllable(d.primary) ? d.primary : null;
  return [...new Set([bound, primary, ...controllable].filter(
    (eid): eid is string => !!eid && isControllable(eid),
  ))];
}

/** Effective leading entity. A stale explicit choice is retained in config but
 * falls back until that entity returns to the marker's own active candidates. */
export function forcedLightEntityOf(d: LightSourceDevice): string | null {
  const candidates = ownControllableEntities(d);
  const selected = d.marker?.light_entity;
  if (selected && candidates.includes(selected)) return selected;
  // An explicitly forced entity marker names the physical relay exactly. Do
  // not let a different registry-derived primary entity steal that decision.
  return candidates[0] || null;
}

function ownLightCandidatesOf(hass: any, d: LightSourceDevice): LightEntityCandidate[] {
  if (d.marker?.is_light === false) return [];
  if (d.marker?.is_light === true) {
    const forced = forcedLightEntityOf(d);
    // Capability is registry/config based, never inferred from a transient HA
    // state snapshot. No candidate is a valid passive forced source.
    return [{ eid: forced, via: 'forced' }];
  }

  // Automatic discovery describes the DEVICE, not every auxiliary entity it
  // happens to expose. The resolved functional role prevents status LEDs of a
  // TV/soundbar/etc. from turning the whole device into a plan light.
  const role = d.primary || resolvedDeviceStateEntities(hass, d.entities)[0];
  if (role && !role.startsWith('light.')) return [];
  return d.entities
    // Auto describes a currently available HA light. Unlike the explicit
    // Always role, a registry entry whose state has disappeared must not turn
    // the room from “no sources” into a phantom “0 of 1” source.
    .filter((eid) => eid.startsWith('light.') && !!hass.states?.[eid])
    .map((eid) => ({ eid, via: 'light' as const }));
}

interface CachedLightGraph<D extends LightSourceDevice> {
  fingerprint: string;
  visible: D[];
  markerById: Map<string, D>;
  persistedByDevice: Map<D, string[]>;
  incomingByMarker: Map<string, IncomingLightControl<D>>;
}

const LIGHT_GRAPH_CACHE = new WeakMap<object, CachedLightGraph<any>>();

interface CachedResolvedLightSources<D extends LightSourceDevice> {
  graphFingerprint: string;
  stateFingerprint: string;
  virtualLightFingerprint: string;
  registry: unknown;
  sources: ResolvedLightSource<D>[];
}

const RESOLVED_LIGHT_CACHE = new WeakMap<object, CachedResolvedLightSources<any>>();

function lightGraphFingerprint(devices: readonly LightSourceDevice[]): string {
  return devices.map((device) => [
    device.id || '', device.hidden === true ? 1 : 0, device.primary || '',
    [...device.entities].join(','), device.controls === undefined
      ? '<runtime-undefined>' : [...device.controls].join(','),
    device.marker?.id || '', device.marker?.binding || '', device.marker?.is_light,
    (device.marker as any)?.tap_action || '', (device.marker as any)?.removed === true ? 1 : 0,
    device.marker?.light_entity || '', device.marker?.controls == null
      ? '<persisted-null>' : [...device.marker.controls].join(','),
  ].join('\u001f')).join('\u001e');
}

/** Cheap state projection used to reuse the plan-wide graph for every room in
 * one frame. It deliberately includes persisted entity refs that are not own
 * entities: a controller outside a room may drive a source inside it. */
function lightStateFingerprint(hass: any, devices: readonly LightSourceDevice[]): string {
  const ids = new Set<string>();
  for (const device of devices) {
    for (const id of device.entities) ids.add(id);
    for (const ref of device.controls || device.marker?.controls || []) {
      if (typeof ref === 'string' && !ref.startsWith('marker:')) ids.add(ref);
    }
  }
  return [...ids].sort().map((id) => `${id}:${hass?.states?.[id]?.state ?? '<missing>'}`).join('|');
}

function lightGraphOf<D extends LightSourceDevice>(devices: readonly D[]): CachedLightGraph<D> {
  const fingerprint = lightGraphFingerprint(devices);
  const previous = LIGHT_GRAPH_CACHE.get(devices as object) as CachedLightGraph<D> | undefined;
  if (previous?.fingerprint === fingerprint) return previous;
  const visible = devices.filter((device) => !device.hidden);
  const markerById = new Map<string, D>();
  const persistedByDevice = new Map<D, string[]>();
  for (const device of devices) {
    persistedByDevice.set(device, persistedExternalControls(
      device.marker?.binding, device.marker?.controls ?? device.controls, device.entities,
    ));
    const id = !device.hidden && device.marker?.is_light === true
      ? device.marker?.id || device.id : null;
    if (id) markerById.set(String(id), device);
  }
  const incomingByMarker = new Map<string, IncomingLightControl<D>>();
  for (const controller of devices) {
    const persisted = persistedByDevice.get(controller) || [];
    const activeEntityTargets = new Set(
      (controller.controls === undefined
        ? persisted.filter(isControllable)
        : controller.controls.filter(isControllable)),
    );
    const ownDriver = forcedLightEntityOf(controller);
    const driverEids = activeEntityTargets.size
      ? [...activeEntityTargets]
      : ownDriver ? [ownDriver] : [];
    for (const ref of persisted) {
      if (!ref.startsWith('marker:')) continue;
      const markerId = ref.slice('marker:'.length);
      if (!markerId || markerId === String(controller.marker?.id || controller.id || '')) continue;
      if (!markerById.has(markerId)) continue;
      const previous = incomingByMarker.get(markerId) || {
        markerId,
        controllers: [],
        driverEids: [],
      };
      previous.controllers.push({ device: controller, driverEids: [...driverEids] });
      previous.driverEids = [...new Set([...previous.driverEids, ...driverEids])];
      incomingByMarker.set(markerId, previous);
    }
  }
  const value = { fingerprint, visible, markerById, persistedByDevice, incomingByMarker };
  LIGHT_GRAPH_CACHE.set(devices as object, value);
  return value;
}

/**
 * Canonical reverse projection for #84/#174. State resolution and Toggle must
 * consume this same cached graph so a linked lamp cannot display one relay
 * while an action operates another.
 */
export function incomingLightControls<D extends LightSourceDevice>(
  devices: readonly D[],
): ReadonlyMap<string, IncomingLightControl<D>> {
  return lightGraphOf(devices).incomingByMarker;
}

/** Whether the marker currently has a real, position-bearing source of its own. */
export function hasOwnSpatialSource(hass: any, d: LightSourceDevice): boolean {
  const controls = effectiveMarkerControls(
    d.marker?.binding,
    d.controls ?? d.marker?.controls,
    d.entities,
  );
  const persisted = persistedExternalControls(
    d.marker?.binding, d.marker?.controls ?? d.controls, d.entities,
  );
  if (d.marker?.is_light == null
      && (controls.length || persisted.some((ref) => ref.startsWith('marker:')))) return false;
  return ownLightCandidatesOf(hass, d).length > 0;
}

/** Whether the source owns a real state/service entity (as opposed to passive). */
export function hasOwnStatefulLightSource(hass: any, d: LightSourceDevice): boolean {
  return ownLightCandidatesOf(hass, d).some((candidate) => !!candidate.eid);
}

export type LightRole = 'auto' | 'always' | 'never';
export type GlowMode = 'auto' | 'color' | 'fixed';

/** Normative UI matrix shared by the dialog and exhaustive tests. */
export function resolveDeviceLightSettings(
  role: LightRole, autoHasSource: boolean, statefulCapability: boolean, storedMode: GlowMode,
): {
  sourceExists: boolean;
  fromSourceEnabled: boolean;
  manualEnabled: boolean;
  radiusEnabled: boolean;
  passive: boolean;
  effectiveMode: GlowMode;
} {
  const sourceExists = role === 'always' || (role === 'auto' && autoHasSource);
  const passive = sourceExists && !statefulCapability;
  return {
    sourceExists,
    fromSourceEnabled: sourceExists && statefulCapability,
    manualEnabled: sourceExists,
    radiusEnabled: sourceExists,
    passive,
    effectiveMode: passive && storedMode === 'auto' ? 'fixed' : storedMode,
  };
}

function lightEntitiesOf(hass: any, d: LightSourceDevice): LightEntityCandidate[] {
  const controls = effectiveMarkerControls(
    d.marker?.binding,
    d.controls ?? d.marker?.controls,
    d.entities,
  );
  const out: LightEntityCandidate[] = controls.map((eid) => ({ eid, via: 'controls' }));

  // In Auto mode explicit controls retain the historic priority and suppress
  // own-source discovery. Always is deliberately additive: controls continue
  // to describe the room while the marker itself owns a spatial Glow source.
  const own = hasOwnSpatialSource(hass, d)
    ? ownLightCandidatesOf(hass, d)
    : [];
  for (const candidate of own) {
    if (!candidate.eid || !out.some((existing) => existing.eid === candidate.eid)) out.push(candidate);
  }
  return out;
}

/**
 * One source of truth for every light-related room feature. Within a marker,
 * external controls stay independent; Always adds a forced own source, Never
 * removes it, and Auto keeps the historical controls-first/light-role fallback.
 * Across markers the real/forced source owns spatial Glow over a controller
 * naming the same entity. Passing a room scopes sources by room_id/area;
 * omitting it resolves the supplied devices (used by Glow and controls).
 */
export function resolvedLightSources<D extends LightSourceDevice>(
  hass: any,
  devices: readonly D[],
  room?: LightSourceRoom | null,
  virtualLights?: VirtualLightSnapshot | null,
): ResolvedLightSource<D>[] {
  // Resolve the graph once per frame and scope by the source owner's precise
  // room binding. This preserves cross-room controllers while avoiding a full
  // O(devices + links) graph walk for every room consumer.
  if (room != null) {
    return resolvedLightSources(hass, devices, null, virtualLights).filter((source) =>
      lightSourceBelongsToRoom(source.device, room));
  }
  const graphFingerprint = lightGraphFingerprint(devices);
  const stateFingerprint = lightStateFingerprint(hass, devices);
  const manualFingerprint = virtualLightFingerprint(virtualLights);
  const cached = RESOLVED_LIGHT_CACHE.get(devices as object) as CachedResolvedLightSources<D> | undefined;
  if (cached?.graphFingerprint === graphFingerprint
      && cached.stateFingerprint === stateFingerprint
      && cached.virtualLightFingerprint === manualFingerprint
      && cached.registry === hass?.entities) return cached.sources;

  type Candidate = ResolvedLightSource<D>;
  const { visible, markerById, persistedByDevice, incomingByMarker } = lightGraphOf(devices);
  // Room consumers need sources owned by that room, not a full resolution of
  // every marker followed by a final filter. Controllers outside the room are
  // still scanned below because they may drive a source whose owner is inside.
  const sourceDevices = room == null
    ? visible
    : visible.filter((device) => lightSourceBelongsToRoom(device, room));

  const ownByDevice = new Map<D, Candidate[]>();
  const ownerByEntity = new Map<string, Candidate>();
  for (const device of sourceDevices) {
    const own = lightEntitiesOf(hass, device).filter((candidate) => candidate.via !== 'controls');
    // Auto may expose several light.* entities. Each remains an independent
    // source; forced Always deliberately has exactly one leading source.
    for (const candidate of own) {
      const markerId = device.marker?.is_light === true
        ? String(device.marker?.id || device.id || '') : '';
      const key = markerId ? `marker:${markerId}` as const : `entity:${candidate.eid}` as const;
      const eids = candidate.eid ? [candidate.eid] : [];
      const source: Candidate = {
        key, eid: candidate.eid || '', stateEids: eids, serviceEids: eids,
        device, via: candidate.via, castsGlow: true, passive: !candidate.eid,
        on: candidate.eid ? hass.states?.[candidate.eid]?.state === 'on' : true,
      };
      ownByDevice.set(device, [...(ownByDevice.get(device) || []), source]);
      if (candidate.eid) ownerByEntity.set(candidate.eid, source);
    }
  }

  const activeEntityTargetsByDevice = new Map<D, Set<string>>();
  for (const controller of devices) {
    const persisted = persistedByDevice.get(controller) || [];
    // `hidden` is a visual setting. It must not sever a saved controller link
    // and make a physically active passive lamp look off.
    const activeEntityTargets = new Set(
      controller.controls === undefined ? persisted.filter(isControllable) : controller.controls,
    );
    activeEntityTargetsByDevice.set(controller, activeEntityTargets);
  }

  for (const sources of ownByDevice.values()) {
    for (const source of sources) {
      if (!source.passive) continue;
      const markerId = source.key.slice('marker:'.length);
      const control = incomingByMarker.get(markerId);
      source.on = control
        ? control.driverEids.some((eid) => hass.states?.[eid]?.state === 'on')
        : true;
      // #174: real controller state is authoritative whenever a saved,
      // runtime-valid incoming link exists. The manual #107 state remains a
      // lossless fallback and becomes visible again after the last link goes.
      if (!control && isManualVirtualLightMarker(source.device.marker)) {
        source.on = virtualLightIsOn(source.device.marker, virtualLights);
      }
    }
  }

  const byKey = new Map<string, Candidate>();
  const add = (source: Candidate): void => {
    const previous = byKey.get(source.key);
    if (!previous || (source.castsGlow && !previous.castsGlow)) byKey.set(source.key, source);
  };
  for (const controller of visible) {
    const persisted = persistedByDevice.get(controller) || [];
    const controllerInRoom = room == null || lightSourceBelongsToRoom(controller, room);
    for (const ref of persisted) {
      if (ref.startsWith('marker:')) {
        const target = markerById.get(ref.slice('marker:'.length));
        const owned = target ? ownByDevice.get(target) : null;
        if (owned) for (const source of owned) add(source);
        continue;
      }
      if (!isControllable(ref) || !activeEntityTargetsByDevice.get(controller)?.has(ref)) continue;
      const owned = ownerByEntity.get(ref);
      if (owned) add(owned);
      else if (controllerInRoom) add({
        key: `entity:${ref}`, eid: ref, stateEids: [ref], serviceEids: [ref],
        device: controller, via: 'controls', castsGlow: false, passive: false,
        on: hass.states?.[ref]?.state === 'on',
      });
    }
    for (const source of ownByDevice.get(controller) || []) add(source);
  }
  const sources = [...byKey.values()];
  RESOLVED_LIGHT_CACHE.set(devices as object, {
    graphFingerprint, stateFingerprint, virtualLightFingerprint: manualFingerprint,
    registry: hass?.entities, sources,
  });
  return sources;
}

/** Select the single source whose state and position drive a marker's Glow. */
export function selectSpatialGlowSource<D extends LightSourceDevice>(
  sources: readonly ResolvedLightSource<D>[],
): ResolvedLightSource<D> | null {
  const spatial = sources.filter((source) => source.castsGlow);
  return spatial.find((source) => source.on) || spatial[0] || null;
}

/** Tri-state used by room fill. */
export function resolvedLightState(sources: readonly ResolvedLightSource[]): 'on' | 'off' | 'none' {
  if (!sources.length) return 'none';
  return sources.some((source) => source.on) ? 'on' : 'off';
}

/** Counts used by the room card/label. */
export function resolvedLightStats(
  sources: readonly ResolvedLightSource[],
): { on: number; total: number } | null {
  if (!sources.length) return null;
  return { on: sources.filter((source) => source.on).length, total: sources.length };
}

/** @deprecated Compatibility helper for older tests/callers; use resolvedLightSources(). */
export function litLightEntity(
  hass: any,
  d: Omit<LightSourceDevice, 'area'> & { area?: string },
): string | null {
  return resolvedLightSources(hass, [{ ...d, area: d.area || '' }])
    .find((source) => source.on && !!source.eid)?.eid || null;
}

/** Average zigbee LQI across the device's entities (*_linkquality/*_lqi sensors or an attribute). */
export function lqiFor(hass: any, entIds: string[]): number | null {
  const vals: number[] = [];
  for (const eid of entIds) {
    const st = hass.states[eid];
    if (!st) continue;
    const unit = (st.attributes?.unit_of_measurement || '').toLowerCase();
    // 1) dedicated signal sensor: Z2M *_linkquality, ZHA *_lqi, or “lqi” units
    if (/_(linkquality|lqi)$/.test(eid) || unit === 'lqi') {
      const v = parseFloat(st.state);
      if (!isNaN(v)) vals.push(v);
      continue;
    }
    // 2) signal as an ATTRIBUTE on any entity of the device (Z2M linkquality / ZHA lqi) —
    //    covers devices whose dedicated signal sensor is disabled
    const av = st.attributes?.linkquality ?? st.attributes?.lqi;
    if (av != null) {
      const v = parseFloat(av);
      if (!isNaN(v)) vals.push(v);
    }
  }
  return averageLqi(vals);
}

export function tempFor(hass: any, entIds: string[]): number | null {
  for (const eid of entIds) {
    if (!isTempEntity(hass, eid)) continue;
    const st = hass.states[eid];
    if (!st) continue;
    const v = parseFloat(st.state);
    if (!isNaN(v)) return Math.round(v * 10) / 10;
  }
  return null;
}

/**
 * Room temperature as a CLIMATE device reports it: the first climate.* entity
 * with a finite attributes.current_temperature (owner's spec: several climate
 * entities -> the first valid one wins). Unavailable/unknown entities and a
 * missing attribute yield null - no badge, no vote in the room average.
 */
export function climateTempFor(hass: any, entIds: string[]): number | null {
  for (const eid of entIds) {
    if (!eid.startsWith('climate.')) continue;
    const st = hass.states[eid];
    if (!st || st.state === 'unavailable' || st.state === 'unknown') continue;
    const v = parseFloat(st.attributes?.current_temperature);
    if (Number.isFinite(v)) return Math.round(v * 10) / 10;
  }
  return null;
}

/** A humidity-measuring entity (device_class humidity or *_humidity), excluding diagnostics. */
export function isHumEntity(hass: any, eid: string): boolean {
  if (hass.entities?.[eid]?.entity_category) return false;
  const st = hass.states[eid];
  if (!st) return /_humidity$/.test(eid);
  const a = st.attributes || {};
  return a.device_class === 'humidity' || (a.unit_of_measurement === '%' && /_humidity$/.test(eid)) || /_humidity$/.test(eid);
}

/** First readable humidity value (integer %) among the entities, or null. */
export function humFor(hass: any, entIds: string[]): number | null {
  for (const eid of entIds) {
    if (!isHumEntity(hass, eid)) continue;
    const st = hass.states[eid];
    if (!st) continue;
    const v = parseFloat(st.state);
    if (!isNaN(v)) return Math.round(v);
  }
  return null;
}

/** Group light entities: HA light-group (platform=group) and Z2M groups (device model=Group). */
export function lightGroups(hass: any, enabled: boolean): { eid: string; name: string; area: string }[] {
  if (!enabled) return [];
  const res: { eid: string; name: string; area: string }[] = [];
  for (const [eid, reg] of Object.entries<any>(hass.entities)) {
    if (!eid.startsWith('light.') || reg.hidden || !isRegistryEntryEnabled(reg)) continue;
    let area: string | null = null;
    if (reg.platform === 'group') {
      area = reg.area_id || null;
    } else if (reg.device_id) {
      const dev = hass.devices[reg.device_id];
      if (!isRegistryEntryEnabled(dev)) continue;
      if (dev?.model === 'Group') area = dev.area_id || reg.area_id || null;
      else continue;
    } else {
      continue;
    }
    if (!area) continue;
    const st = hass.states[eid];
    res.push({ eid, name: reg.name || st?.attributes?.friendly_name || eid, area });
  }
  return res;
}

/** Icon with the full fallback chain: name rules → entity device_class → chip. */
export function resolveIcon(hass: any, name: string, model: string | undefined, entIds: string[], rules?: CompiledIconRule[]): string {
  const byRules = iconFor(name, model, rules);
  if (byRules !== FALLBACK_ICON) return byRules;
  const classes: string[] = [];
  for (const eid of entIds) {
    const dc = hass.states[eid]?.attributes?.device_class;
    if (dc) classes.push(dc);
  }
  return iconFromDeviceClasses(classes) ?? FALLBACK_ICON;
}

export interface RemovedPlanBindings {
  devices: Set<string>;
  entities: Set<string>;
  /** Exact live entity markers that intentionally override an entity or
   *  parent-device tombstone without restoring the rest of that device. */
  liveEntities: Set<string>;
}

export interface DeletePlanMarkerResult {
  markers: Marker[];
  cleanupIds: Set<string>;
}

/** Remove every link to deleted marker ids without touching entity/unknown refs. */
export function removeMarkerControlReferences(
  markers: readonly Marker[], removedIds: ReadonlySet<string>,
): Marker[] {
  return markers.map((marker) => {
    if (!Array.isArray(marker.controls)) return marker;
    const controls = marker.controls.filter((ref) =>
      !(typeof ref === 'string' && ref.startsWith('marker:')
        && removedIds.has(ref.slice('marker:'.length))),
    );
    return controls.length === marker.controls.length
      ? marker : { ...marker, controls: controls.length ? controls : null };
  });
}

/** Keep stable plan-source links when a marker id changes during rebind. */
export function rewriteMarkerControlReferences(
  markers: readonly Marker[], oldId: string, newId: string,
): Marker[] {
  if (!oldId || !newId || oldId === newId) return [...markers];
  const from = `marker:${oldId}`;
  const to = `marker:${newId}`;
  return markers.map((marker) => {
    const controls = Array.isArray(marker.controls)
      ? marker.controls.map((ref) => ref === from ? to : ref)
      : marker.controls;
    const valueBadge = marker.value_badge?.source?.kind === 'derived_marker_state'
      && marker.value_badge.source.ref === from
      ? {
          ...marker.value_badge,
          source: { ...marker.value_badge.source, ref: to as `marker:${string}` },
        }
      : marker.value_badge;
    return controls === marker.controls && valueBadge === marker.value_badge
      ? marker : { ...marker, controls, value_badge: valueBadge };
  });
}

/** Whether adding controller -> target would close a directed marker cycle. */
export function markerControlWouldCycle(
  markers: readonly Pick<Marker, 'id' | 'controls'>[], controllerId: string, targetId: string,
): boolean {
  if (!controllerId || controllerId === targetId) return true;
  const graph = new Map<string, string[]>();
  for (const marker of markers) {
    graph.set(marker.id, (marker.controls || [])
      .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('marker:'))
      .map((ref) => ref.slice('marker:'.length)));
  }
  const seen = new Set<string>();
  const stack = [targetId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === controllerId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(graph.get(id) || []));
  }
  return false;
}

/** Remove one marker binding without letting the shared literal `virtual`
 *  identify every manual marker. Real HA bindings are unique and therefore
 *  deduplicated; virtual markers have identity only by id. Non-virtual
 *  deletion leaves a hidden tombstone so an older cached card degrades to a
 *  hidden marker instead of visibly resurrecting it. */
export function deletePlanMarkerRecords(
  markers: readonly Marker[], id: string, binding: string, virtual: boolean,
): DeletePlanMarkerResult {
  const cleanupIds = new Set<string>([id]);
  const kept = markers.filter((marker) => {
    const drop = marker.id === id || (!virtual && marker.binding === binding);
    if (drop) cleanupIds.add(marker.id);
    return !drop;
  });
  return {
    markers: virtual
      ? kept
      : [...kept, { id, binding, removed: true, hidden: true }],
    cleanupIds,
  };
}

/** Bindings explicitly deleted from the plan, kept as minimal tombstones. */
export function removedPlanBindings(markers?: readonly Marker[] | null): RemovedPlanBindings {
  const devices = new Set<string>();
  const entities = new Set<string>();
  const liveEntities = new Set<string>();
  for (const m of markers || []) {
    const i = String(m.binding || '').indexOf(':');
    if (i < 1) continue;
    const kind = m.binding.slice(0, i);
    const ref = m.binding.slice(i + 1);
    if (!ref) continue;
    if (m?.removed !== true) {
      if (kind === 'entity') liveEntities.add(ref);
      continue;
    }
    if (kind === 'device') devices.add(ref);
    else if (kind === 'entity') entities.add(ref);
  }
  return { devices, entities, liveEntities };
}

/** Whether an HA entity is suppressed by an entity or whole-device tombstone. */
export function isRemovedPlanEntity(
  hass: any, eid: string, removed: RemovedPlanBindings,
): boolean {
  // A person may restore one exact child without restoring its deleted parent.
  // This exception must stay binding-scoped: siblings remain suppressed by the
  // device tombstone until they receive their own live markers (#262).
  if (removed.liveEntities.has(eid)) return false;
  if (removed.entities.has(eid)) return true;
  const deviceId = hass?.entities?.[eid]?.device_id;
  return !!deviceId && removed.devices.has(deviceId);
}

/** Whether a `device:*` / `entity:*` source is deleted from the plan. */
export function isRemovedPlanSource(
  hass: any, source: string | null | undefined, markers?: readonly Marker[] | null,
): boolean {
  if (!source) return false;
  const i = source.indexOf(':');
  if (i < 1) return false;
  const kind = source.slice(0, i);
  const ref = source.slice(i + 1);
  const removed = removedPlanBindings(markers);
  if (kind === 'device') return removed.devices.has(ref);
  return kind === 'entity' && isRemovedPlanEntity(hass, ref, removed);
}

function applyMarker(
  item: DevItem, m: Marker, hass: any, removed: RemovedPlanBindings,
  registry: HaRegistrySnapshot,
): void {
  const controls = effectiveMarkerControls(m.binding, m.controls, item.entities)
    .filter((eid) => !isRemovedPlanEntity(hass, eid, removed))
    .filter((eid) => resolveHaBindingStatus(hass, 'entity:' + eid, registry).kind === 'active');
  // Keep persisted configuration lossless. Runtime consumers use the filtered
  // projection above; the dialog edits the original list and therefore cannot
  // silently write a temporarily suppressed control out of the marker.
  item.marker = m;
  item.controls = controls;
  item.userHidden = m.hidden === true;
  item.hidden = item.userHidden || item.bindingStatus?.kind === 'ha_disabled';
  if (m.name) item.name = m.name;
  if (m.icon) item.icon = m.icon;
  if (m.model != null) item.model = m.model;
  item.link = m.link ?? null;
  item.description = m.description ?? null;
  item.pdfs = m.pdfs || [];
  item.tapAction = m.tap_action ?? null;
}

/**
 * The SEEDER (docs/FILTERING.md): bindings of non-physical devices in bound
 * areas that have no marker yet. The editing client turns each into a
 * `hidden: true` stub marker — after that the flag belongs to the user, and a
 * marker of ANY kind (even `hidden: false`) makes the device invisible to
 * this function forever. Idempotent by construction.
 */
export function seedHiddenBindings(ctx: Omit<BuildCtx, 'showAll' | 'loc'>): string[] {
  const baseHass = ctx.hass;
  const registry = ctx.registry || haRegistrySnapshot(baseHass);
  const h = activeRegistryHass(baseHass, registry);
  const fullHass = fullRegistryHass(baseHass, registry);
  const { areaToSpace, markers, settings, excluded, iconRules } = ctx;
  const groupLights = settings.group_lights !== false;
  const removed = removedPlanBindings(markers);
  const groups = lightGroups(h, groupLights)
    .filter((g) => !isRemovedPlanEntity(h, g.eid, removed));
  const groupedAreas = new Set(groups.map((g) => g.area));
  const entsBy = entitiesByDevice(h);
  const ownership = entityMarkerOwnership(markers, fullHass);
  const marked = new Set(markers.map((m) => m.binding));
  const out: string[] = [];
  for (const dev of Object.values<any>(h.devices)) {
    const area = dev.area_id;
    if (!area || !areaToSpace[area]) continue;
    if (dev.entry_type === 'service') continue;
    if (marked.has('device:' + dev.id)) continue;
    if (resolveHaBindingStatus(baseHass, 'device:' + dev.id, registry).kind !== 'active') continue;
    // An entity tombstone suppresses that standalone binding, not the same
    // entity as data belonging to a still-live parent device.
    const residual = residualAutoDeviceEntities(h, dev.id, entsBy[dev.id] || [], ownership);
    if (residual.partial && !residual.entityIds.length) continue;
    const entIds = residual.entityIds;
    const dom = domainOfDevice(h, dev, entIds);
    let nonPhysical =
      excluded.has(dom)
      || dev.model === 'Group'
      || /scene/i.test(dev.model || '')
      || /bridge/i.test((dev.model || '') + (dev.name || ''))
      || (dom === 'myheat' && !!dev.via_device_id);
    if (!nonPhysical && groupLights && groupedAreas.has(area)) {
      const name = (dev.name_by_user || dev.name || '').trim();
      if (resolveIcon(h, name, dev.model, entIds, iconRules) === 'mdi:lightbulb') nonPhysical = true;
    }
    if (nonPhysical) out.push('device:' + dev.id);
  }
  return out;
}

function resolveExplicitMarkerPlacement(
  marker: Marker,
  registryArea: string | null | undefined,
  areaToSpace: Record<string, string>,
  firstSpaceId: string,
): { area: string; space: string } {
  // A room id plus an explicit null Area is the persisted contract for a
  // manual room which has no HA Area. The registry still describes the HA
  // device, but must not move that marker back to its source room.
  const manualRoomWithoutArea = typeof marker.room_id === 'string'
    && marker.room_id.length > 0
    && marker.area === null;
  if (manualRoomWithoutArea) {
    return { area: '', space: marker.space || firstSpaceId };
  }
  const area = marker.area || registryArea || '';
  return {
    area,
    space: (area && areaToSpace[area]) || marker.space || firstSpaceId,
  };
}

/** Filtering + light groups + markers (metadata/rebinding) + virtual ones. A hybrid. */
export function buildDevices(ctx: BuildCtx): DevItem[] {
  const baseHass = ctx.hass;
  const registry = ctx.registry || haRegistrySnapshot(baseHass);
  const h = activeRegistryHass(baseHass, registry);
  const fullHass = fullRegistryHass(baseHass, registry);
  const { areaToSpace, markers, settings, excluded, showAll, firstSpaceId, loc, iconRules } = ctx;
  const groupLights = settings.group_lights !== false;
  const removed = removedPlanBindings(markers);
  const groups = lightGroups(h, groupLights)
    .filter((g) => !isRemovedPlanEntity(h, g.eid, removed));
  const groupedAreas = new Set(groups.map((g) => g.area));
  const entsBy = entitiesByDevice(h);
  const allEntsBy = allEntitiesByDevice(fullHass);
  const ownership = entityMarkerOwnership(markers, fullHass);
  const claimed = new Set<string>();
  for (const m of markers) {
    const [kind, ref] = m.binding.split(':');
    if ((kind === 'device' || kind === 'entity') && ref) claimed.add(m.binding);
  }
  const markerFor = (kind: string, ref: string) => markers.find((m) => m.binding === kind + ':' + ref);
  const seen: Record<string, number> = {};
  const rest: DevItem[] = [];

  // 1) HA auto-discovered devices (not claimed by a marker, not hidden)
  for (const dev of Object.values<any>(h.devices)) {
    const area = dev.area_id;
    if (!area || !areaToSpace[area]) continue;
    if (dev.entry_type === 'service') continue;
    if (claimed.has('device:' + dev.id)) continue; // a marker will take over below
    const bindingStatus = resolveHaBindingStatus(baseHass, 'device:' + dev.id, registry);
    if (bindingStatus.kind !== 'active') continue;
    const marker = markerFor('device', dev.id);
    if (marker && marker.hidden && !settings.filter_seeded) continue; // legacy: dropped entirely
    const residual = residualAutoDeviceEntities(h, dev.id, entsBy[dev.id] || [], ownership);
    if (residual.partial && !residual.entityIds.length) continue;
    const entIds = residual.entityIds;
    const itemBindingStatus = residual.partial
      ? { kind: 'active' as const, enabledEntityIds: entIds, allEntityIds: entIds }
      : bindingStatus;
    const dom = domainOfDevice(h, dev, entIds);
    // LEGACY runtime filter: only while the config is not yet materialised
    // (docs/FILTERING.md). A seeded config hides by explicit marker flags.
    const legacy = !settings.filter_seeded;
    if (legacy && !showAll) {
      if (excluded.has(dom)) continue;
      if (dev.model === 'Group') continue;
      if (/scene/i.test(dev.model || '')) continue;
      if (/bridge/i.test((dev.model || '') + (dev.name || ''))) continue;
      if (dom === 'myheat' && dev.via_device_id) continue;
    }
    const name = (dev.name_by_user || dev.name || loc('device.unnamed')).trim();
    const key = name + '|' + area;
    let icon = resolveIcon(h, name, dev.model, entIds, iconRules);
    if (entIds.some((e) => e.startsWith('lock.'))) icon = 'mdi:lock';
    if (legacy && !showAll && groupLights && icon === 'mdi:lightbulb' && groupedAreas.has(area)) continue;
    // duplicates by “name|zone” are numbered rather than hidden
    seen[key] = (seen[key] || 0) + 1;
    const dispName = seen[key] > 1 ? name + ' ' + seen[key] : name;
    const item: DevItem = {
      id: dev.id,
      name: dispName,
      model: dev.model || '',
      area,
      space: areaToSpace[area],
      icon,
      entities: entIds,
      allEntities: itemBindingStatus.allEntityIds,
      bindingStatus: itemBindingStatus,
      bindingKind: 'device',
      bindingRef: dev.id,
      pdfs: [],
    };
    item.primary = primaryEntity(h, entIds, icon);
    if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = tempFor(h, entIds);
    if (item.primary && isHumEntity(h, item.primary)) item.hum = humFor(h, entIds);
    rest.push(item);
  }

  // 2) light groups (not claimed by a marker)
  for (const g of groups) {
    if (!areaToSpace[g.area]) continue;
    if (claimed.has('entity:' + g.eid)) continue;
    rest.push({
      id: 'lg_' + g.eid,
      name: g.name,
      model: loc('device.light_group'),
      area: g.area,
      space: areaToSpace[g.area],
      icon: 'mdi:lightbulb-group',
      entities: [g.eid],
      allEntities: [g.eid],
      bindingStatus: { kind: 'active', enabledEntityIds: [g.eid], allEntityIds: [g.eid] },
      primary: g.eid,
      bindingKind: 'entity',
      bindingRef: g.eid,
      pdfs: [],
    });
  }

  // 3) explicit markers (rebinding/metadata/virtual)
  for (const m of markers) {
    if (m.removed) continue;
    const [kind, ref] = m.binding.split(':');
    const markerBindingStatus = kind === 'device' || kind === 'entity'
      ? resolveHaBindingStatus(baseHass, m.binding, registry) : null;
    // Hidden is a FLAG now, not an absence: the device is built (room LQI
    // still counts it) and the renderer decides. Legacy configs keep the old
    // "hidden = gone" until they are seeded (docs/FILTERING.md).
    // HA-disabled still needs a manageable ghost even during that one-time
    // legacy transition; it must not disappear just because user hidden was
    // already true before the seeder ran.
    if (m.hidden && !settings.filter_seeded && markerBindingStatus?.kind !== 'ha_disabled') continue;
    if (kind === 'device') {
      const bindingStatus = markerBindingStatus!;
      if (bindingStatus.kind === 'unverified') continue;
      const dev = fullHass.devices[ref];
      const { area, space } = resolveExplicitMarkerPlacement(
        m, dev?.area_id, areaToSpace, firstSpaceId,
      );
      const entIds = bindingStatus.kind === 'active' ? bindingStatus.enabledEntityIds : [];
      let icon = dev
        ? resolveIcon(h, dev.name_by_user || dev.name || '', dev.model, entIds, iconRules)
        : 'mdi:help-circle';
      if (entIds.some((e) => e.startsWith('lock.'))) icon = 'mdi:lock';
      const item: DevItem = {
        id: m.id,
        name: dev?.name_by_user || dev?.name || loc('device.fallback'),
        model: dev?.model || '',
        area,
        space,
        icon,
        entities: entIds,
        allEntities: bindingStatus.allEntityIds.length
          ? bindingStatus.allEntityIds : (dev ? (allEntsBy[dev.id] || []) : []),
        bindingStatus,
        bindingKind: 'device',
        bindingRef: ref,
      };
      item.primary = primaryEntity(h, entIds, icon);
      if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = tempFor(h, entIds);
      if (item.primary && isHumEntity(h, item.primary)) item.hum = humFor(h, entIds);
      applyMarker(item, m, fullHass, removed, registry);
      rest.push(item);
    } else if (kind === 'entity') {
      if (isRemovedPlanEntity(fullHass, ref, removed)) continue;
      const bindingStatus = markerBindingStatus!;
      if (bindingStatus.kind === 'unverified') continue;
      const reg = fullHass.entities[ref];
      const registryArea = reg?.area_id
        || (reg?.device_id && fullHass.devices[reg.device_id]?.area_id)
        || '';
      const { area, space } = resolveExplicitMarkerPlacement(
        m, registryArea, areaToSpace, firstSpaceId,
      );
      const st = h.states[ref];
      const nm = reg?.name || st?.attributes?.friendly_name || ref;
      let icon = resolveIcon(h, nm, '', [ref], iconRules);
      if (ref.startsWith('lock.')) icon = 'mdi:lock';
      const item: DevItem = {
        id: m.id,
        name: nm,
        model: '',
        area,
        space,
        icon,
        entities: bindingStatus.kind === 'active' ? [ref] : [],
        allEntities: [ref],
        bindingStatus,
        primary: bindingStatus.kind === 'active' ? ref : undefined,
        bindingKind: 'entity',
        bindingRef: ref,
      };
      if ((icon === 'mdi:thermometer' || icon === 'mdi:air-filter') && item.entities.length) {
        item.temp = tempFor(h, item.entities);
      }
      if (item.entities.length && isHumEntity(h, ref)) item.hum = humFor(h, item.entities);
      applyMarker(item, m, fullHass, removed, registry);
      rest.push(item);
    } else {
      // virtual
      const area = m.area || '';
      const space = m.space || (area && areaToSpace[area]) || firstSpaceId;
      const item: DevItem = {
        id: m.id,
        name: m.name || loc('device.virtual'),
        model: m.model || '',
        area,
        space,
        icon: m.icon || 'mdi:map-marker',
        entities: [],
        allEntities: [],
        bindingStatus: { kind: 'active', enabledEntityIds: [], allEntityIds: [] },
        bindingKind: 'virtual',
        virtual: true,
      };
      applyMarker(item, m, fullHass, removed, registry);
      rest.push(item);
    }
  }
  return rest;
}

/**
 * Build one unsaved marker with the exact same registry, filtering, role and
 * icon rules as the plan. The editor memoizes this call; keeping it as a thin
 * projection over buildDevices prevents a second, subtly different preview
 * implementation from growing beside the runtime one.
 */
export function deviceFromMarkerDraft(
  ctx: Omit<BuildCtx, 'markers'> & {
    marker: Marker;
    /** The persisted roster whose tombstones/ownership also constrain the plan. */
    siblingMarkers?: readonly Marker[];
  },
): DevItem | null {
  const { marker, siblingMarkers = [], ...base } = ctx;
  const markers = [
    ...siblingMarkers.filter((item) => item.id !== marker.id),
    marker,
  ];
  return buildDevices({ ...base, markers })
    .find((device) => device.id === marker.id) || null;
}

/**
 * Light situation of an area: 'on' if any light entity of the area's devices is on,
 * 'off' if lights exist but none is on, 'none' when the area has no lights at all.
 */
export function areaLights(hass: any, devices: readonly LightSourceDevice[], area: string): 'on' | 'off' | 'none' {
  return resolvedLightState(resolvedLightSources(hass, devices, area));
}

/**
 * Explicit room measurement source: 'entity:<eid>' reads the state as a
 * number; 'device:<id>' aggregates over that device's entities (tempFor /
 * humFor). Used by the room-settings override (tier 3).
 */
export function sourceValue(
  hass: any, src: string | null | undefined, kind: 'temp' | 'hum',
  markers?: readonly Marker[] | null,
): number | null {
  if (!src) return null;
  if (isRemovedPlanSource(hass, src, markers)) return null;
  const i = src.indexOf(':');
  if (i < 0) return null;
  const k = src.slice(0, i);
  const ref = src.slice(i + 1);
  if (!ref) return null;
  if (k === 'entity') {
    const v = parseFloat(hass.states[ref]?.state);
    if (!Number.isFinite(v)) return null;
    return kind === 'temp' ? Math.round(v * 10) / 10 : Math.round(v);
  }
  if (k === 'device') {
    const entIds = Object.entries(hass.entities as Record<string, any>)
      .filter(([, r]) => (r as any).device_id === ref)
      .map(([eid]) => eid);
    return kind === 'temp' ? tempFor(hass, entIds) : humFor(hass, entIds);
  }
  return null;
}

/** Average humidity across the area's climate-ish devices (integer %, or null). */
export function areaHum(
  hass: any,
  devices: { area: string; icon?: string; entities: string[] }[],
  area: string,
): number | null {
  const vals: number[] = [];
  for (const dv of devices) {
    if (dv.area !== area) continue;
    // same filtering idea as areaTemp: climate sensors only, not fridges/plugs
    if (dv.icon !== 'mdi:thermometer' && dv.icon !== 'mdi:air-filter' && dv.icon !== 'mdi:water-percent') continue;
    const h = humFor(hass, dv.entities);
    if (h != null) vals.push(h);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Entity ids that measure something other than room air, however honest their
 * device_class is: water and coolant loops, chip/CPU/board temperatures,
 * battery temperature, setpoints (target/external) and the like.
 */
const NON_AIR_RE = new RegExp(
  [
    'water', 'voda', 'coolant', 'flow_?temp', 'return_?temp', 'target', 'setpoint',
    'chip', 'cpu', 'processor', 'board', 'core_temp', 'device_temp',
    'batter', 'akkum', 'freezer', 'fridge', 'oven', 'kettle', 'boiler',
  ].join('|'),
  'i',
);

/**
 * Room climate from EVERY sensor of the area — including devices that are not
 * placed on the plan (hidden by filtering or by the user). The old helpers read
 * the visible-icon list, so hiding a thermometer silently removed it from the
 * room card (field report, 2026-07-27).
 *
 * Filtering is kept: only devices the card itself recognises as thermometers /
 * air monitors count, so fridges, TRVs and chip-temperature plugs stay out.
 * The AUTO icon is used on purpose — a custom marker icon must not change what
 * a device measures.
 */
export interface AreaClimate { temp: number | null; hum: number | null }

/**
 * Stable lookup key for one room's automatic climate aggregate.
 *
 * HA-area rooms deliberately keep their historical raw area id. A local room
 * has no HA identity, so its key is namespaced by both space and room id; room
 * ids alone are not globally unique across imported spaces.
 */
export function roomClimateKey(
  spaceId: string | null | undefined,
  room: { id?: string | null; area?: string | null },
): string | null {
  if (room.area) return room.area;
  if (!spaceId || !room.id) return null;
  return `@room/${encodeURIComponent(spaceId)}/${encodeURIComponent(room.id)}`;
}

function markerClimateTarget(marker: Marker): string | null {
  // Persisted local-room placement uses an explicit null Area. Do not treat a
  // stale room_id without its space as a valid target or let it collide with a
  // room imported into another space.
  if (marker.area === null && marker.space && marker.room_id) {
    return roomClimateKey(marker.space, { id: marker.room_id, area: null });
  }
  return marker.area || null;
}

/**
 * Climate for EVERY area in one registry pass (review R2-3).
 *
 * The per-area version below rescanned the whole registry for each room and
 * each measurement: with 60 rooms and 2000 entities that is 120 traversals per
 * render — an entire frame spent re-reading metadata that did not change. The
 * caller computes this map once per `hass` snapshot and looks rooms up in O(1).
 */
export function roomClimateMap(
  hass: BuildCtx['hass'], rules?: CompiledIconRule[], markers?: Marker[] | null,
): Map<string, AreaClimate> {
  const out = new Map<string, AreaClimate>();
  if (!hass?.entities) return out;
  // Opt-in climate sources (marker.use_climate_temp): an AC or thermostat
  // knows the room temperature (current_temperature) - when the user ticks
  // the option, that reading votes in the room average like any thermometer.
  // The set holds binding refs (device ids and entity ids); with no opted
  // markers the pass below is byte-for-byte the old one.
  const removed = removedPlanBindings(markers);
  const climOpt = new Set<string>();
  const entityTargets = new Map<string, string>();
  const deviceTargets = new Map<string, string>();
  for (const m of markers || []) {
    if (m?.removed) continue;
    const i = (m.binding || '').indexOf(':');
    if (i <= 0) continue;
    const kind = m.binding.slice(0, i);
    const ref = m.binding.slice(i + 1);
    if (!ref) continue;
    if (m.use_climate_temp === true) climOpt.add(ref);
    const target = markerClimateTarget(m);
    if (!target) continue;
    // Match buildDevices(): malformed duplicate live bindings resolve to the
    // first saved marker, never to two rooms and never to two votes.
    if (kind === 'entity' && !entityTargets.has(ref)) entityTargets.set(ref, target);
    else if (kind === 'device' && !deviceTargets.has(ref)) deviceTargets.set(ref, target);
  }
  // effective room target -> physical device (or lone entity) -> entities.
  // Choosing the target before grouping guarantees that a manually moved
  // reading cannot remain in its registry Area at the same time (#317).
  const byTarget = new Map<string, Map<string, { name: string; model?: string; ents: string[] }>>();
  for (const [eid, reg] of Object.entries<any>(hass.entities)) {
    // A device tombstone suppresses all of its data. An entity tombstone only
    // suppresses a standalone entity; inside its live parent device it remains
    // available to device state, cards and room aggregates.
    if ((reg.device_id && removed.devices.has(reg.device_id) && !removed.liveEntities.has(eid))
        || (!reg.device_id && removed.entities.has(eid) && !removed.liveEntities.has(eid))) continue;
    const dev = reg.device_id ? hass.devices?.[reg.device_id] : null;
    if (!isRegistryEntryEnabled(reg) || (dev && !isRegistryEntryEnabled(dev))) continue;
    const target = entityTargets.get(eid)
      || (reg.device_id ? deviceTargets.get(reg.device_id) : null)
      || reg.area_id || dev?.area_id || null;
    if (!target) continue;
    // Not every "temperature" is room air. Real finds on a live install: the
    // NAS processor temperature, the water in a smart kettle, a sauna heater at
    // 90 C and a virtual better_thermostat duplicating the real sensor (field
    // question, 2026-07-27). Three guards, cheapest first:
    if (reg.entity_category) continue;              // diagnostic/config readings
    // An explicitly opted climate entity skips the platform/name filters:
    // the tick is the user saying "this one DOES measure room air" - even on
    // an excluded platform (better_thermostat) or a suspicious entity id.
    const optClimate = climOpt.size > 0 && eid.startsWith('climate.')
      && (climOpt.has(eid) || (reg.device_id && climOpt.has(reg.device_id)));
    if (!optClimate) {
      if (EXCLUDED_DOMAINS.has(reg.platform)) continue; // filtered-out integrations
      if (NON_AIR_RE.test(eid)) continue;             // water/chip/flow/target/...
    }
    let groups = byTarget.get(target);
    if (!groups) { groups = new Map(); byTarget.set(target, groups); }
    const key = reg.device_id || eid;
    let g = groups.get(key);
    if (!g) {
      const st = hass.states?.[eid];
      g = {
        name: (dev ? dev.name_by_user || dev.name : reg.name || st?.attributes?.friendly_name || eid) || eid,
        model: dev?.model,
        ents: [],
      };
      groups.set(key, g);
    }
    g.ents.push(eid);
  }
  for (const [target, groups] of byTarget) {
    const temps: number[] = [];
    const hums: number[] = [];
    for (const [key, g] of groups) {
      const icon = resolveIcon(hass, g.name, g.model, g.ents, rules);
      const air = icon === 'mdi:thermometer' || icon === 'mdi:air-filter';
      if (air) {
        const t = tempFor(hass, g.ents);
        if (t != null) temps.push(t);
      }
      // opted climate device/entity: current_temperature joins the average
      if (climOpt.size > 0 && (climOpt.has(key) || g.ents.some((e) => climOpt.has(e)))) {
        const t = climateTempFor(hass, g.ents);
        if (t != null) temps.push(t);
      }
      if (air || icon === 'mdi:water-percent') {
        const h = humFor(hass, g.ents);
        if (h != null) hums.push(h);
      }
    }
    if (!temps.length && !hums.length) continue;
    out.set(target, {
      temp: temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
      hum: hums.length ? Math.round(hums.reduce((a, b) => a + b, 0) / hums.length) : null,
    });
  }
  return out;
}

/**
 * Historical area-only name retained for callers and integrations. The map
 * still uses raw HA area ids; when explicit local-room markers are supplied it
 * may additionally contain namespaced room keys returned by roomClimateKey().
 */
export function areaClimateMap(
  hass: BuildCtx['hass'], rules?: CompiledIconRule[], markers?: Marker[] | null,
): Map<string, AreaClimate> {
  return roomClimateMap(hass, rules, markers);
}

/** One area's reading. Convenience wrapper — prefer the map for many areas. */
export function areaClimate(
  hass: any, area: string, kind: 'temp' | 'hum', rules?: CompiledIconRule[],
): number | null {
  if (!area) return null;
  return areaClimateMap(hass, rules).get(area)?.[kind] ?? null;
}

/** How many of the area's lights are on: {on, total}, or null without lights. */
export function areaLightStats(
  hass: any,
  devices: readonly LightSourceDevice[],
  area: string,
): { on: number; total: number } | null {
  return resolvedLightStats(resolvedLightSources(hass, devices, area));
}

/** Average temperature across the area's devices (null when nothing reports one). */
/** Average zigbee signal (LQI) across an area's non-virtual devices, or null. */
export function areaLqi(hass: any, devices: { area: string; virtual?: boolean; entities: string[] }[], area: string): number | null {
  const vals: number[] = [];
  for (const d of devices) {
    if (d.area !== area || d.virtual) continue;
    const l = lqiFor(hass, d.entities);
    if (l != null) vals.push(l);
  }
  return averageLqi(vals);
}

export function areaTemp(
  hass: any,
  devices: { area: string; icon?: string; entities: string[] }[],
  area: string,
): number | null {
  const vals: number[] = [];
  for (const d of devices) {
    if (d.area !== area) continue;
    // Учитываем только устройства, которые сама карточка считает термометрами —
    // не холодильники, термоголовки, розетки с температурой чипа и т.п.
    if (d.icon !== 'mdi:thermometer' && d.icon !== 'mdi:air-filter') continue;
    const t = tempFor(hass, d.entities);
    if (t != null) vals.push(t);
  }
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
