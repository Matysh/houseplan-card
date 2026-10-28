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
for(const name of ['transform','stairs'])test('#1100 '+name+' Undo avoids model visits and physical cache clearing',()=>{
 const h=historyHarness(historyFixture({stairsCase:name==='stairs'}));h.command(name,historyChanges[name]);for(const id of ['a','b','c'])h.warm(id);h.host._space='a';
 let modelReads=0;Object.defineProperty(h.host._serverCfg.spaces[0],'model_read_witness',{enumerable:true,configurable:true,get(){modelReads++;return 'ordinary-input';}});
 const keys=[...h.host._wallUnionPool.keys()];assert.equal(h.runtime._stepGeometryHistory('undo'),true);
 assert.equal(modelReads,0,'unknown raw-space getter is visited by canonical model/adoption, never by the snapshot/physical key');
 assert.equal(h.counts.preflight,0);assert.equal(h.counts.union,0);assert.deepEqual([...h.host._wallUnionPool.keys()],keys);
});
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {historyCharacterization,historyCases} from './helpers/geometry-history-characterization.mjs';
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