import test from 'node:test';
import assert from 'node:assert/strict';
import {architecturalFloorTone, architecturalWallTone} from '../test-build/iso-architectural-tone.js';
import {architecturalPainter} from '../test-build/iso-architectural-edges.js';
import {colorLuma, parseCssColor} from '../test-build/iso-materials.js';
import {ISO_CAMERA} from '../test-build/iso-projection.js';
import {buildIsoWallGeometry} from '../test-build/iso-walls.js';

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

test('transparent walls retain the far corner without adding back-face floor ink', () => {
  for (const rotDeg of [35,125,215,305]) {
    const camera={...ISO_CAMERA,rotDeg};
    const geometry=buildIsoWallGeometry([[[[0,0],[100,0],[100,70],[0,70]]]],camera,20);
    assert.equal(geometry.sides.length,2);
    assert.equal(geometry.backSides.length,2);
    assert(geometry.backSides.every(face=>face.edgeOnly));
    const queue=[...geometry.sides,...geometry.backSides].map(face=>({layer:'wall-side',face}));
    const ink=architecturalPainter(queue,camera,'#303030').edges.values[0];
    // Each back face owns half of the otherwise missing far vertical edge.
    // Shared silhouette ends and all back-face floor contacts remain absent.
    assert.deepEqual(ink.slice(2).map(t=>t.values[2].split('M ').length-1),[1,1]);
  }
});

test('back-facing apron and lintel suppress construction lines at a window end', () => {
  const side=makeFace([0,0],[100,0]);side.face.edgeOnly=true;
  const hidden=(low,high)=>({layer:'opening',surface:{material:'wall-side',hiddenInTranslucentMasonry:true,
    d:'M 100 0 L 150 0 L 150 20 Z',points:[{point:[100,0],z:low},{point:[150,0],z:low},
      {point:[150,0],z:high},{point:[100,0],z:high}]}});
  const ink=architecturalPainter([side,hidden(0,5),hidden(15,20)],ISO_CAMERA,'#303030').edges.values[0][0].values[2];
  // Left physical corner remains full height; only the actual opening interval
  // is inked at the right, with no continuation below sill/above lintel.
  assert.equal(ink.split('M ').length-1,2);
  const expected=architecturalPainter([side],ISO_CAMERA,'#303030').edges.values[0][0].values[2];
  assert.notEqual(ink,expected);
});
