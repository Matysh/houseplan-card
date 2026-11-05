// Real pointer capture + unchanged production Python proof. This wire harness
// complements test_ha_wall_node_merge.py; it is not a running HA instance.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { structuralWallNodes } from '../test-build/wall-node-move.js';
import { projectGraphSpace } from '../test-build/plan-graph.js';
import { buildNodePreview } from '../test-build/wall-node-preview.js';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';

const cases=JSON.parse(readFileSync(new URL('../test/fixtures/1305-node-merge.json',import.meta.url)));
const make=c=>commitWallSegmentModel({model_version:10,spaces:[{id:'f',title:'Merge',view_box:(()=>{
  const points=c.walls.flatMap(w=>[w.a,w.b]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return[Math.min(...xs)-.2,Math.min(...ys)-.2,Math.max(...xs)-Math.min(...xs)+.4,Math.max(...ys)-Math.min(...ys)+.4];
})(),cell_cm:5,
  rooms:[],partitions:c.walls,openings:c.openings||[]}],markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
let server=make(cases[0]),revision=1,capability=true,releaseAck=null;
const writes=[],observations=[],python=process.env.PYTHON||'python3';
const script=fileURLToPath(new URL('./helpers/wall-node-python.py',import.meta.url));
const {page,browser}=await launch({width:1400,height:1000});
try{
  await page.addStyleTag({content:'#host{width:100%;max-width:none;padding:0;margin:0}'});
  await page.exposeFunction('mergeWire',async message=>{
    if(message.type==='houseplan/config/get')return{config:structuredClone(server),rev:revision,can_write:true,
      wall_node_move_api:1,wall_node_delete_api:1,plan_graph_api:1,...(capability?{wall_node_merge_api:1}:{})};
    if(message.type==='houseplan/layout/get')return{layout:{},rev:1};
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
  await boot();
  for(const index of [0,1,2,3]){
    const c=cases[index];server=make(c);revision++;await boot();const before=structuredClone(server),count=writes.length;
    const source=await screen(c.point),target=await screen(c.target),targetId=structuralWallNodes(server.spaces[0]).find(n=>n.point.every((v,i)=>Math.abs(v-c.target[i])<1e-9)).nodeId;
    await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:4});
    await page.waitForFunction(id=>[...window.__card.renderRoot.querySelectorAll('[data-hp="node-merge-target"]')].some(n=>n.dataset.node===id),targetId);
    const held=await inspect();check(c.name+': stationary named target highlighted',held.targets.includes(targetId));
    assert.deepEqual(held.config,before);assert.equal(writes.length,count);assert.equal(held.history,0);
    if(index===0){
      await page.mouse.move(target.x+35,target.y+35);await page.waitForFunction(()=>!window.__card.renderRoot.querySelector('[data-hp="node-merge-target"]'));
      await page.mouse.move(target.x,target.y);await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-merge-target"]'));
      await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual((await inspect()).config,before);assert.equal(writes.length,count);
      await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(target.x,target.y);
      await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-merge-target"]'));
      releaseAck=true;
    }
    const next=revision+1;await page.mouse.up();
    if(index===0){
      await page.waitForFunction(()=>window.__card._editorRuntime.nodeMove.busy);
      const deadline=Date.now()+5000;
      while(writes.length===count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
      assert.equal(writes.length,count+1,JSON.stringify(await inspect()));
      assert.deepEqual((await inspect()).config,before);assert.equal((await inspect()).history,0);
      const release=releaseAck;releaseAck=null;release();
    }
    await ack(next);assert.equal(writes.length,count+1);assert.equal((await inspect()).history,1);
    assert.equal(writes[count].intent.merge_node_id,targetId);
    const accepted=structuredClone(server),undoRev=revision+1;await page.keyboard.press('Control+z');await ack(undoRev);assert.deepEqual(server,before,'exact Undo');
    const redoRev=revision+1;await page.keyboard.press('Control+Shift+z');await ack(redoRev);assert.deepEqual(server,accepted,'exact Redo');
    observations.push({case:c.name,edges:accepted.spaces[0].plan_graph.edges.length,nodes:accepted.spaces[0].plan_graph.nodes.length});
  }
  // Seven final rays are refused on release, never saved as an ordinary move.
  const overfull={point:[0,-1],target:[0,0],walls:[
    {id:'a',a:[0,-1],b:[-3,-2],cm:0},{id:'b',a:[0,-1],b:[-1,-3],cm:0},
    {id:'c',a:[0,-1],b:[1,-3],cm:0},{id:'d',a:[0,-1],b:[3,-2],cm:0},
    {id:'e',a:[0,0],b:[3,0],cm:0},{id:'f',a:[0,0],b:[0,3],cm:0},{id:'g',a:[0,0],b:[-3,0],cm:0}]};
  server=make(overfull);revision++;await boot();
  const rejectedBefore=structuredClone(server),rejectedWrites=writes.length,rs=await screen(overfull.point),rt=await screen(overfull.target);
  await page.mouse.move(rs.x,rs.y);await page.mouse.down();await page.mouse.move(rt.x,rt.y);
  await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-merge-target"]'));
  await page.mouse.up();await page.waitForFunction(()=>!window.__card._editorRuntime.nodeMove.dragging);
  await page.getByText('Cannot merge: more than six walls would meet at the node.',{exact:true}).waitFor();
  assert.deepEqual((await inspect()).config,rejectedBefore);assert.equal((await inspect()).history,0);assert.equal(writes.length,rejectedWrites);
  check('invalid final valence cancels the entire native gesture with a useful error',true);
  // A normal click near a reachable neighbour must not delete the connecting edge.
  const crowded={...cases[3],walls:[...cases[3].walls,{id:'far',a:[4,2],b:[4,3],cm:0}]};
  server=make(crowded);revision++;await boot();
  const neighbours=await Promise.all([[0,0],[1,0]].map(screen)),span=Math.hypot(neighbours[1].x-neighbours[0].x,neighbours[1].y-neighbours[0].y);
  crowded.walls[0]={...crowded.walls[0],b:[10/span,0]};server=make(crowded);revision++;await boot();
  const pair=await Promise.all([[0,0],[10/span,0]].map(screen));
  assert.ok(Math.abs(Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y)-10)<.5,'native scene has a neighbour at 10 CSS px');
  const close=await screen([0,0]),count=writes.length;
  await page.mouse.click(close.x,close.y);await page.waitForTimeout(150);
  assert.equal(writes.length,count);assert.equal((await inspect()).history,0);check('click with a neighbour at 10px does not merge',true);
  // Unsupported backend still permits ordinary moves but offers no merge target.
  server=make(cases[0]);revision++;capability=false;await boot();
  const a=await screen([0,0]),b=await screen([1,1]);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);
  await page.waitForTimeout(60);assert.deepEqual((await inspect()).targets,[]);await page.keyboard.press('Escape');await page.mouse.up();
  // #1306: observe the real introduced-limit callsite, not just port.validate
  // invocations. The unchanged ordinary candidate is reused through release.
  capability=true;server=make(cases[0]);revision++;await boot();
  await page.evaluate(()=>{
    const runtime=window.__card._editorRuntime,original=runtime._junctionLimitsIntroduced.bind(runtime);
    window.__ordinaryGuards=0;
    runtime._junctionLimitsIntroduced=(...args)=>{window.__ordinaryGuards++;return original(...args);};
  });
  const ordinaryCount=writes.length,os=await screen([0,0]),ot=await screen([.25,.25]);
  await page.mouse.move(os.x,os.y);await page.mouse.down();await page.mouse.move(ot.x,ot.y);
  await page.waitForFunction(()=>!!window.__card._editorRuntime.nodeMove.preview);
  assert.equal(await page.evaluate(()=>window.__ordinaryGuards),1);
  const ordinaryRev=revision+1;await page.mouse.up();await ack(ordinaryRev);
  assert.equal(await page.evaluate(()=>window.__ordinaryGuards),1,'release reuses the same full proof');
  assert.equal(writes.length,ordinaryCount+1);assert.equal(writes[ordinaryCount].intent.merge_node_id,undefined);
  observations.push({case:'ordinary candidate / native release',fullGuards:1,writes:1});
  // Exactly 5000 valid structural edges. Other buildings keep their accepted
  // records while the foreground target changes on every measured frame.
  capability=true;server=make(cases[0]);
  const graph=structuredClone(server.spaces[0].plan_graph);
  for(let i=0;i<4998;i++){
    const x=720+(i%100)*8,y=480+Math.floor(i/100)*8,id='perf-'+String(i).padStart(4,'0');
    graph.nodes.push({id:id+'a',p:['l',String(x),String(y)]},{id:id+'b',p:['l',String(x+4),String(y)]});
    graph.edges.push({kind:'wall',id,from:id+'a',to:id+'b',cm:0});
  }
  server=commitWallSegmentModel({...server,spaces:[projectGraphSpace(server.spaces[0],graph).space]}).config;revision++;await boot();
  const perfBefore=structuredClone(server),perfWrites=writes.length,ps=await screen([0,0]),targets=await Promise.all([[1,1],[2,1]].map(screen));
  await page.evaluate(()=>{
    const editor=window.__card._editorRuntime.nodeMove,flush=editor.flushMove.bind(editor),validate=editor.port.validate;
    window.__mergePerf={samples:[],validations:0,releaseMs:[]};
    editor.flushMove=()=>{const start=performance.now();try{return flush();}finally{window.__mergePerf.samples.push(performance.now()-start);}};
    editor.port.validate=(...args)=>{window.__mergePerf.validations++;const start=performance.now();
      try{return validate(...args);}finally{window.__mergePerf.releaseMs.push(performance.now()-start);}};
  });
  await page.mouse.move(ps.x,ps.y);await page.mouse.down();await page.mouse.move(targets[0].x,targets[0].y);
  await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-merge-target"]'));
  await page.evaluate(()=>{window.__mergePerf.samples=[];window.__mergePerf.validations=0;});
  for(let i=0;i<100;i++){const p=targets[(i+1)%2];await page.mouse.move(p.x,p.y);await page.evaluate(()=>new Promise(requestAnimationFrame));}
  const perf=await page.evaluate(()=>window.__mergePerf),sorted=perf.samples.slice().sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
  assert.ok(sorted.length>=100,JSON.stringify(perf));assert.ok(p95<=50,JSON.stringify({p95,frames:sorted.length}));
  assert.equal(perf.validations,0);assert.equal(writes.length,perfWrites);assert.equal((await inspect()).history,0);
  assert.deepEqual((await inspect()).config,perfBefore);
  const next=revision+1,start=performance.now();await page.mouse.up();await ack(next);
  const accepted=await inspect(),released=await page.evaluate(()=>window.__mergePerf);
  assert.equal(released.validations,1);assert.equal(writes.length,perfWrites+1);assert.equal(accepted.history,1);
  const ackMs=performance.now()-start,timings=[];
  // Separate CPU diagnostics on the very same selected space, in Node; the
  // native release measurement above includes the actual browser guard.
  for(const [name,space] of [['baseline',perfBefore.spaces[0]],['candidate',server.spaces[0]]]){
    const t=performance.now(),geometry=buildNodePreview(space);assert.equal(geometry.safe,true);timings.push({name,ms:performance.now()-t});
  }
  observations.push({case:'5000 edges / 100 changing target frames',p95,frames:sorted.length,physicalChecks:perf.validations,
    heldWrites:0,releasePhysicalChecks:released.validations,releaseGuardMs:released.releaseMs,releaseToAckMs:ackMs,nodePreview:timings});
  mkdirSync('artifacts/1305',{recursive:true});writeFileSync('artifacts/1305/native-observations.json',JSON.stringify(observations,null,2)+'\n');
  check('native pointer/Python contraction, deletion, ACK, exact history and held performance',observations.length,6);
}finally{if(typeof releaseAck==='function')releaseAck();await browser.close();}
finish();
