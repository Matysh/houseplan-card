// #946 AC5: a real failed write keeps the Room draft; retry accepts it once.
import {checkAll,finish,watchPage} from './serve.mjs';
import {launchHaDialogFixture} from './helpers/ha-dialog-fixture.mjs';
import {ensureHarnessEditorRuntime} from './editor-runtime-compat.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
const fixture=await launchHaDialogFixture({authentic:true,viewport:{width:390,height:820},extraModules:['16213']});
const {page,browser}=fixture,out={};watchPage(page);
try{
 await page.goto(fixture.url+'/product.html');
 await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
 await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));
 await page.evaluate(ensureHarnessEditorRuntime);await installHpTestOnPage(page);
 await page.evaluate(async()=>{
  const c=window.__card,original=c.hass.callWS.bind(c.hass);
  window.__room946Write={count:0,before:JSON.stringify(c._serverCfg)};
  c.hass={...c.hass,callWS:async message=>{
   if(message.type==='houseplan/config/set'&&++window.__room946Write.count===1)
    throw Object.assign(new Error('room-save-rejected-946'),{code:'unknown_error'});
   return original(message);
  }};
  await window.__hpTest.setMode('plan');await window.__hpTest.openRoomEdit('r1');
 });
 const dialog=page.locator('houseplan-card hp-dialog[data-kind=room]'),name=dialog.locator('#room-name');
 const draft=(await name.inputValue())+' · retry',save=dialog.locator('[data-hp=dialog-confirm]');
 await name.fill(draft);await name.press('Tab');await save.click();
 await page.waitForFunction(()=>window.__room946Write.count===1);
 await page.evaluate(()=>window.__hpTest.settled());
 out.failedWriteKeepsDraft=await dialog.isVisible()&&await name.inputValue()===draft&&await save.isEnabled();
 out.failedWriteKeepsAcceptedConfig=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg)===window.__room946Write.before);
 // The writer translates its error code; raw transport diagnostics are not UI.
 const notice=page.locator('houseplan-card [data-hp=toast][role=alert]');
 // #956 tracks native-modal paint order: CSS visibility is not visual proof.
 out.failureAlertIsRendered=await notice.count()===1&&/^(Error|Ошибка|Fehler|Erreur)\s*:/.test((await notice.innerText()).trim());
 mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/room-save-retry-946.png'});
 await save.click();await dialog.waitFor({state:'detached'});
 out.retryAcceptsExactlyOnce=await page.evaluate(draft=>window.__room946Write.count===2&&window.__card._serverCfg.spaces.flatMap(s=>s.rooms||[]).find(r=>r.id==='r1')?.name===draft,draft);
 await fixture.assertClean();checkAll(out);await finish(browser,out);
}finally{await fixture.close();}
