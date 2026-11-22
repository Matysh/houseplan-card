import test from 'node:test';
import assert from 'node:assert/strict';
import { composeIsoTranslucentStructure } from '../test-build/iso-lab-visibility.js';
import { ISO_CAMERA } from '../test-build/iso-projection.js';
import { buildIsoOpeningBasis, projectIsoOpeningStructure } from '../test-build/iso-openings.js';
import { savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { physicalSpaceRecord } from '../test-build/structural-space-record.js';
import { resolveIsoFramePresentation } from '../test-build/iso-scene-render.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';

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

test('#1518 opening masonry shows one exterior side and only the reveal facing the camera', () => {
  for (const type of ['window','door','passage']) {
    for (const offset of [-4,4]) {
      const basis = buildIsoOpeningBasis({
        id:type, sourceIndex:0, type, x:0, y:0, angle:0, length:60,
        flipH:false, flipV:offset<0, face:{ ox:0, oy:offset, side:Math.sign(offset) },
      });
      for (const rotDeg of [0,45,90,135,180,225,270,315]) {
        const camera = {...ISO_CAMERA,rotDeg};
        const original = projectIsoOpeningStructure(basis,camera,true);
        const visible = original.filter(face=>!face.hiddenInTranslucentMasonry);
        const sides = visible.filter(face=>face.material==='wall-side');
        const lookToward = rotDeg<90 || rotDeg>270 ? 1 : -1;
        if (rotDeg===90 || rotDeg===270) assert.equal(sides.length,0);
        else {
          assert.equal(sides.length,1);
          assert.ok(sides[0].points.every(({point})=>point[1]===lookToward*4));
        }
        assert.ok(original.filter(face=>face.material==='wall-side').length>=4);
        assert.ok(visible.some(face=>face.material==='wall-top'));
        const jambs = visible.filter(face=>face.kind==='jamb-reveal').map(face=>face.jamb);
        assert.deepEqual(jambs,rotDeg===0 || rotDeg===180 ? [] : [rotDeg<180 ? 0 : 1]);
      }
    }
  }
});

function templateMarkup(value) {
  if (Array.isArray(value)) return value.map(templateMarkup).join('');
  if (value?.strings) return value.strings.map((s,i)=>s+templateMarkup(value.values[i])).join('');
  return ['string','number'].includes(typeof value) ? String(value) : '';
}

test('#1518 hidden opening panels keep the window apron at its own top opacity', () => {
  const camera = {...ISO_CAMERA,rotDeg:45};
  const basis = buildIsoOpeningBasis({
    id:'window', sourceIndex:0, type:'window', x:100, y:100, angle:0, length:60,
    flipH:false, flipV:false, face:{ox:0,oy:4,side:1},
  });
  const wallRect = (a,b) => [[[a,96],[b,96],[b,104],[a,104]]];
  const geometry = buildIsoWallGeometry([wallRect(0,70),wallRect(130,200)],camera,basis.wallHeight);
  const scene = {
    key:'translucent-apron', geometry, camera, floor:{footprintPath:'',sides:[]},
    openings:[basis], openingSurfaces:projectIsoOpeningStructure(basis,camera,true)
      .map(face=>({...face,id:basis.id,type:basis.type,sourceIndex:0})),
  };
  const display=spaceDisplayOf({settings:{transparent_walls_3d:true,wall_fill:{c:'#2f786e',a:.38}}});
  const render = opacity=>resolveIsoFramePresentation({
    projection:'iso', display:{...display,showBorders:true,hideOpenings:true,opacity},
    scene, openings:[], amountOf:()=>0, overlays:()=>null, cellCm:5,
  });
  const opaque = render(1);
  assert.equal(opaque.layers.panels,false);
  const markup = templateMarkup(opaque.foreground);
  assert.match(markup,/id="hp-iso-translucent-cut-paint"[^>]+d=M /);
  assert.match(markup,/data-material=top opacity=1[^>]*>\s*<path class=iso-wall-top[^>]+data-surface=window-apron-top/);
  assert.doesNotMatch(markup,/class="iso-opening-panel/);
  assert.doesNotMatch(templateMarkup(render(0).foreground),/data-surface=window-apron-top/);
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
