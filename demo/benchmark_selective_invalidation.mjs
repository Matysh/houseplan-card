// #1093: one bounded native timing gate, shared by task core and the full beta matrix.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {launch,requirePinnedBrowser,reportPageErrors} from './serve.mjs';
import {isMainModule} from '../scripts/spawn-portable.mjs';
import {makeSelectiveInvalidationFixture} from './fixtures/selective-invalidation.mjs';
import {installSelectiveInvalidationFixture} from './helpers/selective-invalidation-fixture.mjs';
import {runHistoryTiming} from './helpers/selective-invalidation-history.mjs';
import {runPaintTiming} from './helpers/selective-invalidation-paint.mjs';
const paintCases=['visible-bg','visible-color','visible-title','room-name','room-paint','inactive-paint'];
const percentile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.ceil(values.length*p)-1];
export function timingStatistics(samples) {
  const groups=new Map();
  for(const sample of samples) {
    const key=JSON.stringify([sample.scene,sample.dpr,sample.case,sample.delay,!!sample.cold]);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample);
  }
  return [...groups.values()].map(rows=>({scene:rows[0].scene,dpr:rows[0].dpr,case:rows[0].case,delay:rows[0].delay,
    cold:!!rows[0].cold,n:rows.length,...Object.fromEntries(['inputToRequest','ackToPaint','client'].map(field=>{
      const values=rows.map(row=>row[field]);return[field,{median:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values)}];
    })),maxLongTask:Math.max(0,...rows.flatMap(row=>row.longTasks.map(task=>task.duration)))}));
}
export function timingFailures(samples,{iterations=20}={}) {
  const failures=[];
  if(!samples.length)return ['empty timing matrix'];
  for(const sample of samples) {
    if(!sample.trusted||!sample.persisted||sample.requests!==1)failures.push(`${sample.case}: native/persisted/single-write proof missing`);
    for(const field of ['inputToRequest','ackToPaint','client'])if(!Number.isFinite(sample[field])||sample[field]<0)failures.push(`${sample.case}: invalid ${field}`);
  }
  for(const row of timingStatistics(samples)) {
    const b=row.case.startsWith('history-'),label=`${row.scene}/DPR${row.dpr}/${row.case}/${row.delay}ms`;
    if(!row.cold&&row.dpr===1&&row.n!==iterations)failures.push(`${label}: expected ${iterations} samples, got ${row.n}`);
    for(const [field,limit] of [['inputToRequest',b?120:100],['ackToPaint',b?180:100],['client',b?300:200]])
      if(!row.cold&&row.dpr===1&&row[field].p95>limit)failures.push(`${label}: ${field} p95=${row[field].p95} >${limit}`);
    if(row.client.max>(b?600:400))failures.push(`${label}: client max=${row.client.max} >${b?600:400}`);
    if(row.maxLongTask>(b?200:100))failures.push(`${label}: long task=${row.maxLongTask} >${b?200:100}`);
  }
  return failures;
}
export async function runSelectiveInvalidationGate({profile='visible',iterations=20,output='artifacts/1093/timing.json'}={}) {
  requirePinnedBrowser();
  assert.ok(['visible','inactive','history0','history320','full','paint-probe'].includes(profile));
  assert.ok(Number.isInteger(iterations)&&iterations>0);
  const samples=[],loads=[],failures=[],browsers=[];
  const runScene=async({large,dpr,cases,delays,history=false,cold=false})=>{
    const {page,browser}=await launch({width:1440,height:1000},dpr,[],{},undefined,undefined,'/demo.html?device-history=1');
    const scene=large?'large':'small',card=page.locator('houseplan-card');
    try {
      browsers.push(browser.version());
      const hostWidth=cases.some(name=>name!=='visible-bg')?1200:780;
      await page.locator('#host').evaluate((host,width)=>host.style.width=`${width}px`,hostWidth);
      const load=await installSelectiveInvalidationFixture(page,makeSelectiveInvalidationFixture(large));
      loads.push({scene,dpr,cold,hostWidth,...load});
      assert.ok(load.wallPaths>0&&load.contacts>0&&load.contactFaces>1,'nonempty real geometry and contacts');
      if(large)assert.ok(load.markers>=200&&load.hidden===0&&load.visible>=100&&load.contacts>=30,JSON.stringify(load));
      else assert.ok(load.markers===8&&load.visible===8,JSON.stringify(load));
      const n=cold||dpr===2?1:iterations;
      for(const delay of delays) {
        if(cases.length)await runPaintTiming({page,card,delay,iterations:n,cases,onSample:s=>samples.push({...s,scene,dpr,cold})});
        if(history)await runHistoryTiming({page,card,delay,iterations:n,onSample:s=>samples.push({...s,case:`history-${s.action}`,scene,dpr,cold})});
      }
    } finally {
      if(await reportPageErrors())failures.push(`${scene}/DPR${dpr}: browser page errors`);
      await browser.close();
    }
  };
  try {
    if(profile==='full') {
      for(const large of [true,false]) {
        await runScene({large,dpr:1,cases:paintCases,delays:[0,320],history:true});
        for(let cold=0;cold<3;cold++)await runScene({large,dpr:1,cases:['visible-bg'],delays:[0],cold:true});
        // DPR2 is a separately reported correctness/counter sibling; the 20-run
        // normative percentile is DPR1. Its maxima/long tasks still fail closed.
        await runScene({large,dpr:2,cases:paintCases,delays:[0,320],history:true});
      }
    } else await runScene({large:true,dpr:1,
      cases:profile==='visible'?['visible-bg']:profile==='inactive'?['inactive-paint']:profile==='paint-probe'?paintCases:[],
      delays:profile==='history0'?[0]:profile==='history320'?[320]:[0,320],history:profile.startsWith('history')});
    failures.push(...timingFailures(samples,{iterations}));
  } catch(error) {failures.push(error.stack||String(error));}
  const sources=['demo/benchmark_selective_invalidation.mjs','demo/fixtures/selective-invalidation.mjs',
    'demo/helpers/selective-invalidation-fixture.mjs','demo/helpers/selective-invalidation-paint.mjs','demo/helpers/selective-invalidation-history.mjs'];
  const report={schema:2,profile,correctnessProbe:iterations!==20,node:process.version,browsers:[...new Set(browsers)],viewport:[1440,1000],
    fixture:'selective-invalidation/v1',
    sources:Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),
    manifest:JSON.parse(readFileSync('dist/houseplan-assets.json','utf8')),loads,samples,statistics:timingStatistics(samples),failures};
  mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({output,profile,samples:samples.length,failures}));
  if(failures.length)process.exitCode=1;
  return report;
}
if(isMainModule(import.meta.url))await runSelectiveInvalidationGate({
  profile:process.argv.find(a=>a.startsWith('--profile='))?.slice(10)||'visible',
  iterations:Number(process.argv.find(a=>a.startsWith('--iterations='))?.slice(13)||20),
  output:process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'artifacts/1093/timing.json'});
