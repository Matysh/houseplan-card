import assert from 'node:assert/strict';
import test from 'node:test';
import { tvCabinet, tvMountTarget, tvOnCabinet, toggleTvMount } from '../test-build/tv-mount.js';
import { remapWorkstationItems, removeWorkstationItems } from '../test-build/iso-lab-workstation.js';
import { copyDecor } from '../test-build/editors/decor/order.js';
import { FURNITURE_VOLUME_RUNTIME } from '../test-build/furniture-volume-runtime.js';
import { furnitureParts, furnitureVolume, FURNITURE_HEIGHT_SCALE, tvCabinetSurfaceCm } from '../test-build/iso-lab-furniture.js';
import { isoCameraFor, projectPlanPoint } from '../test-build/iso-projection.js';

const cabinet = { id:'cabinet', kind:'furniture', symbol:'cabinet_tv', x:.2, y:.3, w:.16, h:.06 };
const tv = { id:'tv', kind:'furniture', symbol:'tv', x:.239, y:.321, w:.064, h:.02, color:'#ad3151' };
const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, String(actual) + ' != ' + expected);

function mountedTv() {
  const items = [cabinet, tv];
  return toggleTvMount(items, tvMountTarget(items, tv))[1];
}

test('mount requires a freestanding TV over an unoccupied cabinet in this space', () => {
  assert.equal(tvMountTarget([cabinet], cabinet), null);
  assert.equal(tvMountTarget([cabinet, {...tv, x:.6}], cabinet), null);
  assert.equal(tvMountTarget([cabinet, {...tv, symbol:'tv_wall'}], cabinet), null);
  const rotated = {...cabinet, angle:90};
  assert.equal(tvMountTarget([rotated, {...tv, y:.37}], rotated)?.tv.id, tv.id);
  assert.equal(tvMountTarget([rotated, {...tv, x:.31}], rotated), null);
  assert.equal(tvMountTarget([cabinet, {...cabinet, id:'farther', x:.23}, tv], tv)?.cabinet.id, cabinet.id);
  const other = {...tv, id:'other'};
  assert.equal(tvMountTarget([cabinet, mountedTv(), other], other), null);
});

test('the link follows cabinet movement and orientation, and detaches or copies independently', () => {
  const mounted = mountedTv();
  const moved = {...cabinet, x:.5, y:.64, angle:121, flip_h:true, flip_v:true};
  const items = [moved, mounted];
  assert.equal(tvCabinet(items, mounted), moved);
  const drawn = tvOnCabinet(mounted, moved);
  near(drawn.x + drawn.w/2, moved.x + moved.w/2);
  near(drawn.y + drawn.h/2, moved.y + moved.h/2);
  for (const key of ['w', 'h', 'color']) assert.equal(drawn[key], tv[key]);
  for (const key of ['angle', 'flip_h', 'flip_v']) assert.equal(drawn[key], moved[key]);
  const detached = toggleTvMount(items, tvMountTarget(items, moved))[1];
  assert.deepEqual(removeWorkstationItems(items, new Set([cabinet.id])), [detached]);
  assert.equal(detached.tv_cabinet_id, undefined);
  assert.equal(detached.x, drawn.x);
  const copied = copyDecor(items, tv.id, 'copy', 10).shape;
  assert.equal(copied.tv_cabinet_id, undefined);
  assert.ok(Math.abs(copied.x - drawn.x) < Math.abs(copied.x - tv.x));
  const ids = new Map([['cabinet','copied-cabinet'], ['tv','copied-tv']]);
  const spaceCopy = remapWorkstationItems(items.map(item => ({...item, id:ids.get(item.id)})), ids);
  assert.equal(spaceCopy[1].tv_cabinet_id, spaceCopy[0].id);
  assert.equal(mounted.tv_cabinet_id, cabinet.id);
});

test('every 2.5D camera rotation projects the raised TV at the authored cabinet surface', async () => {
  await FURNITURE_VOLUME_RUNTIME.ensure();
  const lift = tvCabinetSurfaceCm();
  assert.ok(lift > 0);
  assert.equal(lift, furnitureParts(cabinet.symbol).find(part => part.name === 'console-top').top);
  assert.equal(furnitureParts(tv.symbol).find(part => part.name === 'stand-base').bottom, 0);
  const shape = tvOnCabinet(mountedTv(), cabinet);
  for (const rotation of [0, 90, 180, 270]) {
    const camera = isoCameraFor(rotation);
    const floor = furnitureVolume(shape, 1000, 1000, camera);
    const raised = furnitureVolume(shape, 1000, 1000, camera, 1, lift);
    const z = lift * FURNITURE_HEIGHT_SCALE;
    near(raised.height - floor.height, z);
    assert.deepEqual(raised.footprint, floor.footprint);
    const first = volume => volume.mesh.parts.find(part => part.name === 'stand-base').top
      .match(/-?\d+(?:\.\d+)?/g).slice(0,2).map(Number);
    const before = projectPlanPoint(first(floor), 0, camera);
    const after = projectPlanPoint(first(raised), 0, camera);
    const ground = projectPlanPoint([0,0], 0, camera);
    const tabletop = projectPlanPoint([0,0], z, camera);
    near(after[0] - before[0], tabletop[0] - ground[0], .003);
    near(after[1] - before[1], tabletop[1] - ground[1], .003);
  }
});
