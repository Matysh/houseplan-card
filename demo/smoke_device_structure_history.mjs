// #1073: native menu, persisted fixture pair and mixed optimistic/confirmed UI.
// The fixture supplies controlled wire responses; real HA tests prove the
// server delta/ACL/file/paired-commit behavior independently.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
requirePinnedBrowser();
const { page, browser } = await launch({width:1440,height:1000},1,[],{},undefined,undefined,'/demo.html?device-history=1');
mkdirSync('artifacts/1073',{recursive:true});
const card=page.locator('houseplan-card');
const settle=()=>page.waitForFunction(()=>!window.__card._devicePositionBusy&&!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);
await page.evaluate(async()=>{
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[
    {id:'v_source',binding:'virtual',space:'f1',name:'History lamp',icon:'mdi:lamp',is_light:true,description:'Exact original'},
    {id:'v_other',binding:'virtual',space:'f1',name:'Independent',icon:'mdi:lamp',is_light:true,controls:['marker:v_source']},
    ...window.__card._devices.filter(d=>d.id!=='v_source'&&d.id!=='v_other').map(d=>({...d.marker,id:d.id,binding:d.marker?.binding||`${d.bindingKind}:${d.bindingRef}`,hidden:true})),
  ]}));
  await window.__hpTest.setLayout(layout=>({...layout,v_source:{s:'f1',x:.3,y:.35},v_other:{s:'f1',x:.7,y:.35}}));
  await window.__hpTest.setMode('devices');
  const c=window.__card,original=c.hass.callWS;
  window.__structureWrites=[];window.__structureHold=null;window.__structureLose=false;
  c.hass={...c.hass,callWS:async request=>{
    if(request.type==='houseplan/layout/update'&&window.__structureHoldLayout)
      await new Promise(resolve=>window.__structureLayoutRelease=resolve);
    if(request.type==='houseplan/marker/copy'||request.type==='houseplan/marker/history'){
      window.__structureWrites.push(structuredClone(request));
      if(window.__structureHold===true)await new Promise(resolve=>window.__structureRelease=resolve);
      const result=await original(request);
      if(window.__structureLose){window.__structureLose=typeof window.__structureLose==='number'?window.__structureLose-1:false;throw new Error('controlled lost reply');}
      return result;
    }
    return original(request);
  }};
});
await settle();await card.locator('[data-hp="zoom-fit"]').click();
const snapshot=()=>page.evaluate(async()=>{
  const c=window.__card,cfg=await c.hass.callWS({type:'houseplan/config/get'}),layout=await c.hass.callWS({type:'houseplan/layout/get'});
  return {config:cfg.config,layout:layout.layout,undo:c._devicePositionHistory.size,redo:c._devicePositionHistory.canRedo,services:window.__serviceCalls.length};
});
const copy=async()=>{
  await card.locator('[data-hp="device"][data-id="v_source"]').click({button:'right'});
  await card.locator('[data-hp="device-copy"]').click();
};
const history=async direction=>{await card.locator(`[data-device-position-history="${direction}"]`).click();await settle();};
const before=await snapshot();
await page.evaluate(()=>window.__structureHold=true);
await copy();await page.waitForFunction(()=>typeof window.__structureRelease==='function');
check('copy-pending-visible-before-ack',await card.locator('[data-hp="device-structure-pending"]').innerText(),'Copying device…');
check('pending-copy-no-premature-history',(await snapshot()).undo,0);
check('pending-copy-no-premature-marker',(await snapshot()).config.markers.length,before.config.markers.length);
check('pending-undo-disabled',await card.locator('[data-device-position-history="undo"]').isDisabled(),true);
await card.locator('[data-hp="device-context-menu"]').waitFor({state:'hidden'});
await page.screenshot({path:'artifacts/1073/copy-pending.png'});
await page.evaluate(()=>{window.__structureHold=false;window.__structureRelease();});await settle();
const copied=await snapshot(),marker=copied.config.markers.find(m=>!before.config.markers.some(old=>old.id===m.id));
if(!marker)throw new Error('native Copy did not create a marker');
check('copy-records-one-command',copied.undo,1);
await history('undo');const undone=await snapshot();
check('undo-copy-removes-same-id',undone.config.markers.some(m=>m.id===marker.id),false);
check('undo-copy-original-preserved',undone.config.markers.find(m=>m.id==='v_source'),before.config.markers.find(m=>m.id==='v_source'));
check('undo-copy-removes-layout',Object.hasOwn(undone.layout,marker.id),false);
await history('redo');const redone=await snapshot();
check('redo-copy-same-id-settings',redone.config.markers.find(m=>m.id===marker.id),marker);
check('redo-copy-same-position',redone.layout[marker.id],copied.layout[marker.id]);
// Native drag is the old optimistic command between two structural commands.
const copiedNode=card.locator(`[data-hp="device"][data-id="${marker.id}"]`);
const box=await copiedNode.boundingBox();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:8});await page.mouse.up();
await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
const moved=await snapshot();check('copy-move-common-history',moved.undo,2);
// The old optimistic lane paints its first frame while its server reply waits.
await page.evaluate(()=>window.__structureHoldLayout=true);
await card.locator('[data-device-position-history="undo"]').click();
await page.waitForFunction(()=>typeof window.__structureLayoutRelease==='function');
await page.evaluate(()=>new Promise(requestAnimationFrame));
const previewBox=await copiedNode.boundingBox();
check('mixed-optimistic-undo-paints-before-ack',Math.abs(previewBox.x-box.x)<1&&Math.abs(previewBox.y-box.y)<1,true);
check('mixed-optimistic-undo-server-still-old',(await snapshot()).layout[marker.id],moved.layout[marker.id]);
check('mixed-optimistic-undo-no-structural-pending',await card.locator('[data-hp="device-structure-pending"]').count(),0);
await page.evaluate(()=>{window.__structureHoldLayout=false;window.__structureLayoutRelease();});await settle();
await history('redo');
check('mixed-optimistic-redo-restores-moved-position',(await snapshot()).layout[marker.id],moved.layout[marker.id]);
// Open the existing device dialog and its Delete confirmation.
await copiedNode.click();
await card.locator('[data-action="marker-delete"]').click();
await card.locator('hp-confirm [data-hp="dialog-confirm"]').click();await settle();
const deleted=await snapshot();check('delete-keeps-independent-history',deleted.undo,3);
check('delete-removes-copy',deleted.config.markers.some(m=>m.id===marker.id),false);
await history('undo');check('undo-delete-restores-moved-position',(await snapshot()).layout[marker.id],moved.layout[marker.id]);
await history('undo');check('undo-move-restores-copy-position',(await snapshot()).layout[marker.id],copied.layout[marker.id]);
await history('undo');check('third-undo-removes-copy',(await snapshot()).config.markers.some(m=>m.id===marker.id),false);
await history('redo');await history('redo');await history('redo');
check('third-redo-removes-copy',(await snapshot()).config.markers.some(m=>m.id===marker.id),false);
// A controlled lost response is resolved with the same immutable action ID.
const lostBefore=await snapshot();
await page.evaluate(()=>window.__structureLose=true);await copy();await settle();
const lostAfter=await snapshot();
check('lost-reply-one-command',lostAfter.undo,lostBefore.undo+1);
check('lost-reply-reuses-id',await page.evaluate(()=>{const w=window.__structureWrites;return w.at(-1).operation_id===w.at(-2).operation_id;}),true);
// Wide Properties uses the same structural Delete, with the ordinary danger UI.
await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
await card.locator('[data-hp="properties-panel"]').waitFor({state:'visible'});
const currentCopy=lostAfter.config.markers.find(m=>m.id.startsWith('v_')&&!['v_source','v_other'].includes(m.id));
await card.locator(`[data-hp="device"][data-id="${currentCopy.id}"]`).click();
await card.locator('[data-action="properties-delete"]').click();
await card.locator('hp-confirm [data-hp="dialog-confirm"]').click();await settle();
check('properties-delete-one-history-step',(await snapshot()).undo,lostAfter.undo+1);
await history('undo');check('properties-delete-restores-exact-marker',(await snapshot()).config.markers.find(m=>m.id===currentCopy.id),currentCopy);
// Catalog batch Delete is one command. Undo restores both members together.
await card.locator('[data-hp="tool"][data-tool="device-inbox"]').click();
await card.locator('.device-inbox-search').fill('History lamp');
for(const id of ['v_source',currentCopy.id])await card.locator(`.device-inbox-row[data-key="virtual:${id}"] input[type="checkbox"]`).check();
const beforeBatch=await snapshot();
await card.locator('.device-inbox-batch-delete').click();
await card.locator('hp-confirm [data-hp="dialog-confirm"]').click();await settle();
const afterBatch=await snapshot();check('catalog-delete-one-command',afterBatch.undo,beforeBatch.undo+1);
check('catalog-delete-both-members',afterBatch.config.markers.some(m=>['v_source',currentCopy.id].includes(m.id)),false);
await page.keyboard.press('Escape');await history('undo');const batchUndo=await snapshot();
check('catalog-undo-restores-both',batchUndo.config.markers.filter(m=>['v_source',currentCopy.id].includes(m.id)).length,2);
check('catalog-undo-restores-positions',[batchUndo.layout.v_source,batchUndo.layout[currentCopy.id]],
  [beforeBatch.layout.v_source,beforeBatch.layout[currentCopy.id]]);
const unknownBefore=await snapshot();
await page.evaluate(()=>window.__structureLose=2);await copy();
await card.locator('[data-hp="device-structure-reconcile"]').waitFor({state:'visible'});
check('unknown-result-no-premature-command',(await snapshot()).undo,unknownBefore.undo);
check('unknown-result-keeps-conflicting-history-disabled',await card.locator('[data-device-position-history="undo"]').isDisabled(),true);
await card.locator('[data-hp="device-structure-reconcile"]').click();await settle();
const reconciled=await snapshot();
check('explicit-result-check-records-one-command',reconciled.undo,unknownBefore.undo+1);
check('explicit-result-check-creates-one-copy',reconciled.config.markers.length,unknownBefore.config.markers.length+1);
check('explicit-result-check-keeps-one-operation-id',await page.evaluate(()=>new Set(window.__structureWrites.slice(-3).map(row=>row.operation_id)).size),1);
check('all-history-service-free',(await snapshot()).services,before.services);
mkdirSync('artifacts/1073',{recursive:true});
writeFileSync('artifacts/1073/copy-profile.json',JSON.stringify(await page.evaluate(()=>window.__card._editorRuntime.deviceCopy.lastProfile),null,2));
await finish(browser);
