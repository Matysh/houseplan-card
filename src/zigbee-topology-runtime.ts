import { normalizeZ2mTopology, normalizeZhaTopology, type ZigbeeTopology } from './zigbee-topology';
import { normalizeZ2mBaseTopic } from './zigbee-topology-settings';

export type ZigbeeTopologyErrorCode = 'permission' | 'unsupported' | 'timeout' | 'invalid_topic'
  | 'invalid_payload' | 'provider' | 'backend_required' | 'connection';
export type ZigbeeProviderState = {
  phase: 'idle' | 'loading' | 'ready' | 'error' | 'cancelled';
  obtainedAt?: number; partial?: boolean; stale?: boolean; error?: ZigbeeTopologyErrorCode;
  jobId?: string; stage?: 'connecting' | 'waiting'; startedAt?: number;
  elapsedMs?: number; elapsedObservedAt?: number; cancelAfterMs?: number;
};
export interface ZigbeeTopologyRuntimeSnapshot {
  revision: number; topologies: ZigbeeTopology[]; states: Record<string, ZigbeeProviderState>;
  backendError?: ZigbeeTopologyErrorCode; backendConnected?: boolean;
}
export interface ZigbeeTopologyHass {
  user?: { id?: string; is_admin?: boolean }; language?: string;
  connection?: {
    subscribeMessage?: (callback: (message: unknown) => void, message: { type: string }) => Promise<() => void>;
    addEventListener?: (event: string, callback: () => void) => void;
    removeEventListener?: (event: string, callback: () => void) => void;
  };
  callWS?: (message: { type: string; base_topic?: string; job_id?: string }) => Promise<unknown>;
}
type Cache = ZigbeeTopologyRuntimeSnapshot & {
  listeners: Set<() => void>; inflight: Map<string, Promise<void>>; generation: number; identity: string;
  session?: string; serverRevision: number; topicRevisions: Map<string, number>;
  capability?: Promise<void>; feedPending?: Promise<void>; unsubscribe?: () => void; releaseEvents?: () => void;
};
const caches = new WeakMap<object, Cache>();
const empty = (): ZigbeeTopologyRuntimeSnapshot => ({ revision: 0, topologies: [], states: {} });
const monotonicNow = (): number => globalThis.performance.now();
export const zigbeeTopologyUserIdentity = (hass: ZigbeeTopologyHass): string => `${hass.user?.id || ''}:${hass.user?.is_admin === true}`;
export function zigbeeScanElapsedMs(current: ZigbeeProviderState, now = monotonicNow()): number {
  return Math.max(0, current.elapsedMs || 0) + (current.phase === 'loading'
    ? Math.max(0, now - (current.elapsedObservedAt ?? now)) : 0);
}
export function zigbeeScanCanCancel(current: ZigbeeProviderState, now = monotonicNow()): boolean {
  return current.phase === 'loading' && !!current.jobId
    && zigbeeScanElapsedMs(current, now) >= (current.cancelAfterMs ?? 600_000);
}
export function formatZigbeeScanElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000), minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
function cacheOf(hass: ZigbeeTopologyHass | null | undefined): Cache | null {
  const key = hass?.connection || hass;
  if (!key || typeof key !== 'object') return null;
  let cache = caches.get(key);
  const identity = zigbeeTopologyUserIdentity(hass!);
  if (cache && cache.identity !== identity) {
    cache.generation++; cleanup(cache.unsubscribe); cleanup(cache.releaseEvents); cache.listeners.clear();
    cache = undefined;
  }
  if (!cache) {
    cache = { ...empty(), listeners: new Set(), inflight: new Map(), generation: 0,
      serverRevision: -1, topicRevisions: new Map(), identity };
    caches.set(key, cache);
  }
  return cache;
}
function notify(cache: Cache): void { cache.revision++; for (const listener of cache.listeners) listener(); }
function state(cache: Cache, key: string, value: ZigbeeProviderState): void {
  cache.states = { ...cache.states, [key]: value }; notify(cache);
}
function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function errorCode(error: unknown): ZigbeeTopologyErrorCode {
  const code = recordOf(error)?.code;
  if (code === 'permission' || code === 'unauthorized') return 'permission';
  if (code === 'unknown_command' || code === 'not_ready' || code === 'backend_required') return 'backend_required';
  if (code === 'unsupported' || code === 'timeout' || code === 'invalid_topic'
      || code === 'invalid_payload' || code === 'connection') return code;
  return 'provider';
}
function fail(code: ZigbeeTopologyErrorCode): Error & { code: ZigbeeTopologyErrorCode } {
  return Object.assign(new Error(code), { code });
}
function requireAdmin(hass: ZigbeeTopologyHass): void { if (hass?.user?.is_admin !== true) throw fail('permission'); }
function cleanup(unsubscribe?: () => void): void { try { unsubscribe?.(); } catch { /* Already disconnected. */ } }
function removeTopics(cache: Cache, keep: Set<string>): void {
  cache.topologies = cache.topologies.filter(item => item.provider !== 'z2m' || keep.has(item.instanceId));
  cache.states = Object.fromEntries(Object.entries(cache.states).filter(([key]) => !key.startsWith('z2m:') || keep.has(key.slice(4))));
}
/** Only a reset from the current subscription can replace the server session. */
function accept(cache: Cache, message: unknown, fromSubscription: boolean): void {
  const envelope = recordOf(message);
  if (!envelope || typeof envelope.session_id !== 'string' || !Number.isSafeInteger(envelope.revision)) return;
  const revision = envelope.revision as number;
  if (revision < 0) return;
  if (envelope.kind === 'reset') {
    if (!fromSubscription || !Array.isArray(envelope.topics) || envelope.topics.length > 8) return;
    if (cache.session === envelope.session_id && revision < cache.serverRevision) return;
    if (cache.session !== envelope.session_id) removeTopics(cache, new Set());
    cache.session = envelope.session_id; cache.serverRevision = revision;
    cache.topicRevisions.clear(); // Initial slot events legitimately share the reset revision.
    removeTopics(cache, new Set(envelope.topics.map(normalizeZ2mBaseTopic).filter((v): v is string => !!v)));
    cache.backendConnected = true; cache.backendError = undefined; notify(cache); return;
  }
  if (cache.session && envelope.session_id !== cache.session) return;
  if (revision < cache.serverRevision) return;
  const provider = recordOf(envelope.provider);
  const topic = normalizeZ2mBaseTopic(envelope.kind === 'removed' ? envelope.topic : provider?.topic);
  if (!topic || revision <= (cache.topicRevisions.get(topic) ?? -1)) return;
  if (envelope.kind === 'removed') {
    removeTopics(cache, new Set(Object.keys(cache.states).filter(k => k.startsWith('z2m:') && k !== `z2m:${topic}`).map(k => k.slice(4))));
  } else {
    if (envelope.kind !== 'state' || !provider || typeof provider.job_id !== 'string'
        || !['loading', 'ready', 'error', 'cancelled'].includes(String(provider.phase))
        || typeof provider.elapsed_ms !== 'number' || !Number.isFinite(provider.elapsed_ms) || provider.elapsed_ms < 0) return;
    let topology: ZigbeeTopology | undefined;
    if (provider.result !== undefined && typeof provider.obtained_at === 'number') {
      topology = normalizeZ2mTopology(provider.result, topic, provider.obtained_at);
      if (!topology.nodes.length && topology.warnings.some(w => w.code === 'invalid_payload')) return;
      cache.topologies = [...cache.topologies.filter(t => t.provider !== 'z2m' || t.instanceId !== topic), topology];
    }
    cache.states = { ...cache.states, [`z2m:${topic}`]: {
      phase: provider.phase as ZigbeeProviderState['phase'], jobId: provider.job_id,
      stage: provider.stage === 'connecting' ? 'connecting' : 'waiting',
      startedAt: typeof provider.started_at === 'number' ? provider.started_at : undefined,
      elapsedMs: provider.elapsed_ms, elapsedObservedAt: monotonicNow(),
      cancelAfterMs: typeof provider.cancel_after_ms === 'number' ? Math.max(600_000, provider.cancel_after_ms) : 600_000,
      obtainedAt: topology?.obtainedAt, partial: topology ? topology.warnings.length > 0 : undefined,
      stale: provider.stale === true, error: provider.error ? errorCode({ code: provider.error }) : undefined,
    } };
  }
  cache.session = envelope.session_id; cache.serverRevision = revision; cache.topicRevisions.set(topic, revision);
  cache.backendConnected = true; cache.backendError = undefined; notify(cache);
}
async function capability(cache: Cache, hass: ZigbeeTopologyHass): Promise<void> {
  requireAdmin(hass);
  if (!cache.capability) cache.capability = (async () => {
    if (!hass.callWS || !hass.connection?.subscribeMessage) throw fail('backend_required');
    const result = recordOf(await hass.callWS({ type: 'houseplan/config/get' }));
    if (result?.zigbee_scan_api !== 1) throw fail('backend_required');
  })();
  await cache.capability;
}
function startFeed(cache: Cache, hass: ZigbeeTopologyHass): void {
  if (!cache.listeners.size || cache.feedPending || cache.unsubscribe) return;
  const generation = cache.generation;
  const active = () => generation === cache.generation && cache.listeners.size > 0
    && hass.user?.is_admin === true && cache.identity === zigbeeTopologyUserIdentity(hass);
  cache.feedPending = (async () => {
    await capability(cache, hass);
    if (!active()) return;
    const unsubscribe = await hass.connection!.subscribeMessage!((message) => {
      if (active()) accept(cache, message, true);
    }, { type: 'houseplan/zigbee/subscribe' });
    if (!active()) cleanup(unsubscribe); else cache.unsubscribe = unsubscribe;
  })().catch(error => {
    if (!active()) return;
    cache.backendError = errorCode(error); cache.backendConnected = false; notify(cache);
  }).finally(() => { if (generation === cache.generation) cache.feedPending = undefined; });
}
export function zigbeeTopologyRuntimeSnapshot(hass: ZigbeeTopologyHass | null | undefined): ZigbeeTopologyRuntimeSnapshot {
  if (hass?.user?.is_admin !== true) return empty();
  const cache = cacheOf(hass);
  return cache ? { revision: cache.revision, topologies: cache.topologies, states: cache.states,
    backendError: cache.backendError, backendConnected: cache.backendConnected } : empty();
}
export function subscribeZigbeeTopology(hass: ZigbeeTopologyHass | null | undefined, listener: () => void): () => void {
  if (!hass || hass.user?.is_admin !== true) return () => undefined;
  const cache = cacheOf(hass);
  if (!cache) return () => undefined;
  cache.listeners.add(listener);
  if (!cache.releaseEvents) {
    const disconnected = () => { cache.backendConnected = false; notify(cache); };
    // HA resubscribes existing observers itself; failed setup retries on ready only.
    const ready = () => { cache.capability = undefined; startFeed(cache, hass); };
    hass.connection?.addEventListener?.('disconnected', disconnected);
    hass.connection?.addEventListener?.('ready', ready);
    cache.releaseEvents = () => {
      hass.connection?.removeEventListener?.('disconnected', disconnected);
      hass.connection?.removeEventListener?.('ready', ready);
    };
  }
  startFeed(cache, hass);
  let released = false;
  return () => {
    if (released) return; released = true;
    cache.listeners.delete(listener);
    if (cache.listeners.size) return;
    cache.generation++; cleanup(cache.unsubscribe); cleanup(cache.releaseEvents);
    cache.unsubscribe = cache.releaseEvents = undefined; cache.feedPending = cache.capability = undefined;
    cache.backendConnected = false;
  };
}
/** ZHA remains an explicit cached read, never zha/topology/update. */
export function readZhaTopology(hass: ZigbeeTopologyHass): Promise<void> {
  const cache = cacheOf(hass);
  if (!cache) return Promise.resolve();
  const pending = cache.inflight.get('zha'); if (pending) return pending;
  const previous = cache.states.zha;
  state(cache, 'zha', { ...previous, phase: 'loading', error: undefined });
  const promise = (async () => {
    requireAdmin(hass); if (!hass.callWS) throw fail('unsupported');
    const topology = normalizeZhaTopology(await hass.callWS({ type: 'zha/devices' }));
    if (!topology.nodes.length && topology.warnings.some(w => w.code === 'invalid_payload')) throw fail('invalid_payload');
    cache.topologies = [...cache.topologies.filter(t => t.provider !== 'zha'), topology];
    state(cache, 'zha', { phase: 'ready', obtainedAt: topology.obtainedAt, partial: topology.warnings.length > 0 });
  })().catch(error => state(cache, 'zha', { ...previous, phase: 'error', error: errorCode(error),
    stale: previous?.obtainedAt !== undefined })).finally(() => cache.inflight.delete('zha'));
  cache.inflight.set('zha', promise); return promise;
}
function command(hass: ZigbeeTopologyHass, baseTopic: string, jobId?: string): Promise<void> {
  const cache = cacheOf(hass); if (!cache) return Promise.resolve();
  const topic = normalizeZ2mBaseTopic(baseTopic), key = `z2m:${topic || baseTopic}`;
  const actionKey = `${key}:${jobId === undefined ? 'start' : `cancel:${jobId}`}`;
  const pending = cache.inflight.get(actionKey); if (pending) return pending;
  const generation = cache.generation;
  const active = () => generation === cache.generation && hass.user?.is_admin === true
    && cache.identity === zigbeeTopologyUserIdentity(hass);
  const promise = (async () => {
    requireAdmin(hass); if (!topic) throw fail('invalid_topic');
    await capability(cache, hass); if (!active()) return;
    const result = await hass.callWS!({ type: `houseplan/zigbee/${jobId === undefined ? 'start' : 'cancel'}`,
      base_topic: topic, ...(jobId === undefined ? {} : { job_id: jobId }) });
    if (active()) accept(cache, result, false);
  })().catch(error => {
    if (generation !== cache.generation) return;
    // Rejected stale/early cancellation must not turn the live job into an error.
    if (jobId !== undefined && recordOf(error)?.code === 'conflict') return;
    const code = errorCode(error);
    if (code === 'backend_required') cache.backendError = code;
    if (jobId === undefined && cache.states[key]?.phase !== 'loading') {
      state(cache, key, { ...cache.states[key], phase: 'error', error: code, stale: cache.states[key]?.obtainedAt !== undefined });
    } else { cache.backendError = code; notify(cache); }
  }).finally(() => cache.inflight.delete(actionKey));
  cache.inflight.set(actionKey, promise); return promise;
}
/** Quick server-owned job start: no browser MQTT, scan timer, or fallback. */
export function refreshZ2mTopology(hass: ZigbeeTopologyHass, baseTopic: string): Promise<void> { return command(hass, baseTopic); }
export function cancelZ2mTopology(hass: ZigbeeTopologyHass, baseTopic: string, jobId: string): Promise<void> { return command(hass, baseTopic, jobId); }
