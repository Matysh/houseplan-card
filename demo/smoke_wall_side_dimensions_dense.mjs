// #1381: real selection and list scrolling; crowded physical geometry is fixture data.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {launch,reportPageErrors} from './serve.mjs';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
const partitions=[{id:'beam',a:[.15,.99],b:[.85,.99],cm:10}];
// Attached columns split one physical face without splitting the saved carrier
// into separate graph edges (which would rightly limit single-wall selection).
const wall_columns=Array.from({length:30},(_,i)=>({id:`support-${i}`,shape:'square',center:[.2+i*.02,.995],cm:12}));
const config=commitWallSegmentModel({spaces:[{id:'dense',title:'Dense',cell_cm:5,rooms:[],partitions,wall_columns,openings:[]}],
  markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
const {page,browser}=await launch({width:1440,height:1050});let writes=0;
try{
  await page.exposeFunction('dimensionDenseWire',message=>{
    if(message.type==='houseplan/config/get')return{config,rev:1,can_write:true,wall_node_move_api:1,plan_graph_api:1};
    if(message.type==='houseplan/layout/get')return{layout:{},rev:1};
    if(/\/(?:set|save|patch)$/.test(message.type)||message.type==='houseplan/wall/node_move'){writes++;throw Error('Unexpected read-only write');}
    return null;
  });
  await page.evaluate(()=>{
    const previous=window.__card,hass=window.__mkHass(),old=hass.callWS.bind(hass);hass.devices={};hass.entities={};hass.states={};
    hass.callWS=async message=>message.type.endsWith('registry/list')?[]:(await window.dimensionDenseWire(message))??old(message);
    const c=document.createElement('houseplan-card');c.setConfig({type:'custom:houseplan-card',language:'en'});previous.remove();
    const host=document.getElementById('host');host.style.width='1350px';host.style.maxWidth='none';host.append(c);window.__card=c;c.hass=hass;
  });
  await page.waitForFunction(()=>window.__card?._booting===false&&window.__card._space==='dense');
  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
  await page.evaluate(async()=>{const c=window.__card,[w,h]=c._lastValidStageSize,vb=c._baseVb();
    c._zoom=Math.max(vb[3],vb[2]*h/w)/1000;c._view={x:(1000-1000*w/h)/2,y:0,w:1000*w/h,h:1000};c.requestUpdate();await c.updateComplete;});
  const p=await page.evaluate(()=>{const svg=window.__card.renderRoot.querySelector('svg.plan-svg'),frame=svg.querySelector('[data-hp-plan-rotation-frame]')||svg;
    const p=new DOMPoint(172,990).matrixTransform(frame.getScreenCTM());return{x:p.x,y:p.y};});
  await page.mouse.click(p.x,p.y);
  const list=page.locator('houseplan-card [data-hp="dimension-list"]');await list.waitFor({state:'visible'});
  const proof=await page.evaluate(()=>{
    const c=window.__card,root=c.renderRoot,list=root.querySelector('[data-hp="dimension-list"]');
    const values=[...list.querySelectorAll('[data-interval]')].map(row=>({id:row.dataset.interval,text:row.textContent.trim()}));
    const numbered=[...root.querySelectorAll('[data-hp="wall-side-dimension"]')].filter(el=>/^\[\d+\]$/.test(el.querySelector('text').textContent));
    return{values,markers:numbered.map(el=>({id:el.dataset.interval,text:el.querySelector('text').textContent})),
      scrollable:list.scrollHeight>list.clientHeight,view:{...c._view},inputs:list.querySelectorAll('input,button,select').length};
  });
  assert.ok(proof.values.length>=25&&proof.scrollable,`crowded current physical intervals remain in a complete scrollable list: ${proof.values.length}, scroll=${proof.scrollable}`);
  assert.equal(proof.inputs,0);
  assert.equal(new Set(proof.values.map(row=>row.id)).size,proof.values.length);
  assert.deepEqual(proof.markers.map(row=>row.id).sort(),proof.values.map(row=>row.id).sort());
  for(const row of proof.values)assert.ok(row.text.startsWith(proof.markers.find(m=>m.id===row.id).text));
  const box=await list.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,480);
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp="dimension-list"]').scrollTop>0);
  assert.deepEqual(await page.evaluate(()=>({...window.__card._view})),proof.view,'list scrolling does not zoom/pan the plan');
  assert.equal(writes,0);mkdirSync('artifacts/1381-native',{recursive:true});await page.screenshot({path:'artifacts/1381-native/dense.png'});
  await page.evaluate(()=>window.__hpTest.setMode('view'));await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
  assert.equal(await page.locator('houseplan-card [data-hp="wall-side-dimensions"]').count(),0);
  assert.equal(await reportPageErrors(),false);console.log(`PASS #1381 dense: ${proof.values.length} numbered intervals, owned scrolling, no writes or View residue`);
}finally{await browser.close();}
