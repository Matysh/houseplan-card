#!/usr/bin/env node
/** #1454 addressed paired benchmark. Same actual fresh-pair/paint barrier for
 * base and candidate, all seven samples retained. No repeat-for-green. */
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launchColdView, requirePinnedBrowser } from '../serve.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const root=resolve(arg('target-root')||'.'), output=resolve(arg('output')||'artifacts/issue-1454/cache-benchmark.json');
const samples=Number(arg('samples')||7), mode=arg('mode')||'disk';
if(!Number.isSafeInteger(samples)||samples<1||!['disk','miss'].includes(mode))throw Error('invalid benchmark arguments');
requirePinnedBrowser();
const fixture=makeLargeHouseFixture();
const {page,browser}=await launchColdView({width:1440,height:1000},1,[],{},resolve(root,'demo/srv'),root,'/demo.html?panel-cold=1',false);
await page.emulateMedia({reducedMotion:'reduce'});
await page.evaluate(async()=>{await import('/assets/houseplan-card.js');await customElements.whenDefined('houseplan-card');});
const fingerprint=await assertFreshDemoBundle(page,root),rows=[];
const evaluate = async(index,seed=false)=>page.evaluate(async({fixture,index,seed,mode})=>{
  const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const until=async(predicate,label)=>{const start=performance.now();while(!predicate()){
    if(performance.now()-start>30_000)throw Error(label+JSON.stringify(window.__benchCard?.houseplanFloorCacheDiagnostics?.()));
    await new Promise(resolve=>setTimeout(resolve,5));}};
  localStorage.clear();
  if(mode==='miss'||seed)await new Promise(resolve=>{const r=indexedDB.deleteDatabase('houseplan-derived-floors-v1');r.onsuccess=r.onerror=r.onblocked=resolve;});
  const source=structuredClone(fixture);
  const card=document.createElement('houseplan-card');window.__benchCard=card;
  const calls=[];
  const hass={language:'en',locale:{language:'en'},user:{id:'floor-cache-performance',is_admin:false},
    devices:source.devices,entities:source.entities,areas:source.areas,states:source.states,
    connection:{connected:true,subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}},
    callWS:async message=>{calls.push([performance.now(),message.type]);
      if(message.type==='houseplan/config/get')return{config:structuredClone(source.config),rev:1,can_write:false};
      if(message.type==='houseplan/layout/get')return{layout:structuredClone(source.layout),rev:1};
      if(message.type==='config/device_registry/list')return Object.values(source.devices);
      if(message.type==='config/entity_registry/list')return Object.values(source.entities);
      return{ok:true};},callService:async()=>{throw Error('unexpected device action');},
    localize:()=>null,formatEntityState:state=>state.state,config:{unit_system:{length:'km'}}};
  card.hass=hass;card.setConfig({type:'custom:houseplan-card',title:'Paired floor cache',icon_size:3.4});
  const ready=()=>card._loadOk&&!card._booting&&!card._bootFading&&!card._modeTransitionBusy
    &&card._continuity.state==='steady'&&!card._floorPreparation?.pending
    &&card.renderRoot.querySelector('ha-card[data-hp-state="ready"] .stage.mode-view')
    &&!card.renderRoot.querySelector('[data-hp-floor-cache="pending"]');
  const mount=performance.now();document.getElementById('host').replaceChildren(card);
  await until(ready,'mount');await frame();
  const mountReady=performance.now()-mount;
  if(seed&&card._floorPreparation){card.requestUpdate();await until(()=>card._floorPreparation.diagnostic.store.writes>=1,'initial seed publication');}
  const navigation=async target=>{
    const entries=[];const observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));observer.observe({type:'longtask'});
    const before=card.houseplanFloorCacheDiagnostics?.(),start=performance.now();
    card._pickSpace(target);
    await until(()=>ready()&&card._space===target,'navigation');await frame();
    const readyCurrentFrame=performance.now()-start;
    entries.push(...observer.takeRecords());observer.disconnect();
    const after=card.houseplanFloorCacheDiagnostics?.();
    return{readyCurrentFrame,animationComplete:performance.now()-start,
      // The synchronous base operation begins inside the current browser
      // task. Judge overlap with intent, not startTime>=intent (which would
      // incorrectly hide precisely that long task).
      maxLongTask:Math.max(0,...entries.filter(e=>e.startTime+e.duration>start).map(e=>e.duration)),
      producer:after?.main&&Object.fromEntries(Object.entries(after.main).map(([key,value])=>[key,value-(before?.main?.[key]||0)])),
      cache:after?.cache||null};
  };
  const cold=await navigation(source.config.spaces[1].id);
  if(seed&&card._floorPreparation){card.requestUpdate();await until(()=>card._floorPreparation.diagnostic.store.writes>=2,'seed publication');}
  await navigation(source.config.spaces[0].id);
  const memory=await navigation(source.config.spaces[1].id);
  const report={index,mountReady,cold,memory,freshReadCount:calls.filter(([,type])=>type==='houseplan/config/get').length};
  card.remove();return report;
},{fixture,index,seed,mode});
try {
  await evaluate(-1,true); // one declared warm-up/seed, not one of the seven
  for(let index=0;index<samples;index++){
    // A new browser document resets JS/memory caches but retains this
    // context's real IndexedDB; origin and fixture remain identical.
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(async()=>{await import('/assets/houseplan-card.js');await customElements.whenDefined('houseplan-card');});
    const row=await evaluate(index);rows.push(row);console.log(JSON.stringify({index,cold:row.cold.readyCurrentFrame,memory:row.memory.readyCurrentFrame,
      diskHits:row.cold.cache?.diskHits,misses:row.cold.cache?.misses,maxLongTask:row.cold.maxLongTask}));
  }
  const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return{median:sorted[Math.floor(sorted.length/2)],min:sorted[0],max:sorted.at(-1)}};
  const report={sourceSha:arg('source-sha')||execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    fingerprint,profile:'large-house-v1',mode,samples,warmups:1,runtime:process.version,browser:browser.version(),
    fixtureCounts:fixture.counts,summary:{cold:stats(rows.map(row=>row.cold.readyCurrentFrame)),memory:stats(rows.map(row=>row.memory.readyCurrentFrame)),
      mount:stats(rows.map(row=>row.mountReady))},rows};
  mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.summary));
}finally{await browser.close();}
