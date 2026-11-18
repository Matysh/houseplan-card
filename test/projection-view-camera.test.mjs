import assert from 'node:assert/strict';
import test from 'node:test';
import {physicalViewCamera, canonicalPhysicalCamera,
  presentedView} from '../test-build/projection-view-camera.js';
import {isoCameraFor, unprojectFloorPoint} from '../test-build/iso-projection.js';
import {turnRect, turnPoint, inversePlanRotation} from '../test-build/view-frame.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
for (const rotation of [0,90,180,270]) {
  const flatRect={x:63,y:146,w:742,h:613};
  // Deliberately asymmetric elevated bounds: the displayed/canonical centres
  // differ, as actual wall extrusion does. Merely unprojecting _view fails.
  const volume={base:[172,181,761,548],display:rotation===0
    ?{x:172,y:181,w:761,h:548}:{x:118+rotation/3,y:92,w:617,h:703},
    rotation,plane:isoCameraFor(rotation),size:[1440,910]};
  const flat={base:[flatRect.x,flatRect.y,flatRect.w,flatRect.h],
    display:turnRect(flatRect,rotation),rotation,plane:null,size:[1440,910]};
  test(`#1451 presented quarter ${rotation}: off-centre full-frame roundtrip and narrower editor preserve physical camera`,()=>{
    const wanted={centerX:317.25,centerY:681.375,pixelsPerUnit:1.73};
    const start=canonicalPhysicalCamera(wanted,volume);
    const original=structuredClone(start), originalFrame=structuredClone(volume);
    for(const target of [flat,{...flat,size:[1080,812]},volume]) {
      const next=canonicalPhysicalCamera(physicalViewCamera(start.viewBox,start.zoom,volume),target);
      const shown=presentedView(next.viewBox,next.zoom,target);
      const point=[shown.x+shown.w/2,shown.y+shown.h/2];
      const actual=target.plane?unprojectFloorPoint(point,target.plane)
        :turnPoint(point,inversePlanRotation(rotation));
      close(actual[0],wanted.centerX);close(actual[1],wanted.centerY);
      close(target.size[0]/shown.w,wanted.pixelsPerUnit);
      close(target.size[1]/shown.h,wanted.pixelsPerUnit);
    }
    assert.deepEqual(start,original);assert.deepEqual(volume,originalFrame);
  });
  test(`#1451 presented quarter ${rotation}: source frame uses latest panned viewport rather than stale centre`,()=>{
    const initial=canonicalPhysicalCamera({centerX:270,centerY:640,pixelsPerUnit:2},volume);
    const panned={...initial.viewBox,x:initial.viewBox.x+93,y:initial.viewBox.y-47};
    const shown=presentedView(panned,initial.zoom,volume);
    const actual=unprojectFloorPoint([shown.x+shown.w/2,shown.y+shown.h/2],volume.plane);
    const camera=physicalViewCamera(panned,initial.zoom,volume);
    close(camera.centerX,actual[0]);close(camera.centerY,actual[1]);
    const warm=structuredClone(volume);
    const next=canonicalPhysicalCamera(camera,warm);
    for(const key of ['x','y','w','h'])close(next.viewBox[key],panned[key]);
  });
}
