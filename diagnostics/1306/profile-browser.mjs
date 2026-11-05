// Real pointer capture + unchanged production Python proof. This wire harness
// complements test_ha_wall_node_merge.py; it is not a running HA instance.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, check, finish } from '../../demo/serve.mjs';
import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
import { structuralWallNodes } from '../../test-build/wall-node-move.js';
import { projectGraphSpace } from '../../test-build/plan-graph.js';
import { buildNodePreview } from '../../test-build/wall-node-preview.js';
import { waitForUiKitPaint } from '../../demo/helpers/ui-kit-paint.mjs';

const cases=JSON.parse(readFileSync(new URL('../../test/fixtures/1305-node-merge.json',import.meta.url)));
const make=c=>commitWallSegmentModel({model_version:10,spaces:[{id:'f',title:'Merge',view_box:(()=>{
  const points=c.walls.flatMap(w=>[w.a,w.b]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return[Math.min(...xs)-.2,Math.min(...ys)-.2,Math.max(...xs)-Math.min(...xs)+.4,Math.max(...ys)-Math.min(...ys)+.4];
})(),cell_cm:5,
  rooms:[],partitions:c.walls,openings:c.openings||[]}],markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
let server=make(cases[0]),revision=1,capability=true,releaseAck=null;
const writes=[],observations=[],python=process.env.PYTHON||'python3';
const script=fileURLToPath(new URL('../../demo/helpers/wall-node-python.py',import.meta.url));
const {page,browser}=await launch({width:1400,height:1000});
try{
  await page.addStyleTag({content:'#host{width:100%;max-width:none;padding:0;margin:0}'});
  await page.exposeFunction('mergeWire',async message=>{
    if(message.type==='houseplan/config/get')return{config:structuredClone(server),rev:revision,can_write:true,
      wall_node_move_api:1,wall_node_delete_api:1,plan_graph_api:1,...(capability?{wall_node_merge_api:1}:{})};
    if(message.type==='houseplan/layout/get')return{layout:{},rev:1};
    if(message.type==='houseplan/config/set')console.log('unexpected fixture initialization config/set');
    if(message.type==='houseplan/config/set')throw Error('merge must use one node operation');
    if(message.type!=='houseplan/wall/node_move')return null;
    assert.equal(message.expected_rev,revision);
    const next=JSON.parse(execFileSync(python,[script],{encoding:'utf8',input:JSON.stringify({config:server,...message}),maxBuffer:16*1024*1024}));
    writes.push(structuredClone(message));server=next;
    if(releaseAck)await new Promise(resolve=>{releaseAck=resolve;});
    return{ok:true,config:structuredClone(server),rev:++revision};
  });
  const boot=async()=>{
    await page.evaluate(()=>{
      const previous=window.__card,hass=window.__mkHass(),base=hass.callWS.bind(hass);
      hass.devices={};hass.entities={};hass.states={};hass.connection={...hass.connection,connected:true};
      hass.callWS=async m=>m.type.endsWith('registry/list')?[]:(await window.mergeWire(m))??base(m);
      const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'en'});
      previous.remove();document.getElementById('host').append(card);window.__card=card;card.hass=hass;
    });
    await page.waitForFunction(()=>!window.__card._booting&&window.__card._space==='f');
    await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&window.__card.renderRoot.querySelector('.hp-node-handle'));
    await waitForUiKitPaint(page);
    await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
    await page.waitForFunction(()=>!window.__card._cameraTransition.active);
    await page.evaluate(()=>window.__hpTest.settled());
  };
  const screen=p=>page.evaluate(p=>{
    const svg=window.__card.renderRoot.querySelector('.hp-node-handle').ownerSVGElement,q=svg.createSVGPoint();
    q.x=p[0]*1000;q.y=p[1]*1000;const out=q.matrixTransform(svg.getScreenCTM());return{x:out.x,y:out.y};
  },p);
  const inspect=()=>page.evaluate(()=>({config:structuredClone(window.__card._serverCfg),history:window.__card._geometryHistory.size,
    targets:[...window.__card.renderRoot.querySelectorAll('[data-hp="node-merge-target"]')].map(n=>n.dataset.node),
    busy:window.__card._editorRuntime.nodeMove.busy}));
  const ack=async next=>{await page.waitForFunction(next=>window.__card._cfgRev===next&&!window.__card._editorRuntime.nodeMove.busy,next);
    await page.evaluate(()=>window.__hpTest.settled());};
  server=JSON.parse(readFileSync('artifacts/1305/ordinary-5000.json')).config;
  server.spaces[0].view_box=[-.5,-.5,3,3];
  server.settings={filter_seeded:true,known_devices:[],new_device_ids:[]};revision++;await boot();
  await page.evaluate(()=>{
    const editor=window.__card._editorRuntime.nodeMove,validate=editor.port.validate,toast=editor.port.toast;
    window.__normalProfile={phase:'held',checks:[],toasts:[]};
    editor.port.toast=(...args)=>{window.__normalProfile.toasts.push(args);return toast(...args);};
    editor.port.validate=(...args)=>{const start=performance.now();try{const ok=validate(...args);window.__normalProfile.lastValid=ok;return ok;}
      finally{window.__normalProfile.checks.push({phase:window.__normalProfile.phase,ms:performance.now()-start});}};
  });
  const source=await screen([0,0]),target=await screen([-.25,.25]);
  await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(target.x,target.y);
  await page.waitForFunction(()=>!!window.__card._editorRuntime.nodeMove.preview);
  await page.evaluate(()=>{window.__normalProfile.phase='release';});
  const next=revision+1,start=performance.now();await page.mouse.up();
  let error=null;try{await ack(next);}catch(e){error=e.message;}
  const result={error,releaseToAckMs:performance.now()-start,...await page.evaluate(()=>window.__normalProfile),writes:writes.length};
  writeFileSync('artifacts/1305/ordinary-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
