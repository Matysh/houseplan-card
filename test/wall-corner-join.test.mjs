import test from 'node:test';
import assert from 'node:assert/strict';
import { difference } from 'polyclip-ts';
import { physicalBodyParts, geometryArea, pointInPhysicalBody, cutPartitionBody } from '../test-build/physical-geometry.js';
import { wallBodiesGeometry, linearWallJoinPatches, wallCmToUnits } from '../test-build/wall-thickness.js';
import { hasPaintableRingArea } from '../test-build/polygon-paint.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';
import { checkSpacePhysicalGeometry } from '../test-build/plan-geometry-preflight.js';
import { buildPdfPage } from '../test-build/pdf/pdf-scene.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';
import { wallCornerJoinSpace } from '../demo/fixtures/wall-corner-join.mjs';

const configOf=space=>({model_version:10,spaces:[space],markers:[],settings:{}});
const geom=bodies=>wallBodiesGeometry([],[],[],[],GRID_STEP_N,1,GRID_PITCH,NORM_W,bodies);
const segments=(space,cell)=>space.partitions.map(p=>({a:p.a,b:p.b,halfDepth:wallCmToUnits(p.cm,cell,GRID_PITCH)/2}));
const legacyParts=(space,cell,cuts=[])=>{
 const parts=physicalBodyParts(space,cell,GRID_PITCH,GRID_PITCH*.0002,cuts);
 const patches=linearWallJoinPatches(segments(space,cell),GRID_PITCH*.0002);
 return {parts,patches,all:[...space.partitions.flatMap((p,i)=>cutPartitionBody(parts.partitions[i],cuts.filter(c=>c.hostId===p.id),GRID_PITCH*.0002)),...patches.flatMap(p=>cutPartitionBody(p,cuts,GRID_PITCH*.0002)),...parts.columns]};
};
// A real boundary has masonry on one side only. A seam, needle or inward slit
// has expected masonry on BOTH sides. Probe away from floating-point tails.
const internalPaintEdges=(geometry,expectedBodies,half)=>{
 const found=[],inside=p=>expectedBodies.some(body=>pointInPhysicalBody(p,body));
 for(const component of geometry.components)for(const polygon of component.geom)for(const ring of polygon){
  if(!hasPaintableRingArea(ring))continue;
  for(let i=0;i+1<ring.length;i++){
   const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
   if(len<half*.05)continue;
   const step=half*1e-5,n=[-dy/len*step,dx/len*step],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   if(inside([mid[0]+n[0],mid[1]+n[1]])&&inside([mid[0]-n[0],mid[1]-n[1]]))found.push([a,b]);
  }
 }
 return found;
};

test('#1169 independent witness removes painted internal seams without changing stored data or material',()=>{
 const raw=wallCornerJoinSpace(),config=configOf(raw),before=JSON.stringify(config),space=spaceModels(config)[0];
 const old=legacyParts(space,1),after=geom(old.parts.all),baseline=geom(old.all);
 assert.equal(baseline.components.flatMap(c=>c.geom).length,2,'unchanged raw operands retain the original independent witness');
 assert.equal(after.status,'ok');
 assert.deepEqual(internalPaintEdges(after,old.all,wallCmToUnits(15,1,GRID_PITCH)/2),[],'no stroke inside intended solid masonry');
 const actual=after.components.flatMap(c=>c.geom),expected=baseline.components.flatMap(c=>c.geom);
 assert.ok(geometryArea(difference(actual,expected))<1e-7);
 assert.ok(geometryArea(difference(expected,actual))<1e-7);
 assert.equal(after.depthUnits,baseline.depthUnits);assert.equal(after.openingPadUnits,baseline.openingPadUnits);
 assert.equal(checkSpacePhysicalGeometry(config,raw.id).ok,true);
 assert.equal(JSON.stringify(config),before);
});

test('#1169 shift/rotation/cell/order sweep has no painted ring or inward slit along either full cap',()=>{
 let cases=0;
 for(const cell of [1,5,20])for(const angle of [0,.37,1.13])for(const shift of [[0,0],[.7,-1.1],[-1.3,.9]])for(const reverse of [false,true]){
  const raw=wallCornerJoinSpace(),c=Math.cos(angle),s=Math.sin(angle);
  const transform=([x,y])=>[x*c-y*s+shift[0],x*s+y*c+shift[1]];
  raw.cell_cm=cell;raw.partitions=raw.partitions.map(p=>({...p,a:transform(p.a),b:transform(p.b)}));
  if(reverse)raw.partitions.reverse().forEach(p=>{[p.a,p.b]=[p.b,p.a];});
  const space=spaceModels(configOf(raw))[0],old=legacyParts(space,cell),after=geom(old.parts.all),baseline=geom(old.all);
  assert.equal(after.status,'ok');
  assert.deepEqual(internalPaintEdges(after,old.all,wallCmToUnits(15,cell,GRID_PITCH)/2),[],JSON.stringify({cell,angle,shift,reverse}));
  assert.equal(after.depthUnits,baseline.depthUnits);assert.equal(after.openingPadUnits,baseline.openingPadUnits);
  cases++;
 }
 assert.equal(cases,54);
});

test('#1169 unequal/acute/short/#310 supports preserve the source silhouette, depth and raw preview contract',()=>{
 for(const angle of [Math.PI/6,Math.PI/2,Math.PI*5/6])for(const depths of [[15,15],[10,30],[30,10]])for(const length of [3,500]){
  const node=[37,59],space={partitions:[{id:'a',a:node,b:[node[0]+length,node[1]],cm:depths[0]},
   {id:'b',a:node,b:[node[0]+500*Math.cos(angle),node[1]+500*Math.sin(angle)],cm:depths[1]}],wall_columns:[]};
  const old=legacyParts(space,1),after=geom(old.parts.all),before=geom(old.all);
  assert.equal(after.status,'ok');assert.equal(after.depthUnits,before.depthUnits);assert.equal(after.openingPadUnits,before.openingPadUnits);
  const current=after.components.flatMap(c=>c.geom),baseline=before.components.flatMap(c=>c.geom);
  assert.ok(geometryArea(difference(current,baseline))<1e-7,JSON.stringify({angle,depths,length}));
  assert.ok(geometryArea(difference(baseline,current))<1e-7);
  const raw=linearWallJoinPatches(segments(space,1),GRID_PITCH*.0002);
  assert.equal(raw.length,1);assert.equal(raw[0].length,4,'raw translucent preview retains one original quad');
  if(length===500)assert.deepEqual(internalPaintEdges(after,old.all,wallCmToUnits(Math.min(...depths),1,GRID_PITCH)/2),[],JSON.stringify({angle,depths}));
 }
});

test('#1169 actual PDF/iso projections retain an external wall contour without an internal seam',()=>{
 const raw=wallCornerJoinSpace(),config=configOf(raw),space=spaceModels(config)[0];
 const after=geom(physicalBodyParts(space,1,GRID_PITCH).all),geometry=after.components.flatMap(c=>c.geom);
 assert.equal(geometry.length,1);assert.equal(geometry[0].filter(hasPaintableRingArea).length,1);
 assert.ok(buildIsoWallGeometry(geometry).edgeCount>0);
 const pdf=buildPdfPage({config,rawSpace:raw,space,layout:{},options:{paper:'A4',scale:'auto'},imperial:false,
  cardTitle:'Synthetic corner',version:'test',now:new Date('2026-11-01T00:00:00Z'),t:key=>key});
 const walls=pdf.commands.filter(c=>c.kind==='path'&&c.hatch);
 assert.equal(walls.length,1);assert.equal(walls[0].rings.length,1);
 // Real holes remain paintable independently of the join construction.
 assert.equal(hasPaintableRingArea([[0,0],[10,0],[10,1e-8],[0,1e-8],[0,0]]),true);
});
test('#1169 hosted cuts keep their openings, old depth and geometry guards near the joined caps',()=>{
 const raw=wallCornerJoinSpace(),space=spaceModels(configOf(raw))[0],node=space.partitions[0].b;
 const p=space.partitions[0],len=Math.hypot(p.a[0]-node[0],p.a[1]-node[1]),u=[(p.a[0]-node[0])/len,(p.a[1]-node[1])/len];
 for(const [start,end] of [[.5,3],[10,50],[80,100]]){
  const along=t=>[node[0]+u[0]*t,node[1]+u[1]*t];
  const cuts=[{hostId:p.id,a:along(start),b:along(end),depth:wallCmToUnits(15,1,GRID_PITCH)}];
  const old=legacyParts(space,1,cuts),after=geom(old.parts.all),before=geom(old.all);
  assert.equal(after.status,'ok');assert.equal(after.depthUnits,before.depthUnits);assert.equal(after.openingPadUnits,before.openingPadUnits);
  const current=after.components.flatMap(c=>c.geom),baseline=before.components.flatMap(c=>c.geom);
  assert.ok(geometryArea(difference(current,baseline))<1e-7);
  assert.ok(geometryArea(difference(baseline,current))<1e-7);
 }
});

test('#1169 ambiguous or unrepresentable joins retain raw geometry and T/X fans stay unchanged',()=>{
 const variants=[
  [{a:[0,0],b:[500,0],halfDepth:10},{a:[0,0],b:[0,500],halfDepth:10}],
  [{a:[0,0],b:[500,0],halfDepth:10},{a:[1e-8,0],b:[50,500],halfDepth:10}],
  [{a:[0,0],b:[500,0],halfDepth:10},{a:[0,0],b:[-500,1e-6],halfDepth:10}],
  [{a:[0,0],b:[500,0],halfDepth:10},{a:[0,0],b:[0,500],halfDepth:10},{a:[0,0],b:[-500,0],halfDepth:10}],
 ];
 for(const input of variants){
  const before=structuredClone(input);
  assert.deepEqual(linearWallJoinPatches(input,1e-6,{unionOverlap:true}),linearWallJoinPatches(input,1e-6));
  assert.deepEqual(input,before);
 }
});