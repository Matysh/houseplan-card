// Native Select pointer/paint/ACK proof. Python is the production CPU writer;
// the real authenticated HA/store boundary is test_ha_wall_node_attach.py.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { projectGraphSpace } from '../test-build/plan-graph.js';
import { decodePoint, pointToNumbers } from '../test-build/plan-exact.js';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';

const cases=JSON.parse(readFileSync(new URL('../test/fixtures/1330-node-attach.json',import.meta.url)));
const make=c=>{
  const points=c.graph.nodes.map(n=>pointToNumbers(decodePoint(n.p))),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return commitWallSegmentModel({model_version:11,spaces:[projectGraphSpace({id:'f',title:'Attach',cell_cm:5,
    view_box:[Math.min(...xs)-.1,Math.min(...ys)-.1,Math.max(...xs)-Math.min(...xs)+.2,Math.max(...ys)-Math.min(...ys)+.2],
    rooms:c.rooms,openings:c.openings},c.graph).space],markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
};
let server=make(cases[0]),revision=1,capability=true,releaseAck=null;
const writes=[],observations=[],python=process.env.PYTHON||'python3';
const script=fileURLToPath(new URL('./helpers/wall-node-python.py',import.meta.url));
const {page,browser}=await launch({width:1400,height:1000});
mkdirSync('artifacts/1330',{recursive:true});
try {
  await page.addStyleTag({content:'#host{width:100%;max-width:none;padding:0;margin:0}'});
  await page.exposeFunction('attachWire',async message=>{
    if(message.type==='houseplan/config/get')return{config:structuredClone(server),rev:revision,can_write:true,
      wall_node_move_api:1,wall_node_delete_api:1,wall_node_merge_api:1,plan_graph_api:1,...(capability?{wall_node_attach_api:1}:{})};
    if(message.type==='houseplan/layout/get')return{layout:{},rev:1};
    if(message.type==='houseplan/config/set')throw Error('attach must use the existing node operation');
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
      hass.callWS=async m=>m.type.endsWith('registry/list')?[]:(await window.attachWire(m))??base(m);
      const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'en'});
      previous.remove();document.getElementById('host').append(card);window.__card=card;card.hass=hass;
    });
    await page.waitForFunction(()=>!window.__card._booting&&window.__card._space==='f');
    await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&window.__card.renderRoot.querySelector('.hp-node-handle'));
    await waitForUiKitPaint(page);
    await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
    await page.waitForFunction(()=>!window.__card._cameraTransition.active);
    // This graph-only synthetic fixture has no room floor. Give every case
    // its declared all-edge camera, rather than testing the product Fit
    // policy (an opening-only fit can legitimately frame just that opening).
    await page.evaluate(()=>{
      const c=window.__card,sp=c._serverCfg.spaces[0],v=sp.view_box,stage=c._stageEl;
      c._cancelCameraTransition(false,true);
      const ratio=stage.clientWidth/stage.clientHeight,w=Math.max(v[2]*1000,v[3]*1000*ratio),h=w/ratio;
      c._view={x:(v[0]+v[2]/2)*1000-w/2,y:(v[1]+v[3]/2)*1000-h/2,w,h};c.requestUpdate();
    });
    await page.evaluate(()=>window.__hpTest.settled());
    await page.evaluate(()=>{
      const runtime=window.__card._editorRuntime,original=runtime._junctionLimitsIntroduced.bind(runtime);
      window.__attachGuards=0;runtime._junctionLimitsIntroduced=(...args)=>{window.__attachGuards++;return original(...args);};
    });
  };
  const screen=p=>page.evaluate(p=>{
    const svg=window.__card.renderRoot.querySelector('.hp-node-handle').ownerSVGElement,q=svg.createSVGPoint();
    q.x=p[0]*1000;q.y=p[1]*1000;const out=q.matrixTransform(svg.getScreenCTM());return{x:out.x,y:out.y};
  },p);
  const inspect=()=>page.evaluate(()=>({config:structuredClone(window.__card._serverCfg),history:window.__card._geometryHistory.size,
    target:!!window.__card.renderRoot.querySelector('[data-hp="node-attach-target"]'),
    guards:window.__attachGuards,busy:window.__card._editorRuntime.nodeMove.busy}));
  const ack=async next=>{await page.waitForFunction(next=>window.__card._cfgRev===next&&!window.__card._editorRuntime.nodeMove.busy,next);
    await page.evaluate(()=>window.__hpTest.settled());};
  for(const name of ['horizontal wall','vertical reversed host','diagonal exact q','zero partition','mixed thickness','receiver opening first child','receiver opening second child reversed','branch opening fixed far center','receiver 1 room owners','receiver 2 room owners']){
    console.log('case:',name);
    const c=cases.find(c=>c.name===name);server=make(c);revision++;await boot();const before=structuredClone(server),count=writes.length;
    const original=c.graph.nodes.find(n=>n.id==='s'),p=pointToNumbers(decodePoint(original.p));
    const host=c.graph.edges.find(e=>e.id==='host'),a=pointToNumbers(decodePoint(c.graph.nodes.find(n=>n.id===host.from).p)),b=pointToNumbers(decodePoint(c.graph.nodes.find(n=>n.id===host.to).p));
    const target=[(a[0]+b[0])/2,(a[1]+b[1])/2],sourceScreen=await screen(p),targetScreen=await screen(target);
    await page.mouse.move(sourceScreen.x,sourceScreen.y);await page.mouse.down();await page.mouse.move(targetScreen.x,targetScreen.y,{steps:3});
    await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-attach-target"]'));
    // Approach frames outside the attach radius still belong to ordinary
    // Move. Count only the held attach window, including host rerenders.
    await page.evaluate(()=>{window.__attachGuards=0;});
    await page.mouse.move(targetScreen.x+1,targetScreen.y);
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    const held=await inspect();assert.deepEqual(held.config,before);assert.equal(held.history,0);assert.equal(writes.length,count);assert.equal(held.guards,0);
    if(name==='horizontal wall'){
      await page.evaluate(async()=>{window.__card.requestUpdate();await window.__card.updateComplete;});
      assert.equal((await inspect()).target,true,'host rerender retains target and bounded outline');
      await page.screenshot({path:'artifacts/1330/held-target.png'});
      await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual((await inspect()).config,before);assert.equal(writes.length,count);
      await page.mouse.move(sourceScreen.x,sourceScreen.y);await page.mouse.down();await page.mouse.move(targetScreen.x,targetScreen.y);
      await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-attach-target"]'));
      releaseAck=true;
    }
    const next=revision+1;await page.mouse.up();
    if(name==='horizontal wall'){
      await page.waitForFunction(()=>window.__card._editorRuntime.nodeMove.busy);
      await page.waitForFunction(()=>window.__attachGuards===1);
      const deadline=Date.now()+5000;while(writes.length===count&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
      assert.equal(writes.length,count+1);assert.deepEqual((await inspect()).config,before);assert.equal((await inspect()).history,0);
      const release=releaseAck;releaseAck=null;release();
    }
    await ack(next);const accepted=structuredClone(server);assert.equal(writes.length,count+1);assert.equal((await inspect()).history,1);
    assert.equal(writes[count].intent.node_id,'s');assert.ok(writes[count].intent.attach_edge);assert.equal((await inspect()).guards,1);
    const undoRev=revision+1;await page.keyboard.press('Control+z');await ack(undoRev);assert.deepEqual(server,before,'exact Undo');
    const redoRev=revision+1;await page.keyboard.press('Control+Shift+z');await ack(redoRev);assert.deepEqual(server,accepted,'same split IDs on Redo');
    await boot();assert.deepEqual((await inspect()).config,accepted,'new card readback');
    observations.push({case:name,writes:1,heldFullProofs:0,releaseFullProofs:1,history:1});check(name,true);
  }
  // Native down, release with a fresh position and no final move event.
  server=make(cases[0]);revision++;await boot();let count=writes.length;
  let source=await screen([.5,.25]),target=await screen([.5,0]);
  await page.mouse.move(source.x,source.y);await page.mouse.down();
  const releasePositionRev=revision+1;
  await page.evaluate(target=>{
    const editor=window.__card._editorRuntime.nodeMove,stage=editor.port.stage();
    stage.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,composed:true,pointerId:editor.activePointerId,pointerType:'mouse',isPrimary:true,button:0,clientX:target.x,clientY:target.y}));
  },target);
  await ack(releasePositionRev);await page.mouse.up();assert.equal(writes.length,count+1);assert.ok(writes[count].intent.attach_edge);
  observations.push({case:'release has the last position',writes:1});
  // Cancel, missing capability, ambiguous carriers and non-dangling source.
  for(const mode of ['cancel','old-backend','ambiguous','corner','capability-retired','authority-retired']){
    const c=structuredClone(cases[mode==='corner'?10:0]);
    if(mode==='ambiguous'){
      c.graph.nodes.push({id:'x',p:['l','0','-2']},{id:'y',p:['l','240','-2']});c.graph.edges.push({kind:'partition',id:'other',from:'x',to:'y',cm:0});
    }
    server=make(c);revision++;capability=mode!=='old-backend';await boot();const before=structuredClone(server);count=writes.length;
    source=await screen([.5,.25]);target=await screen([.5,mode==='ambiguous'?-1/240:0]);
    await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(target.x,target.y);
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    if(['cancel','capability-retired','authority-retired'].includes(mode)){
      assert.equal((await inspect()).target,true);
      if(mode==='cancel')await page.evaluate(()=>{const e=window.__card._editorRuntime.nodeMove;e.port.stage().dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,composed:true,pointerId:e.activePointerId,pointerType:'mouse'}));});
      else if(mode==='capability-retired')await page.evaluate(()=>{window.__card._haWallNodeAttachApi=null;window.__card.requestUpdate();});
      else {
        const reset=await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,connection:{...c.hass.connection},user:{...c.hass.user,id:'synthetic-foreign'}};return c._haWallNodeAttachApi;});
        assert.equal(reset,null,'authority change resets attach capability before the next read');
      }
    }else if(mode!=='ambiguous')assert.equal((await inspect()).target,false);
    if(mode==='old-backend'||mode==='corner')await page.keyboard.press('Escape');
    await page.mouse.up();await page.waitForFunction(()=>!window.__card._editorRuntime.nodeMove.dragging);
    assert.deepEqual((await inspect()).config,before);assert.equal(writes.length,count);assert.equal((await inspect()).history,0);
    observations.push({case:mode,writes:0});check(mode+' cancels without write',true);
  }
  // Held frames on 5000 edges never build a full candidate/proof or history.
  capability=true;server=make(cases[0]);const graph=structuredClone(server.spaces[0].plan_graph);
  for(let i=0;i<4998;i++){
    const x=720+(i%100)*8,y=480+Math.floor(i/100)*8,key='perf-'+String(i).padStart(4,'0');
    graph.nodes.push({id:key+'a',p:['l',String(x),String(y)]},{id:key+'b',p:['l',String(x+4),String(y)]});
    graph.edges.push({kind:'wall',id:key,from:key+'a',to:key+'b',cm:0});
  }
  graph.nodes.sort((a,b)=>a.id<b.id?-1:1);
  graph.edges.sort((a,b)=>(a.kind+':'+a.id)<(b.kind+':'+b.id)?-1:1);
  // Keep the foreground camera; remote buildings are not part of this gesture.
  server=commitWallSegmentModel({...server,spaces:[projectGraphSpace(server.spaces[0],graph).space]}).config;revision++;await boot();
  count=writes.length;const before=structuredClone(server);source=await screen([.5,.25]);const targets=await Promise.all([[.45,0],[.55,0]].map(screen));
  await page.evaluate(()=>{const e=window.__card._editorRuntime.nodeMove,flush=e.flushMove.bind(e);window.__attachFrames=[];
    e.flushMove=()=>{const t=performance.now();try{return flush();}finally{window.__attachFrames.push(performance.now()-t);}};});
  await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(targets[0].x,targets[0].y);
  await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('[data-hp="node-attach-target"]'));
  await page.evaluate(()=>{window.__attachFrames=[];window.__attachGuards=0;});
  for(let i=0;i<100;i++){const p=targets[(i+1)%2];await page.mouse.move(p.x,p.y);await page.evaluate(()=>new Promise(requestAnimationFrame));}
  const frames=await page.evaluate(()=>window.__attachFrames.slice().sort((a,b)=>a-b));assert.ok(frames.length>=100);
  assert.equal((await inspect()).guards,0);assert.equal(writes.length,count);assert.equal((await inspect()).history,0);assert.deepEqual((await inspect()).config,before);
  const next=revision+1;await page.mouse.up();await ack(next);assert.equal(writes.length,count+1);assert.equal((await inspect()).guards,1);
  observations.push({case:'5000 edges / 100 held targets',frames:frames.length,p50:frames[Math.floor(frames.length/2)],p95:frames[Math.ceil(frames.length*.95)-1],heldFullProofs:0,releaseFullProofs:1});
  writeFileSync('artifacts/1330/native-observations.json',JSON.stringify(observations,null,2)+'\n');
  check('native attach, ACK, exact history, cancellation and bounded preview',observations.length,18);
 } catch(error) {
  console.log('native failure state',await page.evaluate(()=>{
    const c=window.__card,e=c._editorRuntime?.nodeMove,s=e?.session;
    return {context:e?.port.context(),dragging:e?.dragging,session:s&&{target:s.target,node:s.plan.node,attach:!!s.attach,picker:!!s.attachPicker,invalid:s.invalid,moved:s.moved},
      pending:!!e?.pendingMove,cap:c._haWallNodeAttachApi,view:c._view,stage:c._stageEl?.getBoundingClientRect().toJSON()};
  }));
  await page.screenshot({path:'artifacts/1330/failure.png'});throw error;
} finally {
  if(typeof releaseAck==='function')releaseAck();
  await finish(browser);
}
