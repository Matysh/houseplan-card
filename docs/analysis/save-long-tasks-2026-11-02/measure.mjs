import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {launch,requirePinnedBrowser} from '../../../demo/serve.mjs';
import {makeSelectiveInvalidationFixture} from '../../../demo/fixtures/selective-invalidation.mjs';
import {installSelectiveInvalidationFixture} from '../../../demo/helpers/selective-invalidation-fixture.mjs';
import {runPaintTiming} from '../../../demo/helpers/selective-invalidation-paint.mjs';
import {createConfigAdoption} from '../../../test-build/config-adoption.js';
const label=process.argv[2]??'baseline';if(!/^[a-z0-9-]+$/.test(label))throw Error('Use a simple label');const folder=`artifacts/save-cost-1153-${label}`;mkdirSync(folder,{recursive:true});
const fixture=makeSelectiveInvalidationFixture(true),adoption=createConfigAdoption();adoption.stageLocalConfig(fixture.config);adoption.stageLocalLayout(fixture.layout);
const micro=[];let rev=1;
for(let series=-1;series<5;series++){
 const start=performance.now();for(let i=0;i<100;i++){fixture.config.spaces[0].title=`Series${series}-${i}`;adoption.acceptConfigWrite(fixture.config,{rev:rev++});}
 if(series>=0)micro.push((performance.now()-start)/100);
}
const record={diagnosticOnly:true,label,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,cpu:os.cpus()[0]?.model,kernel:os.release(),platform:os.platform(),loadBefore:os.loadavg(),manifest:JSON.parse(readFileSync('dist/houseplan-assets.json','utf8')),micro:{method:'acceptConfigWrite, 100 evolving full config candidates per series; one warmup series then five measured. Includes fresh hashing, accepted-cache cloning and revision capture; no mock hash or no-op persistence path.',perCallMs:micro},samples:[]};
requirePinnedBrowser('#1153 controlled Save series');
for(let round=0;round<3;round++){
 const {page,browser}=await launch({width:1440,height:1000},1,[],{},undefined,undefined,'/demo.html?device-history=1');
 try{
  record.browser=browser.version();await page.locator('#host').evaluate(host=>host.style.width='1200px');
  const load=await installSelectiveInvalidationFixture(page,makeSelectiveInvalidationFixture(true));
  record.load=load;
  const samples=await runPaintTiming({page,card:page.locator('houseplan-card'),delay:0,iterations:5,cases:['room-name','room-paint','visible-bg']});
  record.samples.push(...samples.map(sample=>({...sample,round,cold:sample.iteration===0})));
 }finally{await browser.close();}
}
record.loadAfter=os.loadavg();writeFileSync(`${folder}/measurement.json`,JSON.stringify(record,null,2)+'\n');
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
console.log(JSON.stringify({source:record.source,microMedianMs:median(micro),micro,groups:Object.fromEntries(['room-name','room-paint','visible-bg'].map(name=>[name,{coldMedian:median(record.samples.filter(s=>s.case===name&&s.cold).map(s=>s.client)),warmMedian:median(record.samples.filter(s=>s.case===name&&!s.cold).map(s=>s.client)),maxLongTask:Math.max(0,...record.samples.filter(s=>s.case===name).flatMap(s=>s.longTasks.map(t=>t.duration))),coldMaxLongTask:Math.max(0,...record.samples.filter(s=>s.case===name&&s.cold).flatMap(s=>s.longTasks.map(t=>t.duration))),warmMaxLongTask:Math.max(0,...record.samples.filter(s=>s.case===name&&!s.cold).flatMap(s=>s.longTasks.map(t=>t.duration)))}]))},null,2));