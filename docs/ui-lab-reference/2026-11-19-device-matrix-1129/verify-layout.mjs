import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url));
const {chromium}=await import(pathToFileURL(resolve(process.cwd(),'node_modules/playwright/index.mjs')));
const browser=await chromium.launch({headless:true});
const samples=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://localhost:8890/');await page.waitForFunction(()=>window.__matrix1129?.groupsAligned);await page.waitForTimeout(4000);
 const identity=await page.evaluate(()=>({base:window.__matrix1129.matrix.base,revision:window.__matrix1129.matrix.revision,cases:window.__matrix1129.matrix.cells.length,visible:window.__matrix1129.report().filter(c=>c.visible).length,calibrated:window.__matrix1129.matrix.layoutCalibrated}));
 assert.equal(identity.cases,336);assert.equal(identity.visible,328);assert.ok(identity.calibrated);
 for(const theme of ['dark','light']){
  if(theme==='light')await page.locator('[data-mx=theme]').click();
  for(const zoom of ['rows','close','all']){
   await page.evaluate(async zoom=>{
    const c=window.__lab.card,m=window.__matrix1129;await m.focusRows(0);
    if(zoom==='close'){c._view={...c._view,w:c._view.w/2,h:c._view.h/2};c._zoom=c._baseVb().w/c._view.w;c.requestUpdate();}
    if(zoom==='all')c._fitAll();
    await c.updateComplete;
   },zoom);await page.waitForTimeout(400);
   const measured=await page.evaluate(()=>window.__matrix1129.measureLayout());
   const failures=measured.filter(c=>c.overflow>.75);
   samples.push({theme,zoom,cells:measured.length,failures});
  }
 }
 const report={identity,samples,errors};await writeFile(resolve(here,'layout-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({identity,checks:samples.map(({theme,zoom,failures})=>({theme,zoom,overflows:failures.map(c=>({code:c.code,amount:+c.overflow.toFixed(2)}))})),errors}));
 assert.deepEqual(errors,[]);assert.equal(samples.reduce((n,s)=>n+s.failures.length,0),0,'Device blocks must remain inside their cells, including maximum pulse extent');
}finally{await browser.close();}
