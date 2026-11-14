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
    const button=menu.locator('button:not(:disabled)').first();await button.hover();
    await expect.poll(()=>button.evaluate(el=>{
      const s=getComputedStyle(el);return [s.borderLeftWidth,s.borderLeftStyle,s.borderLeftColor===s.color,s.outlineStyle,s.boxShadow];
    })).toEqual(['1px','solid',true,'none','none']);
    assert.deepEqual(await goldenClip(page,scene.capture),before,'hover does not resize or move menu');
  }
  console.log('PASS #1444 context menus retain 157x154 crop, one hover border, both themes');
}finally{await finish(browser);}
