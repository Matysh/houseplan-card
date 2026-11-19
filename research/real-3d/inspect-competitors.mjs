// Public, anonymous, read-only inspection. Never signs up or posts a project.
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {root} from './server.mjs';
process.chdir(root);await mkdir('evidence',{recursive:true});
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=d3d11']});
const results=[];
for(const url of ['https://remplanner.ru/planner/visual/','https://planner5d.com/editor']){
 const page=await browser.newPage({viewport:{width:1480,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000}).catch(e=>errors.push(e.message));
  await page.waitForTimeout(5000);
  const data=await page.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,6500),canvases:document.querySelectorAll('canvas').length,three:globalThis.THREE?.REVISION||null,babylon:globalThis.BABYLON?.Engine?.Version||null,scripts:[...document.querySelectorAll('script[src]')].map(s=>s.src)}));
  const assets=[];
  for(const asset of data.scripts.filter(x=>/planner\.visual|\/build\/app\.js$/.test(x))){
   try{const r=await page.request.get(asset,{timeout:15000}),bytes=await r.body(),text=bytes.toString();assets.push({url:asset,status:r.status(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),fingerprints:{three:/THREE|three\.js|WebGLRenderer/.test(text),babylon:/BABYLON|Babylon\.js/.test(text),webgl:/WebGL|webgl/.test(text)},viewerUrls:[...new Set(text.match(/(?:https?:\/\/|\/files\/visual\/)[^\s'"<>`]+/g)||[])].slice(0,12)});}catch(e){assets.push({url:asset,error:e.message});}
  }
  const name=url.includes('remplanner')?'remplanner':'planner5d';await page.screenshot({path:`evidence/${name}-observed.png`});
  const safeErrors=errors.map(s=>s.replace(/https?:\/\/[^\s]+/g,u=>{try{const x=new URL(u);return x.origin+x.pathname;}catch{return u;}})).slice(0,20);
  const {text,...metadata}=data;
  metadata.scripts=metadata.scripts.filter(u=>{const h=new URL(u).hostname;return h==='remplanner.ru'||h==='planner5d.com'||h==='static.planner5d.com';});
  results.push({...metadata,assets,errors:safeErrors});console.log(JSON.stringify({url:data.url,canvases:data.canvases,assets,errors:safeErrors.slice(0,4)}));
 }catch(e){results.push({url,error:e.stack,errors});}
 await page.close();
}
await browser.close();await writeFile('evidence/competitors-observed.json',JSON.stringify(results,null,2));
