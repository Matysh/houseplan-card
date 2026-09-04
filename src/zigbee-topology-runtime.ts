import { normalizeZ2mTopology, normalizeZhaTopology, type ZigbeeTopology } from './zigbee-topology';
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
  state(cache, key, { phase: 'loading' });
  const promise = task().then((topology) => {
    if (!topology.nodes.length && topology.warnings.some((item) => item.code === 'invalid_payload')) {
      throw fail('invalid_payload');
    }
    store(cache, topology);
  }).catch((error) => {
    state(cache, key, { phase: 'error', error: errorCode(error) });
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
  hass: ZigbeeTopologyHass, baseTopic: string, timeoutMs = 150_000,
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
    let responseActive = false;
    let infoResolve: (() => void) | null = null;
    let responseResolve: ((value: unknown) => void) | null = null;
    let responseReject: ((reason?: unknown) => void) | null = null;
    const info = new Promise<void>((resolve) => { infoResolve = resolve; });
    const response = new Promise<unknown>((resolve, reject) => {
      responseResolve = resolve;
      responseReject = reject;
    });
    const unsubscribers: Array<() => void> = [];
    try {
      const unsubInfo = await subscribe.call(connection, (message: unknown) => {
        if (recordOf(message)?.retain === true && parseMessage(message)) infoResolve?.();
      }, { type: 'mqtt/subscribe', topic: `${topic}/bridge/info` });
      if (typeof unsubInfo === 'function') unsubscribers.push(unsubInfo);
      const unsubResponse = await subscribe.call(connection, (message: unknown) => {
        if (recordOf(message)?.retain === true) return;
        const value = parseMessage(message);
        if (value === null) {
          if (responseActive) responseReject?.(fail('invalid_payload'));
          return;
        }
        if (value && transactionOf(value) === transaction) responseResolve?.(value);
      }, { type: 'mqtt/subscribe', topic: `${topic}/bridge/response/networkmap` });
      if (typeof unsubResponse === 'function') unsubscribers.push(unsubResponse);
      await withTimeout(info, Math.min(4000, Math.max(1, deadline - Date.now())));
      responseActive = true;
      await hass.callService('mqtt', 'publish', {
        topic: `${topic}/bridge/request/networkmap`,
        payload: JSON.stringify({ type: 'raw', routes: false, transaction }),
        qos: 0,
        retain: false,
      });
      const value = await withTimeout(response, deadline - Date.now());
      const status = recordOf(value)?.status;
      if (status && status !== 'ok') throw fail('provider');
      return normalizeZ2mTopology(value, topic);
    } finally {
      for (const unsubscribe of unsubscribers) {
        try { unsubscribe(); } catch { /* cleanup is best effort */ }
      }
    }
  });
}
