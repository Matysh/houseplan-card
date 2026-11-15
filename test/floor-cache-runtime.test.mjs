import test from 'node:test';
import assert from 'node:assert/strict';
import { FloorCacheRuntime } from '../test-build/floor-cache-runtime.js';
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
  let current=initial;const hydrated=[],jobs=[],reads=[],publications=[];
  const owner=new FloorCacheRuntime({selection:()=>current,hydrate:frame=>hydrated.push(frame.id),changed(){}});
  owner.scheduler={run(job){const d=defer();jobs.push({...d,job});return d.promise;},cancel(){},dispose(){this.disposed=true},metrics:{}};
  owner.store={read(address,level){if(level==='preview')return Promise.resolve(null);const d=defer();reads.push({...d,address});return d.promise;},
    publish(value,isCurrent){publications.push({value,isCurrent});return Promise.resolve(isCurrent());},close(){this.closed=true},metrics:{}};
  return{owner,hydrated,jobs,reads,publications,set:value=>{current=value}};
}
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
test('#1454 absent scope stays ephemeral and a failed family exits loading once',async()=>{
  const selected=selection('A',{},undefined);delete selected.scope;
  const h=harness(selected);assert.equal(h.owner.ensure(),false);await flush();
  assert.equal(h.reads.length,0);assert.equal(h.jobs.length,1);
  h.jobs[0].resolve(null);await flush();assert.equal(h.owner.pending,false);
  assert.equal(h.owner.ensure(),true);assert.equal(h.jobs.length,1,'ordinary canonical fallback, not an endless cache retry');
  assert.equal(h.owner.metrics.familyFallbacks,1);h.owner.dispose();
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
  assert.equal(h.owner.ensure(),false);await flush();
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
