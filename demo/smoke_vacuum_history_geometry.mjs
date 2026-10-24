// #999: the real camera transform, shared geometry cache and multi-robot quota.
import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
import {prepareVacuumHistory,openVacuumHistory,chooseVacuumHistory,HISTORY_IDS as ids} from './helpers/vacuum-history.mjs';
import {writeFileSync} from 'node:fs';
requirePinnedBrowser();
const {page,browser}=await launchColdView();page.setDefaultTimeout(15000);
const out={};
const settled=()=>page.evaluate(()=>window.__hpTest.settled());
const geometry=()=>page.evaluate(()=>window.__history999.geometry()[0]);
try{
 await prepareVacuumHistory(page,{peer:false});
 const ui=await openVacuumHistory(page);await chooseVacuumHistory(page,ui.history,ids.a);await ui.show.click();
 await page.waitForFunction(()=>window.__card._vacHistory.visible);
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>window.__hpTest.setMode('view'));
 const path=(await geometry()).history;
 const before=await page.evaluate(()=>window.__card._vacGeometryCache.computations);
 await page.evaluate(async()=>{
  const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,'sensor.unrelated999':{state:'42',attributes:{}}}};
  await window.__hpTest.settled();
 });
 out.unrelated_tick_reuses_geometry=await page.evaluate(n=>window.__card._vacGeometryCache.computations===n,before)&&(await geometry()).history===path;
 for(const iso of [false,true]){
  await page.evaluate(on=>window.__hpTest.setVolumetricView(on),iso);
  const stage=page.locator('houseplan-card').first().locator('.stage'),rect=await stage.boundingBox();
  await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.8);await page.mouse.wheel(0,-180);await settled();
  await page.mouse.down();await page.mouse.move(rect.x+rect.width*.8-70,rect.y+rect.height*.8-35,{steps:8});await page.mouse.up();await settled();
  await page.setViewportSize({width:1000,height:820});await settled();
  out[`${iso?'iso':'flat'}_pan_zoom_resize_keeps_geometry`]=(await geometry()).history===path&&(await geometry()).tips===0;
  await page.setViewportSize({width:820,height:760});await settled();
 }
 const idle=await page.evaluate(()=>window.__card._vacGeometryCache.computations);
 await page.waitForTimeout(350);
 out.idle_no_geometry_work=await page.evaluate(n=>window.__card._vacGeometryCache.computations===n,idle);
 await page.evaluate(async()=>{
  const w=window.__history999,c=window.__card;
  window.__addRegistryEntity('vacuum.quota999',null,'cleaning');window.__addRegistryEntity('camera.quota999',null,'idle');
  c.hass={...c.hass,states:{...c.hass.states,'vacuum.quota999':{state:'cleaning',attributes:{}},
   'camera.quota999':{state:'idle',attributes:{robot_position:{x:500,y:300},map_name:'quota'}}}};
  const route={id:'quota-route',source:'camera.quota999',map_id:'quota',space:'f1',calibration:[.1,0,100,0,.1,100]};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[{id:'quota999',binding:'entity:vacuum.quota999',space:'f1',
   vacuum:{source:route.source,trail_mode:'always',map_routes:[route]}},...cfg.markers]}));
  await window.__hpTest.setLayout(layout=>({...layout,quota999:{s:'f1',x:.4,y:.1}}));
  // Turns remain above the shared simplifier's tolerance after calibration.
  w.dense=n=>Array.from({length:n},(_,i)=>[i%2*1000,i*2000]);
  w.book.quota999={current:{map_id:'quota',route_id:route.id,path_format:2,paths:[w.dense(10000)],
   quality:{source:'native',reason:'ok',raw_points:10000},revision:'quota-10000'}};
  w.originalMaterial=w.material;w.material=id=>({...w.originalMaterial(id),paths:[w.dense(100000)]});
  await w.publish();
 });
 const denseUi=await openVacuumHistory(page);await chooseVacuumHistory(page,denseUi.history,ids.a);await denseUi.show.click();
 await page.waitForFunction(()=>window.__card._vacHistory.visible);
 out.shared_20000_quota=await page.evaluate(()=>{
  const c=window.__card,live=c._vacTrailDiagnostics(c._devices.find(d=>d.id==='quota999'));
  const history=c.renderRoot.querySelector('path[data-kind=history]')?.getAttribute('d')??'';
  // Native live consumes 10000. History keeps its first 9999 ordered points
  // through index 9998 plus the genuine isolated endpoint at index 99999.
  // SVG's extra zero-length L for that endpoint is not another geometry point.
  return live.rendered===10000&&history.split('M ')[1]?.endsWith('100 1999700 ')
   &&history.endsWith('M 200 19999900 L 200 19999900')&&c._vacHistory.renderLimited;
 });
 await denseUi.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(async()=>{const w=window.__history999;w.book.quota999.current={...w.book.quota999.current,
  paths:[w.dense(100000)],revision:'quota-100000'};await w.publish();});
 out.zero_quota_has_no_history_fill_or_banner=!(await geometry()).history&&!(await geometry()).banner
  &&await page.evaluate(()=>{const c=window.__card;return c._vacHistory.shown!==null&&!c._vacHistory.visible
   &&c._vacTrailDiagnostics(c._devices.find(d=>d.id==='quota999')).rendered===20000;});
 if(!out.shared_20000_quota||!out.zero_quota_has_no_history_fill_or_banner)console.log('quota observation',await page.evaluate(()=>({
  devices:window.__card._renderVacuumDevices.map(d=>[d.id,d.primary,d.space]),
  paths:[...window.__card.renderRoot.querySelectorAll('path[data-hp=vacuum-trail-segment]')].map(p=>[p.getAttribute('data-kind'),p.getAttribute('data-vacuum-owner'),(p.getAttribute('d').match(/[ML] /g)||[]).length]),
  limited:window.__card._vacHistory.renderLimited,shown:!!window.__card._vacHistory.shown,visible:window.__card._vacHistory.visible,
 })));
 out.no_writes_or_services=await page.evaluate(()=>window.__history999.writes.length===0&&window.__history999.services.length===0);
 checkAll(out);
}catch(error){checkAll({scenario_completed:false});throw error;}
finally{
 if(process.env.HP_HISTORY_REPORT)writeFileSync(process.env.HP_HISTORY_REPORT,JSON.stringify({checks:out},null,2)+'\n');
 await finish(browser);
}
