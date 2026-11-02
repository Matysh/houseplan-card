import test from 'node:test';
import assert from 'node:assert/strict';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyGraphOperation, applyGraphPatch, projectGraphSpace } from '../test-build/plan-graph.js';
import { legacyGraphWriteChange } from '../test-build/graph-write-change.js';

const legacy = () => ({model_version:10,settings:{},markers:[],spaces:[{
  id:'floor',title:'Floor',view_box:[0,0,1,1],rooms:[],
  partitions:[{id:'part',a:[.00000000000001,0],b:[.5,0],cm:12}],
}]});

test('first write patch is rooted in the accepted pre-gesture normalized graph',()=>{
  const source=legacy(),sourceText=JSON.stringify(source);
  const normalized=commitWallSegmentModel(source).config,space=normalized.spaces[0];
  const edge=space.plan_graph.edges[0];
  const changed=applyGraphOperation(space.plan_graph,{kind:'move-node',node:edge.to,target:['l','144','0']});
  const candidate=structuredClone(normalized);
  candidate.spaces[0]=projectGraphSpace(space,changed.graph).space;
  const delta=legacyGraphWriteChange(source,candidate);
  assert.equal(JSON.stringify(source),sourceText);
  assert.deepEqual(delta.spaces[0].base,space.plan_graph);
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
  assert.deepEqual(applyGraphPatch(delta.spaces[0].base,delta.spaces[0].patch).graph,changed.graph);
  assert.equal(legacyGraphWriteChange(candidate,candidate),undefined,'current saves do not normalize again');
});
