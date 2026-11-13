// #1403: wall geometry/editor witness; do not accept hidden DOM text as visible ink.
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
 for(const theme of ['light','dark'])for(const width of [1180,900,780]){
  const source=GOLDEN_SCENARIOS.find(s=>s.id===`safe-resize-handles-clamp-${theme}`);
  // The canonical fixture asserts its desktop Properties copy. Exercise the
  // narrower native resize after that precondition, where the panel may fold.
  await page.setViewportSize(source.viewport);await prepareGoldenScenario(page,source);
  await page.setViewportSize({width,height:900});
  await page.evaluate(async()=>{await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
   await window.__goldenCard.updateComplete;});
  const result=await page.evaluate(()=>{
   const r=window.__goldenCard.renderRoot,list=r.querySelector('[data-hp="dimension-list"]');
   const rect=n=>{const b=n.getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
   const overlaps=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
   const fixed=[...r.querySelectorAll('.editor-secondary,.zoombadge:not([hidden])')]
    .filter(n=>n.checkVisibility({checkVisibilityCSS:true})).map(rect);
   const stage=rect(r.querySelector('.stage')),box=list?rect(list):null;
   const entries=[...list?.querySelectorAll('[data-interval]')||[]];
   const rows=[...r.querySelectorAll('[data-hp="wall-side-dimension"]')];
   const allReferences=rows.every(n=>!/^\[\d+\]$/.test(n.querySelector('text').textContent.trim())
    ||entries.some(e=>e.dataset.interval===n.dataset.interval));
   const scrollReadable=entries.every(entry=>{
    list.scrollTop=entry.offsetTop;const b=rect(entry),outer=rect(list);
    return b.top>=outer.top&&b.bottom<=outer.bottom;
   });
   return {listed:entries.length,allReferences,scrollReadable,
    clear:!box||fixed.every(b=>!overlaps(box,b)),
    inside:!box||box.left>=stage.left&&box.top>=stage.top&&box.right<=stage.right&&box.bottom<=stage.bottom};
  });
  if(width===1180)assert.ok(result.listed>0,'known compact Resize exercises the list fallback');
  assert.equal(result.allReferences,true);assert.equal(result.scrollReadable,true);
  assert.equal(result.inside,true);assert.equal(result.clear,true,JSON.stringify({theme,width,result}));
  mkdirSync('artifacts/1404',{recursive:true});
  await page.screenshot({path:`artifacts/1404/resize-${theme}-${width}.png`});
 }
 assert.equal(await reportPageErrors(),false);
 console.log('PROCESS_NEXT_RESULT '+JSON.stringify({tests:9,passed:9,failed:0,skipped:0,status:'passed'}));
} finally {await browser.close();}
