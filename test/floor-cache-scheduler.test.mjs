import test from 'node:test';
import assert from 'node:assert/strict';
import { FloorCacheScheduler } from '../test-build/floor-cache-scheduler.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import { ENTRY_BUILD_FINGERPRINT } from '../test-build/editor-runtime-loader.js';
class WorkerFake {
  static all=[];
  constructor(){ WorkerFake.all.push(this);this.terminated=false; }
  postMessage(value){this.message=value;}
  terminate(){this.terminated=true;}
  complete(result={ms:1}){this.onmessage?.({data:{id:this.message.id,fingerprint:ENTRY_BUILD_FINGERPRINT,result}});}
}
const job = raw => ({kind:'area',raw});
test('#1454 navigation retires old work and last intent owns the answer', async()=>{
  WorkerFake.all=[]; const owner=new FloorCacheScheduler(()=>new WorkerFake());
  const first=owner.run(job({id:'A'})), a=WorkerFake.all.at(-1);
  const second=owner.run(job({id:'B'})), b=WorkerFake.all.at(-1);
  const last=owner.run(job({id:'C'})), c=WorkerFake.all.at(-1);
  assert.equal(await first,null);assert.equal(await second,null);
  assert.equal(a.terminated,true);assert.equal(b.terminated,true);
  a.complete({area:99,ms:1});b.complete({area:88,ms:1});c.complete({area:7,ms:1});
  assert.deepEqual(await last,{area:7,ms:1});
  assert.equal(owner.metrics.cancelled,2);owner.dispose();
});
test('#1454 summary never preempts a navigation and navigation terminates summary',async()=>{
  WorkerFake.all=[];const owner=new FloorCacheScheduler(()=>new WorkerFake());
  const nav=owner.run(job({id:'A'}));
  assert.equal(await owner.run(job({id:'summary'}),'summary'),null);
  WorkerFake.all.at(-1).complete();await nav;
  const summary=owner.run(job({id:'summary'}),'summary'), worker=WorkerFake.all.at(-1);
  const next=owner.run(job({id:'next'}));
  assert.equal(worker.terminated,true);assert.equal(await summary,null);
  WorkerFake.all.at(-1).complete();await next;owner.dispose();
});
test('#1454 a light refresh queues without terminating active work and remains preemptible by navigation',async()=>{
  WorkerFake.all=[];const owner=new FloorCacheScheduler(()=>new WorkerFake());
  const summary=owner.run(job({id:'summary'}),'summary'),worker=WorkerFake.all.at(-1);
  const light=owner.run(job({id:'light'}),'light');assert.equal(worker.terminated,false);
  assert.equal(owner.metrics.workerJobs,1);assert.equal(await owner.run(job({id:'other-summary'}),'summary'),null);
  worker.complete({area:2,ms:1});await summary;assert.equal(worker.message.job.raw.id,'light');
  assert.equal(WorkerFake.all.length,1,'queued light reuses the live worker');
  const nav=owner.run(job({id:'next'}));assert.equal(await light,null);assert.equal(worker.terminated,true);
  WorkerFake.all.at(-1).complete({area:3,ms:1});await nav;owner.dispose();
});
test('#1454 unsupported/crashed worker has one honest degraded path, not a creation loop',async()=>{
  const raw=makeLargeHouseFixture({floors:1,roomsPerFloor:1,devices:0,openings:0,partitions:0,columns:0,decor:0,stairs:0}).config.spaces[0];
  let attempts=0;const owner=new FloorCacheScheduler(()=>{attempts++;throw Error('CSP')});
  const first=await owner.run(job(raw)), second=await owner.run(job(raw));
  assert.equal(typeof first.area,'number');assert.equal(first.area,second.area);
  assert.equal(attempts,1);assert.equal(owner.metrics.workerErrors,1);assert.equal(owner.metrics.fallbackJobs,2);
  owner.dispose();assert.equal(await owner.run(job(raw)),null);
});
test('#1454 an incompatible worker build cannot hydrate its result',async()=>{
  WorkerFake.all=[];
  const raw=makeLargeHouseFixture({floors:1,roomsPerFloor:1,devices:0,openings:0,partitions:0,columns:0,decor:0,stairs:0}).config.spaces[0];
  const owner=new FloorCacheScheduler(()=>new WorkerFake()), pending=owner.run(job(raw));
  const worker=WorkerFake.all.at(-1);
  const lateError=worker.onerror, lateDecodeError=worker.onmessageerror;
  worker.onmessage({data:{id:worker.message.id,fingerprint:'foreign-build',result:{area:999999,ms:1}}});
  lateError();lateDecodeError();
  const value=await pending;
  assert.notEqual(value.area,999999);assert.equal(typeof value.area,'number');
  assert.equal(owner.metrics.workerErrors,1);assert.equal(owner.metrics.fallbackJobs,1);owner.dispose();
});
