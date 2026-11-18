import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsoOpeningBasis, isoOpeningMasonry, projectIsoOpeningStructure, projectIsoOpening } from '../test-build/iso-openings.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';
import { isoMarkerBehindWall } from '../test-build/iso-marker-context.js';
import { buildIsoWallDepthQueue, renderIsoWalls } from '../test-build/iso-scene-render.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';

const opening = (patch={}) => ({id:'one',sourceIndex:0,type:'window',x:100,y:80,angle:0,length:120,
  flipH:false,flipV:false,face:{ox:0,oy:5,cm:20,side:1},...patch});
const camera = yaw => ({rotDeg:yaw,tiltDeg:50,xyScale:1,zScale:1,origin:[0,0],floorScaleY:Math.sin(40*Math.PI/180)});

test('taller section scales all opening heights while preserving plan anchors and profile thickness', () => {
  const cases = [
    {type:'door'}, {type:'window'}, {type:'gate'}, {type:'passage'},
    {type:'gate', opening_features:{version:1, mechanism:'slide', slide_direction:'end'}},
    {type:'window', opening_features:{version:1, side:'positive', leaves:[{hinge:'top'}, {hinge:'end'}]}},
  ];
  const checkHeight = (value, original) => assert.ok(Math.abs(value - original * 1.25) < 1e-10);
  for (const features of cases) {
    const input = opening(features);
    const current = buildIsoOpeningBasis(input, 84);
    const tall = buildIsoOpeningBasis(input, 105, undefined, 84);
    assert.deepEqual(tall.axis, current.axis);
    assert.equal(tall.leafThickness, current.leafThickness);
    assert.equal(tall.frameThickness, current.frameThickness);
    if (tall.windowProfile) {
      for (const field of ['frameBottom','frameTop','sashBottom','sashTop','glassBottom','glassTop'])
        checkHeight(tall.windowProfile[field], current.windowProfile[field]);
      assert.equal(tall.windowProfile.member, current.windowProfile.member);
      assert.equal(tall.windowProfile.frameTop, tall.wallHeight);
    }
    for (const [i, leaf] of tall.leaves.entries()) {
      const {top, bottom, ...rest} = leaf;
      const {top: oldTop, bottom: oldBottom, ...original} = current.leaves[i];
      assert.deepEqual(rest, original);
      checkHeight(top, oldTop);
      checkHeight(bottom, oldBottom);
    }
    const surfaces = projectIsoOpeningStructure(tall, camera(35), true);
    if (input.type === 'window' || input.type === 'gate') {
      assert.ok(!surfaces.some(surface => surface.kind.startsWith('opening-lintel')));
    }
  }
});

test('#1451 opening volumes preserve canonical inputs and all leaf poses in every quarter view',()=>{
  for(const type of ['window','door','passage','gate']) for(const angle of [0,90,27]) {
    const a=angle*Math.PI/180;
    const input=opening({type,angle,face:{ox:-Math.sin(a)*5,oy:Math.cos(a)*5,cm:20,side:1}});
    const saved=JSON.stringify(input),basis=buildIsoOpeningBasis(input,84),before=JSON.stringify(basis);
    const poses=[0,.4,1].map(amount=>projectIsoOpening(basis,amount));
    for(const yaw of [35,125,215,305]) {
      const surfaces=projectIsoOpeningStructure(basis,camera(yaw),true);
      assert.ok(surfaces.every(s=>!/(NaN|Infinity)/.test(s.d)));
      if(type==='gate') assert.ok(!surfaces.some(s=>s.kind.includes('lintel')));
      else {
        const volume=isoOpeningMasonry(basis);
        assert.deepEqual(volume.ring,[basis.face.selectedStart,basis.face.selectedEnd,basis.face.oppositeEnd,basis.face.oppositeStart]);
        assert.equal(volume.bottom,type==='window'?0:84*.92);
        assert.equal(volume.top,type==='window'?84*.38-84*.05*.4:84);
        const top=surfaces.find(s=>s.kind===(type==='window'?'window-apron-top':'opening-lintel-top'));
        for(const point of volume.ring) {
          const [x,y]=projectPlanPoint(point,volume.top,camera(yaw)).map(v=>Number(v.toFixed(4)));
          assert.ok(top.d.includes(`${x} ${y}`),'surface meets the physical jamb without a screen-space offset');
        }
      }
    }
    assert.equal(JSON.stringify(input),saved);
    assert.equal(JSON.stringify(basis),before);
    assert.deepEqual([0,.4,1].map(amount=>projectIsoOpening(basis,amount)),poses);
  }
});

test('#1451 zero-depth hosts and external gates acquire no floating masonry',()=>{
  for(const type of ['window','door','passage','gate'])
    assert.equal(isoOpeningMasonry(buildIsoOpeningBasis(opening({type,face:{ox:0,oy:0,cm:0,side:1}}))),null);
  assert.equal(isoOpeningMasonry(buildIsoOpeningBasis(opening({type:'gate'}))),null);
  assert.deepEqual(projectIsoOpeningStructure(buildIsoOpeningBasis(opening({type:'passage'}))),[]);
});

test('#1451 masonry stays visible when symbols are hidden; no-borders still removes all volumes',()=>{
  const basis=buildIsoOpeningBasis(opening({type:'door'}));
  const surfaces=projectIsoOpeningStructure(basis,camera(35),true).map(s=>({...s,id:'one',sourceIndex:0,type:'door'}));
  const scene={key:'test',geometry:buildIsoWallGeometry([]),openingSurfaces:surfaces,camera:camera(35)};
  const flatten=v=>v?.strings?v.strings.reduce((s,part,i)=>s+part+flatten(v.values[i]),''):Array.isArray(v)?v.map(flatten).join(''):v==null||typeof v==='symbol'?'':String(v);
  const markup=flatten(renderIsoWalls('iso',{structural:true,panels:false,materialNuance:false},scene,[],5));
  assert.match(markup,/opening-lintel-side/); assert.doesNotMatch(markup,/door-frame|jamb-reveal/);
  assert.equal(flatten(renderIsoWalls('iso',{structural:false},scene,[],5)),'');
  const queue=buildIsoWallDepthQueue(scene.geometry,surfaces,true);
  assert.equal(queue.at(-1).surface.kind,'opening-lintel-top');
});

test('#1451 a lintel occludes only its actual height interval, not the clear doorway',()=>{
  const cam=camera(0),wall=[[[[-10,20],[10,20],[10,25],[-10,25]]]];
  assert.equal(isoMarkerBehindWall([0,0],wall,84,cam),true);
  assert.equal(isoMarkerBehindWall([0,0],wall,84,cam,84*.92),false);
  assert.equal(isoMarkerBehindWall([0,-74],wall,84,cam,84*.92),true);
  assert.equal(isoMarkerBehindWall([0,0],wall,84*.36,cam),true);
});
