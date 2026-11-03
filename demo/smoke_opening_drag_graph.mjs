/** #1236: native current-graph opening locality, real persistence and exact history.
 * Complements the historical #1097/#861 byte fixtures without changing them. */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launch,finish} from './serve.mjs';
import {bundledProducers,callsFor} from './performance/opening-drag-coverage.mjs';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {wallKey} from '../test-build/wall-thickness.js';
import {validateGraph} from '../test-build/plan-graph.js';
const poly=[[.1,.1],[.9,.1],[.9,.8],[.1,.8]];
const raw={model_version:7,spaces:[{id:'opening-local-1236',cell_cm:5,view_box:[0,0,1,1],rooms:[{id:'r',poly}],walls:poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return{key:wallKey([...a,...b],1/240),a,b,cm:20};}),partitions:[{id:'p',a:[.2,.4],b:[.8,.4],cm:20}],openings:[
 {id:'wall-door',type:'door',x:.4,y:.1,length:.08,angle:0,flip_h:true,invert:true,contact:null},
 {id:'partition-window',type:'window',x:.5,y:.4,length:.08,angle:0,flip_v:true,contact:null,host:{kind:'partition',id:'p',t:.5}},
]}],markers:[],settings:{}};
const source=JSON.stringify(raw),config=commitWallSegmentModel(raw).config;
assert.equal(JSON.stringify(raw),source);assert.equal(config.model_version,11);assert.equal(validateGraph(config.spaces[0].plan_graph).ok,true);
const {page,browser}=await launch({width:1280,height:960}),out={};
const targets=bundledProducers(fileURLToPath(new URL('../dist',import.meta.url)));
const session=await page.context().newCDPSession(page);
const settle=()=>page.evaluate(()=>window.__hpTest.settled());
const writes=()=>page.evaluate(()=>window.__hpTest.waitForWrites());
const point=(x,y)=>page.evaluate(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(window.__card.renderRoot.querySelector('.stage svg').getScreenCTM());return{x:p.x,y:p.y};},[x,y]);
const sample=id=>page.evaluate(id=>{
 const c=window.__card,root=c.renderRoot,o=c._openingsR.find(o=>o.id===id),proof=window.__local1236;
 const path=[...root.querySelectorAll('.hp-opening-drag-local .wallbody-fill')].find(p=>getComputedStyle(p).visibility==='visible');
 return{space:structuredClone(c._serverCfg.spaces[0]),builds:{...c._floorCacheBuilds},pool:[...c._wallUnionPool.keys()],fallbacks:c._editorRuntime._openingDragFallbackBuilds,history:c._geometryHistory.size,writes:proof?.writes??0,accepted:proof?.accepted??0,downs:proof?.downs??[],drag:c._opDrag&&{id:c._opDrag.id,moved:c._opDrag.moved},opening:structuredClone(o),cut:o&&path?{empty:!path.isPointInFill(new DOMPoint(o.rx,o.ry)),shoulder:path.isPointInFill(new DOMPoint(o.rx+o.rlen/2+1,o.ry))}:null};
},id);
try{
 await session.send('Profiler.enable');await session.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
 await page.evaluate(async config=>{await window.__hpTest.setServerConfig(cfg=>Object.assign(cfg,structuredClone(config)));await window.__hpTest.switchSpace('opening-local-1236');await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');},config);
 await page.waitForFunction(()=>!window.__card.renderRoot.querySelector('.stage.mode-transition'));await writes();await settle();
 const cold=(await session.send('Profiler.takePreciseCoverage')).result;
 assert.ok(callsFor(cold,targets.physical)>0,'cold positive proves the real saved physical producer is observable');
 await page.evaluate(()=>{const c=window.__card;window.__local1236={writes:0,accepted:0,downs:[]};const call=c.hass.callWS.bind(c.hass);c.hass={...c.hass,callWS:async m=>{const write=m.type==='houseplan/config/set';if(write)window.__local1236.writes++;const r=await call(m);if(write)window.__local1236.accepted++;return r;}};c.renderRoot.querySelector('.stage').addEventListener('pointerdown',e=>window.__local1236.downs.push({trusted:e.isTrusted,id:e.target.closest('[data-hp="opening"]')?.dataset.id}),{capture:true});});
 for(const id of ['wall-door','partition-window']){
  for(const terminal of ['cancel','release']){
   const before=await sample(id),o=before.opening,start=await point(o.rx,o.ry);
   await session.send('Profiler.takePreciseCoverage');
   await page.mouse.move(start.x,start.y);await page.mouse.down();await settle();
   const down=await sample(id);assert.equal(down.drag?.id,id);assert.deepEqual(down.downs.at(-1),{trusted:true,id});
   for(let i=1;i<=30;i++){
    if(i===15||i===20){await page.setViewportSize({width:i===15?1000:1280,height:960});await settle();}
    const target=await point(o.rx+i,o.ry);await page.mouse.move(target.x,target.y);await settle();
    const frame=await sample(id);assert.deepEqual(frame.space,before.space);assert.equal(frame.writes,before.writes);assert.equal(frame.accepted,before.accepted);assert.equal(frame.history,before.history);assert.deepEqual(frame.pool,down.pool);
    for(const key of ['wallUnion','physicalBodies','innerContour','cleanFloor','lightBarrier'])assert.equal(frame.builds[key],down.builds[key],`${id} frame${i} ${key}: no full-floor work`);
    assert.equal(frame.fallbacks,down.fallbacks,`${id} frame${i}: no canonical fallback`);
    if(frame.drag.moved)assert.deepEqual(frame.cut,{empty:true,shoulder:true});
   }
   const held=await sample(id);
   const heldCoverage=(await session.send('Profiler.takePreciseCoverage')).result;
   assert.equal(callsFor(heldCoverage,targets.physical),0,'held input never calls the real full-floor producer');
   assert.equal(callsFor(heldCoverage,targets.constructor),1,'one observed retained-preview constructor per native drag');
   if(terminal==='cancel'){await page.keyboard.press('Escape');await settle();await page.mouse.up();await writes();await settle();const cancelled=await sample(id);assert.deepEqual(cancelled.space,before.space);assert.equal(cancelled.writes,before.writes);assert.equal(cancelled.history,before.history);assert.equal(cancelled.drag,null);}
   else{
    await page.mouse.up();await writes();await settle();const after=await sample(id);
    assert.equal(after.writes,before.writes+1);assert.equal(after.accepted,before.accepted+1);assert.equal(after.history,before.history+1);assert.equal(after.drag,null);assert.equal(validateGraph(after.space.plan_graph).ok,true);
    const old=before.space.openings.find(o=>o.id===id),moved=after.space.openings.find(o=>o.id===id);
    assert.equal(moved.x,held.opening.x,'release persists the exact native snapped preview');assert.ok(moved.x-old.x>.02&&moved.x-old.x<.04);assert.equal(moved.y,old.y);assert.ok(moved.host.tq,'persisted opening uses accepted exact host parameters');
    assert.deepEqual({...moved,x:old.x,host:old.host},old,'every non-position opening setting is preserved');
    assert.deepEqual(after.space.openings.filter(o=>o.id!==id),before.space.openings.filter(o=>o.id!==id));
    for(const key of ['rooms','walls','partitions','wall_segments'])assert.deepEqual(after.space[key],before.space[key],`${key}: opening movement cannot alter structural projections`);
    assert.deepEqual(after.space.plan_graph.nodes,before.space.plan_graph.nodes);assert.deepEqual(after.space.plan_graph.edges,before.space.plan_graph.edges);
    await page.keyboard.press('Control+z');await writes();await settle();assert.deepEqual((await sample(id)).space,before.space,'native Undo restores the full exact saved space');
   }
  }
  out[id+'NativeLocal30FramesCancelReleaseUndo']=true;
 }
 await session.send('Profiler.stopPreciseCoverage');await finish(browser,out);
}catch(error){console.log('1236 current drag diagnostic',JSON.stringify({out,state:await sample('partition-window').catch(()=>null)}));await browser.close();throw error;}
