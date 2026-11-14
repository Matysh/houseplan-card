import assert from 'node:assert/strict';
import { expect } from 'playwright/test';
import { launchColdView, finish } from './serve.mjs';

const { page, browser } = await launchColdView({ width: 1440, height: 900 });
// #1428: assert rendered paint and native focus, not just a CSS class. The kit
// uses its one ordinary border for hover, selection and actual Tab traversal.
async function singleBorder(button, label, accent) {
  await expect.poll(() => button.evaluate(el => {
    const style = getComputedStyle(el);
    return {outline:style.outlineStyle, shadow:style.boxShadow,
      border:style.borderTopWidth, color:style.borderTopColor};
  }), {message:label}).toEqual({outline:'none', shadow:'none', border:'1px', color:accent});
}
async function tabTo(button) {
  await button.focus(); // Establish a cursor only; this must not paint focus.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
}
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
      await singleBorder(button, `${mode}: real keyboard navigation`, dark ? 'rgb(100, 181, 246)' : 'rgb(25, 118, 210)');
      await page.keyboard.press('Escape');
      assert.equal(await button.evaluate(el => el.classList.contains('hpf-tab-focus')), false, 'Escape retires, never revives Tab paint');
      await page.keyboard.press('Escape');
      assert.equal(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    }
    const accent = dark ? 'rgb(100, 181, 246)' : 'rgb(25, 118, 210)';
    for (let cycle = 0; cycle < 3; ++cycle) {
      await page.mouse.move(5, 5);
      await tabTo(support);
      await singleBorder(support, 'Tab on header action', accent);
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      const close = dialog.locator('button.close');
      await tabTo(close);
      await singleBorder(close, 'Tab on dialog close', accent);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(support).toBeFocused();
      for (const key of ['Escape', 'Escape', 'Shift', 'ArrowRight']) {
        await page.keyboard.press(key);
        assert.equal(await support.evaluate(el => el.classList.contains('hpf-tab-focus')), false, `${key} is not Tab`);
        assert.equal(await support.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      }
      await tabTo(support);
      await singleBorder(support, 'new Tab after automatic return', accent);
      await page.mouse.move(5, 5);
      await support.focus();
    }
    // Joined zoom segments and compact mode/navigation use the same border.
    for (const width of [1440, 430]) {
      await page.setViewportSize({width, height:900});
      const buttons = page.locator('.hdr button.hpf-icon-action:visible, .hdr button.hpf-nav-item:visible');
      for (let index = 0; index < await buttons.count(); ++index) {
        const button = buttons.nth(index);
        if (await button.isDisabled()) continue;
        await tabTo(button);
        await singleBorder(button, `header ${width}/${index}`, accent);
      }
    }
    await page.setViewportSize({width:1440, height:900});
  }
} finally { await finish(browser); }
