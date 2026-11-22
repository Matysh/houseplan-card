import test from 'node:test';
import assert from 'node:assert/strict';
import { composeIsoTranslucentStructure } from '../test-build/iso-lab-visibility.js';
import { ISO_CAMERA } from '../test-build/iso-projection.js';
import { savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { physicalSpaceRecord } from '../test-build/structural-space-record.js';

const wall = points => ({
  layer:'wall-side', depth:0, face:{ points, d:'M '+points.join(' L ')+' Z', height:10, polygon:0, ring:0, edge:0 },
});
const cut = points => ({
  layer:'wall-top', depth:0, face:{ projectedRings:[points], d:'M '+points.join(' L ')+' Z', height:10, component:0 },
});
function contains(path, x, y) {
  let inside = false;
  for (const ring of path.trim().split(/M /).slice(1)) {
    const values = ring.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const points = Array.from({length:values.length/2},(_, i) => values.slice(i*2,i*2+2));
    for (let i=0, j=points.length-1; i<points.length; j=i++) {
      const [ax,ay] = points[i], [bx,by] = points[j];
      if ((ay>y) !== (by>y) && x < ax+(bx-ax)*(y-ay)/(by-ay)) inside = !inside;
    }
  }
  return inside;
}
const orderAt = (result,x,y) => result.filter(fragment => contains(fragment.d,x,y)).map(fragment=>fragment.index);

test('#1518 intersecting translucent faces are painted in the local depth order', () => {
  const a=wall([[0,20],[20,10],[20,0],[0,10]]);
  const b=wall([[0,10],[20,20],[20,10],[0,0]]);
  const queue=[a,b];
  const result=composeIsoTranslucentStructure(queue,ISO_CAMERA,1,{side:.6,top:1},[]);
  assert.deepEqual(orderAt(result,8,10),[1,0]);
  assert.deepEqual(orderAt(result,12,10),[0,1]);
  const capped=[...queue,cut([[1,6],[19,6],[19,14],[1,14]])];
  const layers=composeIsoTranslucentStructure(capped,ISO_CAMERA,1,{side:.6,top:.4},[]);
  assert.deepEqual(orderAt(layers,8,10),[1,0,2]);
  assert.deepEqual(orderAt(layers,12,10),[0,1,2]);
  const opaque=composeIsoTranslucentStructure(queue,ISO_CAMERA,1,{side:1,top:1},[]);
  assert.deepEqual(orderAt(opaque,8,10),[0]);
  assert.deepEqual(orderAt(opaque,12,10),[1]);
});

test('#1518 top and side opacity control occlusion independently', () => {
  const queue=[
    wall([[0,20],[20,20],[20,10],[0,10]]),
    cut([[2,12],[18,12],[18,18],[2,18]]),
  ];
  const sample = (side,top) => orderAt(composeIsoTranslucentStructure(queue,ISO_CAMERA,1,{side,top},[]),10,15);
  assert.deepEqual(sample(1,.4),[0,1], 'through translucent cut, opaque side remains visible');
  assert.deepEqual(sample(.4,1),[1], 'opaque cut masks side behind it');
  assert.deepEqual(sample(1,0),[0], 'zero coverage contributes neither clipping nor paint');
  assert.deepEqual(sample(0,0),[]);
  const duplicate=composeIsoTranslucentStructure([queue[0],queue[0]],ISO_CAMERA,1,{side:.4,top:0},[]);
  assert.deepEqual(orderAt(duplicate,10,15),[1],'one coplanar material must not darken itself');
});

test('#1518 space draft saves a local opt-in without changing colours or geometry identity', () => {
  const space={id:'s',title:'Default',settings:{wall_fill:{c:'#748eff',a:.35},room_color:'#743721',room_opacity:0}};
  assert.equal(spaceDisplayOf(space).transparentWalls3d,false);
  const draft=savedSpaceDialogDraft(space,false);
  const settings=spaceDialogSettings({...draft,transparentWalls3d:true},space.settings);
  const confirmed={...space,settings};
  assert.equal(spaceDisplayOf(confirmed).transparentWalls3d,true);
  assert.equal(savedSpaceDialogDraft(confirmed,false).transparentWalls3d,true);
  assert.deepEqual(settings.wall_fill,space.settings.wall_fill);
  assert.equal(settings.room_color,space.settings.room_color);
  assert.equal(settings.room_opacity,space.settings.room_opacity);
  const disabled=spaceDialogSettings({...savedSpaceDialogDraft(confirmed,false),transparentWalls3d:false},settings);
  assert.equal(Object.hasOwn(disabled,'transparent_walls_3d'),false);
  assert.deepEqual(physicalSpaceRecord({...confirmed,settings:disabled}),physicalSpaceRecord(confirmed));
});
