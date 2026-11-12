// #948 shared menu: keyboard, real top-layer and portal fallback, close motion and live HA themes.
import {launch,checkAll,finish} from './serve.mjs';
const {page,browser}=await launch({width:390,height:800});page.setDefaultTimeout(10000);
const out={},card=page.locator('houseplan-card');
try {
 await page.evaluate(async()=>{window.__card.shadowRoot.querySelector('[data-hp="settings"]').click();await window.__hpTest.settled();});
 const dialog=card.locator('hp-dialog[data-kind="settings"][settings-layout]');
 const navigation=dialog.locator('.hpf-settings-mobile hp-settings-select');
 const trigger=navigation.locator('button');
 await trigger.click();
 out.openListbox=await navigation.locator('[role="listbox"]').isVisible();
 const options=navigation.locator('[role="option"]');
 const hover=options.locator('visible=true').nth(1);
 const before=await hover.boundingBox();await hover.hover();await page.waitForTimeout(180);
 out.hoverHasOwnInsetOutline=await hover.evaluate(el=>getComputedStyle(el).boxShadow.includes('inset')
   &&getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)');
 const after=await hover.boundingBox();
 out.hoverKeepsRowBounds=before.width===after.width&&before.height===after.height;
 out.selectedKeepsOwnFill=await options.filter({has:page.locator('.check')}).count()>0
   ||await options.evaluateAll(rows=>rows.some(el=>el.getAttribute('aria-selected')==='true'
     &&getComputedStyle(el).backgroundColor!=='rgba(0, 0, 0, 0)'));
 await page.mouse.move(0,0);
 out.openAnimation=await navigation.locator('[role="listbox"]').evaluate(async el=>{
  await new Promise(requestAnimationFrame);
  const animation=el.getAnimations().find(a=>a.effect?.getTiming().duration===180);
  return animation?.effect.getTiming().easing==='ease-out' && animation.effect.getKeyframes()[0].translate==='0px -10px';
 });
 out.optionHoverTransition=await navigation.locator('[role="option"]').first().evaluate(el=>getComputedStyle(el).transitionDuration.split(',').every(value=>value.trim()==='0.16s'));
 await navigation.locator('[role="listbox"]').press('End');
 await navigation.locator('[role="listbox"]').press('Enter');
 out.keyboardChoosesSection=await dialog.locator('[data-settings-section="data"]').isVisible();
 out.focusRestored=await trigger.evaluate(el=>el.getRootNode().activeElement===el);
 out.closingMenuStillPresent=await navigation.locator('.menu').isVisible();
 await page.waitForTimeout(180);
 out.menuClosedAfterTransition=!(await navigation.locator('.menu').isVisible());
 // Capability fallback: disable only the browser API, leaving the product/controller unmodified.
 await page.evaluate(()=>{window.__selectNativePopover={show:HTMLElement.prototype.showPopover,hide:HTMLElement.prototype.hidePopover};HTMLElement.prototype.showPopover=undefined;HTMLElement.prototype.hidePopover=undefined;});
 await trigger.click();
 const portal=dialog.locator('[data-hp-overlay="select"]');
 out.fallbackIsDialogOwned=await portal.count()===1 && await portal.locator('[role="listbox"]').isVisible();
 await portal.locator('[role="listbox"]').press('Home');
 await portal.locator('[role="listbox"]').press('ArrowDown');
 await portal.locator('[role="listbox"]').press('Enter');
 out.fallbackKeyboardMovesExactlyOnce=await dialog.locator('[data-settings-section="plan"]').isVisible();
 await page.waitForTimeout(180);
 out.fallbackPortalRemoved=await portal.count()===0;
 const menu=dialog.locator('hp-settings-select:has(select[name="gs-bg-mode"])');
 await menu.locator('button').click();
 await dialog.locator('[data-hp-overlay="select"] [role="listbox"]').press('Escape');
 out.escapeClosesOnlyMenu=await dialog.count()===1 && await menu.locator('button').getAttribute('aria-expanded')==='false';
 await page.waitForTimeout(180);
 const colours=[];
 for(const [surface,text,accent] of [['#ffffff','#17212b','#007d93'],['#17212b','#ffffff','#5bcce6'],['#f5f0ff','#231235','#a32191']]){
  await card.evaluate((el,{surface,text,accent})=>{el.style.setProperty('--card-background-color',surface);el.style.setProperty('--primary-text-color',text);el.style.setProperty('--primary-color',accent);},{surface,text,accent});
  colours.push(await menu.locator('button').evaluate(async el=>{
   await new Promise(requestAnimationFrame);
   await Promise.allSettled(el.getAnimations().map(animation=>animation.finished));
   return getComputedStyle(el).color;
  }));
 }
 out.dynamicTheme=new Set(colours).size===3;
 await menu.locator('button').click();
 await dialog.locator('.hpf-head h3').filter({visible:true}).click();
 out.outsideCloses=await menu.locator('button').getAttribute('aria-expanded')==='false';
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(180);
 await menu.locator('button').click();
 out.reducedMotion=await dialog.locator('[data-hp-overlay="select"] .menu').evaluate(el=>getComputedStyle(el).transitionDuration==='0s');
 out.optionReducedMotion=await dialog.locator('[data-hp-overlay="select"] [role="option"]').first().evaluate(el=>getComputedStyle(el).transitionDuration==='0s');
 await dialog.locator('[data-hp-overlay="select"] [role="listbox"]').press('Escape');
 await page.evaluate(()=>{Object.assign(HTMLElement.prototype,{showPopover:window.__selectNativePopover.show,hidePopover:window.__selectNativePopover.hide});});
 // #1356: a genuine overflowing option list scrolls inside its surface.
 await dialog.evaluate(el=>{
  const control=document.createElement('hp-settings-select');control.dataset.scrollRegression='1356';
  const select=document.createElement('select');select.setAttribute('aria-label','Scroll regression');
  for(let i=0;i<20;i++){const option=document.createElement('option');option.value=String(i);option.textContent='Choice '+i;select.append(option);}
  control.append(select);el.querySelector('.hpf-settings-content').append(control);
 });
 const scrolling=dialog.locator('hp-settings-select[data-scroll-regression="1356"]');
 await scrolling.locator('button').click();
 const scrollingMenu=scrolling.locator('[role="listbox"]');
 out.fixtureHasRealOptionOverflow=await scrollingMenu.evaluate(el=>el.scrollHeight>el.clientHeight);
 await scrollingMenu.hover();await page.mouse.wheel(0,160);
 await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-scroll-regression="1356"]').shadowRoot.querySelector('[role="listbox"]').scrollTop>0);
 out.internalMenuScrollKeepsOpen=await scrolling.locator('button').getAttribute('aria-expanded')==='true';
 await scrolling.getByRole('option',{name:'Choice 10',exact:true}).click();
 out.nativeChoiceAfterInternalScroll=await scrolling.locator('select').inputValue()==='10';
 // #1024: real composed ancestor scrolling follows the trigger, while a
 // completely clipped anchor closes the menu. This uses the shared controller
 // also consumed by the icon picker; no manual position callback is invoked.
 await dialog.evaluate(el=>{
  const wrapper=document.createElement('div');wrapper.dataset.followRegression='1024';
  wrapper.style.cssText='height:160px;overflow:auto;position:relative;flex:none';
  const shadowHost=document.createElement('div'),root=shadowHost.attachShadow({mode:'open'});
  const top=document.createElement('div');top.style.height='50px';
  const control=document.createElement('hp-settings-select');control.dataset.followControl='1024';
  const select=document.createElement('select');select.setAttribute('aria-label','Follow regression');
  for(let i=0;i<4;i++){const option=document.createElement('option');option.value=String(i);option.textContent='Follow '+i;select.append(option);}
  control.append(select);const bottom=document.createElement('div');bottom.style.height='400px';
  root.append(top,control,bottom);wrapper.append(shadowHost);el.querySelector('.hpf-settings-content').append(wrapper);
  wrapper.scrollIntoView({block:'center'});
 });
 const following=dialog.locator('hp-settings-select[data-follow-control="1024"]'),wrapper=dialog.locator('[data-follow-regression="1024"]');
 await following.locator('button').click();
 const anchorBefore=await following.locator('button').boundingBox();
 const wrapperBox=await wrapper.boundingBox();
 await page.mouse.move(wrapperBox.x+5,wrapperBox.y+5);await page.mouse.wheel(0,30);
 await page.waitForTimeout(200);
 const anchorAfter=await following.locator('button').boundingBox();
 out.composedScrollReallyMovesAnchor=anchorAfter.y<anchorBefore.y-10;
 out.composedScrollKeepsMenuOpen=await following.locator('button').getAttribute('aria-expanded')==='true';
 const menuAfter=await following.locator('[role="listbox"]').boundingBox();
 out.composedMenuFollowsAnchor=!!menuAfter && (Math.abs(menuAfter.y-(anchorAfter.y+anchorAfter.height))<12
   ||Math.abs(menuAfter.y+menuAfter.height-anchorAfter.y)<12);
 await page.mouse.wheel(0,260);await page.waitForTimeout(220);
 out.fullyClippedAnchorClosesMenu=await following.locator('button').getAttribute('aria-expanded')==='false';
 await wrapper.evaluate(el=>el.remove());
} catch(error){console.error(error);out.completed=false;}
checkAll(out);await finish(browser,out);
