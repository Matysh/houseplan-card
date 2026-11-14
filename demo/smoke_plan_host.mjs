/** #1392: actual plan/editor with a port-only host; no Home Assistant object.
 * The wire store is synthetic, not evidence of backend validation/ACL. */
import assert from 'node:assert/strict';
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { wallKey } from '../test-build/wall-thickness.js';
import { PLAN_ONLY_CAPABILITIES } from '../test-build/plan-capabilities.js';
import { planCapabilities, permitsCommand, permitsHttp } from '../test-build/plan-capabilities.js';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

requirePinnedBrowser();
const poly = [[.1, .1], [.9, .1], [.9, .75], [.1, .75]];
const config = { model_version: 10, spaces: [{ id: 'local', title: 'Local plan', cell_cm: 5,
  view_box: [0, 0, 1, 1], rooms: [{ id: 'room', name: 'Room', poly }], wall_segments: [],
  walls: poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length], cm: 20,
    key: wallKey(a, poly[(i + 1) % poly.length], 1 / 240) })),
  partitions: [{ id: 'wall', a: [.2, .85], b: [.8, .85], cm: 12 }],
  openings: [{ id: 'door', type: 'door', x: .4, y: .85, angle: 0, length: .075,
    host: { kind: 'partition', id: 'wall', t: 1 / 3 } }],
  decor: [{ id: 'rect', kind: 'rect', x: .2, y: .3, w: .2, h: .1, color: '#718b82', opacity: 1, width_cm: 2 }],
}], markers: [{ id: 'keep', binding: 'entity:light.kept', space: 'local' }], settings: { filter_seeded: true } };
async function runProfile(planOnly) {
const { page, browser } = await launchPanelCold({ width: 1680, height: 1100 });
page.setDefaultTimeout(12000);
const card = page.locator('houseplan-card'), panel = card.locator('[data-hp="properties-panel"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const idle = () => page.evaluate(async () => {
  const c = window.__card; c._saveConfigDebounced.flush();
  await c._writeChain; await c.updateComplete;
});
const saved = () => page.evaluate(() => window.__planHostLab.saved());
try {
  await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
  await page.evaluate(async ({ config, capabilities }) => {
    await import('/assets/houseplan-card.js');
    const { createPlanHostFixture } = await import('/plan-host-fixture.js');
    const lab = window.__planHostLab = createPlanHostFixture(config, { ready: false, capabilities });
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card', title: 'Port-only editor', language: 'en' });
    c.planHost = lab.host; document.getElementById('host').append(c); window.__card = c;
    await c.updateComplete;
  }, { config, capabilities: planOnly ? PLAN_ONLY_CAPABILITIES : undefined });
  await assertFreshDemoBundle(page);
  check('host.cold_deferred_no_transport', await page.evaluate(() => window.__planHostLab.commands.length), 0);
  await page.evaluate(() => { window.__planHostLab.failNextRead(); window.__planHostLab.ready(); });
  try { await page.waitForFunction(() => window.__planHostLab.commands.some(c => c.type === 'houseplan/config/get')); }
  catch (error) {
    console.error('host bootstrap diagnostic', await page.evaluate(() => ({ commands: window.__planHostLab.commands,
      environment: window.__card.planHost.environment, ready: window.__card._loadOk, tries: window.__card._loadTries,
      body: window.__card.shadowRoot?.textContent?.slice(-1800) })));
    throw error;
  }
  await page.evaluate(() => window.__planHostLab.tick());
  await page.waitForFunction(() => window.__card._loadOk && !window.__card._booting);
  check('host.no_hass', await page.evaluate(() => window.__card.hass === undefined));
  check('host.rendered', await card.count(), 1);
  check('host.single_environment_driver', await page.evaluate(() => window.__planHostLab.listenerCount), 1);
  check('host.plan_subscriptions', await page.evaluate(() => window.__planHostLab.subscriptionCount), 2);
  if (planOnly) {
    check('capabilities.no_device_editor', await card.locator('[data-mode="devices"]').count(), 0);
    check('capabilities.no_hidden_devices', await card.locator('[data-hp="hidden-devices"]').count(), 0);
    check('capabilities.no_summary', await card.locator('[data-hp="summary-toggle"]').count(), 0);
    await page.evaluate(async () => { window.__card._openSettingsDialog(); await window.__card.updateComplete; });
    await card.locator('hp-dialog[data-kind="settings"]').waitFor();
    check('capabilities.no_zigbee_section', await card.locator('[data-settings-section="zigbee"]').count(), 0);
    check('capabilities.no_screen_section', await card.locator('[data-settings-section="external-screens"]').count(), 0);
    check('capabilities.no_battery_field', await card.locator('[name="gs-device-battery"]').count(), 0);
    check('capabilities.modal_host_replacement_preserves_draft', await page.evaluate(async capabilities => {
      const c = window.__card, before = c.planHost;
      const { createPlanHostFixture } = await import('/plan-host-fixture.js');
      c._settingsDialog = { ...c._settingsDialog, bgColor: '#123456' };
      c.planHost = createPlanHostFixture(window.__planHostLab.saved(), { capabilities }).host;
      return c.planHost === before && c._settingsDialog.bgColor === '#123456';
    }, planCapabilities([])));
    await page.evaluate(() => { window.__card._settingsDialog = null; window.__card._openSupportDialog(); });
    await card.locator('hp-dialog[data-kind="support"]').waitFor();
    check('capabilities.help_without_ha_form', await card.locator('.supportform').count(), 0);
    await page.evaluate(() => { const c = window.__card; c._supportDialog = null; c._editorRuntime._openDeviceInbox(); c._setMode('devices'); });
    check('capabilities.direct_device_action_refused', await page.evaluate(() => !window.__card._deviceInbox && window.__card._mode !== 'devices'));
    await page.evaluate(() => { window.__card._editorRuntime._openBackupExport(); });
    await card.locator('hp-dialog[data-kind="backup"]').waitFor();
    check('capabilities.no_full_backup', await card.locator('[data-field="backup-kind"][data-value="full"]').count(), 0);
    check('capabilities.single_space_limit_explained', await card.locator('hp-dialog[data-kind="backup"]').textContent().then(text => text.includes('Stair links to other floors')));
    await page.evaluate(() => { window.__card._editorRuntime._closeBackupExport(); });
  }
  const beforeTick = await page.evaluate(() => window.__planHostLab.commands.length);
  await page.evaluate(() => { window.__planHostLab.tick(); window.__planHostLab.tick(); }); await settle();
  check('host.tick_no_reads_or_resubscribe', await page.evaluate(() => window.__planHostLab.commands.length), beforeTick);

  await page.evaluate(async () => {
    await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select');
    await window.__card._editorRuntime.optimizePlans.open();
  });
  await page.waitForFunction(() => !!window.__card._alignDialog);
  await page.evaluate(() => window.__card._editorRuntime.optimizePlans.run()); await idle();
  check('host.optimize_through_port', await page.evaluate(() => window.__planHostLab.commands.some(c => c.type === 'houseplan/plan/optimize')));
  check('host.optimize_saved_current_graph', (await saved()).model_version, 11);
  check('host.nonauthoritative_registry_keeps_binding', (await saved()).markers.some(m => m.id === 'keep' && m.binding === 'entity:light.kept'));
  await page.evaluate(() => { window.__card._alignDialog = null; window.__card.requestUpdate(); }); await settle();

  await card.locator('[data-hp="zoom-fit"]').click();
  await card.locator('[data-hp="partition"][data-id="wall"]').click();
  await panel.locator('[data-property="cm"] input').fill('14');
  await panel.locator('[data-property="cm"] input').press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft); await idle();
  check('host.wall_saved', (await saved()).spaces[0].partitions.find(w => w.id === 'wall').cm, 14);
  const historyBeforeOpening = await page.evaluate(() => window.__card._geometryHistory.size);
  await card.locator('.opening[data-id="door"] .op-hit').click();
  await panel.locator('[data-property="length"] input').fill('80');
  await panel.locator('[data-property="length"] input').press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft); await idle();
  check('host.opening_saved', Math.abs((await saved()).spaces[0].openings[0].length - 80 / 1200) < 1e-9);
  check('host.opening_history', await page.evaluate(() => window.__card._geometryHistory.size) > historyBeforeOpening);

  await page.evaluate(() => window.__card._openRoomEdit(window.__card._curSpaceCfg.rooms[0]));
  if (planOnly) {
    await card.locator('hp-dialog[data-kind="room"]').waitFor();
    check('capabilities.room_without_area_binding', await card.locator('[data-field="room-area"]').count(), 0);
  }
  const roomDialog = card.locator('hp-dialog[data-kind="room"]');
  await roomDialog.locator('#room-name').fill('Local renamed room');
  await roomDialog.locator('[data-hp="dialog-confirm"]').click(); await idle();
  check('host.room_saved', (await saved()).spaces[0].rooms[0].name, 'Local renamed room');
  await page.evaluate(async () => { await window.__hpTest.setMode('decor'); window.__card._editorRuntime.properties.select('rect', 'rect'); });
  await page.waitForFunction(() => !window.__card._modeTransitionBusy);
  await panel.locator('[data-property="w"] input').fill('300');
  await panel.locator('[data-property="w"] input').press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft); await idle();
  check('host.decor_saved', Math.abs((await saved()).spaces[0].decor[0].w - 300 / 1200) < 1e-9);
  if (planOnly) {
    await page.evaluate(async () => {
      const c = window.__card, bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), ch => ch.charCodeAt(0));
      await c._editorRuntime._uploadDecorImage(new Blob([bytes], { type: 'image/png' }), 'fixture.png', false);
      c._editorRuntime._decorImagePlace([700, 500]);
      c._openSpaceDialog('edit', c._space);
      await c.updateComplete;
      await c._editorRuntime._pickPlanFile({ target: { files: [new File([bytes], 'fixture.png', { type: 'image/png' })], value: '' } });
      c._spaceDialog = { ...c._spaceDialog, source: 'file' };
      await c._editorRuntime._saveSpaceDialog();
    });
    await idle();
    check('capabilities.decor_image_saved', (await saved()).spaces[0].decor.some(shape => shape.kind === 'image'));
    check('capabilities.backdrop_saved', (await saved()).spaces[0].plan_url?.includes('fixture.png'));
    check('capabilities.image_upload_ports', await page.evaluate(() => ['/api/houseplan/assets/upload', '/api/houseplan/plans/upload']
      .every(path => window.__planHostLab.commands.some(command => command.http === path))));
  }
  const edited = await saved();
  await page.evaluate(async () => { await window.__card._loadFromServer(); await window.__card.updateComplete; });
  assert.deepEqual(await page.evaluate(() => structuredClone(window.__card._serverCfg)), edited);
  check('host.reload_actual_saved_document', true);

  const permissionWrite = await page.evaluate(async () => {
    const c = window.__card, lab = window.__planHostLab, request = lab.host.request.bind(lab.host);
    let release, dispatched;
    const held = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { dispatched = resolve; });
    let hold = true;
    lab.host.request = async command => {
      const response = await request(command);
      if (hold && command.type === 'houseplan/config/set') { hold = false; dispatched(); await held; }
      return response;
    };
    c._serverCfg = structuredClone(c._serverCfg);
    c._serverCfg.spaces[0].title = 'Accepted before rights changed';
    const first = c._writeConfig().then(() => 'accepted', error => error.code);
    await started;
    c._serverCfg.spaces[0].title = 'Queued stale optimistic edit';
    const second = c._writeConfig().then(() => 'accepted', error => error.code);
    lab.permissions({ write: false });
    release();
    const results = await Promise.all([first, second]);
    lab.host.request = request;
    return { results, pending: c._writesPending };
  });
  check('host.permission_change_retires_pending_writes', permissionWrite.pending, 0);
  assert.deepEqual(permissionWrite.results, ['context-changed', 'context-changed']);
  await page.waitForFunction(() => !window.__card._loading && !window.__card._read.busy
    && window.__card._serverCfg.spaces[0].title === 'Accepted before rights changed').catch(async error => {
      console.error('permission reconciliation', await page.evaluate(() => {
        const c = window.__card;
        return { title: c._serverCfg?.spaces[0].title, saved: window.__planHostLab.saved().spaces[0].title,
          pending: c._writesPending, writing: c._cfgWriting, loading: c._loading,
          read: c._read, commands: window.__planHostLab.commands.slice(-12) };
      }));
      throw error;
    });
  check('host.permission_change_reconciles_optimistic_edit', true);
  await page.evaluate(() => window.__planHostLab.permissions({ write: true }));
  await page.waitForFunction(() => !window.__card._loading && !window.__card._read.busy);
  await page.evaluate(async () => {
    const c = window.__card;
    c._serverCfg = structuredClone(c._serverCfg); c._serverCfg.spaces[0].title = 'Writable after rights restore';
    await c._writeConfig();
  });
  check('host.permission_restore_accepts_new_write', (await saved()).spaces[0].title, 'Writable after rights restore');

  await page.evaluate(async planOnly => {
    const c = window.__card, document = window.__planHostLab.saved();
    document.spaces[0].title = 'Imported through host ports';
    await c._editorRuntime._importBackupFile(new File([JSON.stringify({ kind: planOnly ? 'space' : 'full', config: document })], 'local-fixture.json', { type: 'application/json' }));
  }, planOnly);
  await card.locator('hp-dialog[data-kind="backup"] [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._backupImportDialog); await idle();
  check('host.portable_preview_http', await page.evaluate(() => window.__planHostLab.commands.some(c => c.http?.startsWith('/api/houseplan/import/preview'))));
  check('host.portable_apply_command', await page.evaluate(() => window.__planHostLab.commands.some(c => c.type === 'houseplan/import/apply')));
  check('host.portable_actual_document', (await saved()).spaces[0].title, 'Imported through host ports');
  check('host.portable_adopted_document', await page.evaluate(() => window.__card._serverCfg.spaces[0].title), 'Imported through host ports');
  check('host.import_retires_old_geometry_history', await page.evaluate(() => window.__card._geometryHistory.size), 0);

  // The log includes local subscribe/disposer bookkeeping, not only IO.
  const beforeOffline = await page.evaluate(() =>
    window.__planHostLab.commands.filter(command => command.type || command.http).length);
  const readsBeforeOffline = await page.evaluate(() =>
    window.__planHostLab.commands.filter(command => command.type === 'houseplan/config/get').length);
  await page.evaluate(async () => { window.__planHostLab.connected(false); await window.__card._loadFromServer(); });
  check('host.offline_defers_read', await page.evaluate(() =>
    window.__planHostLab.commands.filter(command => command.type || command.http).length), beforeOffline);
  check('host.offline_releases_subscriptions', await page.evaluate(() =>
    window.__planHostLab.commands.filter(command => command.release).length > 0));
  await page.evaluate(() => window.__planHostLab.connected(true));
  await page.waitForFunction(n =>
    window.__planHostLab.commands.filter(command => command.type === 'houseplan/config/get').length > n
      && !window.__card._loading && !window.__card._read.busy, readsBeforeOffline);
  check('host.same_authority_reconnect', await page.evaluate(() => window.__card._loadOk));
  check('host.no_presentation_backdoor', await page.evaluate(() => window.__planHostLab.forbiddenReads.length), 0);
  if (planOnly) {
    const commands = await page.evaluate(() => window.__planHostLab.commands);
    check('capabilities.allowed_command_log', commands.every(command => command.type
      ? permitsCommand(PLAN_ONLY_CAPABILITIES, command) : command.http ? permitsHttp(PLAN_ONLY_CAPABILITIES, command.http) : true));
    check('capabilities.catalog_not_persisted', !Object.hasOwn(await saved(), 'capabilities'));
    // Replace the adapter, not a mutable capability signal. Authoritative data
    // includes both families; virtual-only must not prune the hidden binding.
    await page.evaluate(async capabilities => {
      const { createPlanHostFixture } = await import('/plan-host-fixture.js');
      const config = window.__planHostLab.saved();
      config.markers.push({ id: 'virtual', binding: 'virtual', space: config.spaces[0].id, name: 'Virtual lamp', icon: 'mdi:lightbulb' });
      const lab = window.__planHostLab = createPlanHostFixture(config, { capabilities });
      window.__card.planHost = lab.host;
    }, planCapabilities(['virtualDevices']));
    await page.waitForFunction(() => window.__card._loadOk && !window.__card._loading);
    await page.evaluate(async () => { await window.__hpTest.setMode('devices'); window.__card._editorRuntime._openDeviceInbox(); });
    await card.locator('hp-dialog[data-kind="device-inbox"]').waitFor();
    check('capabilities.virtual_only_roster', await page.evaluate(() => window.__card._editorRuntime._deviceInboxRows().every(row => row.kind === 'virtual')));
    check('capabilities.virtual_only_keeps_real_data', (await saved()).markers.some(marker => marker.id === 'keep'));
    await page.evaluate(() => { const c = window.__card; c._deviceInbox = null; c._editorRuntime._openMarkerDialog(); });
    await card.locator('hp-dialog[data-kind="marker"]').waitFor();
    check('capabilities.virtual_without_ha_binding', await card.locator('[name="bmode"][data-value="ha"]').count(), 0);
    check('capabilities.virtual_without_actions', await card.locator('[data-settings-section="actions"]').count(), 0);
    check('capabilities.virtual_without_alarm', await card.locator('[data-settings-section="alarms"]').count(), 0);
    await page.evaluate(() => { window.__card._markerDialog = null; });
    await page.evaluate(async capabilities => {
      const { createPlanHostFixture } = await import('/plan-host-fixture.js');
      const lab = window.__planHostLab = createPlanHostFixture(window.__planHostLab.saved(), { capabilities });
      window.__card.planHost = lab.host;
    }, planCapabilities([]));
    await page.waitForFunction(() => window.__card._loadOk && !window.__card._loading);
    await page.evaluate(() => window.__card._openSettingsDialog());
    await card.locator('hp-dialog[data-kind="settings"]').waitFor();
    check('capabilities.bare_no_maintenance', await card.locator('[data-action="plan-optimize"]').count(), 0);
    check('capabilities.bare_no_transfer', await card.locator('[data-action="backup-export-open"]').count(), 0);
    check('capabilities.bare_no_print', await card.locator('[data-hp="pdf"]').count(), 0);
    await page.evaluate(() => { const c = window.__card; c._settingsDialog = null; c._openSpaceDialog('edit', c._space); });
    await card.locator('hp-dialog[data-kind="space"]').waitFor();
    check('capabilities.bare_no_image_picker', await card.locator('[data-field="space-plan-source"], [data-action="backdrop-server-plans"]').count(), 0);
    check('capabilities.bare_no_optional_requests', (await page.evaluate(() => window.__planHostLab.commands)).every(command =>
      !command.type || permitsCommand(planCapabilities([]), command)));
  }
  await page.evaluate(() => window.__card.remove());
  check('host.driver_disposed', await page.evaluate(() => window.__planHostLab.listenerCount), 0);
} finally { await finish(browser, { scenario: planOnly ? 'plan-only capabilities' : 'port-only plan host' }); }
}
for (const profile of process.argv.includes('--plan-only') ? [true] : [false, true]) await runProfile(profile);
