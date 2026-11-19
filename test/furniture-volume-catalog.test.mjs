import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseVolumeSvg} from '../scripts/generate-furniture-volume.mjs';
import {furnitureParts,furnitureMesh,furnitureVolume,furnitureVolumeFaces} from '../test-build/iso-lab-furniture.js';
import {FURNITURE_VOLUME_RUNTIME} from '../test-build/furniture-volume-runtime.js';
import {projectPlanPoint} from '../test-build/iso-projection.js';
import {furnitureOcclusion} from '../test-build/iso-lab-visibility.js';
await FURNITURE_VOLUME_RUNTIME.ensure();
const pack=JSON.parse(fs.readFileSync(new URL('../assets/furniture/houseplan-0.4.1/pack.json',import.meta.url)));
const camera={rotDeg:35,tiltDeg:50,xyScale:1,zScale:1,origin:[0,0],floorScaleY:Math.sin(40*Math.PI/180)};
const area=points=>points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;

test('A wall directly behind every catalog footprint reveals the body; a wall in front masks it',()=>{
  for (const rotDeg of [35,125,215,305]) {
    const view={...camera,rotDeg};
    const forward=Math.sign(Math.cos(rotDeg*Math.PI/180));
    function wall(y) {
      const height=105;
      const points=[[-1500,0],[1500,0],[1500,height],[-1500,height]]
        .map(([x,z])=>projectPlanPoint([x,y],z,view));
      return [{layer:'wall-side',face:{points,height}}];
    }
    for (const symbol of pack.symbols) {
      const shape={symbol:symbol.id,x:.25,y:.40,w:symbol.width_cm/1000,h:symbol.depth_cm/1000};
      const mesh=furnitureVolume(shape,1000,1000,view);
      const mid=(shape.y+shape.h/2)*1000, offset=forward*(shape.h*500+4);
      assert.equal(furnitureOcclusion(wall(mid-offset),view,mesh.footprint,mesh.height).clip,null,symbol.id+' rear '+rotDeg);
      assert.ok(furnitureOcclusion(wall(mid+offset),view,mesh.footprint,mesh.height).clip !== null,symbol.id+' front '+rotDeg);
    }
  }
});

test('All 60 models survive camera turns, both mirrors and nonuniform sizing without mutating decor',()=>{
 for(const s of pack.symbols)for(const yaw of [35,125,215,305])for(const flip_h of [false,true])for(const flip_v of [false,true])for(const aspect of [1,1.6]){
  const shape={symbol:s.id,x:.13,y:.24,w:s.width_cm/1000*aspect,h:s.depth_cm/1000/Math.sqrt(aspect),angle:23,flip_h,flip_v};
  const original=structuredClone(shape),mesh=furnitureMesh(shape,1000,1000,{...camera,rotDeg:yaw});
  assert.ok(mesh,s.id);assert.equal(mesh.parts.length,furnitureParts(s.id).length,s.id);
  for(const p of mesh.parts){assert.ok((p.top+p.side).length>10,s.id+'/'+p.name);assert.doesNotMatch(p.top+p.side,/NaN|Infinity/);assert.ok(Number.isFinite(p.depth));}
  assert.deepEqual(shape,original);
 }
});
test('Hollow basins and the corner bath contain oppositely wound openings with real inner walls',()=>{
 for(const [symbol,part] of [['bathtub','bath-bowl'],['bathtub_corner','bath-shell'],['sink','basin-bowl'],['toilet','bowl-bowl'],['kitchen_sink_double','left-bowl-bowl']]){
  const p=furnitureParts(symbol).find(p=>p.name===part);assert.ok(p,symbol);
  const faces=furnitureVolumeFaces(p,170,100,.6),top=faces[0];
  assert.equal(top.loops.length,2);assert.ok(area(top.loops[0])*area(top.loops[1])<0,symbol);
  assert.ok(Math.abs(area(top.loops[0]))>Math.abs(area(top.loops[1])));
  assert.ok(faces.some(f=>!f.cap&&f.ring===1),symbol+' has inner side faces');
 }
});
test('Vertical appliance portholes keep their height extent and bounded depth, while hood tapers upward',()=>{
 const p=furnitureParts('washer').find(p=>p.name==='porthole-frame');
 const faces=furnitureVolumeFaces(p,60,60,.6),v=faces.flatMap(f=>f.loops.flat());
 assert.equal(Math.min(...v.map(p=>p[2])),21);assert.equal(Math.max(...v.map(p=>p[2])),61);
 assert.ok(v.every(([x,y])=>x>=p.x-1e-8&&x<=p.x+p.w+1e-8&&y>=p.y-1e-8&&y<=p.y+p.h+1e-8));
 const hood=furnitureParts('hood').find(p=>p.name==='tapered-canopy'),h=furnitureVolumeFaces(hood,60,50,.6);
 assert.ok(Math.abs(area(h[0].loops[0]))<Math.abs(area(h[1].loops[0]))*.2);
});
test('Families preserve meaningful levels instead of extruding all furniture as one plate',()=>{
 const part=(id,name)=>furnitureParts(id).find(p=>p.name===name);
 assert.ok(part('chair_bar','seat').top>part('chair','seat').top);
 assert.ok(part('table_round','tabletop').top>part('coffee_table_round','tabletop').top);
 assert.ok(part('sofa_three_seat','seat-0').top<part('sofa_three_seat','arm-left').top);
 assert.ok(part('shelf_wall','shelf-board').bottom>=100);
 assert.ok(part('kitchen_wall','wall-cabinet-base').bottom>=140);
 assert.ok(part('rug','bound-edge').top<2);
 assert.equal(furnitureParts('stairs').length,13);
 assert.equal(new Set(furnitureParts('stairs').map(p=>p.top)).size,13);
 assert.equal(part('desk_corner','tabletop').profile,'polygon');
 assert.ok(furnitureParts('shelf_floor').filter(p=>p.name.startsWith('shelf-')).length>=4);
});
test('Curved side bands are continuous instead of stroking every sampling segment',()=>{
 for(const id of ['table_round','water_heater']){
  const m=furnitureMesh({symbol:id,x:0,y:0,w:.2,h:.2},1000,1000,camera);
  const p=m.parts.find(p=>p.name===(id==='table_round'?'tabletop':'tank'));
  assert.ok((p.side.match(/M/g)||[]).length<=2);
 }
});
test('Office back has a full vertical face and bar stool follows the round seat and curved back',()=>{
 const office=furnitureParts('armchair_office').find(p=>p.name==='backrest');
 assert.equal(office.plane,'xz');
 const face=furnitureVolumeFaces(office,65,65,.6)[0].loops[0];
 assert.equal(Math.max(...face.map(v=>v[2]))-Math.min(...face.map(v=>v[2])),50);
 assert.ok(Math.abs(area(face.map(([x,,z])=>[x,z])))>20);
 const bar=furnitureParts('chair_bar');
 assert.equal(bar.find(p=>p.name==='seat').profile,'ellipse');
 const back=bar.find(p=>p.name==='backrest');
 assert.equal(back.profile,'polygon');assert.ok(back.points.length>16);
 assert.ok(back.points.some(([x,y])=>x>.45&&x<.55&&y<.01));
 assert.ok(back.points.some(([x,y])=>x>.45&&x<.55&&y>.15));
 for(const id of ['coffee_table_round','table_round'])assert.equal(furnitureParts(id).filter(p=>p.name.startsWith('leg-')).length,4);
});
test('Schema 2 rejects crossing contours, holes outside the outline, unsupported axes and oversized taper',()=>{
 const s={id:'probe',width_cm:100,depth_cm:100};
 const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hp-volume-schema="2" data-hp-model="probe" data-hp-back="top">${body}</svg>`;
 const base='data-hp-part="body" data-hp-z-min-cm="0" data-hp-z-max-cm="50"';
 const valid=`<polygon ${base} points="1,1 99,1 99,99 1,99" data-hp-hole-points="20,20 80,20 80,80 20,80" />`;
 assert.equal(parseVolumeSvg(wrap(valid),s)[0].hole.length,4);
 for(const invalid of [
  valid.replace('1,1 99,1 99,99 1,99','1,1 99,99 99,1 1,99'),
  valid.replace('20,20 80,20 80,80 20,80','0,0 80,20 80,80 20,80'),
  valid.replace('/>','data-hp-plane="xz" />'),
  `<ellipse ${base} cx="50" cy="50" rx="45" ry="45" data-hp-inset-cm="46" />`,
  `<ellipse ${base} cx="50" cy="50" rx="45" ry="45" data-hp-plane="yx" />`,
  `<ellipse ${base} cx="50" cy="50" rx="45" ry="45" data-hp-top-scale="0.5" data-hp-top-offset="0.4,0" />`,
  `<ellipse ${base} cx="50" cy="50" rx="45" ry="45" data-hp-base-scale="0" />`,
 ])assert.throws(()=>parseVolumeSvg(wrap(invalid),s),/Furniture volume/);
});
