// #998: actual form sweep. Native selectors remain value sources; UI Kit owns
// presentation, keyboard dismissal and viewport bounds in each dialog.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchHaDialogFixture, applyHaDialogTypography } from './helpers/ha-dialog-fixture.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { ensureHarnessEditorRuntime } from './editor-runtime-compat.mjs';
import { installSettingsDeviceFixture, openSettingsDeviceDialog } from './helpers/settings-device-947-fixture.mjs';
import { installSettingsSpaceFixture } from './helpers/settings-space-945-fixture.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { expect } from 'playwright/test';
import { runExtraPickerSweep } from './helpers/dialog-picker-extra-998.mjs';

const fixture = await launchHaDialogFixture({ authentic: true, viewport: {width:1280,height:1000} });
const {page} = fixture, rows = [];
const output = new URL('../artifacts/dialog-picker-998-sweep/', import.meta.url);
mkdirSync(output, {recursive:true});
const settle = () => page.evaluate(() => window.__hpTest.settled());
try {
  await page.goto(fixture.url + '/product.html');
  await applyHaDialogTypography(page);
  await page.waitForFunction(() => window.__card?._booting === false && window.__card?._devices?.length > 0);
  await assertFreshDemoBundle(page);
  assert.ok(await page.evaluate(ensureHarnessEditorRuntime));
  await installHpTestOnPage(page);
  await installSettingsDeviceFixture(page);
  await installSettingsSpaceFixture(page);
  const cases = [['general','settings'],['space','space'],['room','room'],
    ['led','marker','demo_led_controller'],['climate','marker','demo_living_climate'],
    ['vacuum','marker','demo_x50'],['radar','marker','demo_radar']];
  for (const [name,kind,device] of cases) {
    await page.setViewportSize({width:1280,height:1000});
    await page.evaluate(async device => {
      await window.__hpTest.switchSpace(device ? 'floor01' : 'f1');
      await window.__hpTest.setMode(device ? 'devices' : 'plan');
    }, !!device);
    if (device) await openSettingsDeviceDialog(page,device);
    else if (kind === 'settings') await page.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
    else if (kind === 'space') await page.evaluate(() => window.__hpTest.openSpaceDialog('edit','f1').then(() => null));
    else await page.evaluate(() => window.__hpTest.openRoomEdit('r1').then(() => null));
    const dialog = page.locator(`houseplan-card hp-dialog[data-kind=${kind}]`);
    await expect(dialog).toBeVisible(); await settle();
    const sections = await dialog.locator('[data-section-target]').evaluateAll(nodes => nodes.map(node => node.dataset.sectionTarget));
    if (!sections.length) sections.push(null);
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:1000});
      for (const section of sections) {
        if (section) {
          const navigation = dialog.locator('.hpf-settings-mobile');
          if (await navigation.isVisible()) {
            await navigation.locator('button').click();
            await navigation.locator(`[role=option][data-id="${section}"]`).click();
          } else await dialog.locator(`[data-section-target="${section}"]`).click();
        }
        await settle();
        const selects = dialog.locator('hp-settings-select').filter({visible:true});
        const count = await selects.count();
        for (let i=0;i<count;i++) {
          const select = selects.nth(i), trigger = select.locator('[data-hp=select-trigger]');
          const native = select.locator('select');
          const before = await native.inputValue();
          const field = await native.evaluate(el => el.dataset.field || el.id || el.name);
          if (await trigger.isDisabled()) { rows.push({name,section,width,field,disabled:true}); continue; }
          await trigger.scrollIntoViewIfNeeded();
          await expect.poll(async () => (await trigger.boundingBox())?.height).toBeGreaterThanOrEqual(44);
          assert.equal(await trigger.evaluate(el => getComputedStyle(el).borderTopLeftRadius), '8px');
          await trigger.click();
          const menu = select.locator('[role=listbox]'); await expect(menu).toBeVisible();
          await expect.poll(async () => menu.evaluate(el => {
            const rect=el.getBoundingClientRect(); return rect.left >= -1 && rect.right <= innerWidth + 1;
          })).toBe(true);
          assert.equal(await menu.evaluate(el => getComputedStyle(el).borderTopLeftRadius), '10px');
          await page.keyboard.press('Escape');
          await expect(trigger).toHaveAttribute('aria-expanded','false');
          await expect(dialog).toBeVisible(); await expect(trigger).toBeFocused();
          assert.equal(await native.inputValue(),before,'dismissal does not change a saved choice');
          rows.push({name,section,width,field,disabled:false});
        }
        const raw = await dialog.locator('select').evaluateAll(nodes => nodes.filter(node =>
          node.getBoundingClientRect().width > 1 && !node.closest('hp-settings-select')).map(node => node.id));
        assert.deepEqual(raw,[],`${name}/${section}: every visible choice uses the shared kit`);
      }
      await page.screenshot({path:new URL(`${name}-${width}.png`,output).pathname});
      console.log(`PASS #998 ${name}/${width}`);
    }
    await dialog.locator('[slot=footer] [data-hp=dialog-cancel]').last().click();
    await expect(dialog).toHaveCount(0);
  }
  assert.ok(rows.length > 40, 'sweep exercises actual fields, not empty dialogs');
  await runExtraPickerSweep(page, rows);
  // Print is available from View and has its own lazy entry. Exercise both
  // format and conditional SVG background choices through the rendered menu.
  await page.evaluate(() => {
    const card=window.__card;
    [...card.shadowRoot.querySelectorAll('button')]
      .find(button=>button.getAttribute('aria-label')===card._t('title.export_pdf')).click();
  });
  const print=page.locator('hp-dialog[data-kind=pdf]');
  await expect(print).toBeVisible();
  const format=print.locator('hp-settings-select').filter({has:page.locator('select[name=export-format]')});
  await format.locator('button').click();
  await format.locator('[role=option][data-id=svg]').click();
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:1000});
    for(const select of await print.locator('hp-settings-select').all()) {
      const trigger=select.locator('button');
      await expect.poll(async()=>(await trigger.boundingBox())?.height).toBe(44);
      assert.equal(await trigger.evaluate(el=>getComputedStyle(el).borderTopLeftRadius),'8px');
      await trigger.click();const menu=select.locator('[role=listbox]');
      await expect(menu).toBeVisible();
      assert.equal(await menu.evaluate(el=>getComputedStyle(el).borderTopLeftRadius),'10px');
      await expect.poll(()=>menu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})).toBe(true);
      await page.keyboard.press('Escape');await expect(print).toBeVisible();await expect(trigger).toBeFocused();
      rows.push({name:'print-svg',width,field:await select.locator('select').getAttribute('name')});
    }
  }
  await print.locator('[data-hp=dialog-cancel]').click();
  await expect(print).toHaveCount(0);
  await fixture.assertClean();
  writeFileSync(new URL('report.json',output),JSON.stringify({rows},null,2));
  console.log(`PASS #998 dialog sweep: ${rows.length} controls`);
} finally { await fixture.close(); }

// The selected CI smoke includes the genuine MDI component, not only native
// select wrappers. Acquisition verifies the pinned official wheel before use;
// the browser fixture itself has no HA connection or external network access.
const { prepareHa } = await import('./ui-lab/prepare-ha.mjs');
await prepareHa();
await import('./ui-lab/verify-icon-picker.mjs');
