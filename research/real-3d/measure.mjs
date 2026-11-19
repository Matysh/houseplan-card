import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {cpus,platform} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {serve,root} from './server.mjs';
process.chdir(root);await mkdir('evidence',{recursive:true});
const server=await serve(0),port=server.address().port;
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=d3d11']});
const report={date:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),platform:platform(),cpu:cpus()[0].model,method:'Sequential isolated pages; same physical geometry and DOM labels, 120 rAF pan+zoom frames, every 10th frame local state tick, 3 runs. SVG control is a minimal laboratory renderer, NOT the complete production 2.5D. CPU submission is not GPU duration. No gl.finish or tracing in timed series.',rows:[],checks:{},errors:[]};
try{
 for(const viewport of [{width:1480,height:1080},{width:3840,height:2160}])for(const size of ['home','dense'])for(const engine of ['three','svg']){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?engine=${engine}&size=${size}`);await page.waitForFunction(()=>window.lab?.ready,{timeout:30000});
  const info=await page.evaluate(()=>{
   const l=window.lab,gl=l.renderer?.getContext(),ext=gl?.getExtension('WEBGL_debug_renderer_info');
   return{...l.stats(),firstFrameMs:l.firstFrameMs,buildMs:l.buildMs,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,webgl:gl?.getParameter(gl.VERSION)};
  });
  assert.equal(info.contextLost,false,'WebGL initialization must succeed for this measurement');
  const runs=[];
  for(let repeat=0;repeat<3;repeat++)runs.push(await page.evaluate(async()=>{
   const intervals=[],cpu=[];let last;
   for(let i=0;i<150;i++){
    const now=await new Promise(requestAnimationFrame),t=performance.now();
    window.lab.pan(i);if(i%10===0)window.lab.tick(i);window.lab.sync();
    if(i>=30){if(last!==undefined)intervals.push(now-last);cpu.push(performance.now()-t);}last=now;
   }
   const summary=a=>{a.sort((x,y)=>x-y);return{median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
   return{intervalMs:summary(intervals),cpuSubmissionMs:summary(cpu),stats:window.lab.stats()};
  }));
  const row={viewport,size,engine,info,runs};report.rows.push(row);console.log(JSON.stringify(row));
  if(viewport.width===1480&&size==='home'){
   await page.click('#fit');await page.waitForTimeout(100);await page.screenshot({path:`evidence/mvp-${engine}.png`});
   const before=await page.evaluate(()=>window.lab.stats());await page.waitForTimeout(250);
   assert.equal((await page.evaluate(()=>window.lab.stats())).renderCount,before.renderCount,'Idle must not render');report.checks['idle-'+engine]=true;
   if(engine==='three'){
    const discrepancy=await page.evaluate(()=>{
     let max=0;for(const turn of [0,90,180,270]){window.lab.setTurn(turn);window.lab.sync();for(const p of [[500,500,0],[100,100,100],[780,220,35]]){const a=window.lab.project(...p),b=window.lab.projectGpu(...p);max=Math.max(max,Math.hypot(a[0]-b[0],a[1]-b[1]));}}return max;
    });assert.ok(discrepancy<1e-6,'Camera algebra must match existing projection');report.checks.cameraMaxError=discrepancy;
    const builds=before.builds;await page.locator('.device').first().click();await page.waitForTimeout(50);assert.equal((await page.evaluate(()=>window.lab.stats())).builds,builds);report.checks.deviceNoGeometryRebuild=true;
    await page.evaluate(()=>window.lab.setAmount(0));await page.waitForTimeout(50);const memory0=await page.evaluate(()=>window.lab.stats().geometry.geometries);
    for(let i=0;i<10;i++)await page.evaluate(v=>window.lab.setAmount(v),i%2);
    await page.waitForTimeout(50);assert.equal((await page.evaluate(()=>window.lab.stats())).geometry.geometries,memory0);report.checks.openingDisposal=true;
    await page.evaluate(()=>window.lab.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());await page.waitForFunction(()=>window.lab.stats().mode==='svg');report.checks.contextLossFallback=true;
   }
  }
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{
 await mkdir('evidence/private',{recursive:true});
 await writeFile('evidence/private/measurement-hardware.json',JSON.stringify(report,null,2));
 report.cpu='Local high-end desktop CPU; exact environment retained privately';
 for(const row of report.rows)row.info.gpu=/SwiftShader/i.test(row.info.gpu||'')?'Software SwiftShader':'Hardware NVIDIA / ANGLE D3D11; exact adapter retained privately';
 await writeFile('evidence/measurement.json',JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));
}
