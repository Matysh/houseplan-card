// Real form controls: no synthetic replacement for the chip being asserted.
import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {launch,finish,requirePinnedBrowser} from './serve.mjs';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
requirePinnedBrowser('#1428 form button focus');
const {page,browser}=await launch({width:1280,height:1000});
async function tabTo(button) {
  await button.evaluate(el=>{
    const cursor=document.createElement('span');cursor.tabIndex=0;
    cursor.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    el.before(cursor);el.__tabCursor=cursor;cursor.focus();
  });
  await page.keyboard.press('Tab');await expect(button).toBeFocused();
  await button.evaluate(el=>{el.__tabCursor.remove();delete el.__tabCursor;});
}
async function oneBorder(button,accent,size) {
  await expect(button).toHaveClass(/hpf-tab-focus/);
  await expect.poll(()=>button.evaluate(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return [s.borderTopWidth,s.borderTopStyle,s.borderTopColor,s.outlineStyle,s.boxShadow,r.width,r.height];
  })).toEqual(['1px','solid',accent,'none','none',size,size]);
}
try {
  await installSettingsDeviceFixture(page);
  await page.evaluate(async()=>{
    await window.__hpTest.setServerConfig(config=>{
      const space=config.spaces.find(space=>space.id==='floor01');
      space.settings={...space.settings,north_deg:0};
    });
    await window.__hpTest.waitForWrites();
  });
  const saved=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
  for(const dark of [false,true]){
    const accent=dark?'rgb(100, 181, 246)':'rgb(25, 118, 210)';
    await page.evaluate(dark=>{
      const c=window.__card;c.style.setProperty('--primary-color',dark?'#64b5f6':'#1976d2');
      c.style.setProperty('--card-background-color',dark?'#202020':'#fff');
    },dark);
    await openSettingsDeviceDialog(page,'demo_radar');
    const dialog=page.locator('hp-dialog[data-kind=marker]');
    await expect(dialog).toBeVisible();
    for(const [section,action] of [['actions','marker-control-remove'],['details','marker-attachment-remove']]){
      await dialog.locator(`[data-section-target=${section}]`).click();
      await page.mouse.move(0,0);
      const remove=dialog.locator(`[data-action=${action}]`).first();
      await expect(remove).toBeVisible();
      await tabTo(remove);await oneBorder(remove,accent,28);
      await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
      await oneBorder(remove,accent,28);
    }
    await dialog.locator('[slot=footer] [data-hp=dialog-cancel]').click();
    await expect(dialog).toHaveCount(0);
    await page.evaluate(()=>window.__hpTest.openSpaceDialog('edit','floor01').then(()=>null));
    const space=page.locator('hp-dialog[data-kind=space]');
    await space.locator('[data-section-target=sun]').click();
    const dial=space.locator('.hpf-north-dial');await expect(dial).toBeVisible();
    const size=await dial.evaluate(el=>el.getBoundingClientRect().width);
    await page.mouse.move(0,0);await tabTo(dial);await oneBorder(dial,accent,size);
    await space.locator('[slot=footer] [data-hp=dialog-cancel]').click();
    await expect(space).toHaveCount(0);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__card._serverCfg)),saved,'focus checks write no device/space data');
  console.log('PASS #1428 real control/PDF chips and compass, light/dark, no writes');
} finally {await finish(browser);}
