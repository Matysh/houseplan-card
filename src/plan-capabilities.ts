/** Runtime availability, never persisted plan data or server authorization (#1394). */
import { hostError, type HouseplanCommand, type PlanHost } from './plan-host';

export const CAPABILITY_NAMES = [
  'devices', 'virtualDevices', 'deviceServices', 'haAreas', 'zigbee', 'vacuum', 'radar', 'alarms',
  'summary', 'externalScreens', 'installationBackup', 'planTransfer', 'printing', 'planImages',
  'decorAssets', 'planMaintenance', 'supportDiagnostics',
] as const;
export type PlanCapability = typeof CAPABILITY_NAMES[number];
export type PlanCapabilities = Readonly<Record<PlanCapability, boolean>>;

export function planCapabilities(enabled: readonly PlanCapability[]): PlanCapabilities {
  if (enabled.some(name => !CAPABILITY_NAMES.includes(name))) throw hostError('invalid_payload');
  const result = Object.freeze(Object.fromEntries(CAPABILITY_NAMES.map(name => [name, enabled.includes(name)]))) as PlanCapabilities;
  validateCapabilities(result);
  return result;
}
export function validateCapabilities(value: PlanCapabilities): void {
  if (!value || Object.keys(value).some(name => !CAPABILITY_NAMES.includes(name as PlanCapability))
      || CAPABILITY_NAMES.some(name => typeof value[name] !== 'boolean')
      || (['zigbee', 'vacuum', 'radar', 'alarms'] as const).some(name => value[name] && !value.devices)
      || (value.deviceServices && !value.devices && !value.virtualDevices)) throw hostError('invalid_payload');
}
export const HA_CAPABILITIES = planCapabilities(CAPABILITY_NAMES);
export const PLAN_ONLY_CAPABILITIES = planCapabilities([
  'planTransfer', 'printing', 'planImages', 'decorAssets', 'planMaintenance',
]);
export const hasMarkers = (value: PlanCapabilities): boolean => value.devices || value.virtualDevices;
export const permitsRoomFill = (c: PlanCapabilities, mode: string): boolean =>
  mode === 'lqi' ? c.zigbee : mode === 'temp' ? c.devices : mode === 'light' ? hasMarkers(c) : true;

/** Base plan transport is explicit; unknown optional operations fail closed. */
export function permitsCommand(c: PlanCapabilities, command: HouseplanCommand): boolean {
  if (!command || typeof command.type !== 'string' || !command.type.startsWith('houseplan/')) return false;
  const name = command.type.slice('houseplan/'.length);
  if (Object.values(c).every(Boolean)) return true; // HA retains its version/ACL negotiation.
  if (['config/get', 'config/set', 'layout/get', 'layout/set', 'space/delete',
    'wall/node_move', 'wall/node_delete', 'wall/node_merge', 'wall/node_attach'].includes(name)) return true;
  if (name === 'export/create') return command.kind === 'space' ? c.planTransfer : c.installationBackup;
  if (name.startsWith('import/')) return c.planTransfer || c.installationBackup;
  if (name.startsWith('backup/')) return name === 'backup/cancel'
    ? c.planTransfer || c.installationBackup : c.installationBackup;
  if (name.startsWith('plans/')) return c.planImages;
  if (name.startsWith('assets/')) return c.decorAssets;
  if (['plan/optimize', 'plan/optimize_undo', 'geometry/repair'].includes(name)) return c.planMaintenance;
  if (name.startsWith('support/')) return c.supportDiagnostics;
  if (name.startsWith('external_screens/')) return c.externalScreens;
  if (name.startsWith('zigbee')) return c.zigbee;
  if (name.startsWith('radar/')) return c.radar;
  if (name.startsWith('trail/') || name.startsWith('vacuum/')) return c.vacuum;
  if (name === 'virtual_light/toggle') return c.deviceServices && c.virtualDevices;
  if (name.startsWith('marker/') || ['layout/update', 'layout/delete', 'files/migrate', 'files/cleanup'].includes(name)) return hasMarkers(c);
  return false;
}
export function permitsHttp(c: PlanCapabilities, path: string): boolean {
  if (Object.values(c).every(Boolean)) return true;
  const name = path.split('?')[0];
  if (name === '/api/houseplan/structural/upload') return true;
  if (name === '/api/houseplan/plans/upload') return c.planImages;
  if (name === '/api/houseplan/assets/upload') return c.decorAssets;
  if (name === '/api/houseplan/upload') return hasMarkers(c);
  if (name === '/api/houseplan/import/preview') return c.planTransfer || c.installationBackup;
  if (name.startsWith('/api/houseplan/backup/')) return c.installationBackup;
  if (name.startsWith('/api/houseplan/support/')) return c.supportDiagnostics;
  return false;
}

const guarded = new WeakMap<PlanHost, PlanHost>();
/** Defense at dispatch as well as UI. The adapter still owns ACL and async leases. */
export function capabilityHost(source: PlanHost): PlanHost {
  const cached = guarded.get(source);
  if (cached) return cached;
  validateCapabilities(source.capabilities);
  if (typeof source.content?.resolve !== 'function' || typeof source.content?.resolveAssets !== 'function') throw hostError('invalid_payload');
  if (!Object.isFrozen(source.capabilities)) throw hostError('invalid_payload');
  const capabilities = source.capabilities;
  let rawAuthority: object | undefined, localAuthority: object;
  const authority = (): object => {
    if (capabilities === HA_CAPABILITIES) return source.authorityKey;
    if (rawAuthority !== source.authorityKey) { rawAuthority = source.authorityKey; localAuthority = {}; }
    return localAuthority;
  };
  let previous: PlanHost['environment'] | undefined, projection: PlanHost['environment'];
  const environment = (): PlanHost['environment'] => {
    const current = source.environment;
    if (capabilities.devices && capabilities.haAreas) return current;
    if (current !== previous) {
      previous = current;
      const empty = Object.freeze({});
      projection = Object.freeze({ ...current, states: capabilities.devices ? current.states : empty,
        registry: Object.freeze({ ...current.registry,
          authoritative: capabilities.devices && current.registry.authoritative,
          devices: capabilities.devices ? current.registry.devices : empty,
          entities: capabilities.devices ? current.registry.entities : empty,
          areas: capabilities.haAreas ? current.registry.areas : empty }) });
    }
    return projection;
  };
  const allowed = (yes: boolean): void => { if (!yes) throw hostError('not_ready'); };
  const host: PlanHost = {
    capabilities,
    get authorityKey() { return authority(); },
    get writeAuthorityRevision() { return source.writeAuthorityRevision; },
    get environmentRevision() { return source.environmentRevision; },
    get environment() { return environment(); },
    async request(command) { allowed(permitsCommand(capabilities, command)); return source.request(command); },
    subscribe: (event, receive, options) => source.subscribe(event, receive,
      capabilities.externalScreens ? options : undefined),
    subscribeEnvironment: receive => source.subscribeEnvironment(receive),
    content: source.content,
    http: {
      async request(path, init) { allowed(permitsHttp(capabilities, path)); return source.http.request(path, init); },
      async postJson(path, value, signal) {
        allowed(permitsHttp(capabilities, path));
        if (path === '/api/houseplan/structural/upload') allowed(typeof value.type === 'string'
          && value.type.startsWith('houseplan/') && permitsCommand(capabilities, value as HouseplanCommand));
        return source.http.postJson(path, value, signal);
      },
    },
    get deviceServices() { return capabilities.deviceServices ? source.deviceServices : undefined; },
    refreshRegistry: capabilities.devices || capabilities.haAreas ? timeout => source.refreshRegistry?.(timeout) ?? Promise.resolve(false) : undefined,
  };
  guarded.set(source, host); guarded.set(host, host);
  return host;
}
