import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=resolve(process.env.HP_REPO || process.cwd());
const artifactRoot=dirname(fileURLToPath(import.meta.url));
const {chromium}=await import(pathToFileURL(resolve(repo,'node_modules/playwright/index.mjs')));
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=artifactRoot;
const fixture=JSON.parse(await readFile(resolve(repo,'demo/ui-lab/fixture.json'),'utf8'));
fixture.config.settings={...fixture.config.settings,volumetric_view:true};
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1480,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/fixture.json',r=>r.fulfill({json:fixture}));
 await page.route('**/provenance.json',async route=>{const r=await route.fetch(),p=await r.json();await route.fulfill({json:{...p,datasetId:'synthetic-wall-appearance',privateDataset:false}});});
 await page.goto((process.env.HP_LAB_URL || 'http://localhost:8891/'));await page.waitForFunction(()=>window.__lab?.card?._devices?.length);
 await page.locator('.stage.projection-iso').waitFor();await page.locator('.iso-wall-fill').waitFor();
 const stats=()=>page.evaluate(()=>{
  const r=window.__lab.card.shadowRoot;
  const style=s=>{const e=r.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return {fill:c.fill,stroke:c.stroke,opacity:c.opacity,color:c.color,side:c.getPropertyValue('--hp-iso-side').trim(),glyph:c.getPropertyValue('--hp-glyph-side').trim()};};
  return {sideFill:style('.iso-wall-side-fill'),sideFace:style('.iso-wall-side'),topColor:getComputedStyle(r.querySelector('.stage')).getPropertyValue('--iso-top-hi').trim(),fill:style('.iso-wall-fill'),contours:style('.iso-wall-contours'),top:style('.iso-wall-contour'),device:style('.dev .device-core'),name:style('.roomlabel .rlname'),window:style('.iso-window.iso-material-light-frame'),door:style('.iso-door.iso-material-matte-leaf'),windowInFill:!!r.querySelector('.iso-wall-fill .iso-opening-panel,.iso-wall-side-fill .iso-opening-panel'),fillPaths:[...r.querySelectorAll('.iso-wall-fill path,.iso-wall-side-fill path')].filter(p=>!p.closest('defs')).map(p=>({opacity:getComputedStyle(p).opacity,stroke:getComputedStyle(p).stroke}))};
 });
 const before=await stats();
 await page.locator('[data-hp="space-settings"][data-id="golden-geometry"]').click();
 await page.waitForFunction(()=>window.__lab.card._spaceDialog?.mode==='edit');
 await page.getByRole('button',{name:'Оформление комнат',exact:true}).click();
 await page.getByText('Цвет штриховки стен (верхний срез стен в 3D)',{exact:false}).first().waitFor({timeout:3000});
 await page.getByText('Цвет заливки стен (боковые грани стен в 3D)',{exact:false}).first().waitFor({timeout:3000});
 const cases=[];
 for(const alpha of [1,.35,0]){
  await page.evaluate(async alpha=>{const c=window.__lab.card;c._spaceDialog={...c._spaceDialog,roomColor:'#e126a0',roomOpacity:.6,wallFill:{c:'#48b7f2',a:alpha}};c.requestUpdate();await c.updateComplete;},alpha);
  const st=await stats();cases.push({alpha,topAlpha:st.fill.opacity,sideAlpha:st.sideFill.opacity,sideColor:st.sideFace.fill,topColor:st.topColor});
  assert.equal(st.fill.opacity,'0.6');assert.equal(st.sideFill.opacity,String(alpha));assert.equal(st.sideFace.fill,'rgb(72, 183, 242)');assert.equal(st.topColor,'#e126a0');assert.equal(st.top.stroke,before.top.stroke);
  assert.equal(st.windowInFill,false);assert.equal(st.device.side,before.device.side);assert.equal(st.name.glyph,before.name.glyph);
  assert.deepEqual(st.window,before.window);assert.deepEqual(st.door,before.door);
  assert(st.fillPaths.filter(p=>p.stroke!=='none').length===0);
 }
 await page.evaluate(async()=>{const c=window.__lab.card;c._spaceDialog={...c._spaceDialog,roomColor:'#e126a0',roomOpacity:.6,wallFill:{c:'#48b7f2',a:.35}};c.requestUpdate();await c.updateComplete;});
 await page.screenshot({path:`${root}/wall-labels-dialog-20261119.png`});
 await page.locator('hp-dialog[data-kind="space"]').getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.locator('hp-dialog[data-kind="space"]').waitFor({state:'detached'});await page.waitForTimeout(400);
 await page.mouse.move(5,5);await page.screenshot({path:`${root}/wall-labels-plan-20261119.png`});
 await page.reload();await page.locator('.iso-wall-fill').waitFor();
 const restored=await stats();assert.equal(restored.fill.opacity,'0.6');assert.equal(restored.sideFace.fill,'rgb(72, 183, 242)');assert.equal(restored.sideFill.opacity,'0.35');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,cases,restored:{fill:restored.fill.opacity,sideColor:restored.sideFace.fill,sideAlpha:restored.sideFill.opacity},unchanged:{deviceSide:restored.device.side,labelSide:restored.name.glyph},errors}));
}finally{await browser.close();}


