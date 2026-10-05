import {
  normalizeZ2mTopology, normalizeZhaTopology, TOPOLOGY_MAX_PAYLOAD_BYTES, type ZigbeeTopology,
} from './zigbee-topology';
import { normalizeZ2mBaseTopic } from './zigbee-topology-settings';

export type ZigbeeTopologyErrorCode =
  | 'permission'
  | 'unsupported'
  | 'timeout'
  | 'invalid_topic'
  | 'invalid_payload'
  | 'provider';

export type ZigbeeProviderState = {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  obtainedAt?: number;
  partial?: boolean;
  /** A failed refresh retained the last good snapshot; age is checked separately. */
  stale?: boolean;
  error?: ZigbeeTopologyErrorCode;
};

export interface ZigbeeTopologyRuntimeSnapshot {
  revision: number;
  topologies: ZigbeeTopology[];
  states: Record<string, ZigbeeProviderState>;
}

export interface ZigbeeTopologyHass {
  user?: { is_admin?: boolean };
  language?: string;
  connection?: {
    subscribeMessage?: (
      callback: (message: unknown) => void,
      message: { type: 'mqtt/subscribe'; topic: string },
    ) => Promise<() => void>;
  };
  callWS?: (message: { type: string }) => Promise<unknown>;
  callService?: (
    domain: string, service: string, data: Record<string, unknown>,
  ) => Promise<unknown>;
}

type Cache = ZigbeeTopologyRuntimeSnapshot & {
  listeners: Set<() => void>;
  inflight: Map<string, Promise<void>>;
};

const caches = new WeakMap<object, Cache>();

// Route-table scans are sequential in Z2M and can outlast the old 150 s budget.
const Z2M_SCAN_TIMEOUT_MS = 600_000;
const Z2M_TRANSPORT_TIMEOUT_MS = 10_000;

function keyOf(hass: ZigbeeTopologyHass | null | undefined): object | null {
  const key = hass?.connection || hass;
  return key && (typeof key === 'object' || typeof key === 'function') ? key : null;
}

function cacheOf(hass: ZigbeeTopologyHass | null | undefined): Cache | null {
  const key = keyOf(hass);
  if (!key) return null;
  let cache = caches.get(key);
  if (!cache) {
    cache = { revision: 0, topologies: [], states: {}, listeners: new Set(), inflight: new Map() };
    caches.set(key, cache);
  }
  return cache;
}

function notify(cache: Cache): void {
  cache.revision++;
  for (const listener of cache.listeners) listener();
}

function state(cache: Cache, key: string, value: ZigbeeProviderState): void {
  cache.states = { ...cache.states, [key]: value };
  notify(cache);
}

function store(cache: Cache, topology: ZigbeeTopology): void {
  cache.topologies = [
    ...cache.topologies.filter((item) => !(item.provider === topology.provider
      && item.instanceId === topology.instanceId)),
    topology,
  ];
  state(cache, topology.provider === 'zha' ? 'zha' : `z2m:${topology.instanceId}`, {
    phase: 'ready', obtainedAt: topology.obtainedAt, partial: topology.warnings.length > 0,
  });
}

function errorCode(error: unknown): ZigbeeTopologyErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'permission' || code === 'unsupported' || code === 'timeout'
      || code === 'invalid_topic' || code === 'invalid_payload') return code;
  const message = String((error as { message?: unknown } | null)?.message || '').toLowerCase();
  if (message.includes('unauthor') || message.includes('permission')) return 'permission';
  if (message.includes('unknown_command') || message.includes('not found')) return 'unsupported';
  return 'provider';
}

function fail(code: ZigbeeTopologyErrorCode): Error & { code: ZigbeeTopologyErrorCode } {
  return Object.assign(new Error(code), { code });
}

function run(cache: Cache, key: string, task: () => Promise<ZigbeeTopology>): Promise<void> {
  const existing = cache.inflight.get(key);
  if (existing) return existing;
  const previous = cache.states[key];
  const retained = previous?.obtainedAt === undefined ? {} : {
    obtainedAt: previous.obtainedAt, partial: previous.partial, stale: previous.stale,
  };
  state(cache, key, { ...retained, phase: 'loading' });
  const promise = task().then((topology) => {
    if (!topology.nodes.length && topology.warnings.some((item) => item.code === 'invalid_payload')) {
      throw fail('invalid_payload');
    }
    store(cache, topology);
  }).catch((error) => {
    state(cache, key, {
      ...retained, ...(retained.obtainedAt === undefined ? {} : { stale: true }),
      phase: 'error', error: errorCode(error),
    });
  }).finally(() => cache.inflight.delete(key));
  cache.inflight.set(key, promise);
  return promise;
}

export function zigbeeTopologyRuntimeSnapshot(
  hass: ZigbeeTopologyHass | null | undefined,
): ZigbeeTopologyRuntimeSnapshot {
  const cache = cacheOf(hass);
  return cache
    ? { revision: cache.revision, topologies: cache.topologies, states: cache.states }
    : { revision: 0, topologies: [], states: {} };
}

export function subscribeZigbeeTopology(
  hass: ZigbeeTopologyHass | null | undefined, listener: () => void,
): () => void {
  const cache = cacheOf(hass);
  if (!cache) return () => undefined;
  cache.listeners.add(listener);
  return () => cache.listeners.delete(listener);
}

function requireAdmin(hass: ZigbeeTopologyHass | null | undefined): void {
  if (hass?.user?.is_admin !== true) throw fail('permission');
}

/** Read the cached ZHA graph. This must never call zha/topology/update. */
export function readZhaTopology(hass: ZigbeeTopologyHass): Promise<void> {
  const cache = cacheOf(hass);
  if (!cache) return Promise.resolve();
  return run(cache, 'zha', async () => {
    requireAdmin(hass);
    if (typeof hass?.callWS !== 'function') throw fail('unsupported');
    return normalizeZhaTopology(await hass.callWS({ type: 'zha/devices' }));
  });
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function parseMessage(message: unknown): unknown {
  const record = recordOf(message);
  const raw = record?.payload ?? message;
  if (typeof raw !== 'string') return raw;
  if (raw.length > TOPOLOGY_MAX_PAYLOAD_BYTES) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function transactionOf(value: unknown): string | null {
  const record = recordOf(value);
  const transaction = record?.transaction ?? recordOf(record?.data)?.transaction;
  return typeof transaction === 'string' || typeof transaction === 'number'
    ? String(transaction) : null;
}

function randomTransaction(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === 'function') return `houseplan-${cryptoObj.randomUUID()}`;
  return `houseplan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) {
    void promise.catch(() => undefined);
    throw fail('timeout');
  }
  let id: ReturnType<typeof globalThis.setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        id = globalThis.setTimeout(() => reject(fail('timeout')), Math.max(1, ms));
      }),
    ]);
  } finally {
    if (id !== undefined) globalThis.clearTimeout(id);
  }
}

/** Explicit, completion-aware Z2M raw network-map request through HA MQTT. */
export function refreshZ2mTopology(
  hass: ZigbeeTopologyHass, baseTopic: string, timeoutMs = Z2M_SCAN_TIMEOUT_MS,
): Promise<void> {
  const cache = cacheOf(hass);
  if (!cache) return Promise.resolve();
  const topic = normalizeZ2mBaseTopic(baseTopic);
  const cacheKey = `z2m:${topic || String(baseTopic)}`;
  return run(cache, cacheKey, async () => {
    requireAdmin(hass);
    if (!topic) throw fail('invalid_topic');
    const connection = hass.connection;
    const subscribe = connection?.subscribeMessage;
    if (typeof subscribe !== 'function' || typeof hass?.callService !== 'function') throw fail('unsupported');
    const transaction = randomTransaction();
    const deadline = Date.now() + Math.max(1, timeoutMs);
    let finished = false;
    let responseActive = false;
    let infoResolve: (() => void) | null = null;
    let responseResolve: ((value: unknown) => void) | null = null;
    let responseReject: ((reason?: unknown) => void) | null = null;
    const info = new Promise<void>((resolve) => { infoResolve = resolve; });
    const response = new Promise<unknown>((resolve, reject) => {
      responseResolve = resolve;
      responseReject = reject;
    });
    // The response can reject synchronously inside publish, before its promise is awaited.
    void response.catch(() => undefined);
    const unsubscribers: Array<() => void> = [];
    const cleanup = (unsubscribe: () => void): void => {
      try { unsubscribe(); } catch { /* cleanup is best effort */ }
    };
    const active = (): boolean => !finished && Date.now() < deadline;
    const subscribeTo = async (suffix: string, callback: (message: unknown) => void): Promise<void> => {
      if (!active()) throw fail('timeout');
      const pending = subscribe.call(connection, callback, {
        type: 'mqtt/subscribe', topic: `${topic}/${suffix}`,
      }).then((unsubscribe) => {
        if (typeof unsubscribe !== 'function') return;
        // A timed-out subscribe can still complete; do not leak its subscription.
        if (finished) cleanup(unsubscribe);
        else unsubscribers.push(unsubscribe);
      });
      await withTimeout(pending, Math.min(Z2M_TRANSPORT_TIMEOUT_MS, deadline - Date.now()));
    };
    try {
      await subscribeTo('bridge/info', (message: unknown) => {
        if (active() && recordOf(message)?.retain === true && parseMessage(message)) infoResolve?.();
      });
      await subscribeTo('bridge/response/networkmap', (message: unknown) => {
        if (!active() || !responseActive || recordOf(message)?.retain === true) return;
        const value = parseMessage(message);
        if (value === null) {
          responseReject?.(fail('invalid_payload'));
          return;
        }
        if (value && transactionOf(value) === transaction) responseResolve?.(value);
      });
      await withTimeout(info, Math.min(4000, deadline - Date.now()));
      if (!active()) throw fail('timeout');
      responseActive = true;
      const published = hass.callService('mqtt', 'publish', {
        topic: `${topic}/bridge/request/networkmap`,
        payload: JSON.stringify({ type: 'raw', routes: true, transaction }),
        qos: 0,
        retain: false,
      });
      const [, value] = await withTimeout(Promise.all([
        withTimeout(published, Math.min(Z2M_TRANSPORT_TIMEOUT_MS, deadline - Date.now())),
        response,
      ]), deadline - Date.now());
      if (!active()) throw fail('timeout');
      const status = recordOf(value)?.status;
      if (status && status !== 'ok') throw fail('provider');
      return normalizeZ2mTopology(value, topic);
    } finally {
      finished = true;
      responseActive = false;
      for (const unsubscribe of unsubscribers) cleanup(unsubscribe);
    }
  });
}
