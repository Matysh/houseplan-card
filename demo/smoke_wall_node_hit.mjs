/** Native mouse regression: a painted endpoint owns its whole circle (#1259). */
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { launch, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove,prepareNodeMove,structuralWallNodes } from '../test-build/wall-node-move.js';
mkdirSync('artifacts/1259',{recursive:true});
const rows=[];
for(const scale of [1,2]) {
 const {page,browser}=await launch({width:1500,height:1000},scale);
 let server,revision=1;const writes=[];
 try {
  await page.exposeFunction('nodeHitWire',m=>{
   if(m.type==='houseplan/config/get')return{config:structuredClone(server),rev:revision,can_write:true,wall_node_move_api:1,wall_node_delete_api:1,plan_graph_api:1};
   if(m.type==='houseplan/layout/get')return{layout:{},rev:1};
   if(m.type!=='houseplan/wall/node_move')return null;
   assert.equal(m.expected_rev,revision);const before=server.spaces[0],nodes=structuralWallNodes(before),node=nodes.find(n=>n.nodeId===m.intent.node_id);
   assert.ok(node);const result=applyNodeMove(prepareNodeMove(before,node,nodes,m.intent.split_ids),m.intent.target,m.intent.axis);
   assert.equal(result.ok,true);server=commitWallSegmentModel({...server,spaces:[result.space]}).config;writes.push(m);
   return{config:structuredClone(server),rev:++revision,ok:true};
  });
  for(const [cell,viewW,rotation] of [[1,800,0],[1,2500,90],[5,200,270],[30,1000,0]]) for(const end of [0,1]) {
   const label=`cell${cell}-w${viewW}-r${rotation}-end${end}-dpr${scale}`;
   server=commitWallSegmentModel({model_version:10,spaces:[{id:'node-hit-floor',title:label,cell_cm:cell,rooms:[],wall_segments:[],partitions:[{id:'wall',a:[.45,.45],b:[.55,.45],cm:0}]}],markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
   writes.length=0;revision++;
   await page.evaluate(async({label,rotation})=>{
    const previous=window.__card,hass=window.__mkHass(),old=hass.callWS.bind(hass);hass.devices={};hass.entities={};hass.states={};
    hass.callWS=async m=>m.type.endsWith('registry/list')?[]:(await window.nodeHitWire(m))??old(m);
    const c=document.createElement('houseplan-card');c.setConfig({type:'custom:houseplan-card',title:label,language:'en',rotation});previous.remove();document.getElementById('host').append(c);window.__card=c;c.hass=hass;
   },{label,rotation});
   await page.waitForFunction(()=>!window.__card._booting&&window.__card._space==='node-hit-floor');
   await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
   await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&window.__card.renderRoot.querySelector('.hp-node-handle'));
   await page.evaluate(async viewW=>{const c=window.__card,stage=c._stageEl,vb=c._baseVb(),fitW=Math.max(vb[2],vb[3]*stage.clientWidth/stage.clientHeight);c._applyView(fitW/viewW,500,500);c.requestUpdate();await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},viewW);
   const target=async()=>page.evaluate(end=>{
    const c=window.__card,hs=[...c.renderRoot.querySelectorAll('.hp-node-handle')].sort((a,b)=>+a.getAttribute('cx')-+b.getAttribute('cx'));
    const h=hs[end],other=hs[1-end],m=h.getScreenCTM(),point=(x,y)=>{const q=h.ownerSVGElement.createSVGPoint();q.x=x;q.y=y;const z=q.matrixTransform(m);return{x:z.x,y:z.y};};
    const x=+h.getAttribute('cx'),y=+h.getAttribute('cy'),p=point(x,y),b=point(+other.getAttribute('cx'),+other.getAttribute('cy'));
    const painted=[...c.renderRoot.querySelectorAll('.plan-snap-node[data-kind="endpoint"]')].find(n=>Math.abs(+n.getAttribute('cx')-x)<1e-6&&Math.abs(+n.getAttribute('cy')-y)<1e-6);
    if(!painted)throw Error('missing painted endpoint');
    const radius=+painted.getAttribute('r')*Math.hypot(m.a,m.b),hit=+h.getAttribute('r')*Math.hypot(m.a,m.b),len=Math.hypot(b.x-p.x,b.y-p.y),dx=(b.x-p.x)/len,dy=(b.y-p.y)/len;
    return{key:h.dataset.node,x,y,p,radius,hit,edge:{x:p.x+dx*(radius+.4),y:p.y+dy*(radius+.4)},outside:{x:p.x+dx*(hit+3),y:p.y+dy*(hit+3)},goal:point(x,y+40/Math.hypot(m.a,m.b))};
   },end);
   const t=await target();assert.ok(t.hit>=12-1e-5);assert.ok(t.hit>=t.radius+2-1e-5);assert.ok(t.edge.x>0&&t.edge.x<1500&&t.edge.y>0&&t.edge.y<1000,JSON.stringify(t));
   const before=structuredClone(server),rev=revision;
   await page.mouse.move(t.edge.x,t.edge.y);await page.mouse.down();
   assert.equal(await page.evaluate(key=>window.__card._editorRuntime.nodeMove.session?.plan.node.key===key,t.key),true,`${label}: painted edge captures this node`);
   await page.mouse.move(t.goal.x,t.goal.y,{steps:3});await page.keyboard.press('Escape');await page.evaluate(()=>window.__hpTest.settled());await page.mouse.up();
   assert.equal(await page.evaluate(()=>window.__card._editorRuntime.nodeMove.dragging),false);assert.deepEqual(server,before);assert.equal(revision,rev);assert.equal(writes.length,0);
   await page.mouse.click(t.edge.x,t.edge.y,{button:'right'});await page.locator('houseplan-card [data-hp="node-context-menu"]:not([inert])').waitFor();await page.keyboard.press('Escape');await page.evaluate(()=>window.__hpTest.settled());
   await page.mouse.move(t.outside.x,t.outside.y);await page.mouse.down();assert.equal(await page.evaluate(()=>window.__card._editorRuntime.nodeMove.dragging),false,`${label}: outside handle stays outside node`);await page.keyboard.press('Escape');await page.evaluate(()=>window.__hpTest.settled());await page.mouse.up();
   // Commit once, then hit the same identity at its new location.
   await page.mouse.move(t.edge.x,t.edge.y);await page.mouse.down();
   const captured=await page.evaluate(()=>!!window.__card._editorRuntime.nodeMove.session);
   await page.mouse.move(t.goal.x,t.goal.y,{steps:3});
   const preview=await page.evaluate(()=>{const e=window.__card._editorRuntime.nodeMove,s=e.session;return{captured:!!s,moved:s?.moved,invalid:s?.invalid,target:s?.target,state:window.__card.renderRoot.querySelector('[data-hp-node-live="2"] .hp-node-layer')?.dataset.hpNodeState};});
   await page.mouse.up();
   await page.waitForFunction(()=>!window.__card._editorRuntime.nodeMove.busy&&window.__card._editorRuntime.nodeMove.session===null);
   if(writes.length!==1)writeFileSync(`artifacts/1259/failure-${label}.json`,JSON.stringify({t,captured,preview,body:await page.locator('body').innerText()},null,2));
   assert.equal(writes.length,1,`${label}: one accepted node write`);
   await page.evaluate(()=>window.__hpTest.settled());const after=await target();assert.equal(after.key,t.key);assert.notEqual(after.y,t.y);await page.evaluate(()=>{window.addEventListener('contextmenu',e=>{const n=window.__card._editorRuntime.nodeMove,p=n.port.screenPoint(e);window.__hitContext={client:[e.clientX,e.clientY],point:p,radius:n.port.hitRadius(n.port.unitsPerPixel()),nodes:n.nodes()?.nodes.map(x=>({key:x.key,distance:Math.hypot(x.point[0]-p[0],x.point[1]-p[1])}))};},{capture:true,once:true});});
   await page.mouse.click(after.edge.x,after.edge.y,{button:'right'});try{await page.locator('houseplan-card [data-hp="node-context-menu"]:not([inert])').waitFor({timeout:3000});}catch(error){writeFileSync(`artifacts/1259/context-failure-${label}.json`,JSON.stringify({after,event:await page.evaluate(()=>window.__hitContext)},null,2));throw error;}await page.keyboard.press('Escape');await page.evaluate(()=>window.__hpTest.settled());
   rows.push({label,visibleRadiusCss:t.radius,hitRadiusCss:t.hit,edge:t.edge,passed:true});console.log(JSON.stringify(rows.at(-1)));
  }
 }finally{await finish(browser);}
}
writeFileSync('artifacts/1259/native-hit.json',JSON.stringify(rows,null,2));
console.log(`PASS ${rows.length} native mouse scenarios`);
