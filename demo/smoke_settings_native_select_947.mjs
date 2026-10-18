// #947: long legacy radar options must not widen HA's actual dialog body.
import {launchHaDialogFixture} from './helpers/ha-dialog-fixture.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {ensureHarnessEditorRuntime} from './editor-runtime-compat.mjs';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {checkAll,watchPage,finish} from './serve.mjs';
import {fileURLToPath} from 'node:url';
const fixture=await launchHaDialogFixture({authentic:true,viewport:{width:320,height:900},extraModules:['16213']});
const {page}=fixture,out={};
watchPage(page);
try{
 await page.goto(fixture.url+'/product.html');
 await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
 await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));
 if(!await page.evaluate(ensureHarnessEditorRuntime))throw new Error('Editor preload failed');
 await installHpTestOnPage(page);await installSettingsDeviceFixture(page);
 const original=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
 await openSettingsDeviceDialog(page,'demo_radar');
 const dialog=page.locator('houseplan-card hp-dialog[data-kind="marker"]');
 await dialog.locator('.hpf-settings-mobile select').selectOption('radar');
 await page.evaluate(()=>window.__hpTest.settled());
 await page.waitForTimeout(220);
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:900});
  out[`${width}_native_body_does_not_scroll_sideways`]=await dialog.evaluate(el=>{const ha=el.shadowRoot.querySelector('ha-dialog'),body=ha.shadowRoot.querySelector('.body');return body.scrollWidth<=body.clientWidth+1;});
 }
 await page.setViewportSize({width:320,height:900});
 const select=dialog.locator('.radargroup hp-settings-select').first();
 const button=select.locator('button').first();
 await button.click();
 out.styled_popup_opens=await button.getAttribute('aria-expanded')==='true'&&await select.locator('[role="listbox"]').isVisible();
 await select.locator('[role="listbox"]').press('Escape');
 out.escape_returns_focus=await button.evaluate(el=>el.getRootNode().activeElement===el)&&await button.getAttribute('aria-expanded')==='false';
 out.footer_targets=await dialog.locator('.hpf-footer button:not(:disabled)').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).cursor==='pointer'&&el.getBoundingClientRect().height>=44));
 await dialog.locator('.hpf-footer [data-hp="dialog-cancel"]').click();await dialog.waitFor({state:'detached'});
 out.cancel_preserves_config=await page.evaluate(original=>JSON.stringify(window.__card._serverCfg)===original,original);
 await fixture.assertClean();checkAll(out);await finish(fixture.browser,out);
}finally{await fixture.close();}
