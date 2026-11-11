import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateGraphSpace, graphIndex, validateGraph, applyGraphOperation, projectGraphSpace } from '../test-build/plan-graph.js';
import { commitGraphEdit } from '../test-build/graph-edit-intent.js';
import { makeResizeJunctionFixture } from '../demo/fixtures/resize-junctions.mjs';
import * as Q from '../test-build/plan-exact.js';

const rect = (id, x0, y0, x1, y1) => ({ id, name: id, poly: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]] });
function fixture(cross = false, partition = false, transpose = false) {
  const raw = { id: 'resize-junction', cell_cm: 20, rooms: [
    rect('a',.1,.1,.5,.5), rect('b',.5,.1,.9,.5),
    ...(partition ? [] : cross ? [rect('c',.1,.5,.5,.9), rect('d',.5,.5,.9,.9)] : [rect('fixed',.1,.5,.9,.9)]),
  ], ...(partition ? {partitions:[{id:'outside',a:[.5,.5],b:[.5,.9],cm:20}]} : {}) };
  if(transpose){
    for(const r of raw.rooms)r.poly=r.poly.map(([x,y])=>[y,x]);
    for(const p of raw.partitions||[]){p.a.reverse();p.b.reverse();}
  }
  const space = migrateGraphSpace(raw).space;
  return commitGraphEdit(space, structuredClone(space), { kind: 'thickness', rooms: space.rooms.map(r=>r.id), cm: 20 });
}
function move(space, from, to, axis = 0) {
  const draft = structuredClone(space);
  for (const room of draft.rooms) if (['a','b'].includes(room.id))
    room.poly = room.poly.map(p => p.map((v,i)=>i===axis&&v===from?to:v));
  return commitGraphEdit(space,draft,{kind:'resize',rooms:['a','b']});
}
function degree(space,x,y) {
  const index = graphIndex(space.plan_graph);
  const nodes = space.plan_graph.nodes.filter(n=>Q.pointEq(index.points.get(n.id),Q.readSourcePoint([x,y])));
  assert.ok(nodes.length <= 1, `duplicate nodes at ${x},${y}`);
  return nodes.length ? index.incident.get(nodes[0].id).length : 0;
}
const hasEndpoint=(index,edge,point)=>[edge.from,edge.to].some(node=>Q.pointEq(index.points.get(node),Q.readSourcePoint(point)));

test('#1383 T-junction moves without leaving a straight seam; a second Resize returns it',()=>{
  const before = fixture(), frozen = structuredClone(before);
  const moved = move(before,.5,.55);
  assert.equal(validateGraph(moved.plan_graph).ok,true);
  assert.equal(degree(moved,.5,.5),0,'old T-junction became an unnecessary straight node');
  assert.equal(degree(moved,.55,.5),3);
  assert.equal(moved.plan_graph.nodes.length,before.plan_graph.nodes.length);
  const returned = move(moved,.55,.5);
  assert.equal(degree(returned,.55,.5),0);
  assert.equal(degree(returned,.5,.5),3);
  assert.equal(returned.plan_graph.nodes.length,before.plan_graph.nodes.length);
  assert.deepEqual(before,frozen,'source remains unchanged');
});

test('#1383 X splits into two real T-junctions and merges back without stale seams',()=>{
  const before = fixture(true), moved = move(before,.5,.55);
  assert.equal(degree(before,.5,.5),4);
  assert.equal(degree(moved,.5,.5),3);
  assert.equal(degree(moved,.55,.5),3);
  assert.equal(moved.plan_graph.nodes.length,before.plan_graph.nodes.length+1);
  const returned = move(moved,.55,.5);
  assert.equal(validateGraph(returned.plan_graph).ok,true);
  assert.equal(degree(returned,.5,.5),4);
  assert.equal(degree(returned,.55,.5),0);
  assert.equal(returned.plan_graph.nodes.length,before.plan_graph.nodes.length);
});

test('#1383 external partition keeps its own T while the moving T separates and returns',()=>{
  const before = fixture(false,true), outside = structuredClone(before.partitions);
  const moved = move(before,.5,.55);
  assert.equal(degree(moved,.5,.5),3);
  assert.equal(degree(moved,.55,.5),3);
  assert.deepEqual(moved.partitions,outside);
  const returned = move(moved,.55,.5);
  assert.equal(degree(returned,.5,.5),4);
  assert.equal(degree(returned,.55,.5),0);
  assert.deepEqual(returned.partitions,outside);
  assert.equal(returned.plan_graph.nodes.length,before.plan_graph.nodes.length);
});

test('#1383 an authored old T leaves no unneeded straight handle after Resize',()=>{
  let before=fixture();
  const index=graphIndex(before.plan_graph);
  const seam=before.plan_graph.nodes.find(n=>Q.pointEq(index.points.get(n.id),Q.readSourcePoint([.5,.5])));
  before=projectGraphSpace(before,applyGraphOperation(before.plan_graph,{kind:'retire-dependency',node:seam.id}).graph).space;
  const after=move(before,.5,.55);
  assert.equal(degree(after,.5,.5),0);
  assert.equal(degree(after,.55,.5),3);
  assert.equal(after.plan_graph.nodes.length,before.plan_graph.nodes.length);
});

for(const kind of ['tee','cross','partition'])test(`#1383 horizontal ${kind} reconciles and returns without stale seams`,()=>{
  const before=fixture(kind==='cross',kind==='partition',true),original=structuredClone(before);
  const moved=move(before,.5,.55,1);
  assert.equal(degree(moved,.5,.55),3);
  assert.equal(degree(moved,.5,.5),kind==='tee'?0:3);
  const returned=move(moved,.55,.5,1);
  assert.equal(degree(returned,.5,.55),0);
  assert.equal(degree(returned,.5,.5),kind==='tee'?3:4);
  assert.equal(returned.plan_graph.nodes.length,before.plan_graph.nodes.length);
  assert.equal(validateGraph(returned.plan_graph).ok,true);
  assert.deepEqual(before,original);
});

for(const kind of ['tee','cross','partition'])test(`#1383 ${kind} preserves opening hosts and fields through Resize and return`,()=>{
  const before=makeResizeJunctionFixture(kind).config.spaces[0], frozen=structuredClone(before);
  const moveFixture=(space,from,to)=>{
    const draft=structuredClone(space);
    for(const room of draft.rooms)if(['left','right'].includes(room.id))
      room.poly=room.poly.map(([x,y])=>[x===from?to:x,y]);
    const door=draft.openings.find(o=>o.id==='moving-door');door.x=to;
    return commitGraphEdit(space,draft,{kind:'resize',rooms:['left','right']});
  };
  const moved=moveFixture(before,.5,.6),returned=moveFixture(moved,.6,.5);
  for(const state of [moved,returned]){
    const index=graphIndex(state.plan_graph);
    assert.equal(validateGraph(state.plan_graph,{hosts:state.openings.map(o=>o.host)}).ok,true);
    for(const original of before.openings){
      const o=state.openings.find(o=>o.id===original.id),edge=index.edges.get(`${o.host.kind}:${o.host.id}`);
      assert.ok(edge,'live host');
      assert.equal(o.length,original.length);assert.equal(o.type,original.type);
      assert.equal(o.y,original.y);
      assert.equal(o.x,original.id==='moving-door'?(state===moved?.6:.5):original.x);
    }
  }
  assert.deepEqual(before,frozen);
});

test('#1383 meeting T junctions rehost an opening on the disappearing source slice',()=>{
  let before=fixture(false,true),moved=move(before,.5,.6);
  const edge=moved.wall_segments.find(e=>e.a[1]===.5&&e.b[1]===.5
    &&Math.min(e.a[0],e.b[0])===.5&&Math.max(e.a[0],e.b[0])===.6);
  const opening={id:'slice-window',type:'window',x:.55,y:.5,angle:0,length:.04,
    contact:'binary_sensor.synthetic_window',custom:{keep:true},host:{kind:'wall',id:edge.id,t:.5}};
  moved=commitGraphEdit(moved,{...structuredClone(moved),openings:[opening]},{kind:'openings',ids:[opening.id]});
  const result=move(moved,.6,.5),restored=result.openings[0];
  assert.equal(degree(result,.6,.5),0);
  assert.equal(restored.x,.55);assert.equal(restored.y,.5);assert.equal(restored.length,.04);
  assert.equal(restored.contact,opening.contact);assert.deepEqual(restored.custom,opening.custom);
  assert.equal(validateGraph(result.plan_graph,{hosts:[restored.host]}).ok,true);
  assert.ok(graphIndex(result.plan_graph).edges.has(`${restored.host.kind}:${restored.host.id}`));
});

for(const variant of ['thickness','props'])test(`#1383 meeting T junctions preserve different ${variant} and an opening on the vanishing slice`,()=>{
  let before=fixture(false,true);
  const graph=structuredClone(before.plan_graph),index=graphIndex(graph);
  const right=graph.edges.find(edge=>edge.kind==='wall'
    &&hasEndpoint(index,edge,[.5,.5])&&hasEndpoint(index,edge,[.9,.5]));
  assert.ok(right);
  if(variant==='thickness')right.cm=30;
  else right.props={material:'right-only',custom:{keep:true}};
  before=projectGraphSpace(before,graph).space;
  const original=structuredClone(before),outside=structuredClone(before.partitions);
  let moved=move(before,.5,.6);
  const slice=moved.wall_segments.find(edge=>edge.a[1]===.5&&edge.b[1]===.5
    &&Math.min(edge.a[0],edge.b[0])===.5&&Math.max(edge.a[0],edge.b[0])===.6);
  assert.ok(slice);
  const opening={id:'mixed-slice',type:'window',x:.55,y:.5,angle:0,length:.04,
    contact:'binary_sensor.synthetic_mixed',custom:{keep:['metadata']},host:{kind:'wall',id:slice.id,t:.5}};
  moved=commitGraphEdit(moved,{...structuredClone(moved),openings:[opening]},{kind:'openings',ids:[opening.id]});
  const returned=move(moved,.6,.5),restored=returned.openings[0];
  const resultIndex=graphIndex(returned.plan_graph);
  const retained=resultIndex.edges.get(`wall:${right.id}`);
  assert.equal(validateGraph(returned.plan_graph,{hosts:[restored.host]}).ok,true);
  assert.equal(degree(returned,.6,.5),0,'old moving endpoint is gone');
  assert.equal(degree(returned,.5,.5),4,'real material junction remains');
  assert.equal(retained.cm,right.cm);
  assert.deepEqual(retained.props,right.props);
  assert.deepEqual(returned.partitions,outside);
  assert.equal(restored.x,.55);assert.equal(restored.y,.5);assert.equal(restored.length,.04);
  assert.equal(restored.contact,opening.contact);assert.deepEqual(restored.custom,opening.custom);
  assert.equal(restored.host.id,right.id,'vanishing slice rehosts onto the live continuing edge');
  const left=returned.plan_graph.edges.find(edge=>edge.kind==='wall'&&edge.id!==right.id
    &&hasEndpoint(resultIndex,edge,[.1,.5])&&hasEndpoint(resultIndex,edge,[.5,.5]));
  assert.equal(left.cm,20);assert.equal(left.props,undefined,'the other material was not propagated');
  assert.deepEqual(before,original,'source remains immutable');
});

test('#1383 an unowned wall overlaid on a room wall stays independent during Resize',()=>{
  let before=fixture(false,true);
  const graph=structuredClone(before.plan_graph),index=graphIndex(graph);
  const source=graph.edges.find(edge=>edge.kind==='wall'
    &&hasEndpoint(index,edge,[.5,.5])&&hasEndpoint(index,edge,[.9,.5]));
  const independent={...structuredClone(source),id:'unowned-overlay',cm:12,props:{keep:'independent'}};
  graph.edges.push(independent);
  before=projectGraphSpace(before,graph).space;
  const original=structuredClone(before);
  const moved=move(before,.5,.6);
  assert.deepEqual(moved.plan_graph.edges.find(edge=>edge.id===independent.id),independent);
  const returned=move(moved,.6,.5);
  for(const state of [moved,returned]){
    assert.deepEqual(state.plan_graph.edges.find(edge=>edge.id===independent.id),independent);
    assert.equal(state.plan_graph.edges.length-state.plan_graph.rooms.reduce((keys,room)=>{
      for(const edge of room.edges)keys.add(`${edge.kind}:${edge.id}`);return keys;
    },new Set()).size,2,'only the original partition and independent wall have no owner');
  }
  assert.deepEqual(before,original);
});
