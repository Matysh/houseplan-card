import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../test-build/wall-arrangement.js';
import * as Q from '../test-build/plan-exact.js';
import * as R from '../test-build/render-exact.js';
import {directWallGeometry,directRecut} from '../test-build/direct-wall-geometry.js';
import {spaceModels} from '../test-build/space-geometry.js';
import {wallBodiesGeometry,polyclipToPathD} from '../test-build/wall-thickness.js';
import {migrateGraphSpace} from '../test-build/plan-graph.js';
import {directWallScenes} from '../demo/fixtures/direct-wall-geometry.mjs';
const area=geom=>geom.reduce((sum,p)=>sum+p.reduce((v,r,i)=>v+(i?-1:1)*Math.abs(r.reduce((a,x,j)=>{const y=r[(j+1)%r.length];return a+x[0]*y[1]-x[1]*y[0];},0)/2),0),0);
const poly=points=>A.polygon(points);
const rectangle=(x,y,w,h)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
function graph(points,edges,rooms=[]){return{version:1,nodes:points.map((p,i)=>({id:'n'+i,p:Q.encodePoint(Q.readSourcePoint(p))})),edges:edges.map(([a,b,cm=2],i)=>({kind:'wall',id:'w'+i,from:'n'+a,to:'n'+b,cm})),rooms:rooms.map((ids,i)=>({room:'r'+i,edges:ids.map(([id,reverse=false])=>({kind:'wall',id:'w'+id,reverse}))})),dependencies:[]};}
const build=g=>directWallGeometry({graph:g,scale:1},1,1,[],[]);
test('arrangement nodes crossings, coincident spans, touch and legitimate holes',()=>{
 assert.equal(area(A.arrange([rectangle(0,0,4,2),rectangle(2,0,4,2)])),12);
 assert.equal(area(A.arrange([rectangle(0,0,2,2),rectangle(2,2,2,2)])),8);
 const ring=[rectangle(0,0,10,1),rectangle(0,9,10,1),rectangle(0,1,1,8),rectangle(9,1,1,8)];
 const geometry=A.arrange(ring);assert.equal(area(geometry),36);assert.equal(geometry.length,1);assert.equal(geometry[0].length,2);
 assert.equal(area(A.arrange(Array.from({length:100},()=>rectangle(0,0,2,2)))),4);
 const clipped=A.subtractConvex(rectangle(0,0,10,10),rectangle(2,2,6,6));
 assert.equal(area(A.arrange(clipped)),64);
 const width=2**-50,narrow=A.arrange([rectangle(0,0,1,1),rectangle(0,2,1,1),rectangle(0,1,.5,1),rectangle(.5+width,1,.5-width,1)]);
 assert.equal(narrow[0].length,2,'exact narrow hole retained');
 assert.equal((polyclipToPathD(narrow).match(/M /g)||[]).length,2,'SVG keeps the proved narrow hole');
});
test('exact predicates retain a real dyadic gap and irrational diagonal intersections',()=>{
 const gap=2**-40;assert.equal(A.arrange([rectangle(0,0,1,1),rectangle(1+gap,0,1,1)]).length,2);
 const triangle=poly([[0,0],[Math.sqrt(2),0],[0,Math.sqrt(2)]]);
 const result=A.arrange([triangle,rectangle(0,0,.5,.5)]);assert.ok(Math.abs(area(result)-1)<1e-14);
 assert.equal(Q.toNumber(A.binary64(Number.MIN_VALUE)),Number.MIN_VALUE);
 const tiny=R.exact(1n,1n<<5000n);
 assert.equal(R.orientation([R.ZERO,R.ZERO],[R.ONE,tiny],[R.ONE,R.ZERO]).n,-1n,'derived predicates do not inherit the persisted integer cap');
});

test('predicate-only signs agree with independently reduced rational determinants',()=>{
 const sign=n=>n<0n?-1:n>0n?1:0;
 for(let i=1n;i<=127n;i++){
  const a=[R.exact(i-65n,i+1n),R.exact(i*i-100n,17n)],b=[R.exact(-i,19n),R.exact(i+7n,i+3n)],c=[R.exact(2n*i,23n),R.exact(-i*i,29n)];
  assert.equal(R.orientationSign(a,b,c),sign(R.orientation(a,b,c).n));
  assert.equal(R.crossSign(a,b),sign(R.cross(a,b).n));
 }
 const tiny=R.exact(1n,1n<<5000n);
 assert.equal(R.orientationSign([R.ZERO,R.ZERO],[R.ONE,tiny],[R.ONE,R.ZERO]),-1);
});
test('shared and distinct equal-coordinate IDs join identically; no graph mutation',()=>{
 const shared=graph([[0,0],[10,0],[0,10]],[[0,1],[0,2]]),separate=graph([[0,0],[10,0],[0,0],[0,10]],[[0,1],[2,3]]);
 const before=JSON.stringify(separate),a=build(shared),b=build(separate);
 assert.equal(area(a.geom),40);assert.equal(area(b.geom),40);assert.deepEqual(a.geom,b.geom);assert.equal(JSON.stringify(separate),before);
 const near=graph([[0,0],[10,0],[1e-10,1e-10],[0,10]],[[0,1],[2,3]]);
 assert.ok(area(build(near).geom)<39.00000001);
});
test('virtual unsplit T equals explicit render spans and preserves source IDs',()=>{
 const unsplit=graph([[-10,0],[10,0],[0,0],[0,10]],[[0,1],[2,3]]),split=graph([[-10,0],[10,0],[0,0],[0,10]],[[0,2],[2,1],[2,3]]);
 const before=JSON.stringify(unsplit),a=build(unsplit),b=build(split);
 assert.equal(area(a.geom),58);assert.equal(area(b.geom),58);assert.equal(JSON.stringify(unsplit),before);
});
test('rectangular room keeps inset, outer paper and hole independently of source order',()=>{
 const g=graph([[0,0],[10,0],[10,10],[0,10]],[[0,1],[1,2],[2,3],[3,0]],[[[0],[1],[2],[3]]]);
 const result=build(g);assert.equal(area(result.geom),80);assert.equal(area(result.paperGeom),144);assert.equal(result.geom[0].length,2);
 const reversed=structuredClone(g);reversed.nodes.reverse();reversed.edges.reverse();
 assert.equal(area(build(reversed).geom),80);
 const model=spaceModels({model_version:11,spaces:[{id:'s',plan_graph:g,rooms:[{id:'r0'}]}]})[0];
 const routed=wallBodiesGeometry(model.rooms,[],[],[],1,1,1000,1000,[],{mergeExtra(){throw Error('legacy boolean must not run');}});
 assert.equal(routed.status,'ok');assert.equal(area(routed.geom),80e6);
});
test('host-owned opening does not cut crossing foreign material; recut uses same domains',()=>{
 const g=graph([[-10,0],[0,0],[10,0],[0,-10],[0,10]],[[0,1],[1,2],[3,1],[1,4]]);
 const source={graph:g,scale:1};
 const opening={x:0,y:0,angle:0,length:4,host:{kind:'wall',id:'w0'}};
 const result=directWallGeometry(source,1,1,[opening],[]);
 const inside=(x,y)=>result.geom.some(p=>A.contains(polygon(p[0]),A.numericPoint([x,y]))&&!p.slice(1).some(r=>A.contains(polygon(r),A.numericPoint([x,y]))));
 function polygon(r){return r.slice(0,-1).map(A.numericPoint);}
 assert.ok(inside(0,0),'foreign vertical body remains opaque');assert.ok(!inside(1.5,0),'own collinear run is cut across its split');
 const recut=directRecut(result.roomGeom,[opening],[]);assert.ok(recut);assert.deepEqual(recut.geom,result.geom);
});

test('an independent ray at a room corner cannot enlarge the floor slab',()=>{
 const g=graph([[0,0],[10,0],[10,10],[0,10],[5,5]],[[0,1],[1,2],[2,3],[3,0]],[[[0],[1],[2],[3]]]);
 const before=build(g).paperGeom;
 g.edges.push({kind:'partition',id:'independent',from:'n0',to:'n4',cm:4});
 assert.deepEqual(build(g).paperGeom,before);
});

test('courtyard paper has exactly one intended hole and the analytic rectangle-difference area',()=>{
 const source=directWallScenes().find(s=>s.id==='courtyard');
 const result=directWallGeometry({graph:migrateGraphSpace(source).graph,scale:1000},5,1000/240,[],[]);
 assert.equal(result.status,'ok');assert.equal(result.paperGeom.length,1);
 assert.equal(result.paperGeom[0].length,2,'no four spurious triangular paper holes');
 assert.ok(Math.abs(area(result.paperGeom)-(812.5**2-387.5**2))<1e-8);
});

test('collapsed inset, finite thick support and diagonal scale/translation/reversal invariants',()=>{
 const thin=graph([[0,0],[10,0],[10,.5],[0,.5]],[[0,1],[1,2],[2,3],[3,0]],[[[0],[1],[2],[3]]]);
 assert.equal(area(build(thin).geom),30,'collapsed inset fills the physical room, without inverted holes');
 const short=graph([[0,0],[.2,0],[0,10]],[[0,1,4],[0,2,.2]]),shape=build(short).geom;
 const hit=(geom,x,y)=>geom.some(p=>A.contains(p[0].slice(0,-1).map(A.numericPoint),A.numericPoint([x,y]))&&!p.slice(1).some(r=>A.contains(r.slice(0,-1).map(A.numericPoint),A.numericPoint([x,y]))));
 assert.equal(hit(shape,.3,1),false,'thick material cannot continue past its short support');
 for(let degree=2;degree<=8;degree++){
  const points=[[0,0],...Array.from({length:degree},(_,i)=>[10*Math.cos(i*2*Math.PI/degree),10*Math.sin(i*2*Math.PI/degree)])];
  const base=graph(points,Array.from({length:degree},(_,i)=>[0,i+1,i%2?.8:1.2]));
  const first=build(base),snapshot=JSON.stringify(base);
  assert.ok(hit(first.geom,0,0));
  for(const scale of [1,1000]){
   const scaled=directWallGeometry({graph:base,scale},1,scale,[],[]);
   assert.ok(Math.abs(area(scaled.geom)/(scale*scale)-area(first.geom))<1e-10);
  }
  const rotated=graph(points.map(([x,y])=>[-y+100,x-80]),base.edges.map((e,i)=>[i+1,0,e.cm]));
  assert.ok(Math.abs(area(build(rotated).geom)-area(first.geom))<1e-10,'degree '+degree+': '+area(first.geom)+' vs '+area(build(rotated).geom));
  assert.equal(JSON.stringify(base),snapshot);
 }
});

test('invalid independent component cannot blank healthy masonry or become a successful physical result',()=>{
 const g=graph([[0,0],[10,0]],[[0,1]]),result=directWallGeometry({graph:g,scale:1},1,1,[],[[[NaN,0],[1,0],[0,1]]]);
 assert.equal(result.status,'degraded-extra');assert.equal(result.failurePhase,'direct-extra');assert.equal(result.degradedExtraCount,1);
 assert.equal(area(result.geom),20);assert.equal(result.components.length,1);
});
