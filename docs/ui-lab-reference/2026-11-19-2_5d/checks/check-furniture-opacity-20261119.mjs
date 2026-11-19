import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=resolve(process.env.HP_REPO || process.cwd());
const artifactRoot=dirname(fileURLToPath(import.meta.url));
const {chromium}=await import(pathToFileURL(resolve(repo,'node_modules/playwright/index.mjs')));
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile(resolve(repo,'demo/ui-lab/fixture.json'),'utf8'));
fixture.config.settings={...fixture.config.settings,volumetric_view:true};
fixture.config.spaces[0].stairs=[{id:'opacity-stair',kind:'straight',direction:'forward',x:.26,y:.79,length:.22,width:.09,angle:0,opacity:.4}];
fixture.config.spaces[0].decor.push({id:'opacity-fridge',kind:'furniture',symbol:'fridge',x:.82,y:.35,w:.07,h:.07,angle:0,color:'#343941',opacity:.31});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1480,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/fixture.json',r=>r.fulfill({json:fixture}));
 await page.route('**/provenance.json',async route=>{const r=await route.fetch(),p=await r.json();await route.fulfill({json:{...p,datasetId:'synthetic-furniture-opacity',privateDataset:false}});});
 await page.goto((process.env.HP_LAB_URL || 'http://localhost:8891/'));await page.locator('[data-hp-stair-volume]').waitFor();
 const result=await page.evaluate(()=>{const c=window.__lab.card,r=c.shadowRoot;return {objects:[...r.querySelectorAll('[data-hp-furniture-volume]')].map(e=>({symbol:e.dataset.symbol,side:Number(e.querySelector('[data-furniture-part] > path:nth-child(1)').getAttribute('fill-opacity')),top:Number(e.querySelector('[data-furniture-part] > path:nth-child(3)').getAttribute('fill-opacity'))})),saved:{fridge:c._curSpaceCfg.decor.find(d=>d.symbol==='fridge').opacity,stairs:c._curSpaceCfg.stairs[0].opacity}};});
 for(const symbol of ['sofa','fridge','stairs'])assert(result.objects.some(o=>o.symbol===symbol));
 assert(result.objects.every(o=>Math.abs(o.side-.52*.65)<1e-8&&Math.abs(o.top-.72*.65)<1e-8));
 assert.deepEqual(result.saved,{fridge:.31,stairs:.4});assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve(artifactRoot,'furniture-opacity-20261119.png')});
 console.log(JSON.stringify({pass:true,...result,errors}));
} finally {await browser.close();}
