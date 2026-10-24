/** Shared authenticated own-radio feed. No HA states, persisted data or topology. */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface DirectSignalReading {
  readonly lqi: number;
  readonly provider: 'z2m' | 'zha';
  readonly available: boolean;
  readonly observed_at: number;
  readonly measurement_at: number | null;
}
export type DirectSignalReadings = Readonly<Record<string, DirectSignalReading>>;
interface SignalConnection {
  subscribeMessage?: (callback: (message: unknown) => void, message: { type: string }) => Promise<() => void | Promise<void>>;
  addEventListener?: (event: string, callback: () => void) => void;
  removeEventListener?: (event: string, callback: () => void) => void;
}
export interface SignalRuntimeHass {
  connection?: SignalConnection;
  user?: { id?: string; is_admin?: boolean; is_active?: boolean };
  callWS?: (message: { type: string; fields?: string[] }) => Promise<unknown>;
  /** An immutable function-free render snapshot carries its exact reading set. */
  zigbeeLqi?: DirectSignalReadings;
}
interface Cache {
  identity: string; generation: number; readings: DirectSignalReadings;
  listeners: Set<() => void>; session?: string; revision: number;
  pending?: Promise<void>; remove?: () => void | Promise<void>; removeEvents?: () => void;
  unsupported?: boolean; timer?: ReturnType<typeof setTimeout>; retries: number;
}
const EMPTY: DirectSignalReadings = Object.freeze({});
const caches = new WeakMap<object, Cache>();
const identityOf = (hass: SignalRuntimeHass): string => `${hass.user?.id || ''}:${hass.user?.is_admin === true}:${hass.user?.is_active !== false}`;
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object'
  && !Array.isArray(value) ? value as Record<string, unknown> : null;
function cleanup(remove?: () => void | Promise<void>): void {
  try { void Promise.resolve(remove?.()).catch(() => {}); }
  catch { /* A lost or server-revoked subscription is already retired. */ }
}
function notify(cache: Cache): void { for (const listener of cache.listeners) listener(); }
function retire(cache: Cache): void {
  cache.generation++; cleanup(cache.remove); cache.remove = undefined;
  cleanup(cache.removeEvents); cache.removeEvents = undefined;
  clearTimeout(cache.timer); cache.timer = undefined; cache.pending = undefined;
  cache.session = undefined; cache.revision = -1; cache.readings = EMPTY;
}
function cacheOf(hass: SignalRuntimeHass): Cache | null {
  if (!hass.connection) return null;
  let cache = caches.get(hass.connection);
  const identity = identityOf(hass);
  if (cache && cache.identity !== identity) {
    retire(cache); notify(cache); cache.listeners.clear(); cache = undefined;
  }
  if (!cache) {
    cache = { identity, generation: 0, readings: EMPTY, listeners: new Set(), revision: -1, retries: 0 };
    caches.set(hass.connection, cache);
  }
  return cache;
}
export function directSignalReadings(hass: SignalRuntimeHass | null | undefined): DirectSignalReadings {
  if (hass?.zigbeeLqi) return hass.zigbeeLqi;
  return hass?.connection ? cacheOf(hass)?.readings || EMPTY : EMPTY;
}
/** Validate the entire atomic projection before replacing any current value. */
export function normalizeDirectSignalReadings(value: unknown): DirectSignalReadings | null {
  const rows = record(value);
  if (!rows || Object.keys(rows).length > 1500) return null;
  const result: Record<string, DirectSignalReading> = Object.create(null);
  for (const [id, raw] of Object.entries(rows)) {
    const row = record(raw);
    if (!id || id.length > 128 || !row || typeof row.lqi !== 'number' || !Number.isFinite(row.lqi)
        || row.lqi < 0 || row.lqi > 255 || (row.provider !== 'z2m' && row.provider !== 'zha')
        || typeof row.available !== 'boolean' || typeof row.observed_at !== 'number' || !Number.isFinite(row.observed_at)
        || !(row.measurement_at === null || (typeof row.measurement_at === 'number' && Number.isFinite(row.measurement_at)))) return null;
    result[id] = Object.freeze({ lqi: row.lqi, provider: row.provider, available: row.available,
      observed_at: row.observed_at, measurement_at: row.measurement_at });
  }
  return Object.freeze(result);
}
function start(cache: Cache, hass: SignalRuntimeHass): void {
  if (!cache.listeners.size || cache.pending || cache.remove || cache.unsupported || !hass.callWS
      || !hass.connection?.subscribeMessage || hass.user?.is_active === false) return;
  const generation = cache.generation;
  const active = () => generation === cache.generation && cache.listeners.size > 0 && cache.identity === identityOf(hass);
  const retry = () => {
    if (!active() || cache.timer) return;
    cache.timer = setTimeout(() => { cache.timer = undefined; start(cache, hass); }, Math.min(30_000, 1000 * 2 ** Math.min(cache.retries++, 5)));
  };
  cache.pending = (async () => {
    // [] means a full document on this API; request only its small model tag.
    // Capability metadata is outside the projection. No config body is adopted.
    const response = record(await hass.callWS!({ type: 'houseplan/config/get', fields: ['model_version'] }));
    if (!active()) return;
    if (response?.zigbee_lqi_api !== 1) { cache.unsupported = true; return; }
    const remove = await hass.connection!.subscribeMessage!((message) => {
      if (!active()) return;
      const envelope = record(message);
      if (!envelope || typeof envelope.session_id !== 'string' || envelope.session_id.length > 80
          || !Number.isSafeInteger(envelope.revision) || (envelope.revision as number) < 0) return;
      if (envelope.kind === 'closed') {
        if (envelope.session_id !== cache.session) return;
        cache.generation++;
        cleanup(cache.remove); cache.remove = undefined;
        cache.pending = undefined;
        cache.session = undefined; cache.revision = -1; cache.readings = EMPTY; notify(cache);
        clearTimeout(cache.timer);
        cache.timer = setTimeout(() => { cache.timer = undefined; start(cache, hass); }, 1000);
        return;
      }
      if (envelope.kind !== 'reset' || (cache.session === envelope.session_id && (envelope.revision as number) <= cache.revision)) return;
      const readings = normalizeDirectSignalReadings(envelope.devices);
      if (!readings) return;
      cache.session = envelope.session_id; cache.revision = envelope.revision as number;
      cache.readings = readings; cache.retries = 0; notify(cache);
    }, { type: 'houseplan/zigbee_lqi/subscribe' });
    if (!active()) cleanup(remove); else cache.remove = remove;
  })().catch((error: unknown) => {
    if (!active()) return;
    const code = record(error)?.code;
    if (code === 'unknown_command' || code === 'unauthorized' || code === 'invalid_format') cache.unsupported = true;
    else retry();
  }).finally(() => { if (active()) cache.pending = undefined; });
}
export function subscribeDirectSignal(hass: SignalRuntimeHass, changed: () => void): () => void {
  const cache = cacheOf(hass);
  if (!cache) return () => {};
  cache.listeners.add(changed);
  if (!cache.removeEvents) {
    const connection = hass.connection!;
    const lost = () => {
      cache.generation++; cleanup(cache.remove); cache.remove = undefined; cache.pending = undefined;
      clearTimeout(cache.timer); cache.timer = undefined;
      cache.readings = EMPTY; cache.session = undefined; cache.revision = -1; notify(cache);
    };
    const ready = () => { cache.unsupported = false; start(cache, hass); };
    connection.addEventListener?.('disconnected', lost);
    connection.addEventListener?.('ready', ready);
    cache.removeEvents = () => {
      connection.removeEventListener?.('disconnected', lost);
      connection.removeEventListener?.('ready', ready);
    };
  }
  start(cache, hass);
  return () => {
    cache.listeners.delete(changed);
    if (!cache.listeners.size) { retire(cache); cache.unsupported = false; }
  };
}

/** Lit owns acquisition/release for both cards, including a same-node reconnect. */
export class DeviceSignalController implements ReactiveController {
  private connected = false;
  private connection?: SignalConnection;
  private identity = '';
  private remove?: () => void;
  constructor(private host: ReactiveControllerHost, private hass: () => SignalRuntimeHass | undefined, private changed: () => void) {
    host.addController(this);
  }
  hostConnected(): void { this.connected = true; this.hostUpdate(); }
  hostUpdate(): void {
    // Lit may finish a queued update after detach, including a new HA assignment.
    if (!this.connected) return;
    const hass = this.hass();
    const identity = hass ? identityOf(hass) : '';
    if (hass?.connection === this.connection && identity === this.identity) return;
    this.release(); this.connection = hass?.connection; this.identity = identity;
    if (hass?.connection) this.remove = subscribeDirectSignal(hass, () => { this.changed(); this.host.requestUpdate(); });
  }
  private release(): void { this.remove?.(); this.remove = undefined; this.connection = undefined; this.identity = ''; }
  hostDisconnected(): void { this.connected = false; this.release(); }
}
