import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root='/home/matysh/hp-1118-golden-determinism-20261028';
const out='/mnt/c/Users/Admin/Documents/ChatGPT/Houseplan/output/to-release-s8-20261028/1118/repaint-probe';
const {launch}=await import(pathToFileURL(root+'/demo/serve.mjs'));
const {prepareGoldenScenario,goldenClip,resetGoldenStability}=await import(pathToFileURL(root+'/demo/golden/harness.mjs'));
const {GOLDEN_SCENARIOS}=await import(pathToFileURL(root+'/demo/golden/matrix.mjs'));
const {captureGoldenFrame}=await import(pathToFileURL(root+'/demo/golden/scene-repaint.mjs'));
const {assertFreshDemoBundle}=await import(pathToFileURL(root+'/demo/bundle-freshness.mjs'));
const scenario=GOLDEN_SCENARIOS.find(s=>s.id==='geometry-plan-editor-dark');
const cases=[['original',[]]];
const rows=[];mkdirSync(out,{recursive:true});
for(const [name,extra]of cases){
 for(let repeat=0;repeat<4;repeat++){
  const {page,browser}=await launch({width:1000,height:900},1,['--force-color-profile=srgb','--font-render-hinting=none','--disable-lcd-text',...extra],{locale:'en-US',timezoneId:'UTC',colorScheme:'dark',reducedMotion:'reduce'});
  try{
   const fingerprint=await assertFreshDemoBundle(page,root);
   for(let warm=0;warm<3;warm++){
    const runtime=await prepareGoldenScenario(page,scenario);
    if(warm===1){
     await page.evaluate(async()=>{
      const style=document.documentElement.style,property='--hp-golden-page-bg';
      const value=style.getPropertyValue(property),priority=style.getPropertyPriority(property);
      const background=getComputedStyle(document.body).backgroundColor;
      const frame=()=>new Promise(done=>requestAnimationFrame(done));
      try{style.setProperty(property,background==='rgb(1, 2, 3)'?'rgb(3, 2, 1)':'rgb(1, 2, 3)','important');await frame();await frame();}
      finally{if(value)style.setProperty(property,value,priority);else style.removeProperty(property);}
      await frame();await frame();
     });
    }
    const clip=await goldenClip(page,scenario.capture);
    const png=await captureGoldenFrame(page,scenario,{...(clip?{clip}:{}),animations:'disabled',caret:'hide',scale:'css'});
    const sha=createHash('sha256').update(png).digest('hex');
    const row={name,repeat,warm,sha,fingerprint,chromium:await browser.version(),runtime};rows.push(row);
    writeFileSync(`${out}/${name}-${repeat}-${warm}.png`,png);
    console.log(JSON.stringify({name,repeat,warm,sha}));
    await resetGoldenStability(page);
   }
  }finally{await browser.close();}
 }
}
writeFileSync(out+'/report.json',JSON.stringify({rows},null,2)+'\n');
