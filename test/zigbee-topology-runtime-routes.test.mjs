import test from 'node:test';
import assert from 'node:assert/strict';
import { readZhaTopology, refreshZ2mTopology, cancelZ2mTopology, subscribeZigbeeTopology,
  zigbeeTopologyRuntimeSnapshot, zigbeeScanElapsedMs, zigbeeScanCanCancel, formatZigbeeScanElapsed,
} from '../test-build/zigbee-topology-runtime.js';
const TOPIC = 'zigbee2mqtt', KEY = 'z2m:' + TOPIC;
const COORDINATOR = '00124b0000000001', DEVICE = '00124b0000000002';
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const map = { status: 'ok', data: { value: {
  nodes: [{ ieeeAddr: COORDINATOR, type: 'Coordinator', networkAddress: 0 },
    { ieeeAddr: DEVICE, type: 'EndDevice', networkAddress: 1 }],
  links: [{ sourceIeeeAddr: DEVICE, targetIeeeAddr: COORDINATOR, relationship: 1, lqi: 0 }],
} } };
function backend() {
  const b = { session: 'server1', revision: 0, jobs: new Map(), callbacks: [], live: new Set(),
    events: new Map(), calls: [], cleanups: 0, publications: 0, capability: 1 };
  b.envelope = provider => ({ kind: 'state', session_id: b.session, revision: b.revision, provider: { ...provider } });
  b.emit = message => { for (const callback of b.live) callback(message); };
  b.reset = () => {
    b.emit({ kind: 'reset', session_id: b.session, revision: b.revision, topics: [...b.jobs.keys()] });
    for (const job of b.jobs.values()) b.emit(b.envelope(job));
  };
  b.update = (topic, patch) => {
    const job = { ...b.jobs.get(topic), ...patch }; b.jobs.set(topic, job); b.revision++; b.emit(b.envelope(job)); return job;
  };
  b.hass = { user: { id: 'admin1', is_admin: true }, connection: {
    addEventListener(event, cb) { b.events.set(event, cb); },
    removeEventListener(event, cb) { if (b.events.get(event) === cb) b.events.delete(event); },
    async subscribeMessage(callback, message) {
      assert.deepEqual(message, { type: 'houseplan/zigbee/subscribe' });
      b.callbacks.push(callback); b.live.add(callback); b.reset();
      const unsubscribe = () => { b.cleanups++; b.live.delete(callback); };
      return b.subscribeGate ? b.subscribeGate.promise.then(() => unsubscribe) : unsubscribe;
    },
  }, async callWS(message) {
    b.calls.push(message);
    if (message.type === 'houseplan/config/get') return b.capabilityGate?.promise ?? { zigbee_scan_api: b.capability };
    if (b.commandGate) return b.commandGate.promise;
    const topic = message.base_topic, prior = b.jobs.get(topic);
    if (message.type === 'houseplan/zigbee/start') {
      if (prior?.phase === 'loading') return b.envelope(prior);
      b.publications++;
      const next = b.update(topic, { topic, job_id: 'job' + b.publications, phase: 'loading', stage: 'connecting',
        started_at: 10, elapsed_ms: 0, cancel_after_ms: 600000 });
      return b.envelope(next);
    }
    assert.equal(message.type, 'houseplan/zigbee/cancel');
    if (!prior || prior.job_id !== message.job_id || prior.phase === 'loading' && prior.elapsed_ms < 600000) {
      throw { code: 'conflict' };
    }
    return b.envelope(prior.phase === 'loading' ? b.update(topic, { phase: 'cancelled', stale: !!prior.result }) : prior);
  }, callService() { assert.fail('No browser MQTT fallback'); } };
  b.snapshot = () => zigbeeTopologyRuntimeSnapshot(b.hass);
  b.observe = () => subscribeZigbeeTopology(b.hass, () => {});
  return b;
}

test('#798 ZHA retains the last successful cache timestamp and partial status through refresh and failure', async () => {
  let result = Promise.resolve([
    { ieee: COORDINATOR, device_type: 'Coordinator', neighbors: [] },
    { ieee: 'invalid-ieee' },
  ]);
  let calls = 0;
  const hass = { user: { is_admin: true }, connection: {}, callWS(message) {
    calls++;
    assert.deepEqual(message, { type: 'zha/devices' });
    return result;
  } };
  await readZhaTopology(hass);
  const successful = zigbeeTopologyRuntimeSnapshot(hass);
  assert.equal(successful.states.zha.partial, true);
  const pending = deferred();
  result = pending.promise;
  const refresh = readZhaTopology(hass);
  assert.equal(readZhaTopology(hass), refresh, 'concurrent readers share the same pending request');
  const loading = zigbeeTopologyRuntimeSnapshot(hass);
  assert.equal(loading.topologies[0], successful.topologies[0]);
  assert.equal(loading.states.zha.phase, 'loading');
  assert.equal(loading.states.zha.obtainedAt, successful.states.zha.obtainedAt);
  assert.equal(loading.states.zha.partial, true);
  pending.reject(new Error('provider unavailable'));
  await refresh;
  const failed = zigbeeTopologyRuntimeSnapshot(hass);
  assert.equal(failed.topologies[0], successful.topologies[0]);
  assert.equal(failed.states.zha.phase, 'error');
  assert.equal(failed.states.zha.obtainedAt, successful.states.zha.obtainedAt);
  assert.equal(failed.states.zha.partial, true);
  assert.equal(failed.states.zha.stale, true);
  result = Promise.resolve([{ ieee: COORDINATOR, device_type: 'Coordinator', neighbors: [] }]);
  await readZhaTopology(hass);
  const recovered = zigbeeTopologyRuntimeSnapshot(hass);
  assert.equal(recovered.states.zha.phase, 'ready');
  assert.notEqual(recovered.states.zha.stale, true);
  assert.equal(recovered.states.zha.error, undefined);
  assert.equal(recovered.states.zha.partial, false);
  assert.equal(calls, 3);
});

test('#800 one shared feed across hass ticks/consumers, idempotent detach never cancels job', async () => {
  const b = backend(), off1 = b.observe();
  const off2 = subscribeZigbeeTopology({ ...b.hass }, () => {});
  await turn();
  assert.equal(b.callbacks.length, 1); assert.equal(b.calls.length, 1);
  const first = refreshZ2mTopology(b.hass, '/zigbee2mqtt/');
  assert.equal(first, refreshZ2mTopology({ ...b.hass }, TOPIC));
  await first;
  assert.equal(b.publications, 1); assert.equal(b.snapshot().states[KEY].phase, 'loading');
  off1(); off1(); assert.equal(b.cleanups, 0);
  off2(); assert.equal(b.cleanups, 1); assert.equal(b.events.size, 0);
  assert.equal(b.jobs.get(TOPIC).phase, 'loading');
  assert.equal(b.calls.filter(c => c.type.endsWith('/cancel')).length, 0);
});

test('#800 late 15m result while no UI restores after remount and on a fresh connection without start', async () => {
  const b = backend(); const off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  const jobId = b.snapshot().states[KEY].jobId; off();
  b.update(TOPIC, { phase: 'ready', elapsed_ms: 900000, obtained_at: 12345, result: map });
  const off2 = b.observe(); await turn();
  assert.equal(b.snapshot().states[KEY].jobId, jobId); assert.equal(b.snapshot().states[KEY].obtainedAt, 12345);
  assert.equal(b.snapshot().topologies[0].obtainedAt, 12345); assert.equal(b.snapshot().topologies[0].nodes.length, 2);
  off2();
  b.hass = { ...b.hass, connection: { ...b.hass.connection } };
  const off3 = b.observe(); await turn();
  assert.equal(b.snapshot().states[KEY].jobId, jobId); assert.equal(b.publications, 1); off3();
});

test('#800 clock uses server elapsed plus local monotonic delta; 599/600 and hours exact', () => {
  const current = { phase: 'loading', jobId: 'j', startedAt: -9e12, elapsedMs: 599000, elapsedObservedAt: 40, cancelAfterMs: 600000 };
  assert.equal(zigbeeScanElapsedMs(current, 40), 599000);
  assert.equal(zigbeeScanCanCancel(current, 1039), false);
  assert.equal(zigbeeScanCanCancel(current, 1040), true);
  assert.equal(zigbeeScanElapsedMs({ ...current, phase: 'cancelled' }, 9e12), 599000);
  assert.equal(formatZigbeeScanElapsed(599999), '9:59');
  assert.equal(formatZigbeeScanElapsed(600000), '10:00');
  assert.equal(formatZigbeeScanElapsed(3661000), '1:01:01');
});

test('#800 exact job cancellation preserves last-good and stale rejection cannot cancel next job', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 333 });
  await refreshZ2mTopology(b.hass, TOPIC);
  const next = b.snapshot().states[KEY].jobId;
  b.update(TOPIC, { elapsed_ms: 599000 });
  await cancelZ2mTopology(b.hass, TOPIC, next);
  assert.equal(b.snapshot().states[KEY].phase, 'loading');
  b.update(TOPIC, { elapsed_ms: 600000 });
  await cancelZ2mTopology(b.hass, TOPIC, next);
  assert.equal(b.snapshot().states[KEY].phase, 'cancelled');
  assert.equal(b.snapshot().states[KEY].stale, true);
  assert.equal(b.snapshot().topologies[0].obtainedAt, 333);
  await refreshZ2mTopology(b.hass, TOPIC);
  await cancelZ2mTopology(b.hass, TOPIC, next);
  assert.equal(b.snapshot().states[KEY].phase, 'loading');
  assert.notEqual(b.snapshot().states[KEY].jobId, next); off();
});

test('#800 terminal MQTT error keeps last good stale; success/cancel race cannot undo ready', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 44 });
  await cancelZ2mTopology(b.hass, TOPIC, b.snapshot().states[KEY].jobId);
  assert.equal(b.snapshot().states[KEY].phase, 'ready');
  await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'error', error: 'connection', stale: true });
  assert.equal(b.snapshot().states[KEY].error, 'connection');
  assert.equal(b.snapshot().topologies[0].obtainedAt, 44);
  const starts = b.publications; b.events.get('ready')(); await turn(); assert.equal(b.publications, starts); off();
});

test('#800 reconnect reads reset and same revision slots without extra subscriptions or timer restart', async () => {
  const b = backend(), off = b.observe();
  await refreshZ2mTopology(b.hass, TOPIC); await refreshZ2mTopology(b.hass, 'other');
  b.events.get('disconnected')(); assert.equal(b.snapshot().backendConnected, false);
  b.jobs.get(TOPIC).elapsed_ms = 900000; b.jobs.get('other').elapsed_ms = 700000;
  b.events.get('ready')(); b.reset();
  assert.equal(b.callbacks.length, 1); assert.equal(b.snapshot().backendConnected, true);
  assert.equal(b.snapshot().states[KEY].elapsedMs, 900000);
  assert.equal(b.snapshot().states['z2m:other'].elapsedMs, 700000);
  assert.equal(b.publications, 2); off();
});

test('#800 previous-owner callback and delayed subscribe acknowledgement are inert and cleaned once', async () => {
  const b = backend(); b.subscribeGate = deferred();
  const off = b.observe(); await turn(); const old = b.callbacks[0]; off();
  b.subscribeGate.resolve(); await turn(); assert.equal(b.cleanups, 1);
  old({ kind: 'reset', session_id: 'obsolete', revision: 999, topics: [] });
  assert.equal(b.snapshot().backendConnected, false);
  b.subscribeGate = null; const off2 = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  const revision = b.snapshot().revision;
  old({ kind: 'removed', session_id: b.session, revision: 999, topic: TOPIC });
  assert.equal(b.snapshot().revision, revision); assert.equal(b.snapshot().states[KEY].phase, 'loading'); off2();
});

test('#800 detach during capability prevents late subscribe/start; identity changes invalidate pending results', async () => {
  const b = backend(); b.capabilityGate = deferred();
  const off = b.observe(), started = refreshZ2mTopology(b.hass, TOPIC); off();
  b.capabilityGate.resolve({ zigbee_scan_api: 1 }); await started; await turn();
  assert.equal(b.callbacks.length, 0); assert.equal(b.publications, 0);
  b.capabilityGate = null; const off2 = b.observe(); await turn();
  b.commandGate = deferred(); const pending = refreshZ2mTopology(b.hass, TOPIC);
  await turn(); const other = { ...b.hass, user: { id: 'admin2', is_admin: true } };
  assert.deepEqual(zigbeeTopologyRuntimeSnapshot(other).states, {});
  b.commandGate.resolve({ kind: 'state', session_id: b.session, revision: 20, provider: {
    topic: TOPIC, job_id: 'old-user-job', phase: 'ready', elapsed_ms: 2, result: map, obtained_at: 8 } });
  await pending; assert.deepEqual(zigbeeTopologyRuntimeSnapshot(other).states, {}); off2();
});

test('#800 non-admin and old backend fail closed without subscribing, starting, cancelling or MQTT', async () => {
  const b = backend(); b.hass.user.is_admin = false;
  const off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC); await cancelZ2mTopology(b.hass, TOPIC, 'job');
  assert.equal(b.calls.length, 0); assert.equal(b.callbacks.length, 0);
  assert.deepEqual(b.snapshot().topologies, []); off();
  const old = backend(); old.capability = undefined; const release = old.observe();
  await refreshZ2mTopology(old.hass, TOPIC); await turn();
  assert.equal(old.snapshot().backendError, 'backend_required'); assert.equal(old.callbacks.length, 0);
  assert.equal(old.calls.length, 1); assert.equal(old.publications, 0); release();
});

test('#800 new server reset removes only Z2M cache; foreign/older/duplicate messages cannot roll back', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 25 });
  const good = b.snapshot(), event = b.envelope(b.jobs.get(TOPIC));
  b.emit({ ...event, revision: event.revision - 1, provider: { ...event.provider, phase: 'loading' } });
  b.emit({ ...event, session_id: 'foreign', revision: 999 });
  b.emit({ ...event, provider: { ...event.provider, elapsed_ms: 900000 } });
  assert.equal(b.snapshot().revision, good.revision);
  b.session = 'new-server'; b.revision = 0; b.jobs.clear(); b.reset();
  assert.equal(b.snapshot().topologies.length, 0); assert.deepEqual(b.snapshot().states, {});
  b.emit(event); assert.deepEqual(b.snapshot().states, {}); off();
});

test('#800 evicted topic removed from states/maps; malformed backend map cannot replace last-good', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 27 });
  b.update(TOPIC, { result: { garbage: true }, obtained_at: 28 });
  assert.equal(b.snapshot().topologies[0].obtainedAt, 27);
  b.emit({ kind: 'removed', session_id: b.session, revision: ++b.revision, topic: TOPIC });
  assert.equal(b.snapshot().topologies.length, 0); assert.equal(b.snapshot().states[KEY], undefined); off();
});

test('#800 admin identity replacement on one connection clears maps and old callbacks, not server jobs', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 27 });
  const old = b.callbacks[0];
  const other = { ...b.hass, user: { id: 'admin2', is_admin: true } };
  assert.deepEqual(zigbeeTopologyRuntimeSnapshot(other).topologies, []);
  assert.equal(b.cleanups, 1);
  const release = subscribeZigbeeTopology(other, () => {}); await turn();
  const fresh = zigbeeTopologyRuntimeSnapshot(other);
  assert.equal(fresh.topologies[0].obtainedAt, 27, 'new identity explicitly reads shared server last-good');
  old({ kind: 'reset', session_id: 'old-owner', revision: 500, topics: [] });
  assert.equal(zigbeeTopologyRuntimeSnapshot(other).revision, fresh.revision);
  assert.equal(b.publications, 1); off(); release();
});

test('#800 mutable admin revocation during lazy capability prevents any late read/start', async () => {
  const b = backend(); b.capabilityGate = deferred();
  const off = b.observe(), started = refreshZ2mTopology(b.hass, TOPIC);
  b.hass.user.is_admin = false;
  b.capabilityGate.resolve({ zigbee_scan_api: 1 }); await started; await turn();
  assert.equal(b.callbacks.length, 0); assert.equal(b.publications, 0);
  assert.deepEqual(b.snapshot().states, {}); off();
});

test('#800 missing API subscription is localized and ready retries observation without starting scan', async () => {
  const b = backend(); const original = b.hass.connection.subscribeMessage;
  b.hass.connection.subscribeMessage = async () => { throw { code: 'unknown_command' }; };
  const off = b.observe(); await turn();
  assert.equal(b.snapshot().backendError, 'backend_required');
  b.hass.connection.subscribeMessage = original; b.events.get('ready')(); await turn();
  assert.equal(b.snapshot().backendError, undefined); assert.equal(b.snapshot().backendConnected, true);
  assert.equal(b.publications, 0); off();
});

test('#800 stale action response cannot roll back later streamed terminal state', async () => {
  const b = backend(), off = b.observe(); await turn();
  b.commandGate = deferred(); const pending = refreshZ2mTopology(b.hass, TOPIC); await turn();
  const provider = { topic: TOPIC, job_id: 'accepted', phase: 'ready', elapsed_ms: 900000, result: map, obtained_at: 56 };
  b.revision = 10; b.emit(b.envelope(provider));
  b.commandGate.resolve({ kind: 'state', session_id: b.session, revision: 9,
    provider: { ...provider, phase: 'loading', elapsed_ms: 0 } });
  await pending; assert.equal(b.snapshot().states[KEY].phase, 'ready'); assert.equal(b.snapshot().states[KEY].elapsedMs, 900000); off();
});

test('#800 integration closed invalidates mounted jobs; explicit same-WS start reattaches without duplicate scan', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 80 });
  await refreshZ2mTopology(b.hass, TOPIC);
  const oldCallback = b.callbacks[0], oldState = b.envelope(b.jobs.get(TOPIC));
  const oldPublications = b.publications;
  b.emit({ kind: 'closed', session_id: b.session, revision: ++b.revision });
  assert.deepEqual(b.snapshot().states, {}, 'unloaded coordinator cannot leave disabled Update map/loading UI');
  assert.deepEqual(b.snapshot().topologies, [], 'unloaded coordinator last-good cache is gone');
  assert.equal(b.snapshot().backendConnected, false);
  assert.equal(b.cleanups, 1); assert.equal(b.live.size, 0);
  await turn(); assert.equal(b.publications, oldPublications, 'close never scans or automatically retries');
  const closedRevision = b.snapshot().revision;
  oldCallback({ ...oldState, revision: 999 });
  oldCallback({ kind: 'reset', session_id: 'obsolete', revision: 1000, topics: [TOPIC] });
  assert.equal(b.snapshot().revision, closedRevision, 'late old feed cannot revive its session');
  b.session = 'reloaded'; b.revision = 0; b.jobs.clear();
  const start = refreshZ2mTopology(b.hass, TOPIC);
  assert.equal(refreshZ2mTopology({ ...b.hass }, TOPIC), start);
  await start;
  assert.equal(b.callbacks.length, 2); assert.equal(b.live.size, 1);
  assert.equal(b.publications, oldPublications + 1);
  assert.equal(b.snapshot().states[KEY].phase, 'loading');
  assert.equal(b.snapshot().backendConnected, true);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 90 });
  assert.equal(b.snapshot().states[KEY].obtainedAt, 90, 'new session streams without remount');
  off(); assert.equal(b.cleanups, 2);
});

test('#800 closed while subscribe ACK is pending cleans late ACK without releasing new feed', async () => {
  const b = backend(); b.subscribeGate = deferred();
  const oldAck = b.subscribeGate, off = b.observe(); await turn();
  b.emit({ kind: 'closed', session_id: b.session, revision: ++b.revision });
  b.session = 'reloaded'; b.revision = 0; b.jobs.clear(); b.subscribeGate = null;
  await refreshZ2mTopology(b.hass, TOPIC);
  assert.equal(b.callbacks.length, 2);
  oldAck.resolve(); await turn();
  assert.equal(b.live.size, 1); assert.equal(b.cleanups, 1);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 99 });
  assert.equal(b.snapshot().states[KEY].obtainedAt, 99);
  off(); assert.equal(b.cleanups, 2);
});

test('#800 only current-session non-stale closed event can invalidate runtime', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  const before = b.snapshot();
  b.emit({ kind: 'closed', session_id: 'foreign', revision: 999 });
  b.emit({ kind: 'closed', session_id: b.session, revision: b.revision - 1 });
  assert.equal(b.snapshot().revision, before.revision); assert.equal(b.live.size, 1); off();
});

test('#800 late command completion from closed session cannot erase new command deduplication', async () => {
  const b = backend(), off = b.observe(); await turn();
  const oldReply = deferred(); b.commandGate = oldReply;
  const oldStart = refreshZ2mTopology(b.hass, TOPIC); await turn();
  const oldEvent = { kind: 'state', session_id: b.session, revision: 10, provider: {
    topic: TOPIC, job_id: 'old', phase: 'loading', elapsed_ms: 100,
  } };
  b.emit({ kind: 'closed', session_id: b.session, revision: ++b.revision });
  b.session = 'reloaded'; b.revision = 0;
  const newReply = deferred(); b.commandGate = newReply;
  const newStart = refreshZ2mTopology(b.hass, TOPIC); await turn();
  oldReply.resolve(oldEvent); await oldStart;
  assert.deepEqual(b.snapshot().states, {}, 'late action result from unloaded session stays rejected');
  assert.equal(refreshZ2mTopology(b.hass, TOPIC), newStart, 'old finally must not delete new in-flight action');
  newReply.resolve({ ...oldEvent, session_id: b.session, revision: 1,
    provider: { ...oldEvent.provider, job_id: 'fresh', elapsed_ms: 0 } });
  await newStart;
  assert.equal(b.snapshot().states[KEY].jobId, 'fresh');
  assert.equal(b.calls.filter(c => c.type.endsWith('/start')).length, 2);
  assert.equal(b.callbacks.length, 2); off();
});

test('#800 explicit retry recovers after config not_ready during same-WS integration reload', async () => {
  const b = backend(), off = b.observe(); await refreshZ2mTopology(b.hass, TOPIC);
  const oldJob = b.snapshot().states[KEY].jobId;
  b.emit({ kind: 'closed', session_id: b.session, revision: ++b.revision });
  b.capabilityGate = deferred();
  const duringUnload = refreshZ2mTopology(b.hass, TOPIC);
  await turn(); b.capabilityGate.reject({ code: 'not_ready' }); await duringUnload;
  assert.equal(b.snapshot().states[KEY].phase, 'error');
  assert.equal(b.snapshot().backendError, 'backend_required');
  assert.equal(b.publications, 1, 'failed capability must never publish');
  const reads = b.calls.filter(c => c.type === 'houseplan/config/get').length;
  assert.equal(reads, 2);
  b.session = 'replacement'; b.revision = 0; b.jobs.clear(); b.capabilityGate = null;
  await turn();
  assert.equal(b.calls.filter(c => c.type === 'houseplan/config/get').length, reads, 'setup alone does not auto-retry');
  assert.equal(b.publications, 1);
  const retry = refreshZ2mTopology(b.hass, TOPIC);
  assert.equal(refreshZ2mTopology({ ...b.hass }, TOPIC), retry, 'simultaneous explicit retry remains deduplicated');
  await retry;
  assert.equal(b.calls.filter(c => c.type === 'houseplan/config/get').length, 3, 'new explicit action must retry failed capability');
  assert.equal(b.publications, 2);
  assert.equal(b.callbacks.length, 2); assert.equal(b.live.size, 1);
  assert.equal(b.snapshot().states[KEY].phase, 'loading');
  assert.notEqual(b.snapshot().states[KEY].jobId, oldJob);
  assert.equal(b.snapshot().backendError, undefined);
  b.update(TOPIC, { phase: 'ready', result: map, obtained_at: 101 });
  assert.equal(b.snapshot().states[KEY].obtainedAt, 101); off();
});
