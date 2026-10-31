// #998: UI-029 on the genuine pinned HA picker; synthetic home only.
import assert from 'node:assert/strict';
import { watchPage, reportPageErrors } from '../serve.mjs';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium, expect } from 'playwright/test';
import { createLabServer } from './server.mjs';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { createForeignCssWitness } from '../helpers/foreign-css-witness.mjs';

const { values } = parseArgs({ options: { 'ha-cache': { type: 'string' } } });
const server = createLabServer({ port: 0, ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}) });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const output = new URL('../../artifacts/dialog-picker-998/', import.meta.url);
mkdirSync(output, { recursive: true });
const errors = [], external = [], results = [];
const cssWitness = createForeignCssWitness(server.provenance, undefined, ['src/editors/ha-icon-picker-kit.ts']);
try {
  const attestation = await attestLaunchedBrowser(browser, { reason: '#998 authentic HA dialog picker' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    external.push(url.origin + url.pathname); return route.abort();
  });
  const page = watchPage(await context.newPage());
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
    // HA's real host supplies global spacing/radius/WebAwesome tokens in
    // addition to theme defaults. Use the pinned official sheet, not invented
    // test CSS: without it a genuine popup can still look unstyled in the lab.
    const style = document.createElement('style');
    style.textContent = require('3184').Q;
    document.head.prepend(style);
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
  await cssWitness.observe(picker());
  await check('UI-029 shared trigger dimensions and triangle', async () => {
    const geometry = await picker().evaluate(picker => {
      const root = picker.shadowRoot.querySelector('ha-generic-picker').shadowRoot;
      const field = root.querySelector('ha-picker-field').shadowRoot;
      const item = field.querySelector('ha-combo-box-item');
      const ordinary = picker.closest('hp-dialog').querySelector('hp-settings-select:has(#marker-display)').shadowRoot.querySelector('button');
      return { icon: item.getBoundingClientRect().height, ordinary: ordinary.getBoundingClientRect().height,
        arrow: field.querySelector('.arrow').path, radius: getComputedStyle(item).borderTopLeftRadius };
    });
    assert.equal(geometry.icon, 44); assert.equal(geometry.ordinary, 44);
    assert.equal(geometry.radius, '8px'); assert.equal(geometry.arrow, 'm7 10 5 5 5-5z');
  });
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
          const outer = getComputedStyle(picker.closest('.hpf-iconfield'));
          const field = picker.shadowRoot.querySelector('ha-generic-picker').shadowRoot.querySelector('ha-picker-field');
          const item = field.shadowRoot.querySelector('ha-combo-box-item');
          const native = getComputedStyle(item), line = getComputedStyle(item, '::after');
          let active = document.activeElement;
          while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
          return { wrapperBorder: wrapper.borderTopColor, wrapperOutline: wrapper.outlineStyle,
            outerOutline: outer.outlineStyle, fieldBackground: native.backgroundColor,
            lineDisplay: line.display, fieldBorder: native.borderTopWidth, fieldRadius: native.borderTopLeftRadius,
            activeInPicker: picker.matches(':focus-within'), visibleFocus: !!active?.matches(':focus-visible') };
        });
        console.log('field paint', theme, method, paint);
        assert.equal(paint.fieldBorder, '1px', 'one themed field border');
        assert.equal(paint.wrapperOutline, 'none', 'no second wrapper focus ring');
        assert.equal(paint.outerOutline, 'none', 'outer icon row must not add a second focus ring');
        assert.notEqual(paint.fieldBackground, 'rgba(0, 0, 0, 0)', 'native field retains its themed fill');
        assert.equal(paint.lineDisplay, 'none', 'no second native underline');
        assert.equal(paint.fieldRadius, '8px', 'accepted UI-029 field radius');
        assert.equal(paint.activeInPicker, true, 'focus stays inside real HA picker');
        if (method === 'keyboard') assert.equal(paint.visibleFocus, true, 'keyboard focus remains visibly indicated');
        await page.mouse.move(2, 2);
        await picker().screenshot({ path: new URL(`${theme}-${method}.png`, output).pathname });
      });
    }
    await check(`styled popup: ${theme}`, async () => {
      await trigger().click();
      const search = picker().locator('ha-picker-combo-box input');
      await expect(search).toHaveAttribute('placeholder', 'Поиск');
      const measureSizes = () => picker().evaluate(picker => {
        const generic = picker.shadowRoot.querySelector('ha-generic-picker').shadowRoot;
        const popup = generic.querySelector('wa-popover');
        const combo = generic.querySelector('ha-picker-combo-box');
        const input = combo.shadowRoot.querySelector('ha-input-search');
        const find = root => {
          for (const node of root.querySelectorAll('*')) {
            if (node.getAttribute('part')?.split(' ').includes('base')) return node;
            if (node.shadowRoot) { const found = find(node.shadowRoot); if (found) return found; }
          }
        };
        return { distance: popup.distance, searchHeight: find(input.shadowRoot)?.getBoundingClientRect().height };
      });
      await expect.poll(async () => Math.abs((await measureSizes()).searchHeight - 44)).toBeLessThan(.1);
      assert.equal((await measureSizes()).distance, 7);
      await cssWitness.observe(picker());
      await picker().locator('ha-picker-combo-box input').fill('mdi:fan');
      await expect(picker().locator('ha-picker-combo-box ha-combo-box-item').filter({ hasText: /^\s*mdi:fan\s*$/ }).first()).toBeVisible();
      await search.press('ArrowDown');
      await expect(picker().locator('ha-picker-combo-box .combo-box-row.selected').first()).toBeVisible();
      await cssWitness.observe(picker());
      const paint = await popup().evaluate(popover => {
        const body = getComputedStyle(popover.shadowRoot.querySelector('[part="body"]'));
        return { background: body.backgroundColor, borderColor: body.borderTopColor,
          borderWidth: parseFloat(body.borderTopWidth), radius: parseFloat(body.borderTopLeftRadius), shadow: body.boxShadow };
      });
      console.log('popup paint', theme, paint);
      await page.screenshot({ path: new URL(`${theme}-popup.png`, output).pathname });
      assert.notEqual(paint.background, 'rgba(0, 0, 0, 0)', 'popup has an opaque themed surface');
      assert.ok(paint.borderWidth <= 1, 'popup does not add a heavy nested frame');
      assert.ok(paint.radius >= 7, 'popup has the dialog control rounding');
      assert.notEqual(paint.shadow, 'none', 'popup is separated from fields underneath');
      await page.keyboard.press('Escape'); await expect(shell()).toBeVisible();
    });
  }
  for (const viewport of [{width:390,height:844},{width:1280,height:450}]) {
    await page.setViewportSize(viewport);
    await check(`native adaptive picker ${viewport.width}x${viewport.height}`, async () => {
      await trigger().click();
      const combo = picker().locator('ha-picker-combo-box');
      await expect(combo).toBeVisible();
      await expect(combo.locator('input')).toHaveAttribute('placeholder', 'Поиск');
      await combo.locator('input').fill('mdi:fan');
      const option = combo.locator('ha-combo-box-item').filter({hasText:/^\s*mdi:fan\s*$/}).first();
      await expect(option).toBeVisible();
      assert.equal(await picker().locator('ha-bottom-sheet').count(), 1, 'native HA adaptive bottom sheet');
      const overflow = await combo.evaluate(el => el.getBoundingClientRect().right > innerWidth + 1 || el.getBoundingClientRect().left < -1);
      assert.equal(overflow, false);
      await page.screenshot({path:new URL(`adaptive-${viewport.width}x${viewport.height}.png`,output).pathname});
      await page.keyboard.press('Escape'); await expect(shell()).toBeVisible();
      await expect(combo).not.toBeVisible();
      await expect(trigger()).toBeFocused();
      await trigger().click();
      await picker().locator('ha-picker-combo-box input').fill('custom:example_houseplan_998');
      const custom=picker().locator('ha-picker-combo-box ha-combo-box-item').filter({hasText:'custom:example_houseplan_998'}).last();
      await expect(custom).toBeVisible();await cssWitness.observe(picker());
      await custom.click();
      await expect(picker()).toHaveJSProperty('value','custom:example_houseplan_998');
      await expect(trigger()).toBeFocused();
    });
  }
  await page.setViewportSize({width:1280,height:1000});
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
  assert.equal(await reportPageErrors(), false, 'no late browser exception');
  assert.deepEqual(errors, [], 'no browser exception'); assert.deepEqual(external, [], 'no external traffic');
  const foreignCss = cssWitness.assertComplete();
  writeFileSync(new URL('report.json', output), JSON.stringify({ provenance: server.provenance, attestation, results, foreignCss }, null, 2));
  console.log(`OK #998 genuine HA: ${results.length} checks; ${server.provenance.frontendVersion}`);
} finally { await reportPageErrors(); await browser.close(); await reportPageErrors(); await new Promise(resolve => server.close(resolve)); }
