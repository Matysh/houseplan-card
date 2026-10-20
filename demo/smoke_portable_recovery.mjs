// Native transfer UI + frozen real backend outputs. Not an HA storage/ACL proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launchPanelCold, finish } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

const fixture = JSON.parse(readFileSync('demo/fixtures/portable-recovery-v1.json', 'utf8'));
const labels = JSON.parse(readFileSync('src/i18n/settings/en.json', 'utf8'));
const tools = Object.fromEntries(['en', 'ru', 'de', 'fr'].map(locale => [locale,
  JSON.parse(readFileSync(`src/i18n/tools/${locale}.json`, 'utf8'))]));
const { page, browser } = await launchPanelCold({ width: 1000, height: 800 });
const downloads = [];
page.on('download', item => downloads.push(item));
const out = {};
const dialog = () => page.locator('hp-dialog[data-kind="backup"]');
async function cancel() {
  await dialog().locator('.btn[data-hp="dialog-cancel"]').click();
  await dialog().waitFor({ state: 'detached' });
}
async function settings() {
  await page.locator('[data-hp="settings"]').click();
  await page.locator('hp-dialog[data-kind="settings"] [data-section-target="data"]').click();
}
async function choose(zip = false) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-hp="import-backup"]').click();
  await (await chooser).setFiles({ name: zip ? 'synthetic.zip' : 'synthetic.json',
    mimeType: zip ? 'application/zip' : 'application/json',
    buffer: zip ? Buffer.from(fixture.zip, 'base64') : Buffer.from(JSON.stringify(fixture.document)) });
  await dialog().locator('[data-hp="backup-recovery"]').waitFor();
}
try {
  await page.evaluate(async fixture => {
    const state = { config: { model_version: 10, spaces: [], markers: [], settings: {} },
      layout: {}, cr: 1, lr: 1, log: [], exports: 0 };
    const hass = window.__mkHass(), original = hass.callWS;
    hass.user = { id: 'synthetic-recovery-writer', name: 'Recovery tester', is_admin: true };
    hass.language = 'en'; hass.locale = { language: 'en' }; hass.floors = {}; hass.areas = {};
    hass.callWS = async message => {
      state.log.push(structuredClone(message));
      if (message.type === 'houseplan/config/get') return { config: structuredClone(state.config), rev: state.cr, can_write: true };
      if (message.type === 'houseplan/layout/get') return { layout: state.layout, rev: state.lr };
      if (message.type === 'houseplan/config/set') { state.config = structuredClone(message.config); return { rev: ++state.cr }; }
      if (message.type === 'houseplan/backup/cancel') return { ok: true };
      if (message.type === 'houseplan/import/apply') {
        state.config = structuredClone(fixture.config); state.layout = structuredClone(fixture.layout);
        return { kind: 'full', counts: fixture.response.preview.counts,
          config_rev: ++state.cr, layout_rev: ++state.lr, can_undo: true };
      }
      if (message.type === 'houseplan/export/create') {
        state.exports++;
        return { archive: true, token: 'synthetic-export', filename: 'repaired.zip',
          ...fixture.archive, recovery: fixture.export.recovery };
      }
      return original(message);
    };
    hass.fetchWithAuth = async (path, init) => {
      state.log.push({ type: 'fetch', path });
      if (path.startsWith('/api/houseplan/backup/export/')) return new Response(
        Uint8Array.from(atob(fixture.exportZip), c => c.charCodeAt(0)), { headers: { 'content-type': 'application/zip' } });
      const zip = path === '/api/houseplan/backup/import/preview';
      if (!zip && !path.startsWith('/api/houseplan/import/preview')) throw new Error('Unexpected transfer');
      const bytes = new Uint8Array(await init.body.arrayBuffer());
      const expected = zip ? Uint8Array.from(atob(fixture.zip), c => c.charCodeAt(0))
        : new TextEncoder().encode(JSON.stringify(fixture.document));
      if (bytes.length !== expected.length || !bytes.every((b, i) => b === expected[i])) throw new Error('Unknown fixture bytes');
      const response = structuredClone(fixture.response);
      response.expected_config_rev = state.cr; response.expected_layout_rev = state.lr;
      if (zip) response.preview.archive = fixture.archive;
      return Response.json(response);
    };
    window.recoveryFixture = state;
    window.recoveryHass = hass;
    await import('/assets/houseplan-card.js');
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card' }); card.hass = hass;
    document.querySelector('#host').append(card); window.__card = card;
  }, fixture);
  await page.waitForFunction(() => window.__card?._loadOk);
  await assertFreshDemoBundle(page);
  await page.locator('hp-dialog .btn[data-hp="dialog-cancel"]').click();
  await page.locator('hp-dialog').waitFor({ state: 'detached' });
  for (const locale of ['en', 'ru', 'de', 'fr']) {
    await page.evaluate(locale => {
      const hass = window.recoveryHass;
      hass.language = locale; hass.locale = { language: locale };
      window.__card.hass = { ...hass };
    }, locale);
    await page.setViewportSize({ width: locale === 'de' ? 360 : 1000, height: 800 });
    await choose(locale === 'de');
    await page.waitForFunction(text => window.__card.renderRoot.querySelector('[data-hp="backup-recovery"]')
      ?.textContent.includes(text), tools[locale]['backup.recovery.import_title']);
    await dialog().locator('[data-hp="backup-recovery"] summary').click();
    assert.equal(await dialog().locator('[data-hp="backup-recovery"] details li').count(), 2);
    assert.equal(await dialog().locator('[data-recovery-injection]').count(), 0);
    assert.ok((await dialog().locator('[data-hp="backup-recovery"] details').innerText()).includes('<img data-recovery-injection>'));
    assert.ok(await dialog().locator('[data-hp="backup-recovery"]').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    assert.ok(await dialog().locator('.body').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await cancel();
  }
  out.jsonZipRecoveryLocalizedAndNarrow = true;
  assert.equal(await page.evaluate(() => window.recoveryFixture.log.some(m => m.type === 'houseplan/import/apply')), false);
  out.previewAndCancelNeverApply = true;
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.evaluate(() => {
    window.recoveryHass.language = 'en'; window.recoveryHass.locale = { language: 'en' };
    window.__card.hass = { ...window.recoveryHass };
  });
  await choose();
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  await dialog().waitFor({ state: 'detached' });
  await page.locator('[data-hp="settings"]').waitFor();
  out.repairedPlanCanBeApplied = true;
  await settings();
  await page.getByRole('button', { name: labels['backup.export_open'], exact: true }).click();
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  await dialog().locator('[data-hp="backup-recovery"]').waitFor();
  assert.equal(downloads.length, 0);
  assert.ok((await dialog().locator('[data-hp="dialog-confirm"]').innerText()).includes(tools.en['backup.recovery.download']));
  const downloaded = page.waitForEvent('download');
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  const download = await downloaded;
  assert.ok(readFileSync(await download.path()).equals(Buffer.from(fixture.exportZip, 'base64')));
  assert.equal(await page.evaluate(() => window.recoveryFixture.exports), 1);
  out.exportConsentDownloadsFrozenActualZip = true;
  await finish(browser, out);
} finally {
  await browser.close();
}
