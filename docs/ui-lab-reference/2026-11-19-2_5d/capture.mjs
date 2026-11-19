/** Reproduce illustrations without accessing a real HA or the owner's browser. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const repo=resolve(option('--repo',process.cwd())),url=option('--url','http://localhost:8891/');
const out=resolve(option('--out',resolve(here,'evidence')));await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(resolve(repo,'node_modules/playwright/index.mjs')));
const fixture=JSON.parse(await readFile(resolve(here,'synthetic-fixture.json'),'utf8'));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1480,height:1080},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/fixture.json',r=>r.fulfill({json:fixture}));
 await page.route('**/provenance.json',async route=>{const response=await route.fetch(),p=await response.json();await route.fulfill({json:{...p,datasetId:'synthetic-accepted-ui060',privateDataset:false}});});
 await page.goto(url);await page.locator('.stage.projection-iso').waitFor();await page.waitForTimeout(2400);
 const observations=[];
 for(let turn=0;turn<4;turn++){
  await page.mouse.move(5,5);await page.screenshot({path:resolve(out,`overview-${turn*90}.png`)});
  observations.push(await page.evaluate(()=>{const c=window.__lab.card,r=c.shadowRoot;return {rotation:c._rotation,devices:r.querySelectorAll('.dev[data-hp="device"]').length,stairs:r.querySelectorAll('[data-hp-stair-volume]').length,led:r.querySelectorAll('.iso-led-plane .led-hit').length,locks:r.querySelectorAll('.oplock:not(.iso-tile-shadow)').length,wallLightFaces:r.querySelectorAll('.iso-wall-light').length,labelTransform:r.querySelector('.stage').style.getPropertyValue('--hp-iso-room-plane')};}));
  await page.locator('[data-hp="rotate-right"]').click();await page.waitForTimeout(650);
 }
 const target=page.locator('.dev[data-id="lab_temperature"]').first(),box=await target.boundingBox();
 if(box){await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<7;i++){await page.mouse.wheel(0,-500);await page.waitForTimeout(100);}await page.mouse.move(5,5);await page.waitForTimeout(850);await page.screenshot({path:resolve(out,'devices-detail.png')});}
 await page.reload();await page.locator('.stage.projection-iso').waitFor();await page.waitForTimeout(2400);
 await page.locator('[data-hp="space-settings"][data-id="golden-geometry"]').click();await page.waitForFunction(()=>window.__lab.card._spaceDialog?.mode==='edit');
 await page.getByRole('button',{name:'Оформление комнат',exact:true}).click();
 const picker=page.locator('hp-color-opacity[data-field$="opening-accent-3d"]');await picker.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
 await page.screenshot({path:resolve(out,'appearance-settings.png')});
 await picker.locator('button[data-field="colour-open"]').click();await page.waitForTimeout(350);await page.screenshot({path:resolve(out,'opening-accent-picker.png')});
 await writeFile(resolve(out,'capture-report.json'),JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),viewport:{width:1480,height:1080},dpr:1,synthetic:true,observations,errors},null,2)+'\n');
 console.log(JSON.stringify({frames:7,observations,errors}));
}finally{await browser.close();}
