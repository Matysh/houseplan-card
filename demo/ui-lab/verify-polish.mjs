// #976: real pinned HA components, synthetic home, no live HA connection.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from 'playwright/test';
import { createLabServer } from './server.mjs';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';

const { values } = parseArgs({ options: { 'ha-cache': { type: 'string' }, 'device-scale-factor': { type: 'string', default: '1' } } });
const deviceScaleFactor = Number(values['device-scale-factor']);
assert.ok([1, 1.25].includes(deviceScaleFactor), 'supported proof DPR: 1 or 1.25');
const server = createLabServer({ port: 0, ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}) });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const output = new URL('../../artifacts/ui-polish-976/', import.meta.url);
mkdirSync(output, { recursive: true });
const results = [], errors = [], external = [];
try {
  await attestLaunchedBrowser(browser, { reason: '#976 actual HA UI and lifecycle' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor, acceptDownloads: true });
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
  const previewText = '{"format":"houseplan-support-package","version":1}\n';
  await page.evaluate(({ previewText, previewSha }) => {
    const old = window.__lab.card;
    const callWS = old.hass.callWS.bind(old.hass);
    const backend = window.__polishBackend = { calls: [], saveFailure: false, submitFailure: false };
    const card = document.createElement('houseplan-card');
    for (const name of ['panel-host', 'layout', 'style']) {
      if (old.hasAttribute(name)) card.setAttribute(name, old.getAttribute(name));
    }
    card.setConfig({ ...old._config, language: 'en' });
    card.hass = { ...old.hass, callWS: async message => {
      backend.calls.push(message.type);
      if (message.type === 'houseplan/config/get') return { ...await callWS(message), support_api: 1, support_package_versions: [1] };
      if (message.type === 'houseplan/config/set' && backend.saveFailure) throw { code: 'save_failed' };
      if (message.type === 'houseplan/support/preview') return {
        text: previewText, size: new TextEncoder().encode(previewText).length,
        sha256: previewSha, token: 'a'.repeat(48), expires_in: 300,
        spaces: 2, version: 1, format: 'houseplan-support-package',
      };
      if (message.type === 'houseplan/support/submit') {
        if (backend.submitFailure) throw { code: 'support_unavailable' };
        return { report_id: 'hpr-synthetic976' };
      }
      if (message.type === 'houseplan/support/preview/discard') return { ok: true };
      return callWS(message);
    } };
    old.replaceWith(card);
    window.__lab.card = card;
  }, { previewText, previewSha: createHash('sha256').update(previewText).digest('hex') });
  await page.waitForFunction(() => window.__lab.card._devices?.length > 0);
  const check = async (name, fn) => { await fn(); results.push(name); console.log(`PASS ${name}`); };
  const dialog = kind => page.locator(`hp-dialog[data-kind="${kind}"]`);
  const close = async (shell, via = 'cancel') => {
    if (via === 'escape') await page.keyboard.press('Escape');
    else if (via === 'x') await shell.locator('button.close').click();
    else if (via === 'scrim') await page.mouse.click(2, 2);
    else await shell.locator('[data-hp="dialog-cancel"]').first().click();
    await expect(shell).toHaveCount(0);
  };
  const open = async (kind, selector = kind) => {
    await page.locator(`[data-hp="${selector}"]`).first().click();
    await expect(dialog(kind)).toBeVisible();
    // Let the ordinary entrance finish; closing observations below are framed.
    await dialog(kind).locator('dialog').evaluate(async element => {
      await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    });
    return dialog(kind);
  };
  const geometry = async shell => shell.locator('dialog').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, overflow: element.scrollWidth > element.clientWidth + 1 };
  });

  await check('UI-010: native one-click/Enter tool after Shapes, Furniture and Image', async () => {
    await page.locator('[data-hp="mode-tab"][data-mode="decor"]').click();
    const bar = page.locator('[data-hp="toolbar"][data-kind="decor"]');
    for (const menu of ['shapes', 'furniture', 'image']) {
      await bar.locator('[data-tool="select"]').click();
      await bar.locator(`[data-tool="${menu}"]`).click();
      await expect(page.locator('[data-hp="tray"]')).toBeVisible();
      await bar.locator('[data-tool="erase"]').click();
      await expect(bar.locator('[data-tool="erase"]')).toHaveClass(/\bon\b/);
    }
    await bar.locator('[data-tool="shapes"]').click();
    await bar.locator('[data-tool="erase"]').focus();
    await page.keyboard.press('Enter');
    await expect(bar.locator('[data-tool="erase"]')).toHaveClass(/\bon\b/);
    await page.locator('[data-hp="editor-close"]').first().click();
  });

  await check('UI-003/004: all Help close paths animate, retain logical focus and never flash its ring', async () => {
    for (const via of ['cancel', 'x', 'escape', 'scrim']) {
      const shell = await open('support');
      await page.evaluate(() => {
        const opener = window.__lab.card.shadowRoot.querySelector('[data-hp="support"]');
        const hp = window.__lab.card.shadowRoot.querySelector('hp-dialog[data-kind="support"]');
        const surface = hp.shadowRoot.querySelector('ha-dialog').shadowRoot.querySelector('wa-dialog').shadowRoot.querySelector('dialog');
        const state = window.__polishMotion = { frames: [], running: true, start: null };
        const record = () => {
          if (!state.running) return;
          const paint = getComputedStyle(surface), focus = getComputedStyle(opener);
          state.frames.push({ at: performance.now(), connected: hp.isConnected, opacity: paint.opacity,
            transform: paint.transform, focus: opener.matches(':focus'), outline: focus.outlineStyle });
          requestAnimationFrame(record);
        };
        hp.addEventListener('hp-close', () => { state.start = performance.now(); }, { once: true });
        requestAnimationFrame(record);
      });
      await close(shell, via);
      const trace = await page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.__polishMotion.running = false;
        return window.__polishMotion;
      });
      const exit = trace.frames.filter(frame => frame.at >= trace.start);
      assert.ok(exit.some(frame => frame.connected && (Number(frame.opacity) < 1 || frame.transform !== 'none')), `${via}: no visible exit phase`);
      assert.ok(exit.some(frame => !frame.connected && frame.focus), `${via}: opener not restored`);
      assert.ok(exit.filter(frame => frame.focus).every(frame => frame.outline === 'none'), `${via}: return-focus ring flashed`);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-hp="support"]').evaluate(element => element.classList.contains('hp-dialog-return-focus')), false);
      assert.equal(await page.evaluate(() => {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active?.matches(':focus-visible');
      }), true, 'next deliberate Tab must restore normal visible focus');
    }
  });

  await check('UI-003: dirty Continue preserves the same live form; Discard closes both shells', async () => {
    const shell = await open('settings');
    const input = shell.locator('#gs-show-lqi');
    const before = await input.isChecked();
    await input.setChecked(!before);
    await page.keyboard.press('Escape');
    const confirm = dialog('confirm');
    await expect(confirm).toBeVisible();
    await confirm.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
    await expect(confirm).toHaveCount(0);
    await expect(shell).toBeVisible();
    await expect(input).toBeChecked({ checked: !before });
    // Mouse dismissal must restore the last field, not the footer trigger.
    await shell.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
    await dialog('confirm').locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
    await expect(dialog('confirm')).toHaveCount(0);
    await expect(input).toBeFocused();
    await input.setChecked(before);
    await close(shell);
    const second = await open('settings');
    await second.locator('#gs-show-lqi').setChecked(!before);
    await page.keyboard.press('Escape');
    await dialog('confirm').locator('[data-hp="dialog-confirm"]').click();
    await expect(dialog('confirm')).toHaveCount(0);
    await expect(second).toHaveCount(0);
  });

  await check('UI-003: reduced-motion adds no exit frames or delay', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const shell = await open('support');
    const retained = await shell.evaluate(async hp => {
      hp.shadowRoot.querySelector('button.close').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      return hp.isConnected;
    });
    assert.equal(retained, false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await check('UI-002: real support validation, one field contour, preview, send error and success', async () => {
    const shell = await open('support');
    const message = shell.locator('.supportmessage');
    await message.fill('Synthetic UI-976 report');
    await message.focus();
    const contour = await message.evaluate(element => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, shadow: style.boxShadow, border: style.borderTopWidth,
        minHeight:style.minHeight };
    });
    assert.equal(contour.outline, 'none');
    assert.ok(contour.shadow.includes('inset'));
    assert.equal(contour.border, '1px');
    assert.equal(contour.minHeight, '120px');
    await shell.locator('.supportattach input').check();
    await expect(shell.locator('.supportpreview')).toBeVisible();
    await shell.locator('.supportpreview summary').click();
    await expect(shell.locator('.supportraw')).toHaveValue(previewText);
    assert.deepEqual(await shell.locator('.supportraw').evaluate(element => {
      const style=getComputedStyle(element);
      return { minHeight:style.minHeight, monospace:style.fontFamily.includes('monospace') };
    }), { minHeight:'220px', monospace:true });
    await page.evaluate(() => { window.__polishBackend.submitFailure = true; });
    await shell.locator('[data-hp="dialog-confirm"]').click();
    await expect(shell.locator('.supporterror')).toBeVisible();
    await expect(message).toHaveValue('Synthetic UI-976 report');
    await page.evaluate(() => { window.__polishBackend.submitFailure = false; });
    await shell.locator('[data-hp="dialog-confirm"]').click();
    await expect(shell.locator('.supportsuccess')).toBeVisible();
    await close(shell);
  });

  await check('UI-009: real rules buttons support Enter/Space, reorder, deletion and Cancel', async () => {
    await page.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
    const shell = await open('rules', 'tool"][data-tool="icon-rules');
    const rows = shell.locator('.rrow');
    const original = await rows.locator('.rpat').evaluateAll(elements => elements.map(input => input.value));
    assert.ok(original.length > 1);
    await rows.first().getByRole('button', { name: 'Down', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(rows.nth(1).locator('.rpat')).toHaveValue(original[0]);
    await rows.nth(1).getByRole('button', { name: 'Up', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(rows.first().locator('.rpat')).toHaveValue(original[0]);
    await rows.first().getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(rows).toHaveCount(original.length - 1);
    await close(shell);
    const reopened = await open('rules', 'tool"][data-tool="icon-rules');
    assert.deepEqual(await reopened.locator('.rpat').evaluateAll(elements => elements.map(input => input.value)), original);
    await close(reopened);
  });

  await check('UI-009: Devices search, tabs, space filter and unclipped row menu', async () => {
    const shell = await open('device-inbox', 'tool"][data-tool="device-inbox');
    const search = shell.locator('.device-inbox-search');
    await search.fill('no-device-matches-976');
    await expect(shell.locator('.device-inbox-row')).toHaveCount(0);
    await search.fill('');
    await expect(shell.locator('.device-inbox-row').first()).toBeVisible();
    const filter = shell.locator('.device-inbox-space-filter select');
    const choices = await filter.locator('option').evaluateAll(elements => elements.map(option => option.value));
    await filter.selectOption(choices[1]);
    await expect(filter).toHaveValue(choices[1]);
    await filter.selectOption('');
    await shell.getByRole('tab').nth(1).click();
    await expect(shell.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await shell.getByRole('tab').first().click();
    const menu = shell.locator('.device-inbox-menu').first();
    await menu.locator('summary').click();
    const item = menu.locator('.device-inbox-menu-items .btn').first();
    await expect(item).toBeVisible();
    assert.equal(await item.evaluate(element => {
      const r = element.getBoundingClientRect();
      return element.getRootNode().elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === element;
    }), true, 'row action must not be clipped or covered');
    await close(shell);
  });

  await check('UI-009: last-row menu stays hit-testable above the footer at phone height', async () => {
    await page.setViewportSize({ width:390, height:600 });
    const bar = page.locator('[data-hp="toolbar"][data-kind="device"]');
    await bar.locator('[data-tool="device-inbox"]').click();
    const shell = dialog('device-inbox');
    const menu = shell.locator('.device-inbox-menu').last();
    await menu.locator('summary').scrollIntoViewIfNeeded();
    await menu.locator('summary').click();
    await expect.poll(() => menu.locator('.device-inbox-menu-items button').evaluateAll(elements => elements.every(element => {
      const r = element.getBoundingClientRect();
      return element.getRootNode().elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button') === element;
    }))).toBe(true);
    await close(shell);
    await page.setViewportSize({ width:1280, height:900 });
  });

  await check('UI-006: PDF download keeps options, emits one file and closes after success', async () => {
    await page.locator('[data-hp="editor-close"]').first().click();
    const shell = await open('pdf');
    const option = shell.locator('input[type=checkbox]').first();
    const changed = !await option.isChecked();
    await option.setChecked(changed);
    const downloading = page.waitForEvent('download');
    await shell.locator('[data-hp="dialog-confirm"]').click();
    const download = await downloading;
    assert.ok(download.suggestedFilename().endsWith('.pdf'));
    assert.equal(await download.failure(), null);
    await expect(shell).toHaveCount(0);
    const reopened = await open('pdf');
    await expect(reopened.locator('input[type=checkbox]').first()).toBeChecked({ checked: changed });
    await close(reopened);
  });

  await check('UI-001: joined header controls are 44px and pressed toggles keep a transparent face', async () => {
    const group = page.locator('.head .summary-control');
    await expect(group).toBeVisible();
    const buttons = await group.locator('button').evaluateAll(elements => elements.map(element => {
      const r = element.getBoundingClientRect();
      return { width: r.width, height: r.height };
    }));
    assert.deepEqual(buttons, [{ width: 44, height: 44 }, { width: 44, height: 44 }]);
    const toggle = group.locator('button').last();
    if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
    assert.equal(await toggle.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
    const hidden = page.locator('[data-hp="hidden-devices"]');
    if (await hidden.getAttribute('aria-pressed') !== 'true') await hidden.click();
    assert.equal(await hidden.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
  });

  await check('UI-005/012: sun radios have one contour; failed Save retains the draft; retry saves once', async () => {
    const shell = await open('settings');
    await shell.locator('[data-section-target="sun"]').click();
    const radios = shell.locator('input[name="gs-sun-ray-origin"]');
    await expect(radios).toHaveCount(2);
    const selected = await radios.evaluateAll(elements => elements.find(input => input.checked).value);
    const other = selected === 'inner' ? 'outer' : 'inner';
    await shell.locator(`.hpf-ray-choice:has(input[value="${other}"])`).click();
    await expect(shell.locator(`input[name="gs-sun-ray-origin"][value="${other}"]`)).toBeChecked();
    const paint = await shell.locator('.hpf-ray-choice').evaluateAll(elements => elements.map(element => ({
      shadow: getComputedStyle(element).boxShadow,
      outline: getComputedStyle(element).outlineStyle,
      captionPadding: getComputedStyle(element.querySelector('figcaption')).paddingBottom,
      border: getComputedStyle(element.querySelector('figure')).borderTopWidth,
      captions: element.querySelectorAll('figcaption > *').length,
    })));
    assert.ok(paint.every(item => item.shadow === 'none' && item.outline === 'none'
      && item.captionPadding === '10px' && item.border === '1px' && item.captions === 0));
    await page.evaluate(() => { window.__polishBackend.saveFailure = true; });
    await shell.locator('[data-hp="dialog-confirm"]').click();
    await expect(shell.locator('[data-hp="dialog-confirm"]')).toBeEnabled();
    await expect(shell).toBeVisible();
    await expect(shell.locator(`input[name="gs-sun-ray-origin"][value="${other}"]`)).toBeChecked();
    await page.evaluate(() => { window.__polishBackend.saveFailure = false; });
    const writes = await page.evaluate(() => window.__polishBackend.calls.filter(type => type === 'houseplan/config/set').length);
    await shell.locator('[data-hp="dialog-confirm"]').click();
    await expect(shell).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.__polishBackend.calls.filter(type => type === 'houseplan/config/set').length), writes + 1);
  });

  await check('UI-002/006/009: agreed widths, compact PDF, light/dark and narrow overflow', async () => {
    for (const theme of ['light', 'dark']) {
      await page.locator('#lab-launcher').click();
      await page.locator('#lab-theme').selectOption(theme);
      await page.locator('#lab-close').click();
      for (const width of [1280, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [kind, wide] of [['support', 610], ['pdf', 560], ['device-inbox', 920], ['rules', 860]]) {
          if (kind === 'rules' || kind === 'device-inbox') {
            if (width < 481) {
              await page.locator('[data-hp="header-menu"]').click();
              await page.locator('[data-hp="header-menu-item"][data-id="mode-devices"]').click();
            } else await page.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
            await page.locator(`[data-hp="tool"][data-tool="${kind === 'rules' ? 'icon-rules' : kind}"]`).click();
            await expect(dialog(kind)).toBeVisible();
          }
          // At phone width these actions live in the ordinary header menu.
          else if (width < 481) {
            await page.locator('[data-hp="header-menu"]').click();
            await page.locator(`[data-hp="header-menu-item"][data-id="${kind}"]`).click();
            await expect(dialog(kind)).toBeVisible();
          } else await open(kind);
          await dialog(kind).locator('dialog').evaluate(async element => {
            await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
          });
          const bounds = await geometry(dialog(kind));
          assert.equal(bounds.overflow, false, `${theme}/${width}/${kind}: horizontal overflow`);
          if (width === 1280) assert.ok(Math.abs(bounds.width - wide) < 1, JSON.stringify({ kind, bounds }));
          if (width === 1280 && kind === 'pdf') assert.ok(bounds.height < 500, 'PDF stretched to settings height');
          await page.screenshot({ path: fileURLToPath(new URL(`${kind}-${theme}-${width}.png`, output)) });
          await close(dialog(kind));
          if (kind === 'rules' || kind === 'device-inbox') await page.locator('[data-hp="editor-close"]').first().click();
        }
      }
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  writeFileSync(new URL(`report-dpr${deviceScaleFactor}.json`, output), JSON.stringify({ deviceScaleFactor, results, errors, external }, null, 2));
  console.log(`OK #976 authentic HA: ${results.length} groups`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
