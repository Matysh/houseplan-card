import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const {chromium}=await import(pathToFileURL(resolve(process.cwd(),'node_modules/playwright/index.mjs')));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto('http://localhost:8890/');
 await page.waitForFunction(()=>window.__matrix1129?.groupsAligned);await page.waitForTimeout(4000);
 const before=await page.evaluate(()=>window.__matrix1129.measureLayout());
 await page.evaluate(()=>window.__matrix1129.centerLayout());await page.waitForTimeout(350);
 await page.evaluate(()=>window.__matrix1129.centerLayout());await page.waitForTimeout(350);
 const result=await page.evaluate(()=>{
  const {matrix,measureLayout}=window.__matrix1129,card=window.__lab.card;
  const offsets={};for(const cell of matrix.cells)for(const id of [cell.id,cell.neighbor].filter(Boolean)){
   const p=card._layout[id];offsets[id]={x:+(p.x*1000-cell.x).toFixed(8),y:+(p.y*1000-cell.y).toFixed(8)};
  }
  return {offsets,measurements:measureLayout()};
 });
 await writeFile(resolve(here,'layout-offsets.json'),JSON.stringify(result.offsets,null,2)+'\n');
 console.log(JSON.stringify({before:before.filter(x=>x.overflow>.5).map(x=>[x.code,x.overflow]),after:result.measurements.filter(x=>x.overflow>.5).map(x=>[x.code,x.overflow]),maximumWidth:Math.max(...result.measurements.filter(x=>x.bounds).map(x=>x.bounds.right-x.bounds.left)),offsets:Object.keys(result.offsets).length}));
}finally{await browser.close();}
