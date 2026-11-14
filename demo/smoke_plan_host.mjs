/** #1392: actual plan/editor with a port-only host; no Home Assistant object.
 * The wire store is synthetic, not evidence of backend validation/ACL. */
import assert from 'node:assert/strict';
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { wallKey } from '../test-build/wall-thickness.js';

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
  await page.evaluate(async config => {
    await import('/assets/houseplan-card.js');
    const { createPlanHostFixture } = await import('/plan-host-fixture.js');
    const lab = window.__planHostLab = createPlanHostFixture(config, { ready: false });
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card', title: 'Port-only editor', language: 'en' });
    c.planHost = lab.host; document.getElementById('host').append(c); window.__card = c;
    await c.updateComplete;
  }, config);
  check('host.cold_deferred_no_transport', await page.evaluate(() => window.__planHostLab.commands.length), 0);
  await page.evaluate(() => { window.__planHostLab.failNextRead(); window.__planHostLab.ready(); });
  await page.waitForFunction(() => window.__planHostLab.commands.some(c => c.type === 'houseplan/config/get'));
  await page.evaluate(() => window.__planHostLab.tick());
  await page.waitForFunction(() => window.__card._loadOk && !window.__card._booting);
  check('host.no_hass', await page.evaluate(() => window.__card.hass === undefined));
  check('host.rendered', await card.count(), 1);
  check('host.single_environment_driver', await page.evaluate(() => window.__planHostLab.listenerCount), 1);
  check('host.plan_subscriptions', await page.evaluate(() => window.__planHostLab.subscriptionCount), 2);
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

  await page.evaluate(async () => {
    const c = window.__card, document = window.__planHostLab.saved();
    document.spaces[0].title = 'Imported through host ports';
    await c._editorRuntime._importBackupFile(new File([JSON.stringify({ config: document })], 'local-fixture.json', { type: 'application/json' }));
  });
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
  await page.evaluate(() => window.__card.remove());
  check('host.driver_disposed', await page.evaluate(() => window.__planHostLab.listenerCount), 0);
} finally { await finish(browser, { scenario: 'port-only plan host' }); }
