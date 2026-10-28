import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root='/home/matysh/hp-1118-golden-determinism-20261028';
const out='/mnt/c/Users/Admin/Documents/ChatGPT/Houseplan/output/to-release-s8-20261028/1118/candidate-proof';
const {launch}=await import(pathToFileURL(root+'/demo/serve.mjs'));
const {prepareGoldenScenario,goldenClip,resetGoldenStability}=await import(pathToFileURL(root+'/demo/golden/harness.mjs'));
const {GOLDEN_SCENARIOS}=await import(pathToFileURL(root+'/demo/golden/matrix.mjs'));
const {captureGoldenFrame}=await import(pathToFileURL(root+'/demo/golden/scene-repaint.mjs'));
const {assertFreshDemoBundle}=await import(pathToFileURL(root+'/demo/bundle-freshness.mjs'));
const expected='243de7d024962abb44c9f9247e50c56e9696022c1d1b7891835a8f8dbc3cb035';
const index=JSON.parse(readFileSync(root+'/demo/golden/baselines/baselines-index.json','utf8'));
const rows=[];mkdirSync(out,{recursive:true});
async function history(page){
 await page.evaluate(async()=>{
  const s=document.documentElement.style,p='--hp-golden-page-bg';
  const value=s.getPropertyValue(p),priority=s.getPropertyPriority(p);
  const frame=()=>new Promise(done=>requestAnimationFrame(done));
  try{s.setProperty(p,'rgb(1, 2, 3)','important');await frame();await frame();}
  finally{if(value)s.setProperty(p,value,priority);else s.removeProperty(p);}
  await frame();await frame();
 });
}
for(let process=0;process<10;process++){
 const {page,browser}=await launch({width:1000,height:900},1,['--force-color-profile=srgb','--font-render-hinting=none','--disable-lcd-text'],{locale:'en-US',timezoneId:'UTC',colorScheme:'dark',reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  const fingerprint=await assertFreshDemoBundle(page,root);
  const ids=['geometry-plan-editor-dark','geometry-plan-editor-dark','geometry-plan-editor-dark'];
  if(process===0||process===9)ids.push('geometry-view-dark-fit','geometry-view-light-fit');
  for(let step=0;step<ids.length;step++){
   const scenario=GOLDEN_SCENARIOS.find(s=>s.id===ids[step]);assert(scenario,ids[step]);
   const runtime=await prepareGoldenScenario(page,scenario);
   if(step===2)await history(page);
   const clip=await goldenClip(page,scenario.capture);
   const png=await captureGoldenFrame(page,scenario,{...(clip?{clip}:{}),animations:'disabled',caret:'hide',scale:'css'});
   const sha=createHash('sha256').update(png).digest('hex');
   const row={process,step,id:scenario.id,sha,fingerprint,chromium:await browser.version(),runtime};rows.push(row);
   writeFileSync(`${out}/${process}-${step}-${scenario.id}.png`,png);
   writeFileSync(out+'/report.json',JSON.stringify({complete:false,rows},null,2)+'\n');
   console.log(JSON.stringify({process,step,id:scenario.id,sha}));
   if(step<3)assert.equal(sha,expected,'fully repainted canonical frame');
   else{
    const entry=Array.isArray(index)?index.find(e=>e.id===scenario.id):index.scenarios?.[scenario.id]??index[scenario.id];
    if(!entry)throw Error('Missing baseline index entry '+scenario.id);
    assert.equal(sha,typeof entry==='string'?entry:entry.sha256,'neighbor must remain byte-identical');
   }
   await resetGoldenStability(page);
  }
  assert.deepEqual(errors,[],'no page errors');
 }finally{await browser.close();}
}
writeFileSync(out+'/report.json',JSON.stringify({complete:true,independentProcesses:10,targetCaptures:30,neighborCaptures:4,rows},null,2)+'\n');
console.log('PASS:10 independent Chromium processes;30 cold/warm/history canonical frames;4 indexed neighboring frames');
