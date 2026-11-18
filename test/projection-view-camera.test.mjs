import assert from 'node:assert/strict';
import test from 'node:test';
import {logicalViewCenter, reprojectViewPlane} from '../test-build/projection-view-camera.js';
import {isoCameraFor, projectPlanPoint} from '../test-build/iso-projection.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('#1451 off-centre Flat/volume/hidden-borders camera round trips retain floor point and scale', () => {
  const view = {x:137,y:208,w:391,h:267};
  for (const rotation of [0,90,180,270]) {
    const camera=isoCameraFor(rotation);
    const next=reprojectViewPlane(view,null,camera), point=logicalViewCenter(next,camera);
    close(point.x,view.x+view.w/2);close(point.y,view.y+view.h/2);
    const [x,y]=projectPlanPoint([point.x,point.y],0,camera);
    close(next.x+next.w/2,x);close(next.y+next.h/2,y);
    assert.equal(next.w,view.w);assert.equal(next.h,view.h);
    const flat=reprojectViewPlane(next,camera,null);
    for(const key of ['x','y','w','h'])close(flat[key],view[key]);
    assert.deepEqual(view,{x:137,y:208,w:391,h:267});
  }
});
test('#1451 warm viewport plane is explicit, independent of desired mode and lazy readiness',()=>{
  assert.equal(logicalViewCenter(null,isoCameraFor(0)),null);
  const view={x:-32,y:95,w:200,h:180};
  assert.deepEqual(reprojectViewPlane(view,null,null),view);
  const plane=isoCameraFor(0), iso=reprojectViewPlane(view,null,plane);
  const same=reprojectViewPlane(iso,plane,plane);
  close(same.x,iso.x);close(same.y,iso.y);
});
