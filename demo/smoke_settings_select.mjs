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
 out.openAnimation=await navigation.locator('[role="listbox"]').evaluate(el=>getComputedStyle(el).transitionDuration==='0.16s, 0.16s');
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
  colours.push(await menu.locator('button').evaluate(el=>getComputedStyle(el).color));
 }
 out.dynamicTheme=new Set(colours).size===3;
 await menu.locator('button').click();
 await dialog.locator('.hpf-head h3').filter({visible:true}).click();
 out.outsideCloses=await menu.locator('button').getAttribute('aria-expanded')==='false';
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(180);
 await menu.locator('button').click();
 out.reducedMotion=await dialog.locator('[data-hp-overlay="select"] .menu').evaluate(el=>getComputedStyle(el).transitionDuration==='0s');
 await dialog.locator('[data-hp-overlay="select"] [role="listbox"]').press('Escape');
 await page.evaluate(()=>{Object.assign(HTMLElement.prototype,{showPopover:window.__selectNativePopover.show,hidePopover:window.__selectNativePopover.hide});});
} catch(error){console.error(error);out.completed=false;}
checkAll(out);await finish(browser,out);
