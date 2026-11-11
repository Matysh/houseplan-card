import {launch,check,finish} from './serve.mjs';
import {prepareGoldenScenario} from './golden/harness.mjs';
import {resizeJunctionPointer,waitResizeJunctionSaved,settleResizeJunction} from './golden/resize-junctions.mjs';
import {validateOrdinaryRoomWrite} from './helpers/room-write-python.mjs';
import {validateGraph,graphIndex} from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
const{page,browser}=await launch({width:1180,height:1000});
const config=()=>page.evaluate(async()=>(await window.__goldenCard.hass.callWS({type:'houseplan/config/get'})).config);
const writes=()=>page.evaluate(()=>window.__resizeJunctionWrites?.length||0);
function degree(space,x,y){
 const index=graphIndex(space.plan_graph),p=Q.readSourcePoint([x,y]);
 const nodes=space.plan_graph.nodes.filter(n=>Q.pointEq(index.points.get(n.id),p));
 return nodes.length===1?index.incident.get(nodes[0].id).length:nodes.length===0?0:-1;
}
try{
 for(const kind of ['cross','partition']){
  const name=`resize-through-junction.${kind}`;
  await prepareGoldenScenario(page,{id:name,fixture:'visual',space:'resize-junctions',panelHost:true,
   resizeJunction:{kind,phase:'before'},mode:'plan',theme:'light',language:'ru',zoom:.65,zoomCenter:[500,500],
   viewport:{width:1180,height:1000},capture:'stage'});
  let previous=await config();
  await resizeJunctionPointer(page,.5,.6,true);
  const before=await config(),count=await writes();
  await resizeJunctionPointer(page,.6,.4,false);
  check(`${name}.heldNoWrite`,await writes(),count);
  check(`${name}.heldSavedUnchanged`,await config(),before);
  const paint=await page.evaluate(()=>{
   const c=window.__goldenCard,root=c.renderRoot;
   const paths=[...root.querySelectorAll('.wallbodies path.wallbody')].filter(path=>{
    for(let e=path;e&&e!==root;e=e.parentElement)if(+getComputedStyle(e).opacity===0)return false;return true;
   });
   const inside=(x,y)=>paths.some(p=>p.isPointInFill(new DOMPoint(x*1000,y*1000)));
   return{newWall:inside(.4,.18),oldGone:!inside(.6,.18),openingClear:!inside(.4,.3),
    noInternalT:!paths.some(p=>p.isPointInStroke(new DOMPoint(400,500))),
    noSafeStop:!c._toast?.includes('последней безопасной')};
  });
  for(const[key,value]of Object.entries(paint))check(`${name}.${key}`,value);
  await page.mouse.up();await waitResizeJunctionSaved(page,.4);
  const crossed=await config(),space=crossed.spaces[0];
  check(`${name}.oneWriteForWholeCrossing`,await writes(),count+1);
  check(`${name}.graphValid`,validateGraph(space.plan_graph,{hosts:space.openings}).ok);
  check(`${name}.newT`,degree(space,.4,.5),3);check(`${name}.stationaryT`,degree(space,.5,.5),3);
  check(`${name}.oldNodeGone`,degree(space,.6,.5),0);
  check(`${name}.partitionsFixed`,space.partitions,before.spaces[0].partitions);
  await page.locator('[data-action="geometry-undo"]').click();await waitResizeJunctionSaved(page,.6);
  check(`${name}.undoWholeGesture`,await config(),before);
  await page.locator('[data-action="geometry-redo"]').click();await waitResizeJunctionSaved(page,.4);
  check(`${name}.redoWholeGesture`,await config(),crossed);
  const countBeforeCancel=await writes();
  await resizeJunctionPointer(page,.4,.6,false);await page.keyboard.press('Escape');await page.mouse.up();await settleResizeJunction(page);
  check(`${name}.cancelNoWrite`,await writes(),countBeforeCancel);check(`${name}.cancelExact`,await config(),crossed);
  await resizeJunctionPointer(page,.4,.6,true);
  const returned=await config();check(`${name}.reverseLeavesNoNode`,degree(returned.spaces[0],.4,.5),0);
  await page.evaluate(()=>{
   const old=window.__goldenPanel,panel=document.createElement('houseplan-panel'),hass=old.hass;
   panel.narrow=false;panel.route={prefix:'/houseplan',path:''};panel.panel={component_name:'houseplan-panel'};
   old.replaceWith(panel);panel.hass=hass;window.__goldenPanel=panel;
  });
  await page.waitForFunction(()=>{
   const c=window.__goldenPanel.shadowRoot?.querySelector('houseplan-card');
   if(!c?._loadOk||c._booting)return false;window.__goldenCard=c;return true;
  });
  check(`${name}.reloadExact`,await page.evaluate(()=>window.__goldenCard._serverCfg),returned);
  const sequence=await page.evaluate(()=>window.__resizeJunctionWrites);
  for(const message of sequence)previous=validateOrdinaryRoomWrite(previous,message);
  check(`${name}.productionPythonAcceptsSequence`,previous.spaces[0].plan_graph,returned.spaces[0].plan_graph);
 }
}finally{await finish(browser);}
