import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {commitWallSegmentModel,decodeLegacyWallSegmentModel} from '../test-build/wall-segment-model.js';
import {canonicalizeConfigGeometry,canonicalizeLayoutGeometry} from '../test-build/coordinate-canonicalization.js';

const originalBytes=readFileSync(new URL('./fixtures/optimize-storage-roundtrip.json',import.meta.url));
const original=JSON.parse(originalBytes);
const current=JSON.parse(readFileSync(new URL('./fixtures/optimize-storage-roundtrip-current.json',import.meta.url)));

test('#248 original canonical reader and current exact migration verify reviewed cross-runtime targets',()=>{
 assert.equal(createHash('sha256').update(originalBytes).digest('hex'),current.provenance.source_sha256);
 const before=structuredClone(original.input);
 assert.deepEqual(decodeLegacyWallSegmentModel(canonicalizeConfigGeometry(original.input.config)).config,original.expected.config);
 const actual=commitWallSegmentModel(original.input.config).config;
 assert.deepEqual(actual,current.expected.config);
 const latticeTargets={fine:[['l','1','0'],['l','1','2'],['l','2','0'],['l','2','2']],
  regular:[['l','24','24'],['l','24','48'],['l','48','24'],['l','48','48']]};
 for(const space of actual.spaces) assert.deepEqual(space.plan_graph.nodes.map(n=>n.p).sort(),latticeTargets[space.id],
  '#1282 migration arithmetic echoes restore the declared lattice, independently of the shared fixture');
 assert.deepEqual(canonicalizeLayoutGeometry(original.input.layout),current.expected.layout);
 assert.deepEqual(original.input,before,'neither facade may mutate the original full source');
 for(const space of actual.spaces){
  const source=original.input.config.spaces.find(row=>row.id===space.id);
  const radius=Math.min(1/1200000,.1/(240*source.cell_cm));
  assert.equal(space.rooms.length,source.rooms.length);
  const boundary=[];
  for(const room of space.rooms){
   const prior=source.rooms.find(row=>row.id===room.id);assert.ok(prior);
   const {poly,wall_ids,...metadata}=room,{poly:raw,wall_ids:oldIds,...oldMetadata}=prior;
   assert.deepEqual(metadata,oldMetadata);assert.equal(poly.length,raw.length);
   for(let i=0;i<poly.length;i++){
    assert.ok(Math.hypot(poly[i][0]-raw[i][0],poly[i][1]-raw[i][1])<=radius,'each ORIGINAL endpoint stays within R');
    boundary.push([poly[i],poly[(i+1)%poly.length]]);
   }
  }
  const pair=([a,b])=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
  assert.deepEqual(space.wall_segments.map(edge=>pair([edge.a,edge.b])).sort(),boundary.map(pair).sort(),'every boundary interval remains covered');
  assert.ok(space.wall_segments.every(edge=>edge.cm===0));
 }
 // Original Optimize/no-op tests remain separate: this import/facade witness
 // deliberately cannot be used as an automatically generated Optimize oracle.
});

test('#1282 migration still preserves genuine off-grid source coordinates beyond arithmetic noise',()=>{
 const source={model_version:10,markers:[],settings:{},spaces:[{id:'offgrid',rooms:[],partitions:[
  {id:'p',a:[.22501,.39585],b:[.723456789,.564738291],cm:15}]}]};
 const frozen=structuredClone(source),actual=commitWallSegmentModel(source).config.spaces[0];
 assert.deepEqual(actual.partitions[0].a,[.22501,.39585]);
 assert.deepEqual(actual.partitions[0].b,[.723456789,.564738291]);
 assert.deepEqual(actual.plan_graph.nodes.map(n=>n.p).sort(),[
  ['q','22501','100000','7917','20000'],['q','723456789','1000000000','564738291','1000000000']]);
 assert.deepEqual(source,frozen);
});
