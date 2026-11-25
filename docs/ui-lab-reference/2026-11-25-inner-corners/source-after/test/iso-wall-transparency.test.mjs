import test from 'node:test';
import assert from 'node:assert/strict';
import { composeIsoTranslucentStructure, deviceWallOcclusion } from '../test-build/iso-lab-visibility.js';
import { isoFloorMatrix, ISO_CAMERA, projectPlanPoint } from '../test-build/iso-projection.js';
import { buildIsoOpeningBasis, projectIsoOpeningStructure } from '../test-build/iso-openings.js';
import { savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { physicalSpaceRecord } from '../test-build/structural-space-record.js';
import { resolveIsoFramePresentation } from '../test-build/iso-scene-render.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';
import { connectTranslucentOpeningMasonry } from '../test-build/iso-masonry-joins.js';

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

test('a furniture envelope does not cut a continuous wall into separate paint sheets', () => {
  const camera={...ISO_CAMERA,origin:[0,0],rotDeg:0};
  const face=wall([[0,0],[20,0],[20,10],[0,10]].map(([x,z])=>projectPlanPoint([x,0],z,camera)));
  const furniture=[{footprint:[[5,3],[15,3],[15,5],[5,5]],height:5}];
  const fragments=composeIsoTranslucentStructure([face],camera,1,{side:.63,top:.5},furniture);
  assert.equal(fragments.filter(f=>f.index===0).length,1);
  // The wall remains behind the table where their projected pixels overlap.
  const point=projectPlanPoint([10,0],2,camera);
  assert.deepEqual(orderAt(fragments,...point),[0,1]);
});

test('corner-only back faces never occlude paint behind their empty surface', () => {
  const camera={...ISO_CAMERA,origin:[0,0],rotDeg:0};
  const face=wall([[0,0],[20,0],[20,10],[0,10]].map(([x,z])=>projectPlanPoint([x,0],z,camera)));
  face.face.edgeOnly=true;
  const furniture=[{footprint:[[5,-5],[15,-5],[15,-3],[5,-3]],height:5}];
  const fragments=composeIsoTranslucentStructure([face],camera,1,{side:1,top:1},furniture);
  const point=projectPlanPoint([10,0],4,camera);
  assert(orderAt(fragments,...point).includes(1),'empty back face must not remove the furniture');
});

test('#1530 an opaque cut fully hides the device side and glass behind it', () => {
  for (const lens of [undefined,{center:[100,100],rate:.002}]) {
    const camera = {...ISO_CAMERA,origin:[0,0],rotDeg:0,perspective:lens};
    const height = 10, floorAnchor = [50,100], deviceSize = 40;
    const visualScene = projectPlanPoint(floorAnchor,height,camera);
    const [x,y] = visualScene;
    const placement = {floorAnchor,visualScene,deviceSize};
    const [, , , floorScale] = isoFloorMatrix(camera);
    const top = cut([[x-30,y+17],[x+30,y+17],[x+30,y+21],[x-30,y+21]]);
    const side = wall([[x-12,y+26],[x+12,y+26],[x+12,y+19],[x-12,y+19]]);
    const mask = deviceWallOcclusion([top,side],camera,placement,height);
    const shape = [{left:-.5,right:.5,top:-.5,bottom:.5,rx:.15,ry:.15}];
    const body = mask.bodyMask(shape);
    assert.ok(contains(body.cut,x+.12,y+18));
    assert.ok(contains(body.cut,x+20.5,y+18),'cover the antialiased body edge inside the wall silhouette');
    assert.ok(!contains(body.cut,x+25,y+18),'the cap does not hide paint outside the device body');
    assert.ok(contains(body.occluded,x+.12,y+22));
    assert.ok(!contains(body.cut,x+.12,y+12));
    const [u,v] = floorAnchor;
    const rim = v+20;
    const glass = [[[u-20,rim,0],[u+20,rim,0],[u+20,rim+9.6/floorScale,9.6],
      [u-20,rim+9.6/floorScale,9.6]]];
    assert.ok(contains(mask.glassMask(glass).cut,u+.12,v+18/floorScale));
    assert.ok(contains(mask.glassMask(glass).cut,u+21,v+18/floorScale),'cover glass ink beyond the face polygon');
    assert.ok(contains(mask.glassMask(glass).occluded,u+.12,v+22/floorScale));
    const transparentCut = deviceWallOcclusion([side],camera,placement,height);
    assert.equal(transparentCut.bodyMask(shape).cut,'');
    assert.equal(transparentCut.glassMask(glass).cut,'');
    const nearbyCut = cut([[x-12,y+50],[x+12,y+50],[x+12,y+61],[x-12,y+61]]);
    const nearby = deviceWallOcclusion([nearbyCut],camera,placement,height);
    assert.deepEqual(nearby.bodyMask(shape),{cut:'',occluded:''},'a nearby wall without overlap produces no body mask');
  }
});

test('#1546 masks reuse equivalent measured shapes and invalidate changed inputs', () => {
  const camera = {...ISO_CAMERA,origin:[0,0],rotDeg:0};
  const height = 10, floorAnchor = [50,100], deviceSize = 40;
  const visualScene = projectPlanPoint(floorAnchor,height,camera);
  const [x,y] = visualScene;
  const queue = [cut([[x-30,y+17],[x+30,y+17],[x+30,y+21],[x-30,y+21]])];
  const placement = {floorAnchor,visualScene,deviceSize};
  const mask = deviceWallOcclusion(queue,camera,placement,height);
  const faces = [{left:-.5,right:.5,top:-.5,bottom:.5,rx:.15,ry:.15}];
  const body = mask.bodyMask(faces);
  assert.ok(body.cut);
  const fresh = deviceWallOcclusion(structuredClone(queue),structuredClone(camera),structuredClone(placement),height);
  assert.strictEqual(fresh,mask);
  assert.strictEqual(fresh.bodyMask(structuredClone(faces)),body);
  assert.notDeepEqual(mask.bodyMask([{...faces[0],right:.25}]),body);

  const [, , , scale] = isoFloorMatrix(camera);
  const surfaces = [[[30,120,0],[70,120,0],[70,120+9.6/scale,9.6],[30,120+9.6/scale,9.6]]];
  const glass = mask.glassMask(surfaces);
  assert.ok(glass.cut);
  const alternate = [[[31,120,0],[71,120,0],[71,120+9.6/scale,9.6],[31,120+9.6/scale,9.6]]];
  assert.notDeepEqual(mask.glassMask(alternate),glass);
  assert.strictEqual(fresh.glassMask(structuredClone(surfaces),[...floorAnchor]),glass);
  assert.notStrictEqual(mask.glassMask(surfaces,[51,100]),glass);
  assert.notEqual(deviceWallOcclusion(queue,camera,{...placement,deviceSize:30},height).transform,mask.transform);
  assert.notEqual(deviceWallOcclusion(queue,camera,{...placement,visualScene:[x+3,y]},height),mask);
  assert.notEqual(deviceWallOcclusion(queue,camera,placement,height+1),mask);
  assert.notEqual(deviceWallOcclusion(queue,{...camera,rotDeg:35},placement,height),mask);
  const movedWall = [cut([[x-30,y+15],[x+30,y+15],[x+30,y+21],[x-30,y+21]])];
  assert.notDeepEqual(deviceWallOcclusion(movedWall,camera,placement,height).bodyMask(faces),body);
  assert.equal(deviceWallOcclusion([],camera,placement,height),undefined);
  assert.strictEqual(deviceWallOcclusion(queue,camera,placement,height),mask);
  for (let offset=0;offset<4;offset++) mask.glassMask(surfaces,[55+offset,100]);
  const restoredGlass = mask.glassMask(surfaces);
  assert.notStrictEqual(restoredGlass,glass);
  assert.deepEqual(restoredGlass,glass);
  for (let offset=0;offset<512;offset++) {
    deviceWallOcclusion(queue,camera,{...placement,visualScene:[x+100+offset,y]},height);
  }
  const restored = deviceWallOcclusion(queue,camera,placement,height);
  assert.notStrictEqual(restored,mask);
  assert.deepEqual(restored.bodyMask(faces),body);
});

test('#1546 the shadow mask follows the frame bounds when the opaque queue is reused', () => {
  const camera = {...ISO_CAMERA,origin:[0,0],rotDeg:0};
  const geometry = buildIsoWallGeometry([[[[15,15],[45,15],[45,23],[15,23]]]],camera,10);
  const scene = {key:'shadow-frame-bounds',geometry,camera,openings:[],openingSurfaces:[],
    floor:{footprintPath:'',sides:[]}};
  const draw = w => resolveIsoFramePresentation({
    projection:'iso',display:{showBorders:true,hideOpenings:true},openings:[],amountOf:()=>0,
    scene:{...scene,frame:{x:0,y:0,w,h:100}},overlays:()=>null,cellCm:5,
  }).shadowClip;
  const narrow = draw(100), wide = draw(180);
  assert.ok(narrow && wide);
  assert.ok(!contains(narrow,150,90) && contains(wide,150,90));
  assert.equal(draw(100),narrow);
});

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

test('#1518 masonry joins span the actual cut and keep only the exposed jamb', () => {
  for (const rotDeg of [35,215]) {
    for (const type of ['window','door']) {
      const camera = {...ISO_CAMERA,rotDeg};
      const basis = buildIsoOpeningBasis({
        id:type, sourceIndex:0, type, x:100, y:100, angle:0, length:60,
        flipH:false, flipV:false, face:{ox:0,oy:4,side:1},
      });
      const pad = .0017;
      const wallRect = (a,b) => [[[a,96],[b,96],[b,104],[a,104]]];
      const geometry = buildIsoWallGeometry([wallRect(0,70-pad),wallRect(130+pad,200)],camera,basis.wallHeight);
      const joined = connectTranslucentOpeningMasonry({geometry,camera,openings:[basis]});
      const cutFace = face => face.planEdge.every(([x]) => Math.abs(x-70)<.01 || Math.abs(x-130)<.01);
      assert.equal(geometry.sides.filter(cutFace).length,1);
      assert.equal(joined.sidesWithPanels.filter(cutFace).length,0);
      const exposed = joined.sidesWithoutPanels.filter(cutFace);
      assert.equal(exposed.length,1);
      assert.equal(exposed[0].baseHeight,basis.windowProfile?.frameBottom ?? 0);
      assert.equal(exposed[0].height,basis.windowProfile?.frameTop ?? basis.apertureTop);
      assert.ok(joined.sidesWithPanels.some(face=>face.planEdge.every(([x])=>x===0 || x===200)),
        'a real wall end outside the cut must remain');
      const top = joined.surfaces.find(s=>s.material==='wall-top');
      const xs = top.points.map(({point})=>point[0]);
      assert.ok(Math.min(...xs) < 70-pad && Math.max(...xs) > 130+pad,
        'the cap actually overlaps both ends of the cut');
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
  const placement={floorAnchor:[75,110],visualScene:projectPlanPoint([75,110],basis.wallHeight,camera),deviceSize:40};
  const overlays={devices:new Map([['device',placement]])};
  const render = opacity=>resolveIsoFramePresentation({
    projection:'iso', display:{...display,showBorders:true,hideOpenings:true,opacity},
    scene, openings:[], amountOf:()=>0, overlays:()=>overlays, cellCm:5,
  });
  const opaque = render(1);
  const first=placement.wallMask;
  assert.ok(first);
  render(1);
  assert.equal(placement.wallMask,first,'unchanged translucent scene reuses its device mask');
  assert.equal(opaque.layers.panels,false);
  const markup = templateMarkup(opaque.foreground);
  assert.match(markup,/id="hp-iso-translucent-cut-paint"[^>]+d=M /);
  assert.match(markup,/data-material=top[^>]*>\s*<path class=iso-wall-top[^>]+fill-opacity=1[^>]+data-surface=window-apron-top/);
  assert.doesNotMatch(markup,/class="iso-opening-panel/);
  assert.doesNotMatch(templateMarkup(render(0).foreground),/data-surface=window-apron-top/);
  assert.equal(placement.wallMask,undefined,'turning the cut transparent invalidates the previous mask');
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
