/** HA is private to this adapter; plan consumers receive the ports in plan-host. */
import { acquireHaRegistries, haRegistrySnapshot, refreshHaRegistries, reloadHaRegistriesBounded } from './ha-binding-status';
import { subscribeExternalScreenConfig } from './external-screens-events';
import { HA_CAPABILITIES, capabilityHost } from './plan-capabilities';
import {
  hostAuthorityKey, hostError, once,
  type HostAuthorityKey, type HostContentPort, type HostDeviceServices,
  type HostEnvironment, type HostEvent, type HostHttpPort, type HostPermissions,
  type HostPresentationContext, type HostRegistrySnapshot, type HostSubscriptionOptions,
  type HouseplanCommand, type HouseplanHttpPath, type PlanEventName, type PlanHost, type Unsubscribe,
} from './plan-host';

type UnknownRow = Record<string, unknown>;
interface HaConnection {
  connected?: boolean;
  subscribeEvents?: (receive: (event: unknown) => void, event: string) => Promise<Unsubscribe>;
  subscribeMessage?: (receive: (event: unknown) => void, command: object) => Promise<Unsubscribe>;
  addEventListener?: (event: string, receive: () => void) => void;
  removeEventListener?: (event: string, receive: () => void) => void;
}
interface HaSource {
  connection?: HaConnection;
  callWS?: (command: object) => Promise<unknown>;
  callApi?: (method: string, path: string, value?: UnknownRow) => Promise<unknown>;
  fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response>;
  callService?: (domain: string, service: string, data?: Readonly<UnknownRow>, target?: Readonly<UnknownRow>) => Promise<unknown>;
  services?: Readonly<Record<string, unknown>>;
  auth?: { data?: { access_token?: string } };
  user?: { id?: string; is_admin?: boolean };
  states?: HostEnvironment['states'];
  devices?: HostRegistrySnapshot['devices'];
  entities?: HostRegistrySnapshot['entities'];
  areas?: HostRegistrySnapshot['areas'];
  language?: string;
  locale?: HostPresentationContext['locale'];
  localize?: HostPresentationContext['localize'];
  themes?: HostPresentationContext['themes'];
  config?: { time_zone?: string; unit_system?: HostEnvironment['units'] };
}
interface Lease { key: HostAuthorityKey; revision: number; rights: string }
const EMPTY = Object.freeze({});
const row = (value: unknown): value is UnknownRow => !!value && typeof value === 'object' && !Array.isArray(value);
const httpError = (value: unknown, status: number): Error & { code: string } => {
  if (status === 401 || status === 403) return hostError('unauthorized');
  if (status === 413) return hostError('too_large');
  const code = row(value) ? value.error ?? value.code : undefined;
  return hostError(typeof code === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(code)
    ? code : status === 404 ? 'upload_unavailable' : 'upload_failed');
};
function checkedPath(path: HouseplanHttpPath): void {
  const url = new URL(path, 'https://houseplan.invalid');
  if (url.origin !== 'https://houseplan.invalid' || !url.pathname.startsWith('/api/houseplan/') || url.hash)
    throw hostError('invalid_payload');
}
function assertNotAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw new DOMException('Houseplan request cancelled', 'AbortError');
}

export class HaPlanHost implements PlanHost {
  readonly capabilities = HA_CAPABILITIES;
  private source: HaSource = {};
  private readonly fallback = {};
  private key: HostAuthorityKey = hostAuthorityKey(undefined, undefined, this.fallback);
  private writeRevision = 0;
  private revision = 0;
  private smartHomeRevision = 0;
  private metadataServices?: HaSource['services'];
  private metadataConfig?: HaSource['config'];
  private serverWrite: boolean | null = null;
  private permissionSignature = '';
  private readonly listeners = new Set<() => void>();
  private readonly subscriptions = new Set<Unsubscribe>();
  private registryRelease?: Unsubscribe;
  private registryNotify?: () => void;
  private connectionRelease?: Unsubscribe;
  private runtimeKey?: HostAuthorityKey;
  private runtimeOwner?: object;
  private snapshot!: HostEnvironment;
  private lastInput: unknown;
  private suspended = false;
  private inputKey = {};
  private connectionRevision = 0;
  private connectionLost = false;
  private runtimeReleaseTimer?: number;
  private registryRefreshPending = false;

  constructor(source: unknown) { this.update(source); }
  get authorityKey(): HostAuthorityKey { return this.key; }
  get writeAuthorityRevision(): number { return this.writeRevision; }
  get environmentRevision(): number { return this.revision; }
  get environment(): HostEnvironment { return this.snapshot; }
  lend(source: unknown): void {
    if (source !== this.lastInput) this.update(source);
    else this.synchronize();
  }

  /** Legacy getters do not turn every lookup into another environment tick. */
  synchronize(): void {
    if (this.suspended) return;
    const registry = this.registrySnapshot();
    if (this.identity() !== this.key || this.rights() !== this.permissionSignature
        || this.connected() !== this.snapshot.connected
        || (this.source.states ?? EMPTY) !== this.snapshot.states
        || (this.source.areas ?? EMPTY) !== this.snapshot.registry.areas
        || this.source.language !== this.snapshot.presentation.language
        || this.source.locale !== this.snapshot.presentation.locale
        || this.source.themes !== this.snapshot.presentation.themes
        || this.source.services !== this.metadataServices || this.source.config !== this.metadataConfig
        || this.source.config?.time_zone !== this.snapshot.timeZone
        || (this.source.config?.unit_system ?? EMPTY) !== this.snapshot.units
        || registry.revision !== this.snapshot.registry.revision
        || registry.devices !== this.snapshot.registry.devices || registry.entities !== this.snapshot.registry.entities)
      this.update(this.source);
  }

  private identity(): HostAuthorityKey {
    return hostAuthorityKey(this.source.connection ?? this.source.callWS, this.source.user?.id, this.fallback);
  }
  private permissions(): HostPermissions {
    const admin = this.source.user?.is_admin === true;
    return { read: typeof this.source.callWS === 'function', write: this.serverWrite ?? admin, admin };
  }
  private rights(): string { const p = this.permissions(); return `${p.read}:${p.write}:${p.admin}`; }
  private connected(): boolean { return !this.suspended && !this.connectionLost
    && typeof this.source.callWS === 'function' && this.source.connection?.connected !== false; }
  private registrySnapshot(): HostRegistrySnapshot {
    const registry = haRegistrySnapshot(this.source);
    return {
      ...registry,
      devices: registry.authoritative ? registry.devices : this.source.devices ?? EMPTY,
      entities: registry.authoritative ? registry.entities : this.source.entities ?? EMPTY,
      areas: this.source.areas ?? EMPTY,
    };
  }

  /** Every HA assignment is an environment tick, including reused objects. */
  update(value: unknown): void {
    // HA can briefly withdraw the snapshot without changing the signed-in
    // authority. Refuse dispatch while absent, but do not invent A→B→A.
    if (value == null) {
      this.lastInput = value; this.suspended = true;
      this.releaseSubscriptions(); this.releaseRuntime(); this.publish();
      return;
    }
    this.suspended = false;
    if (value !== this.lastInput || (row(value) && this.snapshot?.states !== (value.states ?? EMPTY))) this.inputKey = {};
    const before = this.permissionSignature, previousKey = this.key;
    const previousAdmin = this.snapshot?.permissions.admin;
    this.lastInput = value;
    this.source = row(value) ? value as HaSource : {};
    this.key = this.identity();
    if (this.key !== previousKey || previousAdmin !== (this.source.user?.is_admin === true)) this.serverWrite = null;
    if (this.key !== previousKey || before !== this.rights()) this.writeRevision++;
    if (this.key !== previousKey) {
      this.connectionLost = false; this.connectionRevision = 0;
      this.releaseSubscriptions();
      this.releaseRuntime();
    }
    this.publish();
    if (this.listeners.size) this.acquireRuntime();
  }

  /** The accepted server permission is distinct from an HA admin hint. */
  setServerWrite(value: boolean | null): void {
    if (this.serverWrite === value) return;
    const before = this.permissionSignature;
    this.serverWrite = value;
    if (before !== this.rights()) this.writeRevision++;
    this.publish();
  }

  /** Host-specific telemetry changed, not another HA input frame. */
  invalidateData(): void { this.publish(); }

  private publish(): void {
    if (this.source.services !== this.metadataServices || this.source.config !== this.metadataConfig) this.smartHomeRevision++;
    this.metadataServices = this.source.services; this.metadataConfig = this.source.config;
    this.permissionSignature = this.rights();
    const registry = this.registrySnapshot();
    // Never spread source: this exact four-field value is the UI bridge.
    const presentation: HostPresentationContext = Object.freeze({
      language: this.source.language, locale: this.source.locale,
      localize: this.source.localize ? this.localize : undefined, themes: this.source.themes,
    });
    this.snapshot = Object.freeze({
      inputKey: this.inputKey,
      ready: !this.suspended && typeof this.source.callWS === 'function', connected: this.connected(),
      connectionRevision: this.connectionRevision,
      smartHomeRevision: this.smartHomeRevision,
      userId: this.source.user?.id, permissions: Object.freeze(this.permissions()),
      timeZone: this.source.config?.time_zone, units: this.source.config?.unit_system ?? EMPTY,
      states: this.source.states ?? EMPTY,
      registry: Object.freeze(registry),
      presentation,
    });
    this.revision++;
    for (const receive of [...this.listeners]) receive();
  }
  private readonly localize = (key: string, ...args: unknown[]): string | undefined =>
    this.source.localize?.call(this.source, key, ...args);

  subscribeEnvironment(receive: () => void): Unsubscribe {
    if (this.runtimeReleaseTimer !== undefined) globalThis.clearTimeout(this.runtimeReleaseTimer);
    this.runtimeReleaseTimer = undefined;
    let live = true;
    const listener = () => { if (live) receive(); };
    this.listeners.add(listener);
    this.acquireRuntime();
    return once(() => {
      live = false;
      this.listeners.delete(listener);
      // Same two-second DOM-move grace as registry coverage. No consumer is
      // called while detached, but a lost→ready pair remains observable when
      // this same card returns; all adapter listeners are released afterward.
      if (!this.listeners.size) {
        // Keep only transport coverage. An old detached HA projection must
        // not keep publishing against a shared live registry cache.
        const registry = this.registryRelease; this.registryRelease = undefined; registry?.();
        this.runtimeReleaseTimer = globalThis.setTimeout(() => {
          this.runtimeReleaseTimer = undefined; this.releaseRuntime();
        }, 2000);
      }
    });
  }
  private acquireRuntime(): void {
    if (this.runtimeKey === this.key) {
      if (!this.registryRelease && this.registryNotify && this.source.connection?.subscribeEvents)
        this.registryRelease = acquireHaRegistries(this.source, this.registryNotify);
      if (this.registryRefreshPending) {
        this.registryRefreshPending = false;
        refreshHaRegistries(this.source, { connectionReady: true });
      }
      return;
    }
    this.releaseRuntime();
    this.runtimeKey = this.key;
    const connection = this.source.connection, key = this.key, owner = {};
    this.runtimeOwner = owner;
    if (!connection) return;
    const notify = () => {
      if (this.key !== key || this.runtimeOwner !== owner) return;
      if (this.listeners.size) this.publish();
      else {
        // Detached transport events update demand metadata only; reading an
        // old registry projection here could invalidate the mounted card's
        // shared cache and trigger background work during its gesture.
        this.snapshot = Object.freeze({ ...this.snapshot, connected: this.connected(),
          connectionRevision: this.connectionRevision });
        this.revision++;
      }
    };
    this.registryNotify = notify;
    const ready = () => {
      if (this.key !== key || this.runtimeOwner !== owner) return;
      this.connectionLost = false; this.connectionRevision++;
      if (this.listeners.size) refreshHaRegistries(this.source, { connectionReady: true });
      else this.registryRefreshPending = true;
      notify();
    };
    const lost = () => {
      if (this.key !== key || this.runtimeOwner !== owner) return;
      this.connectionLost = true; this.connectionRevision++; notify();
    };
    connection.addEventListener?.('ready', ready);
    connection.addEventListener?.('disconnected', lost);
    connection.addEventListener?.('reconnect-error', lost);
    this.connectionRelease = once(() => {
      connection.removeEventListener?.('ready', ready);
      connection.removeEventListener?.('disconnected', lost);
      connection.removeEventListener?.('reconnect-error', lost);
    });
    if (typeof connection.subscribeEvents === 'function')
      this.registryRelease = acquireHaRegistries(this.source, notify);
  }
  private releaseRuntime(): void {
    if (this.runtimeReleaseTimer !== undefined) globalThis.clearTimeout(this.runtimeReleaseTimer);
    this.runtimeReleaseTimer = undefined;
    this.registryRefreshPending = false;
    const registry = this.registryRelease, connection = this.connectionRelease;
    this.registryRelease = undefined;
    this.registryNotify = undefined;
    this.connectionRelease = undefined;
    this.runtimeKey = undefined;
    this.runtimeOwner = undefined;
    try { registry?.(); } finally { connection?.(); }
  }
  private releaseSubscriptions(): void {
    for (const release of [...this.subscriptions]) {
      try { release(); } catch { /* Retire other owners even if one transport cleanup failed. */ }
    }
  }

  private lease(httpResponse = false): Lease {
    // Historical upload helpers lend only HTTP credentials. A known offline
    // HA connection still forbids dispatch; no fake callWS is manufactured.
    if (this.suspended || (httpResponse ? this.connectionLost || this.source.connection?.connected === false : !this.connected())) throw hostError('not_ready');
    return { key: this.identity(), revision: this.writeRevision, rights: this.rights() };
  }
  private assert(lease: Lease): void {
    if (this.identity() !== lease.key || this.writeRevision !== lease.revision || this.rights() !== lease.rights)
      throw hostError('context-changed');
  }
  private async owned<Result>(lease: Lease, run: () => Promise<Result>, signal?: AbortSignal | null,
    httpResponse = false): Promise<Result> {
    try {
      this.assert(lease); assertNotAborted(signal);
      if (this.suspended || (httpResponse ? this.connectionLost || this.source.connection?.connected === false : !this.connected())) throw hostError('not_ready');
      const result = await run();
      this.assert(lease);
      // A raw Response may contain a late opaque upload token. Its domain
      // owner must read/discard it before reporting cancellation (#971).
      if (!httpResponse) assertNotAborted(signal);
      return result;
    }
    catch (error) { this.assert(lease); assertNotAborted(signal); throw error; }
  }
  async request<Result = unknown>(command: HouseplanCommand): Promise<Result> {
    if (!row(command) || typeof command.type !== 'string' || !command.type.startsWith('houseplan/'))
      throw hostError('invalid_payload');
    const lease = this.lease(), source = this.source;
    return this.owned(lease, () => source.callWS!.call(source, command)) as Promise<Result>;
  }

  async subscribe(event: PlanEventName, receive: (event: HostEvent) => void | Promise<void>,
    options?: HostSubscriptionOptions): Promise<Unsubscribe> {
    const lease = this.lease(), connection = this.source.connection;
    if (!connection?.subscribeEvents) throw hostError('not_ready');
    let live = true, remove: Unsubscribe | undefined;
    const release = once(() => {
      live = false; this.subscriptions.delete(release); remove?.();
    });
    const forward = (value: unknown) => {
      if (live && this.identity() === lease.key && this.writeRevision === lease.revision
          && this.rights() === lease.rights) return receive(value as HostEvent);
    };
    const port = {
      subscribeEvents: (callback: (event: unknown) => void, name: string) => connection.subscribeEvents!.call(connection, callback, name),
      subscribeMessage: connection.subscribeMessage
        ? (callback: (event: unknown) => void, command: object) => connection.subscribeMessage!.call(connection, callback, command) : undefined,
    };
    try {
      remove = event === 'houseplan_config_updated'
        ? await subscribeExternalScreenConfig(port, options?.externalScreens?.enabled === true,
          options?.externalScreens?.baseRevision ?? 0, data => forward({ data }))
        : await port.subscribeEvents(forward, event);
      this.assert(lease);
      this.subscriptions.add(release);
      return release;
    } catch (error) { release(); throw error; }
  }

  readonly http: HostHttpPort = {
    request: async (path, init) => {
      checkedPath(path);
      assertNotAborted(init?.signal);
      const lease = this.lease(true), source = this.source;
      if (source.fetchWithAuth) return this.owned(lease, () => source.fetchWithAuth!.call(source, path, init), init?.signal, true);
      const headers = new Headers(init?.headers), token = source.auth?.data?.access_token;
      if (token) headers.set('authorization', `Bearer ${token}`);
      return this.owned(lease, () => fetch(path, { ...init, headers }), init?.signal, true);
    },
    postJson: async (path, value, signal) => {
      checkedPath(path);
      assertNotAborted(signal);
      const lease = this.lease(), source = this.source;
      if (source.fetchWithAuth) {
        const response = await this.owned(lease, () => source.fetchWithAuth!.call(source, path, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value), signal,
        }), signal);
        let data: unknown;
        try { data = await this.owned(lease, () => response.json(), signal); }
        catch (error) { this.assert(lease); if ((error as Error)?.name === 'AbortError') throw error; throw httpError(undefined, response.status); }
        if (!response.ok) throw httpError(data, response.status);
        return data;
      }
      if (!source.callApi) throw hostError('upload_unavailable');
      try { return await this.owned(lease, () => source.callApi!.call(source, 'POST', path.slice('/api/'.length), value), signal); }
      catch (error) {
        this.assert(lease);
        if (row(error) && (error.status_code !== undefined || error.body !== undefined))
          throw httpError(error.body, typeof error.status_code === 'number' ? error.status_code : 0);
        throw error;
      }
    },
  };
  readonly content: HostContentPort = {
    resolveAssets: ids => this.request({ type: 'houseplan/assets/resolve', asset_ids: [...ids] }),
    resolve: async paths => {
      const result = await this.request<{ urls?: unknown }>({ type: 'houseplan/content/sign', paths: [...paths] });
      const urls = row(result?.urls) ? result.urls : EMPTY;
      return Object.fromEntries(paths.flatMap(path => typeof urls[path] === 'string' && urls[path] ? [[path, urls[path] as string]] : []));
    },
  };
  refreshRegistry(timeoutMs: number): Promise<boolean> {
    if (!this.connected()) return Promise.resolve(false);
    return reloadHaRegistriesBounded(this.source, timeoutMs);
  }
  get deviceServices(): HostDeviceServices | undefined {
    if (typeof this.source.callService !== 'function') return undefined;
    return { call: (domain, service, data, target) => {
      const lease = this.lease(), source = this.source;
      if (!source.callService) return Promise.reject(hostError('not_ready'));
      return this.owned(lease, () => source.callService!.call(source, domain, service, data, target));
    } };
  }
}

/** Compatibility for remaining HA-only consumers; never hand its source back. */
const adapters = new WeakMap<object, HaPlanHost>();
export function haPlanHost(source: unknown): HaPlanHost {
  if (!row(source)) return new HaPlanHost(source);
  let host = adapters.get(source);
  if (!host) { host = new HaPlanHost(source); adapters.set(source, host); }
  else host.synchronize();
  return host;
}

export function isPlanHost(value: unknown): value is PlanHost {
  return row(value) && typeof value.request === 'function' && typeof value.environmentRevision === 'number'
    && typeof value.writeAuthorityRevision === 'number' && !!value.authorityKey && row(value.environment);
}

/** Normalize historical helper inputs at the HA boundary, not in plan logic. */
export const planHostFrom = (value: unknown): PlanHost => capabilityHost(isPlanHost(value) ? value : haPlanHost(value));
export interface PlanHostProvider { readonly planHost?: PlanHost; readonly hass?: unknown }
const providerAdapters = new WeakMap<PlanHostProvider, HaPlanHost>();
export function planHostOf(provider: PlanHostProvider): PlanHost {
  if (provider.planHost !== undefined) {
    if (!isPlanHost(provider.planHost)) throw hostError('not_ready');
    return capabilityHost(provider.planHost);
  }
  let host = providerAdapters.get(provider);
  if (!host) { host = new HaPlanHost(provider.hass); providerAdapters.set(provider, host); }
  else host.lend(provider.hass);
  return capabilityHost(host);
}
