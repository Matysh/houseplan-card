import test from 'node:test';
import assert from 'node:assert/strict';
import {makeResizeJunctionFixture} from '../demo/fixtures/resize-junctions.mjs';
import {commitGraphEditResult,commitGraphEdit} from '../test-build/graph-edit-intent.js';
import {coalesceResizeRooms,resolveSafeResize,validateSafeResize} from '../test-build/resize.js';
import {ResizeController} from '../test-build/resize-controller.js';
import {applyGraphOperation,graphIndex,validateGraph,migrateGraphSpace,projectGraphSpace} from '../test-build/plan-graph.js';
import {graphWallRecordsPreserved} from '../test-build/wall-record-preservation.js';
import * as Q from '../test-build/plan-exact.js';

function move(space,from,to,axis=0,roomIds=['left','right']){
 const draft=structuredClone(space),rooms=coalesceResizeRooms(space.rooms,1e-12);
 for(const room of draft.rooms)if(['left','right'].includes(room.id))
  room.poly=rooms.find(r=>r.id===room.id).poly.map(p=>p.map((v,i)=>i===axis&&v===from?to:v));
 const door=draft.openings?.find(o=>o.id==='moving-door');if(door)door[axis?'y':'x']=to;
 return commitGraphEditResult(space,draft,{kind:'resize',rooms:roomIds});
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
  for(const key of ['length','type','angle','contact','custom'])assert.deepEqual(current[key],old[key]);
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
 const permuted=structuredClone(before);
 for(const table of ['nodes','edges','rooms','dependencies'])permuted.plan_graph[table].reverse();
 permuted.rooms.reverse();
 assert.deepEqual(move(permuted,.8,.2,transpose?1:0,['right','left']).graph,result.graph,'multiple support rebases are deterministic');
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

function controllerFor(before,obstacles=[]){
 const controller=new ResizeController(),rooms=coalesceResizeRooms(before.rooms,1e-12)
  .map(room=>({...room,poly:room.poly.map(p=>p.map(v=>v*1000))}));
 const openings=before.openings.map(o=>({...o,x:o.x*1000,y:o.y*1000,length:o.length*1000,hosted:false}));
 const options={minDim:25,eps:1e-7,movingHalf:10,obstacles};
 const edge=rooms.find(r=>r.id==='left').poly.findIndex((p,i,poly)=>p[0]===600&&poly[(i+1)%poly.length][0]===600);
 const resolution=resolveSafeResize(rooms,openings,'left',edge,options);
 assert.equal(resolution.enabled,true);
 assert.equal(controller.begin({pointerId:7,start:[600,300],roomId:'left',plan:resolution.plan,options,rooms,openings,
  snapshotIdentity:'source',before,wallUnionBefore:null,epochBefore:1}),true);
 let projected,published=0;
 return{controller,rooms,openings,options,plan:resolution.plan,get projected(){return projected;},get published(){return published;},
  toward:x=>controller.move({pointerId:7,point:[x*1000,300],step:1000/240,snap:p=>p,
   project:(_snapshot,polys)=>{
    const target=polys.left[resolution.plan.edgeByRoom.left][0]/1000;
    projected=move(before,.6,target);
    return{ok:true,value:{preview:projected.space,beforeWalls:before.walls,afterWalls:projected.space.walls,
     artifact:null,graphWallRecords:projected.resizeWallRecords}};
   },publish:()=>{published++;},measure:()=>[]})};
}

test('#1384 a crossing with a lost source material is rejected before publishing or committing',()=>{
 let before=move(makeResizeJunctionFixture('partition').config.spaces[0],.5,.6).space;
 const slice=before.wall_segments.find(edge=>edge.a[1]===.5&&edge.b[1]===.5
  &&Math.min(edge.a[0],edge.b[0])===.5&&Math.max(edge.a[0],edge.b[0])===.6);
 before=commitGraphEdit(before,structuredClone(before),{kind:'thickness',edges:[{kind:'wall',id:slice.id}],cm:30});
 const frozen=structuredClone(before),h=controllerFor(before);
 assert.deepEqual(h.toward(.4),{kind:'rejected',notify:true});
 assert.equal(h.projected.space.openings.find(o=>o.id==='moving-door').x,.4,'the multi-stage bridge really crossed the junction');
 assert.equal(validateGraph(h.projected.graph).ok,true,'a valid graph alone is not permission to lose material');
 assert.equal(graphWallRecordsPreserved(h.projected.resizeWallRecords),false);
 assert.equal(h.published,0);assert.equal(h.controller.preview,null);
 assert.deepEqual(h.controller.finish({pointerId:7,currentSnapshotIdentity:'source',validatePreview:()=>assert.fail('nothing may commit')}),{kind:'no-op'});
 assert.deepEqual(before,frozen,'a rejected multi-stage candidate leaves the source intact');
});

test('#1384 the controller crosses a junction but cannot jump a real column behind it',()=>{
 const before=move(makeResizeJunctionFixture('cross',true).config.spaces[0],.5,.6).space,frozen=structuredClone(before);
 const radius=40/(2*5)*(1000/240),h=controllerFor(before,[{kind:'circle',center:[440,300],radius}]);
 assert.equal(validateSafeResize(h.rooms,h.openings,h.plan,-200,h.options),true,'the far endpoint alone would miss the swept column');
 assert.equal(h.toward(.4).kind,'accepted');
 const x=h.projected.space.openings.find(o=>o.id==='moving-door').x;
 assert.ok(x<.5,'the new staged path passed the fixed junction');
 assert.ok((x-.44)*1000>=radius+10-1e-6,'the wall remains on the near side with its full thickness clear');
 assert.equal(h.published,1);checkResult(before,h.projected);
 const finished=h.controller.finish({pointerId:7,currentSnapshotIdentity:'source',validatePreview:()=>true});
 assert.equal(finished.kind,'commit');assert.deepEqual(finished.preview,h.projected.space,'only the visible safe preview can commit');
 assert.deepEqual(before,frozen);
});

test('#1384 crossing preserves a non-lattice rational junction exactly',()=>{
 let before=move(makeResizeJunctionFixture('cross').config.spaces[0],.5,.6).space;
 const index=graphIndex(before.plan_graph),x=Q.exact(3n,7n);
 const operations=before.plan_graph.nodes.filter(n=>Q.eq(index.points.get(n.id)[0],Q.parseDecimal(.5))).map(n=>({
  kind:'move-node',node:n.id,target:Q.encodePoint([x,index.points.get(n.id)[1]]),detachDependency:true}));
 before=projectGraphSpace(before,applyGraphOperation(before.plan_graph,{kind:'batch',operations}).graph).space;
 const frozen=structuredClone(before),result=move(before,.6,.4);checkResult(before,result);
 const after=graphIndex(result.graph);
 for(const op of operations){
  assert.ok(after.nodes.has(op.node));assert.ok(Q.eq(after.points.get(op.node)[0],x),'the stationary intersection remains exactly 3/7');
 }
 assert.equal(degree(result.space,.6,.5),0);assert.equal(degree(result.space,.4,.5),3);
 assert.deepEqual(before,frozen);
});
