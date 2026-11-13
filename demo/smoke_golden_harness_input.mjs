// #1401: pointer dialog goldens must not inherit keyboard focus paint from a prior scene.
import assert from 'node:assert/strict';
import {launch,reportPageErrors} from './serve.mjs';
import {prepareGoldenScenario} from './golden/harness.mjs';
import {GOLDEN_SCENARIOS} from './golden/matrix.mjs';
import {goldenHarnessScenario,prepareGoldenSelection} from '../process-next/catalog/golden-selection.mjs';
const ids=['more-info-dialog-desktop-en','toggle-entity-dialog-desktop-en',
 'device-ripple-color-popover-mobile-ru','panel-device-dialog-mobile-ru'];
const {page,browser}=await launch();
try {
 for(const keyboardBefore of [true,false])for(const id of ids){
  const source=prepareGoldenSelection(GOLDEN_SCENARIOS).all.find(s=>s.id===id);
  assert.ok(source,id);
  const scene=goldenHarnessScenario(source);
  await page.setViewportSize(scene.viewport);
  if(keyboardBefore)await page.keyboard.press('Tab');
  await prepareGoldenScenario(page,scene);
  const state=await page.evaluate(()=>{
   const root=window.__goldenCard.renderRoot,first=root.querySelector('.hpf-settings-nav button');
   const mobile=root.querySelector('.hpf-settings-mobile'),nav=mobile?.getClientRects().length?mobile:root.querySelector('.hpf-settings-nav');
   const controls=[];const scan=tree=>{for(const e of tree?.querySelectorAll('*')||[]){
    if(e.matches('button,select'))controls.push(e);if(e.shadowRoot)scan(e.shadowRoot);
   }};scan(nav);
   return{exists:!!first,visible:!!first?.getClientRects().length,keyboardRing:controls.some(e=>e.matches(':focus-visible')),
    fixtureRemoved:!document.querySelector('#hp-golden-pointer-entry')};
  });
  assert.deepEqual(state,{exists:true,visible:scene.viewport.width>550,keyboardRing:false,fixtureRemoved:true},id+' '+keyboardBefore);
 }
 const keyboard=prepareGoldenSelection(GOLDEN_SCENARIOS).all.find(s=>
  (s.sourceSceneId||s.id)==='geometry-plan-editor-dark');
 assert.ok(keyboard);
 await page.setViewportSize(keyboard.viewport);
 const result=await prepareGoldenScenario(page,goldenHarnessScenario(keyboard));
 assert.equal(result.planKeyboardFocus.focusVisible,true,'ordinary keyboard capture still owns its visible ring');
 assert.equal(await reportPageErrors(),false);
 console.log('PROCESS_NEXT_RESULT '+JSON.stringify({tests:9,passed:9,failed:0,skipped:0,status:'passed'}));
}finally{await browser.close();}
