// #1070: native 320px mode navigation preserves one header/stage budget and
// the saved canonical View camera at90, including the reduced-motion terminal.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
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
const records=[];
try{
  await page.addStyleTag({content:'#host{width:auto!important;padding:0!important;margin:0!important}'});
  await page.emulateMedia({reducedMotion:'reduce'});await wait();
  await card.locator('[data-hp="rotate-right"]').click();await wait();
  await card.locator('[data-hp="zoom-in"]').click();await wait();
  await card.locator('[data-hp="zoom-in"]').click();await wait();
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
      if(target==='view')await card.locator('.head [data-hp="editor-close"]').click();
      else{await card.locator('[data-hp="header-menu"]').click();await card.locator(`[data-hp="header-menu-item"][data-id="mode-${target}"]`).click();}
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
  writeFileSync('artifacts/plan-rotation-1070/phone-mode-trace.json',JSON.stringify(records,null,2));
  console.log('PASS',records.map(r=>({mode:r.mode,target:r.target,reduced:r.reduced,maxBudgetDelta:r.maxBudgetDelta,head:r.end.head})));
}finally{await finish(browser);}
