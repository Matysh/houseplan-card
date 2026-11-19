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
 await page.route('**/provenance.json',async route=>{const r=await route.fetch(),p=await r.json();await route.fulfill({json:{...p,datasetId:'synthetic-opening-accent',privateDataset:false}});});
 await page.goto((process.env.HP_LAB_URL || 'http://localhost:8891/'));await page.waitForFunction(()=>window.__lab?.card?._devices?.length);
 await page.locator('.stage.projection-iso').waitFor();
 const stats=()=>page.evaluate(()=>{
   const r=window.__lab.card.shadowRoot,stage=r.querySelector('.stage');
   const fills=s=>[...r.querySelectorAll(s)].map(e=>getComputedStyle(e).fill);
   return {leaf:getComputedStyle(stage).getPropertyValue('--iso-opening-leaf').trim(),frame:getComputedStyle(stage).getPropertyValue('--iso-opening-window-frame').trim(),doors:fills('.iso-door.iso-material-matte-leaf'),windows:fills('.iso-window.iso-material-light-frame'),sills:fills('.iso-window.iso-material-light-sill'),unchanged:fills('.iso-material-glass,.iso-material-curtain,.iso-gate'),draft:window.__lab.card._spaceDialog?.openingAccent3d};
 });
 const before=await stats();
 assert(before.sills.length>0);
 await page.locator('[data-hp="space-settings"][data-id="golden-geometry"]').click();
 await page.waitForFunction(()=>window.__lab.card._spaceDialog?.mode==='edit');
 await page.getByRole('button',{name:'Оформление комнат',exact:true}).click();
 const picker=page.locator('hp-color-opacity[data-field$="opening-accent-3d"]');
 await picker.locator('button[data-field="colour-open"]').click();
 const alpha=page.locator('input[data-field="colour-opacity"][data-value="number"]:visible');
 await alpha.waitFor();
 const hex=page.locator('input[data-field="colour-hex"]:visible');
 await hex.fill('#e08030');await hex.press('Tab');
 const cases=[];
 for(const value of [100,35,0]){
   await alpha.fill(String(value));await alpha.press('Tab');
   await page.waitForFunction(a=>window.__lab.card._spaceDialog.openingAccent3d.a===a,value/100);
   const st=await stats();cases.push({opacity:value,leaf:st.leaf,frame:st.frame});
   assert.equal(st.draft.c.toLowerCase(),'#e08030');
   assert.deepEqual(st.unchanged,before.unchanged);
   const tinted=before.sills.map(fill=>{const rgb=fill.match(/[\d.]+/g).map(Number),tint=[224,128,48],a=value/100;return `rgb(${rgb.map((v,i)=>Math.round(v*(1-a+a*tint[i]/255))).join(', ')})`;});
   assert.deepEqual(st.sills,tinted);
   if(value===0){assert.equal(st.leaf,before.leaf);assert.deepEqual(st.doors,before.doors);assert.deepEqual(st.windows,before.windows);}
 }
 assert.notEqual(cases[0].leaf,cases[1].leaf);assert.notEqual(cases[1].leaf,cases[2].leaf);
 await alpha.fill('35');await alpha.press('Tab');
 await page.screenshot({path:`${root}/opening-accent-picker-20261119.png`});
 await page.keyboard.press('Escape');
 await page.locator('hp-dialog[data-kind="space"]').getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.locator('hp-dialog[data-kind="space"]').waitFor({state:'detached'});
 await page.reload();await page.locator('.stage.projection-iso').waitFor();
 const restored=await stats();assert.equal(restored.leaf,cases[1].leaf);
 await page.waitForTimeout(600);await page.screenshot({path:`${root}/opening-sill-accent-20261119.png`});
 await page.locator('[data-hp="space-settings"][data-id="golden-geometry"]').click();
 await page.waitForFunction(()=>window.__lab.card._spaceDialog?.mode==='edit');
 assert.deepEqual((await stats()).draft,{c:'#e08030',a:.35});
 await page.evaluate(async()=>{const c=window.__lab.card;c._spaceDialog={...c._spaceDialog,openingAccent3d:{c:'#ffffff',a:1}};c.requestUpdate();await c.updateComplete;});
 assert.equal((await stats()).leaf,before.leaf);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,cases,sills:restored.sills,persistence:true,whiteUnchanged:true,unchangedSurfaces:restored.unchanged.length,errors}));
}finally{await browser.close();}
