import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {serve,root} from './server.mjs';
process.chdir(root);const server=await serve(0),browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=d3d11']});
const checks=[];
try{
 const page=await browser.newPage({viewport:{width:1480,height:1080},deviceScaleFactor:1});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.lab?.ready);
 // Hide laboratory badges only for the geometry comparison, not for measurements.
 await page.addStyleTag({content:'.device{display:none}'});
 for(const turn of [0,90,180,270]){
  await page.evaluate(value=>{window.lab.setTurn(value);window.lab.sync();},turn);await page.screenshot({path:`evidence/geometry-${turn}.png`});checks.push({turn,stats:await page.evaluate(()=>window.lab.stats())});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{window.lab.setTurn(0);window.lab.sync();});await page.waitForTimeout(50);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal mobile overflow');
 await page.screenshot({path:'evidence/mobile-390.png'});
 checks.push({mobileWidth:390,horizontalOverflow:false,note:'Desktop hardware; viewport check, not mobile GPU performance'});
 const offline=await browser.newPage({viewport:{width:1480,height:1080}});
 await offline.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await offline.goto(`http://127.0.0.1:${server.address().port}/`);await offline.waitForFunction(()=>window.lab?.ready);checks.push({noExternalNetwork:true});
 await offline.close();await page.close();
}finally{await writeFile('evidence/capture-checks.json',JSON.stringify(checks,null,2));await browser.close();await new Promise(done=>server.close(done));}
