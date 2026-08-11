/**
 * One authority for the marker action «Toggle state» (issue #94).
 *
 * Home Assistant has entity states, not a device state. This module resolves
 * the user's persisted intent into an exact, current service call without
 * silently falling back to an info card or an arbitrary sibling entity.
 */
import {
  persistedExternalControls,
  resolvedDeviceStateEntities,
  resolvedLightSources,
  type ResolvedLightSource,
} from './devices';
import { COVER_GUARDED_CLASSES, isControllable } from './logic';
import type { DevItem } from './types';

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
  | 'control-marker-driver';

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
}

export interface ResolveToggleOptions {
  hass: any;
  /** Full registry projection, used only to explain disabled/missing targets. */
  registryHass?: any;
  devices: readonly DevItem[];
  device: DevItem;
  /** Reuse a plan-wide light graph when the caller already has one. */
  lightSources?: readonly ResolvedLightSource<DevItem>[];
}

const POWER_DOMAINS = new Set([
  'light', 'switch', 'fan', 'humidifier', 'climate', 'media_player',
  'input_boolean', 'automation', 'remote', 'siren', 'vacuum', 'water_heater',
  'camera',
]);

const TURN_FEATURES: Record<string, Partial<Record<'turn_on' | 'turn_off', number>>> = {
  // Home Assistant VacuumEntityFeature.TURN_ON / TURN_OFF.
  vacuum: { turn_on: 1, turn_off: 2 },
  // Home Assistant MediaPlayerEntityFeature.TURN_ON / TURN_OFF.
  media_player: { turn_on: 128, turn_off: 256 },
};

const FEATURE_OPEN = 1;
const FEATURE_CLOSE = 2;
const FEATURE_STOP = 8;

function domainOf(entityId: string): string {
  return entityId.slice(0, entityId.indexOf('.'));
}

function serviceCatalogPresent(hass: any): boolean {
  return !!hass?.services && typeof hass.services === 'object'
    && Object.keys(hass.services).length > 0;
}

function serviceExists(hass: any, domain: string, service: string): boolean {
  if (!serviceCatalogPresent(hass)) return true;
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
  if (raw == null || raw === '') return true;
  const features = Number(raw);
  return Number.isFinite(features) && (features & mask) !== 0;
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
  if (!POWER_DOMAINS.has(domain)) {
    return unsupportedSingle(hass, registryHass, ref, entityId, 'unsupported');
  }

  let nextEffect: ToggleNextEffect;
  let requested: 'turn_on' | 'turn_off' | 'toggle';
  if (stateObject.state === 'unknown' || stateObject.state === '') {
    nextEffect = 'toggle';
    requested = 'toggle';
  } else if (stateObject.state === 'off') {
    nextEffect = 'turn-on';
    requested = 'turn_on';
  } else {
    nextEffect = 'turn-off';
    requested = 'turn_off';
  }

  const featureMask = TURN_FEATURES[domain]?.[requested as 'turn_on' | 'turn_off'];
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
  return serviceExists(hass, domain, 'toggle') ? { service: 'toggle', effect: 'toggle' } : null;
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

function entityCanRepresentToggle(entityId: string): boolean {
  const domain = domainOf(entityId);
  return domain === 'cover' || domain === 'valve' || domain === 'lock'
    || domain === 'alarm_control_panel' || POWER_DOMAINS.has(domain);
}

function ownCandidate(device: DevItem, registryHass: any): { entityId: string; via: ToggleTargetVia } | null {
  if (device.bindingKind === 'entity' && device.bindingRef) {
    return { entityId: device.bindingRef, via: 'binding' };
  }
  const candidates = device.entities.length ? device.entities : device.allEntities || [];
  const role = resolvedDeviceStateEntities(registryHass, candidates);
  const entityId = role.find(entityCanRepresentToggle) || role[0] || null;
  return entityId ? { entityId, via: 'device-role' } : null;
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
  return defaultDomain === 'light' ? 'toggle' : 'info';
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

function resolveControls(options: ResolveToggleOptions): ResolvedToggleIntent {
  const { hass, device, devices } = options;
  const registryHass = options.registryHass || hass;
  const refs = persistedExternalControls(
    device.marker?.binding, device.marker?.controls ?? device.controls, device.entities,
  );
  const sources = options.lightSources || resolvedLightSources(hass, devices);
  const markerSources = new Map<string, ResolvedLightSource<DevItem>[]>();
  for (const source of sources) {
    if (!source.key.startsWith('marker:')) continue;
    const list = markerSources.get(source.key) || [];
    list.push(source);
    markerSources.set(source.key, list);
  }
  const own = ownCandidate(device, registryHass);
  const markerDevices = new Map<string, DevItem>();
  for (const item of devices) {
    const markerId = String(item.marker?.id || item.id || '');
    if (markerId) markerDevices.set(markerId, item);
  }
  const byEntity = new Map<string, ResolvedToggleTarget>();
  const skippedTargets: SkippedToggleTarget[] = [];
  const skippedKeys = new Set<string>();
  const addSkipped = (target: SkippedToggleTarget): void => {
    const key = `${target.ref}\n${target.entityId || ''}\n${target.reason}`;
    if (skippedKeys.has(key)) return;
    skippedKeys.add(key);
    skippedTargets.push(target);
  };
  const addEntity = (entityId: string, via: ToggleTargetVia, ref: string): void => {
    const result = resolveEntity(hass, registryHass, entityId, via, ref);
    if (result.target) byEntity.set(entityId, byEntity.get(entityId) || result.target);
    else if (result.skipped) addSkipped(result.skipped);
  };

  for (const ref of refs) {
    if (!ref.startsWith('marker:')) {
      if (!isControllable(ref)) {
        addSkipped(skipped(hass, registryHass, ref, ref.includes('.') ? ref : null, 'unsupported'));
      } else addEntity(ref, 'control-entity', ref);
      continue;
    }
    const linked = markerSources.get(ref) || [];
    if (!linked.length) {
      const target = markerDevices.get(ref.slice('marker:'.length));
      if (target?.bindingStatus?.kind === 'ha_disabled') {
        const entityId = target.bindingStatus.allEntityIds[0] || null;
        addSkipped({
          ref,
          entityId,
          name: target.name || (entityId ? entityName(hass, registryHass, entityId) : null),
          reason: 'ha-disabled',
        });
      } else {
        addSkipped(skipped(hass, registryHass, ref, null, 'missing'));
      }
      continue;
    }
    const serviceEntities = [...new Set(linked.flatMap((source) => source.serviceEids))];
    if (serviceEntities.length) {
      for (const entityId of serviceEntities) addEntity(entityId, 'control-entity', ref);
      continue;
    }
    const passive = linked.some((source) => source.passive);
    if (passive && own && isControllable(own.entityId)) {
      addEntity(own.entityId, 'control-marker-driver', ref);
    } else {
      addSkipped(skipped(hass, registryHass, ref, null, passive ? 'missing' : 'unsupported'));
    }
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
        ...targets.map((target) => skipped(hass, registryHass, target.entityId, target.entityId, 'unsupported')),
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

/** Resolve the current exact target and command for one toggle-origin marker. */
export function resolveToggleIntent(options: ResolveToggleOptions): ResolvedToggleIntent | null {
  const { hass, device } = options;
  const registryHass = options.registryHass || hass;
  const origin = toggleOriginOf(device);
  if (!origin) return null;

  if (origin === 'explicit-toggle') {
    const refs = persistedExternalControls(
      device.marker?.binding, device.marker?.controls ?? device.controls, device.entities,
    );
    if (refs.length) return resolveControls(options);
  }

  if (origin === 'legacy-cover') {
    const candidates = device.entities.length ? device.entities : device.allEntities || [];
    const entityId = candidates.find((eid) => eid.startsWith('cover.'));
    return entityId
      ? singleIntent(origin, resolveEntity(hass, registryHass, entityId, 'device-role'))
      : emptyIntent(origin, 'no-actionable-entity');
  }

  const candidate = ownCandidate(device, registryHass);
  if (!candidate) {
    return emptyIntent(origin, device.virtual || device.bindingKind === 'virtual'
      ? 'no-actionable-entity' : 'no-binding');
  }
  return singleIntent(
    origin,
    resolveEntity(hass, registryHass, candidate.entityId, candidate.via),
  );
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
