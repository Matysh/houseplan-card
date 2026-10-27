// Author proof: genuine pinned HA elements, the exact product bundle, synthetic
// wire fixture and explicitly measured dashboard gutters. No product adapters.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright/test';
import {createLabServer} from './ui-lab/server.mjs';
import {attestLaunchedBrowser} from '../scripts/browser-attestation.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
const haCache=process.argv.find(arg=>arg.startsWith('--ha-cache='))?.slice('--ha-cache='.length);
const proof='artifacts/plan-rotation-1070';mkdirSync(proof,{recursive:true});
const server=createLabServer({repoRoot:process.cwd(),...(haCache?{haCache}:{}),port:0});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser,provenance;const records=[],traces=[],errors=[],external=[],captured=new Set();
try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({args:['--no-sandbox']});
  await attestLaunchedBrowser(browser,{reason:'1070 actual HA combined phone layout'});
  const page=await browser.newPage({viewport:{width:320,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin===origin||['data:','blob:'].includes(u.protocol))return route.continue();
    external.push(u.href);return route.abort('blockedbyclient');
  });
  await page.goto(origin);
  await page.waitForFunction(()=>window.__labHa?.authenticCard&&window.__lab?.card?._loadOk);
  provenance=await page.evaluate(async()=>await(await fetch('/provenance.json')).json());
  await page.evaluate(()=>{
    const mock=window.__lab.mock;
    const host=document.createElement('div');host.id='native-phone-host';
    host.style.cssText='box-sizing:border-box;width:100%;padding:8px;min-width:0';
    const card=document.createElement('houseplan-card');
    card.setConfig({type:'custom:houseplan-card',rotation:90,language:'en'});
    card.hass=mock.hass;mock.attach(card);
    const chrome=document.createElement('div');chrome.id='native-ha-toolbar';
    chrome.style.height='56px';chrome.setAttribute('aria-hidden','true');
    host.append(card);document.body.replaceChildren(chrome,host);window.__card=card;
  });
  await installHpTestOnPage(page);
  const card=page.locator('houseplan-card');
  const wait=async()=>{
    await page.waitForFunction(()=>{const c=window.__card;return c._loadOk&&!c._booting&&!c._bootSoft
      &&!c._cameraTransition.active&&!c._modeTransitionBusy&&!c._refitRaf&&!c._pendingRefitSize;});
    await page.evaluate(()=>window.__hpTest.settled());
  };
  await wait();await assertFreshDemoBundle(page);
  assert.equal(await card.locator('[data-hp="space-select"]').count(),1,'Actual accepted997 field is required');
  await page.emulateMedia({reducedMotion:'reduce'});
  const inspect=()=>page.evaluate(()=>{
    const c=window.__card,s=c.renderRoot,head=s.querySelector('.head'),native=s.querySelector('ha-card');
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    const floor=s.querySelector('[data-hp="space-select"]').shadowRoot.querySelector('button[data-hp="select-trigger"]');
    const controls=[floor,...head.querySelectorAll('.zoomctl button'),head.querySelector('[data-hp="header-menu"]')];
    const close=head.querySelector('[data-hp="editor-close"]');
    const hit=target=>{
      const r=rect(target),x=r.x+r.w/2,y=r.y+r.h/2;
      let actual=s.elementFromPoint(x,y),next;
      while(actual?.shadowRoot&&(next=actual.shadowRoot.elementFromPoint(x,y))&&next!==actual)actual=next;
      let inside=false;for(let n=actual;n;n=n.parentNode||n.getRootNode()?.host){if(n===target){inside=true;break;}}
      return{inside,tag:actual?.tagName,hook:actual?.getAttribute?.('data-hp')};
    };
    const style=getComputedStyle(native),host=document.getElementById('native-phone-host');
    return{mode:native.dataset.hpMode,viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      host:rect(host),hostPadding:getComputedStyle(host).padding,card:rect(native),head:rect(head),
      externalToolbar:rect(document.getElementById('native-ha-toolbar')),
      borders:[parseFloat(style.borderLeftWidth),parseFloat(style.borderRightWidth)],
      targets:controls.map((e,i)=>({id:i===0?'floor':e.dataset.hp,...rect(e),hit:hit(e)})),
      close:close?{...rect(close),hit:hit(close)}:null,
      rotation:s.querySelector('.stage').dataset.hpPlanRotation,
      locale:document.documentElement.lang,ha:window.__labHa.version};
  });
  const validate=r=>{
    assert.equal(r.rotation,'90');assert.ok(r.scroll<=r.viewport,JSON.stringify(r));
    assert.ok(Math.abs(r.card.w-(r.viewport-2*parseFloat(r.hostPadding)))<.1,JSON.stringify(r));
    assert.ok(Math.abs(r.head.w-(r.card.w-r.borders[0]-r.borders[1]))<.1,JSON.stringify(r));
    const targets=r.close?[...r.targets,{id:'close',...r.close}]:r.targets;
    for(const t of targets){
      const size=t.id==='close'?24:44;
      assert.ok(t.w>=size-.01&&t.h>=size-.01&&t.hit.inside,JSON.stringify({r,t}));
      assert.ok(t.x>=r.head.x-.1&&t.right<=r.head.right+.1&&t.y>=r.head.y-.1&&t.bottom<=r.head.bottom+.1,JSON.stringify({r,t}));
    }
    for(let i=0;i<targets.length;i++)for(const b of targets.slice(i+1)){
      const a=targets[i],dx=Math.min(a.right,b.right)-Math.max(a.x,b.x),dy=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
      assert.ok(dx<=1.01||dy<=1.01,'Only common1px border strokes may coincide: '+JSON.stringify({a,b}));
    }
    const rows=[];for(const t of targets){const y=t.y+t.h/2;if(!rows.some(v=>Math.abs(v-y)<1))rows.push(y);}
    if(r.mode==='view'||r.viewport>=360)assert.ok(rows.length===1&&r.head.h<=56,JSON.stringify(r));
    else assert.ok(rows.length<=2,JSON.stringify(r));
  };
  const capture=async r=>{
    const id=`native-${r.viewport}-${parseFloat(r.hostPadding)}-${r.mode}`;
    if(![320,360].includes(r.viewport)||r.hostPadding!=='8px'||captured.has(id))return;
    captured.add(id);await page.mouse.move(1,1);
    await page.screenshot({path:`${proof}/${id}.png`});
  };
  for(const width of [320,359,360,390,480])for(const inset of [0,8]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(inset=>document.getElementById('native-phone-host').style.padding=`${inset}px`,inset);await wait();
    let r=await inspect();validate(r);records.push(r);await capture(r);
    for(const mode of ['plan','devices','decor']){
      await card.locator('[data-hp="header-menu"]').click();
      await card.locator(`[data-hp="header-menu-item"][data-id="mode-${mode}"]`).click();await wait();
      r=await inspect();validate(r);records.push(r);await capture(r);
      await card.locator('.head [data-hp="editor-close"]').click();await wait();
      r=await inspect();validate(r);records.push(r);
    }
    const trigger=card.locator('[data-hp="space-select"] [data-hp="select-trigger"]');
    await trigger.click();await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp="space-select"]').shadowRoot.querySelector('[role="listbox"]').classList.contains('visible'));
    const menu=await card.locator('[data-hp="space-select"] [role="listbox"]').boundingBox();
    assert.ok(menu.x>=0&&menu.x+menu.width<=width+.1);
    await page.keyboard.press('Escape');await wait();
    assert.ok(await trigger.evaluate(e=>e.getRootNode().activeElement===e));
  }
  await page.setViewportSize({width:320,height:900});
  await page.evaluate(()=>document.getElementById('native-phone-host').style.padding='8px');await wait();
  await card.locator('[data-hp="zoom-in"]').click();await wait();
  await card.locator('[data-hp="zoom-in"]').click();await wait();
  const panBefore=await page.evaluate(()=>window.__hpTest.viewFrameSnapshot().camera.view);
  const stage=await card.locator('.stage').boundingBox();
  await page.mouse.move(stage.x+stage.width*.7,stage.y+stage.height*.8);await page.mouse.down();
  await page.mouse.move(stage.x+stage.width*.7+25,stage.y+stage.height*.8+15,{steps:8});await page.mouse.up();await wait();
  const panAfter=await page.evaluate(()=>window.__hpTest.viewFrameSnapshot().camera.view);
  assert.ok(Math.hypot(panAfter.x-panBefore.x,panAfter.y-panBefore.y)>1e-3,'Native pan must move the canonical camera');
  await page.evaluate(()=>{window.__nativeSample=()=>{
    const c=window.__card,s=c.renderRoot,h=selector=>s.querySelector(selector).getBoundingClientRect().height;
    const p=new DOMPoint(400,400).matrixTransform(s.querySelector('.decorlayer').getScreenCTM());
    return{busy:c._modeTransitionBusy,head:h('.head'),chrome:h('.editorchrome'),stage:h('.stage'),
      point:[p.x,p.y],camera:window.__hpTest.viewFrameSnapshot().camera};
  };});
  for(const reduced of [false,true])for(const mode of ['plan','devices','decor']){
    await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
    const before=await page.evaluate(()=>window.__nativeSample()),total=before.head+before.chrome+before.stage;
    assert.ok(before.camera.zoom>1&&before.camera.view,'Actual nonzero View camera is required');
    for(const target of [mode,'view']){
      await page.evaluate(()=>{window.__nativeTrace=[];window.__nativeTracing=true;const tick=()=>{
        if(!window.__nativeTracing)return;window.__nativeTrace.push(window.__nativeSample());requestAnimationFrame(tick);
      };requestAnimationFrame(tick);});
      if(target==='view')await card.locator('.head [data-hp="editor-close"]').click();
      else{await card.locator('[data-hp="header-menu"]').click();await card.locator(`[data-hp="header-menu-item"][data-id="mode-${target}"]`).click();}
      await wait();const end=await page.evaluate(()=>window.__nativeSample());
      const trace=await page.evaluate(()=>{window.__nativeTracing=false;return window.__nativeTrace;});
      const maxBudgetDelta=Math.max(...trace.map(s=>Math.abs(s.head+s.chrome+s.stage-total)));
      traces.push({mode,target,reduced,before,end,maxBudgetDelta,trace});
      assert.ok(maxBudgetDelta<1.1,JSON.stringify(traces.at(-1)));
      const r=await inspect();validate(r);records.push(r);
    }
    const after=await page.evaluate(()=>window.__nativeSample());
    assert.equal(after.camera.zoom,before.camera.zoom);
    assert.ok(Object.keys(before.camera.view).every(k=>Math.abs(before.camera.view[k]-after.camera.view[k])<1e-9));
    assert.ok(Math.hypot(...after.point.map((v,i)=>v-before.point[i]))<.1);
  }
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  writeFileSync(`${proof}/native-phone-layout.json`,JSON.stringify({provenance,records,traces,errors,external,
    context:'Official pinned HA elements; declared external56px toolbar and0/8px dashboard gutters. Synthetic fixture; no real HA connection.'},null,2));
}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS',records.length,'actual HA layout states',traces.length,'camera transitions');
