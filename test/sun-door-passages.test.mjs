import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSunDoorPassages,continueSolarBeam} from '../test-build/sun-door-passages.js';
import {openingWallIndex,wallKey} from '../test-build/wall-thickness.js';
import {pointInPolygon} from '../test-build/logic.js';
import {geometryOuterRings} from '../test-build/physical-geometry.js';
import {computeSunRays} from '../test-build/sun.js';
import {computeIsoSunBeams} from '../test-build/iso-sun.js';
const room=(id,x)=>({id,poly:[[x,0],[x+100,0],[x+100,100],[x,100]]});
function fixture(){
 const rooms=[room('a',0),room('b',100),room('c',200)];
 const walls=[...new Map(rooms.flatMap(r=>r.poly.map((a,i)=>{const b=r.poly[(i+1)%4],key=wallKey(a,b,1);return [key,{key,a,b,cm:20}];}))).values()];
 const space={id:'s',rooms,partitions:[],wall_columns:[],wall_segments:walls.map((w,i)=>({id:'wall'+i,...w}))};
 const index=openingWallIndex(rooms,walls,[],1,5,5,1);
 const openings=[100,200].map((x,i)=>({id:'d'+i,type:'door',rx:x,ry:50,rlen:40,angle:90,light_transparent:true}));
 const inner=Object.fromEntries(rooms.map(r=>[r.id,r.poly.map(([x,y],i)=>[x+(i===0||i===3?10:-10),y+(i<2?10:-10)])]));
 const source={roomId:'a',a:[10,20],b:[10,80],dir:[1,0],len:270,polys:[[[10,20],[90,20],[90,80],[10,80]]]};
 return {rooms,walls,space,index,openings,inner,source};
}
const sees=(regions,p)=>regions.some(r=>geometryOuterRings(r.geometry).some(poly=>pointInPolygon(p,poly)));
test('#1348 window light continues through a chain of glass doors with the original reach and jambs',()=>{
 const f=fixture(),doors=buildSunDoorPassages(f.openings,f.space,f.index,5,5);assert.equal(doors.length,2);
 const regions=continueSolarBeam(f.source,f.rooms,f.inner,doors,[]);
 assert.equal(sees(regions,[130,50]),true);assert.equal(sees(regions,[230,50]),true);
 assert.equal(sees(regions,[100,50]),true,'the physical door tunnel joins the floors');
 assert.equal(sees(regions,[130,80]),false,'only the actual aperture passes light');
 assert.equal(sees(regions,[285,50]),false,'the door does not restart the window ray length');
 assert.equal(sees(regions,[50,50]),false,'the existing source room is not painted twice');
 assert.deepEqual(continueSolarBeam(f.source,f.rooms,f.inner,[],[]),[]);
 const closed=buildSunDoorPassages(f.openings.map(o=>({...o,light_transparent:false})),f.space,f.index,5,5);
 assert.deepEqual(closed,[]);
 const first=continueSolarBeam(f.source,f.rooms,f.inner,doors.slice(0,1),[]);
 assert.equal(sees(first,[130,50]),true);assert.equal(sees(first,[230,50]),false);
});
test('#1348 other obstacles and invalid/exterior hosts cannot become solar passages',()=>{
 const f=fixture(),doors=buildSunDoorPassages(f.openings,f.space,f.index,5,5);
 const blocked=continueSolarBeam(f.source,f.rooms,f.inner,doors,[[[145,40],[155,40],[155,60],[145,60]]]);
 assert.equal(sees(blocked,[230,50]),false);
 assert.deepEqual(buildSunDoorPassages([{...f.openings[0],host:{kind:'wall',id:'missing',t:.5}}],f.space,f.index,5,5),[]);
 assert.deepEqual(buildSunDoorPassages([{...f.openings[0],rx:0}],f.space,f.index,5,5),[]);
 const away=continueSolarBeam({...f.source,dir:[-1,0]},f.rooms,f.inner,doors,[]);assert.deepEqual(away,[]);
 const short=continueSolarBeam({...f.source,len:80},f.rooms,f.inner,doors,[]);assert.equal(sees(short,[130,50]),false);
});
test('#1348 a room sunlight flag is not required and a transparent room stays unpainted',()=>{
 const f=fixture(),doors=buildSunDoorPassages(f.openings,f.space,f.index,5,5);f.rooms[1].sunTransparent=true;
 const regions=continueSolarBeam(f.source,f.rooms,f.inner,doors,[]);
 assert.equal(regions.some(r=>r.roomId==='b'),false);assert.equal(sees(regions,[230,50]),true);
});
test('#1348 Flat and 2.5D consume the same proven apertures without a new sun source',()=>{
 const f=fixture(),glassDoors=buildSunDoorPassages(f.openings,f.space,f.index,5,5);
 const windows=[{id:'window',x:0,y:50,angle:90,length:80}],depth={window:20};
 const [ray]=computeSunRays(f.rooms,windows,270,10,0,f.inner,depth);assert.ok(ray);
 const flat=continueSolarBeam(ray,f.rooms,f.inner,glassDoors,[]);assert.equal(sees(flat,[130,50]),true,JSON.stringify({ray,flat,glassDoors}));
 const iso=computeIsoSunBeams({rooms:f.rooms,windows,azimuth:270,elevation:10,northDeg:0,wallHeight:80,
   innerByRoom:f.inner,wallDepthByOpening:depth,glassDoors,lightFloorRooms:new Set(['b'])});
 const b=iso.find(beam=>beam.roomId==='b'&&beam.polys.some(p=>pointInPolygon([130,50],p)));
 assert.ok(b,JSON.stringify(iso));assert.equal(b.openingId,'window');assert.equal(b.lightFloor,true);assert.ok(b.clipPolys);
 assert.ok(iso.every(beam=>Math.abs(beam.a[0]-10)<1e-8),'all gradients retain the original window origin');
 assert.equal(b.polys.some(p=>pointInPolygon([130,80],p)),false);
});

 test('#1348 rotated apertures preserve the same bounded transmission',()=>{
 const f=fixture(),angle=27*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const rotate=([x,y])=>[x*c-y*s,x*s+y*c];
 const doors=buildSunDoorPassages(f.openings,f.space,f.index,5,5).map(d=>({...d,a:rotate(d.a),b:rotate(d.b),normal:rotate(d.normal)}));
 const rooms=f.rooms.map(r=>({...r,poly:r.poly.map(rotate)}));
 const inner=Object.fromEntries(Object.entries(f.inner).map(([id,p])=>[id,p.map(rotate)]));
 const source={...f.source,a:rotate(f.source.a),b:rotate(f.source.b),dir:rotate(f.source.dir),polys:f.source.polys.map(p=>p.map(rotate))};
 const regions=continueSolarBeam(source,rooms,inner,doors,[]);
 assert.equal(sees(regions,rotate([130,50])),true);assert.equal(sees(regions,rotate([230,50])),true);
 assert.equal(sees(regions,rotate([130,80])),false);assert.equal(sees(regions,rotate([285,50])),false);
 });
