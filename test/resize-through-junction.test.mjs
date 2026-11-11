import test from 'node:test';
import assert from 'node:assert/strict';
import {makeResizeJunctionFixture} from '../demo/fixtures/resize-junctions.mjs';
import {commitGraphEditResult,commitGraphEdit} from '../test-build/graph-edit-intent.js';
import {coalesceResizeRooms} from '../test-build/resize.js';
import {applyGraphOperation,graphIndex,validateGraph,migrateGraphSpace} from '../test-build/plan-graph.js';
import {graphWallRecordsPreserved} from '../test-build/wall-record-preservation.js';
import * as Q from '../test-build/plan-exact.js';

function move(space,from,to,axis=0){
 const draft=structuredClone(space),rooms=coalesceResizeRooms(space.rooms,1e-12);
 for(const room of draft.rooms)if(['left','right'].includes(room.id))
  room.poly=rooms.find(r=>r.id===room.id).poly.map(p=>p.map((v,i)=>i===axis&&v===from?to:v));
 const door=draft.openings?.find(o=>o.id==='moving-door');if(door)door[axis?'y':'x']=to;
 return commitGraphEditResult(space,draft,{kind:'resize',rooms:['left','right']});
}
function degree(space,x,y){
 const index=graphIndex(space.plan_graph),p=Q.readSourcePoint([x,y]);
 const nodes=space.plan_graph.nodes.filter(n=>Q.pointEq(index.points.get(n.id),p));
 assert.ok(nodes.length<2,'no duplicate identities at one real junction');
 return nodes.length?index.incident.get(nodes[0].id).length:0;
}
const contours=space=>coalesceResizeRooms(space.rooms,1e-12).map(r=>({id:r.id,poly:r.poly}));
function checkResult(before,result){
 assert.equal(validateGraph(result.graph,{hosts:result.space.openings||[]}).ok,true);
 assert.equal(graphWallRecordsPreserved(result.resizeWallRecords),true,'every source material has live descendants');
 const replay=applyGraphOperation(before.plan_graph,{kind:'batch',operations:result.operations},{hosts:before.openings||[]});
 assert.deepEqual(replay.graph,result.graph,'one replayable command describes the complete crossing');
 for(const opening of result.space.openings||[])
  assert.deepEqual(replay.mapping.hosts[opening.id],opening.host,'host mapping composes over the complete command');
}

for(const kind of ['cross','partition'])for(const direction of [-1,1])
test(`#1384 ${kind} passes a fixed junction in direction ${direction} and returns in one projection`,()=>{
 const initial=makeResizeJunctionFixture(kind).config.spaces[0];
 const start=.5+direction*.1,end=.5-direction*.1;
 const before=move(initial,.5,start).space,original=structuredClone(before);
 const result=move(before,start,end);checkResult(before,result);
 assert.equal(degree(result.space,end,.5),3);
 assert.equal(degree(result.space,.5,.5),3);
 assert.equal(degree(result.space,start,.5),0);
 assert.equal(result.graph.nodes.length,before.plan_graph.nodes.length);
 assert.deepEqual(result.space.partitions,before.partitions);
 assert.deepEqual(contours(result.space).filter(r=>!['left','right'].includes(r.id)),
  contours(before).filter(r=>!['left','right'].includes(r.id)));
 for(const old of before.openings){
  const current=result.space.openings.find(o=>o.id===old.id);
  assert.equal(current.x,old.id==='moving-door'?end:old.x);assert.equal(current.y,old.y);
  for(const key of ['length','type','contact','custom'])assert.deepEqual(current[key],old[key]);
 }
 const returned=move(result.space,end,start);checkResult(result.space,returned);
 assert.equal(degree(returned.space,end,.5),0);assert.equal(degree(returned.space,start,.5),3);
 assert.deepEqual(before,original,'no provisional X state mutates the input');
});

for(const transpose of [false,true])test(`#1384 crosses three successive junctions ${transpose?'horizontally':'vertically'} with one graph command`,()=>{
 const rect=(id,x0,y0,x1,y1)=>({id,name:id,poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]});
 const raw={id:'many-junctions',cell_cm:5,rooms:[rect('left',.1,.1,.8,.5),rect('right',.8,.1,.9,.5),
  rect('lower-a',.1,.5,.3,.9),rect('lower-b',.3,.5,.5,.9),
  rect('lower-c',.5,.5,.7,.9),rect('lower-d',.7,.5,.9,.9)]};
 if(transpose)for(const room of raw.rooms)room.poly.forEach(p=>p.reverse());
 let before=migrateGraphSpace(raw).space;
 before=commitGraphEdit(before,structuredClone(before),{kind:'thickness',rooms:before.rooms.map(r=>r.id),cm:24});
 const result=move(before,.8,.2,transpose?1:0);checkResult(before,result);
 for(const x of [.3,.5,.7])assert.equal(degree(result.space,...(transpose?[.5,x]:[x,.5])),3);
 const oldIndex=graphIndex(before.plan_graph),newIndex=graphIndex(result.graph);
 for(const dependency of before.plan_graph.dependencies){
  const point=Q.pointToNumbers(oldIndex.points.get(dependency.node));
  if(point[transpose?0:1]!==.5||![.3,.5,.7].includes(point[transpose?1:0]))continue;
  assert.ok(newIndex.nodes.has(dependency.node),'fixed source junction identity survives');
  assert.ok(Q.pointEq(newIndex.points.get(dependency.node),oldIndex.points.get(dependency.node)),'fixed junction stays put');
  assert.equal(result.graph.dependencies.find(d=>d.node===dependency.node)?.kind,dependency.kind,'the support constraint is preserved');
 }
 assert.equal(degree(result.space,...(transpose?[.5,.8]:[.8,.5])),0);
 assert.equal(degree(result.space,...(transpose?[.5,.2]:[.2,.5])),3);
 assert.deepEqual(contours(result.space).filter(r=>r.id.startsWith('lower')),contours(before).filter(r=>r.id.startsWith('lower')));
 const returned=move(result.space,.2,.8,transpose?1:0);checkResult(result.space,returned);
 assert.equal(degree(returned.space,...(transpose?[.5,.2]:[.2,.5])),0);
});

test('#1384 crossing is deterministic under source-table and selected-room permutation',()=>{
 const initial=makeResizeJunctionFixture('cross').config.spaces[0],before=move(initial,.5,.6).space;
 const expected=move(before,.6,.4),permuted=structuredClone(before);
 for(const table of ['nodes','edges','rooms','dependencies'])permuted.plan_graph[table].reverse();
 permuted.rooms.reverse();
 const draft=structuredClone(permuted),rooms=coalesceResizeRooms(permuted.rooms,1e-12);
 for(const room of draft.rooms)if(['left','right'].includes(room.id))
  room.poly=rooms.find(r=>r.id===room.id).poly.map(([x,y])=>[x===.6?.4:x,y]);
 draft.openings.find(o=>o.id==='moving-door').x=.4;
 const actual=commitGraphEditResult(permuted,draft,{kind:'resize',rooms:['right','left']});
 checkResult(permuted,actual);assert.deepEqual(actual.graph,expected.graph);
});
