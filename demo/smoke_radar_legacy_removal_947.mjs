// #947: a saved, unrecognised radar can undo pending removal in this dialog.
import {launchHaDialogFixture} from './helpers/ha-dialog-fixture.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {ensureHarnessEditorRuntime} from './editor-runtime-compat.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {checkAll,finish} from './serve.mjs';
import {fileURLToPath} from 'node:url';
const fixture=await launchHaDialogFixture({authentic:true,viewport:{width:1280,height:900},extraModules:['16213']});
const {page}=fixture,out={};
const d=page.locator('houseplan-card hp-dialog[data-kind=marker]'),settle=()=>page.evaluate(()=>window.__hpTest.settled());
const section=async id=>{await d.locator(`[data-section-target=${id}]`).click();await settle();};
const persisted=()=>page.evaluate(()=>structuredClone(window.__card._serverCfg.markers.find(m=>m.binding==='device:d_motion')));
const discard=async()=>{await d.locator('.hpf-footer [data-hp=dialog-cancel]').click();const c=page.locator('houseplan-card hp-dialog[data-kind=confirm]');if(await c.count())await c.locator('[data-hp=dialog-confirm]').click();await d.waitFor({state:'detached'});};
try{
 await page.goto(fixture.url+'/product.html');await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));if(!await page.evaluate(ensureHarnessEditorRuntime))throw Error('Editor not loaded');await installHpTestOnPage(page);
 const known={version:1,enabled:true,show_live:false,profile:'cartesian_v1',sources:{slots:[{id:'target_1',x_entity:'sensor.legacy947_x',y_entity:'sensor.legacy947_y',unit:'mm',swap_xy:false,x_sign:1,y_sign:1}]},mount:{installation_id:'legacy947',x:.2,y:.3,heading_deg:45,range_cm:600,fov_deg:120},calibration:{method:'two_point',mirror:false,cell_cm:5,rms_cm:4,refs:[{plan:{x:.3,y:.3},local_cm:{x:0,y:100}},{plan:{x:.25,y:.4},local_cm:{x:80,y:60}}]}};
 const seed=async radar=>{
  await page.evaluate(async radar=>{const c=window.__card;c.setConfig({...c._config,language:'ru'});await window.__hpTest.setServerConfig(cfg=>{const s=cfg.spaces.find(s=>s.id==='f1'),r=s.rooms[0];cfg.markers=cfg.markers.filter(m=>m.binding!=='device:d_motion'&&m.id!=='legacy-undo947');cfg.markers.push({id:'legacy-undo947',binding:'device:d_motion',name:'Старый радар',space:s.id,area:r.area||null,room_id:r.id,radar:{...radar,room_id:r.id}});});await window.__hpTest.switchSpace('f1');await window.__hpTest.setMode('devices');},radar);
  await page.evaluate(()=>window.__hpTest.openMarkerDialog('legacy-undo947').then(()=>null));await d.waitFor();await settle();
 };
 const openLegacy=async()=>{await section('details');await d.locator('[data-card=details] .hpf-callout .hpf-link').click();await settle();};
 const remove=async()=>{await d.locator('.radargroup button:has(ha-icon[icon="mdi:radar-off"])').click();await settle();};
 for(const kind of ['known','edited','future']){
  const radar=kind==='future'?{...known,version:99,profile:'future_profile',future_data:{keep:['opaque',7]}}:known;
  await seed(radar);const before=await persisted();out[kind+'_not_hardware_tab']=await d.locator('[data-section-target=radar]').count()===0;
  await d.locator('#marker-name').fill('Старый радар · правка');await settle();await openLegacy();
  if(kind==='edited'){await d.locator('#marker-radar-show-live').click();await settle();}
  const draft=await page.evaluate(()=>({radar:JSON.stringify(window.__card._markerDialog.radar),touched:window.__card._markerDialog.radarTouched}));
  await remove();out[kind+'_remove_is_draft']=JSON.stringify((await persisted()).radar)===JSON.stringify(before.radar);
  const undo=d.getByRole('button',{name:'Отменить удаление',exact:true});const available=await undo.count()===1;out[kind+'_undo_stays_reachable']=available;
  if(available){await undo.click();await settle();const after=await page.evaluate(()=>({radar:JSON.stringify(window.__card._markerDialog.radar),touched:window.__card._markerDialog.radarTouched,remove:window.__card._markerDialog.radarRemove,name:window.__card._markerDialog.name}));out[kind+'_restores_exact_draft']=after.radar===draft.radar&&after.touched===draft.touched&&!after.remove&&after.name==='Старый радар · правка';
   if(kind==='edited'){await discard();out.edited_cancel_keeps_saved=JSON.stringify((await persisted()).radar)===JSON.stringify(before.radar);}
   else{await d.locator('.hpf-footer [data-hp=dialog-confirm]').click();await d.waitFor({state:'detached'});const saved=await persisted();out[kind+'_save_preserves_exact_radar']=JSON.stringify(saved.radar)===JSON.stringify(before.radar)&&saved.name==='Старый радар · правка';}
  }else{out[kind+'_restores_exact_draft']=false;await discard();}
 }
 await seed(known);await openLegacy();await remove();await d.locator('.hpf-footer [data-hp=dialog-confirm]').click();await d.waitFor({state:'detached'});out.confirmed_removal_still_works=!(await persisted())?.radar;
 await fixture.assertClean();checkAll(out);await finish(fixture.browser,out);
}finally{await fixture.close();}
