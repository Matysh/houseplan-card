// #956: actual paint after a public failed Save, not CSS visibility/DOM count.
import {checkAll,finish,watchPage} from './serve.mjs';
import {launchHaDialogFixture,applyHaDialogTypography} from './helpers/ha-dialog-fixture.mjs';
import {ensureHarnessEditorRuntime} from './editor-runtime-compat.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {toastPaint} from './helpers/toast-paint-956.mjs';
import {fileURLToPath} from 'node:url';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
import {writeFileSync} from 'node:fs';
const matrix=process.argv.includes('--matrix'),results=[];
const lifecycle=process.argv.includes('--lifecycle');
const onlyForm=process.argv.find(v=>v.startsWith('--form='))?.slice(7);
const fixture=await launchHaDialogFixture({authentic:!process.argv.includes('--native'),viewport:{width:390,height:820},colorScheme:'dark',extraModules:['16213']});
const {page,browser}=fixture,out={};watchPage(page);
try{
 for(const form of onlyForm?[onlyForm]:matrix?['room','general','space','device']:['room'])for(const [width,height] of matrix?[[390,820],[1280,900]]:[[390,820]])for(const theme of matrix?['light','dark']:['dark']){
 await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});
 await page.goto(fixture.url+'/product.html');if(!process.argv.includes('--native'))await applyHaDialogTypography(page);
 await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
 await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));
 await page.evaluate(ensureHarnessEditorRuntime);await installHpTestOnPage(page);
 if(form==='device')await installSettingsDeviceFixture(page);
 await page.evaluate(async()=>{
  const c=window.__card,p=matchMedia('(prefers-color-scheme:dark)').matches?['#17222e','#e7eef4','#67cfe8']:['#fff','#223039','#008aa5'];
  ['--card-background-color','--primary-text-color','--primary-color'].forEach((k,i)=>c.style.setProperty(k,p[i]));
 });
 await page.evaluate(async form=>{
  await window.__hpTest.waitForWrites();const c=window.__card,original=c.hass.callWS.bind(c.hass);
  window.__toast956Write={count:0,reject:1,times:[],before:JSON.stringify(c._serverCfg)};
  c.hass={...c.hass,callWS:async message=>{
   if(message.type==='houseplan/config/set'){
    const w=window.__toast956Write;w.times.push(Date.now());
    if(++w.count<=w.reject)throw Object.assign(new Error('save-rejected-956'),{code:'unknown_error'});
   }
   return original(message);
  }};
  await window.__hpTest.setMode(form==='device'?'devices':'plan');
  if(form==='room')await window.__hpTest.openRoomEdit('r1');
  if(form==='space')await window.__hpTest.openSpaceDialog('edit','f1');
 },form);
 if(form==='general'){
  const button=page.locator('houseplan-card [data-hp=settings]');
  if(await button.isVisible())await button.click();
  else{await page.locator('houseplan-card [data-hp=header-menu]').click();await page.locator('houseplan-card [data-hp=header-menu-item][data-id=settings]').click();}
 }
 if(form==='device')await openSettingsDeviceDialog(page,'demo_living_climate');
 const kind={room:'room',general:'settings',space:'space',device:'marker'}[form],dialog=page.locator(`houseplan-card hp-dialog[data-kind=${kind}]`);
 const name=dialog.locator({room:'#room-name',general:'#gs-room-tooltip',space:'#space-title',device:'#marker-name'}[form]);
 const save=dialog.locator('[data-hp=dialog-confirm]');
 let draft;
 if(form==='general'){draft=!(await name.isChecked());await name.setChecked(draft);}
 else{draft=(await name.inputValue())+' · retry';await name.fill(draft);await name.press('Tab');}
 // Wait out HA's genuine entry animation before measuring notification-only geometry.
 await page.waitForTimeout(300);
 const shape=async()=>({header:await dialog.evaluate(d=>{const r=d.shadowRoot.querySelector('.header,.header-title-slot').getBoundingClientRect();return [r.x,r.y,r.width,r.height];}),footer:await save.boundingBox(),outer:await dialog.locator('dialog').boundingBox()});
 if(lifecycle)await page.evaluate(()=>{
  window.__toast956Announcements=[];const seen=new WeakSet();
  const watch=root=>{
   if(seen.has(root))return;seen.add(root);
   new MutationObserver(records=>{
    for(const r of records){
     const n=r.target.nodeType===Node.TEXT_NODE?r.target.parentElement:r.target;
     if(n?.matches?.('[data-hp=toast]')&&n.getAttribute('role')==='alert'&&n.getAttribute('aria-live')==='assertive'&&n.textContent)
      window.__toast956Announcements.push(n.textContent);
     for(const added of r.addedNodes)scan(added);
    }
   }).observe(root,{subtree:true,childList:true,characterData:true});
   scan(root);
  };
  const scan=node=>{if(node.shadowRoot)watch(node.shadowRoot);for(const child of node.childNodes||[])scan(child);};
  watch(window.__card.shadowRoot);
 });
 const before=await shape();await save.click();
 await page.waitForFunction(()=>window.__toast956Write.count===1);await page.evaluate(()=>window.__hpTest.settled());
 const notice=page.locator('houseplan-card [data-hp=toast][data-kind=message]');await notice.waitFor();
 const prefix=`${form}-${width}-${theme}-${process.argv.includes('--native')?'native':'ha'}`;
 const paint=await toastPaint(page,notice,'artifacts/956/'+prefix);
 console.log(prefix+' notice glyph paint:',JSON.stringify(paint));out[prefix+'_failureTextIsPainted']=paint.painted;
 out[prefix+'_localizedWriterError']=/^(Error:\s*code|Ошибка:\s*код) unknown_error$/.test(paint.text);
 out[prefix+'_draftAndAcceptedConfig']=(form==='general'?await name.isChecked()===draft:await name.inputValue()===draft)&&await save.isEnabled()&&await page.evaluate(()=>JSON.stringify(window.__card._serverCfg)===window.__toast956Write.before);
 const after=await shape();out[prefix+'_geometryUnchanged']=JSON.stringify(before)===JSON.stringify(after);
 out[prefix+'_oneAccessibleAlert']=(await page.getByRole('alert').count())===1;
 let cdp;
 if(lifecycle){
  const text=paint.text;
  out.oneAnnouncementForNewMessage=await page.evaluate(()=>window.__toast956Announcements.length===1);
  cdp=await page.context().newCDPSession(page);const ax=await cdp.send('Accessibility.getFullAXTree');
  out.actualAXAlert=ax.nodes.filter(n=>!n.ignored&&n.role?.value==='alert').length===1;
  await name.focus();await page.keyboard.press('Escape');
  const confirm=page.locator('houseplan-card hp-dialog[data-kind=confirm]');await confirm.waitFor();
  await confirm.locator('[data-hp=toast]').waitFor();
  out.childOwnsOnlyNotice=await notice.count()===1&&await confirm.locator('[data-hp=toast]').count()===1&&await notice.getAttribute('aria-live')==='off'&&await page.getByRole('alert').count()===0;
  const childPaint=await toastPaint(page,notice,'artifacts/956/confirm-'+(process.argv.includes('--native')?'native':'ha'));
  out.childNoticePainted=childPaint.painted;
  // #976/#1155: the parent's native modal remains until its owner accepts
  // Discard. The child confirmation owns current input above that modal.
  out.parentRemainsModal=await dialog.locator('dialog').evaluate(element=>element.matches(':modal'));
  out.confirmationIsModal=await confirm.locator('dialog').evaluate(element=>element.matches(':modal'));
  // Cancel keeps editing; it must not be intercepted by the passive message.
  await confirm.locator('button[data-hp=dialog-cancel]').last().click();await confirm.waitFor({state:'detached'});
  await name.waitFor({state:'visible'});await dialog.locator('[data-hp=toast]').waitFor();await name.press('End');await name.type('!');await name.press('Backspace');
  out.focusAndInputKept=await name.inputValue()===draft&&await name.evaluate(n=>n.getRootNode().activeElement===n);
  out.routeDoesNotAnnounce=await page.evaluate(()=>window.__toast956Announcements.length===1);
  await page.waitForTimeout(1000);
  await page.evaluate(()=>window.__toast956Write.reject=2);await save.click();
  await page.waitForFunction(()=>window.__toast956Announcements.length===2);
  out.repeatedTextAnnouncesAsNew=await notice.innerText()===text&&await page.getByRole('alert').count()===1;
 }
 await save.click();await dialog.waitFor({state:'detached'});
 out[prefix+'_retryExactlyOnce']=await page.evaluate(({form,draft})=>{
  const cfg=window.__card._serverCfg;
  const accepted=form==='room'?cfg.spaces.flatMap(s=>s.rooms||[]).find(r=>r.id==='r1')?.name:form==='space'?cfg.spaces.find(s=>s.id==='f1')?.title:form==='device'?cfg.markers.find(m=>m.id==='demo_living_climate')?.name:cfg.settings.show_room_tooltip;
  return window.__toast956Write.count===(window.__toast956Write.reject+1)&&accepted===draft;
 },{form,draft});
 if(lifecycle){
  out.rootReceivesSameNotice=await page.locator('houseplan-card [data-hp=toast-portal] > [data-hp=toast]').count()===1;
  out.rootNoticePainted=(await toastPaint(page,notice,'artifacts/956/root-'+(process.argv.includes('--native')?'native':'ha'))).painted;
  const remaining=await page.evaluate(()=>Math.max(0,window.__toast956Write.times[0]+3600-Date.now()));await page.waitForTimeout(remaining);
  out.oldTimerCannotClearReplacement=await notice.count()===1;
  await notice.waitFor({state:'detached',timeout:4500});
  const age=await page.evaluate(()=>Date.now()-window.__toast956Write.times[1]);out.expiryNotRestartedByOwner=age>=3400&&age<4400;
  out.noMoreAnnouncementsOrWrites=await page.evaluate(()=>window.__toast956Announcements.length===3&&window.__toast956Write.count===3);
  console.log('announcement log',await page.evaluate(()=>window.__toast956Announcements));
  await page.evaluate(async()=>{window.__toast956Write.reject=4;await window.__hpTest.openRoomEdit('r1');});
  await name.fill(draft+' detached');await name.press('Tab');await save.click();await notice.waitFor();
  await page.evaluate(async()=>{const c=window.__card,parent=c.parentNode;c.remove();parent.append(c);await c.updateComplete;});
  out.detachClearsNotice=await notice.count()===0;
  await cdp.detach();
 }
 results.push({case:prefix,paint,before,after});
 }
 writeFileSync('artifacts/956/'+(matrix?'matrix':lifecycle?'lifecycle':'quick')+(process.argv.includes('--native')?'-native':'-ha')+'.json',JSON.stringify({out,results},null,2));
 await fixture.assertClean();checkAll(out);await finish(browser,out);
}finally{await fixture.close();}
