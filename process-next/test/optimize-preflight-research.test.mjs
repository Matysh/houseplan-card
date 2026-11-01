import test from 'node:test';
import assert from 'node:assert/strict';
import {summary,budgetResult,assertGeometry,assertPreflight} from '../../scripts/analyze-optimize-preflight.mjs';

test('1172 reports an absolute FAIL even when the prepared-builder relative comparison passes',()=>{
 const result=budgetResult([470,480,490],[460,479,485]);
 assert.equal(result.relativePass,true);assert.equal(result.absolutePass,false);assert.equal(result.pass,false);
 assert.equal(result.absoluteP95Ms,250);assert.equal(result.candidate.p95,485);
});

test('1172 incomplete/nonfinite measurements never become a successful latency series',()=>{
 for(const values of [[],[1,NaN],[Infinity],[null],[-1]])assert.throws(()=>summary(values),/Incomplete/);
 assert.deepEqual(summary([4,2,1,3]),{min:1,median:2,p95:4,max:4});
});

test('1172 direct and full measurement require production geometry success on every floor',()=>{
 for(const geometry of [null,{status:'degraded-extra'},{status:'failed-core'}])assert.throws(()=>assertGeometry(geometry,'floor'),/Unsuccessful/);
 assert.doesNotThrow(()=>assertGeometry({status:'ok'},'floor'));
 for(const [value,count] of [[{ok:true,spaces:[]},3],[{ok:true,spaces:[]},0],
  [{ok:true,spaces:[{status:'failed'}]},1],[{ok:false,spaces:[{status:'ok'}]},1]])assert.throws(()=>assertPreflight(value,count),/preflight/);
 assert.doesNotThrow(()=>assertPreflight({ok:true,spaces:[{status:'ok'},{status:'ok'},{status:'ok'}]},3));
});
test('1172 worker rejects changed harness/material/fixture before timing production', async t=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {fileURLToPath}=await import('node:url');
 const {spawnSync}=await import('node:child_process');
 const {createHash}=await import('node:crypto');
 const root=mkdtempSync(join(tmpdir(),'optimize-research-1172-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(join(root,'test-build'));
 const emptyHash=createHash('sha256').update('').digest('hex');
 writeFileSync(join(root,'material.json'),JSON.stringify({sha:'pinned-source',compiledSha256:emptyHash}));
 writeFileSync(join(root,'fixture.json'),JSON.stringify({config:{spaces:[]}}));
 const script=fileURLToPath(new URL('../../scripts/analyze-optimize-preflight.mjs',import.meta.url));
 const request={directory:root,sha:'pinned-source',fixture:join(root,'fixture.json'),fixtureSha256:'different-fixture',mode:'full',samples:1};
 for(const [override,message]of [
  [{harnessSha256:'different-harness'},'Measurement harness changed'],
  [{sha:'different-source'},'Measured material is not the pinned compiled input'],
  [{},'Fixture differs'],
  [{mode:'unknown'},'Unknown measurement mode']
 ]){
  const path=join(root,'request.json');writeFileSync(path,JSON.stringify({...request,...override}));
  const result=spawnSync(process.execPath,[script,'--worker',path],{encoding:'utf8'});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0);assert.ok(result.stderr.includes(message),result.stderr);
  assert.equal(result.stdout,'');
 }
});
