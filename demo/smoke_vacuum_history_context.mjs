// #999: public UI and transport lifecycle; no writes to product private state.
import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
import {prepareVacuumHistory,openVacuumHistory,chooseVacuumHistory,HISTORY_IDS as ids} from './helpers/vacuum-history.mjs';
import {writeFileSync} from 'node:fs';
requirePinnedBrowser();
const {page,browser}=await launchColdView();page.setDefaultTimeout(15000);
const out={};
const settled=()=>page.evaluate(()=>window.__hpTest.settled());
const reset=async()=>{
 await page.evaluate(async()=>{const w=window.__history999;w.hold=false;await w.remount();});
 await page.waitForFunction(()=>window.__card._loadOk);
};
const noPreview=()=>page.evaluate(()=>!window.__card._vacHistory.shown&&!window.__card.renderRoot.querySelector('[data-hp=vacuum-history-banner]'));
try{
 await prepareVacuumHistory(page,{peer:false});
 await page.evaluate(async()=>{
  window.__addRegistryEntity('vacuum.other999',null,'docked');
  const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,'vacuum.other999':{state:'docked',attributes:{}}}};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,
   spaces:[...cfg.spaces,{...cfg.spaces[0],id:'history-other-space',title:'Other floor',rooms:[]}],
   markers:[...cfg.markers,{id:'other999',space:'f1',binding:'entity:vacuum.other999'}]}));
  await window.__hpTest.setLayout(layout=>({...layout,other999:{s:'f1',x:.3,y:.1}}));
 });
 let ui=await openVacuumHistory(page),trigger=ui.history.locator('hp-settings-select button');
 await trigger.focus();await trigger.press('Enter');
 out.keyboard_open=await ui.history.locator('[role=listbox]').isVisible();
 await page.keyboard.press('Escape');
 out.escape_list_keeps_dialog_and_focus=await ui.dialog.isVisible()&&await trigger.evaluate(e=>e.getRootNode().activeElement===e);
 await trigger.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');
 out.keyboard_select=!!(await ui.history.locator('select').inputValue());
 await page.keyboard.press('Escape');await settled();
 out.escape_dialog_closes=!(await ui.dialog.isVisible());
 for(const retirement of ['hide','space','other-vacuum','connection','auth','new-cleanup','reload','catalog']){
  await reset();ui=await openVacuumHistory(page);
  if(retirement==='hide'){
   await chooseVacuumHistory(page,ui.history,ids.b);await ui.show.click();
   await page.waitForFunction(()=>window.__card._vacHistory.visible);
  }
  await chooseVacuumHistory(page,ui.history,ids.a);
  await page.evaluate(()=>{window.__history999.hold=true;});await ui.show.click();
  await page.waitForFunction(()=>window.__history999.pending.length===1);
  if(retirement==='hide')await ui.hide.click();
  else if(retirement==='connection'||retirement==='auth')await page.evaluate(kind=>{
   const c=window.__card;c.hass={...c.hass,...(kind==='connection'?{connection:{...c.hass.connection}}:{user:{...c.hass.user,id:'another-writer'}})};
  },retirement);
  else if(retirement==='new-cleanup')await page.evaluate(async()=>{const w=window.__history999;w.epoch=(w.epoch[0]==='c'?'d':'c').repeat(32);await w.publish();});
  else if(retirement==='reload')await page.evaluate(()=>window.__history999.remount());
  else {
   await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
   if(retirement==='space')await page.evaluate(()=>window.__hpTest.switchSpace('history-other-space'));
   if(retirement==='other-vacuum')await page.locator('houseplan-card').first().locator('[data-hp=device][data-id=other999]').click();
   if(retirement==='catalog'){
    await page.evaluate(()=>{const w=window.__history999;w.revision=(w.revision[0]==='f'?'e':'f').repeat(64);});
    ui=await openVacuumHistory(page);
   }
  }
  await settled();await page.evaluate(()=>window.__history999.pending.shift().resolve());await settled();
  out[`held_get_retired_${retirement}`]=await noPreview();
  if(retirement==='space')await page.evaluate(()=>window.__hpTest.switchSpace('f1'));
 }
 await page.evaluate(()=>{const w=window.__history999;w.originalMaterial=w.material;});
 for(const retirement of ['close','connection','space','other-vacuum','reload']){
  console.log('held list case',retirement);
  await page.evaluate(()=>{window.__history999.listError='unavailable';});await reset();
  const retryUi=await openVacuumHistory(page),dialog=retryUi.dialog;
  await page.evaluate(()=>{const w=window.__history999;w.listError=null;w.listHold=true;});
  await retryUi.history.locator('[data-hp=vacuum-history-retry]').click();
  try{await page.waitForFunction(()=>window.__history999.pendingLists.length>=1);}
  catch(error){console.log('held list observation',await page.evaluate(()=>({pending:window.__history999.pendingLists.length,
   requests:window.__history999.requests.slice(-3),reason:window.__card._vacHistory.reason,loading:window.__card._vacHistory.loadingList,
   context:window.__card._vacHistory.markerId,listHold:window.__history999.listHold,
   cap:window.__card._haVacuumHistoryApi,canEdit:window.__card._canEdit,
   section:window.__card._markerDialog?.section,catalog:window.__card._vacHistory.catalog})));throw error;}
  if(retirement==='reload')await page.evaluate(()=>window.__history999.remount());
  else if(retirement==='connection')await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,connection:{...c.hass.connection}};});
  else {
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
   if(retirement==='space')await page.evaluate(()=>window.__hpTest.switchSpace('history-other-space'));
   if(retirement==='other-vacuum')await page.locator('houseplan-card').first().locator('[data-hp=device][data-id=other999]').click();
  }
  await settled();await page.evaluate(()=>{const w=window.__history999;w.listHold=false;w.pendingLists.shift()();});await settled();
  out[`held_list_${retirement}`]=await page.evaluate(keep=>keep?window.__card._vacHistory.catalog?.records.length===2:
   window.__card._vacHistory.catalog===null&&window.__card._vacHistory.shown===null,retirement==='close');
  // A still-open dialog may legitimately request a fresh catalog for its new
  // connection. Judge the old response first, then drain that distinct owner.
  await page.evaluate(()=>window.__history999.pendingLists.splice(0).forEach(resolve=>resolve()));await settled();
  if(retirement==='space')await page.evaluate(()=>window.__hpTest.switchSpace('f1'));
 }
 for(const status of ['empty_path','interrupted','malformed']){
  await reset();await page.evaluate(status=>{
   const w=window.__history999;w.material=id=>({...w.originalMaterial(id),...(status==='interrupted'?{completed:false}:{paths:status==='empty_path'?[]:[[[0,0],[NaN,1]]]} )});
  },status);
  ui=await openVacuumHistory(page);await chooseVacuumHistory(page,ui.history,ids.a);await ui.show.click();await settled();
  const reason=await ui.history.locator('[data-hp=vacuum-history-reason]').textContent();
  out[`honest_${status}`]=status==='interrupted'?await page.evaluate(()=>window.__card._vacHistory.visible)&&/interrupted/i.test(reason)
   :await noPreview()&&await ui.hide.isDisabled()&&!(await ui.show.getAttribute('class')).split(' ').includes('on')&&!!reason.trim();
 }
 await page.evaluate(()=>{const w=window.__history999;w.material=w.originalMaterial;w.recordsBackup=w.records;w.records=[];});
 await reset();ui=await openVacuumHistory(page);
 out.empty_catalog=await ui.history.locator('select').isDisabled()&&await ui.show.isDisabled()&&(await ui.history.textContent()).includes('No past cleanups are available.');
 await page.evaluate(()=>{const w=window.__history999;w.records=w.recordsBackup;w.listError='unsupported';});
 await reset();ui=await openVacuumHistory(page);
 out.unsupported_explained=/does not provide supported history/i.test(await ui.history.textContent())&&await ui.show.isDisabled();
 await page.evaluate(()=>{const w=window.__history999;w.listError=null;w.cap=null;w.requests=[];});
 await reset();ui=await openVacuumHistory(page);
 out.old_backend_no_requests=await ui.show.isDisabled()&&/update/i.test(await ui.history.textContent())&&await page.evaluate(()=>window.__history999.requests.length===0);
 await page.evaluate(()=>{const w=window.__history999;w.cap=1;w.canWrite=false;w.requests=[];});await reset();
 out.readonly_no_editor_or_requests=await page.evaluate(()=>!window.__card._canEdit&&!window.__card.renderRoot.querySelector('[data-hp=editor-open]')&&window.__history999.requests.length===0);
 await page.evaluate(async()=>{const w=window.__history999;w.canWrite=true;await w.remount({kiosk:true});});
 await page.waitForFunction(()=>window.__card._loadOk);
 out.kiosk_no_preview_requests=await noPreview()&&await page.evaluate(()=>window.__history999.requests.length===0);
 out.no_config_layout_or_service_writes=await page.evaluate(()=>window.__history999.writes.length===0&&window.__history999.services.length===0);
 checkAll(out);
}catch(error){checkAll({scenario_completed:false});throw error;}
finally{
 if(process.env.HP_HISTORY_REPORT)writeFileSync(process.env.HP_HISTORY_REPORT,JSON.stringify({checks:out},null,2)+'\n');
 await finish(browser);
}
