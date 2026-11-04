import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { validateGraph, applyGraphOperation } from '../test-build/plan-graph.js';
import { fullConfigSha256 } from './helpers/wall-identity-corpus.mjs';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { roomContactCases } from './helpers/room-contact-cases.mjs';

test('an unbound opening never impersonates a bare host, while malformed bare hosts still refuse', () => {
  const graph={version:1,nodes:[{id:'a',p:['l','0','0']},{id:'b',p:['l','240','0']}],
    edges:[{kind:'wall',id:'w',from:'a',to:'b',cm:15}],rooms:[],dependencies:[]};
  const unbound={id:'opening',type:'door',x:.5,y:0,length:.1,angle:0};
  assert.equal(validateGraph(graph,{hosts:[unbound]}).ok,true);
  const moved=applyGraphOperation(graph,{kind:'move-node',node:'b',target:['l','240','1']},{hosts:[unbound]});
  assert.deepEqual(Object.keys(moved.mapping.hosts),[]);
  for(const host of [
    {kind:'wall',id:'missing',t:.5,x:0,y:0,length:.1},
    {kind:'wall',id:'w',t:2,x:0,y:0,length:.1},
    {kind:'wall',id:'w',t:.5,tq:['1','3'],x:0,y:0,length:.1},
  ]) {
    assert.equal(validateGraph(graph,{hosts:[host]}).ok,false);
    assert.throws(()=>applyGraphOperation(graph,{kind:'move-node',node:'b',target:['l','240','1']},{hosts:[host]}));
  }
});

test('the historical 478 positive has a complete independent current target with both 0cm and 22cm carriers', () => {
  const source=JSON.parse(readFileSync(new URL('./fixtures/478-room-draft-migration-vectors.json',import.meta.url))).accepted;
  const before=structuredClone(source.input);
  const [existing,free,zero,reverse]=source.expected_partitions;
  const node=(id,side)=>'n:'+encodeURIComponent(JSON.stringify(['partition',id,side]));
  const id0=node(zero.id,0),id1=node(zero.id,1);
  const graph={version:1,nodes:[
    {id:node(existing.id,0),p:['l','480','0']}, {id:node(existing.id,1),p:['l','720','0']},
    {id:id0,p:['l','60','0']}, {id:id1,p:['l','120','0']}, {id:node(free.id,0),p:['l','0','0']},
  ],edges:[
    {id:existing.id,kind:'partition',from:node(existing.id,0),to:node(existing.id,1),cm:10},
    {id:zero.id,kind:'partition',from:id0,to:id1,cm:0},
    {id:free.id,kind:'partition',from:node(free.id,0),to:id0,cm:15},
    {id:reverse.id,kind:'partition',from:id0,to:id1,cm:22},
  ],rooms:[],dependencies:[]};
  const order=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
  graph.nodes.sort(order);graph.edges.sort(order);
  const target={model_version:11,markers:[],settings:{},spaces:[{id:'floor',title:'Floor',rooms:[],
    wall_segments:[],partitions:source.expected_partitions.map(p=>({...p,
      a:p.a[0]<p.b[0]?p.a:p.b,b:p.a[0]<p.b[0]?p.b:p.a})).sort(order),walls:[],plan_graph:graph}]};
  assert.equal(validateGraph(graph).ok,true);
  assert.equal(fullConfigSha256(target),'d7088b18d4c56ef8d962c74de7f07bd3148bf376cfff085f2a493948a03d8b17');
  assert.deepEqual(commitWallSegmentModel(source.input).config,target);
  assert.deepEqual(source.input,before);
  assert.deepEqual(commitWallSegmentModel(target).config,target);
});

test('1166 Optimize reaches the declared lattice targets while preserving named support references', () => {
  const exported=JSON.parse(readFileSync(new URL('./fixtures/1166-two-contours.json',import.meta.url)));
  const input={...exported.payload.config,model_version:exported.model_version};
  const before=commitWallSegmentModel(input).config.spaces[0].plan_graph;
  const result=optimizePlans(input,{});
  const graph=result.config.spaces[0].plan_graph;
  const id='n:'+encodeURIComponent(JSON.stringify(['partition','partition-8be3ef18-fc09-486d-b36a-7f206cacb19f',1]));
  assert.deepEqual(graph.nodes.find(n=>n.id===id).p,['l','15','67']);
  const dependency=graph.dependencies.find(d=>d.node===id);
  assert.deepEqual(dependency.parameters,[['2','3']]);
  assert.deepEqual(dependency.refs,before.dependencies.find(d=>d.node===id).refs);
  assert.equal(optimizePlans(result.config,result.layout).changed,false);

  const cavity=roomContactCases().find(c=>c.name==='existing-wall-cavity').config;
  const cavityBefore=structuredClone(cavity),original=cavity.spaces[0].plan_graph;
  // #1282's migration writers already restore these .3 arithmetic echoes to
  // exact lattice points; Optimize must retain their identities and incidence.
  const targets=[
    {p:['l','120','72'],target:['l','120','72']},
    {p:['l','72','72'],target:['l','72','72']},
  ];
  const fixed=optimizePlans(cavity,{}),out=fixed.config.spaces[0].plan_graph;
  for(const {p,target} of targets) {
    const nodes=original.nodes.filter(n=>JSON.stringify(n.p)===JSON.stringify(p));
    assert.equal(nodes.length,1,'the literal identifies exactly one original source node');
    assert.deepEqual(out.nodes.find(n=>n.id===nodes[0].id).p,target);
  }
  assert.deepEqual(out.edges,original.edges,'no carrier identity, incidence or material is rewritten');
  assert.deepEqual(out.rooms,original.rooms);
  assert.deepEqual(out.dependencies,original.dependencies.map(d=>({...d,parameters:d.parameters.map(q=>
    JSON.stringify(q)==='["1666666666666667","5000000000000000"]'?['1','3']:q)})));
  assert.deepEqual(cavity,cavityBefore);
  assert.equal(optimizePlans(fixed.config,fixed.layout).changed,false);
});
