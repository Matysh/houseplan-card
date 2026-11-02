import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {launch,requirePinnedBrowser} from '../../../demo/serve.mjs';
import {makeLargeHouseFixture} from '../../../demo/fixtures/large-house.mjs';
requirePinnedBrowser('#1207 comparative mode-transition raw series');
const root=resolve(process.argv[2]??'.'),label=process.argv[3]??'candidate';
const rows=[];
for(const profile of ['large-house-v1','large-house-isometric-v1']){
 const fixture=makeLargeHouseFixture();if(profile.includes('isometric'))fixture.config.settings.volumetric_view=true;
 const {page,browser}=await launch({width:1280,height:900},1,[],{},resolve(root,'demo/srv'),root);
 const result=await page.evaluate(async({fixture,profile})=>{
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const until=async fn=>{const start=performance.now();while(!fn()){if(performance.now()-start>30000)throw Error('Fixture did not settle');await frame();}};
  const host=document.querySelector('#host');host.style.cssText='width:100%;height:900px;padding:0;margin:0';
  const c=document.createElement('houseplan-card');c.panelHost=true;
  c.setConfig({type:'custom:houseplan-card',title:'Synthetic 1207 benchmark',icon_size:3.4});
  const hass={language:'en',locale:{language:'en'},user:{id:'performance1207',name:'Synthetic',is_admin:true},
   devices:fixture.devices,entities:fixture.entities,areas:fixture.areas,floors:{},states:fixture.states,
   config:{unit_system:{length:'km'}},themes:{darkMode:false},localize:()=>null,
   formatEntityState:state=>state.state,callService:async()=>{},
   connection:{subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}},
   callWS:async message=>{
    if(message.type==='houseplan/config/get')return {config:structuredClone(fixture.config),rev:1,can_write:true};
    if(message.type==='houseplan/layout/get')return {layout:structuredClone(fixture.layout),rev:1};
    if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
    if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
    if(message.type==='config_entries/get')return [{entry_id:'perf_entry',domain:'houseplan_perf',title:'Synthetic'}];
    if(message.type==='manifest/list')return [{domain:'houseplan_perf',name:'Synthetic'}];return {ok:true};
   }};
  host.replaceChildren(c);window.__card=c;c.hass=hass;
  await c._ensureEditorRuntime();if(profile.includes('isometric'))await c._ensureIsoSceneRuntime();
  await until(()=>c._loadOk&&c._model.length===fixture.counts.floors&&!c._booting&&!c._bootSoft&&c._continuity.state==='steady');
  await c.updateComplete;await frame();
  const root=c.renderRoot,records=[];let renders=0,headerMeasures=0;
  const original=c.render.bind(c);c.render=(...args)=>{renders++;return original(...args);};
  const metrics=new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1&&node.classList.contains('panel-header-metrics'))headerMeasures++;});
  metrics.observe(root,{childList:true,subtree:true});
  const sample=()=>{const stage=root.querySelector('.stage'),svg=root.querySelector('.plan-svg'),box=stage.getBoundingClientRect();return {width:box.width,height:box.height,
   ppu:svg.getBoundingClientRect().width/svg.viewBox.baseVal.width,background:getComputedStyle(stage).backgroundColor,
   toolbar:getComputedStyle(root.querySelector('.editorchrome-inner')).opacity,projection:stage.classList.contains('projection-iso')?'iso':'flat',renders,headerMeasures};};
  for(let cycle=0;cycle<3;cycle++)for(const mode of ['plan','devices','decor','view']){
   const longTasks=[],observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(entry=>({start:entry.startTime,duration:entry.duration}))));
   observer.observe({type:'longtask',buffered:false});
   const before=sample(),start=performance.now(),renderStart=renders,measureStart=headerMeasures,series=[];
   const button=root.querySelector(mode==='view'?'[data-hp=editor-close]':`[data-hp=mode-tab][data-mode=${mode}]`);
   if(!button)throw Error('Missing mode button '+mode);button.click();
   do{await frame();series.push({ms:performance.now()-start,...sample(),busy:c._modeTransitionBusy});}
   while(c._modeTransitionBusy&&performance.now()-start<10000);
   await c.updateComplete;await frame();await frame();
   longTasks.push(...observer.takeRecords().map(entry=>({start:entry.startTime,duration:entry.duration})));observer.disconnect();
   const changed=series.find(row=>Math.abs(row.width-before.width)>.5||Math.abs(row.height-before.height)>.5||row.background!==before.background||row.toolbar!==before.toolbar);
   records.push({cycle,warmup:cycle===0,mode,firstMotionMs:changed?.ms??null,totalMs:performance.now()-start,
    fullRenders:renders-renderStart,headerMeasures:headerMeasures-measureStart,longTasks:longTasks.map(row=>({...row,start:row.start-start})),before,series,after:sample()});
  }
  metrics.disconnect();return {profile,counts:fixture.counts,rooms:root.querySelectorAll('[data-hp=room]').length,records};
 },{fixture,profile});
 rows.push(result);await browser.close();
}
const manifest=JSON.parse(await readFile(resolve(root,'dist/houseplan-assets.json'),'utf8'));
await writeFile(new URL(`./motion-${label}.json`,import.meta.url),JSON.stringify({label,root,fingerprint:manifest.fingerprint,
 source:label==='base'?'efa1b130fc69da8277de8bb013b08ea65b581010':'current working source',rows},null,2));
console.log(JSON.stringify(rows.map(row=>({profile:row.profile,records:row.records.length,measured:row.records.filter(item=>!item.warmup).map(item=>({mode:item.mode,firstMotionMs:item.firstMotionMs,totalMs:item.totalMs,renders:item.fullRenders,headerMeasures:item.headerMeasures,longTasks:item.longTasks.length}))})),null,2));
