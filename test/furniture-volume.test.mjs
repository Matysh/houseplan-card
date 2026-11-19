import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {parseVolumeSvg,generateVolume} from '../scripts/generate-furniture-volume.mjs';
import {FurnitureVolumeRuntime,FURNITURE_VOLUME_RUNTIME} from '../test-build/furniture-volume-runtime.js';
import {furnitureMesh,furnitureParts} from '../test-build/iso-lab-furniture.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const pack=JSON.parse(read('assets/furniture/houseplan-0.4.1/pack.json'));
const source=read('assets/furniture/houseplan-0.4.1/svg/volume/sofa.svg'),sofa=pack.symbols.find(s=>s.id==='sofa');
await FURNITURE_VOLUME_RUNTIME.ensure();
test('Annotated SVG registry reproduces 96 accepted meshes exactly, including mirrors and stretched footprints',()=>{
 const cases=JSON.parse(read('test/fixtures/furniture-volume/accepted-meshes.json'));assert.equal(cases.length,96);
 for(const c of cases){
  const before=structuredClone(c.shape),mesh=furnitureMesh(c.shape,1000,800,c.camera);
  const {parts,shadow,lightBox}=mesh;
  const geometry={parts:parts.map(({lightPoint,...geometry})=>{
   assert.equal(lightPoint.length,2);
   assert.ok(lightPoint.every(Number.isFinite));
   return geometry;
  }),shadow};
  assert.ok(lightBox.every(Number.isFinite) && lightBox[2]>0 && lightBox[3]>0);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),c.sha256,JSON.stringify(c.shape));
  assert.deepEqual(c.shape,before);
 }
});
test('Every catalog ID keeps a valid flat drawing and has authored SVG volume metadata',()=>{
 const ready=pack.symbols.filter(s=>furnitureParts(s.id)).map(s=>s.id).sort();
 assert.equal(pack.symbols.length,60);assert.deepEqual(ready,pack.symbols.map(s=>s.id).sort());
 for(const s of pack.symbols)assert.match(read('assets/furniture/houseplan-0.4.1/'+s.file),/<path /);
 assert.equal(furnitureParts('unknown_future'),null);assert.equal(furnitureParts('cactus'),furnitureParts('exercise'));
});
test('Volume schema rejects active XML, unknown attributes, open/unsupported geometry and inconsistent heights',()=>{
 const mutations=[
  s=>s.replace('<rect','<script>alert(1)</script><rect'),
  s=>s.replace('<rect','<rect onclick="evil()"'),
  s=>s.replace('data-hp-volume-schema="1"','data-hp-volume-schema="99"'),
  s=>s.replace('data-hp-model="sofa"','data-hp-model="bed_double"'),
  s=>s.replace('data-hp-z-min-cm="0"','data-hp-z-min-cm="-1"'),
  s=>s.replace('data-hp-z-max-cm="13"','data-hp-z-max-cm="0"'),
  s=>s.replace('data-hp-part="leg-1"','data-hp-part="leg-0"'),
  s=>s.replace('width="8.1"','width="999"'),
  s=>s.replace('<rect','<path'),
  s=>s.replace('rx="1.35"','rx="17"'),
  s=>s.replace('xmlns=','evil="&entity;" xmlns='),
  s=>s.replace('data-hp-back="top"','data-hp-back="bottom"'),
 ];
 for(const mutate of mutations){const invalid=mutate(source);assert.notEqual(invalid,source);assert.throws(()=>parseVolumeSvg(invalid,sofa),/Furniture volume/);}
 assert.equal(parseVolumeSvg(source,sofa).length,11);
});
test('Lazy volume load is shared, notifies connected hosts once and preserves flat fallback on mismatch/failure',async()=>{
 let count=0,resolve,updates=0;
 const module={FURNITURE_VOLUME_FINGERPRINT:'a',FURNITURE_VOLUME_MODELS:{sofa:parseVolumeSvg(source,sofa)}};
 const runtime=new FurnitureVolumeRuntime('a',()=>{count++;return new Promise(r=>{resolve=r;});},()=>{});
 assert.equal(runtime.parts('sofa'),null);assert.equal(count,0);
 const host={isConnected:true,requestUpdate(){updates++;}};
 const first=runtime.ensure(host),second=runtime.ensure(host);assert.equal(first,second);assert.equal(count,1);
 resolve(module);await first;assert.equal(updates,1);assert.equal(runtime.state(),'ready');assert.equal(runtime.parts('sofa').length,11);
 await runtime.ensure(host);assert.equal(updates,1);
 const mismatch=new FurnitureVolumeRuntime('b',async()=>module,()=>{});await mismatch.ensure();assert.equal(mismatch.state(),'fallback');assert.equal(mismatch.parts('sofa'),null);
 const offline=new FurnitureVolumeRuntime('a',async()=>{throw Error('offline');},()=>{});await offline.ensure();assert.equal(offline.state(),'fallback');assert.equal(offline.parts('sofa'),null);
});

test('Volume runtime safely settles synchronous and malformed loads and never resolves inherited model names',async()=>{
 const model={FURNITURE_VOLUME_FINGERPRINT:'a',FURNITURE_VOLUME_MODELS:{sofa:parseVolumeSvg(source,sofa)}};
 const ready=new FurnitureVolumeRuntime('a',async()=>model,()=>{});await ready.ensure();
 for(const name of ['constructor','toString','__proto__'])assert.equal(ready.parts(name),null);
 for(const load of [()=>{throw Error('sync offline');},async()=>({FURNITURE_VOLUME_FINGERPRINT:'a'}),
   async()=>({...model,FURNITURE_VOLUME_MODELS:{}}),async()=>({...model,FURNITURE_VOLUME_MODELS:{sofa:[]}}),
   async()=>({...model,FURNITURE_VOLUME_MODELS:{sofa:[{...model.FURNITURE_VOLUME_MODELS.sofa[0],top:NaN}]}})]){
  let calls=0,updates=0,disconnected=0;
  const runtime=new FurnitureVolumeRuntime('a',()=>{calls++;return load();},()=>{throw Error('logger unavailable');});
  const host={isConnected:true,requestUpdate(){updates++;}};
  const first=runtime.ensure(host);
  await runtime.ensure({isConnected:false,requestUpdate(){disconnected++;}});
  await first;
  assert.equal(runtime.state(),'fallback');assert.equal(runtime.parts('sofa'),null);
  assert.equal(updates,1);assert.equal(disconnected,0);
  await runtime.ensure(host);assert.equal(calls,1);assert.equal(updates,1);
 }
});
