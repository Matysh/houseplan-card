import test from 'node:test';
import assert from 'node:assert/strict';
import { largeFixture, largeScenarios, harness, square } from './helpers/geometry-commit-harness.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { commitGraphEditResult } from '../test-build/graph-edit-intent.js';
import { graphIndex, edgeKey, validateGraph } from '../test-build/plan-graph.js';

const minimal = () => commitWallSegmentModel({ model_version: 10, spaces: [{ id:'f',cell_cm:1,
  rooms:[square('left').rooms[0],square('right',2).rooms[0]],
}], markers:[],settings:{} }).config;

for (const [name, fixture] of [['minimal',minimal],['146-room',largeFixture]])
test(`#1231 ${name}: splitting the named room retains its neighbour, shared wall and exact history`, () => {
  const config=fixture(), before=structuredClone(config), space=config.spaces[0];
  const index=graphIndex(space.plan_graph);
  const shared=space.plan_graph.edges.find(e=>index.owners.get(edgeKey(e))?.includes('left-r')
    && index.owners.get(edgeKey(e))?.includes('right-r'));
  assert.ok(shared,'fixture really has two owners of one physical wall');
  const draft=structuredClone(space);largeScenarios.split(draft);
  const result=commitGraphEditResult(space,draft,{kind:'faces',rooms:['left-r','split-b']});
  assert.equal(result.graph.rooms.length,space.rooms.length+1);
  assert.equal(validateGraph(result.graph).ok,true);
  assert.deepEqual(result.graph.edges.find(e=>edgeKey(e)===edgeKey(shared)),shared);
  assert.deepEqual(graphIndex(result.graph).owners.get(edgeKey(shared)).slice().sort(),['right-r','split-b']);
  for(const neighbour of space.rooms.filter(r=>r.id!=='left-r'))
    assert.deepEqual(result.space.rooms.find(r=>r.id===neighbour.id),neighbour);
  assert.deepEqual(config,before,'preparation never mutates accepted input');
  const h=harness(config), snapshot=h.runtime._geometrySnapshot('f');
  Object.assign(h.host._serverCfg.spaces[0],result.space);
  assert.equal(h.runtime._commitPhysicalGeometry('Split',snapshot,[],true,{kind:'prepared',base:space.plan_graph}),true);
  const after=h.runtime._geometrySnapshot('f'), saved=structuredClone(h.host._serverCfg);
  assert.deepEqual(commitWallSegmentModel(saved).config,saved);
  assert.equal(h.runtime._restoreGeometryStateInConfig(h.host._serverCfg,snapshot),true);
  assert.deepEqual(h.host._serverCfg,before,'Undo content restores exact pre-split graph');
  assert.equal(h.runtime._restoreGeometryStateInConfig(h.host._serverCfg,after),true);
  assert.deepEqual(h.host._serverCfg,saved,'Redo content restores exact accepted result');
  assert.equal(h.history.length,1);
});

test('#1231 a real third owner and the original index-based overlay remain refused atomically', () => {
  const sp=largeFixture().spaces[0], original=structuredClone(sp);
  assert.equal(sp.rooms[0].id,'grid-0-0-r','canonical fixture order exposes the original indexing mistake');
  const draft=structuredClone(sp), parent=draft.rooms[0];
  draft.rooms.splice(0,1,{...parent,poly:[[0,0],[1,0],[1,2],[0,2]]},{id:'split-b',poly:[[1,0],[2,0],[2,2],[1,2]]});
  assert.throws(()=>commitGraphEditResult(sp,draft,{kind:'faces',rooms:[parent.id,'split-b']}),/third-owner/);
  const triple=structuredClone(sp);triple.rooms.push({...structuredClone(sp.rooms.find(r=>r.id==='left-r')),id:'third'});
  assert.throws(()=>commitGraphEditResult(sp,triple,{kind:'faces',rooms:['third']}),/third-owner/);
  assert.deepEqual(sp,original);
});
