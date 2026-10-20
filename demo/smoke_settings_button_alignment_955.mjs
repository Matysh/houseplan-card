// #955: inspect painted Save lettering, including translations with no descender.
import {readFileSync} from 'node:fs';
import {launchHaDialogFixture,applyHaDialogTypography} from './helpers/ha-dialog-fixture.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {ensureHarnessEditorRuntime} from './editor-runtime-compat.mjs';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
import {installSettingsSpaceFixture} from './helpers/settings-space-945-fixture.mjs';
import {buttonPaint,approvedSavePaint} from './helpers/button-paint.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {checkAll,watchPage,finish} from './serve.mjs';
import {fileURLToPath} from 'node:url';

const out={},demoFont=process.argv.includes('--demo-font');
const lineHeight=process.argv.find(arg=>arg.startsWith('--line-height='))?.slice(14);
if(lineHeight&&!/^\d+(?:\.\d+)?$/.test(lineHeight))throw Error('Invalid line height');
for(const language of ['ru','en','de','fr']){
 const f=await launchHaDialogFixture({viewport:{width:1280,height:900},extraModules:['16213']}),p=f.page;
 watchPage(p);
 try{
  // A slow genuine HA bootstrap must finish before either product module runs.
  // Without that barrier HA replaces HTMLElement after hp-dialog registration.
  await p.route('**/ha505-bootstrap.mjs',async route=>{await new Promise(resolve=>setTimeout(resolve,600));await route.continue();});
  await p.goto(f.url+'/product.html');await applyHaDialogTypography(p);
  if(demoFont)await p.addStyleTag({content:"html,body{font-family:'Segoe UI',Roboto,Arial,sans-serif}"});
  if(lineHeight)await p.addStyleTag({content:`html,body{line-height:${lineHeight}}`});
  await p.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
  await assertFreshDemoBundle(p,fileURLToPath(new URL('..',import.meta.url)));
  await p.evaluate(ensureHarnessEditorRuntime);await installHpTestOnPage(p);
  await installSettingsDeviceFixture(p);await installSettingsSpaceFixture(p);
  await p.evaluate(language=>window.__card.setConfig({...window.__card._config,language}),language);
  await p.evaluate(ensureHarnessEditorRuntime);
  const base=JSON.parse(readFileSync(new URL(`../src/i18n/${language}.json`,import.meta.url),'utf8'));
  const settings=JSON.parse(readFileSync(new URL(`../src/i18n/settings/${language}.json`,import.meta.url),'utf8'));
  for(const kind of ['settings','space','room','marker']){
   await p.evaluate(async kind=>{await window.__hpTest.switchSpace(kind==='marker'?'floor01':'f1');await window.__hpTest.setMode(kind==='marker'?'devices':'plan');},kind);
   if(kind==='settings')await p.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
   else if(kind==='space')await p.evaluate(()=>window.__hpTest.openSpaceDialog('edit','f1').then(()=>null));
   else if(kind==='room')await p.evaluate(()=>window.__hpTest.openRoomEdit('r1').then(()=>null));
   else await openSettingsDeviceDialog(p,'demo_led_controller');
   const d=p.locator(`houseplan-card hp-dialog[data-kind=${kind}]`);
   const save=d.locator('.hpf-footer .btn.on[data-hp=dialog-confirm]');
   await save.filter({hasText:kind==='room'?settings['room.save']:base['btn.save']}).waitFor();
   for(const width of [1280,390]){
    await p.setViewportSize({width,height:900});await p.waitForTimeout(250);
    const paint=await buttonPaint(save),id=`${language}_${kind}_${width}`;
    out[id]=approvedSavePaint(paint);
    if(!out[id])console.log('Save paint',id,paint);
   }
   await d.locator('.hpf-footer [data-hp=dialog-cancel]').click();
  }
  await f.assertClean();checkAll(out);await finish(f.browser,out);
 }finally{await f.close();}
}
