import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readZhaTopology, refreshZ2mTopology, zigbeeTopologyRuntimeSnapshot,
} from '../test-build/zigbee-topology-runtime.js';
import { TOPOLOGY_MAX_PAYLOAD_BYTES } from '../test-build/zigbee-topology.js';

const TOPIC = 'zigbee2mqtt';
const KEY = `z2m:${TOPIC}`;
const INFO = `${TOPIC}/bridge/info`;
const RESPONSE = `${TOPIC}/bridge/response/networkmap`;
const COORDINATOR = '00124b0000000001';
const DEVICE = '00124b0000000002';
const OTHER = '00124b0000000003';
const turn = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function networkmap(transaction, ieee = DEVICE) {
  return {
    status: 'ok', transaction, data: { value: {
      nodes: [
        { ieeeAddr: COORDINATOR, type: 'Coordinator', networkAddress: 0 },
        { ieeeAddr: ieee, type: 'EndDevice', networkAddress: 1 },
      ],
      links: [{ sourceIeeeAddr: ieee, targetIeeeAddr: COORDINATOR, relationship: 1, lqi: 0 }],
    } },
  };
}

function bridge(options = {}) {
  const control = {
    listeners: new Map(), subscriptions: [], cleanups: [], publishes: [],
    emit(value, retain = false) {
      this.listeners.get(RESPONSE)?.({ retain, payload: JSON.stringify(value) });
    },
  };
  control.hass = {
    user: { is_admin: true },
    connection: {
      async subscribeMessage(callback, message) {
        const { topic } = message;
        control.listeners.set(topic, callback);
        control.subscriptions.push({ topic, callback });
        const unsubscribe = () => {
          control.cleanups.push(topic);
          if (control.listeners.get(topic) === callback) control.listeners.delete(topic);
        };
        if (topic === INFO && options.confirm !== false) {
          queueMicrotask(() => callback({ retain: true, payload: '{}' }));
        }
        return options.subscribe?.({ control, topic, callback, unsubscribe }) ?? unsubscribe;
      },
    },
    async callService(domain, service, data) {
      assert.equal(`${domain}.${service}`, 'mqtt.publish');
      assert.equal(data.topic, `${TOPIC}/bridge/request/networkmap`);
      assert.equal(data.retain, false);
      const request = JSON.parse(data.payload);
      control.publishes.push(request);
      if (options.publish) return options.publish({ control, request });
      control.emit(networkmap(request.transaction));
    },
  };
  return control;
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

test('#798 Z2M requests routes and ignores matching premature, retained, and foreign responses', async (t) => {
  t.mock.method(globalThis.crypto, 'randomUUID', () => 'premature');
  const control = bridge({
    subscribe({ topic, callback }) {
      if (topic === RESPONSE) callback({ retain: false,
        payload: JSON.stringify(networkmap('houseplan-premature', OTHER)) });
    },
    publish({ control: current, request }) {
      assert.equal(request.type, 'raw');
      assert.equal(request.routes, true);
      current.emit(networkmap(request.transaction, OTHER), true);
      current.emit(networkmap('foreign', OTHER));
      current.emit(networkmap(request.transaction));
    },
  });
  await refreshZ2mTopology(control.hass, TOPIC, 100);
  const snapshot = zigbeeTopologyRuntimeSnapshot(control.hass);
  assert.equal(snapshot.states[KEY].phase, 'ready');
  assert.deepEqual(snapshot.topologies[0].nodes.map((node) => node.ieee), [COORDINATOR, DEVICE]);
  assert.equal(control.publishes.length, 1);
  assert.deepEqual(control.cleanups, [INFO, RESPONSE]);
  assert.equal(control.listeners.size, 0);
});

for (const error of ['provider', 'invalid_payload', 'timeout']) {
  test(`#798 Z2M ${error} retains the good snapshot, marks it stale, and a retry recovers`, async () => {
    let failing = false;
    const control = bridge({ publish({ control: current, request }) {
      if (!failing) return current.emit(networkmap(request.transaction));
      if (error === 'provider') return current.emit({ status: 'error', transaction: request.transaction });
      if (error === 'invalid_payload') {
        current.listeners.get(RESPONSE)?.({ retain: false, payload: 'not-json' });
      }
    } });
    await refreshZ2mTopology(control.hass, TOPIC, 100);
    const successful = zigbeeTopologyRuntimeSnapshot(control.hass);
    failing = true;
    const refresh = refreshZ2mTopology(control.hass, TOPIC, 20);
    assert.equal(refreshZ2mTopology(control.hass, TOPIC, 20), refresh);
    const loading = zigbeeTopologyRuntimeSnapshot(control.hass);
    assert.equal(loading.states[KEY].phase, 'loading');
    assert.equal(loading.states[KEY].obtainedAt, successful.states[KEY].obtainedAt);
    await refresh;
    const failed = zigbeeTopologyRuntimeSnapshot(control.hass);
    assert.equal(failed.topologies[0], successful.topologies[0]);
    assert.equal(failed.states[KEY].error, error);
    assert.equal(failed.states[KEY].stale, true);
    assert.equal(failed.states[KEY].obtainedAt, successful.states[KEY].obtainedAt);
    assert.equal(control.publishes.length, 2);
    assert.equal(control.cleanups.length, 4);
    failing = false;
    const retry = refreshZ2mTopology(control.hass, TOPIC, 100);
    assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).states[KEY].stale, true);
    await retry;
    const recovered = zigbeeTopologyRuntimeSnapshot(control.hass);
    assert.equal(recovered.states[KEY].phase, 'ready');
    assert.notEqual(recovered.states[KEY].stale, true);
    assert.equal(recovered.states[KEY].error, undefined);
    assert.equal(control.cleanups.length, 6);
  });
}

for (const blockedTopic of [INFO, RESPONSE]) {
  test(`#798 late ${blockedTopic} subscription is cleaned after the shared deadline`, async () => {
    const pending = deferred();
    let lateUnsubscribe;
    const control = bridge({ subscribe({ topic, unsubscribe }) {
      if (topic !== blockedTopic) return;
      lateUnsubscribe = unsubscribe;
      return pending.promise;
    } });
    await refreshZ2mTopology(control.hass, TOPIC, 20);
    const timedOut = zigbeeTopologyRuntimeSnapshot(control.hass);
    assert.equal(timedOut.states[KEY].error, 'timeout');
    assert.equal(timedOut.states[KEY].obtainedAt, undefined);
    assert.notEqual(timedOut.states[KEY].stale, true, 'first failure does not invent a stale snapshot');
    assert.equal(control.publishes.length, 0);
    pending.resolve(lateUnsubscribe);
    await turn();
    assert.equal(control.listeners.size, 0);
    assert.equal(control.cleanups.length, blockedTopic === INFO ? 1 : 2);
    assert.equal(new Set(control.cleanups).size, control.cleanups.length, 'unsubscribe exactly once');
    assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).revision, timedOut.revision);
  });
}

test('#798 publish timeout is bounded and late publish/response cannot install data', async () => {
  const published = deferred();
  let responseCallback;
  const control = bridge({ publish({ control: current, request }) {
    responseCallback = current.listeners.get(RESPONSE);
    current.emit(networkmap(request.transaction));
    return published.promise;
  } });
  await refreshZ2mTopology(control.hass, TOPIC, 20);
  const timedOut = zigbeeTopologyRuntimeSnapshot(control.hass);
  assert.equal(timedOut.states[KEY].error, 'timeout');
  assert.equal(timedOut.topologies.length, 0, 'response alone cannot finish a hanging publish');
  assert.deepEqual(control.cleanups, [INFO, RESPONSE]);
  published.resolve();
  responseCallback({ retain: false, payload: JSON.stringify(networkmap(control.publishes[0].transaction)) });
  await turn();
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).revision, timedOut.revision);
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).topologies.length, 0);
});

test('#798 subscription setup consumes the same deadline and cannot grant publish a fresh timeout', async (t) => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const control = bridge({ subscribe() { now += 60; } });
  await refreshZ2mTopology(control.hass, TOPIC, 100);
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).states[KEY].error, 'timeout');
  assert.equal(control.publishes.length, 0);
  assert.deepEqual(control.cleanups, [INFO, RESPONSE]);
});

test('#798 a malformed response rejects even while publish is pending and late rejection is handled', async () => {
  const published = deferred();
  const control = bridge({ publish({ control: current }) {
    current.listeners.get(RESPONSE)?.({ retain: false, payload: '{invalid' });
    return published.promise;
  } });
  await refreshZ2mTopology(control.hass, TOPIC, 100);
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).states[KEY].error, 'invalid_payload');
  assert.deepEqual(control.cleanups, [INFO, RESPONSE]);
  published.reject(new Error('late publish failure'));
  await turn();
});

test('#798 oversized MQTT data is rejected and one throwing unsubscribe does not leak the other', async () => {
  const control = bridge({
    subscribe({ topic, unsubscribe }) {
      return () => {
        unsubscribe();
        if (topic === INFO) throw new Error('connection already closed');
      };
    },
    publish({ control: current, request }) {
      const value = networkmap(request.transaction);
      value.padding = ' '.repeat(TOPOLOGY_MAX_PAYLOAD_BYTES);
      current.emit(value);
    },
  });
  await refreshZ2mTopology(control.hass, TOPIC, 100);
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).states[KEY].error, 'invalid_payload');
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).topologies.length, 0);
  assert.deepEqual(control.cleanups, [INFO, RESPONSE]);
  assert.equal(control.listeners.size, 0);
});

test('#798 an expired request cannot overwrite a later refresh through an old or new callback', async () => {
  const started = deferred();
  const control = bridge({ publish({ control: current }) {
    if (current.publishes.length === 2) started.resolve();
  } });
  await refreshZ2mTopology(control.hass, TOPIC, 20);
  const oldCallback = control.subscriptions.find((item) => item.topic === RESPONSE).callback;
  const oldTransaction = control.publishes[0].transaction;
  const refresh = refreshZ2mTopology(control.hass, TOPIC, 100);
  await started.promise;
  oldCallback({ retain: false, payload: JSON.stringify(networkmap(oldTransaction, OTHER)) });
  control.emit(networkmap(oldTransaction, OTHER));
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).states[KEY].phase, 'loading');
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).topologies.length, 0);
  control.emit(networkmap(control.publishes[1].transaction));
  await refresh;
  const successful = zigbeeTopologyRuntimeSnapshot(control.hass);
  oldCallback({ retain: false, payload: JSON.stringify(networkmap(oldTransaction, OTHER)) });
  await turn();
  assert.deepEqual(successful.topologies[0].nodes.map((node) => node.ieee), [COORDINATOR, DEVICE]);
  assert.equal(zigbeeTopologyRuntimeSnapshot(control.hass).revision, successful.revision);
  assert.equal(control.cleanups.length, 4);
});

test('#798 only an admin can request a map, and retained bridge confirmation is required', async () => {
  const denied = bridge();
  denied.hass.user.is_admin = false;
  await refreshZ2mTopology(denied.hass, TOPIC, 100);
  assert.equal(zigbeeTopologyRuntimeSnapshot(denied.hass).states[KEY].error, 'permission');
  assert.equal(denied.subscriptions.length, 0);
  assert.equal(denied.publishes.length, 0);
  const unconfirmed = bridge({ confirm: false, subscribe({ topic, callback }) {
    if (topic === INFO) callback({ retain: false, payload: '{}' });
  } });
  await refreshZ2mTopology(unconfirmed.hass, TOPIC, 20);
  assert.equal(zigbeeTopologyRuntimeSnapshot(unconfirmed.hass).states[KEY].error, 'timeout');
  assert.equal(unconfirmed.publishes.length, 0);
  assert.deepEqual(unconfirmed.cleanups, [INFO, RESPONSE]);
});
