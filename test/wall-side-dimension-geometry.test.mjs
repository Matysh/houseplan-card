import assert from 'node:assert/strict';
import test from 'node:test';
import {WallDimensionGeometry,affectedDimensionCarriers} from '../test-build/wall-side-dimension-geometry.js';
import {encodePoint,readAuthoredPoint} from '../test-build/plan-exact.js';
import {directStructure} from '../test-build/direct-wall-geometry.js';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {wallKey} from '../test-build/wall-thickness.js';

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

test('#1381 exact construction is bounded before building; remote edits reuse the local signature',()=>{
  const small=room(),large=structuredClone(small),built=[];
  for(let i=0;i<500;i++) {
    const x=50+i%25,y=50+Math.floor(i/25),id=`remote-${i}`;
    large.plan_graph.nodes.push({id:`${id}:a`,p:encodePoint(readAuthoredPoint([x,y]))},
      {id:`${id}:b`,p:encodePoint(readAuthoredPoint([x+.4,y]))});
    large.plan_graph.edges.push({kind:'partition',id,from:`${id}:a`,to:`${id}:b`,cm:20});
  }
  const original=JSON.stringify(large);
  const resolver=new WallDimensionGeometry((source,...args)=>{
    built.push(source.graph);return directStructure(source,...args);
  });
  const expected=new WallDimensionGeometry().read(small,['wall:north']);
  const result=resolver.read(large,['wall:north']);
  assert.deepEqual(result.intervals,expected.intervals);
  assert.equal(built.length,1);assert.equal(built[0].edges.length,4);assert.equal(built[0].nodes.length,4);
  assert.ok(built[0].edges.every(edge=>!edge.id.startsWith('remote-')),'not merely a local union after a full exact build');
  const next=structuredClone(large);next.plan_graph.nodes.at(-1).p=encodePoint(readAuthoredPoint([80,80]));
  assert.strictEqual(resolver.read(next,['wall:north']),result,'new full graph identity with unchanged local geometry reuses the model');
  assert.equal(built.length,1);assert.equal(resolver.builds,1);
  const moved=structuredClone(next);moved.plan_graph.nodes[1].p=encodePoint(readAuthoredPoint([.35,0]));
  assert.notDeepEqual(resolver.read(moved,['wall:north']).intervals,result.intervals);
  assert.equal(built.length,2);assert.ok(built.every(graph=>graph.edges.length===4));
  assert.equal(JSON.stringify(large),original,'the bounded read never writes its partial graph back');
});

test('#1381 bounded room-cycle/incidence closure preserves the full producer at shared and acute joints',()=>{
  const rooms=[{id:'a',poly:[[0,0],[.32,0],[.28,.2],[0,.2]]},
    {id:'b',poly:[[.32,0],[.6,0],[.6,.2],[.28,.2]]},
    {id:'remote',poly:[[50,50],[51,50],[51,51],[50,51]]}];
  const walls=new Map();
  for(const room of rooms)for(let i=0;i<room.poly.length;i++) {
    const a=room.poly[i],b=room.poly[(i+1)%room.poly.length],key=wallKey(a,b,1/240);
    walls.set(key,{key,a,b,cm:i%2?30:20});
  }
  const config=commitWallSegmentModel({spaces:[{id:'f',cell_cm:5,rooms,walls:[...walls.values()],
    partitions:[{id:'branch',a:[.6,.2],b:[.75,.3],cm:15}],openings:[]}],markers:[],settings:{}}).config;
  const space=config.spaces[0],built=[];
  const bounded=new WallDimensionGeometry((source,...args)=>{built.push(source.graph);return directStructure(source,...args);});
  const full=new WallDimensionGeometry((source,...args)=>directStructure({...source,graph:space.plan_graph},...args));
  for(const edge of space.plan_graph.edges.filter(e=>e.kind==='wall'&&e.id!==space.rooms[2].wall_ids[0])) {
    if(space.rooms[2].wall_ids.includes(edge.id))continue;
    const ids=[`wall:${edge.id}`];assert.deepEqual(bounded.read(space,ids).intervals,full.read(space,ids).intervals);
  }
  assert.ok(built.length>0&&built.every(graph=>!graph.rooms.some(room=>room.room==='remote')));
  assert.ok(built.some(graph=>graph.edges.some(edge=>edge.id==='branch')),'far-end incident context is preserved');
});
