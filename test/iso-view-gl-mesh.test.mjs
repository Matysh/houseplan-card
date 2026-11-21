import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIsoGlBatch, isoGlFurniture, triangulateIsoGlFace } from '../test-build/iso-view-gl-mesh.js';
import { FURNITURE_VOLUME_RUNTIME } from '../test-build/furniture-volume-runtime.js';
import { FURNITURE_HEIGHT_SCALE, tvCabinetSurfaceCm } from '../test-build/iso-lab-furniture.js';
import { isoCameraFor } from '../test-build/iso-projection.js';

const p = (x, y, z) => ({ point: [x, y], z });
const ring = (x, y, w, h, z) => [p(x,y,z), p(x+w,y,z), p(x+w,y+h,z), p(x,y+h,z)];

test('#1472 a mounted TV uses the shared cabinet elevation in GPU meshes at every turn', async () => {
  await FURNITURE_VOLUME_RUNTIME.ensure();
  const lift = tvCabinetSurfaceCm();
  assert.ok(lift > 0);
  const tv = { id: 'tv', kind: 'furniture', symbol: 'tv', x: .2, y: .3, w: .09, h: .03 };
  const vertices = faces => faces.flatMap(face => face.loops.flat());
  for (const turn of [0, 90, 180, 270]) {
    const args = [tv, 1000, 1000, 1, isoCameraFor(turn)];
    const floor = vertices(isoGlFurniture(...args));
    const mounted = vertices(isoGlFurniture(...args, lift));
    assert.ok(floor.length > 0);
    assert.equal(mounted.length, floor.length);
    for (let i = 0; i < floor.length; i++) {
      assert.deepEqual(mounted[i].point, floor[i].point);
      assert.ok(Math.abs(mounted[i].z - floor[i].z - lift * FURNITURE_HEIGHT_SCALE) < 1e-8);
    }
  }
});

test('#1472 physical cut-plane triangles preserve holes and negative coordinates', () => {
  const outer = ring(-6, 3, 10, 10, 5), hole = ring(-4, 6, 4, 4, 5).reverse();
  const vertices = triangulateIsoGlFace([[...outer, outer[0]], [...hole, hole[0]]]);
  let area = 0;
  for (let i = 0; i < vertices.length; i += 9) {
    const [ax,ay,az,bx,by,bz,cx,cy,cz] = vertices.slice(i, i + 9);
    area += Math.abs((ax-cx)*(by-cy)-(ay-cy)*(bx-cx)) / 2;
    assert.deepEqual([az,bz,cz], [5,5,5]);
  }
  assert.equal(area, 84);
});

test('#1472 vertical and sloped opening faces retain their physical vertices', () => {
  const quad = [p(2,3,2),p(6,8,2),p(6,8,5),p(2,3,5)];
  const vertices = triangulateIsoGlFace([quad]);
  assert.equal(vertices.length, 6 * 3);
  for (let i = 0; i < vertices.length; i += 3) {
    assert.ok(quad.some(q => q.point[0] === vertices[i] && q.point[1] === vertices[i+1] && q.z === vertices[i+2]));
  }
  assert.deepEqual(triangulateIsoGlFace([[p(0,0,0), p(1,1,1), p(2,2,2)]]), []);
});

test('#1472 opaque and translucent batches retain opacity and depth order', () => {
  const near = { loops: [ring(480, 490, 5, 5, 95)], paint: ['#ff0000', .47] };
  const far = { loops: [ring(480, 490, 5, 5, 2)], paint: ['#00ff00', .31] };
  const opaque = { loops: [ring(480, 490, 5, 5, 6)], paint: ['#ffffff', 1] };
  for (const turn of [0, 90, 180, 270]) {
    const batch = buildIsoGlBatch([near, opaque, far], isoCameraFor(turn));
    assert.deepEqual(batch.blended.colors.slice(0,4), [0,1,0,.31]);
    assert.deepEqual(batch.blended.colors.slice(-4), [1,0,0,.47]);
    assert.equal(batch.opaque.positions.length, 18);
    assert.ok(batch.minDepth < batch.maxDepth);
  }
});
