// #976 native fallback: public actions, computed paint and terminal removal.
// Authentic HA animation/focus frames additionally run in ui-lab/verify-polish.
import assert from 'node:assert/strict';
import { expect } from 'playwright/test';
import { launchColdView, finish } from './serve.mjs';
import { installUiPolish963Fixture } from './helpers/ui-polish-963-fixture.mjs';

const { page, browser } = await launchColdView({ width: 1280, height: 900 });
try {
  const shell = kind => page.locator(`hp-dialog[data-kind="${kind}"]`);
  await page.locator('[data-hp="support"]').click();
  await expect(shell('support')).toBeVisible();
  const width = await shell('support').locator('.surface').evaluate(element => element.getBoundingClientRect().width);
  assert.equal(width, 610);
  await page.keyboard.press('Escape');
  await expect(shell('support')).toHaveCount(0);
  await expect(page.locator('[data-hp="support"]')).toBeFocused();
  assert.equal(await page.locator('[data-hp="support"]').evaluate(element => getComputedStyle(element).outlineStyle), 'none');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-hp="support"]').evaluate(element => element.classList.contains('hp-dialog-return-focus')), false);

  await page.locator('[data-hp="settings"]').click();
  const settings = shell('settings'), signal = settings.locator('#gs-show-lqi');
  await signal.click();
  await settings.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
  const question = shell('confirm');
  await question.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
  // Before the exit terminal, retained paint must already be non-modal and
  // the parent's actual field (not its Cancel button) must own focus.
  assert.deepEqual(await question.evaluate(element => ({
    retained: element.inert,
    modal: element.shadowRoot.querySelector('dialog').matches(':modal'),
    focused: element.getRootNode().activeElement?.id,
  })), {retained:true, modal:false, focused:'gs-show-lqi'});
  await expect(question).toHaveCount(0);
  await expect(signal).toBeFocused();
  await signal.click();
  await settings.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
  await expect(settings).toHaveCount(0);

  await installUiPolish963Fixture(page);

  await page.locator('[data-hp="mode-tab"][data-mode="decor"]').click();
  const toolbar = page.locator('[data-hp="toolbar"][data-kind="decor"]');
  // Legacy demo has no image-upload capability. All three are covered by the
  // authentic HA Lab fixture; native checks the two available launchers.
  for (const menu of ['shapes', 'furniture']) {
    await toolbar.locator('[data-tool="select"]').click();
    await toolbar.locator(`[data-tool="${menu}"]`).click();
    await expect(page.locator('[data-hp="tray"]')).toBeVisible();
    await toolbar.locator('[data-tool="erase"]').click();
    await expect(toolbar.locator('[data-tool="erase"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('[data-hp="tray"]')).toHaveCount(0);
  }
  const cursor = await page.locator('.stage').evaluate(element => getComputedStyle(element).cursor);
  assert.ok(cursor.includes('32 32') || cursor.includes('32%2032'), cursor);
  assert.ok(cursor.endsWith('2 2, default'), cursor);
  const hit = page.locator('.decorlayer .derasehit').first();
  {
    await expect(hit).toBeVisible();
    const id = await hit.evaluate(element => element.closest('[data-id]')?.getAttribute('data-id'));
    assert.ok(id, 'synthetic erase target identity');
    const item = page.locator(`.decorlayer [data-id="${id}"]`).first();
    const painted = page.locator(`.decorlayer [data-id="${id}"]:not(.derasehit)`).first();
    assert.equal(await hit.evaluate(element => getComputedStyle(element).cursor), cursor);
    await painted.click();
    await expect(shell('confirm')).toBeVisible();
    await shell('confirm').locator('[data-hp="dialog-cancel"]').first().click();
    await expect(shell('confirm')).toHaveCount(0);
    await expect(item).toHaveCount(1);
    await painted.click();
    await shell('confirm').locator('[data-hp="dialog-confirm"]').click();
    await expect(shell('confirm')).toHaveCount(0);
    await expect(item).toHaveCount(0);
    await toolbar.locator('button:has(ha-icon[icon="mdi:undo-variant"])').click();
    await expect(item).toHaveCount(1);
    await toolbar.locator('button:has(ha-icon[icon="mdi:redo-variant"])').click();
    await expect(item).toHaveCount(0);
  }
  await toolbar.locator('[data-tool="shapes"]').click();
  await toolbar.locator('[data-tool="erase"]').focus();
  await page.keyboard.press('Enter');
  await expect(toolbar.locator('[data-tool="erase"]')).toHaveClass(/\bon\b/);
  await page.locator('[data-hp="editor-close"]').first().click();

  await page.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
  await page.locator('[data-tool="icon-rules"]').click();
  const rows = shell('rules').locator('.rrow');
  const original = await rows.locator('.rpat').evaluateAll(elements => elements.map(input => input.value));
  await rows.first().locator('button').nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(rows.nth(1).locator('.rpat')).toHaveValue(original[0]);
  assert.deepEqual(await rows.first().locator('button').first().evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [rect.width, rect.height];
  }), [44, 44]);
  await shell('rules').locator('[data-hp="dialog-cancel"]').first().click();
  await expect(shell('rules')).toHaveCount(0);
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(config => {
      const source = config.markers.find(marker => marker.id === 'lamp');
      config.markers.push(...Array.from({length:8}, (_, index) => ({...source,
        id:`menu-${index}`, name:`Synthetic menu row ${index}`})));
    });
    await window.__hpTest.setLayout(layout => {
      for (let i=0;i<8;i++) layout[`menu-${i}`]={s:'polish',x:.6+i*.03,y:.75};
    });
  });
  await page.setViewportSize({ width:390, height:600 });
  await page.locator('[data-tool="device-inbox"]').click();
  const lastMenu = shell('device-inbox').locator('.device-inbox-menu').last();
  await lastMenu.locator('[data-action=device-catalog-menu]').scrollIntoViewIfNeeded();
  await lastMenu.locator('[data-action=device-catalog-menu]').click();
  await expect(lastMenu.locator('.hpf-context-menu')).toBeVisible();
  await expect.poll(() => lastMenu.locator('.hpf-context-menu button').evaluateAll(elements => elements.length > 0 && elements.every(element => {
    const r = element.getBoundingClientRect();
    return element.getRootNode().elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button') === element;
  }))).toBe(true);
  await shell('device-inbox').locator('[data-hp="dialog-cancel"]').first().click();
  await expect(shell('device-inbox')).toHaveCount(0);
  console.log('PASS #976 native: Help width/exit/return-focus, palette transitions, cursor and keyboard Rules');
} finally {
  await finish(browser);
}
