import test from 'node:test';
import assert from 'node:assert/strict';
import {architecturalFloorTone, architecturalWallTone} from '../test-build/iso-architectural-tone.js';
import {architecturalPainter} from '../test-build/iso-architectural-edges.js';
import {colorLuma, parseCssColor} from '../test-build/iso-materials.js';
import {ISO_CAMERA} from '../test-build/iso-projection.js';
import {buildIsoWallGeometry,projectIsoCornerSides} from '../test-build/iso-walls.js';

const luma = c => colorLuma(parseCssColor(c));
test('#1495 white, near-black and coloured masonry preserve directional contrast', () => {
  for (const color of ['#ffffff', '#11141a', '#9ab5b2']) {
    const dark = luma(architecturalWallTone(parseCssColor(color), 0));
    const lit = luma(architecturalWallTone(parseCssColor(color), 1));
    const floor = luma(architecturalFloorTone(color,color,true));
    assert(dark < floor && floor < lit, color);
    const middle = luma(architecturalWallTone(parseCssColor(color),.5));
    assert(dark < middle && middle < lit, 'diagonal intensity is intermediate');
  }
  assert.equal(architecturalFloorTone('#223344','#ffffff',true),'#223344');
  assert.equal(architecturalFloorTone('#9ab5b2','#9ab5b2',false),'#9ab5b2','dynamic fill');
});

const makeFace = (a,b) => ({layer:'wall-side',face:{planEdge:[a,b],height:20,d:'M 0 0 L 100 0 L 100 20 L 0 20 Z'}});
const edgePaths = paint => paint.edges.values[0].map(template => ({
  clip:template.values[1], segments:template.values[2].split('M ').length-1,
}));
test('#1495 floor contacts and vertical lines carry the trimmed face clip, not coplanar seams', () => {
  const queue=[makeFace([0,0],[100,0]), makeFace([100,0],[150,0]), makeFace([150,0],[155,50])];
  const paint=architecturalPainter(queue,ISO_CAMERA,'#ffffff');
  assert.equal(architecturalPainter(queue,ISO_CAMERA,'#ffffff'),paint,'reuse prepared ink on the same face queue');
  assert.notEqual(paint.fill(1),paint.fill(2),'diagonal wall changes tone');
  assert.deepEqual(edgePaths(paint).map(p=>p.segments),[2,2,3], 'the join of the first two faces has no vertical line');
  assert(edgePaths(paint).every((p,i)=>p.clip===queue[i].face.d),'trimmed polygons are the clip');
});
test('#1495 an apron shares the wall tone, a raised lintel has no floor contact', () => {
  const a=[0,0],b=[100,0];
  const masonry=(low,high)=>({layer:'opening',surface:{material:'wall-side',d:'M 0 0 L 100 0 L 100 20 Z',
    points:[{point:b,z:low},{point:a,z:low},{point:a,z:high},{point:b,z:high}]}});
  const paint=architecturalPainter([makeFace(a,b),masonry(0,5),masonry(15,20)],ISO_CAMERA,'#9ab5b2');
  assert.equal(paint.fill(0),paint.fill(1));
  assert.equal(paint.fill(0),paint.fill(2));
  assert.deepEqual(edgePaths(architecturalPainter([masonry(15,20)],ISO_CAMERA,'#9ab5b2')).map(p=>p.segments),[2]);
});

test('#1555 padded masonry joins hide the apron seam, not a physical corner or a gap', () => {
  const apron = (a,b) => ({layer:'opening',surface:{material:'wall-side',
    d:'M 0 0 L 100 0 L 100 20 Z',
    points:[{point:b,z:0},{point:a,z:0},{point:a,z:5},{point:b,z:5}]}});
  const wall = makeFace([0,0],[100,0]);
  const adjacent = apron([100.002,0],[150,0]);
  const corner = makeFace([150,0],[150,45]);
  const detached = makeFace([150,45],[155,45]);
  const ink = queue => edgePaths(architecturalPainter(queue,ISO_CAMERA,'#9ab5b2')).map(p=>p.segments);
  assert.deepEqual(ink([wall,adjacent,corner,detached]),[3,2,3,3],
    'only the shared low vertical span at the padded apron join is excluded');
  assert.deepEqual(ink([wall,apron([102,0],[150,0])]),[3,3],
    'a real gap retains both ends');
});

const back = (a,b,low=0,high=20) => {
  const entry=makeFace(a,b);
  Object.assign(entry.face,{edgeOnly:true,baseHeight:low,height:high});
  return entry;
};

test('#1560 only each owner of a real back corner contributes its clipped half', () => {
  for(const rotDeg of [35,125,215,305]){
    const camera={...ISO_CAMERA,rotDeg};
    const geometry=buildIsoWallGeometry([[[[0,0],[100,0],[100,70],[0,70]]]],camera,20);
    const backSides=projectIsoCornerSides(geometry,camera);
    assert.equal(geometry.sides.length,2);
    assert.equal(backSides.length,2);
    assert(backSides.every(face=>face.edgeOnly));
    const queue=[...geometry.sides,...backSides].map(face=>({layer:'wall-side',face}));
    const paint=architecturalPainter(queue,camera,'#303030');
    assert.deepEqual(edgePaths(paint).slice(2).map(p=>p.segments),[1,1],
      'no added floor contacts or duplicate outer edges');
    assert.equal(paint.edge(2,queue[2].face.d,2).values[2],
      paint.edge(3,queue[3].face.d,3).values[2],'same physical line, clipped to adjacent planes');
  }
});

test('#1560 backs without a physical turn and padded opening seams carry no extra ink', () => {
  const straight=back([0,0],[100,0]);
  const collinear=back([100,0],[150,0]);
  const corner=back([100,0],[100,40]);
  const flat=architecturalPainter([straight,collinear],ISO_CAMERA,'#888');
  assert(!flat.hasInk(0) && !flat.hasInk(1));
  const open=(low,high)=>({layer:'opening',surface:{material:'wall-side',
    d:'M 100 0 L 150 0 L 150 20 Z',points:[{point:[100.002,0],z:low},{point:[150,0],z:low},
      {point:[150,0],z:high},{point:[100.002,0],z:high}]}});
  const paint=architecturalPainter([straight,corner],ISO_CAMERA,'#888',[open(0,5),open(15,20)]);
  const expect=architecturalPainter([back([0,0],[100,0],5,15),corner],ISO_CAMERA,'#888');
  assert.equal(paint.edge(0,straight.face.d,0).values[2],expect.edge(0,straight.face.d,0).values[2],
    'padded witnesses remove only the overlapping low and high spans');
  assert.equal(paint.hasInk(2),false,'witnesses never render');
  const visible=makeFace([100,0],[100,-40]);
  const behindVisible=architecturalPainter([visible,straight,corner],ISO_CAMERA,'#888');
  assert(!behindVisible.hasInk(1) && !behindVisible.hasInk(2),'visible outer faces already own the corner');
});
