import test from 'node:test';
import assert from 'node:assert/strict';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyGraphOperation, applyGraphPatch, projectGraphSpace } from '../test-build/plan-graph.js';
import { legacyGraphWriteChange } from '../test-build/graph-write-change.js';
import { commitGraphEdit } from '../test-build/graph-edit-intent.js';
import { graphDigest } from '../test-build/graph-digest.js';

const legacy = () => ({model_version:10,settings:{},markers:[],spaces:[{
  id:'floor',title:'Floor',view_box:[0,0,1,1],rooms:[],
  partitions:[{id:'part',a:[.00000000000001,0],b:[.5,0],cm:12}],
}]});

test('first wall thickness selection binds the named legacy side after bounded normalization without a catalogue',()=>{
  const raw={id:'floor',rooms:[{id:'room',poly:[[0,0],[.5000002,0],[.5000002,1],[0,1]]}]};
  const baseline=commitWallSegmentModel({spaces:[raw]}).config.spaces[0];
  const changed=commitGraphEdit(baseline,baseline,{kind:'thickness',cm:20,
    selection:{room:'room',a:[.5000002,0],b:[.5000002,1]}},raw);
  const thick=changed.wall_segments.filter(edge=>edge.cm===20);
  assert.equal(thick.length,1);
  assert.deepEqual(thick[0].a,[.5,0]); assert.deepEqual(thick[0].b,[.5,1]);
  assert.equal(changed.plan_graph.edges.length,baseline.plan_graph.edges.length);
  assert.ok(baseline.plan_graph.edges.every(edge=>edge.cm===0));
});

test('first write patch is rooted in the accepted pre-gesture normalized graph',()=>{
  const source=legacy(),sourceText=JSON.stringify(source);
  const normalized=commitWallSegmentModel(source).config,space=normalized.spaces[0];
  const edge=space.plan_graph.edges[0];
  const changed=applyGraphOperation(space.plan_graph,{kind:'move-node',node:edge.to,target:['l','144','0']});
  const candidate=structuredClone(normalized);
  candidate.spaces[0]=projectGraphSpace(space,changed.graph).space;
  const delta=legacyGraphWriteChange(source,candidate);
  assert.equal(JSON.stringify(source),sourceText);
  assert.equal(delta.version,2);assert.equal(delta.spaces[0].base_digest,graphDigest(space.plan_graph));
  assert.ok(!('base' in delta.spaces[0]),'no duplicate full baseline');
  assert.deepEqual(applyGraphPatch(space.plan_graph,delta.spaces[0].patch).graph,changed.graph);
  assert.deepEqual(delta.spaces[0].patch.nodes.set,[changed.graph.nodes.find(node=>node.id===edge.to)]);
});

test('first write patch includes all queued explicit graph commands, not only the last gesture',()=>{
  const source=legacy(),candidate=commitWallSegmentModel(source).config,space=candidate.spaces[0];
  const edge=space.plan_graph.edges[0];
  const changed=applyGraphOperation(space.plan_graph,{kind:'batch',operations:[
    {kind:'move-node',node:edge.to,target:['l','144','0']},
    {kind:'set-thickness',edges:[{kind:edge.kind,id:edge.id}],cm:20},
  ]});
  candidate.spaces[0]=projectGraphSpace(space,changed.graph).space;
  const delta=legacyGraphWriteChange(source,candidate);
  assert.equal(delta.spaces[0].patch.nodes.set.length,1);
  assert.equal(delta.spaces[0].patch.edges.set[0].cm,20);
  assert.deepEqual(applyGraphPatch(space.plan_graph,delta.spaces[0].patch).graph,changed.graph);
  assert.equal(legacyGraphWriteChange(candidate,candidate),undefined,'current saves do not normalize again');
});

test('older backend without graph_change_api 2 retains the v1 diagnostic-base transport',()=>{
 const source=legacy(),candidate=commitWallSegmentModel(source).config;
 const v1=legacyGraphWriteChange(source,candidate,1),v2=legacyGraphWriteChange(source,candidate,2);
 assert.equal(v1.version,1);assert.deepEqual(v1.spaces[0].base,candidate.spaces[0].plan_graph);
 assert.equal(v2.version,2);assert.ok(!('base' in v2.spaces[0]));assert.deepEqual(v1.spaces[0].patch,v2.spaces[0].patch);
 assert.ok(JSON.stringify(v2).length<JSON.stringify(v1).length);
});
