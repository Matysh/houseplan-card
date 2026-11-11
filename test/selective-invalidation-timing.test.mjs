import test from 'node:test';
import assert from 'node:assert/strict';
import {timingVerdict,timingFailures} from '../demo/benchmark_selective_invalidation.mjs';
const series=()=>Array.from({length:20},()=>({scene:'large',dpr:1,case:'visible-bg',delay:0,
  trusted:true,persisted:true,requests:1,inputToRequest:20,ackToPaint:30,client:55,longTasks:[{duration:124}]}));
test('#1295 a measured slow series keeps diagnostic excess separate from required native persistence proof',()=>{
  const samples=series(),snapshot=structuredClone(samples),v=timingVerdict(samples);
  assert.deepEqual(v.failures,[]);assert.deepEqual(v.budgetFailures,['large/DPR1/visible-bg/0ms: long task=124 >117']);
  assert.deepEqual(timingFailures(samples),v.budgetFailures,'strict API retains original budget verdict');
  assert.deepEqual(samples,snapshot);
  for(const change of [s=>s[0].trusted=false,s=>s[0].persisted=false,s=>s[0].requests=2,
    s=>s[0].client=NaN,s=>s[0].longTasks[0].duration=NaN,s=>s.pop()]){
    const invalid=series();change(invalid);assert.ok(timingVerdict(invalid).failures.length);
  }
  assert.deepEqual(timingVerdict([]).failures,['empty timing matrix']);
});

test('#1382 history long tasks remain reported while invalid history samples still fail',()=>{
  const samples=series().map(sample=>({...sample,case:'history-copy',ackToPaint:150,client:180,
    longTasks:[{duration:211}]}));
  const verdict=timingVerdict(samples);
  assert.deepEqual(verdict.failures,[]);
  assert.deepEqual(verdict.budgetFailures,['large/DPR1/history-copy/0ms: long task=211 >200']);
  assert.deepEqual(timingFailures(samples),verdict.budgetFailures,'strict callers retain their original thresholds');
  for(const change of [s=>s[0].trusted=false,s=>s[0].persisted=false,s=>s[0].requests=2,
    s=>s[0].client=NaN,s=>s[0].longTasks[0].duration=NaN,s=>s.pop()]){
    const invalid=structuredClone(samples);change(invalid);
    assert.ok(timingVerdict(invalid).failures.length,'diagnostic budgets cannot excuse an invalid history sample');
  }
});
