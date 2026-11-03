// Read-only synthetic current-graph repro; run manually from the repository root.
// node docs/testing/issue1226/repros/explicit-delete-unhosted-opening.mjs
import assert from 'node:assert/strict';
import {commitWallSegmentModel} from '../../../../test-build/wall-segment-model.js';
import {commitGraphEditResult} from '../../../../test-build/graph-edit-intent.js';
import {validateGraph} from '../../../../test-build/plan-graph.js';
const input={model_version:9,spaces:[{id:'f',cell_cm:5,
  rooms:[{id:'r',poly:[[.1,.1],[.5,.1],[.5,.5],[.1,.5]]}],
  partitions:[{id:'p',a:[.2,.7],b:[.4,.7],cm:15}],
  openings:[{id:'unhosted',type:'door',x:.3,y:.1,angle:0,length:.1},
    {id:'hosted',type:'door',x:.3,y:.7,angle:0,length:.1,host:{kind:'partition',id:'p',t:.5}}],
}],markers:[],settings:{}};
const before=commitWallSegmentModel(input).config.spaces[0], draft=structuredClone(before);
assert.equal(validateGraph(before.plan_graph).ok,true);
assert.equal(before.openings.find(o=>o.id==='unhosted').host,undefined);
draft.partitions=[];draft.openings=draft.openings.filter(o=>o.id!=='hosted');
assert.doesNotThrow(()=>commitGraphEditResult(before,draft,{kind:'partitions',ids:['p']}),
  'a valid unhosted opening unrelated to the deleted partition is not an EdgeRef');