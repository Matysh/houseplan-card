import { launch, check, finish } from './serve.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { resizeJunctionPointer, resizeJunctionPaintProbe, settleResizeJunction, waitResizeJunctionSaved } from './golden/resize-junctions.mjs';
import { graphIndex, validateGraph } from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
import { validateOrdinaryRoomWrite } from './helpers/room-write-python.mjs';

const { page, browser }=await launch({width:1180,height:1000});
const saved=()=>page.evaluate(async()=>{
  const r=await window.__goldenCard.hass.callWS({type:'houseplan/config/get'});
  return r.config.spaces[0];
});
const degree=(s,x,y)=>{
  const index=graphIndex(s.plan_graph);
  const nodes=s.plan_graph.nodes.filter(n=>Q.pointEq(index.points.get(n.id),Q.readSourcePoint([x,y])));
  return nodes.length===1?(index.incident.get(nodes[0].id)||[]).length:nodes.length===0?0:-1;
};
try{
  for(const kind of ['tee','cross','partition']){
    await prepareGoldenScenario(page,{id:`resize-junction-${kind}`,fixture:'visual',space:'resize-junctions',panelHost:true,
      resizeJunction:{kind,phase:'before'},mode:'plan',theme:'light',language:'ru',zoom:.65,zoomCenter:[500,500],
      viewport:{width:1180,height:1000},capture:'stage'});
    const before=await saved();
    let previous=await page.evaluate(async()=> (await window.__goldenCard.hass.callWS({type:'houseplan/config/get'})).config);
    const writeStart=await page.evaluate(()=>window.__resizeJunctionWrites?.length||0);
    await resizeJunctionPointer(page,.5,.6,false);
    const paint=await resizeJunctionPaintProbe(page);
    for(const [name,value]of Object.entries(paint))check(`resize-junction.${kind}.${name}`,value);
    check(`resize-junction.${kind}.previewDoesNotWrite`,await saved(),before);
    await page.mouse.up();await waitResizeJunctionSaved(page,.6);
    const moved=await saved();
    check(`resize-junction.${kind}.saved`,moved.openings.find(o=>o.id==='moving-door').x,.6);
    check(`resize-junction.${kind}.graphValid`,validateGraph(moved.plan_graph,{hosts:moved.openings.map(o=>o.host)}).ok);
    check(`resize-junction.${kind}.newT`,degree(moved,.6,.5),3);
    check(`resize-junction.${kind}.oldJunction`,degree(moved,.5,.5),kind==='tee'?0:3);
    check(`resize-junction.${kind}.meaningfulNodeCount`,moved.plan_graph.nodes.length,
      before.plan_graph.nodes.length+(kind==='tee'?0:1));
    check(`resize-junction.${kind}.partitionsUnchanged`,moved.partitions,before.partitions);
    await resizeJunctionPointer(page,.6,.5,true);
    const returned=await saved();
    check(`resize-junction.${kind}.secondGestureReturns`,returned.openings.find(o=>o.id==='moving-door').x,.5);
    check(`resize-junction.${kind}.returnedJunction`,degree(returned,.5,.5),kind==='tee'?3:4);
    check(`resize-junction.${kind}.noAbandonedNode`,degree(returned,.6,.5),0);
    check(`resize-junction.${kind}.returnedNodeCount`,returned.plan_graph.nodes.length,before.plan_graph.nodes.length);
    await resizeJunctionPointer(page,.5,.6,false);
    await page.keyboard.press('Escape');await page.mouse.up();await settleResizeJunction(page);
    check(`resize-junction.${kind}.cancelIsExact`,await saved(),returned);
    await resizeJunctionPointer(page,.5,.6,true);
    const committed=await saved();
    await page.locator('[data-action="geometry-undo"]').click();await waitResizeJunctionSaved(page,.5);
    check(`resize-junction.${kind}.undoExact`,await saved(),returned);
    await page.locator('[data-action="geometry-redo"]').click();await waitResizeJunctionSaved(page,.6);
    check(`resize-junction.${kind}.redoExact`,await saved(),committed);
    // Remount the actual panel with the same backend, so config/get must read
    // the acknowledged document rather than a retained preview or history.
    await page.evaluate(()=>{
      const old=window.__goldenPanel,panel=document.createElement('houseplan-panel');
      panel.narrow=false;panel.route={prefix:'/houseplan',path:''};panel.panel={component_name:'houseplan-panel'};
      const hass=old.hass;old.replaceWith(panel);panel.hass=hass;window.__goldenPanel=panel;
    });
    await page.waitForFunction(()=>{
      const c=window.__goldenPanel.shadowRoot?.querySelector('houseplan-card');
      if(!c?._loadOk||c._booting)return false;window.__goldenCard=c;return true;
    });
    check(`resize-junction.${kind}.reloadExact`,await page.evaluate(()=>window.__goldenCard._serverCfg.spaces[0]),committed);
    // Validate the actual native wire through production Python graph/config,
    // host and junction checks. This CPU-only boundary is not a real HA lab.
    const writes=await page.evaluate(start=>window.__resizeJunctionWrites.slice(start),writeStart);
    check(`resize-junction.${kind}.nativeWritesObserved`,writes.length>0);
    for(const message of writes)previous=validateOrdinaryRoomWrite(previous,message);
    check(`resize-junction.${kind}.pythonAcceptsNativeSequence`,previous.spaces[0].plan_graph,committed.plan_graph);
  }
}finally{await finish(browser);}
