/** Reproduce AC10 from complete reports: default junction, or --axial. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url)));
const prefix=process.argv.includes('--axial')?'':'junction-';
const baseline=read(prefix+'baseline.json'),candidate=read(prefix+'candidate.json');
const compareIdentity=(a,b)=>{
 for(const key of ['runnerSHA256','fixtureSHA256','node','browser','cpu','series','samples','warmups'])assert.equal(a[key],b[key],key);
 assert.equal(a.complete,true);assert.equal(b.complete,true);assert.equal(a.series,3);assert.equal(a.warmups,5);
};
compareIdentity(baseline,candidate);assert.equal(baseline.samples,20);
const median=values=>{const a=values.toSorted((x,y)=>x-y),i=a.length/2;return a.length%2?a[Math.floor(i)]:(a[i-1]+a[i])/2;};
const p95=values=>values.toSorted((x,y)=>x-y)[Math.ceil(values.length*.95)-1];
const checks=[];
for(const name of new Set(baseline.rows.filter(row=>'ms'in row).map(row=>row.name))){
 const a=baseline.rows.filter(row=>row.name===name).map(row=>row.ms),b=candidate.rows.filter(row=>row.name===name).map(row=>row.ms);
 assert.equal(a.length,name==='opening-drag-frame'?300:60);assert.equal(b.length,a.length);
 const m0=median(a),m1=median(b),p0=p95(a),p1=p95(b),noise=m0<5;
 checks.push({name,samples:a.length,baselineMedian:m0,candidateMedian:m1,baselineP95:p0,candidateP95:p1,
  medianRatio:m1/m0,p95Ratio:p1/p0,criterion:noise?'additive 5ms':'median<=1.10; p95<=1.15',
  pass:noise?m1<=m0+5&&p1<=p0+5:m1<=m0*1.10&&p1<=p0*1.15});
}
const bm=read(prefix+'baseline-memory.json'),cm=read(prefix+'candidate-memory.json');compareIdentity(bm,cm);
assert.equal(bm.samples,1);assert.equal(bm.preciseMemoryFlag,true);assert.equal(cm.preciseMemoryFlag,true);
assert.equal(bm.rootFingerprint,baseline.rootFingerprint);assert.equal(cm.rootFingerprint,candidate.rootFingerprint);
for(const name of ['heap','retained-heap']){
 const a=bm.rows.filter(r=>r.name===name).map(r=>r.bytes),b=cm.rows.filter(r=>r.name===name).map(r=>r.bytes);
 assert.equal(a.length,3);assert.equal(b.length,3);const before=Math.max(...a),after=Math.max(...b);
 checks.push({name,baseline:before,candidate:after,ratio:after/before,criterion:'<=1.15',pass:after<=before*1.15});
}
const result={issue:1216,baselineFingerprint:baseline.rootFingerprint,candidateFingerprint:candidate.rootFingerprint,
 runnerSHA256:candidate.runnerSHA256,fixtureSHA256:candidate.fixtureSHA256,checks,pass:checks.every(row=>row.pass)};
writeFileSync(new URL(prefix+'comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
