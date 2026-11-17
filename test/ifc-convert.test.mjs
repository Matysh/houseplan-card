import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ifcFixture } from './helpers/ifc-fixture.mjs';
import { convertIfc, readIfc } from '../scripts/sh3d-convert/ifc.mjs';
import { IfcReader, validateIfcBytes } from '../scripts/sh3d-convert/ifc-read.mjs';
import { transform } from '../scripts/sh3d-convert/ifc-math.mjs';
import { MAX_IFC_BYTES } from '../scripts/sh3d-convert/ifc-errors.mjs';
import { alignIfcRoom, joinIfcAxes } from '../scripts/sh3d-convert/ifc-geometry.mjs';
import { CURRENT_MODEL_VERSION } from '../scripts/sh3d-convert/output.mjs';

const options = { now: '1970-01-01T00:00:00Z', toolVersion:'plan-convert 0.2' };
const space = result => result.documents[0].payload.config.spaces[0];
const near = (a,b,epsilon=.001) => assert.ok(Math.abs(a-b)<=epsilon, `${a} != ${b}`);

test('#1458 synthetic rooms, T/X junctions, walls and void/fill hosts survive', async () => {
  const result = await convertIfc(ifcFixture({ junctions:true }), options), s = space(result);
  assert.equal(result.documents[0].model_version, CURRENT_MODEL_VERSION);
  assert.deepEqual(result.documents[0].transfer,{plan_only:true});
  assert.equal(s.rooms.length,2); assert.equal(s.openings.length,2);
  assert.ok(s.partitions.length>=4);
  const cmUnit=s.cell_cm*240;
  const west=s.rooms.find(r=>r.name==='West'),east=s.rooms.find(r=>r.name==='East');
  near((Math.max(...west.poly.map(p=>p[0]))-Math.min(...west.poly.map(p=>p[0])))*cmUnit/100,4);
  near(Math.max(...west.poly.map(p=>p[0])),Math.min(...east.poly.map(p=>p[0])),1e-9);
  const all=[...s.wall_segments,...s.partitions];
  for(const opening of s.openings) {
    assert.ok(all.some(w=>w.id===opening.host.id));
    near(opening.length*cmUnit/100,opening.type==='door'?.9:1.2);
  }
  assert.equal(result.report.entities.filter(e=>e.outcome==='skipped').length,0);
  assert.equal(result.report.sourceCounts.floor,1);
  assert.equal(result.report.outcomes.partial.door,1);
  assert.equal(result.report.outcomes.partial.floor,1);
});

for(const units of ['m','mm','feet']) test(`#1458 physical scale and nested rotated placement: ${units}`,async()=>{
  const m=await readIfc(ifcFixture({units,rotation:30,translation:[1000,-400,0],referenceOffset:true}));
  near(m.metresPerUnit,units==='mm'?.001:units==='feet'?.3048:1,1e-10);
  const w=m.entities.find(e=>e.kind==='wall').walls[0];
  near(Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),8);
  near(w.a[0],1000);near(w.a[1],-400);
  const offset=m.entities.filter(e=>e.kind==='wall').at(-1).walls[0];
  near(offset.a[0],1000+12*Math.cos(Math.PI/6)-.3085*Math.sin(Math.PI/6));
  near(offset.a[1],-400+12*Math.sin(Math.PI/6)+.3085*Math.cos(Math.PI/6));
  near(offset.cm,20);
  const r=await convertIfc(ifcFixture({units,rotation:30,translation:[1000,-400,0]}),options);
  assert.equal(space(r).rooms.length,2);assert.equal(space(r).openings.length,2);
});

test('#1458 choosing a floor preserves the building frame and document identity',async()=>{
  const bytes=ifcFixture({twoFloors:true,floorOffset:true});
  const all=await convertIfc(bytes,options),id=all.report.levels[1].id;
  const selected=await convertIfc(bytes,{...options,floorIds:[id]});
  assert.equal(selected.documents.length,1);assert.deepEqual(selected.documents[0],all.documents[1]);
  assert.equal(all.report.levels[0].cellCm,all.report.levels[1].cellCm);
});

test('#1458 low walls stay on their own storey, spanning walls reach actual additional levels',async()=>{
  const low=await convertIfc(ifcFixture({twoFloors:true,wallHeight:.5,noOpenings:true}),options);
  assert.equal(low.documents.length,2);assert.equal(low.report.outcomes.skipped.wall,0);
  const tall=await convertIfc(ifcFixture({twoFloors:true,wallHeight:6,noOpenings:true}),options);
  const lower=tall.report.entities.find(e=>e.kind==='wall'&&e.floorId===tall.report.levels[0].id);
  assert.equal(lower.results.length,2,'measured height permits membership in the upper storey');
  assert.equal(tall.documents.length,2);
});

test('#1458 no IfcSpace leaves independent editable walls, no invented room',async()=>{
  const r=await convertIfc(ifcFixture({noRooms:true}),options);
  assert.equal(space(r).rooms.length,0);assert.ok(space(r).partitions.length>=5);
});

test('#1458 an entirely unsupported storey still produces an actionable report, never empty JSON',async()=>{
  const r=await convertIfc(ifcFixture({noRooms:true,noOpenings:true,wallThickness:1.2}),options);
  assert.deepEqual(r.documents,[]);assert.equal(r.report.outcomes.skipped.wall,5);
  assert.equal(r.report.levels[0].notes.filter(n=>n.code==='ifc_thickness_unsupported').length,5);
});

test('#1458 mapped origins/rotation are composed once, including void geometry',async()=>{
  const plain=space(await convertIfc(ifcFixture(),options));
  const mapped=space(await convertIfc(ifcFixture({mapped:true}),options));
  assert.deepEqual(mapped.rooms.map(r=>r.poly),plain.rooms.map(r=>r.poly));
  assert.deepEqual(mapped.openings.map(o=>[o.x,o.y,o.length,o.angle]),plain.openings.map(o=>[o.x,o.y,o.length,o.angle]));
  const reader=new IfcReader(null,null);reader.get=x=>x;
  const matrix=reader.operator({Axis1:{DirectionRatios:[-1,0,0]},Axis2:{DirectionRatios:[0,1,0]},Axis3:{DirectionRatios:[0,0,1]},LocalOrigin:{Coordinates:[5,6,7]},Scale:1});
  assert.deepEqual(transform(matrix,[1,2,3]),[4,8,10],'left-handed mapped coordinates retain the reflection');
});

test('#1458 repeated GUIDs do not merge rooms and are reported before download',async()=>{
  let source=new TextDecoder().decode(ifcFixture());
  const guids=[...source.matchAll(/IFCSPACE\('([^']+)'/g)].map(m=>m[1]);
  source=source.replace(guids[1],guids[0]);
  const result=await convertIfc(new TextEncoder().encode(source),options);
  assert.equal(space(result).rooms.length,2);assert.equal(new Set(space(result).rooms.map(r=>r.id)).size,2);
  assert.equal(result.report.outcomes.partial.room,2);
  assert.equal(result.report.levels[0].notes.filter(n=>n.code==='ifc_duplicate_guid').length,2);
});

test('#1458 source polyline walls retain openings on their actual segment',async()=>{
  const result=await convertIfc(ifcFixture({axisSplit:true,noWallBody:true,junctions:true}),options);
  assert.equal(space(result).openings.length,2);
  assert.equal(result.report.outcomes.skipped.door,0);
  assert.equal(result.report.outcomes.skipped.window,0);
});

test('#1458 indexed straight curves and coalesced source-host lineage remain usable',async()=>{
  const indexed=await convertIfc(ifcFixture({indexed:true}),options);
  assert.equal(space(indexed).rooms.length,2);assert.equal(space(indexed).openings.length,2);
  const duplicate=await convertIfc(ifcFixture({duplicateHost:true}),options);
  assert.equal(duplicate.report.sourceCounts.wall,6);assert.equal(space(duplicate).openings.length,2);
  assert.equal(duplicate.report.outcomes.skipped.door,0,'coalescing a physical wall does not lose its source door');
});

test('#1458 schema labels in comments are not the actual FILE_SCHEMA',async()=>{
  const source=new TextDecoder().decode(ifcFixture()).replace('HEADER;','HEADER; /* FILE_SCHEMA((\'IFC4X3\')); */');
  assert.equal(validateIfcBytes(new TextEncoder().encode(source)),'IFC4');
  assert.equal(space(await convertIfc(new TextEncoder().encode(source))).rooms.length,2);
});

test('#1458 reader rejects wrong schema, file and units before providing output',async()=>{
  assert.throws(()=>validateIfcBytes(new TextEncoder().encode('{}')),{code:'ifc_invalid_file'});
  const text=new TextDecoder().decode(ifcFixture());
  assert.throws(()=>validateIfcBytes(new TextEncoder().encode(text.replace("FILE_SCHEMA(('IFC4'))","FILE_SCHEMA(('IFC4X3'))"))),{code:'ifc_schema_unsupported'});
  await assert.rejects(convertIfc(new TextEncoder().encode(text.replace('.METRE.','.SECOND.'))),{code:'ifc_units_invalid'});
  await assert.rejects(convertIfc(new TextEncoder().encode(text.replace('END-ISO-10303-21;',''))),{code:'ifc_invalid_file'});
});

test('#1458 IFC byte boundary is inclusive; it does not promise memory for every project',()=>{
  const file=ifcFixture(),tail=new TextEncoder().encode('END-ISO-10303-21;\n');
  const exact=new Uint8Array(MAX_IFC_BYTES);exact.fill(32);exact.set(file.subarray(0,file.length-tail.length));exact.set(tail,exact.length-tail.length);
  assert.equal(validateIfcBytes(exact),'IFC4');
  assert.throws(()=>validateIfcBytes(new Uint8Array(MAX_IFC_BYTES+1)),{code:'ifc_file_too_large'});
});

test('#1458 placement cycles cannot become a partially successful result',async()=>{
  let source=new TextDecoder().decode(ifcFixture());
  source=source.replace(/#(\d+)=IFCLOCALPLACEMENT\(\$,([^;]+)\);/,(_,id,position)=>`#${id}=IFCLOCALPLACEMENT(#${id},${position});`);
  await assert.rejects(convertIfc(new TextEncoder().encode(source)),{code:'ifc_placement_cycle'});
});

test('#1458 real footprint joins are reconciled, a physical 2 cm gap is not snapped',()=>{
  const a={a:[0,0],b:[4,0],cm:20},touch={a:[4.1,0],b:[4.1,3],cm:20};
  const joined=joinIfcAxes([a,touch]);near(joined[0].b[0],4.1);
  const gap={...touch,a:[4.12,0],b:[4.12,3]};
  assert.deepEqual(joinIfcAxes([a,gap])[0],a);
  assert.deepEqual(a.b,[4,0]);
});

test('#1458 open boundaries are not physical walls; unsupported wall extents block the room',()=>{
  const poly=[[0,0],[4,0],[4,4],[0,4]];
  const open=alignIfcRoom(poly,[]);assert.equal(open.walls.filter(w=>w.cm!==0).length,0);
  assert.throws(()=>alignIfcRoom(poly,[],[{envelope:null}]),{code:'ifc_room_boundary'});
  assert.throws(()=>alignIfcRoom([[0,0],[4,4],[0,4],[4,0]],[]),{code:'ifc_room_invalid'});
});

test('#1458 the original, decoded worker and vendor have no transport calls',()=>{
  const root=new URL('../scripts/sh3d-convert/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('vendor/ifc/vendor-index.json',root)));
  const engine=readFileSync(new URL('vendor/ifc/engine.mjs',root),'utf8');
  assert.equal(createHash('sha256').update(engine).digest('hex'),manifest.artifactSha256);
  for(const source of [engine,readFileSync(new URL('page/ifc-worker.generated.mjs',root),'utf8')])
    for(const pattern of [/\bfetch\s*\(/,/new\s+XMLHttpRequest/,/new\s+WebSocket/,/\bimportScripts\s*\(/,/\.sendBeacon\s*\(/])assert.doesNotMatch(source,pattern);
});
