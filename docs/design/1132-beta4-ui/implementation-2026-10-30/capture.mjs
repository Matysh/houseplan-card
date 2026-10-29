import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const out=process.argv[2] || 'output/1132-comparison/product';
const origin=process.argv[3] || 'http://127.0.0.1:8914/';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={version:browser.version(),frames:[]};
async function ready(page){
 await page.waitForFunction(()=>window.__lab?.card?._continuity?.overlayVisible===false,{timeout:60000});
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});
}
async function pageAt(width,height){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await page.goto(origin,{waitUntil:'networkidle',timeout:90000});
 await ready(page); await page.setViewportSize({width:width+1,height}); await ready(page); await page.setViewportSize({width,height}); await ready(page); return page;
}
try{
 for(const [id,width,height] of [['01-wide',1600,950],['02-compact',1200,850],['03-wrapped',800,850],['04-three-rows',390,844]]){
  const page=await pageAt(width,height);
  await page.screenshot({path:out+'/'+id+'.png'});
  const metric=await page.evaluate(()=>{const h=window.__lab.card.shadowRoot.querySelector('.hdr');const r=h.getBoundingClientRect();const visible=e=>e.getBoundingClientRect().width>0;const controls=[...h.querySelectorAll('button,hp-settings-select')].filter(visible).map(e=>{const q=e.getBoundingClientRect();return{kind:e.dataset.hp,height:q.height,width:q.width,x:q.x,y:q.y}});const z=h.querySelector('[data-hp=zoom-out]')?.getBoundingClientRect(),rot=h.querySelector('[data-hp=rotate-right]')?.getBoundingClientRect();return{headerHeight:r.height,phase:h.dataset.panelFlow,phone:h.hasAttribute('data-panel-phone'),rows:new Set(controls.map(c=>Math.round(c.y))).size,rotationZoomGap:z?.width?z.x-rot.right:null,controls}});
  report.frames.push({id,width,height,...metric});await page.close();
 }
 const print=await pageAt(1200,900);
 await print.locator('houseplan-card').locator('[data-hp=pdf]').click();
 await print.locator('hp-pdf-dialog').locator('hp-dialog').waitFor();
 await print.evaluate(async()=>{const roots=[document];const animations=[];for(let i=0;i<roots.length;i++)for(const e of roots[i].querySelectorAll('*')){if(e.shadowRoot)roots.push(e.shadowRoot);for(const a of e.getAnimations())if(a.effect?.getTiming().iterations!==Infinity)animations.push(a);}await Promise.all(animations.map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
 await print.screenshot({path:out+'/05-print-dialog.png'});await print.close();
 const external=await pageAt(1200,900);
 await external.locator('houseplan-card').locator('[data-hp=settings]').click();
 await external.locator('[data-section-target=external-screens]').click();
 await external.locator('[data-hp=external-screen-edit]').first().click();
 await external.locator('hp-dialog[data-kind=external-screen-constructor]').waitFor();
 await external.evaluate(async()=>{const roots=[document];const animations=[];for(let i=0;i<roots.length;i++)for(const e of roots[i].querySelectorAll('*')){if(e.shadowRoot)roots.push(e.shadowRoot);for(const a of e.getAnimations())if(a.effect?.getTiming().iterations!==Infinity)animations.push(a);}await Promise.all(animations.map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
 await external.screenshot({path:out+'/06-external-screen.png'});await external.close();
 const markers=await pageAt(1600,950);
 await markers.screenshot({path:out+'/07-markers-lqi.png',clip:{x:374,y:102,width:412,height:396}});await markers.close();
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
