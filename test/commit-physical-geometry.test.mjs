import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,scenarios,largeFixture,largeScenarios} from './helpers/geometry-commit-harness.mjs';
import {spacePhysicalGeometryFingerprint} from '../test-build/plan-geometry-preflight.js';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
for(const [name,change] of Object.entries(scenarios))test('#1099 '+name+' builds each candidate once and shares it with junctions',()=>{
 const {runtime,host,counts,toasts}=harness(); const before=runtime._geometrySnapshot('f');change(host._serverCfg.spaces[0]);
 const raw=spacePhysicalGeometryFingerprint(host._serverCfg.spaces[0]);const canonical=spacePhysicalGeometryFingerprint(commitWallSegmentModel(host._serverCfg).config.spaces[0]);
 assert.equal(runtime._commitPhysicalGeometry(name,before),true,JSON.stringify(toasts));
 const limit=raw===canonical?1:2;
 assert.ok(counts.preflight<=limit,JSON.stringify({counts,rawEqualsCanonical:raw===canonical}));
 assert.ok(counts.preflight+counts.junction<=limit+1,JSON.stringify(counts));
});
import {readFileSync} from 'node:fs';
import {characterize,characterizationCases} from './helpers/geometry-commit-characterization.mjs';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/1099-commit-characterization.json',import.meta.url),'utf8')).results;
for(const name of characterizationCases)test('#1099 unchanged byte result and refusal: '+name,()=>{
 assert.equal(JSON.stringify(characterize(name)),JSON.stringify(baseline[name]),name);
});
test('#1099 one baseline per space, repeated equivalent documents hit and cache stays bounded',()=>{
 const h=harness(),original=structuredClone(h.host._serverCfg);let first;
 for(let n=0;n<50;n++){
  h.host._serverCfg=structuredClone(original);const before=h.runtime._geometrySnapshot('f');scenarios.thickness(h.host._serverCfg.spaces[0]);
  const previous=h.counts.junction;assert.equal(h.runtime._commitPhysicalGeometry('thickness',before),true);
  if(n===0){first=h.counts.junction;assert.equal(first,1);}else assert.equal(h.counts.junction,previous);
  assert.ok(h.runtime._junctionBaselineCache.size<=original.spaces.length);
 }
});
test('#1099 failures remain closed for candidate/preflight but unprovable baseline is open',()=>{
 for(const where of ['preflight','candidate','baseline']){
  const h=harness();const before=h.runtime._geometrySnapshot('f');scenarios.thickness(h.host._serverCfg.spaces[0]);
  if(where==='preflight')h.host._checkSpacePhysicalGeometry=()=>{throw Error('injected check failure');};
  else {const invoke=h.host._junctionLimitViolations;let calls=0;h.host._junctionLimitViolations=(...args)=>{calls++;if((where==='candidate'&&calls===2)||(where==='baseline'&&calls===1))throw Error('injected junction failure');return invoke(...args);};}
  assert.equal(h.runtime._commitPhysicalGeometry(where,before),where==='baseline');
 }
});
test('#1099 resize preview proof reuses only the exact still-successful candidate',()=>{
 const h=harness(),before=h.runtime._geometrySnapshot('f');scenarios.thickness(h.host._serverCfg.spaces[0]);
 assert.equal(h.runtime._rszSpaceCandidateRenderable('f',h.host._serverCfg.spaces[0]),true);
 const builds=h.counts.preflight;assert.equal(h.runtime._commitPhysicalGeometry('resize',before),true);assert.equal(h.counts.preflight,builds);
 const h2=harness(),before2=h2.runtime._geometrySnapshot('f');scenarios.thickness(h2.host._serverCfg.spaces[0]);
 assert.equal(h2.runtime._rszSpaceCandidateRenderable('f',h2.host._serverCfg.spaces[0]),true);
 h2.host._serverCfg.spaces[0].wall_columns=[{id:'c',shape:'square',center:[1,1],cm:20,angle:0}];
 const count=h2.counts.preflight;assert.equal(h2.runtime._commitPhysicalGeometry('resize',before2),true);assert.ok(h2.counts.preflight>count);
});
test('#1099 current commit does not visit unrelated spaces or markers during approval/adoption',()=>{
 const h=harness();h.host._serverCfg.markers=[{id:'m',room_id:'f-r',vacuum:{segment_map:{one:'f-r'}}}];
 const before=h.runtime._geometrySnapshot('f');before.roomReferences=[{markerId:'m',roomIdPresent:true,roomId:'old',vacuumPresent:true,segmentMapPresent:true,segmentMap:{one:'old'}}];
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const markers=h.host._serverCfg.markers;freeze(markers);
 const other=h.host._serverCfg.spaces.slice(1);other.forEach(freeze);
 scenarios.thickness(h.host._serverCfg.spaces[0]);
 assert.equal(h.runtime._commitPhysicalGeometry('frozen',before),true);
 assert.equal(h.host._serverCfg.markers,markers);other.forEach((sp,i)=>assert.equal(h.host._serverCfg.spaces[i+1],sp));
});
const largeEqualityKinds = new Set();
for(const [name,change] of Object.entries(largeScenarios))test('#1099 146-room large-house counter contract: '+name,()=>{
 const h=harness(largeFixture()), before=h.runtime._geometrySnapshot('f'),other=h.host._serverCfg.spaces.slice(1);change(h.host._serverCfg.spaces[0]);
 const raw=spacePhysicalGeometryFingerprint(h.host._serverCfg.spaces[0]);
 const canonical=spacePhysicalGeometryFingerprint(commitWallSegmentModel(h.host._serverCfg).config.spaces[0]);
 largeEqualityKinds.add(raw === canonical);
 assert.equal(h.runtime._commitPhysicalGeometry(name,before),true,JSON.stringify(h.toasts));
 assert.equal(h.counts.preflight,raw===canonical?1:2,JSON.stringify({counts:h.counts,equal:raw===canonical}));
 assert.equal(h.counts.junction,1,'baseline only; candidate consumes successful preflight geometry');
 other.forEach((sp,i)=>assert.equal(h.host._serverCfg.spaces[i+1],sp));
});
test('#1099 baseline content and revision changes both retire the per-space slot',()=>{
 const h=harness(),previous=structuredClone(h.host._serverCfg);h.runtime._junctionLimitsIntroduced(structuredClone(previous),previous,'f');
 let calls=h.counts.junction;
 previous.spaces[0].wall_columns=[{id:'new-baseline-body',shape:'square',center:[1,1],cm:20,angle:0}];
 h.runtime._junctionLimitsIntroduced(structuredClone(previous),previous,'f');assert.equal(h.counts.junction,calls+2);
 calls=h.counts.junction;h.host._cfgRev=2;
 h.runtime._junctionLimitsIntroduced(structuredClone(previous),previous,'f');assert.equal(h.counts.junction,calls+2);
});
for(const name of characterizationCases.filter(name=>name.startsWith('marker-')))test('#1099 frozen markers during every approval/migration construction: '+name,()=>{
 assert.equal(JSON.stringify(characterize(name,{freezeGuards:true})),JSON.stringify(baseline[name]));
});
test('#1099 the large-house corpus actually exercises equal and changed candidate fingerprints',()=>{
 assert.deepEqual([...largeEqualityKinds].sort(),[false,true]);
});
test('#1099 a failed preview is never reused as a successful commit proof',()=>{
 const h=harness(),before=h.runtime._geometrySnapshot('f');scenarios.thickness(h.host._serverCfg.spaces[0]);
 const strict=h.host._checkSpacePhysicalGeometry;h.host._checkSpacePhysicalGeometry=()=>({ok:false});
 assert.equal(h.runtime._rszSpaceCandidateRenderable('f',h.host._serverCfg.spaces[0]),false);
 h.host._checkSpacePhysicalGeometry=strict;
 assert.equal(h.runtime._commitPhysicalGeometry('fresh-check',before),true);assert.ok(h.counts.preflight>0);
});