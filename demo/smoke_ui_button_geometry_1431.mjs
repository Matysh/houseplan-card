import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {launch,finish,requirePinnedBrowser} from './serve.mjs';
import {GOLDEN_SCENARIOS} from './golden/matrix.mjs';
import {prepareGoldenScenario} from './golden/harness.mjs';
requirePinnedBrowser('#1431 toolbar border geometry');
const {page,browser}=await launch({width:900,height:900});
try {
  const scene=GOLDEN_SCENARIOS.find(s=>s.id==='room-temperature-dialog-desktop-en');
  assert.ok(scene,'use the failing golden scene, not a substitute toolbar');
  await prepareGoldenScenario(page,{...scene,panelHost:true});
  const card=page.locator('houseplan-card'),dialog=card.locator('hp-dialog[data-kind=room]');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  const toolbar=card.locator('[data-hp="toolbar"][data-kind="plan"]');
  await expect(toolbar).toBeVisible();
  const read=()=>toolbar.evaluate(el=>{
    const r=el.getBoundingClientRect();
    const buttons=[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length);
    return {height:r.height,rows:[...new Set(buttons.map(b=>Math.round(b.getBoundingClientRect().y)))].length};
  });
  const before=await read();assert.ok(before.height<65,JSON.stringify(before));
  for(const button of await toolbar.locator('button:visible:not(:disabled)').all()){
    const original=await button.boundingBox();await button.hover();
    await expect.poll(()=>button.boundingBox()).toMatchObject({width:original.width,height:original.height});
  }
  assert.deepEqual(await read(),before,'hover must not change toolbar height or wrapping');
  console.log('PASS #1431 900px original toolbar footprint and stable hover',JSON.stringify(before));
}finally{await finish(browser);}
