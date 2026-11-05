import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { structuralWallNodes, structuralNodeWalls, prepareNodeMove, applyNodeMove } from '../test-build/wall-node-move.js';
import { applyNodeMerge, pickNodeMergeTarget } from '../test-build/wall-node-merge.js';
import { decodePoint, pointToNumbers } from '../test-build/plan-exact.js';
import { projectGraphSpace, validateGraph } from '../test-build/plan-graph.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { nodeDragRefusalKey } from '../test-build/wall-node-refusal.js';
import { increasedViolations, junctionLimitViolations } from '../test-build/junction-limits.js';

export const cases = JSON.parse(readFileSync(new URL('./fixtures/1305-node-merge.json', import.meta.url)));
export function config(c) { return commitWallSegmentModel({model_version:10,spaces:[{id:'f',title:'Floor',view_box:[0,0,1,1],cell_cm:5,
  rooms:[],partitions:c.walls,openings:c.openings||[],future:{keep:true}}],markers:[],settings:{}}).config; }
export function movePlan(space, p) { const nodes=structuralWallNodes(space),node=nodes.find(n=>n.point.every((v,i)=>Math.abs(v-p[i])<1e-9));
  assert.ok(node); return prepareNodeMove(space,node,nodes); }
const targetOf=(plan,p)=>plan.nodes.find(n=>n.point.every((v,i)=>Math.abs(v-p[i])<1e-9));

test('1305 target retains its genuine support when its other carrier contracts',()=>{
  const node=(id,x,y)=>({id,p:['l',String(x*240),String(y*240)]});
  const edge=(id,from,to)=>({id,kind:'partition',from,to,cm:10});
  const graph={version:1,nodes:[node('s',0,0),node('t',1,0),node('b',2,0),node('d',1,-1),node('e',1,1)],
    edges:[edge('st','s','t'),edge('tb','t','b'),edge('dt','d','t'),edge('te','t','e')],rooms:[],
    dependencies:[{node:'t',kind:'intersection',refs:[{from:'s',to:'b'},{from:'d',to:'e'}],parameters:[['1','2'],['1','2']]}]};
  const space=projectGraphSpace({id:'f',rooms:[],openings:[],cell_cm:5},graph).space,plan=movePlan(space,[0,0]);
  const result=applyNodeMerge(plan,'t',null);assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.space.plan_graph.dependencies,[{node:'t',kind:'on-edge',refs:[{from:'d',to:'e'}],parameters:[['1','2']]}]);
});

for(const c of cases)test('1305 '+c.name,()=>{
  const cfg=config(c),source=cfg.spaces[0],plan=movePlan(source,c.point),target=targetOf(plan,c.target);
  const frozen=structuredClone(source),result=applyNodeMerge(plan,target.nodeId,c.axis||null);
  assert.equal(result.ok,c.ok,JSON.stringify(result));assert.deepEqual(source,frozen);
  if(!result.ok){assert.equal(result.reason,c.reason);return;}
  assert.equal(validateGraph(result.space.plan_graph).ok,true);
  assert.equal(result.space.plan_graph.nodes.some(n=>n.id===plan.node.nodeId),false);
  assert.equal(result.space.plan_graph.edges.some(e=>e.from===plan.node.nodeId||e.to===plan.node.nodeId),false);
  assert.deepEqual(result.space.future,{keep:true});
  const after=commitWallSegmentModel({...cfg,spaces:[result.space]}).config;
  const optimized=optimizePlans(after,{});
  assert.equal(optimized.changed,false,'native merge must already be an Optimize fixed point');
  if(c.name==='adjacent contraction')assert.equal(result.space.plan_graph.edges.some(e=>e.id==='b'),false);
  if(c.name==='compact same material')assert.equal(result.space.plan_graph.edges.length,1);
  if(c.name==='last edge')assert.equal(result.space.plan_graph.nodes.length,0);
});

test('1305 capture requires deliberate drag and a closer target; axis filter keeps ordinary move',()=>{
  const source=config(cases[0]).spaces[0],plan=movePlan(source,[0,0]);
  const units=.1,down=[0,0];
  assert.equal(pickNodeMergeTarget(plan,[0,0],units,null,down),null,'click with neighbour in radius');
  assert.equal(pickNodeMergeTarget(plan,[.2,.1],units,null,down),null,'jitter');
  assert.equal(pickNodeMergeTarget(plan,[-.5,0],units,null,down),null,'moving away');
  assert.equal(pickNodeMergeTarget(plan,[.8,.8],units,null,down)?.nodeId,targetOf(plan,[1,1]).nodeId);
  const p=movePlan(config(cases[6]).spaces[0],[1,0]);
  assert.equal(pickNodeMergeTarget(p,[2,1],.02,'partition:a',[1,0]),null);
  assert.equal(applyNodeMove(p,[1.25,0],'partition:a').ok,true);
});

test('1305 exact q target is never decoded through its rounded screen point',()=>{
  let space=config(cases[0]).spaces[0],plan=movePlan(space,[0,0]);
  const target=targetOf(plan,[1,1]),graph=structuredClone(space.plan_graph);
  graph.nodes.find(n=>n.id===target.nodeId).p=['q','1','7','1','1'];
  space=projectGraphSpace(space,graph).space;plan=movePlan(space,[0,0]);
  const result=applyNodeMerge(plan,target.nodeId,null);assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.space.plan_graph.nodes.find(n=>n.id===target.nodeId).p,['q','1','7','1','1']);
});

test('1305 removed edge never silently deletes its opening',()=>{
  const c={...cases[1],walls:cases[1].walls.map(w=>({...w,cm:10})),openings:[{id:'door',type:'door',x:1.5,y:0,angle:0,length:.1,host:{kind:'partition',id:'b',t:.5}}]};
  const source=config(c).spaces[0],plan=movePlan(source,c.point);
  assert.deepEqual(applyNodeMerge(plan,targetOf(plan,c.target).nodeId,c.axis),{ok:false,reason:'merge_opening'});
});

test('1305 compaction rehosts the opening from the disappearing carrier without moving it',()=>{
  const c={...cases[2],walls:cases[2].walls.map(w=>({...w,cm:10})),openings:[
    {id:'door',type:'door',x:.75,y:0,angle:0,length:.1,host:{kind:'partition',id:'b',t:.5},flip_h:true}]};
  const source=config(c).spaces[0],plan=movePlan(source,c.point),before=structuredClone(source.openings[0]);
  const result=applyNodeMerge(plan,targetOf(plan,c.target).nodeId,null);assert.equal(result.ok,true,JSON.stringify(result));
  const opening=result.space.openings[0];assert.equal(opening.host.id,'a');
  assert.deepEqual([opening.x,opening.y,opening.length,opening.flip_h],[before.x,before.y,before.length,true]);
});

test('1305 stable server refusal codes retain useful human reasons',()=>{
  for(const reason of ['target','topology','dependency','opening'])assert.equal(nodeDragRefusalKey({code:'node_move_merge_'+reason},false,true),'node_move_merge_'+reason);
  for(const rule of ['angle','valence','length','distance','clearance','check_failed'])assert.equal(nodeDragRefusalKey({code:'junction_limit_'+rule},false,true),'node_merge_'+rule);
  assert.equal(nodeDragRefusalKey({code:'node_move_backend_unavailable'},false,true),'node_move_write_unavailable');
});

test('1305 surviving rays are checked for valence and acute angles after contraction',()=>{
  for(const [rule,walls,point,target] of [
    ['valence',[
      {id:'a',a:[0,-1],b:[-3,-2],cm:0},{id:'b',a:[0,-1],b:[-1,-3],cm:0},
      {id:'c',a:[0,-1],b:[1,-3],cm:0},{id:'d',a:[0,-1],b:[3,-2],cm:0},
      {id:'e',a:[0,0],b:[3,0],cm:0},{id:'f',a:[0,0],b:[0,3],cm:0},{id:'g',a:[0,0],b:[-3,0],cm:0},
    ],[0,-1],[0,0]],
    ['angle',[{id:'a',a:[0,1],b:[3,.1],cm:0},{id:'b',a:[0,0],b:[3,0],cm:0}],[0,1],[0,0]],
  ]){
    const before=config({walls}),plan=movePlan(before.spaces[0],point),result=applyNodeMerge(plan,targetOf(plan,target).nodeId,null);
    assert.equal(result.ok,true,JSON.stringify(result));
    const after={...before,spaces:[result.space]};
    const introduced=increasedViolations(junctionLimitViolations(after,'f',structuralNodeWalls(result.space)),
      junctionLimitViolations(before,'f',structuralNodeWalls(before.spaces[0])));
    assert.ok(introduced.some(v=>v.rule===rule),JSON.stringify(introduced));
  }
});

test('1305 T-to-carrier-end contraction retains far points and a valid room contraction keeps its room',()=>{
  const c={...cases[1],walls:[...cases[1].walls,{id:'branch',a:[1,0],b:[1,-1],cm:0}]};
  const before=config(c),plan=movePlan(before.spaces[0],c.point),target=targetOf(plan,c.target);
  const result=applyNodeMerge(plan,target.nodeId,c.axis);assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.space.plan_graph.edges.some(e=>e.id==='b'),false);
  for(const n of before.spaces[0].plan_graph.nodes.filter(n=>n.id!==plan.node.nodeId))
    assert.deepEqual(result.space.plan_graph.nodes.find(q=>q.id===n.id),n);
  const cfg=commitWallSegmentModel({spaces:[{id:'f',view_box:[0,0,1,1],cell_cm:5,rooms:[{id:'r',poly:[[0,0],[1,0],[1,1],[.5,1],[0,1]]}]}],markers:[],settings:{}}).config;
  const p=movePlan(cfg.spaces[0],[.5,1]),t=targetOf(p,[0,1]);
  const merged=applyNodeMerge(p,t.nodeId,p.node.axes.find(a=>a.passing).key);assert.equal(merged.ok,true,JSON.stringify(merged));
  assert.equal(merged.space.rooms.length,1);assert.equal(merged.space.rooms[0].id,'r');assert.equal(merged.space.rooms[0].poly.length,4);
});
