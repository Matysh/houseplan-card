#!/usr/bin/env node
// #964: exercise the reusable lab, not a substitute implementation of the card.
// This starts an isolated loopback server and a new browser profile. It never
// connects to the running owner's lab or changes a fixture/override on disk.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import { chromium, expect } from 'playwright/test';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { createLabServer } from './server.mjs';

const { values } = parseArgs({ options: { 'ha-cache': { type: 'string' } } });
const server = await createLabServer({
  port: 0,
  ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}),
});
let browser;
let page;
const errors = [];
const external = [];
const checks = [];
let failed = false;

async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  await attestLaunchedBrowser(browser, { reason: 'UI Lab smoke #964' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'Europe/Moscow',
    acceptDownloads: true,
  });
  // Fail closed even if the lab's own transport guard regresses. A test must
  // never contact a real HA instance (nor any other external endpoint).
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    external.push(`${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = () => page.waitForFunction(() => window.__lab?.card?._devices?.length > 0);
  const settings = () => page.locator('hp-dialog[data-kind="settings"]');
  const field = () => settings().locator('#gs-show-lqi');
  const openSettings = async () => {
    await page.locator('[data-hp="settings"]').click();
    await expect(settings()).toBeVisible();
  };
  const closeSettings = async () => {
    await settings().getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(settings()).toHaveCount(0);
  };
  const openLab = async () => {
    if (!(await page.locator('#lab-tools').isVisible())) await page.locator('#lab-launcher').click();
    await expect(page.locator('#lab-tools')).toBeVisible();
  };
  const closeLab = async () => {
    if (await page.locator('#lab-tools').isVisible()) await page.locator('#lab-close').click();
  };

  await check('real product and pinned HA components load with synthetic data', async () => {
    await page.goto(origin);
    await ready();
    await assertFreshDemoBundle(page);
    const fixture = await (await context.request.get(`${origin}/fixture.json`)).json();
    await expect(page.locator('[data-hp="space-tab"]')).toHaveCount(fixture.config.spaces.length);
    await expect(page.locator('[data-hp="device"]').first()).toBeVisible();
    await openSettings();
    assert.equal(await page.evaluate(() => Boolean(customElements.get('ha-dialog'))), true);
    await expect(settings().locator('ha-dialog')).toHaveAttribute('open', '');
    await expect(settings().locator('ha-dialog dialog')).toBeVisible();
    assert.ok(await settings().locator('input').count(), 'real settings inputs are present');
    await closeSettings();
  });

  await check('theme and locale controls affect the actual card', async () => {
    await openLab();
    await page.locator('#lab-theme').selectOption('dark');
    await page.waitForFunction(() => window.__lab.mock.hass.themes.darkMode === true);
    await Promise.all([page.waitForEvent('load'), page.locator('#lab-language').selectOption('en')]);
    await ready();
    await page.waitForFunction(() => window.__lab.mock.hass.language === 'en');
    await expect(page.locator('[data-hp="mode-tab"][data-mode="plan"]')).toContainText('Plan editor');
    await openLab();
    await page.locator('#lab-theme').selectOption('light');
    await page.waitForFunction(() => window.__lab.mock.hass.themes.darkMode === false);
    for (const language of ['de', 'fr', 'ru']) {
      await openLab();
      await Promise.all([page.waitForEvent('load'), page.locator('#lab-language').selectOption(language)]);
      await ready();
      await page.waitForFunction((expected) => window.__lab.mock.hass.language === expected, language);
      await expect(page.locator('[data-hp="device"]').first()).toBeVisible();
    }
    await closeLab();
  });

  let savedChecked;
  await check('settings save is local and survives a document reload', async () => {
    await openSettings();
    savedChecked = !(await field().isChecked());
    await field().setChecked(savedChecked);
    await settings().getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(settings()).toHaveCount(0);
    await page.reload();
    await ready();
    await openSettings();
    await expect(field()).toBeChecked({ checked: savedChecked });
    await closeSettings();
  });

  await check('device tap changes only the local mock state and persists', async () => {
    const before = await page.evaluate(() => window.__lab.mock.hass.states['light.lab_ceiling'].state);
    await page.locator('[data-hp="device"][data-id="lab_ceiling"]').click();
    await page.waitForFunction((old) => window.__lab.mock.hass.states['light.lab_ceiling'].state !== old, before);
    const after = await page.evaluate(() => window.__lab.mock.hass.states['light.lab_ceiling'].state);
    await page.reload();
    await ready();
    assert.equal(await page.evaluate(() => window.__lab.mock.hass.states['light.lab_ceiling'].state), after);
  });

  await check('all three real editors enter and return to View', async () => {
    for (const [mode, kind] of [['plan', 'plan'], ['devices', 'device'], ['decor', 'decor']]) {
      await page.locator(`[data-hp="mode-tab"][data-mode="${mode}"]`).click();
      await expect(page.locator(`[data-hp="toolbar"][data-kind="${kind}"]`)).toBeVisible();
      await page.locator('[data-hp="editor-close"]').first().click();
      await expect(page.locator('ha-card[data-hp-mode="view"]')).toBeVisible();
      await expect(page.locator(`[data-hp="toolbar"][data-kind="${kind}"]`)).toBeHidden();
    }
  });

  await check('device, room and summary shortcuts open real interactive dialogs', async () => {
    const shortcut = async (kind) => {
      await openLab();
      await page.locator(`[data-open="${kind}"]`).click();
    };
    const closeDialog = async (kind, discard = false) => {
      const dialog = page.locator(`hp-dialog[data-kind="${kind}"]`);
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
      if (discard) await page.getByRole('button', { name: 'Не сохранять', exact: true }).click();
      await expect(dialog).toHaveCount(0);
    };
    const leaveEditor = async () => {
      await page.locator('[data-hp="editor-close"]').first().click();
      await expect(page.locator('ha-card[data-hp-mode="view"]')).toBeVisible();
    };
    await shortcut('device');
    const marker = page.locator('hp-dialog[data-kind="marker"]');
    await expect(marker).toBeVisible();
    await expect(marker.locator('#marker-name')).toBeVisible();
    const select = marker.locator('#marker-room');
    const original = await select.inputValue();
    const options = await select.locator('option').evaluateAll((items) => items.map((item) => ({
      value: item.value, label: item.label, disabled: item.disabled,
    })));
    const alternate = options.find((option) => !option.disabled && option.value !== original);
    assert.ok(alternate, 'synthetic device has another selectable room');
    const picker = marker.locator('hp-settings-select:has(#marker-room)');
    for (const option of [alternate, options.find((item) => item.value === original)]) {
      await picker.getByRole('button').click();
      await page.getByRole('option', { name: option.label, exact: true }).click();
      await expect(select).toHaveValue(option.value);
    }
    await closeDialog('marker', true);
    await leaveEditor();
    await shortcut('room');
    await expect(page.locator('hp-dialog[data-kind="room"]')).toBeVisible();
    await expect(page.locator('hp-dialog[data-kind="room"] input').first()).toBeVisible();
    await closeDialog('room');
    await leaveEditor();
    await shortcut('summary');
    await expect(page.locator('hp-dialog[data-kind="summary"]')).toBeVisible();
    await expect(page.locator('#summary-panel-title')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('hp-dialog[data-kind="summary"]')).toHaveCount(0);
  });

  await check('CSS hot reload preserves the open real dialog and its unsaved draft', async () => {
    await openSettings();
    const original = await field().isChecked();
    await field().setChecked(!original);
    let css = ':host { --ui-lab-smoke-revision: one; }';
    const route = (request) => request.fulfill({ status: 200, contentType: 'text/css', body: css });
    await page.route('**/overrides/houseplan-card.css*', route);
    try {
      await page.waitForFunction(() => getComputedStyle(window.__lab.card).getPropertyValue('--ui-lab-smoke-revision').trim() === 'one');
      css = ':host { --ui-lab-smoke-revision: two; }';
      await page.waitForFunction(() => getComputedStyle(window.__lab.card).getPropertyValue('--ui-lab-smoke-revision').trim() === 'two');
      await expect(settings()).toBeVisible();
      await expect(field()).toBeChecked({ checked: !original });
    } finally {
      await page.unroute('**/overrides/houseplan-card.css*', route);
    }
    await field().setChecked(original);
    await closeSettings();
    await openSettings();
    await expect(field()).toBeChecked({ checked: original });
    await closeSettings();
  });

  await check('session export, confirmed reset and confirmed import round-trip locally', async () => {
    await openLab();
    const downloading = page.waitForEvent('download');
    await page.locator('#lab-export').click();
    const download = await downloading;
    const stream = await download.createReadStream();
    assert.ok(stream, 'local session download has contents');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const envelope = JSON.parse(buffer.toString('utf8'));
    assert.equal(envelope.format, 'houseplan-ui-lab/session');
    const exported = envelope.snapshot;
    assert.ok(exported.config && exported.layout && exported.states, 'export contains the editable local session');
    await page.locator('#lab-reset').click();
    await expect(page.locator('#lab-confirm-title')).toBeVisible();
    await Promise.all([page.waitForEvent('load'), page.locator('#lab-confirm-accept').click()]);
    await ready();
    await closeLab();
    await openSettings();
    await expect(field()).toBeChecked({ checked: !savedChecked });
    await closeSettings();
    await openLab();
    await page.locator('#lab-import-file').setInputFiles({ name: 'ui-lab-session.json', mimeType: 'application/json', buffer });
    await expect(page.locator('#lab-confirm-title')).toBeVisible();
    await Promise.all([page.waitForEvent('load'), page.locator('#lab-confirm-accept').click()]);
    await ready();
    await closeLab();
    await openSettings();
    await expect(field()).toBeChecked({ checked: savedChecked });
    await closeSettings();
    assert.equal(await page.evaluate(() => window.__lab.mock.hass.states['light.lab_ceiling'].state), exported.states['light.lab_ceiling'].state);
  });

  await check('normal use makes no external requests or component exceptions', async () => {
    await page.evaluate(() => 0); // deliver pending browser errors before verdict
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    const safety = await page.evaluate(() => window.__lab.safety);
    assert.deepEqual(safety.errors, []);
    assert.deepEqual(safety.blocked, []);
  });

  await check('negative transport attempts are blocked and HTTP writes rejected', async () => {
    const rejected = await page.evaluate(async () => {
      let fetchBlocked = false;
      let websocketBlocked = false;
      try { await fetch('https://ui-lab-smoke.invalid/api/'); } catch { fetchBlocked = true; }
      try { new WebSocket('wss://ui-lab-smoke.invalid/api/websocket'); } catch { websocketBlocked = true; }
      return { fetchBlocked, websocketBlocked };
    });
    assert.deepEqual(rejected, { fetchBlocked: true, websocketBlocked: true });
    assert.deepEqual(external, [], 'client guards must reject before any external request reaches the browser network');
    const response = await context.request.post(`${origin}/api/services/light/turn_on`, {
      data: { entity_id: 'light.lab_ceiling' },
    });
    assert.equal(response.status(), 405);
  });
} catch (error) {
  failed = true;
  console.error(error.stack || error);
  if (page && !page.isClosed()) {
    console.error('Lab status:', await page.locator('#loading, #lab-notice').allTextContents().catch(() => []));
  }
} finally {
  await browser?.close();
  if (server.listening) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (errors.length) {
    failed = true;
    console.error('Uncaught browser errors:', JSON.stringify(errors));
  }
  if (external.length) {
    failed = true;
    console.error('Unexpected external requests:', JSON.stringify(external));
  }
  console.log(`${failed ? 'FAIL' : 'OK'} UI Lab smoke: ${checks.length} checks passed; browser and isolated server closed.`);
  if (failed) process.exitCode = 1;
}
