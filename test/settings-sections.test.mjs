import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSectionOf, selectSettingsSection, settingsSections } from '../test-build/editors/settings-sections.js';
import { zigbeeIntegrationPresence } from '../test-build/zigbee-integration-presence.js';
import { settingsUndoVisibility } from '../test-build/editors/general-form-state.js';

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

test('#947 a newly opened device starts at Basics while its own draft retains section choice', () => {
  const host = {requestUpdate(){},renderRoot:{querySelector(){return null;}}};
  const sections = [{id:'basics',title:'Basics'},{id:'details',title:'Details'}];
  const first = {}, second = {};
  settingsSections(host,'marker',sections,'Sections',first);
  selectSettingsSection(host,'marker','details');
  settingsSections(host,'marker',sections,'Sections',first);
  assert.equal(settingsSectionOf(host,'marker',sections),'details');
  settingsSections(host,'marker',sections,'Sections',second);
  assert.equal(settingsSectionOf(host,'marker',sections),'basics');
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

test('#948 ignored discovery entries do not become configured integrations, even with stale registry rows', () => {
  const metadata={loaded:true,entriesAvailable:true,revision:1,manifests:{},configEntries:{z:{domain:'zha',source:'ignore'},m:{domain:'mqtt',source:'ignore'}}};
  const registry={authoritative:true,entities:{old:{platform:'zha',config_entry_id:'z'}},devices:{bridge:{model:'Zigbee2MQTT Bridge',config_entries:['m']}}};
  assert.deepEqual(zigbeeIntegrationPresence(metadata,registry),{zha:'absent',z2m:'absent'});
  metadata.configEntries.z={domain:'zha',source:'user',disabled_by:'user',state:'not_loaded'};
  assert.equal(zigbeeIntegrationPresence(metadata,registry).zha,'present');
  delete metadata.configEntries.z.disabled_by;
  metadata.configEntries.z.state='setup_error';
  assert.equal(zigbeeIntegrationPresence(metadata,registry).zha,'present');
});

test('#948 one backend undo slot cannot expose two undo operations', () => {
  assert.deepEqual(settingsUndoVisibility('import',true),{fullImport:true,optimization:false});
  assert.deepEqual(settingsUndoVisibility('import',false),{fullImport:false,optimization:false});
  for(const kind of ['align','optimize',null,undefined])for(const available of [true,false]){
    assert.deepEqual(settingsUndoVisibility(kind,available),{fullImport:false,optimization:true});
  }
});
