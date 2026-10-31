import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildWallFaceGraph,findWallFaceAtPoint} from '../test-build/wall-face-graph.js';
import {spaceModels,GRID_PITCH,NORM_W} from '../test-build/space-geometry.js';
import {buildPlanSnapGeometry} from '../test-build/plan-snap-overlay.js';
import {optimizePlans} from '../test-build/plan-optimizer.js';
import {commitWallSegmentModel,wallModelOffGridValueCount} from '../test-build/wall-segment-model.js';
import {checkOptimizeGeometry} from '../test-build/plan-geometry-preflight.js';
import {wallFaceProvenPoints,storedWallContact} from '../test-build/stored-wall-contact.js';

const bytes=fs.readFileSync(new URL('./fixtures/1166-two-contours.json',import.meta.url));
const exported=JSON.parse(bytes);
const source=()=>({...structuredClone(exported.payload.config),model_version:exported.model_version});
const epsilon=GRID_PITCH*.0002;
function graph(config){
  const space=spaceModels(config)[0];
  return buildWallFaceGraph(buildPlanSnapGeometry({space,epsilon}).segments.map(s=>({a:s.a,b:s.b,key:s.key,contour:s.sourceKind==='room'})),epsilon);
}
function both(config){
  const g=graph(config);
  assert.equal(g.faces.length,2);
  for(const p of [[350,400],[-200,1240]])assert.ok(findWallFaceAtPoint(g,p,epsilon),JSON.stringify(p));
}

test('#1166 exact public export has both closed contours without Optimize',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'75769f5c1fd870f733a54b48e742b5ccf7acea8e4ec5e88ff07db4644fd0ad34');
  const config=source(),before=structuredClone(config);
  both(config);
  assert.deepEqual(config,before);
});

test('#1166 both contours survive source reordering and end reversal',()=>{
  const config=source();
  config.spaces[0].partitions.reverse();
  for(const p of config.spaces[0].partitions)[p.a,p.b]=[p.b,p.a];
  both(config);
});

test('#1166 storage tolerance does not close two distinct authored endpoints',()=>{
  for(const gap of [.0004,.0000002]){
    const segments=[{key:'t',a:[0,0],b:[100,0]},{key:'r',a:[100,0],b:[100,100]},
      {key:'b',a:[100,100],b:[0,100]},{key:'l',a:[0,100],b:[0,gap]}];
    assert.equal(buildWallFaceGraph(segments,.001).faces.length,0);
  }
});

for(const optimize of [false,true])for(const reverse of [false,true])
test(`#1166 ${optimize?'Optimize then ':''}both rooms materialize in ${reverse?'reverse':'forward'} order without new debt`,()=>{
  const before=source();
  let current=optimize?optimizePlans(before,{}).config:structuredClone(before);
  both(current);
  const queries=reverse?[[-200,1240],[350,400]]:[[350,400],[-200,1240]];
  for(const [index,point]of queries.entries()){
    const face=findWallFaceAtPoint(graph(current),point,epsilon);
    assert.ok(face);
    const inherited=wallFaceProvenPoints([face.ring.map(p=>p.map(v=>v/NORM_W))],
      graph(current).faces.map(f=>f.ring.map(p=>p.map(v=>v/NORM_W))));
    const initialDebt=wallModelOffGridValueCount(current.spaces[0],inherited);
    current.spaces[0].rooms.push({id:`added-${index}`,name:'Synthetic',area:null,poly:face.ring.map(p=>p.map(v=>v/NORM_W))});
    current=commitWallSegmentModel(current).config;
    assert.ok(wallModelOffGridValueCount(current.spaces[0])<=initialDebt);
    assert.equal(checkOptimizeGeometry(current).ok,true);
    assert.equal(current.spaces[0].rooms.length,index+1);
  }
});

test('#1166 derived shared cuts get one stored identity before final rounding',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/1166-shared-cut.json',import.meta.url),'utf8'));
  const input=structuredClone(fixture.source);
  input.spaces[0].rooms.push(fixture.room);
  const first=commitWallSegmentModel(input).config;
  const space=first.spaces[0],spans=space.wall_segments.map(w=>JSON.stringify([w.a,w.b]));
  assert.equal(new Set(spans).size,spans.length,'no different IDs collapse to the same stored span');
  assert.deepEqual(space.wall_segments.find(w=>w.id==='south').future_wall,{keep:true});
  const shared=space.rooms.map(room=>new Set(room.wall_ids));
  assert.ok([...shared[0]].some(id=>shared[1].has(id)),'the real shared edge has one identity');
  assert.deepEqual(commitWallSegmentModel(first).config,first,'the next ordinary write stays valid');
});

test('#1166 incidence uses the existing normalized P4 boundary, not the wider topology key',()=>{
  assert.equal(storedWallContact([.5,1e-7],[0,0],[1,0]),true);
  assert.equal(storedWallContact([.5,3e-7],[0,0],[1,0]),false);
  for(const scale of [1,1000]){
    const segments=[{key:'t',a:[0,0],b:[1,0]},
      {key:'r',a:[1,0],b:[1,1]}, {key:'b',a:[1,1],b:[0,1]},
      {key:'l',a:[0,1],b:[0,0]}, {key:'branch',a:[.5,-.5],b:[.5,-1e-7]}]
      .map(s=>({...s,a:s.a.map(v=>v*scale),b:s.b.map(v=>v*scale)}));
    assert.equal(buildWallFaceGraph(segments,scale/240*.0002,scale).faces.length,1);
    segments.at(-1).b[1]=-3e-7*scale;
    assert.equal(buildWallFaceGraph(segments,scale/240*.0002,scale).faces.length,0);
  }
});

test('#1166 accepted Optimize is a storage-roundtrip no-op and retains both contours',()=>{
  const before=source(),snapshot=structuredClone(before);
  const first=optimizePlans(before,{});
  assert.deepEqual(before,snapshot);
  both(first.config);
  assert.equal(checkOptimizeGeometry(first.config).ok,true);
  const roundtrip=JSON.parse(JSON.stringify(first));
  const second=optimizePlans(roundtrip.config,roundtrip.layout);
  assert.equal(second.changed,false);
  assert.deepEqual(second.config,first.config);
});
