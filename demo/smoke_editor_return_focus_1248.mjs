import assert from 'node:assert/strict';
import { expect } from 'playwright/test';
import { launchColdView, finish } from './serve.mjs';

const { page, browser } = await launchColdView({ width: 1440, height: 900 });
try {
  await page.locator('[data-hp="support"]').click();
  const dialog = page.locator('hp-dialog[data-kind="support"]');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const support = page.locator('[data-hp="support"]');
  await expect(support).toBeFocused();
  assert.equal(await support.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  await page.keyboard.press('Tab');
  assert.equal(await support.evaluate(el => el.classList.contains('hp-dialog-return-focus')), false);
  for (const dark of [false, true]) {
    await page.evaluate(dark => {
      window.__card.style.setProperty('--primary-color', dark ? '#64b5f6' : '#1976d2');
      window.__card.style.setProperty('--card-background-color', dark ? '#202020' : '#fff');
    }, dark);
    for (const mode of ['plan', 'devices', 'decor']) {
      const button = page.locator(`[data-hp="mode-tab"][data-mode="${mode}"]`);
      await button.click();
      await page.waitForFunction(mode => window.__card?._mode === mode && !window.__card?._modeTransitionPreparing, mode);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__card?._mode === 'view');
      await expect(button).toBeFocused();
      assert.equal(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'none', `${mode}: automatic return`);
      await page.keyboard.press('Tab');
      assert.equal(await button.evaluate(el => el.classList.contains('hp-dialog-return-focus')), false);
      await page.keyboard.press('Shift+Tab');
      await expect(button).toBeFocused();
      assert.equal(await button.evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true, `${mode}: real keyboard navigation`);
    }
  }
} finally { await finish(browser); }
