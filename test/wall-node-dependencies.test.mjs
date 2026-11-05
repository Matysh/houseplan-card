import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectGraphSpace} from '../test-build/plan-graph.js';
import {structuralWallNodes,prepareNodeMove,applyNodeMove} from '../test-build/wall-node-move.js';
import {decodePoint,pointToNumbers} from '../test-build/plan-exact.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/1303-bent-carrier.json',import.meta.url)));
const spaceFor=graph=>projectGraphSpace({id:'floor',title:'Floor',cell_cm:1,rooms:[],openings:[]},graph).space;
const move=(space,id,target,axis=null)=>{
  const nodes=structuralWallNodes(space),node=nodes.find(n=>n.nodeId===id);
  return applyNodeMove(prepareNodeMove(space,node,nodes),target,axis);
};
const points=graph=>new Map(graph.nodes.map(n=>[n.id,n.p]));
const unchangedExcept=(before,after,id)=>{
  const old=points(before);
  for(const n of after.nodes)if(n.id!==id)assert.deepEqual(n.p,old.get(n.id),`${n.id} stays exact`);
};

test('#1303 saved bent carrier cannot pull a node beyond the fixed neighbour',()=>{
  const space=spaceFor(fixture),original=structuredClone(space);
  const start=pointToNumbers(decodePoint(points(fixture).get('drag-end')));
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[12,0],[0,12],[267,173]]){
    const result=move(space,'drag-end',[start[0]+dx/240,start[1]+dy/240]);
    assert.equal(result.ok,true,JSON.stringify({dx,dy,result}));
    unchangedExcept(fixture,result.space.plan_graph,'drag-end');
    assert.ok(!result.space.plan_graph.dependencies.some(d=>d.node==='junction'),'retire the broken carrier, including an axial target');
    assert.deepEqual(result.space.plan_graph.dependencies.find(d=>d.node==='bend'),fixture.dependencies.find(d=>d.node==='bend'));
  }
  assert.deepEqual(space,original,'source and frozen baseline never mutate');
});

const crossing=()=>{
  const node=(id,x,y)=>({id,p:['l',String(x*240),String(y*240)]});
  const edge=(id,from,to)=>({id,kind:'partition',from,to,cm:15});
  return {version:1,nodes:[node('p',0,0),node('c',1,0),node('a',2,0),node('b',3,0),node('d',2,-2),node('e',2,2),node('f',1,-1)],
    edges:[edge('pc','p','c'),edge('ca','c','a'),edge('ab','a','b'),edge('da','d','a'),edge('ae','a','e'),edge('fc','f','c')],rooms:[],
    dependencies:[{node:'c',kind:'on-edge',refs:[{from:'p',to:'b'}],parameters:[['1','3']]},
      {node:'a',kind:'intersection',refs:[{from:'p',to:'b'},{from:'d',to:'e'}],parameters:[['2','3'],['1','2']]}]};
};

test('#1303 bending a split carrier retires its old far constraint before the next gesture',()=>{
  const graph=crossing(),space=spaceFor(graph),nodes=structuralWallNodes(space),node=nodes.find(n=>n.nodeId==='a');
  const axis=node.axes.find(a=>Math.abs(a.direction[0])<1e-9).key;
  const bent=move(space,'a',[2,.25],axis);
  assert.equal(bent.ok,true);
  unchangedExcept(graph,bent.space.plan_graph,'a');
  assert.ok(!bent.space.plan_graph.dependencies.some(d=>d.node==='c'));
  assert.equal(bent.space.plan_graph.dependencies.find(d=>d.node==='a').kind,'on-edge','retain the genuine vertical carrier');
  const later=move(bent.space,'b',[3.25,0]);
  assert.equal(later.ok,true);
  unchangedExcept(bent.space.plan_graph,later.space.plan_graph,'b');
});

test('#1303 axial endpoint movement preserves exact far nodes and retargets valid T/intersection parameters',()=>{
  const graph=crossing(),result=move(spaceFor(graph),'b',[4,0]);
  assert.equal(result.ok,true);
  unchangedExcept(graph,result.space.plan_graph,'b');
  assert.deepEqual(result.space.plan_graph.dependencies.find(d=>d.node==='c').parameters,[['1','4']]);
  assert.deepEqual(result.space.plan_graph.dependencies.find(d=>d.node==='a').parameters,[['1','2'],['1','2']]);
});
