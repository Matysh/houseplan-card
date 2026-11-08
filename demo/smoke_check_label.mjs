// #1350: native clicks on actual check-row labels, genuine HA + checkbox fallback.
// The HA assets are the verified UI Lab pin; no HA server or device is accessed.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium,expect} from 'playwright/test';
import {createLabServer} from './ui-lab/server.mjs';
import {launch,checkAll,finish} from './serve.mjs';
import {attestLaunchedBrowser} from '../scripts/browser-attestation.mjs';
const results=[];
async function exercise(page,authentic){
  await page.evaluate(async authentic=>{
    const c=authentic?window.__lab.card:window.__card;window.__label1350=c;
    await c._ensureEditorRuntime();c._setMode('plan');
    while(c._modeTransitionBusy)await new Promise(r=>requestAnimationFrame(r));
    const door=c._openingsR.find(o=>o.type==='door');
    if(!door)throw Error('fixture must contain a real saved door');
    c._editorRuntime._editOpening(door);await c.updateComplete;
  },authentic);
  const selector='[data-field="opening-flip-horizontal"]';
  const control=page.locator('hp-dialog[data-kind="opening"] '+selector);
  const row=page.locator('hp-dialog[data-kind="opening"] label').filter({has:page.locator(selector)});
  const text=row.locator(':scope > span').first();
  await expect(control).toBeVisible();
  assert.equal(await control.evaluate(el=>el.localName),authentic?'ha-switch':'input');
  await control.evaluate(el=>{window.__label1350Changes=0;el.addEventListener('change',()=>window.__label1350Changes++);});
  const read=()=>control.evaluate(el=>({checked:el.checked,changes:window.__label1350Changes,draft:window.__label1350._openingDialog.flipH}));
  const initial=await read();
  const change=async(name,action)=>{
    const before=await read();await action();
    await page.waitForFunction(v=>window.__label1350._openingDialog?.flipH===v,!before.draft);
    const after=await read();assert.equal(after.checked,!before.checked,name);
    assert.equal(after.changes,before.changes+1,name+' must produce exactly one change');
    results.push((authentic?'HA ':'native ')+name);
  };
  await change('label on/off',()=>text.click());
  await change('label back',()=>text.click());
  await change('control click',()=>control.click());
  await change('Space',async()=>{await control.focus();await page.keyboard.press('Space');});
  await page.evaluate(async()=>{const c=window.__label1350;c.requestUpdate();await c.updateComplete;});
  await change('rerender keeps one activation',()=>text.click());
  await text.evaluate(el=>{const span=document.createElement('span');span.textContent=el.textContent;el.replaceChildren(span);});
  await change('nested caption',()=>text.locator('span').click());
  // Supply a disabled form condition through the real renderer, without
  // replacing the control or its behavior with a test double.
  await page.evaluate(async()=>{
    const c=window.__label1350,r=c._editorRuntime,original=r._boolInput;
    window.__label1350Original=original;
    r._boolInput=function(value,change,disabled,field){return original.call(this,value,change,disabled||field==='opening-flip-horizontal',field);};
    c.requestUpdate();await c.updateComplete;
  });
  await expect(control).toHaveJSProperty('disabled',true);
  assert.equal(await text.evaluate(el=>getComputedStyle(el).cursor),'not-allowed');
  const disabled=await read(),captionBox=await text.boundingBox();assert.ok(captionBox);
  await page.mouse.click(captionBox.x+captionBox.width/2,captionBox.y+captionBox.height/2);
  const box=await control.boundingBox();assert.ok(box);
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.waitForTimeout(80);assert.deepEqual(await read(),disabled,'disabled caption and control remain inert');
  results.push((authentic?'HA ':'native ')+'disabled caption/control');
  await page.evaluate(async()=>{const c=window.__label1350;c._editorRuntime._boolInput=window.__label1350Original;c.requestUpdate();await c.updateComplete;});
  await expect(control).toHaveJSProperty('disabled',false);
  assert.equal(await text.evaluate(el=>getComputedStyle(el).cursor),'pointer');
  // Independent actions inside a check row must retain their own command.
  await row.evaluate(async el=>{
    const link=document.createElement('a');link.href='#label-probe';link.dataset.labelProbe='link';link.textContent='Independent link';
    window.__label1350Links=0;link.addEventListener('click',()=>window.__label1350Links++);el.append(link);
    const help=document.createElement('hp-help');help.dataset.labelProbe='help';help.text='Independent help';help.ariaLabel='Independent help';el.append(help);await help.updateComplete;
  });
  const separate=await read();await row.locator('[data-label-probe="link"]').click();
  assert.equal(await page.evaluate(()=>window.__label1350Links),1);assert.deepEqual(await read(),separate);
  await row.locator('hp-help button').hover();
  await expect(row.locator('hp-help button')).toHaveAttribute('aria-expanded','true');
  await row.locator('hp-help button').click();
  await expect(row.locator('hp-help button')).toHaveAttribute('aria-expanded','false');
  assert.deepEqual(await read(),separate,'Help does not toggle the value');
  await row.evaluate(el=>el.querySelectorAll('[data-label-probe]').forEach(n=>n.remove()));
  results.push((authentic?'HA ':'native ')+'independent link/help');
  await change('reenabled label',()=>text.click());
  const saved=await read(),doorId=await page.evaluate(()=>window.__label1350._openingDialog.id);
  await page.locator('hp-dialog[data-kind="opening"] [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(({id,value})=>{const c=window.__label1350;return !c._openingDialog&&!!c._curSpaceCfg.openings.find(o=>o.id===id)?.flip_h===value;},{id:doorId,value:saved.checked});
  await page.evaluate(async id=>{const c=window.__label1350;c._editorRuntime._editOpening(c._openingsR.find(o=>o.id===id));await c.updateComplete;},doorId);
  await expect(control).toHaveJSProperty('checked',saved.checked);
  assert.notEqual(saved.checked,initial.checked,'saved result must differ from the original door');
  results.push((authentic?'HA ':'native ')+'save and reopen');
}
async function genuine(){
  const server=createLabServer({port:0});server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),errors=[],external=[];
  try{
    await attestLaunchedBrowser(browser,{reason:'#1350 genuine HA switch label activation'});
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin||['data:','blob:'].includes(u.protocol))return route.continue();external.push(u.origin+u.pathname);return route.abort();});
    await page.goto(origin);await page.waitForFunction(()=>window.__lab?.card?._devices?.length>0);
    await page.evaluate(async()=>{
      const require=window.__hpHaRequire,index=await(await fetch('/ha-modules.json')).json(),visited=new Set(),loaded=new Set();
      async function prepare(id){if(visited.has(id))return;visited.add(id);const item=index[id];if(!item){if(!require.m[id])throw Error('Missing HA module '+id);return;}
        if(!require.m[id]&&!loaded.has(item.file)){const chunk=await import('/frontend_latest/'+item.file);Object.assign(require.m,chunk.__webpack_modules__);chunk.__rspack_esm_runtime?.(require);loaded.add(item.file);}
        for(const dependency of item.dependencies)await prepare(dependency);}
      await prepare('41850');await require('41850');await customElements.whenDefined('ha-switch');
    });
    await exercise(page,true);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
await genuine();
const {page,browser}=await launch({width:1280,height:1000});
try{
  const {currentGraphFixture}=await import('./helpers/graph-fixture.mjs');
  const {makeStaticWallOpeningsFixture}=await import('./fixtures/static-wall-openings.mjs');
  const config=currentGraphFixture(makeStaticWallOpeningsFixture());
  await page.evaluate(async cfg=>{await window.__hpTest.setServerConfig(cfg);await window.__hpTest.switchSpace('f1');},config);
  await exercise(page,false);
}catch(error){await browser.close();throw error;}
const out=Object.fromEntries(results.map(name=>[name,true]));
checkAll(out);await finish(browser,out);
