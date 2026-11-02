import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateGraphSpace, projectGraphSpace } from '../test-build/plan-graph.js';
import { graphViewSpace } from '../test-build/plan-graph-view.js';
import { structuralWallNodes, prepareNodeMove, applyNodeMove } from '../test-build/wall-node-move.js';
import { createSpaceCopyCandidate } from '../test-build/space-copy.js';
import { decodePoint, pointToNumbers } from '../test-build/plan-exact.js';

const legacy = () => ({ id:'floor',title:'Floor',view_box:[0,0,1,1],cell_cm:5,rooms:[],
  partitions:[{id:'part',a:[0,0],b:[1/3,0],cm:12,custom:{retained:true}}],
  openings:[{id:'door',type:'door',x:1/9,y:0,angle:0,length:.05,
    host:{kind:'partition',id:'part',t:1/3}}] });

test('graph read ignores stale numeric carriers and never writes its source', () => {
  const current = migrateGraphSpace(legacy(),{sourceModelVersion:10}).space;
  const source = structuredClone(current);
  current.partitions[0].b=[9,9];
  const frozen = JSON.stringify(current);
  const view = graphViewSpace(current);
  assert.deepEqual(view.partitions,source.partitions);
  assert.equal(JSON.stringify(current),frozen);
  assert.equal(graphViewSpace(current).partitions,view.partitions,'accepted graph projection is memoized');
});

test('copied graph remaps every reference while keeping exact values and opaque edge props', () => {
  const space = migrateGraphSpace(legacy(),{sourceModelVersion:10}).space;
  const config={model_version:11,spaces:[space],markers:[],settings:{}};
  const original=JSON.stringify(config);
  const {space:copy}=createSpaceCopyCandidate(config,'floor','Copy','graph');
  assert.equal(JSON.stringify(config),original);
  const sourceIds=new Set(space.plan_graph.nodes.map(node=>node.id));
  assert.ok(copy.plan_graph.nodes.every(node=>!sourceIds.has(node.id)));
  assert.deepEqual(copy.plan_graph.nodes.map(node=>node.p),space.plan_graph.nodes.map(node=>node.p));
  assert.deepEqual(copy.partitions[0].custom,{retained:true});
  assert.deepEqual(copy.openings[0].host.tq,space.openings[0].host.tq);
  assert.notEqual(copy.openings[0].host.id,space.openings[0].host.id);
  assert.deepEqual(projectGraphSpace(copy,copy.plan_graph).space,copy);
});

test('node handles use graph identity for intentionally coincident detached endpoints', () => {
  const space=migrateGraphSpace({...legacy(),openings:[]},{sourceModelVersion:10}).space;
  const graph=structuredClone(space.plan_graph);
  const edge=graph.edges[0],node=graph.nodes.find(n=>n.id===edge.from);
  graph.nodes.push({id:'detached',p:structuredClone(node.p)},{id:'remote',p:['l','0','240']});
  graph.edges.push({id:'separate',kind:'partition',from:'detached',to:'remote',cm:12});
  const projected=projectGraphSpace(space,graph).space;
  const handles=structuralWallNodes(projected).filter(n=>n.point[0]===0&&n.point[1]===0);
  assert.equal(handles.length,2);
  assert.deepEqual(new Set(handles.map(n=>n.nodeId)),new Set([node.id,'detached']));
  assert.ok(handles.every(n=>n.walls.length===1));
});

test('a current node move updates stable graph identity and exact opening host', () => {
  const space=migrateGraphSpace(legacy(),{sourceModelVersion:10}).space;
  const nodes=structuralWallNodes(space),node=nodes.find(node=>node.point[0]>0);
  const result=applyNodeMove(prepareNodeMove(space,node,nodes),[.5,0],null);
  assert.equal(result.ok,true);
  assert.deepEqual(result.space.plan_graph.nodes.find(n=>n.id===node.nodeId).p,['l','120','0']);
  assert.deepEqual(result.space.plan_graph.edges.map(e=>[e.kind,e.id]),space.plan_graph.edges.map(e=>[e.kind,e.id]));
  assert.ok(result.space.openings[0].host.tq);
  assert.deepEqual(projectGraphSpace(result.space,result.space.plan_graph).space,result.space);
  assert.deepEqual(pointToNumbers(decodePoint(result.space.plan_graph.nodes.find(n=>n.id===node.nodeId).p)),[.5,0]);
});
