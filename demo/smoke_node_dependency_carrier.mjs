// #1303: native Select input on the anonymized owner component. The actual
// Python endpoint proof, validators and ACK own storage, Undo and Redo.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {launch,check,finish} from './serve.mjs';
import {waitForUiKitPaint} from './helpers/ui-kit-paint.mjs';
import {projectGraphSpace} from '../test-build/plan-graph.js';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';

const graph=JSON.parse(readFileSync(new URL('../test/fixtures/1303-bent-carrier.json',import.meta.url)));
const space=projectGraphSpace({id:'floor',title:'Nodes',cell_cm:1,rooms:[],openings:[]},graph).space;
const initial=commitWallSegmentModel({model_version:11,spaces:[space],markers:[],
  settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
let server=structuredClone(initial),revision=1;
const writes=[],observations=[],python=process.env.PYTHON||'python3';
const script=fileURLToPath(new URL('./helpers/wall-node-python.py',import.meta.url));
const {page,browser}=await launch({width:1400,height:1000});
const fixedPoints=source=>source.plan_graph.nodes.filter(n=>n.id!=='drag-end');
try {
  await page.exposeFunction('nodeCarrierWire',message=>{
    if(message.type==='houseplan/config/get')return{config:structuredClone(server),rev:revision,
      can_write:true,wall_node_move_api:1,plan_graph_api:1};
    if(message.type==='houseplan/layout/get')return{layout:{},rev:1};
    if(message.type==='houseplan/config/set')throw Error('node edit must use one atomic node_move');
    if(message.type!=='houseplan/wall/node_move')return null;
    assert.equal(message.expected_rev,revision);
    server=JSON.parse(execFileSync(python,[script],{encoding:'utf8',input:JSON.stringify({config:server,...message})}));
    writes.push(structuredClone(message));
    return{ok:true,config:structuredClone(server),rev:++revision};
  });
  const boot=async()=>{
    await page.evaluate(()=>{
      const old=window.__card,hass=window.__mkHass(),base=hass.callWS.bind(hass);
      hass.devices={};hass.entities={};hass.states={};
      hass.callWS=async message=>message.type.endsWith('registry/list')?[]:(await window.nodeCarrierWire(message))??base(message);
      const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'en'});
      old.remove();document.getElementById('host').append(card);window.__card=card;card.hass=hass;
    });
    await page.waitForFunction(()=>!window.__card._booting&&window.__card._space==='floor');
    await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&window.__card.renderRoot.querySelector('.hp-node-handle'));
    await waitForUiKitPaint(page);
  };
  const inspect=()=>page.evaluate(()=>({preview:structuredClone(window.__card._editorRuntime.nodeMove.preview?.sp),
    source:structuredClone(window.__card._serverCfg),history:window.__card._geometryHistory.size}));
  const acknowledged=async next=>{
    await page.waitForFunction(next=>window.__card._cfgRev===next&&!window.__card._editorRuntime.nodeMove.busy,next);
    await page.evaluate(()=>window.__hpTest.settled());
  };
  const key=async name=>{const next=revision+1;await page.keyboard.press(name);await acknowledged(next);};
  await boot();
  for(const [dx,dy] of [[.05,0],[-.05,0],[0,.05],[0,-.05]]){
    const handle=page.locator('houseplan-card .hp-node-handle[data-node="drag-end"]');
    const box=await handle.boundingBox();assert.ok(box);
    const target=await handle.evaluate((node,[dx,dy])=>{
      const svg=node.ownerSVGElement,p=svg.createSVGPoint();p.x=dx*1000;p.y=dy*1000;
      const origin=svg.createSVGPoint().matrixTransform(svg.getScreenCTM()),to=p.matrixTransform(svg.getScreenCTM());
      return{x:to.x-origin.x,y:to.y-origin.y};
    },[dx,dy]);
    const count=writes.length,from={x:box.x+box.width/2,y:box.y+box.height/2};
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(from.x+target.x,from.y+target.y,{steps:6});
    await page.waitForFunction(()=>!!window.__card._editorRuntime.nodeMove.preview&&!window.__card._editorRuntime.nodeMove.invalid);
    const during=await inspect();
    assert.deepEqual(fixedPoints(during.preview),fixedPoints(initial.spaces[0]),'every far preview node stays exact');
    assert.deepEqual(server,initial,'held pointer cannot save');assert.equal(writes.length,count);
    const next=revision+1;await page.mouse.up();await acknowledged(next);
    assert.equal(writes.length,count+1,'one atomic write');
    assert.deepEqual(server.spaces[0].plan_graph,during.preview.plan_graph,'actual Python ACK equals preview');
    assert.deepEqual(fixedPoints(server.spaces[0]),fixedPoints(initial.spaces[0]));
    const accepted=structuredClone(server);
    await key('Control+z');assert.deepEqual(server,initial,'exact Undo');
    await key('Control+Shift+z');assert.deepEqual(server,accepted,'exact Redo');
    observations.push({dx,dy,target:writes[count].intent.target,writes:writes.length-count});
    if(dy!==-.05){await key('Control+z');assert.deepEqual(server,initial);}
  }
  const accepted=structuredClone(server);await boot();
  assert.deepEqual((await inspect()).source,accepted,'cold mount adopts exact saved result');
  assert.deepEqual(fixedPoints(accepted.spaces[0]),fixedPoints(initial.spaces[0]));
  mkdirSync('artifacts/node-dependency-carrier',{recursive:true});
  await page.screenshot({path:'artifacts/node-dependency-carrier/accepted.png'});
  writeFileSync('artifacts/node-dependency-carrier/evidence.json',JSON.stringify({observations,writes:writes.map(w=>({type:w.type,direction:w.direction}))},null,2));
  check('four native directions preserve all far nodes through preview, Python ACK, Undo/Redo and cold mount',observations.length,4);
}finally{await finish(browser);}
