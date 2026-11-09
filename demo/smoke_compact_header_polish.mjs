// #1371: native header/menu/scene regression on synthetic HA transport.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchPanelCold, finish, check, requirePinnedBrowser } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
requirePinnedBrowser('#1371 compact header polish');
const {page,browser}=await launchPanelCold({width:1440,height:1000});
try {
const evidence={widths:[],motion:[],pan:[],editors:[]};
const out='artifacts/compact-header-1371';mkdirSync(out,{recursive:true});
await page.evaluate(async()=>{
 const host=document.getElementById('host');host.replaceChildren();host.style.cssText='width:100%;height:100vh;margin:0;padding:0';
 history.replaceState(null,'','/houseplan');
 const drawer=document.createElement('ha-drawer');drawer.style.cssText='display:block;width:100%;height:100%';
 // Synthetic shell reflects HA drawer.open; the genuine HA shell is checked separately.
 drawer.addEventListener('hass-toggle-menu',()=>drawer.toggleAttribute('open'));
 const panel=document.createElement('houseplan-panel');panel.narrow=true;panel.hass={...window.__mkHass(),dockedSidebar:'always_hidden'};
 panel.route={prefix:'/houseplan',path:''};drawer.append(panel);host.append(drawer);
 await import('/assets/houseplan-panel.js');await customElements.whenDefined('houseplan-panel');
 window.__polishPanel=panel;window.__polishDrawer=drawer;
 window.__card=panel.shadowRoot.querySelector('houseplan-card');
 window.__nativePan=[];for(const name of ['dragstart','pointercancel'])document.addEventListener(name,e=>window.__nativePan.push(e.type),true);
});
await page.waitForFunction(()=>window.__card?._loadOk&&!window.__card._booting);
const card=page.locator('houseplan-panel houseplan-card');
const trigger=card.locator('[data-hp="header-actions-trigger"]');
const menu=card.locator('[data-hp="header-actions-menu"]:not([inert])');
const settle=async()=>{await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);await page.evaluate(async()=>{await document.fonts.ready;await window.__hpTest.settled();for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);});};
const resize=async(width,height=1000)=>{await page.setViewportSize({width,height});await settle();};
const readHeader=()=>page.evaluate(()=>{const r=window.__card.renderRoot,h=r.querySelector('.head'),rect=h.getBoundingClientRect(),visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
 const ys=[...h.querySelectorAll('button,hp-settings-select,[data-hp="space-name"]')].filter(visible).map(e=>{const b=e.getBoundingClientRect();return b.y+b.height/2;}).sort((a,b)=>a-b);
 const centers=[];for(const y of ys)if(!centers.some(c=>Math.abs(c-y)<8))centers.push(y);
 return {width:innerWidth,phase:Number(h.parentElement.dataset.panelFlow),rows:centers.length,head:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width},buttons:[...h.querySelectorAll('button')].filter(visible).map(e=>e.dataset.hp),overflow:h.scrollWidth>h.clientWidth+1};});
for(const width of [1800,1440,1100,900,800,650,500,390,320,500,800,1100,1800]){
 await resize(width);const row=await readHeader();evidence.widths.push(row);
 assert.equal(row.overflow,false);assert.ok(row.rows<=2);
 if(row.phase===5)assert.deepEqual(row.buttons,['panel-menu','header-actions-trigger']);
}
assert.ok(evidence.widths.some(r=>r.phase===4&&r.rows===2),'ordinary second row must remain available');
assert.ok(evidence.widths.some(r=>r.phase===5));
assert.equal(evidence.widths.at(-1).phase,evidence.widths[0].phase);
check('intrinsicOneTwoCompactAndReverse',true);
await resize(390);await trigger.click();await menu.waitFor();
await menu.evaluate(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=220;}));
const geometry=await menu.evaluate(el=>{const c=window.__card,h=c.renderRoot.querySelector('.head').getBoundingClientRect(),r=el.getBoundingClientRect(),b=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,headBottom:h.bottom,fieldLeft:b.left,fieldRight:b.right,fieldBottom:b.bottom,actions:[...el.querySelectorAll('button')].map(b=>b.dataset.action),icons:[...el.querySelectorAll('button .header-menu-label > :first-child')].map(i=>{const r=i.getBoundingClientRect();return[r.width,r.height];}),heights:[...el.children].map(b=>b.getBoundingClientRect().height)};});
assert.ok(Math.abs(geometry.top-geometry.headBottom)<.5);assert.ok(Math.abs(geometry.left-geometry.fieldLeft)<.5&&Math.abs(geometry.right-geometry.fieldRight)<.5);
assert.ok(geometry.bottom<geometry.fieldBottom-40,'short menu leaves visible plan');
for(const action of ['zoom-in','zoom-out','zoom-fit','panel-menu'])assert.equal(geometry.actions.includes(action),false);
assert.ok(geometry.icons.every(([w,h])=>w===18&&h===18));assert.equal(geometry.heights[0],44);assert.ok(geometry.heights.slice(1).every(h=>h===46));
check('contentSizedFullWidthIconMenu',true);
await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__card._headerActionsMenu.open);
assert.equal(await trigger.getAttribute('aria-expanded'),'false');
await page.mouse.move(380,800);
await page.waitForTimeout(180);
const closedPaint=await trigger.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderColor,line:getComputedStyle(el).getPropertyValue('--divider-color').trim(),outline:s.outlineStyle};});
assert.equal(closedPaint.outline,'none');
await trigger.click();await menu.waitFor();
await menu.evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=90;});
const opening=await menu.evaluate(el=>getComputedStyle(el).clipPath);
await trigger.click();
const closing=await card.locator('[data-hp="header-actions-menu"]').evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=0;return {clip:getComputedStyle(el).clipPath,inert:el.inert,duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes()};});
assert.equal(closing.clip,opening);assert.equal(closing.inert,true);assert.equal(closing.duration,220);
assert.ok(closing.frames.every(f=>!f.transform&&!f.scale));
evidence.motion.push({opening,closing});
await trigger.click();await menu.waitFor();await menu.evaluate(el=>el.getAnimations().forEach(a=>{a.finish();}));
await resize(390,420);await menu.waitFor();
assert.equal(await menu.evaluate(el=>el.scrollHeight>el.clientHeight),true);
const at=await menu.boundingBox();await page.mouse.move(at.x+at.width/2,at.y+at.height/2);await page.mouse.wheel(0,250);
await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp="header-actions-menu"]').scrollTop>0);
assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0);
await page.keyboard.press('Escape');await resize(390);
check('interruptedMotionAndBoundedScroll',true);
const sidebar=card.locator('[data-hp="panel-menu"]');
assert.equal(await sidebar.getAttribute('aria-expanded'),'false');await sidebar.click();
await page.waitForFunction(()=>window.__card.panelSidebarOpen);
assert.equal(await sidebar.getAttribute('aria-expanded'),'true');
await page.evaluate(()=>window.__polishDrawer.removeAttribute('open'));
await page.waitForFunction(()=>!window.__card.panelSidebarOpen);
assert.equal(await sidebar.getAttribute('aria-expanded'),'false');
check('sidebarReflectsShellOpenAndExternalClose',true);
for(const mode of ['plan','devices','decor']){
 await clickHeaderAction(card,'mode-'+mode);await settle();
 const controls=await card.locator('.editbar-end').evaluate(el=>[...el.querySelectorAll(':scope > .btn')].map(b=>{const r=b.getBoundingClientRect();return {hp:b.dataset.hp,close:b.classList.contains('barclose'),x:r.x,y:r.y,w:r.width,h:r.height};}).sort((a,b)=>a.y-b.y));
 assert.equal(controls.length,3);assert.equal(controls[0].close,true);
 assert.ok(controls.every(b=>b.w===40&&b.h===40&&b.x===controls[0].x));assert.equal(controls[1].y-controls[0].y,44);assert.equal(controls[2].y-controls[1].y,44);
 evidence.editors.push({mode,controls});
 await card.locator('.editbar-end .barclose').click();await settle();assert.equal(await page.evaluate(()=>window.__card._mode),'view');
}
check('threeEditorsShareVerticalCloseUndoRedo',true);
for(const width of [390,1440]){
 await resize(width);
 for(const delay of [0,50,250,600]){
  const stage=await card.locator('.stage').boundingBox();const x=stage.x+stage.width*.42,y=stage.y+stage.height*.8;
  await page.mouse.dblclick(x,y);if(delay)await page.waitForTimeout(delay);
  const before=await page.evaluate(()=>({...window.__card._viewOr(window.__card._baseVb())}));
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y-35,{steps:6});await page.mouse.up();
  const after=await page.evaluate(()=>({...window.__card._viewOr(window.__card._baseVb())}));
  assert.ok(Math.abs(after.x-before.x)>.05||Math.abs(after.y-before.y)>.05,'native pan after double click '+width+'/'+delay);
  evidence.pan.push({width,delay,before,after});
 }
}
assert.deepEqual(await page.evaluate(()=>window.__nativePan),[]);
check('nativePanAfterDoubleClickAtEveryDelay',true);
for(const [name,colors] of Object.entries({dark:{'--primary-text-color':'#e1e1e1','--card-background-color':'#1c1c1c'},light:{'--primary-text-color':'#212121','--card-background-color':'#ffffff'},custom:{'--primary-text-color':'#d4e7db','--card-background-color':'#142e2b','--primary-color':'#f6be62','--divider-color':'#41605a'}})){
 await page.evaluate(colors=>{for(const [k,v]of Object.entries(colors))document.documentElement.style.setProperty(k,v);},colors);
 await resize(390);await trigger.click();await menu.waitFor();await menu.evaluate(el=>el.getAnimations().forEach(a=>a.finish()));await page.mouse.move(380,900);
 const summary=menu.locator('[data-action="summary-toggle"]');
 assert.equal(await summary.evaluate(el=>getComputedStyle(el).fontWeight),await menu.evaluate(el=>getComputedStyle(el).fontWeight));
 assert.equal(await summary.evaluate(el=>getComputedStyle(el).color),await menu.evaluate(el=>getComputedStyle(el).color));
 await summary.click();await settle();await trigger.click();await menu.waitFor();await page.mouse.move(380,900);
 assert.equal(await menu.locator('[data-action="summary-toggle"]').evaluate(el=>getComputedStyle(el).fontWeight),await menu.evaluate(el=>getComputedStyle(el).fontWeight));
 await page.keyboard.press('Escape');
 const ink=await sidebar.evaluate(el=>getComputedStyle(el).color);await sidebar.hover();
 assert.equal(await sidebar.evaluate(el=>getComputedStyle(el).color),ink);
 assert.equal(await sidebar.evaluate(el=>getComputedStyle(el).boxShadow),'none');
 await card.screenshot({path:out+'/theme-'+name+'.png'});
}
check('themeNeutralSidebarAndSummaryStates',true);
await clickHeaderAction(card,'space-settings');
const spaceDialog=page.locator('hp-dialog[data-kind="space"]');await spaceDialog.waitFor();
const field=spaceDialog.locator('input:not([type="checkbox"]):not([type="radio"])').first();
const originalText=await field.inputValue();
await field.fill('Text selection witness');await field.selectText();
assert.equal(await field.evaluate(el=>el.selectionEnd-el.selectionStart),22);
await field.fill(originalText);
await spaceDialog.locator('[data-hp="dialog-cancel"]').last().click();await spaceDialog.waitFor({state:'detached'});
check('nativeDialogTextSelectionRemainsAvailable',true);
await page.emulateMedia({reducedMotion:'reduce'});await resize(390);await trigger.click();await menu.waitFor();
assert.equal(await menu.evaluate(el=>el.getAnimations().length),0);await page.keyboard.press('Escape');
assert.equal(await card.locator('[data-hp="header-actions-menu"]').count(),0);check('reducedMotionRetiresWithoutAnimation',true);
writeFileSync(out+'/evidence.json',JSON.stringify(evidence,null,2));await finish(browser,{compactHeaderPolish:true});

} finally { await browser.close(); }
