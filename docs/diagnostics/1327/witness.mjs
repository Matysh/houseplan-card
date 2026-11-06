import{readFileSync,writeFileSync}from'node:fs';import * as A from'../../test-build/wall-arrangement.js';import * as Q from'../../test-build/plan-exact.js';import{directWallGeometry}from'../../test-build/direct-wall-geometry.js';
const dir='artifacts/corner-20261106',s=JSON.parse(readFileSync(dir+'/minimal-config.json')).spaces[0],g=s.plan_graph;
const actual=directWallGeometry({graph:g,scale:1},1,1/240,[],[]),without=directWallGeometry({graph:{...g,edges:g.edges.filter(e=>e.id!=='partition-4fada5bd-e743-466d-8239-2447101588cb')},scale:1},1,1/240,[],[]);
const contains=(geom,p)=>geom.some(poly=>A.contains(A.polygon(poly[0]),A.numericPoint(p))&&!poly.slice(1).some(r=>A.contains(A.polygon(r),A.numericPoint(p))));
const rooms=s.rooms.map(r=>A.polygon(r.poly));const insideRooms=p=>rooms.some(r=>A.contains(r,A.numericPoint(p)));
const rows=[];for(const id of['draw-node-fe26bea0-6446-4539-93a4-2e0a6b808f47','draw-node-03a79a6f-d0b1-41e5-ab1f-3ce3e7eaae68']){
 const node=Q.pointToNumbers(Q.decodePoint(g.nodes.find(n=>n.id===id).p)),vertices=actual.paperGeom.flatMap(poly=>poly[0]).filter(p=>Math.hypot(p[0]-node[0],p[1]-node[1])<.1);let witness;
 for(const vertex of vertices)for(const t of[.99,.95,.9,.8,.7,.5]){const p=vertex.map((x,i)=>node[i]+(x-node[i])*t);if(contains(actual.paperGeom,p)&&!contains(actual.geom,p)&&!insideRooms(p)){witness=p;break;}if(witness)break;}
 rows.push({id,node,witness,paperContains:contains(actual.paperGeom,witness),masonryContains:contains(actual.geom,witness),centreRoomsContain:insideRooms(witness),withoutPartitionMasonryContains:contains(without.geom,witness),paperUnchangedWhenRemovingPartition:JSON.stringify(actual.paperGeom)===JSON.stringify(without.paperGeom)});
}
writeFileSync(dir+'/witnesses.json',JSON.stringify({source:'v1.84.0',builderStatus:actual.status,rows},null,2));console.log(JSON.stringify(rows,null,2));

