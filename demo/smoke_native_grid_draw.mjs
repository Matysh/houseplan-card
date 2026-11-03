/** #1237: native grid clicks over an observed transport, exact wire/history/reload. */
import assert from 'node:assert/strict';
import { launch, checkAll, finish } from './serve.mjs';
import { projectGraphSpace, verifyGraphProjection } from '../test-build/plan-graph.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const empty = projectGraphSpace({ id:'grid',title:'Grid',cell_cm:5,view_box:[0,0,1,1],rooms:[] },
  {version:1,nodes:[],edges:[],rooms:[],dependencies:[]}).space;
let server={model_version:11,spaces:[empty],markers:[],
  settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}},rev=1;
const writes=[],out={};
const {page,browser}=await launch({width:1280,height:900});
page.setDefaultTimeout(12000);
try{
  await page.exposeFunction('nativeGridWire',message=>{
    if(message.type==='houseplan/config/get')return {config:structuredClone(server),rev,can_write:true,plan_graph_api:1,graph_change_api:2};
    if(message.type==='houseplan/layout/get')return {layout:{},rev:1};
    if(message.type==='houseplan/config/set'){
      assert.equal(message.expected_rev,rev);
      for(const sp of message.config.spaces)verifyGraphProjection(sp,sp.plan_graph);
      writes.push(structuredClone(message));server=structuredClone(message.config);
      return {ok:true,rev:++rev,config:structuredClone(server)};
    }
    return null;
  });
  await page.evaluate(()=>{
    const old=window.__card,hass=window.__mkHass(),base=hass.callWS.bind(hass);
    hass.devices={};hass.entities={};hass.states={};
    hass.callWS=async message=>message.type.endsWith('registry/list')?[]:
      (await window.nativeGridWire(message))??base(message);
    const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'en'});
    old.remove();document.getElementById('host').appendChild(card);window.__card=card;card.hass=hass;
  });
  await page.waitForFunction(()=>window.__card?._booting===false&&window.__card._space==='grid');
  await page.evaluate(()=>window.__hpTest.setMode('plan'));
  await page.evaluate(()=>window.__hpTest.setTool('draw'));
  const host=page.locator('houseplan-card');
  const click=async(ix,iy)=>{
    const point=await host.evaluate((card,[ix,iy])=>{
      const svg=card.renderRoot.querySelector('svg.plan-svg'),p=svg.createSVGPoint();
      p.x=ix*1000/240;p.y=iy*1000/240;
      const q=p.matrixTransform(svg.getScreenCTM()),bounds=card.renderRoot.querySelector('.stage').getBoundingClientRect();
      const hit=card.renderRoot.elementFromPoint(q.x,q.y);
      return {x:q.x,y:q.y,clear:!!hit?.closest('.stage')&&!hit.closest('button,input,.drawwall,.hp-properties'),
        inside:q.x>bounds.left&&q.x<bounds.right&&q.y>bounds.top&&q.y<bounds.bottom};
    },[ix,iy]);
    assert.ok(point.clear&&point.inside&&point.x<1280&&point.y<900,JSON.stringify(point));
    await page.mouse.click(point.x,point.y);
    await page.evaluate(()=>window.__hpTest.settled());
    await page.evaluate(()=>window.__hpTest.waitForWrites());
  };
  await click(54,95);await click(102,95);await click(102,144);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__hpTest.waitForWrites());
  const saved=structuredClone(server),graph=saved.spaces[0].plan_graph;
  const wires=graph.nodes.map(n=>JSON.stringify(n.p));
  out.exactGridWire=['["l","54","95"]','["l","102","95"]','["l","102","144"]'].every(p=>wires.includes(p));
  out.nativeLShapeSaved=graph.edges.length===2&&graph.nodes.length===3;
  out.everyWireUsesLattice=writes.every(m=>m.config.spaces[0].plan_graph.nodes.every(n=>n.p[0]==='l'));
  await host.locator('[data-hp="geometry-undo"]').click();
  await page.evaluate(()=>window.__hpTest.waitForWrites());
  out.undoOneSegment=server.spaces[0].plan_graph.edges.length===1;
  await host.locator('[data-hp="geometry-redo"]').click();
  await page.evaluate(()=>window.__hpTest.waitForWrites());
  out.redoExactIdsAndPoints=JSON.stringify(server.spaces[0].plan_graph)===JSON.stringify(graph);
  await page.evaluate(async()=>{await window.__card._reloadConfigOnly(true);await window.__hpTest.settled();});
  out.reloadExact=await page.evaluate(expected=>JSON.stringify(window.__card._serverCfg.spaces[0].plan_graph)===JSON.stringify(expected),graph);
  out.serializedPreparationExact=JSON.stringify(commitWallSegmentModel(JSON.parse(JSON.stringify(server))).config.spaces[0].plan_graph)===JSON.stringify(graph);
  checkAll(out);
}finally{await finish(browser,out);}
