/** #1216: whole operations on a pinned source tree, never a geometry-only proxy.
 * Browser transport is deterministic synthetic authority (real graph reducer),
 * so node timing includes native input, client proof, accepted graph and paint,
 * but does not claim a measurement of HA/network latency.
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cpus} from 'node:os';
import {createHash} from 'node:crypto';
import {makeSelectiveInvalidationFixture} from './fixtures/selective-invalidation.mjs';
import {directWallJunctionLoad} from './fixtures/direct-wall-junction-load.mjs';
import {launch,requirePinnedBrowser,reportPageErrors} from './serve.mjs';
const arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const root=resolve(arg('root')||process.cwd()),output=resolve(arg('output')||'artifacts/1216/measurement.json');
const seriesCount=Number(arg('series')||3),samples=Number(arg('samples')||20),warmups=Number(arg('warmups')||5);
const runnerSHA256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const moduleAt=name=>import(pathToFileURL(resolve(root,'test-build',name+'.js')).href);
const {commitWallSegmentModel}=await moduleAt('wall-segment-model');
const {optimizePlans}=await moduleAt('plan-optimizer');
const {checkOptimizeGeometry}=await moduleAt('plan-geometry-preflight');
const {structuralWallNodes,prepareNodeMove,applyNodeMove}=await moduleAt('wall-node-move');
const {spaceModels}=await moduleAt('space-geometry');
const {prepareSpacePhysicalGeometryInputs}=await moduleAt('plan-geometry-preflight');
const {wallBodiesGeometry}=await moduleAt('wall-thickness');
const junction=arg('scene')==='junction';
const fixture=junction?directWallJunctionLoad():makeSelectiveInvalidationFixture(true);fixture.config=commitWallSegmentModel(fixture.config).config;
const optimized=optimizePlans(fixture.config,fixture.layout).config,rows=[];
mkdirSync(dirname(output),{recursive:true});
const operations={optimize:()=>optimizePlans(fixture.config,fixture.layout),
  'optimize-noop':()=>optimizePlans(optimized,fixture.layout),
  'whole-physical-preflight':()=>assert.equal(checkOptimizeGeometry(fixture.config).ok,true),
  'cold-core':()=>{
   const config=structuredClone(fixture.config),space=spaceModels(config)[0],i=prepareSpacePhysicalGeometryInputs(config.spaces[0],space);
   const result=wallBodiesGeometry(space.rooms,i.walls,i.openCuts,i.roomOpenings,i.wallKeyPitch,i.cellCm,i.gridPitch,i.coordScale,i.physicalBodies);
   assert.equal(result.status,'ok');
  }};
for(let series=0;series<seriesCount;series++)for(let sample=-warmups;sample<samples;sample++){
 for(const [name,run]of Object.entries(operations)){
  const start=performance.now();run();if(sample>=0)rows.push({series,sample,name,ms:performance.now()-start});
 }
}
console.log('Node whole-operation series completed');
requirePinnedBrowser();
const {page,browser}=await launch({width:1440,height:1000},1,[],{},resolve(root,'demo/srv'),root);
const heapSession=await page.context().newCDPSession(page);
let accepted,revision,lastIntent,writeCount;
let loadedFingerprint;
const saveReport=complete=>{
 const report={schema:1,issue:1216,complete,runnerSHA256,rootFingerprint:loadedFingerprint,node:process.version,cpu:cpus()[0].model,browser:browser.version(),viewport:[1440,1000],series:seriesCount,warmups,samples,
  fixture:junction?'directWallJunctionLoad() -> model11':'makeSelectiveInvalidationFixture(true) -> model11',fixtureSHA256:createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),
  transport:'deterministic synthetic authority using production exact node reducer; no HA/network latency claim',
  coldReadiness:'static warm-boot placement cache reset; load/data complete, actual masonry, boot/fade/settle/soft ended, continuity steady and interactive',
  heapSampling:'maximum usedJSHeapSize sampled on every animation frame from cold card creation through accepted node frame; retained heap after CDP forced GC once per series; allocations born and collected within one synchronous task are not observable',rows};
 writeFileSync(output,JSON.stringify(report,null,2)+'\n');
};
await page.exposeFunction('directWallBenchmarkWire',message=>{
 if(message.type==='houseplan/config/get')return{config:accepted,rev:revision,can_write:true,wall_node_move_api:1,plan_graph_api:1};
 if(message.type==='houseplan/layout/get')return{layout:fixture.layout,rev:1};
 if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
 if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
 if(message.type==='houseplan/wall/node_move'){
  const space=accepted.spaces.find(s=>s.id===message.space_id),nodes=structuralWallNodes(space);
  const selected=nodes.find(n=>n.nodeId===message.intent.node_id||n.id===message.intent.node_id)
    ||nodes.find(n=>n.point.every((v,i)=>Math.abs(v-message.intent.point[i])<1e-12));
  assert.ok(selected,'native gesture names an accepted node');
  const result=applyNodeMove(prepareNodeMove(space,selected,nodes,message.intent.split_ids),message.intent.target,message.intent.axis);
  assert.equal(result.ok,true);accepted={...accepted,spaces:accepted.spaces.map(s=>s.id===space.id?result.space:s)};
  lastIntent=message.intent;writeCount++;return{ok:true,config:accepted,rev:++revision};
 }
 return null;
});
try{
 await page.evaluate(fixture=>{window.__directWallFixture=fixture;},fixture);
 loadedFingerprint=await page.evaluate(()=>window.__HOUSEPLAN_BUILD_FINGERPRINT__);
 for(let series=0;series<seriesCount;series++)for(let sample=-warmups;sample<samples;sample++){
  await page.mouse.move(5,5); // retire hover/tooltip ownership before replacing the card
  accepted=structuredClone(fixture.config);revision=1;lastIntent=null;writeCount=0;
  const measured=await page.evaluate(async()=>{
   const fixture=window.__directWallFixture,old=window.__card,hass=window.__mkHass(),original=hass.callWS.bind(hass);
   hass.devices=fixture.devices;hass.entities=fixture.entities;hass.states={...hass.states,...fixture.states};
   hass.callWS=async m=>(await window.directWallBenchmarkWire(m))??original(m);
   const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   localStorage.clear();
   if(window.__directHeapRAF)cancelAnimationFrame(window.__directHeapRAF);
   window.__directPeakHeap=0;
   const sampleHeap=()=>{window.__directPeakHeap=Math.max(window.__directPeakHeap,performance.memory?.usedJSHeapSize??0);window.__directHeapRAF=requestAnimationFrame(sampleHeap);};
   sampleHeap();const start=performance.now();old.remove();
   customElements.get('houseplan-card')._warmBootReset?.();
   const card=document.createElement('houseplan-card');
   card.setConfig({type:'custom:houseplan-card',language:'en'});document.getElementById('host').appendChild(card);window.__card=card;card.hass=hass;
   while(card._booting!==false||card._loading||card._bootFading||card._bootSettling||card._bootSoft
      ||!card._loadOk||!card._continuityDataReady||!card._continuity.hasCompleteFrame
      ||card._continuity.state!=='steady'||card._continuity.overlayBlocksInteraction
      ||card._space!=='f1'||!card._floorCacheBuilds.wallUnion||!card.renderRoot.querySelector('.wallbody-fill')){
    if(performance.now()-start>15000)throw Error('cold-open did not settle');await frame();
   }
   await card.updateComplete;await frame();const cold=performance.now()-start,before={...card._floorCacheBuilds};
   let t=performance.now();await window.__hpTest.switchSpace('f2');await card.updateComplete;await frame();const coldSwitch=performance.now()-t;
   await window.__hpTest.switchSpace('f1');await card.updateComplete;await frame();
   t=performance.now();await window.__hpTest.switchSpace('f2');await card.updateComplete;await frame();const warmSwitch=performance.now()-t;
   const work={before,after:{...card._floorCacheBuilds}};
   await window.__hpTest.switchSpace('f1');await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');await card.updateComplete;await frame();
   return{cold,coldSwitch,warmSwitch,work,heap:performance.memory?.usedJSHeapSize??null};
  });
  console.log('Native phase',series,sample);
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('.hp-node-handle'),undefined,{timeout:10000});
  await page.waitForFunction(()=>{
   const root=window.__card.renderRoot;
   return [...root.querySelectorAll('.hp-node-handle')].some(h=>{
    const r=h.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
    return getComputedStyle(h).cursor==='grab'&&x>30&&y>100&&x<innerWidth-50&&y<innerHeight-50&&root.elementFromPoint(x,y)===h;
   });
  },undefined,{timeout:10000});
  const positions=await page.evaluate(()=>{
   const root=window.__card.renderRoot,handles=[...root.querySelectorAll('.hp-node-handle')];
   const handle=handles.find(h=>{
    const r=h.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
    return getComputedStyle(h).cursor==='grab'&&x>30&&y>100&&x<innerWidth-50&&y<innerHeight-50&&root.elementFromPoint(x,y)===h;
   });
   if(!handle)throw Error(JSON.stringify(handles.slice(0,3).map(h=>({cursor:getComputedStyle(h).cursor,tooltip:h.getAttribute('data-hp-tooltip'),rect:h.getBoundingClientRect().toJSON()}))));
   const svg=handle.ownerSVGElement;
   const screen=([x,y])=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(handle.getScreenCTM());return{x:q.x,y:q.y};};
   const x=Number(handle.getAttribute('cx')),y=Number(handle.getAttribute('cy'));
   return{from:screen([x,y]),to:screen([x+20,y+20])};
  });
  const start=await page.evaluate(()=>performance.now());
  await page.mouse.move(positions.from.x,positions.from.y);await page.mouse.down();
  assert.equal(await page.evaluate(()=>window.__card._editorRuntime.nodeMove.dragging),true,'native node handle captures the pointer');
  await page.mouse.move(positions.to.x,positions.to.y,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>window.__card._cfgRev>1,undefined,{timeout:15000});
  const nodeMs=await page.evaluate(async start=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-start;},start);
  assert.equal(writeCount,1);assert.ok(lastIntent?.node_id||lastIntent?.point);
  if(junction){
   // Separate native pointermove -> completed live frame samples. Excludes the
   // final Save ACK and makes no claim about HA or network latency.
   const origin=await page.evaluate(()=>{const op=window.__card._openingsR.find(o=>o.id==='f1-junction-door');return[op.rx,op.ry];});
   const at=async step=>page.evaluate(({step,origin})=>{
    const card=window.__card,op=card._openingsR.find(o=>o.id==='f1-junction-door');
    if(!op)throw Error('junction opening missing');
    const svg=card.renderRoot.querySelector('.stage svg'),p=new DOMPoint(origin[0]+step,origin[1]).matrixTransform(svg.getScreenCTM());
    return{x:p.x,y:p.y};
   },{step,origin});
   const p=await at(0);await page.mouse.move(p.x,p.y);await page.mouse.down();
   assert.ok(await page.evaluate(()=>window.__card._opDrag),'native opening owns pointer');
   for(let step=1;step<=5;step++){
    const target=await at(step*15),begin=performance.now();await page.mouse.move(target.x,target.y);
    await page.evaluate(async()=>{await window.__hpTest.settled();await new Promise(r=>requestAnimationFrame(r));});
    const ms=performance.now()-begin;
    assert.equal(await page.evaluate(()=>!!window.__card._opDrag?.moved),true);
    if(sample>=0)rows.push({series,sample,step,name:'opening-drag-frame',ms});
   }
   await page.mouse.up();
  }
  assert.equal(measured.work.after.wallUnion-measured.work.before.wallUnion,1,'only the newly requested floor builds geometry');
  assert.ok(measured.work.before.wallUnion<=1,'cold View does not build hidden floors');
  if(sample>=0){
   for(const[name,ms]of [['cold-open',measured.cold],['cold-floor-switch',measured.coldSwitch],['warm-floor-switch',measured.warmSwitch],['node-gesture-to-accepted-frame',nodeMs]])rows.push({series,sample,name,ms});
   const peak=await page.evaluate(()=>window.__directPeakHeap);
   rows.push({series,sample,name:'heap',bytes:peak,work:measured.work});
  }
  if(sample===samples-1){
   await heapSession.send('HeapProfiler.collectGarbage');
   const heap=await heapSession.send('Runtime.getHeapUsage');rows.push({series,sample,name:'retained-heap',bytes:heap.usedSize});
   console.log('Browser series',series,'completed');
   saveReport(false);
  }
 }
 assert.equal(await reportPageErrors(),false);saveReport(true);console.log(JSON.stringify({output,rows:rows.length}));
}catch(error){saveReport(false);await page.screenshot({path:output+'.failure.png'}).catch(()=>{});throw error;
}finally{await browser.close();}
