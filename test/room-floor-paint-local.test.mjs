import test from 'node:test';
import assert from 'node:assert/strict';
import { difference, union } from 'polyclip-ts';
import { buildRoomFloorPaint, roomFloorGeometry } from '../test-build/room-floor-paint.js';
import { polyclipPathD } from '../test-build/physical-geometry.js';
import { prepareFloorGeometry } from '../test-build/floor-geometry-frame.js';
import { spaceModels, GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { geometryOpenings } from '../test-build/plan-geometry-preflight.js';
import { roomPoly, islandsOf } from '../test-build/logic.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';

const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const polygon=points=>[[[
  ...points.map(([x,y])=>[x,y]), [points[0][0],points[0][1]],
]]];
// The previous all-domain sweep is an independent differential oracle, not
// another production renderer. Keep it deliberately unoptimized.
function fullSweep(seeds,openings,tunnels,blockers=[]){
  const owned=new Map(),all=[];
  for(let i=0;i<openings.length;i++){
    const opening=openings[i],angle=opening.angle*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    for(const face of tunnels[i]?.faces||[])for(const contour of face.contours){
      if(contour.length<3)continue;
      const geom=polygon(contour.map(([x,y])=>[opening.rx+cos*x-sin*y,opening.ry+sin*x+cos*y]));
      all.push(geom);const list=owned.get(face.roomId)||[];list.push(geom);owned.set(face.roomId,list);
    }
  }
  const domain=all.length?union(all[0],...all.slice(1)):null,out=new Map();
  for(const seed of seeds){
    let geom=seed.geom;const faces=owned.get(seed.id)||[];
    if(domain?.length)geom=difference(geom,domain);
    if(faces.length){geom=union(geom,...faces);if(blockers.length)geom=difference(geom,...blockers);}
    const points=geom.flat(2);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const[x,y]of points){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    out.set(seed.id,{path:polyclipPathD(geom),basePath:polyclipPathD(seed.geom),extended:!!faces.length,
      bounds:points.length?[x0-1,y0-1,x1-x0+2,y1-y0+2]:[0,0,1,1]});
  }
  return out;
}
// SVG even-odd paths may differ only in ring start/order or redundant collinear
// vertices when a completely disjoint clipping operand is skipped.
function normalized(path){
  return path.split(/Z/i).filter(s=>s.trim()).map(text=>{
    const values=text.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/ig).map(Number),points=[];
    for(let i=0;i<values.length;i+=2)points.push([values[i]||0,values[i+1]||0]);
    let changed=true;
    while(changed&&points.length>3){changed=false;for(let i=0;i<points.length;i++){
      const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
      if((b[0]-a[0])*(c[1]-b[1])===(b[1]-a[1])*(c[0]-b[0])
        &&(b[0]-a[0])*(b[0]-c[0])+(b[1]-a[1])*(b[1]-c[1])<=0){points.splice(i,1);changed=true;break;}
    }}
    return [points,[...points].reverse()].flatMap(ring=>ring.map((_,i)=>JSON.stringify([...ring.slice(i),...ring.slice(0,i)]))).sort()[0];
  }).sort();
}
function compare(seeds,openings,tunnels,blockers){
  const before=structuredClone({seeds,openings,tunnels,blockers}),expected=fullSweep(seeds,openings,tunnels,blockers);
  const actual=buildRoomFloorPaint(seeds,openings,tunnels,blockers);
  assert.deepEqual([...actual.keys()],[...expected.keys()]);
  for(const[id,value]of actual){const old=expected.get(id);
    assert.deepEqual(normalized(value.path),normalized(old.path),id+' exact painted rings');
    const {geometry,...paint}=value;
    assert.deepEqual(normalized(polyclipPathD(geometry)),normalized(old.path),id+' native floor rings');
    assert.deepEqual({...paint,path:null},{...old,path:null},id+' metadata/base path');
  }
  assert.deepEqual({seeds,openings,tunnels,blockers},before,'no mutation of shared canonical operands');
}
test('#1454 local floor-paint sweep matches the old full-domain sweep for nested, touching, rotated and orphan faces',()=>{
  for(const angle of [0,30,45,90,180,270]){
    const seeds=[{id:'a',geom:roomFloorGeometry(rect(0,0,45,100),[])},
      {id:'b',geom:roomFloorGeometry(rect(55,0,100,100),[])},
      {id:'parent',geom:roomFloorGeometry(rect(-20,-20,120,120),[rect(-10,-10,110,110)])},
      {id:'far',geom:roomFloorGeometry(rect(1000,1000,1100,1100),[])}];
    const openings=[{rx:50,ry:50,angle},{rx:2000,ry:2000,angle}];
    const tunnels=[{faces:[{roomId:'a',contours:[rect(-10,0,10,5)]},{roomId:'b',contours:[rect(-10,-5,10,0)]}]},
      {faces:[{roomId:'missing',contours:[rect(-10,0,10,5)]}]}];
    compare(seeds,openings,tunnels,[polygon(rect(48,44,49,46)),polygon(rect(1100,1000,1200,1100)),polygon(rect(-10000,-10000,-9000,-9000))]);
    compare(seeds,openings,tunnels,[polygon(rect(48,44,49,46))[0],polygon(rect(58,44,59,46))[0]]);
    compare(seeds,openings,tunnels,[polygon(rect(48,44,49,46)),polygon(rect(58,44,59,46))[0]]);
    compare(seeds,openings,[null,null],[]);
  }
});
test('#1454 large-house floor paint has identical exact rings, holes, ownership and bounds after spatial filtering',async()=>{
  const fixture=makeLargeHouseFixture();
  for(const raw of fixture.config.spaces){
    const frame=await prepareFloorGeometry({raw,floorKey:'physical',cleanKey:'clean',projection:'flat'}),space=spaceModels({spaces:[raw]})[0];
    const polys=space.rooms.map(roomPoly),clean=new Map(frame.clean);
    const seeds=space.rooms.flatMap((room,index)=>{const poly=polys[index];if(!poly)return[];
      const floor=frame.inner.find(([key])=>key.startsWith('physical|'+room.id+'|'))?.[1]||poly;
      const holes=islandsOf(floor,polys.filter((p,i)=>i!==index&&p));
      return[{id:room.id||'#'+index,geom:roomFloorGeometry(floor,holes,clean.get('clean|'+(room.id||'#'+index))?.geom)}];
    });
    compare(seeds,geometryOpenings(raw,space,space.cellCm||5,GRID_PITCH,NORM_W),frame.tunnels.value,
      frame.union.value.components.map(component=>component.geom).filter(geom=>geom?.length));
  }
});
