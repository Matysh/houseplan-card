import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as A from '../test-build/wall-arrangement.js';
import * as Q from '../test-build/plan-exact.js';
import {directWallGeometry,directRoomFloor} from '../test-build/direct-wall-geometry.js';
const original=JSON.parse(readFileSync(new URL('../demo/fixtures/wall-paper-corners-1327.json',import.meta.url))).spaces[0];
const witnesses=[[2.2227876402597895,-1.3552284971734196],[2.647000431438182,-0.8069645555876516]];
const contains=(geom,p)=>geom.some(poly=>A.contains(A.polygon(poly[0]),A.numericPoint(p))&&!poly.slice(1).some(r=>A.contains(A.polygon(r),A.numericPoint(p))));
for(const [name,transform,scale,reverse] of [
 ['original',p=>p,1,false],['render units',p=>p,1000,false],
 ['rotated',([x,y])=>[-y,x],1,false],['mirrored',([x,y])=>[-x,y],1,false],['reordered',p=>p,1,true],
])test(`room paper has no exposed material at either mixed corner: ${name}`,()=>{
 const graph=structuredClone(original.plan_graph);
 for(const n of graph.nodes)n.p=Q.encodePoint(Q.readSourcePoint(transform(Q.pointToNumbers(Q.decodePoint(n.p)))));
 if(reverse){graph.nodes.reverse();graph.edges.reverse();graph.rooms.reverse();}
 const before=JSON.stringify(graph),source={graph,scale},result=directWallGeometry(source,1,scale/240,[],[]);
 assert.equal(result.status,'ok');
 for(const [i,p] of witnesses.entries()){
  const point=transform(p).map(v=>v*scale);
  assert.equal(contains(result.paperGeom,point)&&!contains(result.geom,point),false,`exposed underlay at corner ${i+1}`);
 }
 const voidPoint=transform([2.26,-.81]).map(v=>v*scale);
 assert.equal(contains(result.paperGeom,voidPoint),false,'legitimate triangular void remains open');
 assert.equal(contains(result.geom,voidPoint),false);
 const roomPoint=transform([1.48,-.94]).map(v=>v*scale);
 assert.equal(contains(result.paperGeom,roomPoint),true,'room floor remains painted');
 const room=original.rooms[0].poly.map(p=>transform(p).map(v=>v*scale));
 assert.equal(contains(directRoomFloor(source,1,scale/240,room),roomPoint),true,'clean room floor survives');
 assert.equal(JSON.stringify(graph),before,'rendering never edits the graph');
});

test('required coverage classifies shared polygons, empty masks and subtraction in one exact arrangement',()=>{
 const a=A.polygon([[0,0],[4,0],[4,4],[0,4]]),b=A.polygon([[2,-1],[5,-1],[5,5],[2,5]]);
 const area=g=>g.reduce((v,p)=>v+p.reduce((n,r,i)=>n+(i?-1:1)*Math.abs(r.reduce((s,x,j)=>{const y=r[(j+1)%r.length];return s+x[0]*y[1]-x[1]*y[0];},0)/2),0),0);
 assert.equal(area(A.arrange([a],[],[a])),16,'one domain can be both source and coverage');
 assert.equal(area(A.arrange([a],[],[b])),8);
 assert.deepEqual(A.arrange([a],[],[]),[],'empty coverage is not an omitted mask');
 assert.equal(area(A.arrange([a],[A.polygon([[2,0],[3,0],[3,4],[2,4]])],[b])),4);
 const cache=new WeakMap(),first=A.arrangeComponents([a],cache,[b]);
 assert.equal(area(first.geom),8);assert.strictEqual(A.arrangeComponents([a],cache,[b]).geom[0],first.geom[0]);
 assert.equal(area(A.arrangeComponents([a],cache,[a]).geom),16,'changed coverage invalidates reuse');
 assert.equal(area(A.arrangeComponents([a],cache).geom),16,'unmasked call does not inherit mask');
});
