/**
 * Pure device-catalog projection for #29.
 *
 * The module deliberately owns neither Lit state nor persistence.  The card
 * supplies one registry snapshot and executes the capabilities exposed here
 * through its existing marker/config transactions.
 */
import type { HaBindingStatus } from './ha-binding-status';
import { isRemovedPlanEntity, removedPlanBindings } from './devices';
import type { DevItem, Marker } from './types';

export type DeviceInboxCategory = 'on_plan' | 'available' | 'hidden' | 'readd';
export type DeviceInboxReason =
  | 'visible_auto' | 'visible_explicit'
  | 'manual_hidden' | 'automatic_hidden'
  | 'service_entry' | 'excluded_integration' | 'excluded_domain'
  | 'grouped_light' | 'represented_by_parent'
  | 'removed' | 'available' | 'no_bound_room';

export interface BindingCandidate {
  value: string;
  label: string;
  sub: string;
  kind: 'device' | 'entity';
  ref: string;
  areaId: string;
  model: string;
  parentDeviceId?: string;
}

export interface BindingCandidateLabels {
  device: string;
  z2mGroup: string;
  group: string;
  helper: string;
  entity: string;
}

export interface BindingCandidateInput {
  hass: any;
  devices: readonly DevItem[];
  markers: readonly Marker[];
  showEntities: boolean;
  currentBinding?: string;
  currentDeviceId?: string;
  labels: BindingCandidateLabels;
}

const HELPER_PLATFORMS = new Set([
  'group', 'template', 'derivative', 'min_max', 'threshold', 'integration',
  'statistics', 'trend', 'utility_meter', 'tod', 'switch_as_x', 'schedule',
]);

/** One shared Add/catalog eligibility implementation.  Filtering and paging
 * happen after this function so an exact entity can never disappear behind a
 * pre-filter hard cap. */
export function bindingCandidates(input: BindingCandidateInput): BindingCandidate[] {
  const { hass: h, devices, markers, showEntities, currentBinding, currentDeviceId, labels } = input;
  const removed = removedPlanBindings(markers);
  const removedBindings = new Set(markers.filter((m) => m.removed).map((m) => m.binding));
  const taken = new Set<string>();
  for (const dev of devices) {
    if (dev.id === currentDeviceId) continue;
    if (dev.bindingKind === 'device' && dev.bindingRef) taken.add(`device:${dev.bindingRef}`);
    if (dev.bindingKind === 'entity' && dev.bindingRef) taken.add(`entity:${dev.bindingRef}`);
  }

  const shownKeys = new Set<string>();
  for (const dev of devices) {
    if (dev.bindingKind === 'device' && dev.name) shownKeys.add(`${dev.name.trim()}|${dev.area || ''}`);
  }

  const list: BindingCandidate[] = [];
  for (const dev of Object.values<any>(h?.devices || {})) {
    if (!dev || dev.entry_type === 'service') continue;
    const value = `device:${dev.id}`;
    if (taken.has(value)) continue;
    const name = String(dev.name_by_user || dev.name || dev.id).trim();
    if (value !== currentBinding && !removedBindings.has(value)
        && shownKeys.has(`${name}|${dev.area_id || ''}`)) continue;
    list.push({
      value, label: name,
      sub: (dev.model || labels.device) + (dev.model === 'Group' ? labels.z2mGroup : ''),
      kind: 'device', ref: dev.id, areaId: dev.area_id || '', model: dev.model || '',
    });
  }

  for (const [eid, reg] of Object.entries<any>(h?.entities || {})) {
    const value = `entity:${eid}`;
    if (taken.has(value)) continue;
    if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(value)) continue;
    const isHelper = HELPER_PLATFORMS.has(reg?.platform);
    const isGroup = reg?.platform === 'group';
    if (!isHelper && !isGroup) continue;
    if (reg?.hidden && !removedBindings.has(value)) continue;
    const state = h?.states?.[eid];
    list.push({
      value,
      label: reg?.name || state?.attributes?.friendly_name || eid,
      sub: `${eid.split('.')[0]} · ${isGroup ? labels.group : labels.helper}`,
      kind: 'entity', ref: eid,
      areaId: reg?.area_id || (reg?.device_id && h?.devices?.[reg.device_id]?.area_id) || '',
      model: '', parentDeviceId: reg?.device_id || undefined,
    });
  }

  if (showEntities) {
    const seen = new Set(list.map((item) => item.value));
    for (const [eid, reg] of Object.entries<any>(h?.entities || {})) {
      const value = `entity:${eid}`;
      if (taken.has(value) || seen.has(value) || (reg?.hidden && !removedBindings.has(value))) continue;
      const childOfRemovedDevice = !!reg?.device_id && removed.devices.has(reg.device_id);
      if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(value) && !childOfRemovedDevice) continue;
      const state = h?.states?.[eid];
      const parent = reg?.device_id ? h?.devices?.[reg.device_id] : null;
      const parentName = parent ? String(parent.name_by_user || parent.name || '') : '';
      list.push({
        value,
        label: reg?.name || state?.attributes?.friendly_name || eid,
        sub: `${eid.split('.')[0]} · ${labels.entity}${parentName ? ` · ${parentName}` : ''}`,
        kind: 'entity', ref: eid,
        areaId: reg?.area_id || parent?.area_id || '', model: '',
        parentDeviceId: reg?.device_id || undefined,
      });
    }
  }

  return list.sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}

export interface DeviceInboxRow {
  key: string;
  binding: string;
  category: DeviceInboxCategory;
  status: HaBindingStatus;
  reason: DeviceInboxReason;
  deviceId?: string;
  markerId?: string;
  name: string;
  icon: string;
  model: string;
  integration: string;
  areaId: string;
  areaName: string;
  spaceId: string;
  spaceName: string;
  kind: 'device' | 'entity';
  isNew: boolean;
  searchText: string;
  canFind: boolean;
  canEdit: boolean;
  canHide: boolean;
  canShow: boolean;
  canAdd: boolean;
}

export interface DeviceInboxInput {
  devices: readonly DevItem[];
  markers: readonly Marker[];
  candidates: readonly BindingCandidate[];
  statuses: ReadonlyMap<string, HaBindingStatus>;
  newDeviceIds: ReadonlySet<string>;
  showHiddenOnPlan: boolean;
  areaNames?: Readonly<Record<string, string>>;
  spaceNames?: Readonly<Record<string, string>>;
  spaceByArea?: Readonly<Record<string, string>>;
  integrationByBinding?: Readonly<Record<string, string>>;
  /** Best-effort explanation of an automatically hidden/represented binding. */
  reasonByBinding?: Readonly<Record<string, DeviceInboxReason>>;
}

const ACTIVE_STATUS: HaBindingStatus = {
  kind: 'active', enabledEntityIds: [], allEntityIds: [],
};

function markerBindingKind(binding: string): 'device' | 'entity' {
  return binding.startsWith('entity:') ? 'entity' : 'device';
}

function autoHiddenMarker(marker: Marker): boolean {
  const split = marker.binding.indexOf(':');
  const ref = split >= 0 ? marker.binding.slice(split + 1) : '';
  const meaningful = Object.keys(marker).filter((key) => !['id', 'binding', 'hidden'].includes(key));
  return marker.id === `h${ref}` && meaningful.length === 0;
}

/** Build one deterministic row for every exact binding in the catalog. */
export function buildDeviceInbox(input: DeviceInboxInput): DeviceInboxRow[] {
  const {
    devices, markers, candidates, statuses, newDeviceIds, showHiddenOnPlan,
    areaNames = {}, spaceNames = {}, spaceByArea = {}, integrationByBinding = {},
    reasonByBinding = {},
  } = input;
  const runtimeByBinding = new Map<string, DevItem>();
  for (const device of devices) {
    if (device.virtual || !device.bindingKind || device.bindingKind === 'virtual' || !device.bindingRef) continue;
    runtimeByBinding.set(`${device.bindingKind}:${device.bindingRef}`, device);
  }
  const liveByBinding = new Map<string, Marker>();
  const removedByBinding = new Map<string, Marker>();
  for (const marker of markers) {
    if (!marker?.binding || marker.binding === 'virtual') continue;
    if (marker.removed) removedByBinding.set(marker.binding, marker);
    else liveByBinding.set(marker.binding, marker);
  }
  const candidateByBinding = new Map(candidates.map((item) => [item.value, item]));
  const keys = new Set<string>([
    ...runtimeByBinding.keys(), ...liveByBinding.keys(), ...candidateByBinding.keys(),
    ...[...removedByBinding.keys()].filter((key) => candidateByBinding.has(key)),
  ]);

  const rows: DeviceInboxRow[] = [];
  for (const binding of keys) {
    const runtime = runtimeByBinding.get(binding);
    const live = liveByBinding.get(binding);
    const removed = live ? undefined : removedByBinding.get(binding);
    const candidate = candidateByBinding.get(binding);
    let category: DeviceInboxCategory;
    if (removed && candidate) category = 'readd';
    else if (live?.hidden === true) category = 'hidden';
    else if (runtime || live) category = 'on_plan';
    else if (candidate) category = 'available';
    else continue;

    const status = runtime?.bindingStatus || statuses.get(binding) || ACTIVE_STATUS;
    const marker = live || removed;
    const kind = markerBindingKind(binding);
    const areaId = runtime?.area || candidate?.areaId || marker?.area || '';
    const spaceId = runtime?.space || marker?.space || spaceByArea[areaId] || '';
    const name = runtime?.name || marker?.name || candidate?.label || binding;
    const model = runtime?.model || marker?.model || candidate?.model || '';
    const representedByParent = !!candidate?.parentDeviceId
      && runtimeByBinding.has(`device:${candidate.parentDeviceId}`);
    const reason: DeviceInboxReason = category === 'readd' ? 'removed'
      : category === 'hidden' ? (live && autoHiddenMarker(live)
        ? reasonByBinding[binding] || 'automatic_hidden' : 'manual_hidden')
        : category === 'on_plan' ? (live ? 'visible_explicit' : 'visible_auto')
          : reasonByBinding[binding] || (representedByParent ? 'represented_by_parent'
            : areaId && spaceId ? 'available' : 'no_bound_room');
    const isRendered = !!runtime && (!runtime.hidden || showHiddenOnPlan);
    const active = status.kind === 'active';
    const canFind = isRendered && (active
      || (status.kind === 'ha_disabled' && showHiddenOnPlan));
    const searchText = [
      name, model, integrationByBinding[binding], areaNames[areaId], spaceNames[spaceId],
      binding, candidate?.sub,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    rows.push({
      key: binding, binding, category, status, reason,
      deviceId: runtime?.id,
      markerId: marker?.id,
      name, icon: runtime?.icon || marker?.icon || (kind === 'entity' ? 'mdi:code-braces' : 'mdi:devices'),
      model, integration: integrationByBinding[binding] || '',
      areaId, areaName: areaNames[areaId] || '',
      spaceId, spaceName: spaceNames[spaceId] || '',
      kind, isNew: !!runtime && newDeviceIds.has(runtime.id), searchText,
      canFind,
      canEdit: !!runtime || !!live,
      canHide: category === 'on_plan' && active,
      canShow: category === 'hidden' && active,
      canAdd: (category === 'available' || category === 'readd') && active,
    });
  }
  const statusRank = (row: DeviceInboxRow): number => row.status.kind === 'active' ? 1 : 0;
  return rows.sort((a, b) => a.category.localeCompare(b.category)
    || Number(b.isNew) - Number(a.isNew)
    || statusRank(a) - statusRank(b)
    || a.name.localeCompare(b.name) || a.binding.localeCompare(b.binding));
}

export function filterDeviceInbox(
  rows: readonly DeviceInboxRow[], category: DeviceInboxCategory, query: string, onlyNew = false,
): DeviceInboxRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter((row) => row.category === category
    && (!onlyNew || row.isNew)
    && (!needle || row.searchText.includes(needle)));
}
