import assert from 'node:assert/strict';
import test from 'node:test';
import {physicalViewCamera, canonicalPhysicalCamera,
  presentedView, shouldRebaseViewFrame, acceptedViewFrame, presentedViewPlane} from '../test-build/projection-view-camera.js';
import {isoCameraFor, unprojectFloorPoint, projectedFrame} from '../test-build/iso-projection.js';
import {turnRect, turnPoint, inversePlanRotation} from '../test-build/view-frame.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('#1451 passive preview plane follows the painted packet rather than desired/lazy geometry',()=>{
  const live=isoCameraFor(0),preview={projection:'iso',rotation:90};
  assert.strictEqual(presentedViewPlane(preview,true,null),isoCameraFor(90));
  assert.strictEqual(presentedViewPlane(preview,true,live),isoCameraFor(90));
  assert.equal(presentedViewPlane(preview,false,live),null,'ISO without borders is the Flat floor');
  assert.equal(presentedViewPlane({...preview,projection:'flat'},true,live),null,'a Flat packet is never desired ISO');
  assert.strictEqual(presentedViewPlane(null,false,live),live,'unreplaced live ISO remains visible during settings preparation');
  assert.equal(presentedViewPlane(null,true,null),null);
});

test('#1451 passive preview ISO90 same-fit cold and warm cameras adopt once without a second projection',()=>{
  const rect={x:137,y:209,w:760,h:486},rotation=90,size=[780,927],plane=isoCameraFor(rotation);
  const baseRect=projectedFrame({rect,wallHeight:116.66666666666667},isoCameraFor(0));
  const display=projectedFrame({rect,wallHeight:116.66666666666667},plane);
  const fit={base:[baseRect.x,baseRect.y,baseRect.w,baseRect.h],display,projection:'iso',rotation};
  const frozen=structuredClone(fit),live={...fit,plane,size};
  const canonical=canonicalPhysicalCamera({centerX:723.5,centerY:286.25,pixelsPerUnit:1.3},live);
  const passive={...fit,plane:presentedViewPlane(fit,true,null),size};
  assert.equal(acceptedViewFrame(canonical.viewBox,passive,null),null,'a packet is not an observed pixel stage');
  const accepted=acceptedViewFrame(canonical.viewBox,passive,size);
  for(const source of [accepted,structuredClone(accepted)]) {
    const full=canonicalPhysicalCamera(physicalViewCamera(canonical.viewBox,canonical.zoom,source),live);
    for(const key of ['x','y','w','h'])close(full.viewBox[key],canonical.viewBox[key]);
    const before=presentedView(canonical.viewBox,canonical.zoom,source),after=presentedView(full.viewBox,full.zoom,live);
    for(const key of ['x','y','w','h'])close(before[key],after[key]);
  }
  const wrong=canonicalPhysicalCamera(physicalViewCamera(canonical.viewBox,canonical.zoom,{...passive,plane:null}),live);
  assert.ok(Math.hypot(wrong.viewBox.x-canonical.viewBox.x,wrong.viewBox.y-canonical.viewBox.y)>10,
    'the witness detects treating an already projected preview camera as Flat');
  assert.deepEqual(fit,frozen,'adoption does not rewrite the stored fit or require geometry');
});

test('#1451 passive preview Flat and ISO-no-borders packets keep their exact Flat camera',()=>{
  const rect={x:61,y:184,w:830,h:516},rotation=90,size=[780,927];
  const live={base:[rect.x,rect.y,rect.w,rect.h],display:turnRect(rect,rotation),rotation,plane:null,size};
  const canonical=canonicalPhysicalCamera({centerX:687,centerY:302,pixelsPerUnit:1.4},live);
  for(const [projection,borders] of [['flat',true],['iso',false]]) {
    const fit={...live,projection},passive={...live,plane:presentedViewPlane(fit,borders,isoCameraFor(rotation))};
    const accepted=acceptedViewFrame(canonical.viewBox,passive,size);
    const full=canonicalPhysicalCamera(physicalViewCamera(canonical.viewBox,canonical.zoom,accepted),live);
    for(const key of ['x','y','w','h'])close(full.viewBox[key],canonical.viewBox[key]);
  }
});
test('#1451 cold fit placeholders never establish a presented physical camera',()=>{
  const placeholder={base:[0,0,1000,1000],display:{x:0,y:0,w:1000,h:1000},
    rotation:0,plane:null,size:[1,1]};
  const view={x:61.68498509396136,y:149.17140151219405,w:876.6300298120773,h:891.2405303089452};
  assert.equal(acceptedViewFrame(null,placeholder,null),null);
  assert.equal(acceptedViewFrame(view,{...placeholder,size:[view.w,view.h]},null),null,
    'a scene-unit fit cannot masquerade as the stage pixel dimensions');
  assert.equal(acceptedViewFrame(view,placeholder,[0,793]),null);
  const actual={...placeholder,base:[60,349.5833333333333,880,490.4166666666667],
    display:{x:60,y:349.5833333333333,w:880,h:490.4166666666667}};
  const accepted=acceptedViewFrame(view,actual,[780,793]);
  assert.deepEqual(accepted.size,[780,793]);
  const physical=physicalViewCamera(view,1.0038442331123942,accepted);
  close(physical.pixelsPerUnit,780/view.w);
  const warmed=acceptedViewFrame(view,actual,accepted.size);
  const next=canonicalPhysicalCamera(physical,warmed);
  close(next.viewBox.w,view.w);
  assert.ok(next.viewBox.w<1000,'the camera cannot square876 scene units into768480');
  const oldFalseCamera=physicalViewCamera(view,1,placeholder);
  const oldFailure=canonicalPhysicalCamera(oldFalseCamera,{...actual,size:[view.w,view.h]});
  close(oldFailure.viewBox.w,view.w*view.w);
});
test('#1451 provisional Flat fit becoming the prepared frame rebases the physical camera once',()=>{
  for(const rotation of [90,270]) {
    const square={x:0,y:0,w:1000,h:1000},real={x:-50,y:50,w:1100,h:900};
    const from={base:[0,0,1000,1000],display:turnRect(square,rotation),rotation,plane:null,size:[1440,1007]};
    const to={...from,base:[real.x,real.y,real.w,real.h],display:turnRect(real,rotation)};
    const wanted={centerX:345.05,centerY:486.49,pixelsPerUnit:1.1747};
    const current=canonicalPhysicalCamera(wanted,from);
    assert.equal(shouldRebaseViewFrame(from,to),true);
    // Keeping _view/_zoom while replacing the basis is the original failure.
    assert.ok(Math.abs(physicalViewCamera(current.viewBox,current.zoom,to).pixelsPerUnit-wanted.pixelsPerUnit)>.05);
    const next=canonicalPhysicalCamera(physicalViewCamera(current.viewBox,current.zoom,from),to);
    const actual=physicalViewCamera(next.viewBox,next.zoom,to);
    close(actual.centerX,wanted.centerX);close(actual.centerY,wanted.centerY);
    close(actual.pixelsPerUnit,wanted.pixelsPerUnit);
    assert.equal(shouldRebaseViewFrame(to,{...to}),false,'an already rebased owner is not applied twice');
    assert.equal(shouldRebaseViewFrame(to,{...to,size:[1080,812]}),false,'resize has its own camera owner');
    assert.equal(shouldRebaseViewFrame(from,{...to,rotation:rotation===90?270:90}),false,'rotation orbits rather than projection-rebases');
  }
});
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
