import test from 'node:test';
import assert from 'node:assert/strict';
import {architecturalFloorTone, architecturalWallTone} from '../test-build/iso-architectural-tone.js';
import {architecturalPainter} from '../test-build/iso-architectural-edges.js';
import {colorLuma, parseCssColor} from '../test-build/iso-materials.js';
import {ISO_CAMERA} from '../test-build/iso-projection.js';

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
