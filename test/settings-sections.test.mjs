import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSectionOf, selectSettingsSection } from '../test-build/editors/settings-sections.js';
import { zigbeeIntegrationPresence } from '../test-build/zigbee-integration-presence.js';

test('#948 section choice is per host and dialog, and invalidated safely when a profile disappears', () => {
  const host = { requestUpdate() {}, renderRoot: { querySelector() { return null; } } }, other = { requestUpdate() {} };
  const sections = [{ id: 'main' }, { id: 'radar' }];
  selectSettingsSection(host, 'device', 'radar');
  assert.equal(settingsSectionOf(host, 'device', sections), 'radar');
  assert.equal(settingsSectionOf(other, 'device', sections), 'main');
  assert.equal(settingsSectionOf(host, 'general', sections), 'main');
  assert.equal(settingsSectionOf(host, 'device', [{ id: 'main' }]), 'main');
});

test('#948 a metadata failure never claims an integration is absent', () => {
  assert.deepEqual(zigbeeIntegrationPresence({ loaded: true, configEntries: {}, manifests: {}, revision: 1 }),
    { zha: 'unknown', z2m: 'unknown' });
});

test('#948 ZHA-only discovery, both integrations, and generic MQTT stay distinct', () => {
  const metadata = { loaded: true, entriesAvailable: true, revision: 1, manifests: {}, configEntries: { a: { domain: 'zha' } } };
  const registry = { authoritative: true, devices: {}, entities: {} };
  assert.deepEqual(zigbeeIntegrationPresence(metadata, registry), { zha: 'present', z2m: 'absent' });
  metadata.configEntries.b = { domain: 'mqtt' };
  assert.equal(zigbeeIntegrationPresence(metadata, registry).z2m, 'unknown');
  registry.devices.bridge = { model: 'Zigbee2MQTT Bridge' };
  assert.deepEqual(zigbeeIntegrationPresence(metadata, registry), { zha: 'present', z2m: 'present' });
});
