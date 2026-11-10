// #963: a genuine touch tap must keep its action and must not arm keyboard help.
import {launchHaDialogFixture} from './helpers/ha-dialog-fixture.mjs';
import {UI_POLISH_963_HA_PIN} from './helpers/ui-polish-963-pin.mjs';
import {prepareUi963Page} from './helpers/ui-polish-963-reference.mjs';
import {enforcePinnedBrowser} from '../scripts/browser-attestation.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {fileURLToPath} from 'node:url';
import {checkAll,watchPage,finish} from './serve.mjs';
const f=await launchHaDialogFixture({hasTouch:true,pin:UI_POLISH_963_HA_PIN,
 wheelPath:process.env.HP_UI_963_HA_WHEEL,extraModules:['33396','95788'],viewport:{width:390,height:900}});
const {page}=f,out={};watchPage(page);await enforcePinnedBrowser(f.browser);
try{
 await prepareUi963Page(page,f.url);
 await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));
 const card=page.locator('houseplan-card');
 const phoneHeaderFits=()=>card.locator('.head').evaluate(el=>{
  const head=el.getBoundingClientRect(), controls=[...el.querySelectorAll('button,select')].filter(control=>{
   const r=control.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(control).visibility==='visible';
  });
  return el.scrollWidth<=el.clientWidth+1&&controls.every(control=>{
   const r=control.getBoundingClientRect();return r.left>=head.left-1&&r.right<=head.right+1&&r.top>=head.top-1&&r.bottom<=head.bottom+1;
  });
 });
 out.phone_header_fits=await phoneHeaderFits();
 await page.evaluate(()=>window.__hpTest.setMode('plan'));
 const action=card.locator('[data-hp=tool][data-tool=draw]');
 // Compact headers replace tooltip buttons with labelled menu commands.
 // Use two visible toolbar neighbours to preserve the genuine keyboard-to-touch
 // Chrome tooltip path at the original phone viewport.
 const keyboard=card.locator('[data-hp=tool][data-tool=select]');
 for(let i=0;i<100;i++){await page.keyboard.press('Tab');if(await keyboard.evaluate(el=>el===el.getRootNode().activeElement))break;}
 await page.waitForTimeout(350);out.keyboard_hint_before_touch=await card.locator('.hp-chrome-tooltip').isVisible();
 const before=await page.evaluate(()=>({pressed:window.__card.renderRoot.querySelector('[data-hp=tool][data-tool=draw]').getAttribute('aria-pressed'),data:JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout})}));
 const r=await action.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
 await page.waitForFunction(()=>!window.__card._cameraTransition.active);await page.waitForTimeout(400);
 out.touch_keeps_action=await action.getAttribute('aria-pressed')!==before.pressed;
 out.touch_does_not_arm_tooltip=!(await card.locator('.hp-chrome-tooltip').isVisible());
 out.touch_preserves_data=await page.evaluate(before=>JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout})===before.data,before);
 // A tool action also retires the tooltip context. Isolate the real native
 // touch-focus route on a non-command fixture button in the same mounted bar,
 // so that unrelated navigation cannot hide an incorrectly armed tooltip.
 await action.evaluate(el=>{
  const button=document.createElement('button');button.className='btn';
  button.dataset.hp='tooltip-touch-witness';button.dataset.hpTooltip='Touch focus must not show keyboard help';
  button.textContent='Touch';el.parentElement.append(button);
 });
 const focusOnly=card.locator('[data-hp=tooltip-touch-witness]');
 const target=await focusOnly.boundingBox();
 await page.touchscreen.tap(target.x+target.width/2,target.y+target.height/2);
 await page.waitForTimeout(400);
 out.native_touch_focus_is_not_keyboard=await focusOnly.evaluate(el=>el===el.getRootNode().activeElement&&!el.matches(':focus-visible'));
 out.touch_focus_without_navigation_does_not_arm_tooltip=!(await card.locator('.hp-chrome-tooltip').isVisible());
 await focusOnly.evaluate(el=>el.remove());
 // #1184 replaced the fixed 56px header with intrinsic responsive rows. Judge
 // real visible target containment; the accepted intrinsic header may wrap.
 out.phone_editor_header_fits=await phoneHeaderFits();
 await f.assertClean();checkAll(out);await finish(f.browser,out);
}finally{await f.close();}
