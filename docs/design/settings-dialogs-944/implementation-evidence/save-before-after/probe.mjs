import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const root=arg('root'),helpers=arg('helpers'),outDir=arg('out'),label=arg('label');
if(!root||!helpers||!outDir||!label)throw Error('root/helpers/out/label required');
const load=(base,file)=>import(pathToFileURL(base+'/'+file));
const {launchHaDialogFixture}=await load(root,'demo/helpers/ha-dialog-fixture.mjs');
const {applyHaDialogTypography}=await load(helpers,'demo/helpers/ha-dialog-fixture.mjs');
const {buttonPaint}=await load(helpers,'demo/helpers/button-paint.mjs');
const {installHpTestOnPage}=await load(root,'demo/helpers/hp-test.mjs');
const {ensureHarnessEditorRuntime}=await load(root,'demo/editor-runtime-compat.mjs');
const {assertFreshDemoBundle}=await load(root,'demo/bundle-freshness.mjs');
const {installSettingsDeviceFixture,openSettingsDeviceDialog}=await load(helpers,'demo/helpers/settings-device-947-fixture.mjs');
const {installSettingsSpaceFixture}=await load(helpers,'demo/helpers/settings-space-945-fixture.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const result={label,source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),probeSha256:sha(readFileSync(new URL(import.meta.url))),helperSha256:sha(readFileSync(helpers+'/demo/helpers/button-paint.mjs')),typography:'HA Roboto; inherited profile configures Segoe UI/Roboto/Arial stack and line-height2.1, without asserting that a host font is installed',inputs:{},savedUnchanged:true,cases:{},errors:[],external:[]};
mkdirSync(outDir,{recursive:true});
for(const typography of ['ha','inherited'])for(const language of ['ru','en','de','fr']){
 const f=await launchHaDialogFixture({authentic:true,viewport:{width:1280,height:900},extraModules:['16213']}),p=f.page;
 try{
  await p.goto(f.url+'/product.html');await applyHaDialogTypography(p);
  if(typography==='inherited')await p.addStyleTag({content:"html,body{font-family:'Segoe UI',Roboto,Arial,sans-serif;line-height:2.1}"});
  await p.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
  await assertFreshDemoBundle(p,root);
  await p.evaluate(ensureHarnessEditorRuntime);await installHpTestOnPage(p);
  await installSettingsDeviceFixture(p);await installSettingsSpaceFixture(p);
  await p.evaluate(language=>window.__card.setConfig({...window.__card._config,language}),language);
  await p.evaluate(ensureHarnessEditorRuntime);
  const saved=await p.evaluate(()=>JSON.stringify(window.__card._serverCfg));
  result.inputs[typography+'_'+language]=sha(saved);
  for(const kind of ['settings','space','room','marker']){
   await p.evaluate(async kind=>{await window.__hpTest.switchSpace(kind==='marker'?'floor01':'f1');await window.__hpTest.setMode(kind==='marker'?'devices':'plan');},kind);
   if(kind==='settings')await p.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
   else if(kind==='space')await p.evaluate(()=>window.__hpTest.openSpaceDialog('edit','f1').then(()=>null));
   else if(kind==='room')await p.evaluate(()=>window.__hpTest.openRoomEdit('r1').then(()=>null));
   else await openSettingsDeviceDialog(p,'demo_led_controller');
   const d=p.locator(`houseplan-card hp-dialog[data-kind=${kind}]`),save=d.locator('.hpf-footer .btn.on[data-hp=dialog-confirm]');
   await save.waitFor();
   for(const width of [1280,390]){
    await p.setViewportSize({width,height:900});await p.mouse.move(0,0);await p.waitForTimeout(250);
    const paint=await buttonPaint(save),id=[typography,language,kind,width].join('_');
    result.cases[id]={...paint,pass:paint.height>=44&&paint.textInkOffset!==null&&Math.abs(paint.textInkOffset)<=1.25&&Math.abs(paint.iconOffset)<=.25};
    if(kind==='settings'&&language==='ru')await save.screenshot({path:outDir+'/'+label+'-'+id+'.png'});
   }
   await d.locator('.hpf-footer [data-hp=dialog-cancel]').click();
  }
  result.savedUnchanged&&=await p.evaluate(saved=>JSON.stringify(window.__card._serverCfg)===saved,saved);
  await f.assertClean();
 }finally{result.errors.push(...f.errors);result.external.push(...f.externalRequests);await f.close();}
}
writeFileSync(outDir+'/'+label+'.json',JSON.stringify(result,null,2));
const failed=Object.entries(result.cases).filter(([,v])=>!v.pass);
console.log(JSON.stringify({label,source:result.source,cases:Object.keys(result.cases).length,failed,errors:result.errors,external:result.external}));
if(failed.length||!result.savedUnchanged||result.errors.length||result.external.length)process.exitCode=1;
