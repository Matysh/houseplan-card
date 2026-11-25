import test from 'node:test';
import assert from 'node:assert/strict';
import { FloorCacheRuntime } from '../test-build/floor-cache-runtime.js';
import { FloorCacheScheduler } from '../test-build/floor-cache-scheduler.js';
import { prepareFloorGeometry } from '../test-build/floor-geometry-frame.js';
import { encodeGeometryValue } from '../test-build/floor-cache-codec.js';
import { physicalFloorFingerprint, cleanFloorFingerprint } from '../test-build/floor-geometry-key.js';
import { cacheSha256 } from '../test-build/floor-cache-key.js';
import { captureFloorPreview } from '../test-build/floor-cache-preview.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const raw=makeLargeHouseFixture({floors:1,roomsPerFloor:1,devices:0,openings:0,partitions:0,columns:0,decor:0,stairs:0}).config.spaces[0];
function selection(id,authority,scope='user-A'){
  const floor={...raw,id};
  return{authority,connection:1,scope,persistentKey:cacheSha256(floor)+'|flat',fitKey:cacheSha256(id),
    input:{raw:floor,floorKey:id+'|'+physicalFloorFingerprint(floor),cleanKey:id+'|'+cleanFloorFingerprint(floor),projection:'flat'},
    light:{fingerprint:'current-light',geometryFingerprint:'geometry',polygons:[],passageStates:[]}};
}
async function result(input){
  return{wire:encodeGeometryValue(await prepareFloorGeometry(input)),payload:{text:'{}',bytes:2,checksum:'a'.repeat(64)},
    light:encodeGeometryValue({fingerprint:'current-light',occluders:[],floor:[],opaqueBodies:[],masonryGeometry:[]}),hit:false,ms:1};
}
function harness(initial){
  let current=initial;const hydrated=[],jobs=[],reads=[],publications=[],changes=[],frames=[];
  const owner=new FloorCacheRuntime({selection:()=>current,hydrate:(frame,light)=>{hydrated.push(frame.id);frames.push({frame,light});},changed:kind=>changes.push(kind)});
  owner.scheduler={run(job,priority){const d=defer();jobs.push({...d,job,priority});return d.promise;},
    runWithOutcome(job){const d=defer();jobs.push({job,resolve(result,outcome=result?'ready':'timeout'){d.resolve({result,outcome});}});return d.promise;},
    cancel(){this.cancels=(this.cancels||0)+1;},retryWorker(){},dispose(){this.disposed=true},metrics:{}};
  owner.store={read(address,level){if(level==='preview')return Promise.resolve(null);const d=defer();reads.push({...d,address});return d.promise;},
    publish(value,isCurrent){publications.push({value,isCurrent});return Promise.resolve(isCurrent());},close(){this.closed=true},metrics:{}};
  return{owner,hydrated,jobs,reads,publications,changes,frames,set:value=>{current=value}};
}
test('#1514 concurrent 3D cards share only the encoded job within the same account scope', async ({mock}) => {
  const jobs = [];
  mock.method(FloorCacheScheduler.prototype, 'runWithOutcome', function(job) {
    const work = defer();
    jobs.push({ ...work, job, scheduler: this });
    return work.promise;
  });
  const base = selection('A', {});
  const initial = { ...base, persistentKey: base.persistentKey.replace('|flat', '|iso'),
    input: { ...base.input, projection: 'iso' } };
  const retired = harness(initial);
  const first = harness({ ...initial, authority: {} });
  const second = harness({ ...initial, authority: {} });
  const otherUser = harness({ ...initial, authority: {}, scope: 'user-B' });
  const consumers = [retired, first, second, otherUser];
  try {
    for (const consumer of consumers) {
      consumer.owner.ensure();
      consumer.reads[0].resolve(null);
    }
    await flush();
    assert.equal(jobs.length, 2);
    assert.notStrictEqual(jobs[0].scheduler, jobs[1].scheduler);
    retired.set(null);
    retired.owner.ensure();
    jobs[0].resolve({ result: await result(jobs[0].job.input), outcome: 'ready' });
    await flush();
    assert.deepEqual(retired.hydrated, []);
    assert.deepEqual(first.hydrated, ['A']);
    assert.deepEqual(second.hydrated, ['A']);
    assert.notStrictEqual(first.frames[0].frame, second.frames[0].frame);
    assert.deepEqual(otherUser.hydrated, []);
    jobs[1].resolve({ result: await result(jobs[1].job.input), outcome: 'ready' });
    await flush();
    assert.deepEqual(otherUser.hydrated, ['A']);
    assert.notStrictEqual(otherUser.frames[0].frame, first.frames[0].frame);
  } finally {
    for (const consumer of consumers) consumer.owner.dispose();
  }
});
test('#1454 late IDB replies cannot reacquire A after A→B→A navigation',async()=>{
  const authority={}, a=selection('A',authority), b=selection('B',authority), h=harness(a);
  assert.equal(h.owner.ensure(),false);
  h.set(b);h.owner.ensure();h.set(a);h.owner.ensure();
  assert.equal(h.reads.length,3);
  h.reads[0].resolve(null);h.reads[1].resolve(null);await flush();assert.equal(h.jobs.length,0);
  h.reads[2].resolve(null);await flush();assert.equal(h.jobs.length,1);
  h.jobs[0].resolve(await result(a.input));await flush();
  assert.deepEqual(h.hydrated,['A']);assert.equal(h.owner.pending,false);h.owner.dispose();
});
test('#1454 late worker response and a retired user never hydrate or publish',async()=>{
  const a=selection('A',{}), b=selection('A',{},'user-B'), h=harness(a);
  h.owner.ensure();h.reads[0].resolve(null);await flush();
  h.set(null);h.owner.ensure();h.set(b);h.owner.ensure();
  h.jobs[0].resolve(await result(a.input));await flush();assert.deepEqual(h.hydrated,[]);
  assert.equal(h.reads[1].address.scope,'user-B');
  h.reads[1].resolve(null);await flush();h.jobs[1].resolve(await result(b.input));await flush();
  assert.deepEqual(h.hydrated,['A']);
  const box={x:0,y:0,w:100,h:100};
  const preview=captureFloorPreview({querySelectorAll:()=>[]},{frame:{rect:box,all:box,outliers:0,hasContent:true},base:[0,0,100,100],display:box,projection:'flat',rotation:0},b.fitKey);
  h.owner.publish(preview,()=>false);assert.equal(h.publications.length,0,'no accepted paint, no publication');
  h.owner.publish(preview,()=>true);assert.equal(h.publications.length,1);
  h.set(a);h.owner.ensure();assert.equal(h.publications[0].isCurrent(),false,'old deferred writer is fenced');
  h.owner.dispose();
});
test('#1521 a failed family exits loading but stays unready until a valid explicit retry',async()=>{
  const selected=selection('A',{},undefined);delete selected.scope;
  const h=harness(selected);assert.equal(h.owner.ensure(),false);await flush();
  assert.equal(h.reads.length,0);assert.equal(h.jobs.length,1);
  h.jobs[0].resolve(null);await flush();assert.equal(h.owner.pending,false);
  assert.equal(h.owner.failed,'unavailable');assert.equal(h.owner.ensure(),false);
  assert.equal(h.owner.supportFacts.state,'error');h.owner.markPaint(true);
  assert.equal(h.owner.metrics.readyCurrentFrame,0);
  assert.equal(h.owner.metrics.familyFallbacks,1);
  h.set({...selected,light:{...selected.light,fingerprint:'new-motion-event'}});
  assert.equal(h.owner.ensure(),false);await flush();assert.equal(h.jobs.length,1,'live updates cannot start automatic retries');
  assert.equal(h.owner.retry(),true);
  assert.equal(h.owner.retry(),false,'stale button cannot restart an already new intent');
  h.owner.ensure();await flush();
  h.jobs[1].resolve(await result(selected.input));await flush();
  assert.equal(h.owner.ensure(),true);assert.equal(h.owner.failed,null);
  assert.deepEqual(h.hydrated,['A']);h.owner.dispose();
});
test('#1521 completed worker failures and invalid packets allow only the current canonical reader',async()=>{
  const a=selection('A',{});delete a.scope;
  const h=harness(a);
  for(const [index,outcome,packet] of [[0,'limited',null],[1,'error',null],[2,'ready',{wire:null,ms:1}]]){
    h.set({...a,persistentKey:'new-matrix-'+index});
    assert.equal(h.owner.ensure(),false);await flush();
    h.jobs[index].resolve(packet,outcome);await flush();
    assert.equal(h.owner.pending,false);assert.equal(h.owner.failed,null);
    assert.equal(h.owner.ensure(),true);assert.equal(h.owner.publicationNeeded,false);
    assert.equal(h.owner.readyKey,'','the canonical route is not a prepared cache hit');
    h.owner.ensure();assert.equal(h.jobs.length,index+1,'read/render never queues another attempt');
    assert.deepEqual(h.hydrated,[]);
  }
  h.owner.dispose();
});
test('#1521 A→B→A with a light miss opens the accepted geometry before optional refresh',async()=>{
  const authority={},a=selection('A',authority),b=selection('B',authority),h=harness(a);
  await ready(h,a);const entry=h.owner.memory.get(a.persistentKey);
  h.set(b);await ready(h,b);
  h.set({...a,light:{...a.light,fingerprint:'new-light-on-return'}});
  assert.equal(h.owner.ensure(),true);assert.equal(h.owner.pending,false);
  assert.equal(h.frames.at(-1).frame,entry.frame);assert.equal(h.frames.at(-1).light,undefined);
  assert.equal(h.jobs.at(-1).priority,'light');assert.equal(h.jobs.at(-1).job.memory,entry.wire);
  h.jobs.at(-1).resolve(null);await flush();
  assert.equal(h.owner.ensure(),true);assert.equal(h.owner.failed,null);
  assert.equal(h.owner.memory.get(a.persistentKey).frame,entry.frame);
  assert.deepEqual(h.changes,[undefined,undefined,'light']);
  assert.equal(h.jobs.length,3,'unavailable light never queues a new geometry job or a retry');
  h.owner.dispose();
});
test('#1454 memory beats disk but connection generation independently retires it',async()=>{
  const a=selection('A',{}), h=harness(a);h.owner.ensure();h.reads[0].resolve(null);await flush();
  h.jobs[0].resolve(await result(a.input));await flush();
  h.set({...a,fitKey:cacheSha256('new-metrics')});assert.equal(h.owner.ensure(),true);
  assert.equal(h.owner.metrics.memoryHits,1);assert.equal(h.reads.length,1);
  h.set({...a,connection:2});assert.equal(h.owner.ensure(),false);assert.equal(h.reads.length,2);
  h.owner.dispose();h.reads[1].resolve(null);await flush();assert.equal(h.jobs.length,1);
  assert.equal(h.owner.store.closed,true);assert.equal(h.owner.scheduler.disposed,true);
});
test('#1454 fit-only changes reuse an in-flight geometry job and reacquire only the matching preview',async()=>{
  const a=selection('A',{}), h=harness(a), previewReads=[];
  h.owner.store.read=(address,level)=>{const d=defer();(level==='preview'?previewReads:h.reads).push({...d,address});return d.promise;};
  h.owner.ensure();h.reads[0].resolve(null);await flush();assert.equal(h.jobs.length,1);
  const b={...a,fitKey:cacheSha256('settled-summary-and-fonts')};h.set(b);h.owner.ensure();
  assert.equal(previewReads.length,2);assert.equal(h.jobs.length,1,'not a second expensive preparation');
  const box={x:0,y:0,w:100,h:100};
  const packet=key=>captureFloorPreview({querySelectorAll:()=>[]},{frame:{rect:box,all:box,outliers:0,hasContent:true},base:[0,0,100,100],display:box,projection:'flat',rotation:0},key);
  const {cacheTextChecksum}=await import('../test-build/floor-cache-job.js');
  const payload=key=>{const text=JSON.stringify(packet(key));return{text,bytes:text.length,checksum:cacheTextChecksum(text)}};
  previewReads[0].resolve(payload(a.fitKey));await flush();assert.equal(h.owner.preview,null,'retired fit cannot move the camera');
  previewReads[1].resolve(payload(b.fitKey));await flush();assert.equal(h.owner.preview.fitKey,b.fitKey);
  h.jobs[0].resolve(await result(a.input));await flush();assert.equal(h.owner.pending,false);assert.deepEqual(h.hydrated,['A']);
  h.owner.dispose();
});
test('#1454 a placement-owned matching preview paints synchronously while IDB is pending, never under another fit',()=>{
  const a=selection('A',{}),h=harness(a),box={x:0,y:0,w:100,h:100};
  const preview=captureFloorPreview({querySelectorAll:()=>[]},{frame:{rect:box,all:box,outliers:0,hasContent:true},
    base:[0,0,100,100],display:box,projection:'flat',rotation:0},a.fitKey);
  h.owner.host.preview=()=>preview;
  assert.equal(h.owner.ensure(),false);assert.equal(h.owner.preview,preview);
  h.set({...a,fitKey:cacheSha256('different-metric-profile')});h.owner.ensure();
  assert.equal(h.owner.preview,null);h.set(null);h.owner.ensure();assert.equal(h.owner.preview,null);h.owner.dispose();
});
test('#1454 live light refresh retains the accepted geometry frame, wire and persistent payload',async()=>{
  const a=selection('A',{}),h=harness(a);h.owner.ensure();h.reads[0].resolve(null);await flush();
  h.jobs[0].resolve(await result(a.input));await flush();
  const accepted=h.owner.memory.get(a.persistentKey),reads=h.reads.length;
  const b={...a,light:{...a.light,fingerprint:'light-B'}};h.set(b);
  assert.equal(h.owner.ensure(),true);await flush();
  assert.equal(h.reads.length,reads,'accepted geometry does not reread disk');
  assert.equal(h.jobs[1].job.kind,'light');assert.equal(h.jobs[1].job.memory,accepted.wire);
  const light={fingerprint:'light-B',occluders:[],floor:[],opaqueBodies:[],masonryGeometry:[]};
  h.jobs[1].resolve({light:encodeGeometryValue(light),ms:1});await flush();
  const refreshed=h.owner.memory.get(a.persistentKey);
  for(const key of ['frame','wire','payload'])assert.equal(refreshed[key],accepted[key],`${key} keeps identity`);
  assert.deepEqual(refreshed.light,light);assert.equal(refreshed.lightKey,'light-B');
  assert.equal(h.owner.pending,false);assert.equal(h.owner.metrics.memoryHits,1);
  assert.equal(h.owner.metrics.misses,1);assert.equal(h.owner.metrics.diskHits,0);
  assert.equal(h.owner.metrics.familyFallbacks,0,'light-only response needs no geometry wire');
  h.owner.dispose();
});
const previewFor=selected=>{
  const box={x:0,y:0,w:100,h:100};
  return captureFloorPreview({querySelectorAll:()=>[]},{frame:{rect:box,all:box,outliers:0,hasContent:true},
    base:[0,0,100,100],display:box,projection:'flat',rotation:0},selected.fitKey);
};
const lightResult=fingerprint=>({light:encodeGeometryValue({fingerprint,occluders:[],floor:[],opaqueBodies:[],masonryGeometry:[]}),ms:1});
async function ready(h,selected){h.owner.ensure();h.reads.at(-1).resolve(null);await flush();h.jobs.at(-1).resolve(await result(selected.input));await flush();}
test('#1454 live bursts stay ready and coalesce latest light without cancelling or republishing geometry',async()=>{
  const a=selection('A',{}),h=harness(a);await ready(h,a);
  h.owner.publish(previewFor(a),()=>true);await flush();assert.equal(h.owner.publicationNeeded,false);
  h.owner.metrics.firstPreview=11;h.owner.metrics.firstCachedFullFrame=22;h.owner.metrics.readyCurrentFrame=33;
  const entry=h.owner.memory.get(a.persistentKey),token=h.owner.paintToken,sequence=h.owner.sequence,cancels=h.owner.scheduler.cancels;
  for(const fingerprint of ['light-B','light-C','light-D']){
    h.set({...a,light:{...a.light,fingerprint}});assert.equal(h.owner.ensure(),true);
    assert.equal(h.owner.pending,false);assert.equal(h.owner.paintToken,token);assert.equal(h.owner.sequence,sequence);
    assert.equal(h.owner.retainedLight,entry.light);assert.equal(h.owner.publicationNeeded,false);
  }
  assert.equal(h.jobs.length,2,'one active light, not one terminated worker per tick');
  assert.equal(h.jobs[1].priority,'light');assert.equal(h.owner.scheduler.cancels,cancels);
  h.jobs[1].resolve(lightResult('light-B'));await flush();
  assert.equal(h.frames.length,1,'superseded light never hydrates');assert.equal(h.jobs.length,3);
  assert.equal(h.jobs[2].job.light.fingerprint,'light-D','only latest target follows the active job');
  h.jobs[2].resolve(lightResult('light-D'));await flush();
  const latest=h.owner.memory.get(a.persistentKey);
  for(const key of ['frame','wire','payload'])assert.equal(latest[key],entry[key]);
  assert.equal(latest.lightKey,'light-D');assert.equal(h.owner.retainedLight,undefined);
  assert.deepEqual(h.changes,[undefined,'light']);assert.equal(h.owner.publicationNeeded,false);
  assert.equal(h.publications.length,1);assert.equal(h.owner.scheduler.cancels,cancels);
  assert.deepEqual([h.owner.metrics.firstPreview,h.owner.metrics.firstCachedFullFrame,h.owner.metrics.readyCurrentFrame],[11,22,33]);
  h.owner.dispose();
});
test('#1454 failed silent light leaves geometry ready, releases retained light and retries only a new revision',async()=>{
  const a=selection('A',{}),h=harness(a);await ready(h,a);const entry=h.owner.memory.get(a.persistentKey);
  const b={...a,light:{...a.light,fingerprint:'light-B'}};h.set(b);h.owner.ensure();
  assert.equal(h.owner.retainedLight,entry.light);h.jobs[1].resolve(null);await flush();
  assert.equal(h.owner.pending,false);assert.equal(h.owner.retainedLight,undefined);
  assert.equal(h.owner.memory.get(a.persistentKey),entry);assert.equal(h.owner.metrics.familyFallbacks,1);
  for(let i=0;i<5;i++)assert.equal(h.owner.ensure(),true);
  assert.equal(h.jobs.length,2,'failed revision does not create an update/retry loop');
  h.set({...b,light:{...b.light,fingerprint:'light-C'}});h.owner.ensure();assert.equal(h.jobs.length,3);
  h.set({...b,authority:{}});assert.equal(h.owner.retainedLight,undefined,'retired authority cannot borrow light before ensure');
  h.owner.ensure();h.jobs[2].resolve(lightResult('light-C'));await flush();assert.equal(h.frames.length,1);
  h.owner.dispose();
});
test('#1454 confirmed generations survive A→B→A while genuine fit changes publish again',async()=>{
  const authority={},a=selection('A',authority),b=selection('B',authority),h=harness(a);
  await ready(h,a);h.owner.publish(previewFor(a),()=>true);await flush();
  h.set(b);await ready(h,b);h.owner.publish(previewFor(b),()=>true);await flush();
  h.set(a);assert.equal(h.owner.ensure(),true);assert.equal(h.owner.publicationNeeded,false,'no DOM capture needed for already written A generation');
  h.owner.publish(previewFor(a),()=>true);assert.equal(h.publications.length,2);
  const fit={...a,fitKey:cacheSha256('new-fit')};h.set(fit);h.owner.ensure();assert.equal(h.owner.publicationNeeded,true);
  h.owner.publish(previewFor(fit),()=>true);await flush();assert.equal(h.publications.length,3);assert.equal(h.owner.publicationNeeded,false);
  h.set(a);h.owner.ensure();assert.equal(h.owner.publicationNeeded,true,'one stored generation per floor, not all historical fits');
  h.owner.dispose();
});
test('#1454 publication deduplicates in-flight generations but never confirms a failed or stale writer',async()=>{
  const a=selection('A',{}),h=harness(a);await ready(h,a);const writes=[];
  h.owner.store.publish=(value,isCurrent)=>{const d=defer();writes.push({...d,value,isCurrent});return d.promise;};
  h.owner.publish(previewFor(a),()=>true);assert.equal(h.owner.publicationNeeded,false);
  h.owner.publish(previewFor(a),()=>true);assert.equal(writes.length,1);
  h.set({...a,light:{...a.light,fingerprint:'light-B'}});h.owner.ensure();
  assert.equal(writes[0].isCurrent(),true,'live light does not retire an immutable generation');
  writes[0].resolve(false);await flush();assert.equal(h.owner.publicationNeeded,true);
  h.owner.publish(previewFor(a),()=>true);assert.equal(writes.length,2);
  const fit={...a,fitKey:cacheSha256('new-fit')};h.set(fit);h.owner.ensure();
  assert.equal(writes[1].isCurrent(),false);writes[1].resolve(true);await flush();
  assert.equal(h.owner.publicationNeeded,true,'stale successful response is not a confirmed current generation');
  h.owner.publish(previewFor(fit),()=>true);writes[2].resolve(true);await flush();assert.equal(h.owner.publicationNeeded,false);
  h.owner.dispose();
});
test('#1454 a stale successful overwrite cannot leave the previous generation falsely confirmed',async()=>{
  const a=selection('A',{}),h=harness(a);await ready(h,a);
  h.owner.publish(previewFor(a),()=>true);await flush();assert.equal(h.owner.publicationNeeded,false);
  const writes=[];h.owner.store.publish=(value,isCurrent)=>{const d=defer();writes.push({...d,value,isCurrent});return d.promise;};
  const second={...a,fitKey:cacheSha256('second-generation')};h.set(second);h.owner.ensure();
  h.owner.publish(previewFor(second),()=>true);
  assert.equal(writes[0].isCurrent(),true,'IDB may have passed its last authority check');
  h.set(a);h.owner.ensure();assert.equal(writes[0].isCurrent(),false);
  assert.equal(h.owner.publicationNeeded,true,'G1 is unsafe as soon as a different overwrite is scheduled');
  writes[0].resolve(true);await flush();
  assert.equal(h.owner.publicationNeeded,true,'committed stale G2 does not claim old G1 remains on disk');
  h.owner.publish(previewFor(a),()=>true);writes[1].resolve(true);await flush();assert.equal(h.owner.publicationNeeded,false);
  h.owner.dispose();
});
test('#1454 unresolved publication deduplication remains bounded across many floors',async()=>{
  const authority={},h=harness(null),writes=[];
  h.owner.store.publish=(value,isCurrent)=>{const d=defer();writes.push({...d,value,isCurrent});return d.promise;};
  for(let i=0;i<12;i++){
    const selected=selection('floor-'+i,authority);h.set(selected);await ready(h,selected);
    h.owner.publish(previewFor(selected),()=>true);assert.ok(h.owner.publishing.size<=8);
  }
  assert.equal(h.owner.publishing.size,8);
  writes[0].resolve(true);await flush();assert.equal(h.owner.published.size,0,'evicted retired ticket cannot confirm a floor');
  assert.equal(h.owner.publishing.size,8,'old completion cannot retire newer pending buckets');
  h.owner.dispose();
});
test('#1454 repeated demanded area jobs keep their redacted producer diagnostics bounded',async()=>{
  const a=selection('A',{}),h=harness(a);h.owner.ensure();h.reads[0].resolve(null);await flush();
  h.jobs[0].resolve(await result(a.input));await flush();
  h.owner.store.area=async()=>undefined;let calls=0;
  h.owner.scheduler.run=async job=>{assert.equal(job.kind,'area');return{area:42,ms:1,
    producer:{owner:'worker',counts:{sample:++calls}}};};
  for(let i=0;i<70;i++)assert.equal(await h.owner.area(a.input.raw,'area-'+i,()=>true),42);
  assert.equal(h.owner.metrics.producers.length,50);assert.equal(h.owner.metrics.producers.at(-1).counts.sample,70);
  h.owner.dispose();
});
test('#1454 a late light-only refresh cannot cross navigation or authority retirement',async()=>{
  const a=selection('A',{}),h=harness(a);h.owner.ensure();h.reads[0].resolve(null);await flush();
  h.jobs[0].resolve(await result(a.input));await flush();
  h.set({...a,light:{...a.light,fingerprint:'light-B'}});h.owner.ensure();await flush();
  assert.equal(h.jobs[1].job.kind,'light');
  const retired=h.owner.memory.get(a.persistentKey),next=selection('B',{},'user-B');
  h.set(next);h.owner.ensure();h.jobs[1].resolve({light:encodeGeometryValue({fingerprint:'light-B'}),ms:1});await flush();
  assert.deepEqual(h.hydrated,['A']);assert.equal(h.owner.memory.has(a.persistentKey),false);
  assert.equal(retired.lightKey,'current-light');assert.equal(h.owner.pending,true);
  h.reads[1].resolve(null);await flush();h.jobs[2].resolve(await result(next.input));await flush();
  assert.deepEqual(h.hydrated,['A','B']);assert.equal(h.owner.pending,false);h.owner.dispose();
});
