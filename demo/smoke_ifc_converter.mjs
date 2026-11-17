/** #1458 actual offline HTML, real Worker and real embedded WASM. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { enforcePinnedBrowser, requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
import { ifcFixture } from '../test/helpers/ifc-fixture.mjs';
import { convertIfc } from '../scripts/sh3d-convert/ifc.mjs';
import { watchPage, finish } from './serve.mjs';

requirePinnedBrowser('#1458 offline IFC converter');
const browser=await chromium.launch({args:['--no-sandbox']});await enforcePinnedBrowser(browser);
const context=await browser.newContext({viewport:{width:1100,height:900},locale:'en-US'});
const page=watchPage(await context.newPage()),requests=[];
const artifact=pathToFileURL(fileURLToPath(new URL('../scripts/sh3d-convert/dist/index.html',import.meta.url))).href;
await context.route('**/*',route=>{
  const url=route.request().url();
  if(url===artifact || url.startsWith('blob:')) return route.continue();
  requests.push(url);return route.abort();
});
await page.addInitScript(()=>{
  window.ifcWorkers=0;window.ifcTerminated=0;window.ifcLongTasks=[];
  new PerformanceObserver(list=>window.ifcLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  const Original=window.Worker;
  window.Worker=class extends Original {
    constructor(...args){super(...args);window.ifcWorkers++;}
    terminate(){window.ifcTerminated++;return super.terminate();}
    postMessage(data,...args){if(data.file?.name==='slow.ifc')this.delayed=true;return super.postMessage(data,...args);}
    set onmessage(fn){super.onmessage=e=>{if(this.delayed)setTimeout(()=>fn(e),200);else fn(e);};}
  };
});
const upload=(name,fixtureOptions={twoFloors:true,junctions:true})=>page.locator('#file').setInputFiles({name,mimeType:'application/x-step',buffer:Buffer.from(ifcFixture(fixtureOptions))});
try{
  await page.goto(artifact);await page.waitForSelector('#format');
  assert.equal(await page.evaluate(()=>window.ifcWorkers),0,'old formats must not initialize IFC');
  await page.locator('#format').selectOption('ifc');
  const started=await page.evaluate(()=>performance.now());
  await upload('building.ifc');await page.locator('#ifc-catalog input[type=checkbox]').first().waitFor();
  assert.equal(await page.locator('#ifc-catalog input').count(),2);
  const selectedId=await page.locator('#ifc-catalog input').last().getAttribute('value');
  await page.locator('#ifc-catalog input').first().uncheck();
  await page.locator('#ifc-catalog .primary').click();await page.locator('#result').waitFor({state:'visible'});
  assert.equal(await page.locator('svg.ifc-preview').count(),1);
  assert.match(await page.locator('#levels').innerText(),/Partially converted/);
  const downloadEvent=page.waitForEvent('download');await page.locator('#levels .primary').click();
  const download=await downloadEvent,document=JSON.parse(readFileSync(await download.path(),'utf8'));
  const expected=await convertIfc(ifcFixture({twoFloors:true,junctions:true}),{floorIds:[selectedId],now:document.created_at,toolVersion:'plan-convert 0.2',language:'en'});
  assert.deepEqual(document,expected.documents[0],'browser and Node use one conversion core');
  await page.locator('#levels details').last().locator('summary').click();
  await page.locator('.ifc-note').first().click();assert.ok(await page.locator('[data-ifc-highlight]').count());
  assert.equal(await page.evaluate(()=>window.ifcWorkers),1);
  const tasks=await page.evaluate(start=>window.ifcLongTasks.filter(e=>e.start>=start),started);
  assert.deepEqual(tasks,[],'no IFC long task above 50 ms on the UI thread');
  const output=fileURLToPath(new URL('../artifacts/ifc-converter/',import.meta.url));mkdirSync(output,{recursive:true});
  await page.locator('#result').screenshot({path:output+'synthetic-preview-en.png'});
  await page.locator('[data-lang=ru]').click();assert.match(await page.locator('#levels').innerText(),/Частично перенесён/);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#result').screenshot({path:output+'synthetic-preview-ru-mobile.png'});
  await page.locator('#levels .primary').evaluate(b=>{window.staleIfc=b;});
  await page.locator('#format').selectOption('sh3d');
  let staleDownload=false;const listener=()=>{staleDownload=true;};page.on('download',listener);
  await page.evaluate(()=>window.staleIfc.click());await page.waitForTimeout(50);page.off('download',listener);assert.equal(staleDownload,false);
  await page.locator('#format').selectOption('ifc');
  await upload('slow.ifc');const cancelStarted=await page.evaluate(()=>performance.now());await page.locator('#ifc-cancel').click();
  const cancelMs=await page.evaluate(start=>performance.now()-start,cancelStarted);assert.ok(cancelMs<=250,`cancel took ${cancelMs} ms`);
  assert.equal(await page.locator('#busy').isVisible(),false);assert.equal(await page.locator('#result').isVisible(),false);
  await upload('replacement.ifc');await page.locator('#ifc-catalog input').first().waitFor();await page.waitForTimeout(250);
  assert.equal(await page.locator('#ifc-catalog input').count(),2,'delayed old response must not replace the current catalog');
  await page.locator('#format').selectOption('sh3d');
  await page.evaluate(()=>{window.savedWorker=window.Worker;window.Worker=class{constructor(){throw Error('blocked worker');}};});
  await page.locator('#format').selectOption('ifc');await upload('blocked.ifc');await page.locator('#error').waitFor({state:'visible'});
  assert.match(await page.locator('#error-text').innerText(),/Worker/);
  await page.evaluate(()=>{window.Worker=window.savedWorker;});
  await upload('recovered.ifc');await page.locator('#ifc-catalog input').first().waitFor();
  await page.locator('#format').selectOption('sh3d');
  await page.evaluate(()=>{window.savedBlob=Blob;window.Blob=class extends window.savedBlob{constructor(parts,options){super(options?.type==='text/javascript'?["WebAssembly.instantiate=async()=>{throw Error('synthetic WASM refusal');};",...parts]:parts,options);}};});
  await page.locator('#format').selectOption('ifc');await upload('bad-wasm.ifc');await page.locator('#error').waitFor({state:'visible'});
  assert.match(await page.locator('#error-text').innerText(),/IFC/);
  await page.evaluate(()=>{window.Blob=window.savedBlob;});await upload('wasm-recovered.ifc');await page.locator('#ifc-catalog input').first().waitFor();
  await upload('unsupported.ifc',{noRooms:true,noOpenings:true,wallThickness:1.2});await page.locator('#ifc-catalog input').first().waitFor();
  assert.equal(await page.locator('#ifc-catalog input:checked').count(),0);
  await page.locator('#ifc-catalog .primary').click();await page.locator('#result').waitFor({state:'visible'});
  assert.equal(await page.locator('#levels button.primary').count(),0,'no empty space is downloadable');
  const reportEvent=page.waitForEvent('download');await page.locator('#shared-notes button').click();
  const reportDownload=await reportEvent,localized=JSON.parse(readFileSync(await reportDownload.path(),'utf8'));
  assert.equal(localized.language,'ru');assert.equal(localized.entities.filter(e=>e.kind==='wall'&&e.message?.includes('Толщина')).length,5);
  await upload('spanning.ifc',{twoFloors:true,emptyUpper:true,wallHeight:6,noRooms:true,noOpenings:true});
  await page.locator('#ifc-catalog input').last().waitFor();
  assert.equal(await page.locator('#ifc-catalog input').last().isDisabled(),false,'upper floor with measured spanning walls must be selectable');
  await page.locator('#ifc-catalog input').first().uncheck();await page.locator('#ifc-catalog .primary').click();
  await page.locator('#result').waitFor({state:'visible'});assert.equal(await page.locator('svg.ifc-preview').count(),1);
  const spanningEvent=page.waitForEvent('download');await page.locator('#levels .primary').click();
  const spanningDownload=await spanningEvent,spanning=JSON.parse(readFileSync(await spanningDownload.path(),'utf8')).payload.config.spaces[0];
  assert.equal(spanning.title,'Upper');assert.equal(spanning.rooms.length,0);assert.equal(spanning.partitions.length,7);
  await page.locator('[data-lang=en]').click();await page.setViewportSize({width:1100,height:900});
  await upload('gallery.ifc');await page.locator('#ifc-catalog input').first().waitFor();await page.locator('#ifc-catalog input').last().uncheck();
  await page.locator('#ifc-catalog .primary').click();await page.locator('#result').waitFor({state:'visible'});
  await page.locator('.level').filter({has:page.locator('svg.ifc-preview')}).screenshot({path:output+'synthetic-ground-preview.png'});
  assert.deepEqual(requests,[]);
  const measurements={browser:browser.version(),htmlBytes:readFileSync(fileURLToPath(new URL('../scripts/sh3d-convert/dist/index.html',import.meta.url))).length,
    longTasks:tasks,cancelMs,workers:await page.evaluate(()=>window.ifcWorkers),terminated:await page.evaluate(()=>window.ifcTerminated)};
  writeFileSync(output+'measurements.json',JSON.stringify(measurements,null,2)+'\n');
  console.log(JSON.stringify({ok:true,...measurements}));
}finally{await finish(browser,{ifcConverterArtifact:true});}
