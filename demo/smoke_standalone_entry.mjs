/** Actual standalone distribution + stdio Python core, no HA bootstrap. */
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { launchPanelCold,finish,requirePinnedBrowser } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
import { buildStandalone,standalonePath,verifyStandaloneManifest } from '../scripts/standalone-build.mjs';
import { PLAN_ONLY_CAPABILITIES } from '../test-build/plan-capabilities.js';
import { standaloneFixture } from './standalone/fixture.mjs';
import { createCoreProcess } from './standalone/core-process.mjs';
import { resourceProbes } from './standalone/resource-probes.mjs';
import { measureStandalone } from './standalone/measure.mjs';

requirePinnedBrowser('smoke_standalone_entry');
const dir=resolve('artifacts/standalone-entry');mkdirSync(dir,{recursive:true});
const treeHash=directory=>{
  const hash=createHash('sha256');let files=0;
  const walk=(path,prefix='')=>{for(const item of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(item.isDirectory())walk(resolve(path,item.name),prefix+item.name+'/');
    else{hash.update(prefix+item.name);hash.update(readFileSync(resolve(path,item.name)));files++;}
  }};walk(directory);return {sha256:hash.digest('hex'),files};
};
const haBefore=treeHash(resolve('dist'));
const manifest=await buildStandalone();verifyStandaloneManifest(resolve('dist-standalone'),manifest);
const haAfter=treeHash(resolve('dist'));assert.deepEqual(haAfter,haBefore,'standalone build must not change a single HA output byte/path');
const core=await createCoreProcess({config:standaloneFixture(),fingerprint:manifest.source.fingerprint,version:manifest.version});
const {page,browser}=await launchPanelCold({width:1280,height:900});
page.setDefaultTimeout(12000);
const evidence={source:manifest.source,python:core.info,haBefore,haAfter,checks:['ha-output-byte-identical-after-standalone-build'],requests:[],pageErrors:[],samples:[],complete:false};
const started=performance.now();
page.on('request',request=>evidence.requests.push(request.url()));
page.on('pageerror',error=>evidence.pageErrors.push(error.message));
try{
  await page.route('**/standalone-test',route=>route.fulfill({contentType:'text/html',body:readFileSync('demo/standalone/index.html')}));
  await page.route('**/standalone-dist/**',route=>{
    const path=new URL(route.request().url()).pathname.slice('/standalone-dist/'.length);
    const type=path.endsWith('.css')?'text/css':path.endsWith('.ttf')?'font/ttf':'text/javascript';
    return route.fulfill({contentType:type,body:readFileSync(standalonePath(resolve('dist-standalone'),path))});
  });
  await page.route('**/standalone-host.js',route=>route.fulfill({contentType:'text/javascript',body:readFileSync('demo/standalone/host.js')}));
  await page.route('**/standalone-core-rpc',async route=>{
    try{await route.fulfill({json:await core.rpc(route.request().postDataJSON())});}
    catch(error){await route.fulfill({json:{error:{code:error.code||'test_core_error',message:error.message}}});}
  });
  if(!process.argv.includes('--resources-only')&&!process.argv.includes('--measure-only')){
  await page.goto('http://demo.local/standalone-test');
  await page.evaluate(async capabilities=>{
    const api=window.__mountApi=await import('/standalone-dist/houseplan-standalone.js');
    if(customElements.get('houseplan-card'))throw Error('Standalone import registered the card eagerly');
    const {createCorePlanHost}=await import('/standalone-host.js');
    window.__lab=createCorePlanHost(capabilities);
    window.__mount=api.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});
    window.__card=await window.__mount.ready;
  },PLAN_ONLY_CAPABILITIES);
  await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting);
  evidence.samples.push({kind:'cold-mount-and-first-plan',readyMs:performance.now()-started,viewport:{width:1280,height:900},cache:'fresh document/context',network:'local routed files + real stdio core'});
  await waitForUiKitPaint(page);
  const card=page.locator('houseplan-card');
  assert.deepEqual(await page.evaluate(()=>({hass:window.__card.hass===undefined,haHost:window.__card._haPlanHost===undefined,
    root:!document.querySelector('home-assistant'),picker:window.customCards===undefined,
    haControls:['ha-dialog','ha-switch','ha-slider'].filter(name=>customElements.get(name))})),
    {hass:true,haHost:true,root:true,picker:true,haControls:[]});
  assert.equal(await page.evaluate(()=>document.fonts.check('400 14px Roboto')),true);
  assert.ok(await card.locator('ha-icon.tabedit').first().evaluate(icon=>{
    const target=icon.getBoundingClientRect(),glyph=icon.shadowRoot.querySelector('svg').getBoundingClientRect();
    const declared=Number.parseFloat(getComputedStyle(icon).getPropertyValue('--mdc-icon-size'));
    return target.width>=44&&Math.abs(glyph.width-declared)<.5&&glyph.width<target.width;
  }),'navigation keeps its 44px hit target while the glyph respects the existing 20px token');
  assert.ok(evidence.requests.some(url=>url.includes('/fonts/Roboto-Regular-')),'real locally served font requested');
  assert.equal(evidence.requests.some(url=>/houseplan-editor-runtime-/.test(url)),false,'cold View does not request the editor');
  await page.screenshot({path:resolve(dir,'cold-light.png')});
  await clickHeaderAction(card,'mode-plan');
  await card.locator('[data-hp="tool"][data-tool="select"]').click();
  await card.locator('[data-hp="zoom-fit"]').click();
  await waitForUiKitPaint(page);
  await card.locator('[data-hp="partition"][data-id="wall"]').click();
  const properties=card.locator('[data-hp="properties-panel"]');
  await properties.locator('[data-property="cm"] input').fill('14');
  await properties.locator('[data-property="cm"] input').press('Enter');
  await page.waitForFunction(async()=>{const state=await window.__lab.snapshot();return state.config.spaces[0].partitions.find(w=>w.id==='wall').cm===14;});
  await card.locator('[data-hp="room-settings"][data-room="room"]').click();
  const room=card.locator('hp-dialog[data-kind="room"]');await room.waitFor();
  await room.locator('#room-name').fill('Saved by the real core');
  await room.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(async()=>{const state=await window.__lab.snapshot();return state.config.spaces[0].rooms[0].name==='Saved by the real core';});
  const saved=(await core.rpc({op:'snapshot'})).result;
  assert.equal(saved.haImported,false);assert.equal(saved.config.markers[0].binding,'entity:light.kept');
  assert.equal(await page.evaluate(()=>window.customCards===undefined&&!customElements.get('houseplan-space-card')),true,
    'lazy editor startup also stays free of static-card/picker registration');
  assert.equal(saved.config.spaces[0].openings[0].contact,'binary_sensor.door');
  await page.evaluate(()=>window.__mount.dispose());
  assert.deepEqual(await page.evaluate(()=>[window.__lab.listenerCount,window.__lab.subscriptionCount]),[0,0]);
  await page.evaluate(async()=>{window.__mount=window.__mountApi.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});window.__card=await window.__mount.ready;});
  await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting);
  assert.equal(await card.locator('[data-hp="room-label"][data-id="room"]').textContent().then(text=>text.includes('Saved by the real core')),true);
  evidence.checks.push('no-ha-application-adapter-picker','local-roboto','cold-editor-lazy','ui-wall-edit-core-save','ui-room-save','hidden-bindings-retained','dispose-releases-own-leases','remount-reads-core');
  await clickHeaderAction(card,'settings');
  await card.locator('[data-hp="settings-section"][data-section="data"]').click();
  await card.locator('[data-action="backup-export-open"]').click();
  const backup=card.locator('hp-dialog[data-kind="backup"]');await backup.waitFor();
  const downloadPromise=page.waitForEvent('download');await backup.locator('[data-hp="dialog-confirm"]').click();
  const download=await downloadPromise,stream=await download.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  const bytes=Buffer.concat(chunks),document=JSON.parse(bytes);
  assert.equal(document.kind,'space');assert.deepEqual(document.payload.config.markers,[]);
  if(await backup.count()){await page.keyboard.press('Escape');await backup.waitFor({state:'detached'});}
  await clickHeaderAction(card,'settings');
  await card.locator('[data-hp="settings-section"][data-section="data"]').click();
  await card.locator('[data-field="backup-file"]').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:bytes});
  await backup.waitFor();const confirmation=backup.locator('[data-field="backup-confirm-missing"]');if(await confirmation.count())await confirmation.check();
  await backup.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(async()=>{const state=await window.__lab.snapshot();return state.config.spaces.length===3;});
  const transferred=(await core.rpc({op:'snapshot'})).result;
  const added=transferred.config.spaces.find(space=>!['local','upper'].includes(space.id));
  assert.equal(added.rooms[0].name,'Saved by the real core');
  assert.equal(added.stairs[0].target_space_id,null);assert.equal(added.openings[0].contact,undefined);
  assert.deepEqual(transferred.config.markers,saved.config.markers);
  evidence.checks.push('ui-download-real-core-projection','ui-import-core-preview-apply','single-space-remap-and-cross-floor-detach');
  const full=structuredClone(document);delete full.transfer;full.kind='full';
  const future=structuredClone(document);future.model_version=1000;
  for(const [name,mimeType,buffer] of [['installation.zip','application/zip',Buffer.from([80,75,3,4,0,0,0,0])],
    ['installation.json','application/json',Buffer.from(JSON.stringify(full))],['future.json','application/json',Buffer.from(JSON.stringify(future))]]){
    await clickHeaderAction(card,'settings');
    await card.locator('[data-hp="settings-section"][data-section="data"]').click();
    await card.locator('[data-field="backup-file"]').setInputFiles({name,mimeType,buffer});
    await backup.waitFor();await backup.locator('.backuperror[role="alert"]').waitFor();
    assert.equal(await backup.locator('[data-hp="dialog-confirm"]:enabled').count(),0,'unsupported document has no active Apply');
    assert.deepEqual((await core.rpc({op:'snapshot'})).result.config,transferred.config,'refused import leaves authoritative config unchanged');
    await backup.getByRole('button',{name:'Cancel',exact:true}).click();await backup.waitFor({state:'detached'});
  }
  evidence.checks.push('ui-zip-full-json-and-future-model-refused-without-partial-write');
  // Real forms with deliberately failed wire responses. No failed save may
  // become a successful store mutation just because the local draft painted.
  const beforeFailure=JSON.stringify(transferred.config);
  await clickHeaderAction(card,'settings');
  const general=card.locator('hp-dialog[data-kind="settings"]');await general.waitFor();
  await general.locator('[data-hp="settings-section"][data-section="display"]').click();
  const toggle=general.locator('#gs-room-tooltip'),initialToggle=await toggle.isChecked();
  await toggle.click();await page.evaluate(()=>window.__lab.failNext('conflict'));
  await general.locator('[data-hp="dialog-confirm"]').click();
  await card.locator('[data-hp="toast"][data-id="toast.error"]').waitFor();
  await page.waitForFunction(()=>window.__card._settingsDialog&&!window.__card._settingsDialog.busy);
  assert.equal(await general.isVisible(),true);assert.equal(await toggle.isChecked(),!initialToggle);
  assert.equal(JSON.stringify((await core.rpc({op:'snapshot'})).result.config),beforeFailure);
  await toggle.click();await page.keyboard.press('Escape');await general.waitFor({state:'detached'});
  if(!await general.isVisible())await clickHeaderAction(card,'settings');await general.waitFor();
  await general.locator('[data-hp="settings-section"][data-section="display"]').click();
  if(await general.locator('#gs-room-tooltip').isChecked()===initialToggle)await general.locator('#gs-room-tooltip').click();
  await general.locator('[data-hp="dialog-confirm"]').evaluate(button=>{
    window.__lab.permissions({read:true,write:false,admin:false});
    button.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
  });
  await page.waitForFunction(()=>!window.__card.planHost.environment.permissions.write);
  assert.equal(JSON.stringify((await core.rpc({op:'snapshot'})).result.config),beforeFailure);
  await page.evaluate(()=>window.__mount.dispose());
  assert.deepEqual(await page.evaluate(()=>[window.__lab.listenerCount,window.__lab.subscriptionCount]),[0,0]);
  await page.evaluate(async()=>{window.__lab.permissions({read:true,write:true,admin:true});
    window.__mount=window.__mountApi.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});
    window.__card=await window.__mount.ready;});
  await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting);
  if(!await general.isVisible())await clickHeaderAction(card,'settings');await general.waitFor();
  await general.locator('[data-hp="settings-section"][data-section="display"]').click();
  if(await general.locator('#gs-room-tooltip').isChecked()===initialToggle)await general.locator('#gs-room-tooltip').click();
  await page.evaluate(()=>window.__lab.holdNext(new Promise(resolve=>{window.__releaseSave=resolve;})));
  await general.locator('[data-hp="dialog-confirm"]').click();
  await page.evaluate(()=>{window.__lab.replace();window.__releaseSave();});
  await page.waitForFunction(()=>window.__lab.pendingCount===0);
  if(await general.count())assert.equal(await general.locator('[data-hp="dialog-confirm"]').isDisabled(),true,'retired Apply cannot act in the new authority');
  assert.equal(JSON.stringify((await core.rpc({op:'snapshot'})).result.config),beforeFailure);
  await page.evaluate(()=>window.__mount.dispose());
  await page.evaluate(async()=>{
    window.__lab.handshake({frontend_fingerprint:'0'.repeat(64)});
    window.__mount=window.__mountApi.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});
    try{await window.__mount.ready;throw Error('Incompatible host was accepted');}catch(error){if(error.code!=='standalone_host_incompatible')throw error;}
  });
  const errorCopy=await page.locator('#host [role="alert"]').textContent();
  assert.ok(errorCopy.includes('House Plan host'));assert.doesNotMatch(errorCopy,/HACS|Home Assistant/);
  await page.evaluate(()=>window.__mount.dispose());
  for(const mismatch of [{frontend_fingerprint:'0'.repeat(64)},{integration_version:'0.0.1'},{plan_graph_api:0}]){
    await page.evaluate(async()=>{window.__lab.handshake({});
      window.__mount=window.__mountApi.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});
      window.__card=await window.__mount.ready;});
    await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting);
    await page.evaluate(patch=>{window.__lab.handshake(patch);window.__lab.connection(false);},mismatch);
    await page.waitForFunction(()=>!window.__card.planHost.environment.connected);
    await page.evaluate(()=>window.__lab.connection(true));
    const notice=page.locator('#host [role="alert"]');await notice.waitFor();
    const copy=await notice.textContent();assert.ok(copy.includes('House Plan host'));
    assert.doesNotMatch(copy,/HACS|Home Assistant|Integration/);
    assert.equal(await card.count(),0,'the incompatible mounted editor is disconnected');
    assert.deepEqual(await page.evaluate(()=>[window.__lab.listenerCount,window.__lab.subscriptionCount]),[0,0]);
    assert.equal(JSON.stringify((await core.rpc({op:'snapshot'})).result.config),beforeFailure);
    await page.evaluate(()=>window.__mount.dispose());
  }
  evidence.checks.push('post-mount-reconnect-fingerprint-version-api-mismatch-retires-editor');
  await page.evaluate(async()=>{window.__lab.handshake({});
    window.__mount=window.__mountApi.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});window.__card=await window.__mount.ready;});
  await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting);
  evidence.checks.push('failed-save-keeps-draft','read-only-retires-old-apply','authority-replacement-rejects-held-save','incompatible-host-message-without-ha-advice');
  if(await general.isVisible()){
    await general.locator('[data-hp="settings-section"][data-section="display"]').click();
    if(await general.locator('#gs-room-tooltip').isChecked()!==initialToggle)await general.locator('#gs-room-tooltip').click();
    await page.keyboard.press('Escape');await general.waitFor({state:'detached'});
  }
  for(const width of [1280,390])for(const darkMode of [false,true])for(const language of ['en','ru','de','fr']){
    await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:darkMode?'dark':'light'});
    await page.evaluate(options=>window.__mount.updatePresentation(options),{language,darkMode});
    await clickHeaderAction(card,'settings');await general.waitFor();await waitForUiKitPaint(page);
    assert.ok(await general.evaluate(dialog=>{const body=dialog.querySelector('.body'),r=dialog.shadowRoot.querySelector('.surface').getBoundingClientRect();
      return r.left>=-1&&r.right<=innerWidth+1&&body.scrollWidth<=body.clientWidth+1;}),'native settings fit the actual viewport');
    const closeName={en:'Close',ru:'Закрыть',de:'Schließen',fr:'Fermer'}[language];
    await general.getByRole('button',{name:closeName,exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>{
      const bad=[];const walk=root=>{for(const el of root.querySelectorAll('*')){
        if((el.localName.includes('-')&&!customElements.get(el.localName))||el.hasAttribute('data-hp-standalone-fallback'))bad.push(el.localName);
        if(el.shadowRoot)walk(el.shadowRoot);
      }};walk(document.querySelector('#host'));return bad;
    }),[],'settled real forms have no undefined components or unexpected SVG fallback');
    await page.screenshot({path:resolve(dir,`settings-${width}-${darkMode?'dark':'light'}-${language}.png`)});
    await page.keyboard.press('Escape');await general.waitFor({state:'detached'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  evidence.checks.push('four-language-theme-viewport-matrix');
  await page.evaluate(()=>window.__mount.updatePresentation({language:'en'}));
  const narrowAudit=async(kind,dialog)=>{
    await dialog.waitFor();await waitForUiKitPaint(page);
    assert.ok(await dialog.evaluate(el=>{
      const box=el.shadowRoot.querySelector('.surface').getBoundingClientRect(),body=el.querySelector('.body');
      const nav=el.querySelector('.hpf-settings-mobile');
      return box.left>=-1&&box.right<=innerWidth+1&&(!body||body.scrollWidth<=body.clientWidth+1)
        &&(!nav||nav.getBoundingClientRect().height<90);
    }),`${kind}: native mobile layout fits without a stretched navigation row`);
    await page.screenshot({path:resolve(dir,`${kind}-390-dark.png`)});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  };
  // Editors remain desktop-first; open the real forms with their ordinary
  // buttons, then verify their responsive native shell at the narrow width.
  await page.setViewportSize({width:1280,height:900});
  await card.locator('[data-hp="space-settings"]:visible').first().click();
  await page.setViewportSize({width:390,height:900});
  await narrowAudit('space',card.locator('hp-dialog[data-kind="space"]'));
  await page.setViewportSize({width:1280,height:900});
  await clickHeaderAction(card,'mode-plan');
  await card.locator('[data-hp="room-settings"]:visible').first().click();
  await page.setViewportSize({width:390,height:900});
  await narrowAudit('room',card.locator('hp-dialog[data-kind="room"]'));
  await page.setViewportSize({width:1280,height:900});
  await card.locator('[data-hp="editor-close"]:visible').first().click();
  evidence.checks.push('native-space-and-room-at-390px');
  }
  if(!process.argv.includes('--measure-only'))await resourceProbes(page,PLAN_ONLY_CAPABILITIES,evidence,dir);
  if(!process.argv.includes('--resources-only')){
    evidence.measurements=await measureStandalone(browser,manifest,PLAN_ONLY_CAPABILITIES);
    evidence.checks.push('three-identical-fresh-context-actual-editor-measurements');
  }
  assert.deepEqual(evidence.pageErrors,[]);
  assert.ok(evidence.requests.every(url=>new URL(url).origin==='http://demo.local'),'all UI requests are local, host explicitly routed');
  evidence.trace=(await core.rpc({op:'snapshot'})).result.trace;evidence.complete=true;
  console.log(JSON.stringify({...evidence,requests:evidence.requests.length,measurements:evidence.measurements?.map(m=>({
    sample:m.sample,coldReadyMs:m.coldReadyMs,editorReadyMs:m.editorReadyMs,rawColdDeliveredBytes:m.rawColdDeliveredBytes,
    gzipColdEquivalentBytes:m.gzipColdEquivalentBytes,rawThroughEditorDeliveredBytes:m.rawThroughEditorDeliveredBytes,requests:m.allRequests.length}))}));
}catch(error){await page.screenshot({path:resolve(dir,'failure.png')});
  console.error('standalone state',await page.evaluate(()=>({text:window.__card?.shadowRoot?.textContent?.slice(-1800),commands:window.__lab?.commands?.slice(-5)})));throw error;
}finally{
  const name=process.argv.includes('--resources-only')?'resources-evidence.json':process.argv.includes('--measure-only')?'measurement-evidence.json':'evidence.json';
  writeFileSync(resolve(dir,name),JSON.stringify(evidence,null,2));await finish(browser);await core.close();
}
