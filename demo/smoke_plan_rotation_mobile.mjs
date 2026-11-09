import {headerActionTarget,clickHeaderAction} from './helpers/header-actions.mjs';
// #1070: native 320px mode navigation preserves one header/stage budget and
// the saved canonical View camera at90, including the reduced-motion terminal.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,requirePinnedBrowser,finish} from './serve.mjs';
requirePinnedBrowser();
const {page,browser}=await launch({width:320,height:900});
const card=page.locator('houseplan-card');
const wait=async()=>{
  await page.waitForFunction(()=>{const c=window.__card;return !c._booting&&!c._bootSoft&&!c._cameraTransition.active&&!c._modeTransitionBusy&&!c._refitRaf&&!c._pendingRefitSize;});
  await page.evaluate(()=>window.__hpTest.settled());
};
const snapshot=()=>page.evaluate(()=>{
  const c=window.__card, sr=c.renderRoot, height=s=>sr.querySelector(s).getBoundingClientRect().height;
  const stage=sr.querySelector('.stage'), matrix=sr.querySelector('.decorlayer').getScreenCTM();
  const p=new DOMPoint(400,400).matrixTransform(matrix);
  return {mode:sr.querySelector('ha-card').dataset.hpMode, busy:c._modeTransitionBusy,
    head:height('.head'),chrome:height('.editorchrome'),stage:height('.stage'),
    width:stage.clientWidth, point:[p.x,p.y],camera:window.__hpTest.viewFrameSnapshot().camera};
});
// Each shard runs independently; diagnostic writes own their directory.
mkdirSync('artifacts/plan-rotation-1070',{recursive:true});
const records=[];
try{
  await page.addStyleTag({content:'#host{width:auto!important;padding:0!important;margin:0!important}'});
  await page.emulateMedia({reducedMotion:'reduce'});await wait();
  await clickHeaderAction(card,'rotate-right');await wait();
  // Zoom buttons yield their space in the compact header; use the supported gesture.
  const zoomStage = await card.locator('.stage').boundingBox();
  await page.mouse.move(zoomStage.x+zoomStage.width/2,zoomStage.y+zoomStage.height/2);
  await page.keyboard.down('Control'); await page.mouse.wheel(0,-180); await page.keyboard.up('Control'); await wait();
  const b=await card.locator('.stage').boundingBox();
  await page.mouse.move(b.x+b.width*.7,b.y+b.height*.8);await page.mouse.down();
  await page.mouse.move(b.x+b.width*.7+25,b.y+b.height*.8+15,{steps:8});await page.mouse.up();await wait();
  await page.evaluate(()=>{window.__phoneSample=()=>{
    const c=window.__card,s=c.renderRoot,h=x=>s.querySelector(x).getBoundingClientRect().height;
    const matrix=s.querySelector('.decorlayer').getScreenCTM(),p=new DOMPoint(400,400).matrixTransform(matrix);
    return {busy:c._modeTransitionBusy,head:h('.head'),chrome:h('.editorchrome'),stage:h('.stage'),point:[p.x,p.y],camera:window.__hpTest.viewFrameSnapshot().camera};
  };});
  for(const reduced of [false,true])for(const mode of ['plan','devices','decor']){
    await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
    const before=await snapshot(), total=before.head+before.chrome+before.stage;
    for(const target of [mode,'view']){
      await page.evaluate(()=>{window.__phoneTrace=[];window.__phoneTracing=true;const tick=()=>{
        if(!window.__phoneTracing)return;window.__phoneTrace.push(window.__phoneSample());requestAnimationFrame(tick);
      };requestAnimationFrame(tick);});
      if(target==='view')await clickHeaderAction(card,'mode-view');
      else await clickHeaderAction(card,'mode-'+target);
      await wait();const end=await snapshot();
      const trace=await page.evaluate(()=>{window.__phoneTracing=false;return window.__phoneTrace;});
      const maxBudgetDelta=Math.max(...trace.map(s=>Math.abs(s.head+s.chrome+s.stage-total)));
      assert.ok(maxBudgetDelta<1.1,JSON.stringify({mode,target,reduced,maxBudgetDelta,trace}));
      records.push({mode,target,reduced,before,end,maxBudgetDelta,trace});
    }
    const after=await snapshot();
    assert.equal(after.camera.zoom,before.camera.zoom);
    assert.ok(Object.keys(before.camera.view).every(key=>Math.abs(before.camera.view[key]-after.camera.view[key])<1e-9),
      'View canonical camera restores after a two-row header round trip');
    assert.ok(Math.hypot(...after.point.map((n,i)=>n-before.point[i]))<.1,'restored View has no painted point drift');
  }
  // In-flight retarget uses two genuinely painted editor commands. Phone mode
  // and camera round trips above remain at320px; a disclosure's invisible item
  // cannot be a native coordinate target during its opening animation.
  await page.setViewportSize({width:1800,height:900});await wait();
  await page.emulateMedia({reducedMotion:'no-preference'});
  const rapidBefore=await snapshot();
  const plan=await (await headerActionTarget(card,'mode-plan')).boundingBox();
  await page.mouse.click(plan.x+plan.width/2,plan.y+plan.height/2);
  await page.waitForFunction(()=>window.__card._modeTransitionBusy);
  const retargetTarget=await headerActionTarget(card,'mode-decor');
  assert.ok(await page.evaluate(()=>window.__card._modeTransitionBusy), 'retarget remains in-flight');
  assert.ok(await retargetTarget.evaluate(button=>{const r=button.getBoundingClientRect();
    const hit=button.getRootNode().elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return hit===button||button.contains(hit);}), 'retarget is a painted native target');
  const retarget=await retargetTarget.boundingBox();
  await page.mouse.click(retarget.x+retarget.width/2,retarget.y+retarget.height/2);await wait();
  assert.equal(await card.locator('ha-card').getAttribute('data-hp-mode'),'decor');
  await clickHeaderAction(card,'mode-view');await wait();
  const rapidAfter=await snapshot();
  assert.ok(Math.abs(rapidAfter.camera.zoom-rapidBefore.camera.zoom)<1e-12, 'rapid retarget preserves zoom within floating-point precision');
  assert.ok(Object.keys(rapidBefore.camera.view).every(k=>Math.abs(rapidBefore.camera.view[k]-rapidAfter.camera.view[k])<1e-9));
  writeFileSync('artifacts/plan-rotation-1070/phone-mode-trace.json',JSON.stringify({records},null,2));
  console.log('PASS',records.map(r=>({mode:r.mode,target:r.target,reduced:r.reduced,maxBudgetDelta:r.maxBudgetDelta,head:r.end.head})));
}finally{await finish(browser);}
