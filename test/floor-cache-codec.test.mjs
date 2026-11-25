import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeGeometryValue, decodeGeometryValue, encodeGeometryText, decodeGeometryText } from '../test-build/floor-cache-codec.js';
import { cacheSha256, floorCacheKeys } from '../test-build/floor-cache-key.js';
import { registerExactPaintRing, exactPaintRingProof } from '../test-build/polygon-paint.js';
import { cleanFloorForRoom, cleanFloorData, cleanFloorFromData } from '../test-build/clean-floor.js';
import { prepareFloorGeometry, isFloorGeometryFrame, restoreFloorGeometrySemantics } from '../test-build/floor-geometry-frame.js';
import { physicalFloorFingerprint, cleanFloorFingerprint } from '../test-build/floor-geometry-key.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import { directWallScenes } from '../demo/fixtures/direct-wall-geometry.mjs';
import { migrateGraphSpace } from '../test-build/plan-graph.js';
import { directRecut } from '../test-build/direct-wall-geometry.js';
import { recutWallBodiesGeometry, innerContourForRoom } from '../test-build/wall-thickness.js';
import { spaceModels, GRID_STEP_N, GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';

test('#1454 codec preserves references, Maps, bigint, hidden fields and exact area proofs', () => {
  const ring=[[0,0],[1,0],[1,1],[0,0]];registerExactPaintRing(ring,true);
  const root={ring,twice:ring,mapping:new Map([['ring',ring]]),n:123456789012345678901234567890n,zero:-0,unknown:undefined};
  Object.defineProperty(root,'sourceFingerprint',{value:'proof',enumerable:false});
  const result=decodeGeometryText(encodeGeometryText(root));
  assert.equal(result.ring,result.twice);
  assert.equal(result.mapping.get('ring'),result.ring);
  assert.equal(result.n,root.n);assert.ok(Object.is(result.zero,-0));
  assert.ok(Object.hasOwn(result,'unknown'));
  assert.equal(result.sourceFingerprint,'proof');
  assert.equal(Object.getOwnPropertyDescriptor(result,'sourceFingerprint').enumerable,false);
  assert.equal(exactPaintRingProof(result.ring),true);
});

test('#1454 codec refuses executable, cyclic, non-finite and malformed graphs before hydration', () => {
  let called=0;const getter={get area(){called++;return 1}};
  for(const bad of [getter,{x:NaN},{x:Infinity},{x:()=>1},{x:new WeakMap()},new Date()])
    assert.throws(()=>encodeGeometryValue(bad));
  assert.equal(called,0,'encoding must not force a lazy area getter');
  const cycle={};cycle.self=cycle;assert.throws(()=>encodeGeometryValue(cycle));
  const wire=encodeGeometryValue({value:[1,2]});
  const invalid=structuredClone(wire);invalid.root={r:999999};
  assert.throws(()=>decodeGeometryValue(invalid));
  const poison=structuredClone(wire);poison.nodes[0].fields[0][0]='__proto__';
  assert.throws(()=>decodeGeometryValue(poison));
  const loop=structuredClone(wire);loop.nodes[0].fields[0][1]={r:0};
  assert.throws(()=>decodeGeometryValue(loop));
  const bigint=encodeGeometryValue(1n);bigint.root={b:'1'.repeat(4097)};
  assert.throws(()=>decodeGeometryValue(bigint));
  const ring=[[0,0],[1,0],[0,1]];registerExactPaintRing(ring,true);
  const missing=encodeGeometryValue(ring);delete missing.nodes[0].proof;
  assert.throws(()=>decodeGeometryValue(missing),'missing semantic proof is not a hit');
});

test('#1454 persistent keys include both model/current records and only their real dependencies', () => {
  const raw={id:'A',cell_cm:5,rooms:[{id:'r',poly:[[0,0],[1,0],[0,1]]}],stairs:[]};
  const a=floorCacheKeys(raw,raw,5,50);
  assert.deepEqual(a,floorCacheKeys(structuredClone(raw),structuredClone(raw),5,50),'identity never changes a persistent dependency proof');
  assert.match(a.geometry,/^[a-f0-9]{64}$/);
  assert.equal(cacheSha256({a:1,b:2}),cacheSha256({b:2,a:1}));
  assert.notEqual(cacheSha256(undefined),cacheSha256(['undefined']));
  assert.deepEqual(floorCacheKeys({...raw,title:'x',settings:{room_color:'#000'}},{...raw,title:'x',settings:{room_color:'#000'}},5,50),
    floorCacheKeys(structuredClone(raw),structuredClone(raw),5,50));
  const changed={...raw,cell_cm:10};
  assert.notEqual(floorCacheKeys(raw,changed,5,50).physical,a.physical,'foreign current record cannot hit model-only key');
  assert.notEqual(floorCacheKeys(raw,raw,10,50).physical,a.physical);
  const withStairs={...raw,stairs:[{id:'stair'}]};
  const s=floorCacheKeys(withStairs,withStairs,5,50);
  assert.equal(s.physical,a.physical);assert.notEqual(s.clean,a.clean);
});

test('#1454 direct graph recut and real room/area consumers retain exact semantic data after transport',async()=>{
  for (const source of directWallScenes().filter(s=>['shared-rooms','courtyard','mixed-junctions'].includes(s.id))) {
    const raw=migrateGraphSpace(source).space;
    const input={raw,floorKey:physicalFloorFingerprint(raw),cleanKey:cleanFloorFingerprint(raw),projection:'flat'};
    const fresh=await prepareFloorGeometry(input), copy=decodeGeometryText(encodeGeometryText(fresh));
    assert.ok(fresh.directSemantic,'positive direct retained witness');
    assert.equal(copy.directSemantic.structure.geometryCache.size,0,'optional live-recut memo is not persisted');
    assert.ok(isFloorGeometryFrame(copy,input));
    // A normal structured clone loses the retained direct WeakMap. This
    // negative control proves the following recut actually needs hydration.
    assert.equal(directRecut(copy.union.value.roomGeom,[],copy.bodies.all),null);
    restoreFloorGeometrySemantics(copy,raw);
    const recut=directRecut(copy.union.value.roomGeom,[],copy.bodies.all);
    assert.ok(recut,'direct result, not the full-union/legacy recut fallback');
    assert.deepEqual(recut.geom,directRecut(fresh.union.value.roomGeom,[],fresh.bodies.all).geom);
    assert.deepEqual(recutWallBodiesGeometry(copy.union.value,[],copy.bodies.all).geom,
      recutWallBodiesGeometry(fresh.union.value,[],fresh.bodies.all).geom);
    const space=spaceModels({spaces:[raw]})[0];
    for(const room of space.rooms){
      assert.deepEqual(innerContourForRoom(space.rooms,room.id,raw.walls,[],GRID_STEP_N,5,GRID_PITCH,NORM_W,
        copy.union.value.roomGeom,copy.union.value.multiWallNodes),
      innerContourForRoom(space.rooms,room.id,raw.walls,[],GRID_STEP_N,5,GRID_PITCH,NORM_W,
        fresh.union.value.roomGeom,fresh.union.value.multiWallNodes));
    }
    for (const [key,data] of copy.clean) assert.equal(cleanFloorFromData(data,space.stairs).area,
      cleanFloorFromData(fresh.clean.find(([freshKey])=>freshKey===key)[1],space.stairs).area);
    delete copy.directSemantic;assert.equal(isFloorGeometryFrame(copy,input),false);
  }
});

test('#1454 serializing a clean floor keeps stair subtraction lazy across hydration', () => {
  let calls=0;
  const floor=[[0,0],[10,0],[10,10],[0,10]],room={id:'r',poly:floor};
  const space={id:'A',rooms:[room]};
  const result=cleanFloorForRoom({room,floor,space,floorKey:()=> 'A',resizePreview:false,cache:new Map(),
    physicalBodies:()=>[],areaMinusStairs:()=>{calls++;return 42}});
  const data=decodeGeometryText(encodeGeometryText(cleanFloorData(result)));
  assert.equal(calls,0);assert.equal(data.area,undefined);
  const restored=cleanFloorFromData(data,undefined,()=>{calls++;return 42});
  assert.equal(calls,0);assert.equal(restored.area,42);assert.equal(restored.area,42);assert.equal(calls,1);
  assert.equal(cleanFloorData(restored).area,42);
});

test('#1454 prepared frame is a bounded lossless runtime-cache payload, including iso quarter turns', async () => {
  const fixture=makeLargeHouseFixture({floors:1,roomsPerFloor:4,devices:0,openings:6,partitions:2,columns:1,decor:0,stairs:3});
  const raw=fixture.config.spaces[0];
  const input={raw,floorKey:raw.id+'|'+physicalFloorFingerprint(raw),cleanKey:raw.id+'|'+cleanFloorFingerprint(raw),projection:'iso'};
  const frame=await prepareFloorGeometry(input);
  const text=encodeGeometryText(frame), restored=decodeGeometryText(text);
  assert.equal(isFloorGeometryFrame(restored,input),true);
  restoreFloorGeometrySemantics(restored,raw);
  assert.deepEqual(restored.inner,frame.inner);
  assert.deepEqual(restored.clean,frame.clean);
  assert.equal(restored.union.value?.d,frame.union.value?.d);
  assert.equal(restored.union.value?.sourceFingerprint,frame.union.value?.sourceFingerprint);
  assert.deepEqual(restored.iso.wallBase,frame.iso.wallBase);
  assert.ok(restored.iso.wallBase.value?.paths.length,'persisted 2.5D masonry has paint');
  const iso=await import('../test-build/iso-scene-geometry.js');
  const cache=new Map([[restored.iso.key,iso.restoreIsoCache(restored.iso.value)]]);
  for(const rotation of [90,180,270]) {
    const scene=iso.resolveIsoScene({source:{key:restored.iso.key,build(){throw Error('cold iso rebuild')}},cache,cellCm:5,
      liveFrame:{x:0,y:0,w:1000,h:1000},rotation});
    assert.ok(scene.geometry);
  }
  const invalid=decodeGeometryText(text);delete invalid.union.value.sourceFingerprint;
  assert.equal(isFloorGeometryFrame(invalid,input),false);
  for (const [label, change] of [
    ['physical bodies key',frame=>{frame.bodies.key='wrong'}],
    ['wall union key',frame=>{frame.union.key='wrong'}],
    ['missing 2.5D wall base',frame=>{delete frame.iso.wallBase}],
    ['2.5D wall base key',frame=>{frame.iso.wallBase.key='wrong'}],
    ['broken 2.5D wall base path',frame=>{frame.iso.wallBase.value.paths[0].fillRule='invalid'}],
    ['opening index key',frame=>{frame.openingIndex.key='wrong'}],
    ['opening tunnel key',frame=>{frame.tunnels.key='wrong'}],
    ['floor paint key',frame=>{frame.floorPaint.key='wrong'}],
    ['source fingerprint',frame=>{frame.union.value.sourceFingerprint='wrong'}],
    ['coordinate scale',frame=>{frame.union.value.coordinateScale=NORM_W/2}],
    ['missing inner contours',frame=>{frame.inner=[]}],
    ['missing clean floors',frame=>{frame.clean=[]}],
    ['wrong inner room key',frame=>{frame.inner[0][0]='wrong'}],
    ['wrong clean room key',frame=>{frame.clean[0][0]='wrong'}],
  ]) {
    const copy=decodeGeometryText(text);change(copy);
    assert.equal(isFloorGeometryFrame(copy,input),false,`${label} must miss, not hydrate a hidden main-thread rebuild`);
  }
});
