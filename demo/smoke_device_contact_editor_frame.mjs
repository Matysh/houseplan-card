// #1003: contour-only sync must not add an axis pass to a live room resize.
import {launch,checkAll,finish,requirePinnedBrowser} from './serve.mjs';
import {prepareGoldenScenario,goldenClip} from './golden/harness.mjs';
import {inspectBatteryBoardPixels} from './golden/device-battery.mjs';
import {GOLDEN_SCENARIOS} from './golden/matrix.mjs';
requirePinnedBrowser('#1003 editor frame ownership');
for(const theme of ['light','dark']){
  const {page,browser}=await launch({width:1000,height:900},1,[],{reducedMotion:'reduce'});
  try{
    await prepareGoldenScenario(page,GOLDEN_SCENARIOS.find(s=>s.id===`safe-resize-handles-clamp-${theme}`));
    const proof=await page.evaluate(()=>{
      const c=window.__goldenCard,r=c.renderRoot;
      const dimensions=[...r.querySelectorAll('[data-hp="wall-side-dimension"]')];
      return {lengths:dimensions.length,
        layers:r.querySelectorAll('[data-hp="wall-side-dimensions"]').length,
        unique:new Set(dimensions.map(el=>el.dataset.interval)).size===dimensions.length,
        rooms:c._resize.plan.roomIds.length,
        edges:r.querySelectorAll('[data-hp="resize-measured-edge"]').length,
        areas:r.querySelectorAll('[data-hp="resize-area-label"]').length,
        leaders:r.querySelectorAll('[data-hp="resize-area-leader"]').length};
    });
    checkAll({[`${theme}:one-live-measurement-layer`]:proof.lengths===proof.rooms*4&&proof.edges===0&&proof.layers===1&&proof.unique
      &&proof.areas===proof.rooms&&proof.leaders===proof.rooms});
  }finally{await finish(browser);}
}
for(const suffix of ['light','dark','medium']){
  const {page,browser}=await launch({width:1000,height:900},1,[],{reducedMotion:'reduce'});
  try{
    const scenario=GOLDEN_SCENARIOS.find(s=>s.id===`device-battery-board-${suffix}`);
    const runtime=await prepareGoldenScenario(page,scenario),clip=await goldenClip(page,scenario.capture);
    const png=await page.screenshot(clip?{clip}:{});
    await inspectBatteryBoardPixels(page,png,clip,runtime.batteryBoard);
    checkAll({[`${suffix}:calibrated-battery-ink-is-visible`]:true});
  }finally{await finish(browser);}
}
