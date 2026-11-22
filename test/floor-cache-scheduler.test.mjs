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

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve; return { promise: new Promise(done => { resolve = done; }), resolve }; };
test('#1521 a silent worker and stalled fallback import are bounded together', async ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0, computations = 0;
  const loading = deferred(), owner = new FloorCacheScheduler(() => new WorkerFake(), () => loading.promise, () => now);
  try {
    const pending = owner.run(job({id:'A'})); const worker = WorkerFake.all.at(-1);
    now = 15_000; mock.timers.tick(15_000); await flush();
    assert.equal(worker.terminated, true);
    assert.equal(owner.stage, 'fallback-load');
    now = 18_000; mock.timers.tick(3_000);
    assert.equal(await pending, null);
    assert.deepEqual(owner.metrics.last, {stage:'fallback-load',outcome:'timeout'});
    assert.equal(owner.metrics.workerTimeouts, 1);
    loading.resolve({computeFloorJob(){ computations++; return {area:10,ms:1}; }});
    await flush(); assert.equal(computations, 0);
  } finally { owner.dispose(); }
});

test('#1521 pending fallback computation is aborted; late results cannot replace a retry', async ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const calculation = deferred(); let now = 0, signal;
  const owner = new FloorCacheScheduler(() => new WorkerFake(), async () => ({
    computeFloorJob(_job, abort) { signal = abort; return calculation.promise; },
  }), () => now);
  try {
    const previous = owner.run(job({id:'A'}));
    WorkerFake.all.at(-1).onerror(new Event('error')); await flush();
    assert.equal(owner.stage, 'fallback-compute');
    now = 3_000; mock.timers.tick(3_000);
    assert.equal(await previous, null); assert.equal(signal.aborted, true);
    assert.deepEqual(owner.metrics.last, {stage:'fallback-compute',outcome:'timeout'});
    owner.retryWorker();
    const retry = owner.run(job({id:'A'})); const worker = WorkerFake.all.at(-1);
    calculation.resolve({area:99,ms:1}); await flush();
    assert.equal(owner.stage, 'worker');
    worker.complete({area:5,ms:1}); assert.deepEqual(await retry, {area:5,ms:1});
  } finally { owner.dispose(); }
});

test('#1521 admission prevents expensive synchronous fallback and rejects load errors once', async () => {
  let loads = 0;
  const owner = new FloorCacheScheduler(() => { throw Error('unavailable'); }, async () => {
    loads++; throw Error('missing module');
  });
  try {
    const raw = { id: 'large', rooms: Array.from({length: 129}, () => ({})) };
    assert.equal(await owner.run(job(raw)), null);
    assert.equal(loads, 0);
    assert.deepEqual(owner.metrics.last, {stage:'fallback-load',outcome:'limited'});
    assert.equal(await owner.run(job({id:'small'})), null);
    assert.equal(loads, 1);
    assert.deepEqual(owner.metrics.last, {stage:'fallback-load',outcome:'error'});
  } finally { owner.dispose(); }
});
