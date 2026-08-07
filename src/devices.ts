/**
 * Building the device list from HA registries: filtering, light groups,
 * markers (overrides/virtual). No Lit/DOM — only the hass object.
 */
import { iconFor, iconFromDeviceClasses, DOMAIN_PRIORITY, FALLBACK_ICON, type CompiledIconRule, EXCLUDED_DOMAINS } from './rules';
import { averageLqi, isControllable } from './logic';
import { isSemanticBinaryEntity } from './device-visual';
import type { DevItem, Marker, ServerConfig } from './types';

/** Build context: a slice of hass + config resolution. */
export interface BuildCtx {
  hass: any;
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
    if (ent?.device_id) (map[ent.device_id] = map[ent.device_id] || []).push(eid);
  }
  return map;
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
 *   4) switches only when the device has no stronger state-bearing role;
 *   5) passive entities together, so one unavailable sensor does not make the
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
  if (switches.length) return visibleFirst(switches).map((item) => item.eid);

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
  return resolvedDeviceStateEntities(hass, entIds)[0];
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
    binding?: string;
    room_id?: string | null;
    is_light?: boolean | null;
    controls?: string[] | null;
  } | null;
}

export type LightSourceRoom = string | { id?: string | null; area?: string | null };

export interface ResolvedLightSource<D extends LightSourceDevice = LightSourceDevice> {
  /** HA entity that carries the source's on/off state and accepts controls. */
  eid: string;
  /** Device/marker which places this source on the plan. */
  device: D;
  /** Why this entity belongs to the light-source set. */
  via: 'controls' | 'forced' | 'light';
  on: boolean;
}

/**
 * Controls are OTHER light targets operated by this marker. A marker already
 * operates its own bound entity/device through the normal tap action; storing
 * one of those same entities in controls made a plain fan/socket look like an
 * explicitly configured light source. `is_light` is the sole explicit way to
 * say that the bound switch itself drives a real fixture.
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
 * normal tap action (or migrates to `is_light` for a legacy self-switch).
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

/**
 * Before `is_light` existed, putting a marker's own switch into `controls`
 * was the supported way to say that the relay drives a real fixture. Keep that
 * intent alive until Save/Optimize converts the legacy representation.
 */
export function hasLegacySelfLightIntent(
  binding: string | null | undefined,
  controls: readonly string[] | null | undefined,
  ownEntities: readonly string[] = [],
): boolean {
  const own = binding?.startsWith('entity:')
    ? new Set([binding.slice('entity:'.length)])
    : new Set(ownEntities);
  return (controls || []).some((eid) => eid.startsWith('switch.') && own.has(eid));
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
  eid: string;
  via: ResolvedLightSource['via'];
}

function forcedLightEntityOf(d: LightSourceDevice): string | null {
  const bound = d.marker?.binding?.startsWith('entity:')
    ? d.marker.binding.slice('entity:'.length) : null;
  const controllable = d.entities.filter(isControllable);
  const primary = d.primary && isControllable(d.primary) ? d.primary : null;
  // An entity-bound legacy self-control names the physical relay exactly.
  // Do not let a different registry-derived primary entity steal that intent.
  return (bound && isControllable(bound) ? bound : null) || primary || controllable[0] || null;
}

function lightEntitiesOf(hass: any, d: LightSourceDevice): LightEntityCandidate[] {
  const controls = effectiveMarkerControls(
    d.marker?.binding,
    d.controls ?? d.marker?.controls,
    d.entities,
  );
  const out: LightEntityCandidate[] = controls.map((eid) => ({ eid, via: 'controls' }));

  if (d.marker?.is_light === true || hasLegacySelfLightIntent(
    d.marker?.binding, d.marker?.controls, d.entities,
  )) {
    // A forced source is a smart switch (or light) driving real fixtures.
    // Prefer its primary entity, but never treat measurements or service
    // entities as light switches merely because they belong to the device.
    // The marker is one physical source, so do not count its auxiliary
    // controllable entities as additional lamps in room statistics.
    const forced = forcedLightEntityOf(d);
    if (forced && !out.some((candidate) => candidate.eid === forced)) {
      out.push({ eid: forced, via: 'forced' });
    }
  }

  // Explicit external controls and the marker's own explicit source are
  // additive. Automatic discovery remains the fallback only when neither was
  // configured, so a device status LED still cannot leak into the room light set.
  if (out.length) return out;

  // Automatic light discovery describes the DEVICE, not every auxiliary
  // entity it happens to expose. TVs, soundbars, air cleaners and similar
  // devices often publish a light.* for a status LED / display illumination;
  // letting that entity win turned the whole marker yellow and made it a room
  // light source. The resolved functional role is the shared systemic answer.
  // Explicit controls/is_light above still override it when the user says the
  // auxiliary light really is a plan light.
  const role = d.primary || resolvedDeviceStateEntities(hass, d.entities)[0];
  if (role && !role.startsWith('light.')) return [];
  return d.entities.filter((eid) => eid.startsWith('light.'))
    .map((eid) => ({ eid, via: 'light' as const }));
}

/**
 * One source of truth for every light-related room feature. Explicit marker
 * controls win, then `is_light`, then automatic `light.*` discovery. Passing
 * a room scopes sources by room_id/area; omitting it resolves the supplied
 * devices (used by Glow and per-marker controls).
 */
export function resolvedLightSources<D extends LightSourceDevice>(
  hass: any,
  devices: readonly D[],
  room?: LightSourceRoom | null,
): ResolvedLightSource<D>[] {
  const out: ResolvedLightSource<D>[] = [];
  const seen = new Set<string>();
  for (const d of devices) {
    if (d.hidden || (room != null && !lightSourceBelongsToRoom(d, room))) continue;
    const candidates = lightEntitiesOf(hass, d);
    for (const { eid, via } of candidates) {
      if (!eid || seen.has(eid)) continue;
      seen.add(eid);
      out.push({ eid, device: d, via, on: hass.states[eid]?.state === 'on' });
    }
  }
  return out;
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
  return resolvedLightSources(hass, [{ ...d, area: d.area || '' }]).find((source) => source.on)?.eid || null;
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
    if (!eid.startsWith('light.') || reg.hidden) continue;
    let area: string | null = null;
    if (reg.platform === 'group') {
      area = reg.area_id || null;
    } else if (reg.device_id) {
      const dev = hass.devices[reg.device_id];
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
}

export interface DeletePlanMarkerResult {
  markers: Marker[];
  cleanupIds: Set<string>;
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
  for (const m of markers || []) {
    if (m?.removed !== true) continue;
    const i = String(m.binding || '').indexOf(':');
    if (i < 1) continue;
    const kind = m.binding.slice(0, i);
    const ref = m.binding.slice(i + 1);
    if (!ref) continue;
    if (kind === 'device') devices.add(ref);
    else if (kind === 'entity') entities.add(ref);
  }
  return { devices, entities };
}

/** Whether an HA entity is suppressed by an entity or whole-device tombstone. */
export function isRemovedPlanEntity(
  hass: any, eid: string, removed: RemovedPlanBindings,
): boolean {
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

function applyMarker(item: DevItem, m: Marker, hass: any, removed: RemovedPlanBindings): void {
  const controls = effectiveMarkerControls(m.binding, m.controls, item.entities)
    .filter((eid) => !isRemovedPlanEntity(hass, eid, removed));
  // Keep persisted configuration lossless. Runtime consumers use the filtered
  // projection above; the dialog edits the original list and therefore cannot
  // silently write a temporarily suppressed control out of the marker.
  item.marker = m;
  item.controls = controls;
  if (m.hidden) item.hidden = true;
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
  const { hass: h, areaToSpace, markers, settings, excluded, iconRules } = ctx;
  const groupLights = settings.group_lights !== false;
  const removed = removedPlanBindings(markers);
  const groups = lightGroups(h, groupLights)
    .filter((g) => !isRemovedPlanEntity(h, g.eid, removed));
  const groupedAreas = new Set(groups.map((g) => g.area));
  const entsBy = entitiesByDevice(h);
  const marked = new Set(markers.map((m) => m.binding));
  const out: string[] = [];
  for (const dev of Object.values<any>(h.devices)) {
    const area = dev.area_id;
    if (!area || !areaToSpace[area]) continue;
    if (dev.entry_type === 'service') continue;
    if (marked.has('device:' + dev.id)) continue;
    // An entity tombstone suppresses that standalone binding, not the same
    // entity as data belonging to a still-live parent device.
    const entIds = entsBy[dev.id] || [];
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

/** Filtering + light groups + markers (metadata/rebinding) + virtual ones. A hybrid. */
export function buildDevices(ctx: BuildCtx): DevItem[] {
  const { hass: h, areaToSpace, markers, settings, excluded, showAll, firstSpaceId, loc, iconRules } = ctx;
  const groupLights = settings.group_lights !== false;
  const removed = removedPlanBindings(markers);
  const groups = lightGroups(h, groupLights)
    .filter((g) => !isRemovedPlanEntity(h, g.eid, removed));
  const groupedAreas = new Set(groups.map((g) => g.area));
  const entsBy = entitiesByDevice(h);
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
    const marker = markerFor('device', dev.id);
    if (marker && marker.hidden && !settings.filter_seeded) continue; // legacy: dropped entirely
    const entIds = entsBy[dev.id] || [];
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
      primary: g.eid,
      bindingKind: 'entity',
      bindingRef: g.eid,
      pdfs: [],
    });
  }

  // 3) explicit markers (rebinding/metadata/virtual)
  for (const m of markers) {
    if (m.removed) continue;
    // Hidden is a FLAG now, not an absence: the device is built (room LQI
    // still counts it) and the renderer decides. Legacy configs keep the old
    // "hidden = gone" until they are seeded (docs/FILTERING.md).
    if (m.hidden && !settings.filter_seeded) continue;
    const [kind, ref] = m.binding.split(':');
    if (kind === 'device') {
      const dev = h.devices[ref];
      const area = m.area || dev?.area_id || '';
      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;
      const entIds = dev
        ? (entsBy[dev.id] || [])
        : [];
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
        bindingKind: 'device',
        bindingRef: ref,
      };
      item.primary = primaryEntity(h, entIds, icon);
      if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = tempFor(h, entIds);
      if (item.primary && isHumEntity(h, item.primary)) item.hum = humFor(h, entIds);
    if (item.primary && isHumEntity(h, item.primary)) item.hum = humFor(h, entIds);
      applyMarker(item, m, h, removed);
      rest.push(item);
    } else if (kind === 'entity') {
      if (isRemovedPlanEntity(h, ref, removed)) continue;
      const reg = h.entities[ref];
      const area = m.area || reg?.area_id || (reg?.device_id && h.devices[reg.device_id]?.area_id) || '';
      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;
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
        entities: [ref],
        primary: ref,
        bindingKind: 'entity',
        bindingRef: ref,
      };
      if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = tempFor(h, [ref]);
      if (isHumEntity(h, ref)) item.hum = humFor(h, [ref]);
      applyMarker(item, m, h, removed);
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
        bindingKind: 'virtual',
        virtual: true,
      };
      applyMarker(item, m, h, removed);
      rest.push(item);
    }
  }
  return rest;
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
 * Climate for EVERY area in one registry pass (review R2-3).
 *
 * The per-area version below rescanned the whole registry for each room and
 * each measurement: with 60 rooms and 2000 entities that is 120 traversals per
 * render — an entire frame spent re-reading metadata that did not change. The
 * caller computes this map once per `hass` snapshot and looks rooms up in O(1).
 */
export function areaClimateMap(
  hass: any, rules?: CompiledIconRule[], markers?: Marker[] | null,
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
  for (const m of markers || []) {
    if (m?.removed || m?.use_climate_temp !== true) continue;
    const i = (m.binding || '').indexOf(':');
    if (i > 0) climOpt.add(m.binding.slice(i + 1));
  }
  // area -> device (or lone entity) -> the entities that belong to it
  const byArea = new Map<string, Map<string, { name: string; model?: string; ents: string[] }>>();
  for (const [eid, reg] of Object.entries<any>(hass.entities)) {
    // A device tombstone suppresses all of its data. An entity tombstone only
    // suppresses a standalone entity; inside its live parent device it remains
    // available to device state, cards and room aggregates.
    if ((reg.device_id && removed.devices.has(reg.device_id))
        || (!reg.device_id && removed.entities.has(eid))) continue;
    const dev = reg.device_id ? hass.devices?.[reg.device_id] : null;
    const area = reg.area_id || dev?.area_id || null;
    if (!area) continue;
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
    let groups = byArea.get(area);
    if (!groups) { groups = new Map(); byArea.set(area, groups); }
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
  for (const [area, groups] of byArea) {
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
    out.set(area, {
      temp: temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
      hum: hums.length ? Math.round(hums.reduce((a, b) => a + b, 0) / hums.length) : null,
    });
  }
  return out;
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
