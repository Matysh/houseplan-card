/**
 * One authority for the marker action «Toggle state» (issue #94).
 *
 * Home Assistant has entity states, not a device state. This module resolves
 * the user's persisted intent into an exact, current service call without
 * silently falling back to an info card or an arbitrary sibling entity.
 */
import {
  forcedLightEntityOf,
  incomingLightControls,
  persistedExternalControls,
  resolvedDeviceStateEntities,
  resolvedLightSources,
  type ResolvedLightSource,
  type IncomingLightControl,
} from './devices';
import { COVER_GUARDED_CLASSES, isControllable } from './logic';
import type { DevItem } from './types';
import {
  isManualVirtualLightMarker,
  virtualLightIsOn,
  type VirtualLightSnapshot,
} from './virtual-light-state';

export type ToggleOrigin = 'explicit-toggle' | 'default-light' | 'legacy-cover';
export type ToggleSemantics = 'power' | 'group-power' | 'cover' | 'valve';
export type ToggleNextEffect = 'turn-on' | 'turn-off' | 'open' | 'close' | 'stop' | 'toggle';
export type ToggleNoneReason =
  | 'no-binding'
  | 'no-actionable-entity'
  | 'configured-targets-missing'
  | 'ha-disabled'
  | 'unavailable'
  | 'unsupported'
  | 'secure';
export type ToggleSkipReason = 'missing' | 'ha-disabled' | 'unavailable' | 'unsupported' | 'secure';

export type ToggleTargetVia =
  | 'binding'
  | 'device-role'
  | 'control-entity'
  | 'control-marker-driver'
  | 'virtual-light';

export interface ResolvedToggleTarget {
  entityId: string;
  name: string;
  state: string;
  via: ToggleTargetVia;
}

export interface SkippedToggleTarget {
  ref: string;
  entityId: string | null;
  name: string | null;
  reason: ToggleSkipReason;
}

export interface ToggleCommand {
  domain: string;
  service: string;
  data: { entity_id: string | string[] };
}

export type ToggleOperation =
  | { kind: 'ha-service'; command: ToggleCommand }
  | { kind: 'virtual-light'; markerId: string };

export interface ResolvedToggleIntent {
  origin: ToggleOrigin;
  kind: 'single' | 'group' | 'none';
  semantics: ToggleSemantics | null;
  /** Exactly the entities included in `command`, in deterministic order. */
  targets: ResolvedToggleTarget[];
  skippedTargets: SkippedToggleTarget[];
  noneReason: ToggleNoneReason | null;
  nextEffect: ToggleNextEffect | null;
  command: ToggleCommand | null;
  /** Non-HA operational target. HA intents continue to expose `command`. */
  operation?: ToggleOperation | null;
}

export interface ResolveToggleOptions {
  hass: any;
  /** Full registry projection, used only to explain disabled/missing targets. */
  registryHass?: any;
  devices: readonly DevItem[];
  device: DevItem;
  /** Reuse a plan-wide light graph when the caller already has one. */
  lightSources?: readonly ResolvedLightSource<DevItem>[];
  virtualLights?: VirtualLightSnapshot | null;
}

type PowerService = 'turn_on' | 'turn_off' | 'toggle';

interface PowerToggleAdapter {
  /** States which mean disabled. Every other known state is active/on. */
  offStates: readonly string[];
  /** Whether an indeterminate state may use the domain/generic toggle. */
  unknownUsesToggle: boolean;
  /**
   * Per-entity capability bits required by Home Assistant for each command.
   * An absent entry means that the entity domain itself guarantees the basic
   * turn-on/turn-off contract (for example light, switch and fan).
   */
  featureMasks?: Partial<Record<PowerService, number>>;
}

const BASIC_POWER_ADAPTER: PowerToggleAdapter = {
  offStates: ['off'],
  unknownUsesToggle: true,
};

/**
 * Explicit domain adapters are the capability allow-list for issue #94.
 * `hass.services` is only a second, runtime guard: a service registered for a
 * domain says nothing about whether one particular entity implements it.
 */
const POWER_ADAPTERS: Readonly<Record<string, PowerToggleAdapter>> = {
  light: BASIC_POWER_ADAPTER,
  switch: BASIC_POWER_ADAPTER,
  fan: BASIC_POWER_ADAPTER,
  humidifier: BASIC_POWER_ADAPTER,
  input_boolean: BASIC_POWER_ADAPTER,
  automation: BASIC_POWER_ADAPTER,
  remote: BASIC_POWER_ADAPTER,
  group: BASIC_POWER_ADAPTER,
  climate: {
    ...BASIC_POWER_ADAPTER,
    // Home Assistant ClimateEntityFeature.TURN_OFF / TURN_ON.
    featureMasks: { turn_on: 256, turn_off: 128, toggle: 128 | 256 },
  },
  media_player: {
    ...BASIC_POWER_ADAPTER,
    // Home Assistant MediaPlayerEntityFeature.TURN_ON / TURN_OFF.
    featureMasks: { turn_on: 128, turn_off: 256, toggle: 128 | 256 },
  },
  siren: {
    ...BASIC_POWER_ADAPTER,
    // Home Assistant SirenEntityFeature.TURN_ON / TURN_OFF.
    featureMasks: { turn_on: 1, turn_off: 2, toggle: 1 | 2 },
  },
  vacuum: {
    ...BASIC_POWER_ADAPTER,
    // Deprecated but still supported legacy VacuumEntityFeature bits. Modern
    // StateVacuumEntity instances deliberately do not advertise these and are
    // therefore not treated as a binary power toggle.
    featureMasks: { turn_on: 1, turn_off: 2, toggle: 1 | 2 },
  },
  water_heater: {
    ...BASIC_POWER_ADAPTER,
    // Home Assistant WaterHeaterEntityFeature.ON_OFF.
    featureMasks: { turn_on: 8, turn_off: 8, toggle: 8 },
  },
  camera: {
    ...BASIC_POWER_ADAPTER,
    // Home Assistant CameraEntityFeature.ON_OFF.
    featureMasks: { turn_on: 1, turn_off: 1, toggle: 1 },
  },
};

const FEATURE_OPEN = 1;
const FEATURE_CLOSE = 2;
const FEATURE_STOP = 8;

function domainOf(entityId: string): string {
  return entityId.slice(0, entityId.indexOf('.'));
}

function serviceExists(hass: any, domain: string, service: string): boolean {
  if (!hass?.services || typeof hass.services !== 'object') return false;
  const services = hass.services?.[domain];
  return !!services && Object.prototype.hasOwnProperty.call(services, service);
}

function directionalService(
  hass: any, domain: string, service: 'turn_on' | 'turn_off' | 'toggle',
): { domain: string; service: string } | null {
  if (serviceExists(hass, domain, service)) return { domain, service };
  if (serviceExists(hass, 'homeassistant', service)) return { domain: 'homeassistant', service };
  return null;
}

function entityRegistry(registryHass: any, entityId: string): any {
  return registryHass?.entities?.[entityId] || null;
}

function entityName(hass: any, registryHass: any, entityId: string): string {
  const state = hass?.states?.[entityId];
  const registry = entityRegistry(registryHass, entityId);
  return state?.attributes?.friendly_name || registry?.name || registry?.original_name || entityId;
}

function registryDisabled(registryHass: any, entityId: string): boolean {
  const entity = entityRegistry(registryHass, entityId);
  if (entity?.disabled_by != null) return true;
  const device = entity?.device_id ? registryHass?.devices?.[entity.device_id] : null;
  return device?.disabled_by != null;
}

function supportedFeature(state: any, mask: number): boolean {
  const raw = state?.attributes?.supported_features;
  if (raw == null || raw === '') return false;
  const features = Number(raw);
  return Number.isFinite(features) && (features & mask) === mask;
}

function secureEntity(hass: any, registryHass: any, entityId: string): boolean {
  const domain = domainOf(entityId);
  if (domain === 'lock' || domain === 'alarm_control_panel') return true;
  if (domain !== 'cover') return false;
  const state = hass?.states?.[entityId];
  const registry = entityRegistry(registryHass, entityId);
  const deviceClass = String(
    state?.attributes?.device_class || registry?.device_class || registry?.original_device_class || '',
  );
  return COVER_GUARDED_CLASSES.has(deviceClass);
}

function skipped(
  hass: any, registryHass: any, ref: string, entityId: string | null, reason: ToggleSkipReason,
): SkippedToggleTarget {
  return {
    ref,
    entityId,
    name: entityId ? entityName(hass, registryHass, entityId) : null,
    reason,
  };
}

interface SingleResolution {
  target: ResolvedToggleTarget | null;
  skipped: SkippedToggleTarget | null;
  semantics: ToggleSemantics | null;
  nextEffect: ToggleNextEffect | null;
  command: ToggleCommand | null;
}

function unsupportedSingle(
  hass: any, registryHass: any, ref: string, entityId: string, reason: ToggleSkipReason,
  semantics: ToggleSemantics | null = null,
): SingleResolution {
  return {
    target: null,
    skipped: skipped(hass, registryHass, ref, entityId, reason),
    semantics,
    nextEffect: null,
    command: null,
  };
}

function resolvePowerEntity(
  hass: any, registryHass: any, entityId: string, via: ToggleTargetVia, ref = entityId,
): SingleResolution {
  const domain = domainOf(entityId);
  const stateObject = hass?.states?.[entityId];
  if (registryDisabled(registryHass, entityId)) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'ha-disabled', 'power');
  }
  if (secureEntity(hass, registryHass, entityId)) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'secure');
  }
  if (!stateObject) return unsupportedSingle(hass, registryHass, ref, entityId, 'missing', 'power');
  if (stateObject.state === 'unavailable') {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'unavailable', 'power');
  }
  const adapter = POWER_ADAPTERS[domain];
  if (!adapter) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'unsupported');
  }

  let nextEffect: ToggleNextEffect;
  let requested: PowerService;
  if (stateObject.state === 'unknown' || stateObject.state === '') {
    if (!adapter.unknownUsesToggle) {
      return unsupportedSingle(hass, registryHass, ref, entityId, 'unsupported', 'power');
    }
    nextEffect = 'toggle';
    requested = 'toggle';
  } else if (adapter.offStates.includes(String(stateObject.state))) {
    nextEffect = 'turn-on';
    requested = 'turn_on';
  } else {
    nextEffect = 'turn-off';
    requested = 'turn_off';
  }

  const featureMask = adapter.featureMasks?.[requested];
  if (featureMask && !supportedFeature(stateObject, featureMask)) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'unsupported', 'power');
  }
  const service = directionalService(hass, domain, requested);
  if (!service) return unsupportedSingle(hass, registryHass, ref, entityId, 'unsupported', 'power');
  const target: ResolvedToggleTarget = {
    entityId,
    name: entityName(hass, registryHass, entityId),
    state: String(stateObject.state || ''),
    via,
  };
  return {
    target,
    skipped: null,
    semantics: 'power',
    nextEffect,
    command: { ...service, data: { entity_id: entityId } },
  };
}

function coverLikeService(
  hass: any,
  domain: 'cover' | 'valve',
  stateObject: any,
): { service: string; effect: ToggleNextEffect } | null {
  const state = String(stateObject?.state || '');
  const candidate = state === 'closed'
    ? { service: `open_${domain}`, effect: 'open' as const, feature: FEATURE_OPEN }
    : state === 'open'
      ? { service: `close_${domain}`, effect: 'close' as const, feature: FEATURE_CLOSE }
      : state === 'opening' || state === 'closing'
        ? { service: `stop_${domain}`, effect: 'stop' as const, feature: FEATURE_STOP }
        : null;
  if (candidate && supportedFeature(stateObject, candidate.feature)
      && serviceExists(hass, domain, candidate.service)) {
    return candidate;
  }
  // A cover/valve toggle is only a safe substitute when the entity advertises
  // both directions. A domain-level `toggle` service is not proof that this
  // particular entity can perform the missing direction.
  const supportsBothDirections = supportedFeature(stateObject, FEATURE_OPEN | FEATURE_CLOSE);
  return supportsBothDirections && serviceExists(hass, domain, 'toggle')
    ? { service: 'toggle', effect: 'toggle' }
    : null;
}

function resolveEntity(
  hass: any, registryHass: any, entityId: string, via: ToggleTargetVia, ref = entityId,
): SingleResolution {
  const domain = domainOf(entityId);
  if (domain !== 'cover' && domain !== 'valve') {
    return resolvePowerEntity(hass, registryHass, entityId, via, ref);
  }
  if (registryDisabled(registryHass, entityId)) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'ha-disabled', domain);
  }
  if (secureEntity(hass, registryHass, entityId)) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'secure', domain);
  }
  const stateObject = hass?.states?.[entityId];
  if (!stateObject) return unsupportedSingle(hass, registryHass, ref, entityId, 'missing', domain);
  if (stateObject.state === 'unavailable') {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'unavailable', domain);
  }
  const service = coverLikeService(hass, domain, stateObject);
  if (!service) return unsupportedSingle(hass, registryHass, ref, entityId, 'unsupported', domain);
  const target: ResolvedToggleTarget = {
    entityId,
    name: entityName(hass, registryHass, entityId),
    state: String(stateObject.state || ''),
    via,
  };
  return {
    target,
    skipped: null,
    semantics: domain,
    nextEffect: service.effect,
    command: { domain, service: service.service, data: { entity_id: entityId } },
  };
}

function ownRoleCandidates(device: DevItem, registryHass: any): string[] {
  if (device.bindingKind === 'entity' && device.bindingRef) {
    // The binding remains exact unless the user explicitly selected the
    // marker's light driver. That persisted override is shared by rendering,
    // Glow and tap handling, so the face must never represent light.lamp while
    // a tap silently toggles the original relay instead.
    const explicitLight = device.marker?.light_entity
      ? forcedLightEntityOf(device)
      : null;
    return [...new Set([explicitLight, device.bindingRef].filter(
      (eid): eid is string => !!eid,
    ))];
  }
  const candidates = device.entities.length ? device.entities : device.allEntities || [];
  const leading = (device.marker?.light_entity
    || (device.primary && isControllable(device.primary)))
    ? forcedLightEntityOf(device)
    : null;
  return [...new Set([
    leading,
    ...resolvedDeviceStateEntities(registryHass, candidates),
  ].filter((eid): eid is string => !!eid))];
}

/**
 * Resolve the first supported member of the already-selected functional role.
 * Missing/unavailable/secure members remain the explained target and never
 * retarget. Capability-unsupported peers may be skipped only within that same
 * role; `resolvedDeviceStateEntities` has already excluded random sibling
 * config switches from a stronger cover/climate/media role.
 */
function resolveOwnEntity(
  hass: any, registryHass: any, device: DevItem,
): SingleResolution | null {
  const role = ownRoleCandidates(device, registryHass);
  if (!role.length) return null;
  const via: ToggleTargetVia = device.bindingKind === 'entity' ? 'binding' : 'device-role';
  if (via === 'binding') return resolveEntity(hass, registryHass, role[0], via);

  let firstUnsupported: SingleResolution | null = null;
  let firstDisabled: SingleResolution | null = null;
  for (const entityId of role) {
    const result = resolveEntity(hass, registryHass, entityId, via);
    if (result.command) return result;
    const reason = result.skipped?.reason;
    if (reason === 'missing' || reason === 'unavailable' || reason === 'secure') return result;
    if (reason === 'ha-disabled') {
      firstDisabled ||= result;
      continue;
    }
    firstUnsupported ||= result;
  }
  return firstUnsupported || firstDisabled;
}

function reasonForSingle(result: SingleResolution): ToggleNoneReason {
  const reason = result.skipped?.reason;
  if (reason === 'missing') return 'unavailable';
  return reason || 'unsupported';
}

function emptyIntent(origin: ToggleOrigin, reason: ToggleNoneReason): ResolvedToggleIntent {
  return {
    origin,
    kind: 'none',
    semantics: null,
    targets: [],
    skippedTargets: [],
    noneReason: reason,
    nextEffect: null,
    command: null,
  };
}

/** Effective action shown by the UI. Legacy cover is projected, not rewritten. */
export function projectedTapAction(
  persisted: string | null | undefined,
  defaultDomain: string | null | undefined,
): 'info' | 'more-info' | 'toggle' | 'run' {
  if (persisted === 'cover' || persisted === 'toggle') return 'toggle';
  if (persisted === 'more-info' || persisted === 'run' || persisted === 'info') return persisted;
  // Only actual absence activates the light default. An unknown persisted
  // token is invalid data, not an absent choice: fail closed to the local card
  // so the UI projection and `toggleOriginOf()` cannot disagree.
  return persisted == null || persisted === ''
    ? (defaultDomain === 'light' ? 'toggle' : 'info')
    : 'info';
}

export function toggleOriginOf(device: DevItem): ToggleOrigin | null {
  if (device.tapAction === 'toggle') return 'explicit-toggle';
  if (device.tapAction === 'cover') return 'legacy-cover';
  return !device.tapAction && device.primary?.startsWith('light.') ? 'default-light' : null;
}

function singleIntent(
  origin: ToggleOrigin,
  result: SingleResolution,
): ResolvedToggleIntent {
  return {
    origin,
    kind: 'single',
    semantics: result.semantics,
    targets: result.target ? [result.target] : [],
    skippedTargets: result.skipped ? [result.skipped] : [],
    noneReason: result.command ? null : reasonForSingle(result),
    nextEffect: result.nextEffect,
    command: result.command,
  };
}

interface GroupEntityRef {
  entityId: string;
  via: ToggleTargetVia;
  ref: string;
}

function resolveGroupEntities(
  hass: any,
  registryHass: any,
  entries: readonly GroupEntityRef[],
  initialSkipped: readonly SkippedToggleTarget[] = [],
): ResolvedToggleIntent {
  const byEntity = new Map<string, ResolvedToggleTarget>();
  const skippedTargets: SkippedToggleTarget[] = [];
  const skippedKeys = new Set<string>();
  const addSkipped = (target: SkippedToggleTarget): void => {
    const key = `${target.ref}\n${target.entityId || ''}\n${target.reason}`;
    if (skippedKeys.has(key)) return;
    skippedKeys.add(key);
    skippedTargets.push(target);
  };
  for (const target of initialSkipped) addSkipped(target);
  for (const entry of entries) {
    const result = resolveEntity(hass, registryHass, entry.entityId, entry.via, entry.ref);
    if (result.target) {
      byEntity.set(entry.entityId, byEntity.get(entry.entityId) || result.target);
    } else if (result.skipped) addSkipped(result.skipped);
  }

  const targets = [...byEntity.values()];
  if (!targets.length) {
    return {
      origin: 'explicit-toggle',
      kind: 'group',
      semantics: 'group-power',
      targets,
      skippedTargets,
      noneReason: skippedTargets.length && skippedTargets.every((target) => target.reason === 'secure')
        ? 'secure' : 'configured-targets-missing',
      nextEffect: null,
      command: null,
    };
  }
  const service = targets.some((target) => target.state === 'on') ? 'turn_off' : 'turn_on';
  const commandService = directionalService(hass, 'homeassistant', service);
  if (!commandService) {
    return {
      origin: 'explicit-toggle', kind: 'group', semantics: 'group-power', targets: [],
      skippedTargets: [
        ...skippedTargets,
        ...targets.map((target) => skipped(
          hass, registryHass, target.entityId, target.entityId, 'unsupported',
        )),
      ],
      noneReason: 'unsupported', nextEffect: null, command: null,
    };
  }
  return {
    origin: 'explicit-toggle',
    kind: 'group',
    semantics: 'group-power',
    targets,
    skippedTargets,
    noneReason: null,
    nextEffect: service === 'turn_on' ? 'turn-on' : 'turn-off',
    command: {
      ...commandService,
      data: { entity_id: targets.map((target) => target.entityId) },
    },
  };
}

function stableDeviceId(device: DevItem): string {
  return String(device.marker?.id || device.id || '');
}

function resolveIncomingControllers(
  options: ResolveToggleOptions,
  incoming: IncomingLightControl<DevItem>,
): ResolvedToggleIntent {
  const registryHass = options.registryHass || options.hass;
  return resolveGroupEntities(
    options.hass,
    registryHass,
    incoming.driverEids.map((entityId) => ({
      entityId,
      via: 'control-marker-driver' as const,
      ref: `marker:${incoming.markerId}`,
    })),
  );
}

function resolveControls(options: ResolveToggleOptions): ResolvedToggleIntent {
  const { hass, device, devices } = options;
  const registryHass = options.registryHass || hass;
  const refs = persistedExternalControls(
    device.marker?.binding, device.marker?.controls ?? device.controls, device.entities,
  );
  const sources = options.lightSources
    || resolvedLightSources(hass, devices, null, options.virtualLights);
  const markerSources = new Map<string, ResolvedLightSource<DevItem>[]>();
  for (const source of sources) {
    if (!source.key.startsWith('marker:')) continue;
    const list = markerSources.get(source.key) || [];
    list.push(source);
    markerSources.set(source.key, list);
  }
  const incomingByMarker = incomingLightControls(devices);
  const markerDevices = new Map<string, DevItem>();
  for (const item of devices) {
    const markerId = String(item.marker?.id || item.id || '');
    if (markerId) markerDevices.set(markerId, item);
  }
  const entries: GroupEntityRef[] = [];
  const skippedTargets: SkippedToggleTarget[] = [];

  for (const ref of refs) {
    if (!ref.startsWith('marker:')) {
      if (!isControllable(ref)) {
        skippedTargets.push(skipped(
          hass, registryHass, ref, ref.includes('.') ? ref : null, 'unsupported',
        ));
      } else entries.push({ entityId: ref, via: 'control-entity', ref });
      continue;
    }
    const linked = markerSources.get(ref) || [];
    if (!linked.length) {
      const target = markerDevices.get(ref.slice('marker:'.length));
      if (target?.bindingStatus?.kind === 'ha_disabled') {
        const entityId = target.bindingStatus.allEntityIds[0] || null;
        skippedTargets.push({
          ref,
          entityId,
          name: target.name || (entityId ? entityName(hass, registryHass, entityId) : null),
          reason: 'ha-disabled',
        });
      } else {
        skippedTargets.push(skipped(hass, registryHass, ref, null, 'missing'));
      }
      continue;
    }
    const serviceEntities = [...new Set(linked.flatMap((source) => source.serviceEids))];
    if (serviceEntities.length) {
      for (const entityId of serviceEntities) {
        entries.push({ entityId, via: 'control-entity', ref });
      }
      continue;
    }
    const passive = linked.some((source) => source.passive);
    const targetId = ref.slice('marker:'.length);
    const controllerId = stableDeviceId(device);
    const controller = incomingByMarker.get(targetId)?.controllers.find(
      (candidate) => stableDeviceId(candidate.device) === controllerId,
    );
    if (passive && controller?.driverEids.length) {
      for (const entityId of controller.driverEids) {
        entries.push({ entityId, via: 'control-marker-driver', ref });
      }
    } else {
      skippedTargets.push(skipped(
        hass, registryHass, ref, null, passive ? 'missing' : 'unsupported',
      ));
    }
  }
  return resolveGroupEntities(hass, registryHass, entries, skippedTargets);
}

/** Resolve the current exact target and command for one toggle-origin marker. */
export function resolveToggleIntent(options: ResolveToggleOptions): ResolvedToggleIntent | null {
  const { hass, device } = options;
  const registryHass = options.registryHass || hass;
  const origin = toggleOriginOf(device);
  if (!origin) return null;

  // This operational target intentionally precedes `controls`: controls stay
  // persisted losslessly, but while the exact manual mode is active a tap
  // changes the marker's own server state and never calls an HA service.
  const marker = device.marker;
  if (origin === 'explicit-toggle' && isManualVirtualLightMarker(marker)) {
    const markerId = String(marker?.id || device.id || '');
    const incoming = incomingLightControls(options.devices).get(markerId);
    if (incoming) return resolveIncomingControllers(options, incoming);
    const on = virtualLightIsOn(marker, options.virtualLights);
    return {
      origin,
      kind: 'single',
      semantics: 'power',
      targets: [{
        entityId: '',
        name: device.name,
        state: on ? 'on' : 'off',
        via: 'virtual-light',
      }],
      skippedTargets: [],
      noneReason: null,
      nextEffect: on ? 'turn-off' : 'turn-on',
      command: null,
      operation: { kind: 'virtual-light', markerId: marker!.id! },
    };
  }

  if (origin === 'explicit-toggle') {
    const refs = persistedExternalControls(
      device.marker?.binding, device.marker?.controls ?? device.controls, device.entities,
    );
    if (refs.length) return resolveControls(options);
  }

  if (origin === 'legacy-cover') {
    // Legacy cover is an explicit historical target choice. Keep its identity
    // even if HA later disables that cover while other active siblings remain.
    // An active cover still wins: `allEntities` may contain an older disabled
    // peer before it, and registry order must not downgrade a working target.
    const entityId = device.entities.find((eid) => eid.startsWith('cover.'))
      || device.allEntities?.find((eid) => eid.startsWith('cover.'));
    return entityId
      ? singleIntent(origin, resolveEntity(hass, registryHass, entityId, 'device-role'))
      : emptyIntent(origin, 'no-actionable-entity');
  }

  const own = resolveOwnEntity(hass, registryHass, device);
  if (!own) {
    return emptyIntent(origin, device.virtual || device.bindingKind === 'virtual'
      ? 'no-actionable-entity' : 'no-binding');
  }
  return singleIntent(origin, own);
}

/** Entity which owns cover presentation, even while temporarily unavailable. */
export function toggleCoverEntity(intent: ResolvedToggleIntent | null): string | null {
  if (intent?.semantics !== 'cover') return null;
  return intent.targets[0]?.entityId || intent.skippedTargets[0]?.entityId || null;
}

export function toggleCommandEntityIds(command: ToggleCommand | null): string[] {
  if (!command) return [];
  const ids = Array.isArray(command.data.entity_id) ? command.data.entity_id : [command.data.entity_id];
  return [...new Set(ids)].sort();
}

export function sameToggleCommandTargets(a: ToggleCommand | null, b: ToggleCommand | null): boolean {
  const left = toggleCommandEntityIds(a);
  const right = toggleCommandEntityIds(b);
  return left.length === right.length && left.every((entityId, index) => entityId === right[index]);
}

export function toggleOperation(intent: ResolvedToggleIntent | null): ToggleOperation | null {
  if (!intent) return null;
  if (intent.operation) return intent.operation;
  return intent.command ? { kind: 'ha-service', command: intent.command } : null;
}

/** Stable confirmation identity; direction is deliberately re-resolved later. */
export function sameToggleOperationTargets(
  a: ResolvedToggleIntent | null,
  b: ResolvedToggleIntent | null,
): boolean {
  const left = toggleOperation(a);
  const right = toggleOperation(b);
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'virtual-light' && right.kind === 'virtual-light') {
    return left.markerId === right.markerId;
  }
  return left.kind === 'ha-service' && right.kind === 'ha-service'
    && sameToggleCommandTargets(left.command, right.command);
}

export interface ToggleIntentFormatter {
  single: (target: ResolvedToggleTarget | SkippedToggleTarget) => string;
  group: (targets: readonly ResolvedToggleTarget[]) => string;
  currentNext: (target: ResolvedToggleTarget, effect: ToggleNextEffect) => string;
  groupCurrentNext: (targets: readonly ResolvedToggleTarget[], effect: ToggleNextEffect) => string;
  skipped: (targets: readonly SkippedToggleTarget[]) => string;
  none: (reason: ToggleNoneReason) => string;
}

/** Shared line selection for dialog hint and confirmation diagnostics. */
export function formatToggleIntent(
  intent: ResolvedToggleIntent,
  formatter: ToggleIntentFormatter,
): string[] {
  const intended = intent.targets[0] || intent.skippedTargets[0];
  const lines: string[] = [];
  if (intent.kind === 'group') {
    if (intent.targets.length) lines.push(formatter.group(intent.targets));
  } else if (intended) lines.push(formatter.single(intended));
  if (intent.nextEffect && intent.targets.length) {
    lines.push(intent.kind === 'group'
      ? formatter.groupCurrentNext(intent.targets, intent.nextEffect)
      : formatter.currentNext(intent.targets[0], intent.nextEffect));
  }
  if (intent.skippedTargets.length) lines.push(formatter.skipped(intent.skippedTargets));
  if (!intent.command && intent.noneReason) lines.push(formatter.none(intent.noneReason));
  return lines;
}

export function toggleIntentName(intent: ResolvedToggleIntent): string {
  const targets = intent.targets.length ? intent.targets : intent.skippedTargets;
  return targets.map((target) => target.name || target.entityId || target.ref).join(', ');
}
