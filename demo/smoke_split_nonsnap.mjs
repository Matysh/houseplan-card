// Split now works on a non-grid-aligned room (imported/legacy polygons).
import { launch } from './serve.mjs';
const { page, browser } = await launch();
const R = (nx, ny) => page.evaluate(([nx, ny]) => {
  const c = window.__card; const H = 1000 / c._curSpaceCfg.aspect; return [nx * 1000, ny * H];
}, [nx, ny]);
const out = {};
await page.evaluate(()=>{const c=window.__card; if(!c._markup)c._toggleMarkup(); c._tool='split';});
// living room (r1) has walls at y=0.05 which are NOT grid nodes; click near the wall
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.3,0.3));   // pick living
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.3,0.052)); // near top wall (off grid)
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.3,0.58));  // near bottom wall
out.pending = await page.evaluate(()=>!!window.__card._pendingSplit);
out.dialog = await page.evaluate(()=>!!window.__card._roomDialog);
// accidental click in the middle of the room must NOT become a wall point
await page.evaluate(()=>{const c=window.__card; c._roomDialog=false; c._pendingSplit=null; c._splitSel=null;});
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.3,0.3));   // pick again
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.3,0.3));   // centre click = miss
out.centreRefused = await page.evaluate(()=>window.__card._splitSel?.a == null);
console.log(JSON.stringify(out));
await browser.close();
