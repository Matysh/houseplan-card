import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
const root=arg('root')||process.cwd(),phase=arg('phase')||'after';
const fixture=arg('fixture')||root+'/demo/ui-lab/fixtures/settings-content.json';
const output=arg('out')||root+'/artifacts/ui-kit/settings-content-'+phase;
const load=path=>import(pathToFileURL(root+'/'+path).href);
const {chromium,expect}=await load('node_modules/playwright/test.mjs');
const {createLabServer}=await load('demo/ui-lab/server.mjs');
const {attestLaunchedBrowser}=await load('scripts/browser-attestation.mjs');
const {waitForUiKitPaint}=await load('demo/helpers/ui-kit-paint.mjs');
const {assertFreshDemoBundle}=await load('demo/bundle-freshness.mjs');
mkdirSync(output,{recursive:true});const server=createLabServer({port:0,...(fixture?{fixture}:{})});server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),profiles=[],errors=[];
try{
 const attestation=await attestLaunchedBrowser(browser,{reason:'#1149 native settings-content comparison, synthetic data and genuine pinned HA'});
 for(const theme of ['light','dark'])for(const width of [1280,1024,390]){
  const id=theme+'-'+width,profile={id,stages:[]};profiles.push(profile);const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
  try{
   await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin||['data:','blob:'].includes(u.protocol)?route.continue():route.abort()});
   const page=await context.newPage();page.on('pageerror',e=>errors.push({profile:id,error:e.message}));await page.goto(origin);
   await page.waitForFunction(()=>{const c=window.__lab?.card,r=c?.shadowRoot;return r?.querySelector('ha-card[data-hp-state=ready]')&&!r.querySelector('.bootveil')&&!r.querySelector('.stage.hpboot')});
   await assertFreshDemoBundle(page,root);
   await page.locator('#lab-launcher').click();await page.locator('#lab-theme').selectOption(theme);await page.locator('#lab-close').click();
   const capture=async(name,scope)=>{
    if(name.startsWith('zigbee'))await scope.locator('textarea').scrollIntoViewIfNeeded();
    if(name.startsWith('device-preview'))await scope.locator(name.includes('demo')?'.previewdemos':name.includes('alarm')?'.device-issues':'.previewhead').scrollIntoViewIfNeeded();await waitForUiKitPaint(page);await page.evaluate(()=>{window.getSelection()?.removeAllRanges();const root=window.__lab?.card?.shadowRoot;if(typeof root?.getSelection==='function')root.getSelection()?.removeAllRanges()});const controls=await scope.locator('input,textarea,button,.hpf-card,.hpf-callout,.hpf-disclosure > summary,.devicepreview,.previewbadge,.vacroute,.alarm-add,.alarm-remove').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.localName,classes:n.className,id:n.id,type:n.getAttribute('type'),disabled:n.disabled===true,checked:n.checked===true,width:r.width,height:r.height,font:s.font,background:s.backgroundColor,color:s.color,border:s.border,padding:s.padding,radius:s.borderRadius,shadow:s.boxShadow}}));
    if(phase.startsWith('after')) {
      if(name==='vacuum-profile')for(const note of await scope.locator('.vacxcme pre').all())await expect(note).toBeVisible();
      if(name.startsWith('zigbee'))await expect(scope.locator('textarea')).toHaveCSS('min-height','96px');
      if(name==='alarm-constructor')await expect(scope.locator('.alarm-source-field')).toHaveCSS('grid-column','1 / -1');
      if(name==='alarm-list')await expect(scope.locator('.alarm-heading')).toHaveCSS('justify-content','space-between');
      if(name==='general-color-popup')for(const c of controls.filter(c=>c.tag==='button'||['text','number'].includes(c.type)))assert.ok(c.height>=44, name+' '+c.tag+' target '+c.height);
      if(name.startsWith('summary-toggle'))for(const c of controls.filter(c=>c.id==='summary-local-show'||c.id==='summary-mobile-show'))assert.equal(c.height,44,'summary native target');
      if(name==='alarm-list')for(const c of controls.filter(c=>/alarm-(add|remove)/.test(c.classes)))assert.ok(c.height>=44&&c.width>=44,'alarm icon target');
      if(name.startsWith('device-preview-demo'))for(const c of controls.filter(c=>/previewdemo/.test(c.classes)))assert.ok(c.height>=44,'preview demo target');
      if(name.includes('radar'))for(const c of controls.filter(c=>/tempin/.test(c.classes)))assert.ok(c.height>=44,'radar field target');
    }
    const frame=id+'-'+name+'.png';await page.screenshot({path:output+'/'+frame});profile.stages.push({name,frame,controls});
   };
   const shortcut=async(name,kind=name)=>{await page.locator('#lab-launcher').click();await page.locator('[data-open="'+name+'"]').click();const shell=page.locator('hp-dialog[data-kind="'+kind+'"]');await expect(shell).toBeVisible();return shell};
   const section=async(shell,name)=>{const button=shell.locator('[data-section-target="'+name+'"]');if(await button.isVisible())await button.click();else await shell.locator('[data-field=settings-section]').selectOption(name)};
   const close=async shell=>{await shell.locator('[data-hp=dialog-cancel]').first().click();await expect(shell).toHaveCount(0)};
   const general=await shortcut('settings');await section(general,'fills');const picker=general.locator('hp-color-opacity').filter({visible:true}).first();await picker.locator('button.trigger').click();const popup=page.locator('.picker').filter({visible:true});await expect(popup).toBeVisible();await capture('general-color-popup',popup);await popup.locator('button.confirm').click();await close(general);
   const zigbee=await shortcut('settings');await section(zigbee,'zigbee');const topology=zigbee.locator('hp-zigbee-topology-settings');await expect(topology).toBeVisible();
   const enabled=topology.locator('[data-field=zigbee-enabled]'),topics=topology.locator('textarea[data-field=z2m-topics]'),wasEnabled=await enabled.isChecked(),originalTopics=await topology.evaluate(element=>element.value.z2mBaseTopics.join('\n'));
   await enabled.check();await capture('zigbee-enabled',topology);
   const longTopics=Array.from({length:5},(_,i)=>'zigbee2mqtt/synthetic-long-label-'+i+'-'+('room-'.repeat(15))).join('\n');await topics.fill(longTopics);await expect(topics).toHaveValue(longTopics);await capture('zigbee-long-topics',topology);
   await topics.fill(originalTopics);await enabled.setChecked(wasEnabled);await close(zigbee);
   const summary=await shortcut('summary');await capture('summary-toggle-on',summary);const local=summary.locator('#summary-local-show');await local.uncheck();await capture('summary-toggle-off',summary);await local.check();await close(summary);
   await page.locator('[data-hp=mode-tab][data-mode=devices]').click();
   const device=async marker=>{const node=page.locator('[data-hp=device][data-id="'+marker+'"]');await expect(node).toBeVisible();await node.dblclick();const shell=page.locator('hp-dialog[data-kind=marker]');await expect(shell).toBeVisible();return shell};
   const marker=await device('lab_ceiling');await section(marker,'appearance');const preview=marker.locator('hp-device-preview');await expect(preview).toBeVisible();await capture('device-preview',preview);
   if(fixture){
    const chooser=marker.locator('hp-settings-select:has(select#marker-display)'),originalDisplay=await marker.locator('#marker-display').inputValue();
    const chooseDisplay=async value=>{await chooser.locator('[data-hp=select-trigger]').click();await chooser.locator('[role=option][data-id="'+value+'"]').click()};
    await chooseDisplay('icon_ripple');const demos=preview.locator('.previewdemo');await expect(demos.first()).toBeEnabled();await capture('device-preview-demo-idle',preview);
    const servicesBefore=await page.evaluate(()=>window.__labSafety.services.length);await demos.first().click();await capture('device-preview-demo-short',preview);await demos.nth(1).click();await expect(demos.first()).toBeDisabled();await capture('device-preview-demo-continuous',preview);await demos.nth(1).click();
    assert.equal(await page.evaluate(()=>window.__labSafety.services.length),servicesBefore,'preview demos must not invoke HA services');await chooseDisplay(originalDisplay);
   }
   await close(marker);
   const alarm=await device('lab_co2');await section(alarm,'alarms');await capture('alarm-list',alarm);await alarm.locator('.alarm-add').click();const constructor=page.locator('hp-dialog[data-kind=alarm-constructor]');await expect(constructor).toBeVisible();await capture('alarm-constructor',constructor);await close(constructor);await close(alarm);
   const vacuum=await device('lab_robot');await section(vacuum,'vacuum');await capture('vacuum-profile',vacuum);if(fixture){await vacuum.locator('.vacroute').first().scrollIntoViewIfNeeded();await capture('vacuum-route-actions',vacuum)}await close(vacuum);
   if(fixture){
    const leak=await device('lab_leak');await section(leak,'appearance');const issuePreview=leak.locator('hp-device-preview');await expect(issuePreview.locator('.device-issues')).toBeVisible();await capture('device-preview-alarm',issuePreview);await issuePreview.locator('.hpf-disclosure > summary').first().click();await capture('device-preview-alarm-details',issuePreview);await close(leak);
    const radar=await device('lab_radar');await section(radar,'radar');await expect(radar.locator('[data-field=radar-mount-x]')).toBeVisible();await radar.locator('[data-field=radar-mount-x]').scrollIntoViewIfNeeded();await capture('radar-coordinate-fields',radar);await close(radar);
   }
   console.log('PASS '+id+': '+profile.stages.length+' native content states');
  }catch(error){profile.error=error.stack;errors.push({profile:id,error:error.message});console.log('FAIL '+id+': '+error.message)}finally{await context.close()}
  writeFileSync(output+'/captures.json',JSON.stringify({kind:phase+' comparison only; no baseline acceptance',fixtureSha256:createHash('sha256').update(readFileSync(fixture||root+'/demo/ui-lab/fixture.json')).digest('hex'),syntheticOnly:true,fingerprint:JSON.parse(readFileSync(root+'/dist/houseplan-assets.json','utf8')).fingerprint,attestation,profiles,errors},null,2)+'\n');
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
