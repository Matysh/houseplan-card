// #988: genuine pinned HA picker in the real marker form; synthetic home only.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium, expect } from 'playwright/test';
import { createLabServer } from './server.mjs';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';

const { values } = parseArgs({ options: { 'ha-cache': { type: 'string' } } });
const server = createLabServer({ port: 0, ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}) });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const output = new URL('../../artifacts/icon-picker-988/', import.meta.url);
mkdirSync(output, { recursive: true });
const errors = [], external = [], results = [];
try {
  const attestation = await attestLaunchedBrowser(browser, { reason: '#988 authentic HA icon picker' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    external.push(url.origin + url.pathname); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__lab?.card?._devices?.length > 0);
  await assertFreshDemoBundle(page);
  // Load the official pinned factory, never a substitute picker. UI Lab's
  // verified runtime index supplies its dependencies without starting HA auth.
  await page.evaluate(async () => {
    const require = window.__hpHaRequire, index = await (await fetch('/ha-modules.json')).json();
    const visited = new Set(), loaded = new Set();
    async function prepare(id) {
      if (visited.has(id)) return; visited.add(id);
      const item = index[id];
      if (!item) { if (!require.m[id]) throw Error(`Missing official HA module ${id}`); return; }
      if (!require.m[id] && !loaded.has(item.file)) {
        const chunk = await import(`/frontend_latest/${item.file}`);
        Object.assign(require.m, chunk.__webpack_modules__); chunk.__rspack_esm_runtime?.(require); loaded.add(item.file);
      }
      for (const dependency of item.dependencies) await prepare(dependency);
    }
    await prepare('53214'); await require('53214');
    await customElements.whenDefined('ha-icon-picker');
  });
  const shell = () => page.locator('hp-dialog[data-kind="marker"]');
  const picker = () => shell().locator('ha-icon-picker');
  const trigger = () => picker().locator('ha-picker-field button#item');
  const popup = () => picker().locator('wa-popover');
  const selectIcon = async icon => {
    await trigger().click();
    await picker().locator('ha-picker-combo-box input').fill(icon);
    // Wait for the actual filtered candidate, not the debounced input alone.
    await picker().locator('ha-picker-combo-box ha-combo-box-item')
      .filter({ hasText: new RegExp(`^\\s*${icon}\\s*$`) }).first().click();
    await expect(picker().locator('wa-popover[open]')).toHaveCount(0);
    await expect(shell()).toBeVisible();
    await expect(picker()).toHaveJSProperty('value', icon);
  };
  const open = async () => {
    await page.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
    await page.waitForFunction(() => window.__lab.card.shadowRoot.querySelector('ha-card')?.getAttribute('data-hp-mode') === 'devices');
    await page.locator('[data-hp="device"][data-id="lab_ceiling"]').dblclick();
    await expect(shell()).toBeVisible();
    await shell().locator('[data-section-target="appearance"]').click();
  };
  const check = async (name, run) => { await run(); results.push(name); console.log(`PASS ${name}`); };

  await open();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.documentElement.dataset.theme = theme;
      window.__lab.mock.setDarkMode(theme === 'dark');
    }, theme);
    for (const method of ['mouse', 'keyboard']) {
      await check(`single focus owner: ${theme}/${method}`, async () => {
        if (method === 'mouse') {
          await trigger().click(); await expect(popup()).toHaveAttribute('open', '');
          await page.keyboard.press('Escape'); await expect(picker().locator('wa-popover[open]')).toHaveCount(0);
        } else { await trigger().focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); }
        await expect(shell()).toBeVisible();
        await expect(trigger()).toBeFocused();
        const paint = await picker().evaluate(picker => {
          const wrapper = getComputedStyle(picker.parentElement);
          let active = document.activeElement;
          while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
          return { wrapperBorder: wrapper.borderTopColor, wrapperOutline: wrapper.outlineStyle,
            activeInPicker: picker.matches(':focus-within'), visibleFocus: !!active?.matches(':focus-visible') };
        });
        assert.equal(paint.wrapperBorder, 'rgba(0, 0, 0, 0)', 'no second nested wrapper border');
        assert.equal(paint.wrapperOutline, 'none', 'no second wrapper focus ring');
        assert.equal(paint.activeInPicker, true, 'focus stays inside real HA picker');
        if (method === 'keyboard') assert.equal(paint.visibleFocus, true, 'keyboard focus remains visibly indicated');
        await page.mouse.move(2, 2);
        await picker().screenshot({ path: new URL(`${theme}-${method}.png`, output).pathname });
      });
    }
  }
  await check('selection and clear retain other dirty fields; no write until Save', async () => {
    const before = await page.evaluate(() => JSON.stringify(window.__lab.mock.snapshot()));
    await shell().locator('[data-section-target="basics"]').click();
    await shell().locator('#marker-name').fill('Unsaved picker witness');
    await shell().locator('[data-section-target="appearance"]').click();
    await selectIcon('mdi:fan');
    assert.equal(await picker().evaluate(element => element.value), 'mdi:fan');
    await picker().locator('ha-icon-button.clear').click();
    await expect(shell()).toBeVisible();
    assert.equal(await page.evaluate(() => window.__lab.card._markerDialog.name), 'Unsaved picker witness');
    assert.equal(await page.evaluate(() => window.__lab.card._markerDialog.icon), '');
    assert.equal(await page.evaluate(() => JSON.stringify(window.__lab.mock.snapshot())), before);
    await selectIcon('mdi:fan');
    await shell().locator('[data-hp="dialog-confirm"]').click(); await expect(shell()).toHaveCount(0);
    await open(); assert.equal(await picker().evaluate(element => element.value), 'mdi:fan');
  });
  await check('Cancel preserves saved icon; parent close guard remains active', async () => {
    await selectIcon('mdi:lightbulb');
    await shell().locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
    const confirm = page.locator('hp-dialog[data-kind="confirm"]'); await expect(confirm).toBeVisible();
    await confirm.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
    await expect(confirm).toHaveCount(0); await expect(shell()).toBeVisible();
    assert.equal(await picker().evaluate(element => element.value), 'mdi:lightbulb');
    await page.keyboard.press('Escape'); await expect(confirm).toBeVisible();
    await confirm.locator('[slot="footer"] [data-hp="dialog-confirm"]').click(); await expect(shell()).toHaveCount(0);
    await open(); assert.equal(await picker().evaluate(element => element.value), 'mdi:fan');
    await shell().locator('button.close').click(); await expect(shell()).toHaveCount(0);
  });
  assert.deepEqual(errors, [], 'no browser exception'); assert.deepEqual(external, [], 'no external traffic');
  writeFileSync(new URL('report.json', output), JSON.stringify({ provenance: server.provenance, attestation, results }, null, 2));
  console.log(`OK #988 genuine HA: ${results.length} checks; ${server.provenance.frontendVersion}`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
