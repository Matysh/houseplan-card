import test from 'node:test';
import assert from 'node:assert/strict';
import { screenFreeArea, screenCameraTarget, onScreenReference, screenZoomBadge } from '../test-build/screen-camera.js';
import { turnRect, presentationViewport } from '../test-build/view-frame.js';
import { spaceSwipeTargetForOwner } from '../test-build/logic.js';
import {projectedFrame, isoCameraFor, isoDisplayWallHeight} from '../test-build/iso-projection.js';
import {physicalViewCamera, canonicalPhysicalCamera} from '../test-build/projection-view-camera.js';

test('#1451 orthographic screen profiles centre projected bounds beside right and bottom panels', () => {
  const rect={x:123,y:192,w:760,h:486},size=[1440,1007];
  const canonical=projectedFrame({rect,wallHeight:isoDisplayWallHeight()},isoCameraFor(0));
  const vb=[canonical.x,canonical.y,canonical.w,canonical.h];
  for(const rotation of [90,270]) {
    const plane=isoCameraFor(rotation), display=projectedFrame({rect,wallHeight:isoDisplayWallHeight()},plane);
    for(const free of [{x:0,y:0,w:1100,h:1007},{x:0,y:0,w:1440,h:720}]) {
      const target=screenCameraTarget(vb,display,rotation,size,free,1,plane.floorScaleY);
      const shown=presentationViewport(target.camera.viewBox,vb,display,rotation,target.camera.zoom,size,null,plane.floorScaleY);
      const ppu=size[0]/shown.w;
      assert.ok(Math.abs((display.x+display.w/2-shown.x)*ppu-(free.x+free.w/2))<1e-8);
      assert.ok(Math.abs((display.y+display.h/2-shown.y)*ppu-(free.y+free.h/2))<1e-8);
      assert.ok(Math.abs(ppu-target.pixelsPerUnit)<1e-10);
    }
  }
});

test('#1451 manual screen camera keeps physical scale across projection changes and same-plane resize', () => {
  const rect={x:123,y:192,w:760,h:486},size=[1440,1007],free={x:0,y:0,w:1100,h:1007};
  const canonical=projectedFrame({rect,wallHeight:isoDisplayWallHeight()},isoCameraFor(0));
  const vb=[canonical.x,canonical.y,canonical.w,canonical.h];
  for(const rotation of [90,270]) {
    const plane=isoCameraFor(rotation), display=projectedFrame({rect,wallHeight:isoDisplayWallHeight()},plane);
    const volume={base:vb,display,rotation,plane,size};
    const flat={base:[rect.x,rect.y,rect.w,rect.h],display:turnRect(rect,rotation),rotation,plane:null,size};
    const reference=screenCameraTarget(vb,display,rotation,size,free,1,plane.floorScaleY);
    const pan={...reference.camera.viewBox,x:reference.camera.viewBox.x+60,y:reference.camera.viewBox.y-20};
    const physical=physicalViewCamera(pan,reference.camera.zoom,volume);
    let current={zoom:reference.camera.zoom,viewBox:pan}, source=volume;
    for(const target of [flat,{...flat,size:[1080,812]}, {...volume,size:[1080,812]},volume]) {
      current=canonicalPhysicalCamera(physicalViewCamera(current.viewBox,current.zoom,source),target);
      const actual=physicalViewCamera(current.viewBox,current.zoom,target);
      assert.ok(Math.abs(actual.centerX-physical.centerX)<1e-8);
      assert.ok(Math.abs(actual.centerY-physical.centerY)<1e-8);
      assert.ok(Math.abs(actual.pixelsPerUnit-physical.pixelsPerUnit)<1e-10);
      source=target;
    }
  }
});

test('#1165 physical profile fit centres in the free area at every rotation and zoom', () => {
  const vb = [-300, 20, 1800, 700], bounds = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  for (const rotation of [0, 90, 180, 270]) for (const size of [[1280, 720], [360, 760]]) {
    const display = turnRect(bounds, rotation);
    for (const panel of [null, { side: 'right', rect: { x: 900, y: 12, w: 368, h: 500 } },
      { side: 'bottom', rect: { x: 0, y: 550, w: 360, h: 198 } }]) {
      const free = screenFreeArea(...size, panel);
      for (const zoom of [.1, .5, 1, 2, 10]) {
        const target = screenCameraTarget(vb, display, rotation, size, free, zoom);
        const view = presentationViewport(target.camera.viewBox, vb, display, rotation, target.camera.zoom, size, null);
        const ppu = size[0] / view.w;
        assert.ok(Math.abs(ppu / target.pixelsPerUnit - 1) < 1e-10);
        assert.ok(Math.abs((display.x + display.w / 2 - view.x) * ppu - (free.x + free.w / 2)) < 1e-8);
        assert.ok(Math.abs((display.y + display.h / 2 - view.y) * ppu - (free.y + free.h / 2)) < 1e-8);
        assert.equal(onScreenReference(target.camera, target), true);
        assert.deepEqual(screenZoomBadge(target.camera, target), { percent: Math.round(zoom * 100), hidden: zoom === 1 });
      }
    }
  }
});

test('#1165 no double subtraction, invalid geometry waits, reference tolerances are physical', () => {
  assert.deepEqual(screenFreeArea(800, 600, { side:'right', rect:{x:812,y:0,w:300,h:600} }), {x:0,y:0,w:800,h:600});
  const vb=[0,0,1000,1000], display={x:0,y:0,w:1000,h:1000}, free={x:0,y:0,w:800,h:600};
  assert.equal(screenCameraTarget(vb, display, 0, [0,600], free, 1), null);
  const ref=screenCameraTarget(vb,display,0,[800,600],free,2), current=structuredClone(ref.camera);
  current.viewBox.x += .99/ref.pixelsPerUnit;
  assert.equal(onScreenReference(current,ref),true);
  current.viewBox.x += .02/ref.pixelsPerUnit;
  assert.equal(onScreenReference(current,ref),false);
  assert.equal(onScreenReference(ref.camera,ref,true),false);
  const scaled=structuredClone(ref.camera); scaled.viewBox.w/=1.0002;
  assert.equal(onScreenReference(scaled,ref),false);
});

test('#1165 release honours the reference gesture owner at 50/200/1000 percent', () => {
  for(const zoom of [.5,2,10]) {
    assert.equal(spaceSwipeTargetForOwner('swipe',-90,1,zoom,['a','b'],'a',true),'b');
    assert.equal(spaceSwipeTargetForOwner('swipe',-90,1,zoom,['a','b'],'a',false),null);
    assert.equal(spaceSwipeTargetForOwner('pan',-90,1,zoom,['a','b'],'a',true),null);
  }
});
