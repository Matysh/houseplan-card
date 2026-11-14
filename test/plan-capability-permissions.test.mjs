import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_NAMES, HA_CAPABILITIES, PLAN_ONLY_CAPABILITIES, planCapabilities,
  validateCapabilities, permitsCommand, permitsHttp, capabilityHost } from '../test-build/plan-capabilities.js';
import { HaPlanHost } from '../test-build/ha-plan-host.js';
import { createPlanHostFixture } from '../demo/srv/plan-host-fixture.js';
import { BackupArchiveClient } from '../test-build/backup-archive-client.js';
import { resolveDecorAssets } from '../test-build/decor-assets.js';

const config = () => ({ model_version: 11, spaces: [], markers: [], settings: {} });
const fixture = capabilities => createPlanHostFixture(config(), { capabilities });
const cmd = (name, fields = {}) => ({ type: `houseplan/${name}`, ...fields });

test('#1394 required closed immutable catalog and unchanged HA defaults', () => {
  assert.equal(CAPABILITY_NAMES.length, 17);
  assert.ok(Object.isFrozen(HA_CAPABILITIES));
  assert.ok(CAPABILITY_NAMES.every(name => HA_CAPABILITIES[name]));
  assert.deepEqual(fixture().host.capabilities, HA_CAPABILITIES, 'wire-fixture defaults track the canonical catalog');
  assert.equal(new HaPlanHost({}).capabilities, HA_CAPABILITIES);
  assert.throws(() => validateCapabilities({ devices: true }), { code: 'invalid_payload' });
  assert.throws(() => planCapabilities(['unknown']), { code: 'invalid_payload' });
  const missing = fixture().host; delete missing.capabilities;
  assert.throws(() => capabilityHost(missing), { code: 'invalid_payload' });
  const mutable = fixture().host; mutable.capabilities = { ...PLAN_ONLY_CAPABILITIES };
  assert.throws(() => capabilityHost(mutable), { code: 'invalid_payload' });
});

for (const dependent of ['zigbee', 'vacuum', 'radar', 'alarms']) test(`#1394 ${dependent} requires real devices, not virtual markers`, () => {
  assert.throws(() => planCapabilities([dependent]), { code: 'invalid_payload' });
  assert.throws(() => planCapabilities([dependent, 'virtualDevices']), { code: 'invalid_payload' });
  assert.equal(planCapabilities([dependent, 'devices'])[dependent], true);
});
test('#1394 independent virtual/area/service profiles never enable unrelated groups', () => {
  assert.equal(planCapabilities(['haAreas']).devices, false);
  assert.equal(planCapabilities(['virtualDevices']).devices, false);
  assert.equal(planCapabilities(['virtualDevices', 'deviceServices']).deviceServices, true);
  assert.throws(() => planCapabilities(['deviceServices']), { code: 'invalid_payload' });
});
test('#1394 transport matrix permits exactly the selected families', () => {
  const c = PLAN_ONLY_CAPABILITIES;
  for (const name of ['config/get', 'config/set', 'layout/get', 'layout/set', 'space/delete', 'wall/node_move',
    'wall/node_delete', 'plans/list', 'plans/delete', 'assets/list', 'assets/delete', 'assets/resolve',
    'plan/optimize', 'plan/optimize_undo', 'geometry/repair', 'import/revalidate', 'import/apply'])
    assert.equal(permitsCommand(c, cmd(name)), true, name);
  for (const name of ['trail/get', 'vacuum/history/list', 'radar/subscribe', 'zigbee/subscribe', 'support/submit',
    'external_screens/subscribe', 'virtual_light/toggle', 'layout/delete', 'marker/copy', 'files/migrate',
    'content/sign', 'unknown/new']) assert.equal(permitsCommand(c, cmd(name)), false, name);
  assert.equal(permitsCommand(c, cmd('export/create', { kind: 'space' })), true);
  assert.equal(permitsCommand(c, cmd('export/create', { kind: 'full' })), false);
  const bare = planCapabilities([]);
  for (const name of ['plans/list', 'assets/resolve', 'plan/optimize', 'import/apply']) assert.equal(permitsCommand(bare, cmd(name)), false);
  for (const path of ['/api/houseplan/plans/upload', '/api/houseplan/assets/upload', '/api/houseplan/import/preview?duplicate_policy=skip', '/api/houseplan/structural/upload'])
    assert.equal(permitsHttp(c, path), true, path);
  for (const path of ['/api/houseplan/upload', '/api/houseplan/backup/import/preview', '/api/houseplan/support/submit', 'https://example.org/upload'])
    assert.equal(permitsHttp(c, path), false, path);
});
test('#1394 dispatch refuses before transport and does not lend registry/services', async () => {
  const lab = fixture(planCapabilities(['virtualDevices']));
  const host = capabilityHost(lab.host);
  assert.equal(host.deviceServices, undefined); assert.equal(host.refreshRegistry, undefined);
  assert.equal(host.environment.registry.authoritative, false);
  assert.deepEqual(host.environment.states, {});
  assert.equal(host.environment, host.environment, 'projection identity is stable between environment ticks');
  await assert.rejects(host.request(cmd('support/submit')), { code: 'not_ready' });
  await assert.rejects(host.http.request('/api/houseplan/assets/upload'), { code: 'not_ready' });
  await assert.rejects(host.http.postJson('/api/houseplan/structural/upload', cmd('plan/optimize')), { code: 'not_ready' });
  assert.equal(lab.commands.length, 0);
  assert.equal(permitsCommand(host.capabilities, cmd('marker/history')), true);
  assert.equal(permitsCommand(host.capabilities, cmd('virtual_light/toggle')), false);
});
test('#1394 replacement adapters with identical raw authority still retire old capability generation', () => {
  const lab = fixture(PLAN_ONLY_CAPABILITIES), first = capabilityHost(lab.host);
  const second = capabilityHost({ ...lab.host, capabilities: planCapabilities([]) });
  assert.notEqual(first.authorityKey, second.authorityKey);
  assert.equal(first.authorityKey, first.authorityKey);
});
test('#1394 HA capability never grants server write permission', async () => {
  const calls = [], host = new HaPlanHost({ user: { id: 'viewer', is_admin: false }, callWS: async value => {
    calls.push(value); throw Object.assign(new Error('server ACL'), { code: 'unauthorized' });
  } });
  assert.equal(host.environment.permissions.write, false);
  await assert.rejects(host.request(cmd('config/set', { config: {} })), { code: 'unauthorized' });
  assert.deepEqual(calls, [cmd('config/set', { config: {} })], 'capability does not bypass server ACL');
});
test('#1394 base content port resolves stored assets without library commands', async () => {
  const lab = fixture(planCapabilities([])), id = 'a'.repeat(64);
  let resolves = 0;
  lab.host.content.resolveAssets = async ids => { resolves++; return { assets: ids.map(asset_id => ({ asset_id, name: 'saved', mime: 'image/png', width: 1, height: 1, bytes: 1, url: `/api/houseplan/content/assets/_/${asset_id}.png` })) }; };
  const result = await resolveDecorAssets(lab.host, [id], 1);
  assert.equal(result.get(id).name, 'saved'); assert.equal(resolves, 1);
  assert.equal(lab.commands.length, 0);
});
test('#1394 transfer-only accepts a space preview but refuses full JSON and ZIP before apply', async () => {
  const lab = fixture(PLAN_ONLY_CAPABILITIES), host = { planHost: lab.host, isConnected: true,
    _backupExportDialog: { kind: 'space', planOnly: true, busy: false, error: '' }, _space: 'local', _t: key => key, _showToast() {} };
  const client = new BackupArchiveClient(host);
  client.selectKind('full'); assert.equal(host._backupExportDialog.kind, 'space');
  const file = kind => new File([JSON.stringify({ kind, config: config() })], 'plan.json');
  assert.equal((await client.preview(file('space'))).preview.kind, 'space');
  await assert.rejects(client.preview(file('full')), { code: 'invalid_format' });
  await assert.rejects(client.preview(new File(['PK'], 'full.zip')), { code: 'invalid_format' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lab.commands.some(command => command.type === 'houseplan/import/apply'), false);
  assert.equal(lab.commands.filter(command => command.http).length, 2, 'ZIP never reached transport');
  assert.ok(lab.commands.some(command => command.type === 'houseplan/backup/cancel'), 'rejected portable candidate discarded');
});
