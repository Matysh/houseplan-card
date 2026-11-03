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
