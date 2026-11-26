import test from 'node:test';
import assert from 'node:assert/strict';
import { ExternalAlertsRuntime } from '../test-build/external-alerts-runtime.js';
import { externalSignal } from '../demo/helpers/external-alert-fixture.mjs';

test('a restored subscription replaces the snapshot, and old readers cannot repaint it', async () => {
  const listeners = new Map();
  const subscriptions = [];
  let released = 0, changes = 0;
  const connection = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    async subscribeMessage(receive, command, options) {
      assert.equal(command.type, 'houseplan/external_alerts/subscribe');
      assert.equal(options.resubscribe, false);
      subscriptions.push(receive);
      return () => { released++; return Promise.reject(Error('old socket closed')); };
    },
  };
  let hass = { connection, user: { id: 'reader' }, config: { time_zone: 'UTC' } };
  const runtime = new ExternalAlertsRuntime({ addController() {} }, () => hass, () => 'ru', () => changes++);
  const device = { id: 'one', bindingKind: 'device', bindingRef: 'one' };
  const frame = { signals: [externalSignal('one', 'alarm')] };
  runtime.hostConnected();
  await Promise.resolve();
  subscriptions[0](frame);
  assert.equal(runtime.issues(device)[0].severity, 'alarm');
  assert.deepEqual(runtime.issues({ ...device, virtual: true }), []);
  listeners.get('disconnected')();
  assert.deepEqual(runtime.issues(device), []);
  listeners.get('ready')();
  subscriptions[0](frame);
  assert.deepEqual(runtime.issues(device), [], 'retired generation cannot restore a stale frame');
  subscriptions[1](frame);
  assert.equal(runtime.issues(device)[0].name, 'Сигнал из Home Assistant');
  assert.deepEqual(runtime.issues({ ...device, bindingRef: 'rebound' }), []);
  hass = { ...hass, user: { id: 'new-user' } };
  runtime.hostUpdate();
  subscriptions[1](frame);
  assert.deepEqual(runtime.issues(device), [], 'previous user cannot leak its issue text');
  runtime.hostDisconnected();
  subscriptions[2](frame);
  assert.deepEqual(runtime.issues(device), []);
  await Promise.resolve();
  assert.equal(changes, 4);
  assert.equal(released, 3);
});

test('an already open kiosk retries both startup errors without a second ready event', async ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const listeners = new Map();
  let attempts = 0;
  let receive;
  const connection = {
    connected: false,
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    async subscribeMessage(callback) {
      const code = ['unknown_command', 'not_ready'][attempts++];
      if (code) throw { code };
      receive = callback;
      return () => {};
    },
  };
  const runtime = new ExternalAlertsRuntime({ addController() {} }, () => ({ connection }), () => 'en', () => {});
  const device = { id: 'one', bindingKind: 'device', bindingRef: 'one' };
  runtime.hostConnected();
  assert.equal(attempts, 0);
  connection.connected = true;
  listeners.get('ready')();
  await Promise.resolve();
  mock.timers.tick(1_000);
  await Promise.resolve();
  assert.equal(attempts, 2);
  mock.timers.tick(1_999);
  assert.equal(attempts, 2);
  mock.timers.tick(1);
  await Promise.resolve();
  assert.equal(attempts, 3);
  receive({ signals: [externalSignal('one', 'alarm')] });
  assert.equal(runtime.issues(device)[0].severity, 'alarm');
  runtime.hostDisconnected();
});

test('startup retries are canceled on detach and permission failures do not retry', async ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let attempts = 0;
  let code = 'not_ready';
  const connection = {
    async subscribeMessage() {
      attempts++;
      throw { code };
    },
  };
  const runtime = new ExternalAlertsRuntime({ addController() {} }, () => ({ connection }), () => 'en', () => {});
  runtime.hostConnected();
  await Promise.resolve();
  runtime.hostDisconnected();
  mock.timers.tick(60_000);
  assert.equal(attempts, 1);
  code = 'unauthorized';
  runtime.hostConnected();
  await Promise.resolve();
  mock.timers.tick(60_000);
  assert.equal(attempts, 2);
  runtime.hostDisconnected();
});
