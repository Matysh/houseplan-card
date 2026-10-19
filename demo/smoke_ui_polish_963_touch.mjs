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
 const card=page.locator('houseplan-card'),zoom=card.locator('[data-hp=zoom-in]');
 // Warm the real keyboard path before the independent touch-focus neighbour.
 const keyboard=card.locator('[data-hp=zoom-out]');
 for(let i=0;i<100;i++){await page.keyboard.press('Tab');if(await keyboard.evaluate(el=>el===el.getRootNode().activeElement))break;}
 await page.waitForTimeout(350);out.keyboard_hint_before_touch=await card.locator('.hp-chrome-tooltip').isVisible();
 await page.keyboard.press('Escape');
 const before=await page.evaluate(()=>({zoom:window.__card._zoom,data:JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout})}));
 const r=await zoom.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
 await page.waitForFunction(()=>!window.__card._cameraTransition.active);await page.waitForTimeout(400);
 out.touch_keeps_zoom=await page.evaluate(before=>window.__card._zoom>before.zoom,before);
 out.touch_does_not_arm_tooltip=!(await card.locator('.hp-chrome-tooltip').isVisible());
 out.touch_preserves_data=await page.evaluate(before=>JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout})===before.data,before);
 out.phone_header_fits=await card.locator('.head').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height<=56);
 await f.assertClean();checkAll(out);await finish(f.browser,out);
}finally{await f.close();}
