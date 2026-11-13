// #1403: exact existing golden reproduction; do not accept hidden DOM text as visible ink.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {launch,reportPageErrors} from './serve.mjs';
import {prepareGoldenScenario} from './golden/harness.mjs';
import {GOLDEN_SCENARIOS} from './golden/matrix.mjs';
const {page,browser}=await launch();
try {
 for(const width of [1180,900,780]){
  const source=GOLDEN_SCENARIOS.find(s=>s.id==='wall-junctions-plan-preview-light');
  const scene={...source,viewport:{width,height:900}};
  await page.setViewportSize(scene.viewport);await prepareGoldenScenario(page,scene);
  const result=await page.evaluate(()=>{
   const c=window.__goldenCard,r=c.renderRoot,tray=r.querySelector('.editor-secondary').getBoundingClientRect();
   const overlaps=b=>b.left<tray.right&&tray.left<b.right&&b.top<tray.bottom&&tray.top<b.bottom;
   const rows=[...r.querySelectorAll('[data-hp="wall-side-dimension"]')];
   const list=r.querySelector('[data-hp="dimension-list"]');
   return {count:rows.length,values:rows.map(n=>Number(n.dataset.lengthCm)),
    readable:rows.every(n=>{const text=n.querySelector('text'),label=text.textContent.trim();
     if(!text.checkVisibility({checkVisibilityCSS:true})||overlaps(text.getBoundingClientRect()))return false;
     if(label==='1.200 m')return true;
     const entry=[...list?.querySelectorAll('[data-interval]')||[]].find(e=>e.dataset.interval===n.dataset.interval);
     return entry?.textContent.includes('1.200 m')&&!overlaps(list.getBoundingClientRect());
    })};
  });
  assert.equal(result.count,2);assert.deepEqual(result.values,[120,120]);
  assert.equal(result.readable,true,JSON.stringify({width,result}));
  mkdirSync('artifacts/1403',{recursive:true});
  await page.screenshot({path:`artifacts/1403/hud-${width}.png`});
 }
 reportPageErrors(page);console.log('PROCESS_NEXT_RESULT '+JSON.stringify({tests:3,passed:3,failed:0,skipped:0,status:'passed'}));
} finally {await browser.close();}
