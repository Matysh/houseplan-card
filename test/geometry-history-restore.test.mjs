import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFixture,historyHarness,historyChanges} from './helpers/geometry-history-harness.mjs';
test('#1100 physical Undo retains warm foreign floor pools',()=>{
 const h=historyHarness(historyFixture({large:true}));assert.ok(h.command('thickness',historyChanges.thickness),'actual canonical edit records a command');
 for(const id of ['a','b','c'])assert.ok(h.warm(id));h.host._space='a';
 const unions=[...h.host._wallUnionPool.keys()].filter(k=>k.startsWith('b|')||k.startsWith('c|'));
 const bodies=[...h.host._physicalBodiesPool.keys()].filter(k=>k.startsWith('b|')||k.startsWith('c|'));
 assert.equal(h.runtime._stepGeometryHistory('undo'),true);
 assert.deepEqual([...h.host._wallUnionPool.keys()].filter(k=>k.startsWith('b|')||k.startsWith('c|')),unions);
 assert.deepEqual([...h.host._physicalBodiesPool.keys()].filter(k=>k.startsWith('b|')||k.startsWith('c|')),bodies);
 const count=h.host._floorCacheBuilds.wallUnion;assert.ok(h.warm('b'));assert.equal(h.host._floorCacheBuilds.wallUnion,count);
});
for(const name of ['transform','stairs'])test('#1100 '+name+' Undo/Redo avoids model visits and physical cache clearing',()=>{
 const h=historyHarness(historyFixture({stairsCase:name==='stairs'}));h.command(name,historyChanges[name]);for(const id of ['a','b','c'])h.warm(id);h.host._space='a';
 let modelReads=0;Object.defineProperty(h.host._serverCfg.spaces[0],'model_read_witness',{enumerable:true,configurable:true,get(){modelReads++;return 'ordinary-input';}});
 const keys=[...h.host._wallUnionPool.keys()];
 for(const direction of ['undo','redo']){
  assert.equal(h.runtime._stepGeometryHistory(direction),true);
  assert.equal(modelReads,0,'unknown raw-space getter is visited by canonical model/adoption, never by the snapshot/physical key');
  assert.equal(h.counts.preflight,0);assert.equal(h.counts.union,0);assert.deepEqual([...h.host._wallUnionPool.keys()],keys);
 }
});
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {historyCharacterization,historyCases,historyCaseHarness} from './helpers/geometry-history-characterization.mjs';
import {commitEditedSpaceModel} from '../test-build/physical-candidate-proof.js';
import {spacePhysicalGeometryFingerprint} from '../test-build/plan-geometry-preflight.js';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/1100-history-characterization.json',import.meta.url),'utf8'));
for(const [id,config] of Object.entries(corpus.documents))assert.equal(createHash('sha256').update(JSON.stringify(config)).digest('hex'),id,'baseline document passport');
for(const name of historyCases)test('#1100 unchanged exact history outcome: '+name,()=>{
 const expected=corpus.results[name],actual=historyCharacterization(name);
 assert.equal(JSON.stringify(actual.afterEdit),JSON.stringify(corpus.documents[expected.afterEdit]));
 assert.equal(actual.steps.length,expected.steps.length);
 actual.steps.forEach((step,index)=>{
  const {document,...metadata}=expected.steps[index],{config,...actualMetadata}=step;
  assert.deepEqual(actualMetadata,metadata);assert.equal(JSON.stringify(config),JSON.stringify(corpus.documents[document]));
 });
});

const physicalIdentity=(config,id)=>({fingerprint:spacePhysicalGeometryFingerprint(config.spaces.find(s=>s.id===id)),modelVersion:Number(config.model_version||0)});
// Replaying the same UUID input makes an independent legacy canonicalization comparable.
function canonicalEntropy(operation){
 const original=crypto.randomUUID;let serial=0;crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
 try{return operation();}finally{crypto.randomUUID=original;}
}
for(const name of historyCases.filter(name=>!['stairs','transform'].includes(name)))
 test('#1100 exact raw/canonical union quota: '+name,t=>{
  const {h,command}=historyCaseHarness(name);
  for(const direction of ['undo','redo']){
   const target=direction==='undo'?command.before:command.after;
   const raw=structuredClone(h.host._serverCfg);h.runtime._restoreGeometryStateInConfig(raw,target);
   const canonical=canonicalEntropy(()=>commitEditedSpaceModel(raw,target.spaceId)),rawKey=physicalIdentity(raw,target.spaceId),canonicalKey=physicalIdentity(canonical,target.spaceId);
   const equal=JSON.stringify(rawKey)===JSON.stringify(canonicalKey),expected=equal?1:2;
   const start={...h.counts},checks=h.checks.length;
   assert.equal(canonicalEntropy(()=>h.runtime._stepGeometryHistory(direction)),true);
   assert.equal(h.counts.preflight-start.preflight,expected,'each distinct candidate crosses the real safety barrier');
   assert.equal(h.counts.union-start.union,expected,'union producer quota includes the mandatory raw guard');
   const observed=h.checks.slice(checks).map(config=>physicalIdentity(config,target.spaceId));
   assert.deepEqual(observed,equal?[rawKey]:[rawKey,canonicalKey],'raw precedes canonical and no check is replaced by a cached rendered floor');
   if(name==='pre-v9'&&direction==='undo')assert.equal(equal,false,'ordinary legacy input must exercise the two-union branch');
   t.diagnostic(JSON.stringify({name,direction,rawKey,canonicalKey,equal,unions:h.counts.union-start.union}));
  }
 });

test('#1100 the allowed equal boundary verdict is negative and attempt-local',()=>{
 const {h}=historyCaseHarness('thickness'),native=h.host._checkSpacePhysicalGeometry;
 h.host._checkSpacePhysicalGeometry=(...args)=>({...native(...args),ok:false,status:'failed',reason:'wall-degraded-extra'});
 for(const direction of ['undo','redo']){
  const count=h.counts.preflight;
  assert.equal(h.runtime._stepGeometryHistory(direction),true);
  assert.equal(h.counts.preflight-count,1);
  assert.equal(h.host._pendingPhysicalWrites.get('a').fingerprint,'','negative is never outbound proof');
 }
});

test('#1100 a different repairable legacy candidate still receives both negative verdicts',()=>{
 const {h}=historyCaseHarness('pre-v9'),native=h.host._checkSpacePhysicalGeometry;
 h.host._checkSpacePhysicalGeometry=(...args)=>({...native(...args),ok:false,status:'failed',reason:'wall-degraded-extra'});
 assert.equal(h.runtime._stepGeometryHistory('undo'),true);assert.equal(h.counts.preflight,2);
 assert.notEqual(physicalIdentity(h.checks[0],'a').fingerprint,physicalIdentity(h.checks[1],'a').fingerprint);
 assert.equal(h.host._pendingPhysicalWrites.get('a').fingerprint,'');
});

for(const phase of ['raw','canonical'])for(const failure of ['negative','exception'])
 test('#1100 '+phase+' '+failure+' never becomes a successful proof (unit verdict boundary)',()=>{
  const {h,command}=historyCaseHarness('pre-v9'),native=h.host._checkSpacePhysicalGeometry;
  const before=JSON.stringify(h.host._serverCfg),pending=structuredClone([...h.host._pendingPhysicalWrites]);let calls=0;
  h.host._checkSpacePhysicalGeometry=(...args)=>{
   calls++;
   if(calls===(phase==='raw'?1:2)){
    if(failure==='exception')throw new TypeError('checker boundary input');
    return {...native(...args),ok:false,status:'failed',reason:'wall-failed-core'};
   }
   return native(...args);
  };
  assert.equal(h.runtime._stepGeometryHistory('undo'),failure==='exception'?'retry':'geometry');
  assert.equal(calls,phase==='raw'?1:2);
  assert.equal(JSON.stringify(h.host._serverCfg),before);assert.deepEqual([...h.host._pendingPhysicalWrites],pending);
  assert.equal(h.counts.save,0);assert.equal(h.host._geometryHistory.peekRedo(),null);
  assert.equal(h.host._geometryHistory.peekUndo(),failure==='exception'?command:null);
 });

test('#1100 a model-version boundary always checks the canonical candidate separately (unit-only legacy input)',()=>{
 const {h,command}=historyCaseHarness('thickness');h.host._serverCfg.model_version=9;
 assert.equal(h.runtime._applyGeometryState(command.before),true);
 assert.equal(h.counts.preflight,2);
 assert.deepEqual(h.checks.map(config=>config.model_version),[9,10]);
});

test('#1100 current physical history never visits foreign room carriers',()=>{
 const {h}=historyCaseHarness('thickness'),foreign=h.host._serverCfg.spaces[1],rooms=foreign.rooms;let reads=0;
 Object.defineProperty(foreign,'rooms',{enumerable:true,configurable:true,get(){reads++;return rooms;}});
 assert.equal(h.runtime._stepGeometryHistory('undo'),true);assert.equal(reads,0);
 assert.equal(h.host._serverCfg.spaces[1],foreign);
});

test('#1100 a legacy root keeps atomic foreign-floor migration (unit-only legacy input)',()=>{
 const {h,command}=historyCaseHarness('thickness'),foreign=h.host._serverCfg.spaces[1];
 h.host._serverCfg.model_version=9;delete foreign.wall_segments;for(const room of foreign.rooms)delete room.wall_ids;
 assert.equal(h.runtime._applyGeometryState(command.before),true);assert.equal(h.host._serverCfg.model_version,10);
 assert.ok(h.host._serverCfg.spaces.every(space=>Array.isArray(space.wall_segments)&&space.rooms.every(room=>Array.isArray(room.wall_ids))));
 assert.equal(h.counts.preflight,2);
});

for(const guarded of ['wallChainSeedIds','roomReferences'])test('#1100 '+guarded+' keeps nonphysical history on the strict lane',()=>{
 const {h,command}=historyCaseHarness('transform');command.before[guarded]=[];
 let reads=0;Object.defineProperty(h.host._serverCfg.spaces[0],'model_read_witness',{enumerable:true,configurable:true,get(){reads++;return 'guarded-input';}});
 assert.equal(h.runtime._stepGeometryHistory('undo'),true);assert.ok(reads>0,'guarded snapshot still crosses canonical model/adoption');
});

test('#1100 pending physical writes keep nonphysical history on its existing strict path',()=>{
 const {h,command}=historyCaseHarness('transform');h.host._pendingPhysicalWrites.set('a',{before:command.before,fingerprint:'existing-pending'});
 const pending=h.host._pendingPhysicalWrites.get('a');
 let reads=0;Object.defineProperty(h.host._serverCfg.spaces[0],'model_read_witness',{enumerable:true,configurable:true,get(){reads++;return 'pending-input';}});
 assert.equal(h.runtime._stepGeometryHistory('undo'),true);assert.ok(reads>0);assert.equal(h.host._pendingPhysicalWrites.get('a'),pending);
});
