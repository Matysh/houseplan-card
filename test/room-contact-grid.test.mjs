import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWallFaceGraph,findWallFaceAtPoint} from '../test-build/wall-face-graph.js';
import {commitWallSegmentModel,wallModelOffGridValueCount} from '../test-build/wall-segment-model.js';
import {inheritedY,roomSource,graphSources} from './helpers/room-contact-grid.mjs';

for(const x of [0.375,0.625])test(`#1061 existing face ${x} keeps the inherited scalar through materialization`,()=>{
  const before=roomSource(),space=before.spaces[0];
  assert.equal(wallModelOffGridValueCount(space),1);
  const snapshot=structuredClone(before);
  const face=findWallFaceAtPoint(buildWallFaceGraph(graphSources(space),1000/240*0.0002),[x*1000,150]);
  assert.ok(face);
  const after=structuredClone(before);
  after.spaces[0].rooms.push({id:'new',name:'New',area:null,poly:face.ring.map(p=>p.map(n=>n/1000))});
  const committed=commitWallSegmentModel(after).config;
  assert.equal(wallModelOffGridValueCount(committed.spaces[0]),1,'no rounded new off-grid debt');
  assert.ok(committed.spaces[0].rooms.find(r=>r.id==='new').poly.some(p=>p[1]===inheritedY));
  assert.deepEqual(before,snapshot);
});

test('#1061 exact persisted rings ignore source order/direction and keep inherited lineage',()=>{
  const config=roomSource(),sources=graphSources(config.spaces[0]);
  const original=buildWallFaceGraph(sources,1000/240*0.0002);
  const reversed=buildWallFaceGraph(sources.toReversed().map(p=>({...p,a:p.b,b:p.a})),1000/240*0.0002);
  assert.deepEqual(reversed.faces,original.faces);
  assert.equal(original.faces.length,3);
  let current=structuredClone(config);
  for(const [i,x]of [0.375,0.625].entries()){
    const face=findWallFaceAtPoint(original,[x*1000,150]);
    current.spaces[0].rooms.push({id:`new${i}`,name:'New',area:null,poly:face.ring.map(p=>p.map(n=>n/1000))});
    current=commitWallSegmentModel(current).config;
    assert.equal(wallModelOffGridValueCount(current.spaces[0]),1);
    assert.deepEqual(current.spaces[0].rooms.find(r=>r.id==='old'),config.spaces[0].rooms[0]);
    for(const old of config.spaces[0].wall_segments)
      assert.deepEqual(current.spaces[0].wall_segments.find(w=>w.id===old.id),old);
  }
  assert.equal(current.spaces[0].rooms.length,3);
});

test('#1061 a topology-close conflicting authored endpoint is not moved into a closed face',()=>{
  const s=[{key:'top',a:[0,0],b:[100,0]},
    {key:'right',a:[100,0],b:[100,100]},
    {key:'bottom',a:[100,100],b:[0,100]},
    {key:'left',a:[0,100],b:[0,0.0004]}];
  assert.equal(buildWallFaceGraph(s,0.001).faces.length,0);
  assert.equal(buildWallFaceGraph(s.toReversed(),0.001).faces.length,0);
});

test('#1061 T/overlap cuts keep the exact incident endpoint rather than topology-rounded y',()=>{
  const space=roomSource().spaces[0],s=graphSources(space);
  s.push({key:'overlap',a:[300,inheritedY*1000],b:[700,inheritedY*1000]});
  const graph=buildWallFaceGraph(s,1000/240*0.0002);
  assert.equal(graph.faces.length,3);
  for(const face of graph.faces)for(const point of face.ring)
    assert.ok(point[1]===0||point[1]===inheritedY*1000);
});
