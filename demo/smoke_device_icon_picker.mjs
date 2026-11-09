// #1375: local picker works without HA picker definitions.
import assert from 'node:assert/strict';
import {expect,webkit} from 'playwright/test';
import {assertIconPickerPolish,assertPickerOpenPolish,assertAutomaticIcon} from './helpers/icon-picker-polish.mjs';
import {reportPageErrors} from './serve.mjs';
import {launchDeviceIconPickerFixture} from './helpers/device-icon-picker-fixture.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
import {inspectDeviceIconPicker} from './golden/device-icon-picker.mjs';
import {waitForUiKitPaint} from './helpers/ui-kit-paint.mjs';
import {enforcePinnedBrowser} from '../scripts/browser-attestation.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
let passed=0;
const cases=['dark','light'].flatMap(theme=>[1280,390].map(width=>({theme,width})));
cases.push({theme:'dark',width:390,fallback:true},{theme:'dark',width:1280,authentic:true},
 {theme:'dark',width:390,engine:'webkit'},{theme:'light',width:390,engine:'webkit',fallback:true,reduced:true});
for(const {theme,width,fallback=false,authentic=false,engine='chromium',reduced=false} of cases){
 const f=await launchDeviceIconPickerFixture({viewport:{width,height:1000},colorScheme:theme,authentic,
  ...(engine==='webkit'?{browserType:webkit}:{}),hasTouch:width===390,isMobile:width===390,reducedMotion:reduced?'reduce':'no-preference'});
 try{
  const page=f.page;if(engine==='chromium')await enforcePinnedBrowser(f.browser);await assertFreshDemoBundle(page);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('mdi-icon-catalog'))),false,'MDI catalog stays out of cold View');
  if(fallback)await page.evaluate(()=>{HTMLElement.prototype.showPopover=undefined;});
  await page.evaluate(()=>window.__card._ensureEditorRuntime());await installHpTestOnPage(page);await installSettingsDeviceFixture(page);
  await page.evaluate(async()=>{
    window.__addRegistryDevice('picker_rebind_light','Picker regression light','Light','living_room');
    window.__addRegistryEntity('light.picker_rebind','living_room','on','mqtt',{device_id:'picker_rebind_light'},{friendly_name:'Picker regression light'});
    window.__card.hass=window.__mkHass();
    await window.__hpTest.setServerConfig(c=>{const m=c.markers.find(m=>m.id==='demo_living_climate');m.icon='mdi:access-point-minus';m.pdfs=[];});
  });
  const section=async(d,id)=>{
    const compact=d.locator('hp-settings-select:has([data-field="settings-section"])');
    if(await compact.isVisible()){
      await compact.locator('[data-hp="select-trigger"]').click();
      await d.locator(`[data-hp="select-option"][data-id="${id}"]`).click();
    }else await d.locator(`[data-section-target="${id}"]`).click();
    await waitForUiKitPaint(page);
  };
  let markerId='demo_living_climate';
  const open=async()=>{await openSettingsDeviceDialog(page,markerId);const d=page.locator('hp-dialog[data-kind="marker"]');await section(d,'appearance');return d;};
  let dialog=await open();const picker=()=>dialog.locator('hp-icon-picker');
  await inspectDeviceIconPicker(page,{expectedValue:'mdi:access-point-minus'});
  await assertIconPickerPolish(page,picker(),{desktop:width>550,reduced});
  await assertAutomaticIcon(page,picker(),{cleared:false});
  assert.equal(await page.evaluate(()=>!!customElements.get('ha-icon-picker')),false);
  const trigger=()=>picker().locator('button.trigger');
  await trigger().focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(trigger()).toBeFocused();
  const field=picker().locator('.field');const fieldWidth=await field.evaluate(el=>el.clientWidth);
  await field.click({position:{x:fieldWidth-16,y:22}});const search=dialog.locator('input[type=search]');await expect(search).toBeVisible();await assertPickerOpenPolish(page,dialog,picker(),{reduced});await search.fill('mdi:fan');
  await expect(search.locator('..').locator('[role=option].active')).toHaveCount(0);await expect(search).not.toHaveAttribute('aria-activedescendant');
  await dialog.locator('[role=option][data-icon="mdi:fan"]').click();
  await expect(picker()).toHaveJSProperty('value','mdi:fan');
  await picker().locator('button.clear').click();await assertAutomaticIcon(page,picker());
  await trigger().click();await search.fill('mdi:fan');await page.keyboard.press('Enter');
  await expect(picker()).toHaveJSProperty('value','mdi:fan');await expect(trigger()).toHaveAttribute('aria-expanded','false');await waitForUiKitPaint(page);await inspectDeviceIconPicker(page,{expectedValue:'mdi:fan'});
  await dialog.locator('[data-hp="dialog-confirm"]').first().click();await expect(dialog).toHaveCount(0);
  await page.evaluate(()=>window.__hpTest.waitForWrites());
  const saved=await page.evaluate(()=>window.__card._serverCfg.markers.find(m=>m.id==='demo_living_climate').icon);assert.equal(saved,'mdi:fan');
  dialog=await open();await expect(picker()).toHaveJSProperty('value','mdi:fan');
  await picker().locator('button.clear').click();
  await page.evaluate(()=>window.__hpTest.settled());
  const custom=await page.evaluate(()=>window.__card._markerDialog.icon);assert.ok(!custom,'Clear returns to the automatic icon');
  const clearedIcon=await assertAutomaticIcon(page,picker());
  await assertIconPickerPolish(page,picker(),{desktop:false,reduced});
  await dialog.locator('[data-hp="dialog-confirm"]').first().click();await expect(dialog).toHaveCount(0);await page.evaluate(()=>window.__hpTest.waitForWrites());
  assert.ok(!await page.evaluate(()=>window.__card._serverCfg.markers.find(m=>m.id==='demo_living_climate').icon));
  dialog=await open();await expect(picker()).toHaveJSProperty('value','');
  assert.equal(await assertAutomaticIcon(page,picker()),clearedIcon,'Save/reopen preserves the already shown automatic icon');
  // Editing a search is not selection; Escape must dismiss just the picker.
  await trigger().click();await search.fill('mdi:numeric-0-circle');await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(trigger()).toBeFocused();
  await trigger().click();await search.fill('mdi:numeric-0-circle');await page.keyboard.press('Enter');await expect(picker()).toHaveJSProperty('value','mdi:numeric-0-circle');
  await trigger().click();await search.fill('phu:custom-lamp');await page.keyboard.press('Enter');await expect(picker()).toHaveJSProperty('value','phu:custom-lamp');
  await trigger().click();await page.keyboard.press('Tab');await expect(trigger()).toHaveAttribute('aria-expanded','false');
  await dialog.locator('[data-hp="dialog-confirm"]').first().click();await expect(dialog).toHaveCount(0);await page.evaluate(()=>window.__hpTest.waitForWrites());
  dialog=await open();await expect(picker()).toHaveJSProperty('value','phu:custom-lamp');
  
  await trigger().click();await search.fill('mdi:lightbulb');await page.keyboard.press('Enter');
  await dialog.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();
  const confirm=page.locator('hp-dialog[data-kind="confirm"]');await expect(confirm).toBeVisible();
  await confirm.locator('[slot="footer"] [data-hp="dialog-confirm"]').click();await expect(dialog).toHaveCount(0);
  dialog=await open();await expect(picker()).toHaveJSProperty('value','phu:custom-lamp');
  // UI-054/055: rebinding changes the automatic icon; shared source/select
  // triggers and options suppress only the browser tap overlay on both engines.
  await section(dialog,'basics');const binding=dialog.locator('#marker-binding');
  const tap=async loc=>assert.equal((await loc.evaluate(e=>getComputedStyle(e).getPropertyValue('-webkit-tap-highlight-color'))).replace(/\s/g,''),'rgba(0,0,0,0)');
  await tap(binding);await binding.click();await dialog.locator('#marker-show-entities').check();const candidate=dialog.locator('[data-value="entity:light.picker_rebind"]');
  await expect(candidate).toBeVisible();await tap(candidate);await candidate.click();
  await section(dialog,'appearance');await picker().locator('.clear').click();
  const rebound=await assertAutomaticIcon(page,picker());assert.notEqual(rebound,clearedIcon,'binding change uses the new device automatic icon');
  const display=dialog.locator('hp-settings-select:has(#marker-display)');await tap(display.locator('button'));await display.locator('button').click();
  await tap(dialog.locator('[data-hp="select-option"]:visible').first());await page.keyboard.press('Escape');
  await dialog.locator('[data-hp="dialog-confirm"]').first().click();
  await expect(dialog).toHaveCount(0);await page.evaluate(()=>window.__hpTest.waitForWrites());
  markerId=await page.evaluate(()=>window.__card._serverCfg.markers.find(m=>m.binding==='entity:light.picker_rebind').id);
  dialog=await open();assert.equal(await assertAutomaticIcon(page,picker()),rebound);await dialog.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();await expect(dialog).toHaveCount(0);
  // A new virtual marker has the canonical fallback before any custom choice.
  await page.evaluate(()=>window.__hpTest.openMarkerDialog().then(()=>null));dialog=page.locator('hp-dialog[data-kind="marker"]');await section(dialog,'appearance');
  assert.equal(await assertAutomaticIcon(page,picker()),'mdi:map-marker');
  await trigger().click();await search.fill('mdi:fan');await page.keyboard.press('Enter');await picker().locator('.clear').click();
  assert.equal(await assertAutomaticIcon(page,picker()),'mdi:map-marker');
  const virtualDisplay=dialog.locator('hp-settings-select:has(#marker-display)');
  await virtualDisplay.locator('button').click();await dialog.locator('[data-hp="select-option"][data-id="icon_ripple"]').click();
  const color=dialog.locator('hp-color-opacity[data-activity-color]');await tap(color.locator('.trigger'));await color.locator('.trigger').click();
  const hue=dialog.locator('[data-field="colour-hue"]');await expect(hue).toBeVisible();await tap(hue);
  const colorConfirm=dialog.locator('[data-action="colour-confirm"]');await tap(colorConfirm);await colorConfirm.click();
  await expect(color.locator('.trigger')).toHaveAttribute('aria-expanded','false');
  await f.assertClean();assert.equal(await reportPageErrors(),false,'no card error before closing the page');passed++;console.log('PASS',theme,width,{fallback,authentic,engine,reduced,browser:f.browser.version()});
 }finally{await f.close();}
}
// A failed lazy asset must leave manual entry usable and support a real retry.
{
 const f=await launchDeviceIconPickerFixture({viewport:{width:1280,height:1000},colorScheme:'dark'});
 try {
  const page=f.page;let requests=0;
  await page.route(/\/mdi-icon-catalog-[^/]+\.js(?:\?.*)?$/,async route=>{
    if(++requests<=2)await route.abort();else await route.continue();
  });
  await page.evaluate(()=>window.__card._ensureEditorRuntime());await installHpTestOnPage(page);await installSettingsDeviceFixture(page);
  await openSettingsDeviceDialog(page,'demo_living_climate');
  const dialog=page.locator('hp-dialog[data-kind="marker"]');await dialog.locator('[data-section-target="appearance"]').click();
  const picker=dialog.locator('hp-icon-picker');
  await expect.poll(()=>picker.evaluate(p=>p._failed)).toBe(true);
  await picker.locator('.trigger').click();await expect(picker.locator('.retry')).toBeVisible();
  const search=picker.locator('input[type=search]');await search.fill('phu:offline-lamp');await page.keyboard.press('Enter');
  await expect(picker).toHaveJSProperty('value','phu:offline-lamp');
  await picker.locator('.trigger').click();
  await expect.poll(()=>picker.evaluate(p=>p._catalog?.size||0)).toBe(7447);
  assert.equal(requests,3,'retry uses a fresh module URL after the failed import');
  await search.fill('mdi:fan');await page.keyboard.press('Enter');await expect(picker).toHaveJSProperty('value','mdi:fan');
  await f.assertClean();assert.equal(await reportPageErrors(),false,'no card error before closing the page');passed++;console.log('PASS lazy catalog failure, manual entry and retry');
 } finally {await f.close();}
}
assert.equal(await reportPageErrors(),false,'no handled or unhandled card error');
console.log('PROCESS_NEXT_RESULT '+JSON.stringify({tests:passed,passed,failed:0,skipped:0}));
