/** #1167/#1216: native first-use graph journey, real HA is the only writer. */
import {expect} from '@playwright/test';
import {HP,hp} from './hooks.mjs';
import {planConfig,spaceOf,waitForConfig,wsCall} from './ha-ws.mjs';
import {centreOf,clickFloor,dragClient,enterEditor,field,leaveEditor,settle,stage,gridStep,toClient,useTool} from './plan.mjs';
import {visiblePlanSegment} from './visible-plan-target.mjs';
import {card,evidence,stageOf} from './ha-page.mjs';

const graphOf=(config,id)=>spaceOf(config,id).plan_graph;
const wire=p=>['l',String(Math.round(p.x*240/1000)),String(Math.round(p.y*240/1000))];

export async function exactGraphFirstSpace(page,host,testInfo,initial=undefined){
 initial??=await planConfig();const id=initial.config.spaces[0].id;
 expect(initial.plan_graph_api).toBe(1);expect(initial.graph_change_api).toBe(2);
 expect(initial.config.model_version).toBe(11);
 if(!await host.locator(HP.mode('plan')).isVisible())await enterEditor(host,'plan');
 await useTool(host,'draw');
 const depth=field(host,'wall-thickness');await depth.fill('15');await depth.press('Enter');
 const targets=await stage(host).evaluate(visiblePlanSegment,{step:await gridStep(host),pattern:[
  [[0,0],[2,0]],[[2,0],[2,2]],[[1,-1],[1,1]],[[0,0],[-1,0]],
 ]});
 const [{a,b},{b:c},{a:x1,b:x2},{b:target}]=targets.segments;
 await testInfo.attach('exact-first-space-visible-targets.json',{body:JSON.stringify(targets,null,2),contentType:'application/json'});
 for(const p of [a,b,c])await clickFloor(page,host,p.x,p.y);
 await page.keyboard.press('Escape');
 await waitForConfig(config=>graphOf(config,id)?.edges.length===2,{message:'native L is durable exact graph'});

 // A second finite carrier crosses the first; its four incident children must
 // meet at one stored node, with both physical thicknesses retained.
 await useTool(host,'draw');await depth.fill('25');await depth.press('Enter');
 for(const p of [x1,x2])await clickFloor(page,host,p.x,p.y);
 await page.keyboard.press('Escape');
 const before=await waitForConfig(config=>graphOf(config,id)?.edges.length>=5,{message:'native unequal-depth X is noded on the server'});
 const graph=graphOf(before,id),degree=new Map();
 for(const edge of graph.edges)for(const node of [edge.from,edge.to])degree.set(node,(degree.get(node)||0)+1);
 expect([...degree.values()]).toContain(4);
 expect(new Set(graph.edges.map(e=>e.cm))).toEqual(new Set([15,25]));
 expect(new Set(graph.edges.map(e=>e.kind+':'+e.id)).size).toBe(graph.edges.length);
 await useTool(host,'select');await settle(host);
 const sourceNode=graph.nodes.find(n=>JSON.stringify(n.p)===JSON.stringify(wire(a)));
 expect(sourceNode).toBeTruthy();
 const handle=host.locator(hp('wall-node',{node:sourceNode.id})).first();
 await expect(handle).toBeVisible();
 await dragClient(page,await centreOf(handle),await toClient(host,target.x,target.y));
 const moved=await waitForConfig(config=>{
  const node=graphOf(config,id)?.nodes.find(n=>n.id===sourceNode.id);
  return JSON.stringify(node?.p)===JSON.stringify(wire(target));
 },{message:'native node move ACK keeps original exact node identity'});
 const movedGraph=graphOf(moved,id);
 expect(movedGraph.edges.map(e=>e.kind+':'+e.id)).toEqual(graph.edges.map(e=>e.kind+':'+e.id));
 await evidence(testInfo,page,'exact-first-space-moved');
 for(const [action,expected]of [['geometry-undo',graph],['geometry-redo',movedGraph]]){
  const button=host.locator(HP.action(action)).first();await expect(button).toBeEnabled();await button.click();
  await expect.poll(async()=>graphOf((await planConfig()).config,id),{message:action+' restores exact accepted graph'}).toEqual(expected);
 }
 const portable=await wsCall({type:'houseplan/export/create',kind:'full'});
 expect(graphOf(portable.document.payload.config,id)).toEqual(movedGraph);
 await leaveEditor(host);await settle(host);
 const accepted=await planConfig();await page.reload();
 const fresh=card(page);await expect(stageOf(fresh)).toBeVisible({timeout:60000});
 await expect(fresh.locator(hp('wall')).first()).toBeVisible();await settle(fresh);
 const reloaded=await planConfig();
 expect(reloaded.config.model_version).toBe(11);expect(graphOf(reloaded.config,id)).toEqual(movedGraph);
 expect(reloaded.rev).toBe(accepted.rev);
 await evidence(testInfo,page,'exact-first-space-reloaded');
}
