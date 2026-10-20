// Native product entrypoints + actual Python-generated ZIP/preview fixtures.
// HA transport is synthetic; real storage/rights/recovery are tested by the HA harness.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { launchPanelCold, checkAll, finish } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

const fixture = JSON.parse(readFileSync('demo/fixtures/backup-archive-v1.json', 'utf8'));
const settingsLabels = JSON.parse(readFileSync('src/i18n/settings/en.json', 'utf8'));
const { page, browser } = await launchPanelCold({ width: 1000, height: 820 });
const downloads = [], requests = [];
page.on('download', item => downloads.push(item));
page.on('request', item => requests.push(item.url()));
await page.route('**/api/houseplan/content/**', route => route.fulfill({
  status: 200, contentType: 'image/png', body: Buffer.from(fixture.png, 'base64'),
}));
const out = {};
const dialog = () => page.locator('hp-dialog[data-kind="backup"]:not([inert])');
const label = key => settingsLabels[key];
async function settings() {
  await page.locator('[data-hp="settings"]').click();
  await page.locator('hp-dialog[data-kind="settings"] [data-section-target="data"]').click();
}
async function choose(name, incomplete = false, empty = false) {
  const file = { name, mimeType: 'application/zip',
    buffer: Buffer.from((incomplete ? fixture.incomplete : fixture).zip, 'base64') };
  if (empty) {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-hp="import-backup"]').click();
    await (await chooser).setFiles(file);
  } else await page.locator('.backupupload input[type="file"]').setInputFiles(file);
}
async function ready() {
  await page.waitForFunction(() => window.__card._backupImportDialog?.busy === false);
  assert.equal(await page.evaluate(() => window.__card._backupImportDialog.error), '');
  await dialog().locator('[data-hp="archive-summary"]').waitFor();
}
async function cancel() {
  const closing = await dialog().elementHandle();
  await dialog().locator('button.btn[data-hp="dialog-cancel"]').click();
  // Do not mistake the newly inert selector for terminal physical removal.
  await page.waitForFunction(element => !element.isConnected, closing);
  await closing.dispose();
}

try {
  await page.evaluate(async fixture => {
    const initial = { model_version: 10, spaces: [], markers: [], settings: {} };
    const state = { config: structuredClone(initial), layout: {}, cr: 1, lr: 1, backup: null,
      log: [], tokens: {}, exports: {}, operations: {}, cancelled: [], incompleteExport: false,
      delayed: false, delayedBody: false, release: null };
    const hass = window.__mkHass(), original = hass.callWS;
    hass.user = { id: 'synthetic-archive-admin', is_admin: true, name: 'Backup admin' };
    hass.language = 'en'; hass.locale = { language: 'en' }; hass.floors = {}; hass.areas = {};
    hass.callWS = async message => {
      state.log.push(structuredClone(message));
      if (message.type === 'houseplan/config/get') return { config: structuredClone(state.config), rev: state.cr,
        decor_assets_api: 1, can_write: true, can_optimize_undo: !!state.backup, undo_kind: state.backup ? 'import' : null };
      if (message.type === 'houseplan/layout/get') return { layout: structuredClone(state.layout), rev: state.lr,
        can_optimize_undo: !!state.backup, undo_kind: state.backup ? 'import' : null };
      if (message.type === 'houseplan/content/sign') return { urls: Object.fromEntries(message.paths.map(path => [path, path + '?authSig=synthetic'])) };
      if (message.type === 'houseplan/assets/resolve') return { assets: message.asset_ids.map(asset_id => ({
        asset_id, name: 'Synthetic image', mime: 'image/png', width: 8, height: 8, bytes: 77,
        url: `/api/houseplan/content/assets/_/${asset_id}.png`, used_by: [],
      })), missing: [] };
      if (message.type === 'houseplan/export/create') {
        assertPortableRequest(message);
        const selected = state.incompleteExport ? fixture.incomplete : fixture;
        const token = 'synthetic-export-' + state.log.length;
        state.exports[token] = selected;
        return { archive: true, token, filename: state.incompleteExport ? 'copy-incomplete.zip' : 'copy.zip',
          ...structuredClone(selected.response.preview.archive) };
      }
      if (message.type === 'houseplan/backup/cancel') {
        if (message.operation_id) {
          state.cancelled.push(message.operation_id);
          delete state.tokens[state.operations[message.operation_id]];
          delete state.operations[message.operation_id];
        } else {
          delete state.tokens[message.token]; delete state.exports[message.token];
          for (const [id, token] of Object.entries(state.operations)) if (token === message.token) delete state.operations[id];
        }
        return { ok: true };
      }
      if (message.type === 'houseplan/import/apply') {
        const selected = state.tokens[message.token];
        if (!selected) throw new Error('Unknown synthetic preview token');
        state.backup = { config: structuredClone(state.config), layout: structuredClone(state.layout) };
        state.config = structuredClone(selected.config); state.layout = structuredClone(selected.layout);
        delete state.tokens[message.token];
        for (const [id, token] of Object.entries(state.operations)) if (token === message.token) delete state.operations[id];
        state.cr++; state.lr++;
        return { kind: 'full', counts: selected.response.preview.counts, config_rev: state.cr, layout_rev: state.lr, can_undo: true };
      }
      if (message.type === 'houseplan/plan/optimize_undo') {
        if (!state.backup) throw new Error('No synthetic backup');
        state.config = state.backup.config; state.layout = state.backup.layout; state.backup = null;
        return { kind: 'import', config_rev: ++state.cr, layout_rev: ++state.lr, can_undo: false };
      }
      if (message.type === 'houseplan/config/set') {
        state.lastWriteBefore = structuredClone(state.config);
        if (JSON.stringify(state.config) !== JSON.stringify(message.config)) {
          state.config = structuredClone(message.config); state.cr++; state.backup = null;
        }
        return { rev: state.cr };
      }
      return original(message);
    };
    function assertPortableRequest(message) {
      if (message.kind !== 'full' || message.archive !== true) throw new Error('Full export did not request portable ZIP');
    }
    hass.fetchWithAuth = async (path, init) => {
      state.log.push({ type: 'fetch', path, file: init.body?.name });
      if (path.startsWith('/api/houseplan/backup/export/')) {
        const token = decodeURIComponent(path.split('/').at(-1)), selected = state.exports[token];
        const consent = JSON.parse(init.body);
        state.log.push({ type: 'archive-download', token, consent });
        if (!selected || !selected.response.preview.archive.complete && !consent.confirm_missing_content) {
          return Response.json({ error: 'content_confirmation_required' }, { status: 400 });
        }
        delete state.exports[token];
        return new Response(Uint8Array.from(atob(selected.zip), c => c.charCodeAt(0)), { headers: { 'content-type': 'application/zip' } });
      }
      if (path !== '/api/houseplan/backup/import/preview') throw new Error('ZIP used the JSON endpoint');
      const operation = init.headers['x-houseplan-operation'];
      if (!/^[0-9a-f]{32}$/.test(operation)) throw new Error('ZIP lacks an early cancellation identity');
      if (Object.keys(state.operations).length) return Response.json({ error: 'zip_busy' }, { status: 400 });
      state.operations[operation] = 'pending';
      state.log.push({ type: 'archive-preview', filename: init.body.name });
      const selected = init.body.name.includes('incomplete') ? fixture.incomplete : fixture;
      if (state.delayed) { state.delayed = false; await new Promise(resolve => { state.release = resolve; }); }
      if (state.cancelled.includes(operation)) return Response.json({ error: 'zip_cancelled' }, { status: 400 });
      const response = structuredClone(selected.response);
      response.token = init.body.name + ':' + state.log.length;
      response.expected_config_rev = state.cr; response.expected_layout_rev = state.lr;
      state.tokens[response.token] = selected;
      state.operations[operation] = response.token;
      if (state.delayedBody) {
        state.delayedBody = false;
        return { ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
          state.readingBody = true;
        }) };
      }
      return Response.json(response);
    };
    window.archiveFixture = state;
    window.__HP_VERSION_OVERRIDE__ = '0.0.0-archive-proof';
    await import('/assets/houseplan-card.js');
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card' }); card.hass = hass;
    document.querySelector('#host').append(card); window.__card = card;
  }, fixture);
  await page.waitForFunction(() => window.__card?._loadOk);
  await assertFreshDemoBundle(page);
  await page.locator('hp-dialog').waitFor();
  await page.locator('hp-dialog button.btn[data-hp="dialog-cancel"]').click();
  await page.locator('hp-dialog').waitFor({ state: 'detached' });
  out.backupChunkAbsentBeforeUse = !requests.some(url => /backup-archive-client-[^/]+\.js/.test(url));

  await choose('full.zip', false, true); await ready();
  out.emptyChooserShowsRealPreview = (await dialog().locator('[data-hp="archive-summary"]').innerText()).includes('4');
  out.snapshotReportedOutdated = (await dialog().innerText()).includes('outdated');
  out.previewDoesNotApply = await page.evaluate(() => window.archiveFixture.config.spaces.length === 0
    && !window.archiveFixture.log.some(item => item.type === 'houseplan/import/apply'));
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  await dialog().waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.__card._serverCfg?.spaces.length === 2);
  await page.locator('image.hp-backdrop').waitFor();
  await page.locator('image.dimage').waitFor();
  out.restoredImageAndDecorVisible = await page.evaluate(() => {
    const root = window.__card.renderRoot;
    return ['image.hp-backdrop', 'image.dimage'].every(selector => {
      const element = root.querySelector(selector), box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && !!element.getAttribute('href');
    });
  });
  mkdirSync('artifacts/936', { recursive: true });
  await page.screenshot({ path: 'artifacts/936/native-restored.png' });

  await settings();
  await choose('incomplete.zip', true); await ready();
  out.incompleteImportRequiresConsent = await dialog().locator('[data-hp="dialog-confirm"]').isDisabled();
  out.incompleteReportNamesMissingImages = await dialog().locator('details li').count() === 2;
  await dialog().locator('.backupconfirm input').check();
  out.consentEnablesApply = !(await dialog().locator('[data-hp="dialog-confirm"]').isDisabled());
  await cancel();

  await settings();
  await page.getByRole('button', { name: await label('backup.export_open'), exact: true }).click();
  await page.evaluate(() => { window.archiveFixture.incompleteExport = true; });
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  await dialog().locator('[data-hp="archive-summary"]').waitFor();
  out.noIncompleteDownloadWithoutSecondAction = downloads.length === 0
    && await page.evaluate(() => !window.archiveFixture.log.some(item => item.type === 'archive-download'));
  out.incompleteDownloadLabelIsExplicit = (await dialog().locator('[data-hp="dialog-confirm"]').innerText()).includes('incomplete');
  const downloaded = page.waitForEvent('download');
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  const download = await downloaded;
  const file = await download.path();
  out.downloadHasRealIncompleteArchiveBytes = readFileSync(file).equals(Buffer.from(fixture.incomplete.zip, 'base64'));
  out.filenameMarksIncomplete = download.suggestedFilename().includes('incomplete');
  out.versionMetadataUsesDisplaySeam = await page.evaluate(() => window.archiveFixture.log
    .filter(item => item.type === 'houseplan/export/create').every(item => item.card_version === '0.0.0-archive-proof'));

  await settings();
  await page.evaluate(() => { window.archiveFixture.delayed = true; });
  await choose('late.zip');
  await page.waitForFunction(() => !!window.archiveFixture.release);
  await cancel();
  await settings(); await choose('new.zip'); await ready();
  const latest = await page.evaluate(() => window.__card._backupImportDialog.token);
  await page.evaluate(() => window.archiveFixture.release());
  await page.evaluate(() => window.__hpTest.settled());
  out.cancelledPreviewCannotReplaceNew = await page.evaluate(token => window.__card._backupImportDialog.token === token, latest);
  out.cancelledRequestDoesNotKeepServerSlot = await page.evaluate(() => Object.keys(window.archiveFixture.operations).length === 1);
  await cancel();

  await settings();
  await page.evaluate(() => { window.archiveFixture.delayedBody = true; });
  await choose('cancel-during-body.zip');
  await page.waitForFunction(() => window.archiveFixture.readingBody === true);
  await cancel();
  await settings(); await choose('retry-immediately.zip'); await ready();
  out.cancelDuringBodyAllowsImmediateRetry = await page.evaluate(() => Object.keys(window.archiveFixture.operations).length === 1
    && window.__card._backupImportDialog.filename === 'retry-immediately.zip');
  await cancel();

  await settings();
  await page.getByRole('button', { name: await label('backup.undo_import'), exact: true }).click();
  await page.waitForFunction(() => window.__card._serverCfg.spaces.length === 0);
  out.oneUndoRestoresPreviousEmptyPlan = await page.evaluate(() => window.archiveFixture.log
    .filter(item => item.type === 'houseplan/plan/optimize_undo').length === 1);
  out.noRadioScanFromTransfer = await page.evaluate(() => !window.archiveFixture.log
    .some(item => /zigbee.*(?:scan|start)/.test(item.type)));
  checkAll(out);
  await finish(browser, out);
} catch (error) {
  console.error(error);
  console.error(await page.evaluate(() => ({ state: window.__card?._backupImportDialog,
    export: window.__card?._backupExportDialog, log: window.archiveFixture?.log.slice(-20),
    lastWriteBefore: window.archiveFixture?.lastWriteBefore, config: window.archiveFixture?.config })).catch(() => ({})));
  await browser.close();
  throw error;
}
