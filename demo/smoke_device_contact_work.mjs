// #866: 200 actual marker faces, incremental drag and unrelated HA frames.
import {launch,check,checkAll,finish} from './serve.mjs';
import {isDeepStrictEqual} from 'node:util';
const {page,browser}=await launch({width:1600,height:1100});
await page.evaluate(async()=>{
  const c=window.__card;
  c.setConfig({...c._config,icon_size:5});
  await window.__hpTest.setServerConfig(cfg=>{
    cfg.spaces=[{id:c._space,title:'200 contacts',view_box:[0,0,1,1],cell_cm:5,rooms:[],walls:[],wall_segments:[],openings:[],
      partitions:[{id:'work-wall',a:[.03,.025],b:[.97,.025],cm:36}],
      decor:[{id:'work-decor',kind:'rect',x:.2,y:.2,w:.1,h:.1,color:'#ffffff',fill:true}],
      settings:{show_borders:true,show_names:false}}];
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
// #935: real retained-contact paint must not rebuild masonry for decor-only
// input. This runs the same controller/queue as the interaction benchmark.
// A new trusted pointer sequence retires the cancelled drag's activation tail;
// a same-turn programmatic .click() is deliberately consumed by that guard.
await page.locator('houseplan-card [data-hp="mode-tab"][data-mode="decor"]').click();
await page.waitForFunction(()=>window.__card.renderRoot.querySelector('ha-card')?.dataset.hpMode==='decor');
await settle();
await page.locator('houseplan-card [data-hp="decor"][data-id="work-decor"]').click();await settle();
const decor=await page.evaluate(async()=>{
  const c=window.__card, frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const before={walls:c._floorCacheBuilds.wallUnion,contacts:c._deviceContacts.work.rebuilds,
    layout:JSON.stringify(c._layout),shape:JSON.stringify(c._curSpaceCfg.decor),
    ink:[...c.renderRoot.querySelectorAll('.device-contact-contour')].map(n=>n.getAttribute('d'))};
  const box=c._decorBoxOf(c._dtSel), stage=c.renderRoot.querySelector('.stage').getBoundingClientRect(),view=c._viewOr(c._baseVb());
  const pointer=(x,y)=>({pointerId:935,pointerType:'mouse',shiftKey:true,
    clientX:stage.left+(x-view.x)/view.w*stage.width,clientY:stage.top+(y-view.y)/view.h*stage.height,
    stopPropagation(){},preventDefault(){},currentTarget:null,target:null});
  c._dtStart(pointer(box.x+box.w,box.y+box.h),'scale',[1,1]);await c.updateComplete;await frame();
  for(let i=1;i<=4;i++){c._dtMove(pointer(box.x+box.w+i*20,box.y+box.h+i*10));await frame();}
  const changed=JSON.stringify(c._curSpaceCfg.decor)!==before.shape;
  c._cancelDecorGesture();await c.updateComplete;await frame();
  return {changed,walls:c._floorCacheBuilds.wallUnion-before.walls,contacts:c._deviceContacts.work.rebuilds-before.contacts,
    restored:JSON.stringify(c._curSpaceCfg.decor)===before.shape,layout:JSON.stringify(c._layout)===before.layout,
    ink:JSON.stringify([...c.renderRoot.querySelectorAll('.device-contact-contour')].map(n=>n.getAttribute('d')))===JSON.stringify(before.ink)};
});
checkAll({decorPreviewActuallyChanges:decor.changed,decorNoMasonryRebuild:decor.walls===0,
  decorNoContactRebuild:decor.contacts===0,decorCancelRestores:decor.restored,
  decorKeepsAllPositions:decor.layout,decorKeepsContactInk:decor.ink});
await finish(browser,{before,ticks,value,dragged,after:await work()});
