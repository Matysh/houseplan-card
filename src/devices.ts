/**
 * Building the device list from HA registries: curation, light groups,
 * markers (overrides/virtual). No Lit/DOM — only the hass object.
 */
import { iconFor, iconFromDeviceClasses, DOMAIN_PRIORITY, FALLBACK_ICON, type CompiledIconRule } from './rules';
import { averageLqi } from './logic';
import type { DevItem, Marker, ServerConfig } from './types';

/** Build context: a slice of hass + config resolution. */
export interface BuildCtx {
  hass: any;
  /** area_id → space_id (only zones bound to rooms). */
  areaToSpace: Record<string, string>;
  markers: Marker[];
  settings: ServerConfig['settings'];
  excluded: Set<string>;
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

export function primaryEntity(hass: any, entIds: string[], icon: string): string | undefined {
  const ents = entIds
    .map((eid) => ({ eid, reg: hass.entities[eid], st: hass.states[eid] }))
    .filter((e) => e.reg && !e.reg.hidden);
  const usable = ents.filter((e) => !e.reg.entity_category);
  const pool = usable.length ? usable : ents;
  if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') {
    const t = pool.find((e) => isTempEntity(hass, e.eid));
    if (t) return t.eid;
  }
  for (const dom of DOMAIN_PRIORITY) {
    const found = pool.find((e) => e.eid.split('.')[0] === dom);
    if (found) return found.eid;
  }
  return pool[0]?.eid;
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
function resolveIcon(hass: any, name: string, model: string | undefined, entIds: string[], rules?: CompiledIconRule[]): string {
  const byRules = iconFor(name, model, rules);
  if (byRules !== FALLBACK_ICON) return byRules;
  const classes: string[] = [];
  for (const eid of entIds) {
    const dc = hass.states[eid]?.attributes?.device_class;
    if (dc) classes.push(dc);
  }
  return iconFromDeviceClasses(classes) ?? FALLBACK_ICON;
}

function applyMarker(item: DevItem, m: Marker): void {
  item.marker = m;
  if (m.name) item.name = m.name;
  if (m.icon) item.icon = m.icon;
  if (m.model != null) item.model = m.model;
  item.link = m.link ?? null;
  item.description = m.description ?? null;
  item.pdfs = m.pdfs || [];
  item.tapAction = m.tap_action ?? null;
}

/** Curation + light groups + markers (metadata/rebinding) + virtual ones. A hybrid. */
export function buildDevices(ctx: BuildCtx): DevItem[] {
  const { hass: h, areaToSpace, markers, settings, excluded, showAll, firstSpaceId, loc, iconRules } = ctx;
  const groupLights = settings.group_lights !== false;
  const groups = lightGroups(h, groupLights);
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
    if (marker && marker.hidden) continue;
    const entIds = entsBy[dev.id] || [];
    const dom = domainOfDevice(h, dev, entIds);
    // curation (can be turned off with the “show all” toggle)
    if (!showAll) {
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
    if (!showAll && groupLights && icon === 'mdi:lightbulb' && groupedAreas.has(area)) continue;
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
    if (m.hidden) continue;
    const [kind, ref] = m.binding.split(':');
    if (kind === 'device') {
      const dev = h.devices[ref];
      const area = m.area || dev?.area_id || '';
      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;
      const entIds = dev ? entsBy[dev.id] || [] : [];
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
      applyMarker(item, m);
      rest.push(item);
    } else if (kind === 'entity') {
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
      applyMarker(item, m);
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
      applyMarker(item, m);
      rest.push(item);
    }
  }
  return rest;
}

/**
 * Light situation of an area: 'on' if any light entity of the area's devices is on,
 * 'off' if lights exist but none is on, 'none' when the area has no lights at all.
 */
export function areaLights(hass: any, devices: { area: string; entities: string[] }[], area: string): 'on' | 'off' | 'none' {
  let seen = false;
  for (const d of devices) {
    if (d.area !== area) continue;
    for (const eid of d.entities) {
      if (!eid.startsWith('light.')) continue;
      seen = true;
      if (hass.states[eid]?.state === 'on') return 'on';
    }
  }
  return seen ? 'off' : 'none';
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
    // same curation idea as areaTemp: climate sensors only, not fridges/plugs
    if (dv.icon !== 'mdi:thermometer' && dv.icon !== 'mdi:air-filter' && dv.icon !== 'mdi:water-percent') continue;
    const h = humFor(hass, dv.entities);
    if (h != null) vals.push(h);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** How many of the area's lights are on: {on, total}, or null without lights. */
export function areaLightStats(
  hass: any,
  devices: { area: string; entities: string[] }[],
  area: string,
): { on: number; total: number } | null {
  const seen = new Set<string>();
  let on = 0;
  for (const dv of devices) {
    if (dv.area !== area) continue;
    for (const eid of dv.entities) {
      if (!eid.startsWith('light.') || seen.has(eid)) continue;
      seen.add(eid);
      if (hass.states[eid]?.state === 'on') on++;
    }
  }
  return seen.size ? { on, total: seen.size } : null;
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
