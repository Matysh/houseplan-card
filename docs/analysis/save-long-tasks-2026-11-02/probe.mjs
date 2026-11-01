import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {launch,requirePinnedBrowser} from '../../../demo/serve.mjs';
import {makeSelectiveInvalidationFixture} from '../../../demo/fixtures/selective-invalidation.mjs';
import {installSelectiveInvalidationFixture} from '../../../demo/helpers/selective-invalidation-fixture.mjs';
import {runPaintTiming} from '../../../demo/helpers/selective-invalidation-paint.mjs';
requirePinnedBrowser();
const dir='artifacts/save-long-tasks-1153-instrumented';mkdirSync(dir,{recursive:true});
const {page,browser}=await launch({width:1440,height:1000},1,[],{},undefined,undefined,'/demo.html?device-history=1');
try{
  await page.locator('#host').evaluate(host=>host.style.width='1200px');
  const load=await installSelectiveInvalidationFixture(page,makeSelectiveInvalidationFixture(true));
  await page.evaluate(()=>{
    const c=window.__card, stack=[], observations=[]; window.__cost1153=observations;
    const wrap=(object,key,label)=>{
      const original=object?.[key]; if(typeof original!=='function')throw Error(`Missing probe ${label}`);
      object[key]=function(...args){const start=performance.now();stack.push(label);try{return Reflect.apply(original,this,args);}finally{observations.push({label,start,end:performance.now()});stack.pop();}};
    };
    for(const key of ['rememberAccepted','acceptConfigWrite','stageConfigCandidate','refreshConfigFingerprint'])wrap(c._adoption,key,`adoption.${key}`);
    for(const key of ['_cfgFingerprint','_cacheSnapshot'])wrap(c,key,`card.${key}`);
    wrap(c._deviceContacts,'sync','contacts.sync');
    const clone=window.structuredClone;
    window.structuredClone=function(...args){const start=performance.now(),owner=stack.at(-1)??'other';try{return Reflect.apply(clone,this,args);}finally{observations.push({label:'structuredClone',owner,start,end:performance.now()});}};
  });
  const session=await page.context().newCDPSession(page);
  await session.send('Profiler.enable');await session.send('Profiler.setSamplingInterval',{interval:1000});
  await session.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
  await session.send('Profiler.start');
  const anchor=await page.evaluate(()=>{const t=performance.now();performance.mark('diag-1145-anchor',{startTime:t});return t;});
  const samples=await runPaintTiming({page,card:page.locator('houseplan-card'),delay:0,iterations:5,cases:['room-name','room-paint','visible-bg']});
  const costs=await page.evaluate(()=>window.__cost1153);
  const {profile}=await session.send('Profiler.stop');
  const complete=new Promise(r=>session.once('Tracing.tracingComplete',r));await session.send('Tracing.end');const {stream}=await complete;
  let trace='';for(;;){const chunk=await session.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}await session.send('IO.close',{handle:stream});
  writeFileSync(`${dir}/trace.json`,trace);writeFileSync(`${dir}/profile.cpuprofile`,JSON.stringify(profile));
  const record={diagnosticOnly:true,instrumented:true,notNormativePass:true,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),manifest:JSON.parse(readFileSync('dist/houseplan-assets.json','utf8')),load,anchor,samples,costs};
  writeFileSync(`${dir}/samples.json`,JSON.stringify(record,null,2)+'\n');
  const costSummary=samples.map(sample=>{
    const totals={};for(const event of costs){const overlap=Math.max(0,Math.min(event.end,sample.paint)-Math.max(event.start,sample.input));if(!overlap)continue;
      const key=event.label+(event.owner?`:${event.owner}`:'');const row=totals[key]??={ms:0,calls:0};row.ms+=overlap;row.calls++;
    }
    return {case:sample.case,iteration:sample.iteration,client:sample.client,totals};
  });
  writeFileSync(`${dir}/cost-summary.json`,JSON.stringify({diagnosticOnly:true,instrumented:true,source:record.source,method:'Inclusive method durations and native clone overlap clipped to unchanged input→paint windows. Nested method totals overlap and must not be added.',samples:costSummary},null,2));
  console.log(JSON.stringify({methodCosts:costSummary},null,2));
  const events=JSON.parse(trace).traceEvents,mark=events.find(e=>e.name==='diag-1145-anchor'&&e.ph==='R');
  const fallback=events.find(e=>e.name==='diag-1145-anchor');const offset=(mark||fallback).ts-anchor*1000;
  const spans=samples.map(s=>[offset+s.input*1000,offset+s.paint*1000]);
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const totals=new Map();let time=profile.startTime;
  for(let i=0;i<profile.samples.length;i++){const dt=profile.timeDeltas[i];time+=dt;if(!spans.some(([a,b])=>time>=a&&time<=b))continue;const n=nodes.get(profile.samples[i]);const k=`${n.callFrame.functionName||'(anonymous)'} @ ${n.callFrame.url.split('/').at(-1)}:${n.callFrame.lineNumber+1}`;totals.set(k,(totals.get(k)||0)+dt/1000);}
  console.log(JSON.stringify({diagnosticOnly:true,samples:samples.map(s=>({case:s.case,iteration:s.iteration,client:s.client,ackToPaint:s.ackToPaint,longTasks:s.longTasks})),matchedInputWindowSelfMs:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,22)},null,2));
}finally{await browser.close();}