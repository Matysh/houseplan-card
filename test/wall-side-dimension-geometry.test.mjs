import assert from 'node:assert/strict';
import test from 'node:test';
import {WallDimensionGeometry,affectedDimensionCarriers} from '../test-build/wall-side-dimension-geometry.js';
import {encodePoint,readAuthoredPoint} from '../test-build/plan-exact.js';

// Authored graph and independently known physical lengths, not a resolver-generated oracle.
function room() {
  const poly=[[0,0],[.32,0],[.32,.2],[0,.2]],ids=['north','east','south','west'];
  const wall_segments=ids.map((id,i)=>({id,a:poly[i],b:poly[(i+1)%4],cm:20}));
  return {id:'room-fixture',cell_cm:5,rooms:[{id:'r',poly,wall_ids:ids}],wall_segments,partitions:[],openings:[],
    plan_graph:{version:1,nodes:poly.map((p,i)=>({id:`n${i}`,p:encodePoint(readAuthoredPoint(p))})),
      edges:ids.map((id,i)=>({kind:'wall',id,from:`n${i}`,to:`n${(i+1)%4}`,cm:20})),
      rooms:[{room:'r',edges:ids.map(id=>({kind:'wall',id,reverse:false}))}],dependencies:[]}};
}
test('#1381 production material lineage yields clear/outer dimensions and ignores apertures',()=>{
  const space=room(),resolver=new WallDimensionGeometry();
  const result=resolver.read(space,['wall:north']);
  assert.equal(result.intervals.length,2);
  assert.ok(result.intervals.every(i=>i.source==='physical'));
  assert.ok(Math.abs(result.intervals[0].lengthCm-404)<1e-7);
  assert.ok(Math.abs(result.intervals[1].lengthCm-364)<1e-7);
  const opening={id:'door',type:'door',x:.16,y:0,length:.08,angle:0,host:{kind:'wall',id:'north',t:.5}};
  assert.strictEqual(resolver.read({...space,openings:[opening]},['wall:north']),result);
  assert.equal(resolver.builds,1,'apertures/camera/state are not physical dimension inputs');
  assert.strictEqual(resolver.read(space,['wall:north']),result);
});
test('#1381 changed calibration invalidates measurements but source documents stay untouched',()=>{
  const space=room(),snapshot=JSON.stringify(space),resolver=new WallDimensionGeometry();
  const before=resolver.read(space,['wall:north']);
  const after=resolver.read({...space,cell_cm:10},['wall:north']);
  assert.notEqual(after,before);assert.equal(resolver.builds,2);
  assert.ok(Math.abs(after.intervals[0].lengthCm-788)<1e-7);
  assert.equal(JSON.stringify(space),snapshot);
});

test('#1381 real opposite endpoint supports use their own unequal thicknesses',()=>{
  const space=room();space.plan_graph={...space.plan_graph,edges:space.plan_graph.edges.map(edge=>edge.id==='east'?{...edge,cm:40}:edge)};
  const lengths=new WallDimensionGeometry().read(space,['wall:north']).intervals.map(i=>i.lengthCm).sort((a,b)=>a-b);
  assert.ok(Math.abs(lengths[0]-354)<1e-7);
  assert.ok(Math.abs(lengths[1]-414)<1e-7);
});
test('#1381 explicit changed-carrier neighborhood excludes a remote component',()=>{
  const before=room();before.partitions=[{id:'far',a:[50,50],b:[51,50],cm:20}];
  const candidate={...before,plan_graph:{...before.plan_graph,nodes:before.plan_graph.nodes.map(n=>n.id==='n1'
    ?{...n,p:encodePoint(readAuthoredPoint([.35,0]))}:n)}};
  const ids=affectedDimensionCarriers(before,candidate);
  assert.ok(ids.includes('wall:north'));assert.ok(!ids.includes('partition:far'));
});

test('#1381 canonical graph endpoints outrank stale materialized coordinates; legacy cache follows actual values',()=>{
  const space=room(),resolver=new WallDimensionGeometry();
  const first=resolver.read(space,['wall:north']);
  const stale={...space,wall_segments:space.wall_segments.map(w=>({...w,a:[99,99],b:[100,100]}))};
  assert.strictEqual(resolver.read(stale,['wall:north']),first);
  const legacy={id:'legacy',rooms:[],cell_cm:5,partitions:[{id:'p',a:[0,0],b:[.1,0],cm:0}]};
  assert.equal(resolver.read(legacy,['partition:p']).intervals[0].lengthCm,120);
  legacy.partitions[0].b=[.2,0];
  assert.equal(resolver.read(legacy,['partition:p']).intervals[0].lengthCm,240);
});
