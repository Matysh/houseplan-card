import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {launch,finish,requirePinnedBrowser} from './serve.mjs';
import {GOLDEN_SCENARIOS} from './golden/matrix.mjs';
import {prepareGoldenScenario,goldenClip} from './golden/harness.mjs';
requirePinnedBrowser('#1444 context menu footprint');
const {page,browser}=await launch({width:1180,height:900});
try{
  for(const theme of ['light','dark']){
    const scene=GOLDEN_SCENARIOS.find(s=>s.id===`ui-1051-menu-${theme}`);
    assert.ok(scene);await prepareGoldenScenario(page,scene);
    const menu=page.locator('houseplan-card .hpf-context-menu');await expect(menu).toBeVisible();
    const before=await goldenClip(page,scene.capture);
    assert.deepEqual([before.width,before.height],[157,154],`${theme}: preserve accepted menu footprint`);
    const button=menu.locator('button:not(:disabled)').first();
    const paint=()=>button.evaluate(el=>{
      const style=getComputedStyle(el);
      return {background:style.backgroundColor, color:style.color, border:style.border,
        outline:style.outline, shadow:style.boxShadow};
    });
    await page.mouse.move(0,0);
    const {background: idleBackground, ...idlePaint}=await paint();
    await button.hover();
    await expect.poll(async()=>(await paint()).background).not.toBe(idleBackground);
    const {background: hoverBackground, ...hoverPaint}=await paint();
    assert.notEqual(hoverBackground,idleBackground);
    assert.deepEqual(hoverPaint,idlePaint,'hover changes only the row background');
    assert.deepEqual(await goldenClip(page,scene.capture),before,'hover does not resize or move menu');
  }
  console.log('PASS #1444 context menus retain 157x154 crop and background-only hover in both themes');
}finally{await finish(browser);}
