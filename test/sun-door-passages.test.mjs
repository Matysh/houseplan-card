import test from 'node:test';
import assert from 'node:assert/strict';
import {openingWallIndex,wallKey} from '../test-build/wall-thickness.js';
import {pointInPolygon} from '../test-build/logic.js';
import {computeSunRays,solarWindowOpenings} from '../test-build/sun.js';
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

for(const flag of [undefined,false,true]) test('#1348 interior glass flag '+flag+' does not extend sunlight in Flat or 2.5D',()=>{
 const f=fixture();const internal=f.openings.map(o=>({...o,light_transparent:flag}));
 const windows=solarWindowOpenings([{id:'exterior',type:'window',rx:0,ry:50,rlen:80,angle:90},...internal]);
 const flat=computeSunRays(f.rooms,windows,270,10,0,f.inner,{exterior:20});
 const iso=computeIsoSunBeams({rooms:f.rooms,windows,azimuth:270,elevation:10,northDeg:0,wallHeight:80,innerByRoom:f.inner,wallDepthByOpening:{exterior:20}});
 for(const beams of [flat,iso]){assert.ok(beams.length);assert.ok(beams.every(b=>b.roomId==='a'));assert.equal(beams.some(b=>b.polys.some(p=>pointInPolygon([130,50],p))),false);}
});
test('#1348 exterior glass door is the same solar source as a window in both renderers',()=>{
 const f=fixture(),door={id:'exterior',type:'door',rx:0,ry:50,rlen:80,angle:90};
 const render=windows=>[computeSunRays(f.rooms,windows,270,10,0,f.inner,{exterior:20}),computeIsoSunBeams({rooms:f.rooms,windows,azimuth:270,elevation:10,northDeg:0,wallHeight:80,innerByRoom:f.inner,wallDepthByOpening:{exterior:20}})];
 assert.deepEqual(render(solarWindowOpenings([door])),[[],[]]);
 const glass=render(solarWindowOpenings([{...door,light_transparent:true}]));assert.ok(glass.every(beams=>beams.length));
 assert.deepEqual(glass,render(solarWindowOpenings([{...door,type:'window'}])));
});
