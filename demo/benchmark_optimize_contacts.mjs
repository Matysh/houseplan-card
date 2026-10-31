// #1166: full Optimize baseline/candidate in one process; unchanged budgets.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeLargeHouseFixture} from './fixtures/large-house.mjs';
import {optimizePlans} from '../test-build/plan-optimizer.js';

assert.ok(process.argv[2],'provide the compiled v1.83.0 checkout');
const baselineRoot=resolve(process.argv[2]);
const baseline=(await import(pathToFileURL(resolve(baselineRoot,'test-build/plan-optimizer.js')).href)).optimizePlans;
const fixture=makeLargeHouseFixture(),samples={baseline:[],candidate:[]};
for(let i=0;i<3;i++){baseline(fixture.config,fixture.layout);optimizePlans(fixture.config,fixture.layout);}
for(let i=0;i<20;i++)for(const [name,run]of (i%2?[['candidate',optimizePlans],['baseline',baseline]]:[['baseline',baseline],['candidate',optimizePlans]])){
  const begin=performance.now();run(fixture.config,fixture.layout);samples[name].push(performance.now()-begin);
}
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const oldP95=p95(samples.baseline),newP95=p95(samples.candidate),limit=oldP95*1.2+15;
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
const report={node:process.version,cpu:cpus()[0]?.model,warmups:3,samplesPerSide:20,
  fixture:'demo/fixtures/large-house.mjs',fixtureSHA256:createHash('sha256').update(readFileSync(new URL('./fixtures/large-house.mjs',import.meta.url))).digest('hex'),
  baseline:{sha:git(baselineRoot,['rev-parse','HEAD']),p95:oldP95},
  candidate:{sha:git(process.cwd(),['rev-parse','HEAD']),workingTreeDiffSHA256:createHash('sha256').update(git(process.cwd(),['diff','HEAD'])).digest('hex'),p95:newP95},
  samples,limit,ok:newP95<=limit};
if(process.env.HP_1166_PERF_REPORT)writeFileSync(process.env.HP_1166_PERF_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
assert.ok(report.ok,`full Optimize p95 ${newP95.toFixed(2)} > ${limit.toFixed(2)} ms`);
