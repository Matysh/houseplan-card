// #989: one native interaction scenario on both the demo and pinned real HA UI.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import { chromium, expect } from 'playwright/test';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { createLabServer } from './ui-lab/server.mjs';
import { attestLaunchedBrowser } from '../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

const { values } = parseArgs({ options: { 'ha-cache': { type: 'string' } } });
requirePinnedBrowser('device binding dropdown keyboard lifecycle');
let server, page, browser;
const errors = [];
if (values['ha-cache']) {
  server = createLabServer({ port: 0, haCache: values['ha-cache'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  browser = await chromium.launch();
  await attestLaunchedBrowser(browser, { reason: '#989 native HA binding dropdown' });
  page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.__lab?.card?._devices?.length > 0);
  await assertFreshDemoBundle(page);
} else ({ page, browser } = await launch({ width: 1280, height: 1000 }));

const out = {};
const dialog = page.locator('hp-dialog[data-kind="marker"]');
const picker = dialog.locator('.hpf-picker:has(#marker-binding)');
const trigger = dialog.locator('#marker-binding');
const panel = picker.locator('.hpf-panel');
const search = panel.locator('input[type="text"]');
const options = panel.locator('[role="option"]');
const confirm = page.locator('hp-dialog[data-kind="confirm"]');
const check = async (name, fn) => { await fn(); out[name] = true; };
const closed = async () => {
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toHaveCount(0);
};
try {
  await page.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
  await page.locator('[data-hp="tool"][data-tool="add-device"]').click();
  await expect(dialog).toBeVisible();
  const virtual = dialog.locator('input[name="bmode"]').nth(0);
  const ha = dialog.locator('input[name="bmode"]').nth(1);
  await check('virtualDefaultHasNoPicker', async () => {
    await expect(virtual).toBeChecked(); await expect(trigger).toHaveCount(0);
  });
  await dialog.locator('#marker-name').fill('Binding draft 989');
  const room = await dialog.locator('#marker-room').inputValue();
  await dialog.locator('label:has(input[name="bmode"][value="ha"])').click();
  await check('haStartsClosedAndSaveDisabled', async () => {
    await expect(trigger).toBeVisible(); await closed();
    await expect(dialog.locator('[data-hp="dialog-confirm"]')).toBeDisabled();
  });
  await trigger.click();
  await check('explicitOpenKeepsEntityToolbar', async () => {
    await expect(panel).toBeVisible();
    await expect(panel.locator('#marker-show-entities')).not.toBeChecked();
    await expect(panel.locator('.hpf-check')).toHaveAttribute('title', /.+/);
  });
  const entitySub = await page.evaluate(() => (window.__lab?.card || window.__card)._t('marker.sub_entity'));
  await check('deviceEntitiesAreOptIn', async () => {
    assert.ok(!(await options.locator('small').allTextContents()).some(text => text.includes(entitySub)));
    await panel.locator('#marker-show-entities').check();
    await expect.poll(async () => (await options.locator('small').allTextContents()).some(text => text.includes(entitySub))).toBe(true);
  });
  await search.fill('no-device-matches-989');
  await check('unmatchedSearchHasNoSelectableResult', async () => {
    await expect(options).toHaveCount(0); await expect(panel.locator('.hpf-hint')).toBeVisible();
  });
  await check('escapeSearchClosesOnlyListAndReturnsFocus', async () => {
    await search.press('Escape'); await closed(); await expect(trigger).toBeFocused();
    await expect(dialog).toBeVisible(); await expect(confirm).toHaveCount(0);
    await expect(dialog.locator('#marker-name')).toHaveValue('Binding draft 989');
    await expect(dialog.locator('#marker-room')).toHaveValue(room);
  });
  await trigger.click();
  await check('reopenPreservesFilterAndDraft', async () => {
    await expect(search).toHaveValue('no-device-matches-989');
    await search.fill(''); await expect(options.first()).toBeVisible();
  });
  await check('escapeOptionClosesOnlyList', async () => {
    await options.first().focus(); await page.keyboard.press('Escape');
    await closed(); await expect(trigger).toBeFocused(); await expect(confirm).toHaveCount(0);
  });
  await trigger.click();
  const selectedName = await options.first().locator('span').textContent();
  await options.first().click();
  await check('pickUpdatesLabelClosesListAndRetainsDraft', async () => {
    await closed(); await expect(trigger).toContainText(selectedName);
    await expect(dialog.locator('#marker-name')).toHaveValue('Binding draft 989');
    await expect(dialog.locator('#marker-room')).toHaveValue(room);
    await expect(dialog.locator('[data-hp="dialog-confirm"]')).toBeEnabled();
  });
  await dialog.locator('label:has(input[name="bmode"][value="virtual"])').click();
  await dialog.locator('label:has(input[name="bmode"][value="ha"])').click();
  await check('secondHaAppearanceIsClosed', async () => {
    await closed(); await expect(dialog.locator('#marker-name')).toHaveValue('Binding draft 989');
  });
  await check('closedListEscapeStillAsksBeforeDiscard', async () => {
    await trigger.focus(); await page.keyboard.press('Escape'); await expect(confirm).toBeVisible();
    await confirm.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
    await expect(confirm).toHaveCount(0); await expect(dialog).toBeVisible();
    await expect(dialog.locator('#marker-name')).toHaveValue('Binding draft 989');
  });
  await dialog.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
  await confirm.locator('[data-hp="dialog-confirm"]').click();
  await expect(dialog).toHaveCount(0);
  await page.locator('[data-hp="device"]').first().dblclick();
  await check('existingDeviceKeepsSelectedLabelAndClosedList', async () => {
    await expect(dialog).toBeVisible(); await expect(ha).toBeChecked();
    await expect(trigger.locator('b')).toHaveText(/.+/); await closed();
  });
  assert.deepEqual(errors, [], 'no browser exception in official HA UI');
  checkAll(out);
  await finish(browser, out);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
