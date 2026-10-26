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
  // The existing gear remains usable during a running transition. Its popup
  // must escape the interpolating header clip and permit a native retarget.
  await page.setViewportSize({width:390,height:900});await wait();
  await page.emulateMedia({reducedMotion:'no-preference'});
  const rapidBefore=await snapshot(),gear=card.locator('[data-hp="header-menu"]');
  await gear.click();
  const plan=await card.locator('[data-hp="header-menu-item"][data-id="mode-plan"]').boundingBox();
  await page.mouse.click(plan.x+plan.width/2,plan.y+plan.height/2);
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('ha-card').dataset.hpMode==='plan');
  const g=await gear.boundingBox();await page.mouse.click(g.x+g.width/2,g.y+g.height/2);
  const menu=await page.evaluate(()=>{
    const c=window.__card,s=c.renderRoot,items=[...s.querySelectorAll('[data-hp="header-menu-item"]')];
    return{busy:c._modeTransitionBusy,overflow:getComputedStyle(s.querySelector('.head')).overflow,
      hits:items.map(e=>{const r=e.getBoundingClientRect(),actual=s.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.dataset.id,hit:e===actual||e.contains(actual)};})};
  });
  writeFileSync('artifacts/plan-rotation-1070/mid-transition-menu.json',JSON.stringify(menu,null,2));
  assert.ok(menu.busy,'Menu proof must exercise a running transition');
  assert.equal(menu.overflow,'visible');assert.ok(menu.hits.length>2&&menu.hits.every(item=>item.hit));
  await card.locator('[data-hp="header-menu-item"][data-id="mode-decor"]').click();await wait();
  assert.equal(await card.locator('ha-card').getAttribute('data-hp-mode'),'decor');
  await card.locator('.head [data-hp="editor-close"]').click();await wait();
  const rapidAfter=await snapshot();
  assert.equal(rapidAfter.camera.zoom,rapidBefore.camera.zoom);
  assert.ok(Object.keys(rapidBefore.camera.view).every(k=>Math.abs(rapidBefore.camera.view[k]-rapidAfter.camera.view[k])<1e-9));
  writeFileSync('artifacts/plan-rotation-1070/phone-mode-trace.json',JSON.stringify({records,menu},null,2));
  console.log('PASS',records.map(r=>({mode:r.mode,target:r.target,reduced:r.reduced,maxBudgetDelta:r.maxBudgetDelta,head:r.end.head})));
}finally{await finish(browser);}
