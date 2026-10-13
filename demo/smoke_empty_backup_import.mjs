// #875: real DOM/file chooser with a synthetic HA transport, NOT an HA backend proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launchPanelCold, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtime = manifest.files.map(f => f.path).find(p => /houseplan-editor-runtime-[^/]+\.js$/.test(p));
assert.ok(runtime);
const fixture = (kind = 'space', { empty = false, planOnly = false, missing = false } = {}) => {
  const spaces = empty ? [] : [{ id: 'restored', title: 'Restored floor', rooms: [],
    wall_segments: [], partitions: [], wall_columns: [], openings: [], decor: [] }];
  return {
    format: 'houseplan-export', export_version: 2, kind, model_version: 10,
    created_at: '2026-10-13T00:00:00Z', card_version: '1.81.0-beta.1', integration_version: '1.81.0-beta.1',
    source_fingerprint: 'a'.repeat(64), placement_manifest: [], content_manifest: [],
    transfer: planOnly ? { plan_only: true } : {},
    payload: { config: { model_version: 10, spaces, markers: [], settings: {} }, layout: {} },
    // Transport-only scenario marker; never submitted by the product outside this fixture.
    smokeMissing: missing,
  };
};
const file = (document, name = 'backup.json') => ({ name, mimeType: 'application/json',
  buffer: Buffer.from(typeof document === 'string' ? document : JSON.stringify(document)) });
const out = {};
const sessions = [];

async function start(options = {}) {
  const s = await launchPanelCold({ width: options.width || 820, height: 760 });
  sessions.push(s);
  const { page } = s;
  const requests = [];
  page.on('request', r => requests.push(r.url()));
  await page.evaluate(async (options) => {
    // Public HA/card setup only. The fixture controls backend replies and timing.
    const state = { config: { model_version: 10, spaces: [], markers: [], settings: {} }, layout: {},
      cfgRev: 20, layRev: 20, writer: options.writer !== false, log: [], tokens: {}, delay: '',
      release: null, conflict: false, applyWait: false, releaseApply: null, revalidateWait: false, releaseRevalidate: null };
    const hass = window.__mkHass();
    const original = hass.callWS;
    hass.floors = {}; hass.areas = {};
    hass.user = { id: 'empty-writer', is_admin: options.admin !== false,
      is_owner: false, name: 'Import writer' };
    hass.language = options.locale || 'en';
    hass.locale = { language: hass.language };
    hass.callWS = async (message) => {
      state.log.push(structuredClone(message));
      if (message.type === 'houseplan/config/get') {
        if (options.loading) await new Promise(resolve => { state.releaseConfig = resolve; });
        if (options.unavailable) throw new Error('Integration unavailable');
        return { config: structuredClone(state.config), rev: state.cfgRev, can_write: state.writer };
      }
      if (message.type === 'houseplan/layout/get') return { layout: state.layout, rev: state.layRev };
      if (message.type === 'houseplan/import/revalidate') {
        if (state.revalidateWait) await new Promise(resolve => { state.releaseRevalidate = resolve; });
        return { preview: state.tokens[message.token].preview, expected_config_rev: ++state.cfgRev,
          expected_layout_rev: state.layRev };
      }
      if (message.type === 'houseplan/import/apply') {
        if (state.conflict) { state.conflict = false; throw Object.assign(new Error('conflict'), { code: 'conflict' }); }
        if (state.applyWait) await new Promise(resolve => { state.releaseApply = resolve; });
        const token = state.tokens[message.token];
        state.config = structuredClone(token.document.payload.config);
        state.layout = structuredClone(token.document.payload.layout);
        state.cfgRev++; state.layRev++;
        return { kind: token.document.kind, space_id: state.config.spaces[0]?.id,
          counts: token.preview.counts };
      }
      if (/houseplan\/(config\/set|layout\/(set|update|delete))/.test(message.type)) {
        throw new Error('Unexpected write before/around import');
      }
      return original(message);
    };
    hass.fetchWithAuth = async (path, init) => {
      state.log.push({ type: 'preview', path, file: init.body.name });
      const bytes = await init.body.text();
      if (state.delay === init.body.name) await new Promise(resolve => { state.release = resolve; });
      let document;
      try { document = JSON.parse(bytes); }
      catch { return new Response(JSON.stringify({ error: 'invalid_json', message: 'Invalid JSON' }), { status: 400 }); }
      const token = init.body.name + ':' + state.log.length;
      const preview = { kind: document.kind, plan_only: document.transfer?.plan_only === true,
        source: 'foreign', created_at: document.created_at, space_title: 'Restored floor',
        counts: { spaces: document.payload.config.spaces.length, rooms: 0, markers: 0, layout: 0 },
        bindings: { device: 1, entity: 0, virtual: 0, active: 1, disabled: 0, missing: 0 },
        duplicates: 1, confirmation_required: document.smokeMissing === true, content: [] };
      state.tokens[token] = { document, preview };
      return new Response(JSON.stringify({ token, preview, expected_config_rev: state.cfgRev,
        expected_layout_rev: state.layRev }), { status: 200 });
    };
    window.emptyImportFixture = state;
    if (options.light) {
      const palette = { '--primary-text-color': '#181834', '--secondary-text-color': '#67677b',
        '--card-background-color': '#ffffff', '--ha-card-background': '#ffffff', '--divider-color': '#e5e5ec' };
      for (const [key, value] of Object.entries(palette)) document.documentElement.style.setProperty(key, value);
    }
    window.notifyImportConfig = () => {
      let rev;
      do { rev = window.__pushServerConfig(state.config); } while (rev <= window.__card._cfgRev);
      state.cfgRev = rev;
    };
    window.importHass = hass;
    if (options.panel) {
      await import('/assets/houseplan-panel.js');
      const panel = document.createElement('houseplan-panel');
      panel.hass = hass;
      document.querySelector('#host').append(panel);
      window.__card = panel.shadowRoot.querySelector('houseplan-card');
    } else {
      await import('/assets/houseplan-card.js');
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', kiosk: !!options.kiosk,
        ...(options.fixed ? { floor: 'missing' } : {}) });
      card.hass = hass;
      document.querySelector('#host').append(card);
      window.__card = card;
    }
    document.querySelector('#host').style.cssText = 'width:100%;padding:0;margin:0';
  }, options);
  if (options.loading || options.unavailable) {
    await page.waitForFunction(() => window.__card?.renderRoot?.querySelector('ha-card'));
    return { ...s, requests };
  }
  await page.waitForFunction(() => window.__card?._loadOk);
  // Existing auto-onboarding stays intact; close it exactly as the user does.
  if (!options.kiosk && options.writer !== false && !options.fixed) {
    await page.locator('hp-dialog').waitFor();
    await page.locator('hp-dialog .btn[data-hp="dialog-cancel"]').click();
    await page.locator('hp-dialog').waitFor({ state: 'detached' });
  }
  return { ...s, requests };
}

const importButton = page => page.locator('[data-hp="import-backup"]');
const dialog = page => page.locator('hp-dialog[data-kind="backup"]');
async function choose(page, document, name = 'backup.json', key = false) {
  const chooser = page.waitForEvent('filechooser');
  if (key) { await importButton(page).focus(); await page.keyboard.press('Enter'); }
  else await importButton(page).click();
  const selected = await chooser;
  await selected.setFiles(file(document, name));
}
const previews = page => page.evaluate(() => window.emptyImportFixture.log.filter(m => m.type === 'preview').length);
const applies = page => page.evaluate(() => window.emptyImportFixture.log.filter(m => m.type === 'houseplan/import/apply').length);
async function ready(page) {
  await dialog(page).locator('[data-hp="dialog-confirm"]').waitFor();
  await page.waitForFunction(() => window.__card._backupImportDialog?.busy === false);
}
async function cancel(page) {
  await dialog(page).locator('.btn[data-hp="dialog-cancel"]').click();
  await dialog(page).waitFor({ state: 'detached' });
}

try {
  const cold = await start();
  out.coldViewDoesNotLoadEditor = !cold.requests.some(url => url.includes(runtime));
  assert.equal(await importButton(cold.page).count(), 1);
  await choose(cold.page, fixture(), 'same.json', true);
  await ready(cold.page);
  out.coldFirstEnterPreview = await dialog(cold.page).locator('.backupfile').innerText();
  assert.match(out.coldFirstEnterPreview, /same.json/);
  assert.equal(await applies(cold.page), 0);
  assert.equal(await dialog(cold.page).count(), 1);
  await cancel(cold.page);
  assert.equal(await importButton(cold.page).evaluate(el => el.matches(':focus')), true);
  await choose(cold.page, fixture(), 'same.json'); await ready(cold.page); await cancel(cold.page);
  assert.equal(await previews(cold.page), 2);
  const chooser = cold.page.waitForEvent('filechooser');
  await importButton(cold.page).click(); await (await chooser).setFiles([]);
  assert.equal(await dialog(cold.page).count(), 0);
  await choose(cold.page, '{bad json');
  await dialog(cold.page).locator('.backuperror').waitFor(); await cancel(cold.page);
  out.cancelRetryAndInvalid = true;

  await cold.page.evaluate(() => { window.emptyImportFixture.delay = 'A.json'; });
  await choose(cold.page, fixture(), 'A.json'); await dialog(cold.page).waitFor();
  await cold.page.waitForFunction(() => !!window.emptyImportFixture.release);
  await cancel(cold.page);
  await choose(cold.page, fixture(), 'B.json'); await ready(cold.page);
  const newToken = await cold.page.evaluate(() => window.__card._backupImportDialog.token);
  await cold.page.evaluate(() => window.emptyImportFixture.release());
  await cold.page.evaluate(() => window.__hpTest.settled());
  assert.equal(await cold.page.evaluate(() => window.__card._backupImportDialog.token), newToken);
  assert.match(await dialog(cold.page).locator('.backupfile').innerText(), /B.json/);
  await cancel(cold.page);
  out.cancelledPreviewCannotReplaceB = true;

  await cold.page.evaluate(() => { window.emptyImportFixture.delay = 'errorA.json'; });
  await choose(cold.page, '{bad json', 'errorA.json');
  await cold.page.waitForFunction(() => !!window.emptyImportFixture.release);
  await dialog(cold.page).locator('.close[data-hp="dialog-cancel"]').click();
  await choose(cold.page, fixture(), 'errorB.json'); await ready(cold.page);
  await cold.page.evaluate(() => window.emptyImportFixture.release());
  await cold.page.evaluate(() => window.__hpTest.settled());
  assert.equal(await dialog(cold.page).locator('.backuperror').count(), 0);
  assert.match(await dialog(cold.page).locator('.backupfile').innerText(), /errorB.json/);
  await cancel(cold.page);
  out.cancelledErrorCannotReplaceB = true;

  for (const [kind, options] of [['full', {}], ['space', {}], ['space', { planOnly: true }], ['full', { empty: true }]]) {
    const s = await start({ panel: kind === 'full' && !options.empty });
    await choose(s.page, fixture(kind, options)); await ready(s.page);
    if (options.planOnly) assert.equal(await dialog(s.page).locator('.backupplanonlystatus').count(), 1);
    await dialog(s.page).locator('[data-hp="dialog-confirm"]').click();
    await dialog(s.page).waitFor({ state: 'detached' });
    assert.equal(await applies(s.page), 1);
    assert.equal(await s.page.evaluate(() => window.__card._mode), 'view');
    assert.equal(await s.page.evaluate(() => window.__card._serverCfg.spaces.length), options.empty ? 0 : 1);
    if (options.empty) assert.equal(await importButton(s.page).count(), 1);
    else {
      assert.equal(await s.page.evaluate(() => window.__card._space), 'restored');
      // Warm empty via real server-event fixture, not by mutating card state.
      await s.page.evaluate(async () => {
        window.emptyImportFixture.config.spaces = [];
        window.notifyImportConfig();
      });
      await importButton(s.page).waitFor();
    }
  }
  out.fullSpacePlanOnlyEmptyAndWarm = true;

  const missing = await start();
  await choose(missing.page, fixture('full', { missing: true })); await ready(missing.page);
  const confirm = dialog(missing.page).locator('[data-hp="dialog-confirm"]');
  assert.equal(await confirm.isDisabled(), true);
  assert.equal(await applies(missing.page), 0);
  await dialog(missing.page).locator('.backupconfirm input').check();
  await missing.page.evaluate(() => { window.emptyImportFixture.conflict = true; });
  await confirm.click();
  await missing.page.waitForFunction(() => window.emptyImportFixture.log.some(m => m.type === 'houseplan/import/revalidate'));
  await missing.page.waitForFunction(() => !window.__card._backupImportDialog.busy);
  assert.equal(await confirm.isDisabled(), true, 'conflict clears confirmation');
  assert.equal(await applies(missing.page), 1);
  await cancel(missing.page);
  out.missingConfirmationAndConflict = true;

  const policy = await start(); await choose(policy.page, fixture('space')); await ready(policy.page);
  await policy.page.evaluate(() => { window.emptyImportFixture.revalidateWait = true; });
  await dialog(policy.page).locator('input[name="duplicate-policy"]').nth(1).check();
  await policy.page.waitForFunction(() => !!window.emptyImportFixture.releaseRevalidate);
  assert.equal(await applies(policy.page), 0);
  await cancel(policy.page);
  await choose(policy.page, fixture('full'), 'policyB.json'); await ready(policy.page);
  await policy.page.evaluate(() => window.emptyImportFixture.releaseRevalidate());
  await policy.page.evaluate(() => window.__hpTest.settled());
  assert.equal(await policy.page.evaluate(() => window.__card._backupImportDialog.preview.kind), 'full');
  await cancel(policy.page);
  out.duplicateRevalidateCannotReplaceB = true;

  const busy = await start(); await choose(busy.page, fixture()); await ready(busy.page);
  await busy.page.evaluate(() => { window.emptyImportFixture.applyWait = true; });
  // Two activation events before Lit paints disabled must still send one transaction.
  await dialog(busy.page).locator('[data-hp="dialog-confirm"]').evaluate(el => { el.click(); el.click(); });
  await busy.page.waitForFunction(() => !!window.emptyImportFixture.releaseApply);
  assert.equal(await applies(busy.page), 1);
  assert.equal(await dialog(busy.page).locator('[data-hp="dialog-confirm"]').isDisabled(), true);
  // Close after Apply does not cancel that transaction or mutate the replacement dialog.
  await cancel(busy.page);
  await choose(busy.page, fixture(), 'new-after-apply.json'); await ready(busy.page);
  const tokenAfterApply = await busy.page.evaluate(() => window.__card._backupImportDialog.token);
  await busy.page.evaluate(() => window.emptyImportFixture.releaseApply());
  await busy.page.evaluate(() => window.__hpTest.settled());
  assert.equal(await busy.page.evaluate(() => window.__card._backupImportDialog.token), tokenAfterApply);
  await cancel(busy.page);
  out.busyAndLateApply = true;

  const detached = await start();
  await detached.page.evaluate(() => { window.emptyImportFixture.delay = 'detached.json'; });
  await choose(detached.page, fixture(), 'detached.json');
  await detached.page.waitForFunction(() => !!window.emptyImportFixture.release);
  await detached.page.evaluate(() => { window.__card.remove(); window.emptyImportFixture.release(); });
  await detached.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  assert.equal(await detached.page.evaluate(() => window.__card._backupImportDialog), null);
  await detached.page.evaluate(() => document.querySelector('#host').append(window.__card));
  await importButton(detached.page).waitFor();
  assert.equal(await dialog(detached.page).count(), 0);
  out.disconnectedResponseIgnored = true;

  const lost = await start(); await choose(lost.page, fixture()); await ready(lost.page);
  await lost.page.evaluate(async () => {
    window.emptyImportFixture.writer = false;
    // Deliver the actual advertised can_write revocation through an HA config reload.
    window.notifyImportConfig();
    window.__card.hass = { ...window.importHass, states: { ...window.importHass.states } };
  });
  await lost.page.waitForFunction(() => !window.__card._canImportBackup);
  assert.equal(await dialog(lost.page).locator('[data-hp="dialog-confirm"]').isDisabled(), true);
  assert.equal(await applies(lost.page), 0); await cancel(lost.page);
  for (const options of [{ writer: false }, { writer: false, admin: false }, { kiosk: true },
    { fixed: true }, { loading: true }, { unavailable: true }]) {
    const s = await start(options); assert.equal(await importButton(s.page).count(), 0);
  }
  const normal = await start({ admin: false }); assert.equal(await importButton(normal.page).count(), 1);
  out.accessAndLostRights = true;

  for (const [locale, text] of Object.entries({ en: 'Import backup', ru: 'Импорт резервной копии',
    de: 'Sicherung importieren', fr: 'Importer une sauvegarde' })) {
    for (const light of [false, true]) {
    const s = await start({ width: 360, locale, light });
    assert.equal((await importButton(s.page).innerText()).trim(), text);
    assert.equal(await importButton(s.page).evaluate(el => el.getBoundingClientRect().height >= 44), true);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await choose(s.page, fixture()); await ready(s.page);
    assert.equal(await dialog(s.page).evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.equal(await dialog(s.page).locator('.backupbody').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await cancel(s.page);
    }
  }
  out.localesAndNarrow = true;

  const coldRevoked = await start();
  let releaseChunk;
  let chunkRequested;
  const requestedChunk = new Promise(resolve => { chunkRequested = resolve; });
  await coldRevoked.page.route(`**/${runtime.split('/').at(-1)}*`, async r => {
    chunkRequested();
    await new Promise(resolve => { releaseChunk = resolve; });
    await r.fulfill({ status: 200, contentType: 'application/javascript',
      body: readFileSync(`demo/srv/assets/${runtime}`) });
  });
  await choose(coldRevoked.page, fixture()); await requestedChunk;
  await coldRevoked.page.evaluate(() => { window.emptyImportFixture.writer = false; window.notifyImportConfig(); });
  await coldRevoked.page.waitForFunction(() => !window.__card._canImportBackup);
  releaseChunk();
  await coldRevoked.page.waitForFunction(() => !!window.__card._editorRuntime);
  await coldRevoked.page.evaluate(() => window.__hpTest.settled());
  assert.equal(await previews(coldRevoked.page), 0);
  assert.equal(await dialog(coldRevoked.page).count(), 0);
  out.revokedDuringLazyNoUpload = true;

  const failure = await start();
  await failure.page.route(`**/${runtime.split('/').at(-1)}*`, r => r.abort());
  await choose(failure.page, fixture());
  await failure.page.locator('[data-hp="toast"]').waitFor();
  assert.equal(await previews(failure.page), 0);
  await failure.page.unroute(`**/${runtime.split('/').at(-1)}*`);
  await choose(failure.page, fixture()); await ready(failure.page); await cancel(failure.page);
  out.lazyFailureRetry = true;
  assert.equal(out.coldViewDoesNotLoadEditor, true);
  await finish(cold.browser, out);
} finally {
  await Promise.all(sessions.map(s => s.browser.close()));
}
