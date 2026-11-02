import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrateGraphSpace,validateGraph,applyGraphOperation,edgeKey} from '../test-build/plan-graph.js';
import {graphDigest,graphDigestBytes} from '../test-build/graph-digest.js';
import {graphViewSpace} from '../test-build/plan-graph-view.js';
import {DemandSpaceModels} from '../test-build/demand-space-models.js';
import {wallGraphSource} from '../test-build/wall-graph-source.js';
import * as Q from '../test-build/plan-exact.js';
import {harness,scenarios} from './helpers/geometry-commit-harness.mjs';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/1216-contact-corpus.json',import.meta.url))),cases=corpus.cases;
test('256 independently witnessed contact seeds: parity, required incidence, R and metamorphisms',()=>{
 for(const row of cases){
  const {space,witness}=row;
  assert.ok(space.partitions.length<=32);
  assert.ok(Math.hypot(...witness.owner.map((v,i)=>v-witness.host[i]))<=witness.radius);
  const result=migrateGraphSpace(space,{sourceModelVersion:10});
  assert.equal(graphDigest(result.graph),row.expected_digest,'canonical parity vector '+row.seed);
  assert.equal(validateGraph(result.graph).ok,true);assert.ok(result.migrationReport.maxDisplacementCm<=.001000000001);
  assert.equal(applyGraphOperation(result.graph,{kind:'normalize-current'}).changed,false);
  if(witness.required){
   const nodesFor=id=>new Set(result.mapping.edges['partition:'+id].flatMap(range=>{
    const edge=result.graph.edges.find(e=>edgeKey(e)===edgeKey(range.ref));return[edge.from,edge.to];
   }));
   const a=nodesFor('a'),b=nodesFor('b');
   assert.ok([...a].some(id=>b.has(id)&&Q.withinRadius(Q.decodePoint(result.graph.nodes.find(n=>n.id===id).p),Q.readSourcePoint(witness.owner),Q.microRadius(5))),'required contact '+row.seed);
  }
  const reversed=structuredClone(space);reversed.partitions.reverse();for(const edge of reversed.partitions)[edge.a,edge.b]=[edge.b,edge.a];
  assert.equal(graphDigest(migrateGraphSpace(reversed,{sourceModelVersion:10}).graph),row.expected_digest,'reversal/permutation '+row.seed);
 }
});
test('diagnostic codec is UTF8 codepoint ordered and excludes opaque props',()=>{
 const graph={version:1,nodes:[{id:'😀',p:['l','2','0']},{id:'\ue000',p:['l','1','0']},{id:'a',p:['l','0','0']}],edges:[],rooms:[],dependencies:[]};
 const expected='[[["a",["l","0","0"]],["",["l","1","0"]],["😀",["l","2","0"]]],[],[],[]]';
 assert.equal(graphDigestBytes(graph),expected);assert.equal(graphDigest(graph),createHash('sha256').update(expected).digest('hex'));
 const fixture=migrateGraphSpace(cases[0].space).graph,copy=structuredClone(fixture);copy.edges[0].props={private:'excluded'};
 assert.equal(graphDigest(copy),graphDigest(fixture));
});

test('room contacts retain closed cycles after derived same-carrier cuts coalesce',()=>{
 for(const row of corpus.room_cases){
  const original=JSON.stringify(row.space);
  const owners=[...row.space.rooms.flatMap(r=>r.poly),...row.space.wall_segments.flatMap(e=>[e.a,e.b])];
  for(const p of owners)assert.ok(row.witness.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<=1/1200000));
  const result=migrateGraphSpace(row.space,{sourceModelVersion:10});
  assert.equal(validateGraph(result.graph).ok,true);assert.equal(graphDigest(result.graph),row.expected_digest);
  assert.ok(result.migrationReport.maxDisplacementCm<=.001000000001);assert.equal(JSON.stringify(row.space),original);
  const permuted=structuredClone(row.space);permuted.rooms.reverse();permuted.wall_segments.reverse();
  assert.equal(graphDigest(migrateGraphSpace(permuted,{sourceModelVersion:10}).graph),row.expected_digest);
 }
 const bad={id:'bad',rooms:[{id:'bow',poly:[[0,0],[1,1],[0,1],[1,0]]}]},snapshot=JSON.stringify(bad);
 assert.throws(()=>migrateGraphSpace(bad),/plan-graph:/);assert.equal(JSON.stringify(bad),snapshot);
});
test('nested/overlapping room read order is canonical ID order for layers and hit ownership',()=>{
 const room=(id,x,size)=>({id,name:id,poly:[[x,x],[x+size,x],[x+size,x+size],[x,x+size]]});
 const result=migrateGraphSpace({id:'s',rooms:[room('z',0,2),room('a',.25,1)]});
 const view=graphViewSpace(result.space);
 assert.deepEqual(view.rooms.map(r=>r.id),['a','z']);assert.deepEqual(view.rooms.map(r=>r.name),['a','z']);
 assert.deepEqual(graphViewSpace({...result.space,rooms:result.space.rooms.toReversed()}).rooms,view.rooms);
 const demand=new DemandSpaceModels(),config={model_version:11,spaces:[{...result.space,rooms:result.space.rooms.toReversed()}]};
 const model=demand.read(config)[0];
 assert.deepEqual(model.rooms.map(r=>r.id),['a','z']);assert.equal(demand.work.builds,0,'graph authority does not eagerly build geometry');
 assert.equal(wallGraphSource(model.rooms).graph,config.spaces[0].plan_graph);assert.equal(wallGraphSource(model.rooms).scale,1000);
 const h=harness();h.host._spaceModel=()=>({rooms:view.rooms});
 assert.equal(h.runtime._roomAt([.5,.5]).id,'a','strict lookup keeps its existing first-match ownership');
 assert.equal(view.rooms.toReversed().find(r=>h.runtime._pointInRoom([.5,.5],r)).id,'z','selection keeps its existing reverse-layer ownership');
});

test('real commit boundary accepts explicit thickness and independent-column metadata with shared normalized geometry',()=>{
 for(const kind of ['thickness','column']){
  const h=harness(),before=h.runtime._geometrySnapshot('f');
  scenarios[kind](h.host._serverCfg.spaces[0]);
  const intent=kind==='thickness'?{kind:'thickness',rooms:['f-r'],cm:20}:{kind:'metadata'};
  assert.equal(h.runtime._commitPhysicalGeometry(kind,before,[],true,intent),true,JSON.stringify(h.toasts));
  assert.equal(h.history.length,1);assert.ok(h.counts.preflight>0);
  assert.equal(h.host._serverCfg.model_version,11);
 }
});
