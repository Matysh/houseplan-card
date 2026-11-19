// Actual unchanged product bundle on the same synthetic plan. Diagnostic only.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {serve,root} from './server.mjs';
import {fixture} from './out/scene-node.mjs';
process.chdir(root);
const server=await serve(0),browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=d3d11']});
const report={source:'f4f474cf489015af967bbd6fa03cda62c07bc975',browser:browser.version(),rows:[],errors:[],method:'Unchanged product demo harness, same canonical synthetic rooms/openings/furniture; virtual icons differ from MVP numeric DOM badges. 45 real pointer moves per pan, 3 series. Diagnostic, not an equivalent scene/FPS ratio.'};
try{
 for(const iso of [false,true]){
  const page=await browser.newPage({viewport:{width:1480,height:1080},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/product/demo.html`);
  await page.waitForFunction(()=>window.__card?._loadOk);
  const f=fixture('home');
  const setup=await page.evaluate(async({f,iso})=>{
   const card=window.__card,space={...f.space,title:'Synthetic research',id:'f1',decor:f.furniture.map(x=>({...x,kind:'furniture'})),settings:{show_borders:true,show_names:true,fill_mode:'custom',custom_fill:{c:'#dce8e8',a:.4}}};
   const cfg={spaces:[space],settings:{volumetric_view:iso},markers:f.devices.map(d=>({id:d.id,binding:'virtual',space:'f1',name:d.name,icon:'mdi:lightbulb'}))};
   const layout=Object.fromEntries(f.devices.map(d=>[d.id,{s:'f1',x:d.x/1000,y:d.y/1000}]));
   window.__pushServerConfig(cfg);window.__pushServerLayout(layout);
   const until=async(fn)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Fixture did not settle');};
   await until(()=>card._serverCfg?.spaces?.[0]?.title==='Synthetic research');
   if(iso){if(!await card._ensureIsoSceneRuntime())throw Error('No iso runtime');}
   card.requestUpdate();await card.updateComplete;await new Promise(r=>setTimeout(r,500));
   document.querySelector('#host').style.cssText='width:1480px;height:1080px;margin:0;padding:0';
   card.style.height='1080px';card.requestUpdate();await card.updateComplete;
   await until(()=>!card._booting);return {rooms:card._model?.[0]?.rooms?.length,dom:card.renderRoot.querySelectorAll('*').length,paths:card.renderRoot.querySelectorAll('path').length,devices:card.renderRoot.querySelectorAll('.dev').length,iso:!!card.renderRoot.querySelector('[data-hp="iso-walls"]')};
  },{f,iso});
  await page.waitForTimeout(500);await page.screenshot({path:`evidence/product-${iso?'25d':'flat'}.png`});
  const runs=[];
  for(let j=0;j<3;j++){
   const beforeView=await page.evaluate(()=>JSON.stringify(window.__card._view));
   await page.evaluate(()=>{if(window.__researchRaf)cancelAnimationFrame(window.__researchRaf);window.__researchFrames=[];let prev;window.__researchRunning=true;function frame(t){if(prev)window.__researchFrames.push(t-prev);prev=t;if(window.__researchRunning)window.__researchRaf=requestAnimationFrame(frame);}window.__researchRaf=requestAnimationFrame(frame);});
   const t=performance.now();await page.mouse.move(70,950);await page.mouse.down();await page.mouse.move(500,800,{steps:45});await page.mouse.up();
   const elapsed=performance.now()-t;
   const frames=await page.evaluate(()=>{window.__researchRunning=false;cancelAnimationFrame(window.__researchRaf);const a=window.__researchFrames.sort((x,y)=>x-y);return{median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],count:a.length};});
   const afterView=await page.evaluate(()=>JSON.stringify(window.__card._view));assert.notEqual(afterView,beforeView,'Actual pointer series must move the product camera');
   runs.push({pointerSeriesMs:elapsed,frames,cameraMoved:true});
  }
  const row={iso,setup,runs};report.rows.push(row);console.log(JSON.stringify(row));await page.close();
 }
 report.status=report.errors.length?'failed':'passed';
}catch(e){report.status='failed';report.failure=e.stack;console.error(e);process.exitCode=1;}
finally{await writeFile('evidence/product-probe.json',JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));}
