import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {optimizePlans} from '../test-build/plan-optimizer.js';
import {migrateGraphSpace,projectGraphSpace,applyGraphOperation} from '../test-build/plan-graph.js';
import {decodePoint,encodePoint,exact,pointAt} from '../test-build/plan-exact.js';

function affineSpace(horizontal) {
  const end=horizontal?['l','241','0']:['l','240','121'];
  const point=encodePoint(pointAt(decodePoint(['l','0','0']),decodePoint(end),exact(1n,3n)));
  const graph={version:1,nodes:[{id:'a',p:['l','0','0']},{id:'b',p:end},{id:'t',p:point},
    {id:'e',p:horizontal?['l','120','120']:['l','108','192']}],
    edges:[{kind:'partition',id:'at',from:'a',to:'t',cm:15},
      {kind:'partition',id:'tb',from:'t',to:'b',cm:15},
      {kind:'partition',id:'te',from:'t',to:'e',cm:15}],rooms:[],
    dependencies:[{node:'t',kind:'on-edge',refs:[{from:'a',to:'b'}],parameters:[['1','3']]}]};
  if(horizontal) {
    // Three incident axes freeze this component's numerical grid proposal.
    // Its genuine off-lattice third must still follow its horizontal support.
    graph.nodes.push({id:'f',p:['l','192','216']});
    graph.edges.push({kind:'partition',id:'tf',from:'t',to:'f',cm:15});
  }
  return projectGraphSpace({id:'affine',cell_cm:1,rooms:[]},graph).space;
}

for(const horizontal of [false,true])for(const sameFloor of [false,true]) {
  test(`1260 near-axis repair preserves the unrelated ${horizontal?'horizontal':'inclined'} affine support on ${sameFloor?'the same':'another'} floor`,()=>{
    const affine=affineSpace(horizontal);
    const fixture=JSON.parse(readFileSync(new URL('../test/fixtures/279-near-orthogonal-junction.json',import.meta.url)));
    const near=migrateGraphSpace({id:'repair',...fixture},{sourceModelVersion:10}).space;
    const spaces=sameFloor?[projectGraphSpace({...affine,rooms:near.rooms},{version:1,
      nodes:[...affine.plan_graph.nodes,...near.plan_graph.nodes],
      edges:[...affine.plan_graph.edges,...near.plan_graph.edges],
      rooms:near.plan_graph.rooms,
      dependencies:[...affine.plan_graph.dependencies,...near.plan_graph.dependencies]}).space]:[affine,near];
    const input={model_version:11,spaces,markers:[],settings:{}},source=structuredClone(input);
    const result=optimizePlans(input,{}),graph=result.config.spaces[0].plan_graph;
    assert.ok(result.report.wallsStraightened>0,'the unrelated repair really ran');
    assert.deepEqual(graph.dependencies.find(d=>d.node==='t'),affine.plan_graph.dependencies[0]);
    assert.deepEqual(graph.nodes.find(n=>n.id==='t').p,affine.plan_graph.nodes.find(n=>n.id==='t').p);
    assert.deepEqual(input,source);
    const again=optimizePlans(result.config,result.layout);
    assert.equal(again.changed,false);assert.deepEqual(again.config,result.config);
    const target=horizontal?['l','482','0']:['l','480','242'];
    const moved=applyGraphOperation(graph,{kind:'move-node',node:'b',target}).graph;
    assert.deepEqual(moved.nodes.find(n=>n.id==='t').p,
      encodePoint(pointAt(decodePoint(['l','0','0']),decodePoint(target),exact(1n,3n))),
      'a later support move still carries its exact dependent T node');
  });
}
