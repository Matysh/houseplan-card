import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
import {commitGraphEdit,commitGraphEditResult} from '../test-build/graph-edit-intent.js';
import { incidentResizeFixture as incidentFixture, incidentResizeDraft as incidentDraft } from './helpers/resize-incident-fixture.mjs';
const copy=structuredClone;
const rectangle=(id,x0=0,x1=1)=>({id,name:id,poly:[[x0,0],[x1,0],[x1,1],[x0,1]],custom:{keep:id}});
const migrate=space=>G.migrateGraphSpace(space).space;
const base=()=>migrate({id:'floor',rooms:[rectangle('a')],extra:{keep:1}});
test('#1264 Resize nodes the fixed neighbour and reuses its exact shared source atoms',()=>{
  const before=incidentFixture(),snapshot=copy(before),result=commitGraphEditResult(before,incidentDraft(before),
    {kind:'resize',rooms:['upper-left','upper-right']}),space=result.space;
  assert.deepEqual(space.rooms.find(r=>r.id==='lower-left').poly,[[.1,.5],[.45,.5],[.5,.5],[.5,.85],[.1,.85]]);
  const spans=space.wall_segments.filter(w=>w.a[1]===.5&&w.b[1]===.5)
    .map(w=>[Math.min(w.a[0],w.b[0]),Math.max(w.a[0],w.b[0]),w.cm]).sort((a,b)=>a[0]-b[0]);
  assert.deepEqual(spans,[[.1,.45,37],[.45,.5,37],[.5,.9,37]]);
  const middle=space.wall_segments.find(w=>w.a[1]===.5&&w.b[1]===.5
    &&Math.min(w.a[0],w.b[0])===.45&&Math.max(w.a[0],w.b[0])===.5);
  assert.deepEqual(G.graphIndex(result.graph).owners.get('wall:'+middle.id).slice().sort(),['lower-left','upper-right']);
  assert.deepEqual(space.partitions,before.partitions,'no coincident independent material is consumed');
  assert.deepEqual(space.rooms.find(r=>r.id==='remote'),before.rooms.find(r=>r.id==='remote'));
  assert.deepEqual(space.decor,before.decor);assert.deepEqual(space.extra,before.extra);
  assert.equal(G.validateGraph(result.graph).ok,true);assert.deepEqual(before,snapshot);
  const keys=new Set(result.graph.edges.map(G.edgeKey));
  for(const ranges of Object.values(result.mapping.edges))for(const range of ranges)assert.ok(keys.has(G.edgeKey(range.ref)));
  const permuted=copy(before);permuted.plan_graph.nodes.reverse();permuted.plan_graph.edges.reverse();permuted.plan_graph.rooms.reverse();
  const again=commitGraphEdit(permuted,incidentDraft(permuted),{kind:'resize',rooms:['upper-right','upper-left']});
  assert.deepEqual(again.plan_graph,result.graph);
});
test('#1264 Resize retains opening fields and binds the unchanged centre to its exact residual child',()=>{
  let before=incidentFixture();
  const host=before.wall_segments.find(w=>w.a[1]===.5&&w.b[1]===.5
    &&Math.min(w.a[0],w.b[0])===.1&&Math.max(w.a[0],w.b[0])===.5);
  const draft=copy(before);draft.openings=[{id:'window',type:'window',x:.475,y:.5,length:.02,angle:0,
    host:{kind:'wall',id:host.id,t:(.475-host.a[0])/(host.b[0]-host.a[0])},contact:'binary_sensor.synthetic',custom:{keep:true}}];
  before=commitGraphEdit(before,draft,{kind:'openings',ids:['window']});
  const after=commitGraphEdit(before,incidentDraft(before),{kind:'resize',rooms:['upper-left','upper-right']});
  const child=after.wall_segments.find(w=>w.id===after.openings[0].host.id);
  assert.notEqual(child.id,host.id);assert.equal(child.cm,37);
  assert.deepEqual(after.openings,[{...before.openings[0],host:{...before.openings[0].host,id:child.id,t:.5,tq:['1','2']}}]);
  assert.equal(Math.min(child.a[0],child.b[0]),.45);assert.equal(Math.max(child.a[0],child.b[0]),.5);
  assert.ok(after.wall_segments.filter(w=>w.a[0]===w.b[0]).every(w=>w.cm===0));
});
for(const conflict of ['thickness','metadata'])test('#1264 conflicting incident '+conflict+' refuses Resize atomically',()=>{
  let before=incidentFixture();
  const right=before.wall_segments.find(w=>w.a[1]===.5&&w.b[1]===.5&&Math.min(w.a[0],w.b[0])===.5);
  if(conflict==='thickness')before=commitGraphEdit(before,copy(before),{kind:'thickness',edges:[{kind:'wall',id:right.id}],cm:43});
  else{
    const draft=copy(before);draft.wall_segments.find(w=>w.id===right.id).custom={keep:'exclusive source'};
    before=commitGraphEdit(before,draft,{kind:'metadata'});
  }
  const snapshot=copy(before);
  assert.throws(()=>commitGraphEdit(before,incidentDraft(before),{kind:'resize',rooms:['upper-left','upper-right']}),/resize-incidence-material/);
  assert.deepEqual(before,snapshot);
});
test('#1279 a new Split divider is one physical carrier owned by both room cycles',()=>{
  const before=base(),draft=copy(before);
  draft.rooms[0].poly=[[0,0],[.5,0],[.5,1],[0,1]];
  draft.rooms.push({id:'b',name:'B',poly:[[.5,0],[1,0],[1,1],[.5,1]],custom:{keep:'b'}});
  const split=commitGraphEdit(before,draft,{kind:'faces',rooms:['a','b']});
  const [a,b]=split.rooms,shared=a.wall_ids.filter(id=>b.wall_ids.includes(id));
  assert.equal(shared.length,1);
  assert.equal(split.plan_graph.edges.length,7);
  assert.equal(G.validateGraph(split.plan_graph).ok,true);
  assert.deepEqual(a.custom,{keep:'a'});assert.deepEqual(b.custom,{keep:'b'});
  const thick=commitGraphEdit(split,copy(split),{kind:'thickness',rooms:['a'],cm:10});
  const common=thick.wall_segments.find(e=>e.id===shared[0]);
  assert.equal(common.cm,10);
  assert.deepEqual(thick.rooms.map(r=>r.wall_ids),split.rooms.map(r=>r.wall_ids));
  assert.equal(thick.wall_segments.filter(e=>e.a[0]===.5&&e.b[0]===.5).length,1);
  assert.deepEqual(before,base());
});
test('room acceptance follows connected exact source atoms hidden by numeric collinearity',()=>{
  const graph={version:1,nodes:[{id:'a',p:['l','0','0']},{id:'b',p:['l','480','0']},
    {id:'c',p:['l','480','240']},{id:'d',p:['q','1','1','100000000000000001','100000000000000000']},
    {id:'e',p:['l','0','240']}],edges:['a','b','c','d','e'].map((from,i,list)=>({id:'p'+i,
      kind:'partition',from,to:list[(i+1)%list.length],cm:15})),rooms:[],dependencies:[]};
  const before=G.projectGraphSpace({id:'s',rooms:[]},graph).space,draft=copy(before);
  draft.rooms.push({id:'r',poly:[[0,0],[2,0],[2,1],[0,1]]});
  const result=commitGraphEditResult(before,draft,{kind:'faces',rooms:['r'],
    consumedPartitionIds:graph.edges.map(e=>e.id),sourceEdges:graph.edges});
  assert.deepEqual(result.graph.nodes,graph.nodes);
  assert.equal(result.graph.edges.length,5);
  assert.deepEqual(result.space.rooms[0].poly,[[0,0],[2,0],[2,1],[1,1],[0,1]]);
  assert.equal(result.space.partitions.length,0);
});
test('room promotion intersects finite sides, never their distant extensions',()=>{
  const poly=[[0,0],[1,0],[1,.5],[2,.5],[2,1],[0,1]];
  const before=migrate({id:'s',rooms:[],partitions:poly.map((a,i)=>({id:'p'+i,a,b:poly[(i+1)%poly.length],cm:5}))});
  const draft=copy(before);draft.rooms.push({id:'r',name:'R',poly,wall_ids:poly.map((_,i)=>'p'+i)});
  const result=commitGraphEditResult(before,draft,{kind:'faces',rooms:['r'],
    consumedPartitionIds:poly.map((_,i)=>'p'+i),sourceEdges:before.plan_graph.edges});
  assert.deepEqual(result.space.rooms[0].poly,poly);
  assert.equal(result.graph.nodes.length,6);
  assert.equal(result.graph.edges.length,6);
  assert.equal(G.validateGraph(result.graph).ok,true);
});
test('face promotion reuses source anchors without a dependency cycle and consumes only named duplicate pieces',()=>{
  const nodes=[[12,24],[24,24],[48,24],[72,24],[72,72],[24,72],[144,120],[168,120]]
    .map(([x,y],i)=>({id:'n'+i,p:['l',String(x),String(y)]}));
  const e=(id,from,to,cm=15,props)=>({id,kind:'partition',from:'n'+from,to:'n'+to,cm,...props?{props}:{}});
  const graph={version:1,nodes,edges:[e('overlap',1,2),e('tail',0,1),e('unrelated',6,7),
    e('top',1,3),e('right',3,4),e('bottom',4,5),e('left',5,1),
    e('independent',1,2,15,{keep:'independent'}),e('other-material',1,2,25)],rooms:[],
    dependencies:[{node:'n1',kind:'on-edge',refs:[{from:'n0',to:'n2'}],parameters:[['1','3']]}]};
  const before=G.projectGraphSpace({id:'s',rooms:[]},graph).space,draft=copy(before);
  draft.rooms.push({id:'new',name:'New',poly:[[.1,.1],[.3,.1],[.3,.3],[.1,.3]],wall_ids:['top','right','bottom','left']});
  const result=commitGraphEditResult(before,draft,{kind:'faces',rooms:['new'],
    consumedPartitionIds:['overlap','top','right','bottom','left','other-material'],
    sourceEdges:graph.edges});
  assert.equal(G.validateGraph(result.graph).ok,true);
  assert.deepEqual(result.graph.dependencies,graph.dependencies);
  assert.deepEqual(result.space.partitions.map(p=>p.id).sort(),['independent','other-material','tail','unrelated']);
  for(const id of ['tail','unrelated','independent','other-material'])
    assert.deepEqual(result.space.partitions.find(p=>p.id===id),before.partitions.find(p=>p.id===id));
  const keys=new Set(result.graph.edges.map(G.edgeKey));
  for(const ranges of Object.values(result.mapping.edges))for(const range of ranges)
    assert.ok(keys.has(G.edgeKey(range.ref)),'lineage never points to a consumed duplicate');
  assert.equal(result.space.rooms.length,1);
});
test('metadata intent preserves exact graph and opaque room/space properties',()=>{
  const before=base(),draft=copy(before);draft.title='New';draft.rooms[0].name='Renamed';
  const result=commitGraphEdit(before,draft,{kind:'metadata'});
  assert.deepEqual(result.plan_graph,before.plan_graph);
  assert.deepEqual(result.rooms[0].poly,before.rooms[0].poly);
  assert.equal(result.rooms[0].name,'Renamed');assert.deepEqual(result.extra,before.extra);
  assert.deepEqual(before,base());
});

test('metadata refuses implicit graph geometry instead of silently dropping it',()=>{
  const before=base();
  for(const change of [
    d=>{d.rooms[0].poly[0][0]=.1;},d=>{d.rooms=[];},
    d=>{d.wall_segments[0].a[0]+=.1;},d=>{d.wall_segments[0].cm+=1;},
    d=>{d.plan_graph.nodes[0].p=['l','1','1'];},d=>{d.partitions=[{id:'new',a:[0,0],b:[1,1],cm:10}];},
  ]){const draft=copy(before);change(draft);assert.throws(()=>commitGraphEdit(before,draft,{kind:'metadata'}),/projection-only-write/);}
});

test('metadata explicitly transfers edge props and allows independent columns/decor',()=>{
  const before=base(),draft=copy(before),id=draft.wall_segments[0].id;
  draft.wall_segments[0].custom={paint:'blue'};draft.wall_columns=[{id:'c',center:[.5,.5],shape:'circle',cm:20}];
  draft.decor=[{id:'d',kind:'box',x:.1,y:.1}];
  const result=commitGraphEdit(before,draft,{kind:'metadata'});
  assert.deepEqual(result.plan_graph.edges.find(e=>e.id===id).props.custom,{paint:'blue'});
  assert.deepEqual(result.wall_columns,draft.wall_columns);assert.deepEqual(result.decor,draft.decor);
  assert.deepEqual(result.plan_graph.nodes,before.plan_graph.nodes);
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
test('Resize expands real-corner draft and removes its now redundant straight atom',()=>{
  let before=base();const cycle=before.plan_graph.rooms[0],ref=cycle.edges[0];
  const split=G.applyGraphOperation(before.plan_graph,{kind:'insert-on-edge',edge:ref,t:['1','2'],node:'middle',newEdgeId:'child'});
  before=G.projectGraphSpace(before,split.graph).space;
  const draft=copy(before);draft.rooms[0].poly=[[0,.1],[1,.1],[1,1],[0,1]];
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a']});
  assert.equal(result.plan_graph.nodes.some(n=>n.id==='middle'),false,
    '#1383 a straight seam without other dependents is not a persistent editing handle');
  assert.equal(result.plan_graph.dependencies.some(d=>d.node==='middle'),false);
  assert.deepEqual(result.rooms[0].poly,[[0,.1],[1,.1],[1,1],[0,1]]);
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
  assert.throws(()=>commitGraphEdit(before,draft,{kind:'metadata'}),/projection-only-write/);
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
test('#1264 a derived T seam slides twice on the fixed uniform neighbour without leaving short atoms',()=>{
  const rect=(id,x0,y0,x1,y1)=>({id,poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]});
  let before=migrate({id:'t-slide',cell_cm:20,rooms:[rect('a',0,0,.5,.5),rect('b',.5,0,1,.5),rect('fixed',0,.5,1,1)]});
  before=commitGraphEdit(before,copy(before),{kind:'thickness',rooms:['a','b','fixed'],cm:20});
  const at=(x,y)=>before.plan_graph.nodes.find(n=>Q.pointEq(G.graphIndex(before.plan_graph).points.get(n.id),Q.readSourcePoint([x,y])));
  const node=at(.5,.5);
  // This witness names a derived seam, as the imported real-plan fixture does.
  before=G.projectGraphSpace(before,G.applyGraphOperation(before.plan_graph,{kind:'set-dependency',dependency:{
    node:node.id,kind:'on-edge',refs:[{from:at(0,.5).id,to:at(1,.5).id}],parameters:[['1','2']]}}).graph).space;
  const original=copy(before);
  assert.ok(before.plan_graph.dependencies.some(d=>d.node===node.id&&d.kind==='on-edge'));
  for(const [from,to]of[[.5,.51],[.51,.52]]){
    const draft=copy(before);
    for(const room of draft.rooms)if(['a','b'].includes(room.id))room.poly=room.poly.map(([x,y])=>[x===from?to:x,y]);
    const next=commitGraphEdit(before,draft,{kind:'resize',rooms:['a','b']});
    assert.equal(next.plan_graph.nodes.length,original.plan_graph.nodes.length);
    assert.deepEqual(next.plan_graph.edges,original.plan_graph.edges,'stored carrier IDs and endpoints stay shared');
    assert.deepEqual(Q.pointToNumbers(G.graphIndex(next.plan_graph).points.get(node.id)),[to,.5]);
    assert.deepEqual(next.rooms.find(r=>r.id==='fixed').poly,[[0,.5],[to,.5],[1,.5],[1,1],[0,1]]);
    assert.equal(G.validateGraph(next.plan_graph).ok,true);before=next;
  }
  const authored=copy(original);authored.plan_graph.dependencies=authored.plan_graph.dependencies.filter(d=>d.node!==node.id);
  const draft=copy(authored);
  for(const room of draft.rooms)if(['a','b'].includes(room.id))room.poly=room.poly.map(([x,y])=>[x===.5?.51:x,y]);
  const held=commitGraphEdit(authored,draft,{kind:'resize',rooms:['a','b']});
  assert.equal(G.graphIndex(held.plan_graph).points.has(node.id),false,
    '#1383 the old straight seam is removed, rather than moved as an authored corner');
  assert.equal(held.plan_graph.nodes.length,original.plan_graph.nodes.length);
  assert.equal(G.validateGraph(held.plan_graph).ok,true);
});

test('#1264 sliding a T seam never moves a dependent corner of fixed rooms',()=>{
  const rect=(id,x0,y0,x1,y1)=>({id,poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]});
  let before=migrate({id:'dependent-seam',cell_cm:20,rooms:[rect('a',0,0,.5,.5),rect('b',.5,0,1,.5),
    // The protected dependent is a real corner, not a redundant straight seam
    // which a same-material thickness command now correctly removes (#1283).
    {id:'fixed-left',poly:[[0,.5],[.3,.5],[.3,.7],[.25,1],[0,1]]},
    {id:'fixed-right',poly:[[.3,.5],[1,.5],[1,1],[.25,1],[.3,.7]]}]});
  before=commitGraphEdit(before,copy(before),{kind:'thickness',rooms:before.rooms.map(r=>r.id),cm:20});
  const index=G.graphIndex(before.plan_graph),at=(x,y)=>before.plan_graph.nodes.find(n=>Q.pointEq(index.points.get(n.id),Q.readSourcePoint([x,y]))).id;
  const x=at(.5,.5),w=at(.3,.7),left=at(0,.5),right=at(1,.5),anchor=at(0,1);
  before=G.projectGraphSpace(before,G.applyGraphOperation(before.plan_graph,{kind:'batch',operations:[
    {kind:'set-dependency',dependency:{node:x,kind:'on-edge',refs:[{from:left,to:right}],parameters:[['1','2']]}},
    {kind:'set-dependency',dependency:{node:w,kind:'on-edge',refs:[{from:anchor,to:x}],parameters:[['3','5']]}}
  ]}).graph).space;
  const source=copy(before),draft=copy(before);
  for(const room of draft.rooms)if(['a','b'].includes(room.id))room.poly=room.poly.map(([u,v])=>[u===.5?.51:u,v]);
  const result=commitGraphEdit(before,draft,{kind:'resize',rooms:['a','b']}),after=G.graphIndex(result.plan_graph);
  assert.deepEqual(Q.pointToNumbers(after.points.get(w)),[.3,.7],'fixed corner must not follow its dependent seam');
  assert.deepEqual(result.rooms.find(r=>r.id==='fixed-left'),source.rooms.find(r=>r.id==='fixed-left'));
  for(const ref of source.plan_graph.rooms.filter(r=>r.room.startsWith('fixed-')).flatMap(r=>r.edges)){
    const edge=G.graphIndex(source.plan_graph).edges.get(G.edgeKey(ref));
    for(const node of[edge.from,edge.to])assert.ok(Q.pointEq(after.points.get(node),G.graphIndex(source.plan_graph).points.get(node)));
  }
  assert.equal(G.validateGraph(result.plan_graph).ok,true);assert.deepEqual(before,source);
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
  assert.equal(result.plan_graph.edges.length,4,'the two abandoned divider endpoints are compacted (#1283)');
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

test('#1226 current graph deletion and face promotion retain the opening carrier identity',()=>{
  const source=migrate({id:'current-host',rooms:[],partitions:[
    {id:'a',a:[0,0],b:[1,0],cm:15},{id:'b',a:[1,0],b:[1,1],cm:15},
    {id:'c',a:[1,1],b:[0,1],cm:15},{id:'d',a:[0,1],b:[0,0],cm:15}],
    openings:[{id:'o',type:'door',x:.5,y:0,length:.1,angle:0,
      host:{kind:'partition',id:'a',t:.5},future:{retained:true}}]});
  const promote=(before,id)=>commitGraphEdit(before,{...copy(before),rooms:[rectangle(id)]},
    {kind:'faces',rooms:[id],consumedPartitionIds:before.partitions.map(p=>p.id),sourceEdges:before.plan_graph.edges});
  const first=promote(source,'room');
  const kept=commitGraphEdit(first,{...copy(first),rooms:[]},{kind:'delete-room',room:'room',keepWalls:true});
  const recreated=promote(kept,'recreated');
  for(const [space,kind]of[[first,'wall'],[kept,'partition'],[recreated,'wall']]){
    assert.equal(G.validateGraph(space.plan_graph).ok,true);
    assert.deepEqual(space.openings[0].host,{kind,id:'a',t:.5,tq:['1','2']});
    assert.deepEqual(space.openings[0].future,{retained:true});
    assert.equal(space.plan_graph.edges.find(e=>e.id==='a').cm,15);
  }
  assert.deepEqual(source.rooms,[],'all producers leave the source authority unchanged');
});

for(const rotate of [false,true])for(const coalesced of [false,true])
  test(`#1292 Resize preserves an unchanged near-lattice ordinate (${rotate?'x':'y'}, ${coalesced?'corners':'atoms'})`,()=>{
    const raw=copy(incidentFixture());
    delete raw.plan_graph;
    // Neighbouring caps create genuine T atoms on both selected top edges.
    // The corner-only draft removes these atoms while graph cycles retain them.
    raw.rooms.push(
      {id:'cap-left',poly:[[.3,.05],[.4,.05],[.4,.15],[.3,.15]]},
      {id:'cap-right',poly:[[.6,.05],[.7,.05],[.7,.15],[.6,.15]]});
    const source=migrate(raw);
    const graph=copy(source.plan_graph);
    // A valid imported current graph may retain decimal q from before the
    // native lattice writer. Every room sharing this line has the same exact q.
    for(const node of graph.nodes){
      let p=Q.decodePoint(node.p);
      if(Q.eq(p[1],Q.exact(1n,2n)))p=[p[0],Q.parseDecimal('0.5000000001')];
      if(rotate)p=[Q.sub(Q.ONE,p[1]),p[0]];
      node.p=Q.encodePoint(p);
    }
    assert.equal(G.validateGraph(graph).ok,true);
    const before=G.projectGraphSpace(source,graph).space,snapshot=copy(before),draft=copy(before);
    for(const room of draft.rooms)if(['upper-left','upper-right'].includes(room.id)){
      room.poly=room.poly.map(p=>rotate?[p[0],p[1]===.5?.45:p[1]]:[p[0]===.5?.45:p[0],p[1]]);
      if(coalesced)room.poly=room.poly.filter((p,i,poly)=>{
        const prev=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length];
        return(p[0]-prev[0])*(next[1]-p[1])!==(p[1]-prev[1])*(next[0]-p[0]);
      });
      const atoms=before.rooms.find(old=>old.id===room.id).poly.length;
      assert.ok(coalesced ? room.poly.length < atoms : room.poly.length === atoms,
        room.id+' must exercise the named corners/atoms branch');
    }
    const result=commitGraphEditResult(before,draft,{kind:'resize',rooms:['upper-left','upper-right']});
    const expected=rotate?['q','4999999999','10000000000','9','20']:['q','9','20','5000000001','10000000000'];
    assert.ok(result.graph.nodes.some(node=>JSON.stringify(node.p)===JSON.stringify(expected)),
      'changed ordinate is authored .45; untouched legacy q is not snapped to .5');
    assert.equal(G.validateGraph(result.graph).ok,true,'no micro crossing against the fixed neighbours');
    for(const id of ['lower-left','lower-right','remote','cap-left','cap-right']){
      const old=before.rooms.find(room=>room.id===id),next=result.space.rooms.find(room=>room.id===id);
      for(const p of old.poly)assert.ok(next.poly.some(q=>JSON.stringify(q)===JSON.stringify(p)),id+' keeps every fixed vertex');
      assert.deepEqual(next.custom,old.custom);
    }
    assert.deepEqual(before,snapshot,'input graph remains immutable');
  });
