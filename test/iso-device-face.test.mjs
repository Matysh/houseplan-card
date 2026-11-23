import test from 'node:test';
import assert from 'node:assert/strict';
import { freeContactShape } from '../test-build/device-contact-geometry.js';
import { isoDeviceFaceBounds, orientIsoDeviceFace } from '../test-build/iso-device-face.js';
import { isoCameraFor, isoReadingYaw } from '../test-build/iso-projection.js';

const core = {left:-.8, right:.6, top:-.5, bottom:.5, rx:.5, ry:.5};
const badge = {left:.6, right:2.3, top:-.22, bottom:.22, rx:.22, ry:.22};
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-6, `${actual} vs ${expected}`);

test('rotated value and badge share their exact supports on all wall sides and both corner normals', () => {
  for (const basis of [0,.81,-.51]) for (const walls of [
    {left:'a'}, {right:'a'}, {top:'a'}, {bottom:'a'}, {left:'a',top:'b'}, {right:'a',bottom:'b'},
  ]) {
    const shape = {...freeContactShape({id:'sample', x:20, y:15, diameter:20,
      box:{left:-22,right:50,top:-14,bottom:14}}), walls, angle:basis};
    const faces = [core,badge], before = JSON.stringify({shape,faces});
    const base = isoDeviceFaceBounds(faces,basis);
    for (const rotation of [0,45,90,135,180,225,270,315]) {
      const yaw = isoCameraFor(rotation).rotDeg;
      const turn = (isoReadingYaw(yaw)-yaw)*Math.PI/180;
      const result = orientIsoDeviceFace(shape,faces,turn,true,true);
      const after = isoDeviceFaceBounds(result.faces,basis);
      for (const side of Object.keys(walls)) {
        near(after[side],base[side]);
        assert.equal(result.shape.box[side],shape.box[side]);
      }
      assert.deepEqual(result.shape.walls,walls);
      assert.equal(result.shape.marker,shape.marker);
      assert.equal(result.faces[0].angle,turn);
      assert.equal(result.faces[1].angle,turn);
    }
    assert.equal(JSON.stringify({shape,faces}),before);
  }
});

test('free pill keeps its own off-centre pivot and performs no contact translation', () => {
  const shape = freeContactShape({id:'pill', x:0, y:0, diameter:20,
    box:{left:-18,right:14,top:-12,bottom:12}});
  const at = orientIsoDeviceFace(shape,[core],Math.PI/2,true,false);
  assert.deepEqual(at.shift,[0,0]);
  assert.equal(at.shape.angle,Math.PI/2);
  near((at.shape.box.left+at.shape.box.right)/2,0);
  near((at.shape.box.top+at.shape.box.bottom)/2,2);
  const bounds = isoDeviceFaceBounds(at.faces);
  near(bounds.left,-.6);
  near(bounds.right,.4);
  near(bounds.top,-.7);
  near(bounds.bottom,.7);
});
