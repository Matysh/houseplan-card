import { largePlanFile } from './helpers/large-plan-file.mjs';
import { applyUiKitTheme } from './helpers/ui-kit-theme.mjs';
// #1147: a real oversized PNG must open the guard above cold onboarding.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'playwright/test';
import { launchPanelCold, finish, check } from './serve.mjs';
import { mountFirstSpace } from './helpers/first-space.mjs';

const output = resolve('artifacts/ui-kit-view-1147');
mkdirSync(output, { recursive: true });
const sessions = [], out = {};
try {
  for (const [width, theme] of [[1280, 'light'], [390, 'dark']]) {
    const session = await launchPanelCold({ width, height: 1000 }); sessions.push(session);
    const { page } = session, requests = [];
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    await mountFirstSpace(page);
    await page.locator('hp-dialog[data-kind="import"] [data-action="import-manual"]').click();
    const form = page.locator('hp-dialog[data-kind="onboarding"]');
    await expect(form).toBeVisible();
    await applyUiKitTheme(page, theme);
    const title = form.locator('input[data-field$="-title"]');
    await title.fill('Retained draft');
    await form.locator('input[name="plansrc"][data-value="file"]').check();
    const file = await largePlanFile(page);
    const guard = page.locator('hp-dialog[data-kind="decor"]');
    for (const close of ['cancel', 'escape', 'close']) {
      await form.locator('[data-hp="image-upload"]').setInputFiles(file);
      await expect(guard, 'oversized plan guard must be visibly mounted above the empty-plan onboarding').toBeVisible({ timeout: 8000 });
      await expect(guard).toContainText('10000');
      const surface = await guard.locator('dialog').boundingBox();
      assert.ok(surface && surface.width <= width && surface.x >= 0, JSON.stringify(surface));
      await page.screenshot({ path: resolve(output, `large-plan-${width}-${theme}-${close}.png`) });
      if (close === 'cancel') await guard.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
      else if (close === 'escape') await page.keyboard.press('Escape');
      else await guard.locator('button.close').click();
      await expect(guard).toHaveCount(0);
      await expect(form).toBeVisible(); await expect(title).toHaveValue('Retained draft');
      await expect(form.locator('input[name="plansrc"][data-value="file"]')).toBeChecked();
      assert.equal(await page.evaluate(() => window.firstSpaceFixture.calls.filter(message =>
        /houseplan\/(config\/set|layout\/(set|update|delete))/.test(message.type)).length), 0);
    }
    assert.ok(!requests.some(request => /houseplan-editor-runtime-[^/]+\.js/.test(request.url)), 'guard must not fetch the full editor');
    assert.ok(!requests.some(request => /^(POST|PUT|DELETE)$/.test(request.method)), 'cancelled guard must not upload or persist');
    out[`nativeGuardAndRetainedDraft${width}`] = true;
  }
  for (const [key, value] of Object.entries(out)) check(key, value);
} finally {
  for (const session of sessions) await finish(session.browser, out);
}
