/** Pure Device-editor draft model for #485. */
import type {
  DevItem, MarkerRadar, RadarLengthUnit, RadarProfile, SpaceModel,
} from './types';
import { isMarkerRadarV1 } from './radar-model';

export interface RadarEditorDraft {
  original: MarkerRadar | null;
  enabled: boolean;
  showLive: boolean;
  profile: RadarProfile;
  roomId: string;
  installationId: string;
  mountX: string;
  mountY: string;
  heading: string;
  rangeCm: string;
  fovDeg: string;
  mirror: boolean;
  unit: RadarLengthUnit;
  xEntities: string[];
  yEntities: string[];
  distanceEntities: string[];
  angleEntities: string[];
  rangeEntities: string[];
  slotPresenceEntities: string[];
  rangePresenceEntities: string[];
  swapXY: boolean[];
  xSigns: (1 | -1)[];
  ySigns: (1 | -1)[];
  angleUnit: 'degrees' | 'radians';
  angleZero: 'forward' | 'right';
  angleClockwise: boolean;
  occupancyEntity: string;
  countEntity: string;
  availabilityEntity: string;
  zoneEntity: string;
  zoneKind: 'occupancy' | 'count';
  /** Session-only result of Configure on plan; persisted only by marker Save. */
  calibrationOverride?: MarkerRadar['calibration'];
  inspectBusy?: boolean;
  inspectError?: string;
  inspection?: {
    frame?: { health?: string; targets?: unknown[]; ranges?: unknown[]; complete?: boolean };
    sources?: { entity_id?: string; state?: string | null; reported_at?: number }[];
  };
}

export interface RadarRecognition {
  eligible: boolean;
  profile: RadarProfile;
  reason: 'saved' | 'saved_unsupported' | 'ld2450' | 'radar_metadata' | 'none';
}

const LD2450_MODELS = new Set(['ld2450', 'hlkld2450', 'hilinkld2450']);

const canonicalModel = (value: unknown): string => String(value || '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

export const freshRadarInstallationId = (): string => (
  globalThis.crypto?.randomUUID?.()
  || `radar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
);

export const radarAfterBindingChange = (
  radar: RadarEditorDraft | null, touched: boolean, remove: boolean,
) => {
  const saved = !!radar?.original;
  return {
    radar: saved ? radar : null,
    radarEligible: saved,
    radarTouched: saved ? touched : touched || !!radar,
    radarRemove: saved ? remove : remove || !!radar,
  };
};

interface RadarRegistryEntity { device_id?: string }
interface RadarRegistryDevice {
  model?: string;
  manufacturer?: string;
  name?: string;
  name_by_user?: string;
}
export interface RadarHassLike {
  states?: Record<string, { state?: string; attributes?: Record<string, unknown> }>;
  entities?: Record<string, RadarRegistryEntity>;
  devices?: Record<string, RadarRegistryDevice>;
}

const finiteText = (value: unknown, fallback = ''): string => (
  typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback
);

const deviceEntityIds = (device: DevItem): string[] => Array.from(new Set([
  ...(device.allEntities || device.entities || []),
  ...(device.bindingKind === 'entity' && device.bindingRef ? [device.bindingRef] : []),
])).filter((entityId) => /^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId));

const suffixScore = (entityId: string, axis: 'x' | 'y', slot: number): boolean => {
  const objectId = entityId.split('.', 2)[1] || '';
  return new RegExp(`(?:^|_)target_?${slot}_${axis}(?:_|$)`).test(objectId)
    || new RegExp(`(?:^|_)target_${axis}_${slot}(?:_|$)`).test(objectId);
};

export function recognizeRadar(
  device: DevItem,
  registryHass: RadarHassLike,
): RadarRecognition {
  if (device.marker?.radar && typeof device.marker.radar === 'object') {
    if (isMarkerRadarV1(device.marker.radar)) {
      return { eligible: true, profile: device.marker.radar.profile, reason: 'saved' };
    }
    return { eligible: true, profile: 'presence_v1', reason: 'saved_unsupported' };
  }
  const registryEntity = device.bindingKind === 'entity'
    ? registryHass?.entities?.[device.bindingRef || ''] : null;
  const deviceId = device.bindingKind === 'device'
    ? device.bindingRef : registryEntity?.device_id;
  const registryDevice = deviceId ? registryHass?.devices?.[deviceId] : null;
  const entities = deviceEntityIds(device);
  if (LD2450_MODELS.has(canonicalModel(registryDevice?.model || device.model))
      && entities.some((entityId) => suffixScore(entityId, 'x', 1))
      && entities.some((entityId) => suffixScore(entityId, 'y', 1))) {
    return { eligible: true, profile: 'esphome_ld2450_v1', reason: 'ld2450' };
  }
  return { eligible: false, profile: 'presence_v1', reason: 'none' };
}

function pickEntity(entities: readonly string[], tests: RegExp[]): string {
  return entities.find((entityId) => tests.some((test) => test.test(entityId))) || '';
}

function defaultSources(device: DevItem, profile: RadarProfile, hass: RadarHassLike) {
  const entities = deviceEntityIds(device).filter((entityId) => !!hass?.states?.[entityId]);
  const xEntities: string[] = [];
  const yEntities: string[] = [];
  for (let slot = 1; slot <= 3; slot++) {
    xEntities.push(entities.find((entityId) => suffixScore(entityId, 'x', slot)) || '');
    yEntities.push(entities.find((entityId) => suffixScore(entityId, 'y', slot)) || '');
  }
  const binary = entities.filter((entityId) => entityId.startsWith('binary_sensor.'));
  const sensors = entities.filter((entityId) => entityId.startsWith('sensor.'));
  const occupancyEntity = pickEntity(binary, [/(?:occupancy|presence|target)(?:_|$)/]);
  return {
    xEntities, yEntities,
    distanceEntity: pickEntity(sensors, [/(?:target_)?distance(?:_|$)/, /distance/]),
    angleEntity: pickEntity(sensors, [/(?:target_)?angle(?:_|$)/, /angle/]),
    occupancyEntity,
    countEntity: pickEntity(sensors, [/(?:target|people|presence)_count(?:_|$)/, /target_count/]),
    zoneEntity: profile === 'zones_v1'
      ? pickEntity(binary, [/(?:zone|region).*(?:occupancy|presence)/, /zone/]) : '',
  };
}

export function radarDraft(
  device: DevItem,
  space: SpaceModel,
  markerPoint: readonly [number, number],
  registryHass: RadarHassLike,
  forceManual = false,
): RadarEditorDraft | null {
  const recognition = recognizeRadar(device, registryHass);
  const original = isMarkerRadarV1(device.marker?.radar) ? device.marker.radar : null;
  if (!original && !recognition.eligible && !forceManual) return null;
  const profile = original?.profile || recognition.profile;
  const defaults = forceManual && !recognition.eligible || recognition.reason !== 'ld2450'
    ? {
        xEntities: ['', '', ''], yEntities: ['', '', ''], distanceEntity: '', angleEntity: '',
        occupancyEntity: '', countEntity: '', zoneEntity: '',
      }
    : defaultSources(device, profile, registryHass);
  const sources = original?.sources || {};
  const slots = sources.slots || [];
  const cartesian = slots.filter((slot): slot is import('./types').RadarCartesianSlot =>
    'x_entity' in slot);
  const polar = slots.filter((slot): slot is import('./types').RadarPolarSlot =>
    'distance_entity' in slot);
  const ranges = sources.ranges || [];
  const zone = sources.zones?.[0];
  const targetCount = profile === 'esphome_ld2450_v1' ? 3
    : profile === 'cartesian_v1' ? Math.max(1, cartesian.length)
    : profile === 'polar_v1' ? Math.max(1, polar.length) : 1;
  const roomId = original?.room_id || device.marker?.room_id
    || space.rooms.find((room) => room.area && room.area === device.area)?.id || '';
  return {
    original,
    // Recognition only reveals the setup entry. A new radar remains off until
    // the administrator explicitly enables it and completes the ordinary Save.
    enabled: original?.enabled === true,
    showLive: original?.show_live !== false,
    profile,
    roomId,
    installationId: original?.mount?.installation_id || freshRadarInstallationId(),
    // The editor canvas is 0..1000; persisted plan coordinates remain the
    // canonical 0..1 space used by rooms and wall geometry.
    mountX: finiteText(original?.mount?.x == null ? undefined : original.mount.x * 1000,
      finiteText(markerPoint[0], '0')),
    mountY: finiteText(original?.mount?.y == null ? undefined : original.mount.y * 1000,
      finiteText(markerPoint[1], '0')),
    heading: finiteText(original?.mount?.heading_deg, '0'),
    rangeCm: finiteText(original?.mount?.range_cm, profile === 'esphome_ld2450_v1' ? '600' : ''),
    fovDeg: finiteText(original?.mount?.fov_deg, profile === 'esphome_ld2450_v1' ? '120' : ''),
    mirror: original?.calibration?.mirror === true,
    unit: (cartesian[0]?.unit || polar[0]?.unit || ranges[0]?.unit || (profile === 'esphome_ld2450_v1' ? 'mm' : 'cm')) as RadarLengthUnit,
    xEntities: Array.from({ length: targetCount },
      (_, index) => cartesian[index]?.x_entity || defaults.xEntities[index] || ''),
    yEntities: Array.from({ length: targetCount },
      (_, index) => cartesian[index]?.y_entity || defaults.yEntities[index] || ''),
    distanceEntities: Array.from({ length: targetCount }, (_, index) =>
      polar[index]?.distance_entity || (index === 0 ? defaults.distanceEntity : '')),
    angleEntities: Array.from({ length: targetCount }, (_, index) =>
      polar[index]?.angle_entity || (index === 0 ? defaults.angleEntity : '')),
    rangeEntities: ranges.length ? ranges.map((source) => source.entity_id)
      : [defaults.distanceEntity],
    slotPresenceEntities: Array.from({ length: targetCount }, (_, index) =>
      (cartesian[index] || polar[index])?.presence_entity || ''),
    rangePresenceEntities: (ranges.length ? ranges : [{}]).map((source) =>
      'presence_entity' in source ? source.presence_entity || '' : ''),
    swapXY: Array.from({ length: targetCount }, (_, index) => cartesian[index]?.swap_xy === true),
    xSigns: Array.from({ length: targetCount }, (_, index) => cartesian[index]?.x_sign === -1 ? -1 : 1),
    ySigns: Array.from({ length: targetCount }, (_, index) => cartesian[index]?.y_sign === -1 ? -1 : 1),
    angleUnit: polar[0]?.angle_unit || 'degrees',
    angleZero: polar[0]?.angle_zero || 'forward',
    angleClockwise: polar[0]?.angle_clockwise !== false,
    occupancyEntity: sources.occupancy_entity || defaults.occupancyEntity,
    countEntity: sources.count_entity || defaults.countEntity,
    availabilityEntity: sources.availability_entity || '',
    zoneEntity: zone?.entity_id || defaults.zoneEntity,
    zoneKind: zone?.kind || 'occupancy',
  };
}

const numeric = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export function radarConfigFromDraft(draft: RadarEditorDraft, cellCm: number): MarkerRadar | null {
  const mountX = numeric(draft.mountX);
  const mountY = numeric(draft.mountY);
  const heading = numeric(draft.heading);
  if (!draft.roomId || mountX == null || mountY == null || heading == null) return null;
  const sources: MarkerRadar['sources'] = { ...(draft.original?.sources || {}) };
  delete sources.slots;
  delete sources.ranges;
  delete sources.zones;
  delete sources.occupancy_entity;
  delete sources.count_entity;
  if (draft.profile === 'esphome_ld2450_v1' || draft.profile === 'cartesian_v1') {
    sources.slots = draft.xEntities.flatMap((xEntity, index) => {
      const yEntity = draft.yEntities[index] || '';
      if (!xEntity || !yEntity) return [];
      return [{ id: `target_${index + 1}`, x_entity: xEntity, y_entity: yEntity,
        unit: draft.profile === 'esphome_ld2450_v1' ? 'mm' : draft.unit,
        ...(draft.profile === 'cartesian_v1' && draft.swapXY[index] ? { swap_xy: true } : {}),
        ...(draft.profile === 'cartesian_v1' && draft.xSigns[index] === -1 ? { x_sign: -1 as const } : {}),
        ...(draft.profile === 'cartesian_v1' && draft.ySigns[index] === -1 ? { y_sign: -1 as const } : {}),
        ...(draft.slotPresenceEntities[index]
          ? { presence_entity: draft.slotPresenceEntities[index] } : {}) }];
    });
    if (!sources.slots.length) return null;
  } else if (draft.profile === 'polar_v1') {
    sources.slots = draft.distanceEntities.flatMap((distanceEntity, index) => {
      const angleEntity = draft.angleEntities[index] || '';
      if (!distanceEntity || !angleEntity) return [];
      return [{ id: `target_${index + 1}`, distance_entity: distanceEntity,
        angle_entity: angleEntity, unit: draft.unit, angle_unit: draft.angleUnit,
        angle_zero: draft.angleZero, angle_clockwise: draft.angleClockwise,
        ...(draft.slotPresenceEntities[index]
          ? { presence_entity: draft.slotPresenceEntities[index] } : {}) }];
    });
    if (!sources.slots.length) return null;
  } else if (draft.profile === 'range_v1') {
    sources.ranges = draft.rangeEntities.flatMap((entityId, index) => entityId
      ? [{ id: `range_${index + 1}`, entity_id: entityId, unit: draft.unit,
          ...(draft.rangePresenceEntities[index]
            ? { presence_entity: draft.rangePresenceEntities[index] } : {}) }]
      : []);
    if (!sources.ranges.length) return null;
  } else if (draft.profile === 'zones_v1') {
    if (!draft.zoneEntity) return null;
    sources.zones = [{ id: 'zone_1', kind: draft.zoneKind, entity_id: draft.zoneEntity }];
  } else if (draft.profile === 'presence_v1' && !draft.occupancyEntity) return null;
  if (draft.occupancyEntity) sources.occupancy_entity = draft.occupancyEntity;
  if (draft.countEntity) sources.count_entity = draft.countEntity;
  if (draft.availabilityEntity) sources.availability_entity = draft.availabilityEntity;
  const rangeCm = numeric(draft.rangeCm);
  const fovDeg = numeric(draft.fovDeg);
  const normalizedHeading = ((heading % 360) + 360) % 360;
  const mount: MarkerRadar['mount'] = {
    ...(draft.original?.mount || {}),
    installation_id: draft.installationId,
    x: mountX / 1000, y: mountY / 1000, heading_deg: normalizedHeading,
  };
  if (rangeCm != null && rangeCm > 0) mount.range_cm = rangeCm;
  else delete mount.range_cm;
  if (fovDeg != null && fovDeg > 0) mount.fov_deg = fovDeg;
  else delete mount.fov_deg;
  const original = draft.original;
  const keepTwoPoint = original?.calibration?.method === 'two_point'
    && original.profile === draft.profile
    && JSON.stringify(original.sources) === JSON.stringify(sources)
    && original.mount.installation_id === draft.installationId
    && Math.abs(original.mount.x - mount.x) < 1e-12
    && Math.abs(original.mount.y - mount.y) < 1e-12
    && Math.abs(original.mount.heading_deg - normalizedHeading) < 1e-9
    && original.calibration.mirror === draft.mirror
    && Math.abs(original.calibration.cell_cm - cellCm) < 1e-9;
  const calibration: MarkerRadar['calibration'] = draft.calibrationOverride
    ? { ...draft.calibrationOverride }
    : keepTwoPoint
    ? { ...original.calibration }
    : {
        ...(original?.calibration || {}),
        method: draft.profile === 'zones_v1' || draft.profile === 'presence_v1'
          ? 'not_required' : 'manual',
        mirror: draft.mirror,
        cell_cm: cellCm,
      };
  if (!draft.calibrationOverride && !keepTwoPoint) {
    delete calibration.refs;
    delete calibration.rms_cm;
  }
  const result: MarkerRadar = {
    ...(draft.original || {}),
    version: 1,
    enabled: draft.enabled,
    profile: draft.profile,
    sources,
    mount,
    room_id: draft.roomId,
    calibration,
  };
  if (draft.showLive) delete result.show_live;
  else result.show_live = false;
  return result;
}

export function radarSourceCandidates(
  _device: DevItem,
  hass: RadarHassLike,
): { numeric: string[]; binary: string[] } {
  // hass.states is already permission-filtered for the current user. Registry
  // entities may still include disabled or unreadable diagnostics and must not
  // leak into a manual source selector.
  const entities = Object.keys(hass?.states || {});
  return {
    numeric: entities.filter((entityId) => entityId.startsWith('sensor.')).sort(),
    binary: entities.filter((entityId) => entityId.startsWith('binary_sensor.')).sort(),
  };
}
