import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
import {commitGraphEdit,commitGraphEditResult} from '../test-build/graph-edit-intent.js';
const copy=structuredClone;
const rectangle=(id,x0=0,x1=1)=>({id,name:id,poly:[[x0,0],[x1,0],[x1,1],[x0,1]],custom:{keep:id}});
const migrate=space=>G.migrateGraphSpace(space).space;
const base=()=>migrate({id:'floor',rooms:[rectangle('a')],extra:{keep:1}});
test('metadata intent preserves exact graph and opaque room/space properties',()=>{
  const before=base(),draft=copy(before);draft.title='New';draft.rooms[0].name='Renamed';
  draft.rooms[0].poly[0][0]=0.1;
  const result=commitGraphEdit(before,draft,{kind:'metadata'});
  assert.deepEqual(result.plan_graph,before.plan_graph);
  assert.deepEqual(result.rooms[0].poly,before.rooms[0].poly);
  assert.equal(result.rooms[0].name,'Renamed');assert.deepEqual(result.extra,before.extra);
  assert.deepEqual(before,base());
});
test('thickness names edges and changes only their cm',()=>{
  const before=base(),draft=copy(before);draft.rooms[0].poly[0][0]=0.25;
  const chosen=before.plan_graph.edges[0],result=commitGraphEdit(before,draft,{kind:'thickness',edges:[chosen],cm:25});
  assert.equal(result.plan_graph.edges.find(e=>e.id===chosen.id).cm,25);
  assert.deepEqual(result.plan_graph.nodes,before.plan_graph.nodes);
});
test('fixed-topology Resize retains original IDs and exact UI lattice targets',()=>{
  const before=base(),draft=copy(before);
  draft.rooms[0].poly[1][0]=1/3;draft.rooms[0].poly[2][0]=1/3;
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a']});
  assert.deepEqual(result.plan_graph.nodes.map(n=>n.id),before.plan_graph.nodes.map(n=>n.id));
  assert.ok(result.plan_graph.nodes.filter(n=>n.p[1]==='80').length===2);
  assert.equal(G.validateGraph(result.plan_graph).ok,true);
});
test('selected ownership detaches shared corners and keeps the neighbour exact',()=>{
  const before=migrate({id:'s',rooms:[rectangle('a',0,1),rectangle('b',1,2)]}),draft=copy(before);
  draft.rooms.find(r=>r.id==='a').poly=draft.rooms.find(r=>r.id==='a').poly.map(p=>p[0]===1?[0.9,p[1]]:p);
  const neighbour=copy(before.rooms.find(r=>r.id==='b'));
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a']});
  assert.deepEqual(result.rooms.find(r=>r.id==='b'),neighbour);
  assert.equal(G.validateGraph(result.plan_graph).ok,true);
  const ids=before.plan_graph.rooms.find(r=>r.room==='b').edges.map(G.edgeKey);
  assert.deepEqual(result.plan_graph.rooms.find(r=>r.room==='b').edges.map(G.edgeKey),ids);
});
test('both selected room owners keep shared edge IDs when they target the same line',()=>{
  const before=migrate({id:'s',rooms:[rectangle('a',0,1),rectangle('b',1,2)]}),draft=copy(before);
  for(const room of draft.rooms)room.poly=room.poly.map(p=>p[0]===1?[1.1,p[1]]:p);
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a','b']});
  assert.deepEqual(result.plan_graph.edges.map(G.edgeKey),before.plan_graph.edges.map(G.edgeKey));
  assert.deepEqual(result.plan_graph.nodes.map(n=>n.id),before.plan_graph.nodes.map(n=>n.id));
});
test('Resize expands real-corner draft through exact stored atom ownership and dependencies',()=>{
  let before=base();const cycle=before.plan_graph.rooms[0],ref=cycle.edges[0];
  const split=G.applyGraphOperation(before.plan_graph,{kind:'insert-on-edge',edge:ref,t:['1','2'],node:'middle',newEdgeId:'child'});
  before=G.projectGraphSpace(before,split.graph).space;
  const draft=copy(before);draft.rooms[0].poly=[[0,.1],[1,.1],[1,1],[0,1]];
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a']});
  const middle=result.plan_graph.nodes.find(n=>n.id==='middle');
  assert.deepEqual(middle.p,['l','120','24']);
  assert.ok(result.plan_graph.dependencies.some(d=>d.node==='middle'));
});
test('partition endpoint edit detaches only its own edge from a shared junction',()=>{
  const before=migrate({id:'p',rooms:[],partitions:[
    {id:'h',a:[0,0],b:[1,0],cm:10},{id:'v',a:[0,0],b:[0,1],cm:10}]}),draft=copy(before);
  draft.partitions.find(p=>p.id==='v').a=[1/240,0];
  const host=copy(before.partitions.find(p=>p.id==='h'));
  const result=commitGraphEdit(before,draft,{kind:'partitions',ids:['v']});
  assert.deepEqual(result.partitions.find(p=>p.id==='h'),host);
  assert.deepEqual(result.partitions.find(p=>p.id==='v').a,[1/240,0]);
});
test('explicit opening edit cannot leave stale q overriding the new scalar t',()=>{
  const before=migrate({id:'o',rooms:[],partitions:[{id:'p',a:[0,0],b:[1,0],cm:10}],
    openings:[{id:'o',type:'door',x:.25,y:0,length:.1,angle:0,host:{kind:'partition',id:'p',t:.25}}]});
  const draft=copy(before);draft.openings[0].host.t=.75;draft.openings[0].x=.75;
  const metadata=commitGraphEdit(before,draft,{kind:'metadata'});
  assert.deepEqual(metadata.openings[0].host,before.openings[0].host);
  const edited=commitGraphEdit(before,draft,{kind:'openings',ids:['o']});
  assert.deepEqual(edited.openings[0].host.tq,['3','4']);assert.equal(edited.openings[0].x,.75);
});
test('new independent face is an explicit graph construction, not current migration',()=>{
  const before=migrate({id:'new',rooms:[]}),draft=copy(before);draft.rooms=[rectangle('new-room')];
  const result=commitGraphEditResult(before,draft,{kind:'faces',rooms:['new-room']});
  assert.equal(result.graph.rooms.length,1);assert.equal(result.graph.edges.length,4);
  assert.equal(G.validateGraph(result.graph).ok,true);
  assert.ok(result.operations.some(op=>op.kind==='replace-room-cycle'));
});
test('named partition arrangement promotes the selected face and remaps its hosted opening',()=>{
  const before=migrate({id:'n',rooms:[],partitions:[
    {id:'a',a:[0,0],b:[1,0],cm:15,custom:'safe'},{id:'b',a:[1,0],b:[1,1],cm:15},
    {id:'c',a:[1,1],b:[0,1],cm:15},{id:'d',a:[0,1],b:[0,0],cm:15}],
    openings:[{id:'o',type:'door',x:.5,y:0,length:.1,angle:0,host:{kind:'partition',id:'a',t:.5}}]});
  const draft=copy(before);draft.rooms=[rectangle('r')];
  const result=commitGraphEdit(before,draft,{kind:'faces',rooms:['r'],consumedPartitionIds:['a','b','c','d'],sourceEdges:before.plan_graph.edges});
  assert.equal(result.plan_graph.edges.filter(e=>e.kind==='wall').length,4);
  assert.equal(result.plan_graph.edges.find(e=>e.id==='a').props.custom,'safe');
  assert.equal(result.openings[0].host.kind,'wall');assert.deepEqual(result.openings[0].host.tq,['1','2']);
});
test('delete room keeps physical walls as partitions when explicitly requested',()=>{
  const before=base(),result=commitGraphEdit(before,{...copy(before),rooms:[]},{kind:'delete-room',room:'a',keepWalls:true});
  // The synthetic default room has zero contours, so no real walls survive.
  assert.equal(result.plan_graph.rooms.length,0);assert.equal(result.plan_graph.edges.length,0);
  const thick=commitGraphEdit(before,before,{kind:'thickness',rooms:['a'],cm:15});
  const kept=commitGraphEdit(thick,{...copy(thick),rooms:[]},{kind:'delete-room',room:'a',keepWalls:true});
  assert.equal(kept.plan_graph.rooms.length,0);assert.equal(kept.partitions.length,4);
});
test('Merge rooms removes the shared divider using the named existing boundary',()=>{
  const before=migrate({id:'s',rooms:[rectangle('a',0,1),rectangle('b',1,2)]}),draft=copy(before);
  draft.rooms=[rectangle('a',0,2)];
  const result=commitGraphEdit(before,draft,{kind:'merge-rooms',keep:'a',drop:'b',sourceEdges:before.plan_graph.edges});
  assert.equal(result.rooms.length,1);assert.equal(result.rooms[0].id,'a');
  assert.equal(result.plan_graph.edges.length,6);
  assert.equal(G.validateGraph(result.plan_graph).ok,true);
});

test('first legacy partition edit uses the explicit migration map including reversal and split children',()=>{
  const raw={id:'legacy',rooms:[],partitions:[{id:'p',a:[1,0],b:[0,0],cm:10},{id:'t',a:[.5,0],b:[.5,1],cm:10}]};
  const migrated=G.migrateGraphSpace(raw),source={...copy(raw),graphMapping:migrated.mapping};
  const result=commitGraphEdit(migrated.space,copy(raw),{kind:'partitions',ids:['p']},source);
  assert.deepEqual(result.plan_graph,migrated.graph);
  assert.equal(result.partitions.length,3);
});
test('named derived face vertex uses the exact intersection rather than its nine-decimal carrier',()=>{
  const before=migrate({id:'exact',rooms:[],partitions:[
    {id:'diag',a:[0,0],b:[1,1],cm:15},{id:'vertical',a:[1/3,0],b:[1/3,1],cm:15}]});
  const draft=copy(before);draft.rooms=[{id:'triangle',poly:[[0,0],[1,0],[.333333333,.333333333]]}];
  const result=commitGraphEdit(before,draft,{kind:'faces',rooms:['triangle'],consumedPartitionIds:['diag','vertical'],sourceEdges:before.plan_graph.edges});
  const coords=result.plan_graph.nodes.map(n=>n.p);
  assert.ok(coords.some(p=>JSON.stringify(p)===JSON.stringify(['l','80','80'])));
  assert.equal(G.validateGraph(result.plan_graph).ok,true);
});
test('Resize rehosts affected opening using solver xy and preserves exact q for an unchanged world centre',()=>{
  let before=base();before=commitGraphEdit(before,before,{kind:'thickness',rooms:['a'],cm:15});
  const bottom=before.wall_segments.find(e=>e.a[1]===0&&e.b[1]===0);
  before.openings=[{id:'o',type:'door',x:.5,y:0,length:.1,angle:0,host:{kind:'wall',id:bottom.id,t:.5,tq:['1','2']}}];
  const draft=copy(before);draft.rooms[0].poly=[[0,.1],[1,.1],[1,1],[0,1]];draft.openings[0].y=.1;
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a']});
  assert.equal(result.openings[0].y,.1);assert.deepEqual(result.openings[0].host.tq,['1','2']);
});

test('named segments supports an unowned contour wall namespace independently of partitions',()=>{
  const before=migrate({id:'segment',rooms:[],wall_segments:[{id:'same',a:[0,0],b:[1,0],cm:10}],
    partitions:[{id:'same',a:[0,1],b:[1,1],cm:10}]}),draft=copy(before);
  draft.wall_segments[0].a[0]+=.1;draft.wall_segments[0].b[0]+=.1;
  const result=commitGraphEdit(before,draft,{kind:'segments',edges:[{kind:'wall',id:'same'}]});
  assert.equal(result.wall_segments[0].a[0],.1);
  assert.deepEqual(result.partitions,before.partitions);
});
test('legacy whole partition move preserves all mapped children as a connected selected cohort',()=>{
  const raw={id:'legacy-move',rooms:[],partitions:[{id:'p',a:[0,0],b:[1,0],cm:10},{id:'t',a:[.5,0],b:[.5,1],cm:10}]};
  const migrated=G.migrateGraphSpace(raw),source={...copy(raw),graphMapping:migrated.mapping},draft=copy(raw);
  draft.partitions[0].a=[0,.1];draft.partitions[0].b=[1,.1];
  const result=commitGraphEdit(migrated.space,draft,{kind:'partitions',ids:['p']},source);
  const selected=result.plan_graph.edges.filter(e=>e.kind==='partition'&&e.id!=='t');
  const shared=selected[0].from===selected[1].from||selected[0].from===selected[1].to||selected[0].to===selected[1].from||selected[0].to===selected[1].to;
  assert.ok(shared,'the moved mapped children share one new node');
  assert.deepEqual(result.partitions.find(p=>p.id==='t'),migrated.space.partitions.find(p=>p.id==='t'));
});
test('new segment crossing known sources emits exact splits instead of rebuilding the current graph',()=>{
  const before=migrate({id:'cross-create',rooms:[],partitions:[{id:'horizontal',a:[0,.5],b:[1,.5],cm:10}]}),draft=copy(before);
  draft.partitions.push({id:'vertical',a:[.5,0],b:[.5,1],cm:10});
  const result=commitGraphEditResult(before,draft,{kind:'partitions',ids:['vertical']});
  assert.equal(result.graph.edges.length,4);
  assert.equal(result.graph.nodes.length,5);
  assert.ok(result.operations.some(op=>op.kind==='insert-on-edge'));
  assert.equal(G.validateGraph(result.graph).ok,true);
});


test('selected intersection scope preserves deterministic exact splits with unrelated edges and input permutations',()=>{
  const raw={id:'pair-scope',rooms:[],partitions:[
    {id:'middle',a:[0,.5],b:[1,.5],cm:10},
    ...Array.from({length:40},(_,i)=>({id:'far-'+i,a:[2+i/240,2],b:[2+i/240,3],cm:10}))]};
  const before=migrate(raw),draft=copy(before);
  draft.partitions.push({id:'first',a:[.25,0],b:[.25,1],cm:10},{id:'last',a:[.75,0],b:[.75,1],cm:10});
  const run=(source,target,ids)=>commitGraphEditResult(source,target,{kind:'partitions',ids});
  const result=run(before,draft,['first','last']);
  const reversed=copy(before);reversed.plan_graph.edges.reverse();reversed.plan_graph.nodes.reverse();
  const again=run(reversed,draft,['last','first']);
  assert.deepEqual(result.graph,again.graph);
  assert.equal(result.graph.edges.length,before.plan_graph.edges.length+6);
  const far=graph=>graph.edges.filter(e=>e.id.startsWith('far-'));
  assert.deepEqual(far(result.graph),far(before.plan_graph));
  assert.equal(G.validateGraph(result.graph).ok,true);
  for(const x of ['60','180'])assert.ok(result.graph.nodes.some(n=>n.p[0]==='l'&&n.p[1]===x&&n.p[2]==='120'));
});
