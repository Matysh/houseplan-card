// #866: 200 actual marker faces, incremental drag and unrelated HA frames.
import {launch,check,checkAll,finish} from './serve.mjs';
import {isDeepStrictEqual} from 'node:util';
const {page,browser}=await launch({width:1600,height:1100});
await page.evaluate(async()=>{
  const c=window.__card;
  c.setConfig({...c._config,icon_size:5});
  await window.__hpTest.setServerConfig(cfg=>{
    cfg.spaces=[{id:c._space,title:'200 contacts',view_box:[0,0,1,1],cell_cm:5,rooms:[],walls:[],wall_segments:[],openings:[],
      partitions:[{id:'work-wall',a:[.03,.025],b:[.97,.025],cm:36}],settings:{show_borders:true,show_names:false}}];
    cfg.markers=Array.from({length:200},(_,i)=>({id:`work-${i}`,binding:'virtual',space:c._space,icon:'mdi:thermometer',
      display:i%10?'static_icon':'badge',size:20/45,value_badge:{enabled:i%10===0,position:'right',
        source:{kind:'entity_state',entity_id:i===0?'sensor.work_value':`sensor.work_value_${i}`}}}));return cfg;
  });
  const sources=Array.from({length:20},(_,i)=>i===0?'sensor.work_value':`sensor.work_value_${i*10}`);
  c.hass={...c.hass,entities:{...c.hass.entities,...Object.fromEntries(sources.map(id=>[id,{entity_id:id,platform:'demo'}]))},
    states:{...c.hass.states,...Object.fromEntries(sources.map((id,i)=>[id,{entity_id:id,state:i===0?'26%':`${30+i}%`,attributes:{}}]))}};
  await window.__hpTest.setLayout(Object.fromEntries(Array.from({length:200},(_,i)=>[`work-${i}`,{
    s:c._space,x:.08+(i%20)*.0225,y:.12+Math.floor(i/20)*.07}])));
  await window.__hpTest.setMode('view');
});
const settle=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
await settle();
const work=()=>page.evaluate(()=>({render:{...window.__card._deviceContacts.work},scene:{...window.__card._deviceContacts.scene.work},
  size:window.__card._deviceContacts.scene.shapes.size}));
const before=await work();check('200-real-shapes',before.size,200);
check('distinct-cold-faces-share-layout-batches',before.render.measurements>=20
  && before.render.measurementBatches<before.render.measurements/2,true);
check('real-joined-rows',await page.locator('houseplan-card .device-contact-contour.grouped').count()>=10,true);
for(let i=0;i<30;i++){
  await page.evaluate(i=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,'sensor.unrelated_contact':{
    entity_id:'sensor.unrelated_contact',state:String(i),attributes:{}}}};},i);await settle();
}
const ticks=await work();checkAll({unrelatedNoIndexBuild:ticks.render.rebuilds===before.render.rebuilds,
  unrelatedNoFaceMeasure:ticks.render.measurements===before.render.measurements});
await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
  'sensor.work_value':{entity_id:'sensor.work_value',state:'27%',attributes:{}}}};});await settle();
// Reconcile through the public unchanged card-options entry as well. This
// witness judges contact geometry reuse, not the HA dependency classifier.
await page.evaluate(()=>{const c=window.__card;c.setConfig({...c._config});});await settle();
await page.waitForFunction(()=>window.__card.renderRoot.querySelector('.value-badge')?.textContent.trim()==='27%');
const value=await work();
checkAll({sameMetricValueActuallyPainted:await page.locator('houseplan-card .value-badge').first().innerText()==='27%',
  sameMetricValueNoIndexBuild:value.render.rebuilds===ticks.render.rebuilds,
  sameMetricValueKeepsGroupInk:await page.locator('houseplan-card .device-contact-contour.grouped').count()>=10});
await page.evaluate(()=>window.__hpTest.setMode('devices'));await settle();const dragBase=await work();
const point=await page.evaluate(()=>{const c=window.__card,r=c.renderRoot.querySelector('[data-id="work-199"] .device-core').getBoundingClientRect();
  return{x:r.x+r.width/2,y:r.y+r.height/2,layout:structuredClone(c._layout)};});
await page.mouse.move(point.x,point.y);await page.mouse.down();
for(let i=1;i<=60;i++){await page.mouse.move(point.x+i*2,point.y+40);await settle();}
const dragged=await work();
checkAll({dragNoFullIndexBuild:dragged.render.rebuilds===dragBase.render.rebuilds,
  dragNoFaceMeasure:dragged.render.measurements===dragBase.render.measurements,
  // Grid fallback coalesces adjacent raw samples to the same canonical point.
  dragUsesIncrementalMoves:dragged.scene.moves>0&&dragged.scene.moves<=60,
  localPairsNotAllPlanSquared:dragged.scene.pairs-ticks.scene.pairs<60*200});
await page.keyboard.press('Escape');await page.mouse.up();await settle();
check('cancel-keeps-all-200-positions',isDeepStrictEqual(await page.evaluate(()=>window.__card._layout),point.layout),true);
await finish(browser,{before,ticks,value,dragged,after:await work()});
