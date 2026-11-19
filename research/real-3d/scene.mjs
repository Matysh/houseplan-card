// Read existing product geometry. No alternate saved 3D model, no HA calls.
import {createIsoStructuralSource} from '../../src/iso-scene-geometry.ts';
import {projectIsoOpening,projectIsoOpeningStructure} from '../../src/iso-openings.ts';
import {isoCameraFor,projectPlanPoint} from '../../src/iso-projection.ts';
import {furnitureVolumeFaces,furniturePlanPoint,FURNITURE_HEIGHT_SCALE} from '../../src/iso-lab-furniture.ts';
import {FURNITURE_VOLUME_MODELS} from '../../src/furniture-volume.generated.ts';
import {fixtureWallKey} from '../../demo/fixtures/wall-key.mjs';
import {spaceModels} from '../../src/space-geometry.ts';
import {geometryOpenings,geometryPartitionOpeningCuts,geometryRoomOpeningInputs} from '../../src/plan-geometry-preflight.ts';
export {isoCameraFor,projectPlanPoint};
export const H=140/5*(1000/240);
export function fixture(kind='home'){
 const cols=kind==='dense'?6:3,rows=kind==='dense'?4:2;
 const rooms=[],walls=new Map(),openings=[];
 const names=['Гостиная','Кухня','Кабинет','Спальня','Холл','Ванная'];
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const x=.1+i*.8/cols,y=.14+j*.7/rows,w=.8/cols,h=.7/rows;
  const poly=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],id=rooms.length;
  rooms.push({id:'r'+id,name:kind==='home'?names[id]:'Комната '+(id+1),poly,area:null,color:['#dfe8d6','#d9e7ed','#ece1d7','#e4daeb','#e8e5d5','#d3e7e2'][id%6]});
  for(let k=0;k<4;k++){
   const a=poly[k],b=poly[(k+1)%4],key=fixtureWallKey(a,b);
   if(!walls.has(key))walls.set(key,{id:'w'+walls.size,key,a,b,cm:20});
  }
 }
 let n=0;
 for(const wall of walls.values()){
  if(n++%2)continue;
  const {a,b}=wall,horizontal=a[1]===b[1],length=horizontal?Math.abs(b[0]-a[0]):Math.abs(b[1]-a[1]);
  const type=n%5===0?'passage':n%3===0?'window':n%7===0?'gate':'door';
  openings.push({id:'o'+openings.length,type,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,angle:horizontal?0:90,length:Math.min(.085,length*.5),flip_v:n%4===0,
   opening_features:{mechanism:type==='gate'?'sliding':'swing',...(type==='window'?{leaves:2}:{})}});
 }
 const space={id:'lab-'+kind,cell_cm:5,rooms,partitions:[],wall_columns:[],openings,walls:[...walls.values()],settings:{show_borders:true}};
 const furniture=rooms.flatMap((room,i)=>{
  const [[x,y],[right],[,bottom]]=room.poly,w=right-x,h=bottom-y;
  return [{id:'f'+i,symbol:['sofa','bed_double','table_dining','wardrobe','bathtub','table_round'][i%6],x:x+w*.18,y:y+h*.3,w:w*.5,h:h*.4,angle:i%2?90:0}];
 });
 const count=kind==='dense'?200:80;
 const devices=Array.from({length:count},(_,i)=>{
  const room=rooms[i%rooms.length],[[x,y],[right],[,bottom]]=room.poly;
  const index=Math.floor(i/rooms.length),r=Math.ceil(Math.sqrt(count/rooms.length));
  return {id:'d'+i,name:(i%3?'Датчик ':'Свет ')+(i+1),x:(x+(right-x)*(.15+.7*(index%r)/(r-1)))*1000,y:(y+(bottom-y)*(.15+.7*Math.floor(index/r)/(r-1)))*1000,z:4,on:i%4===0,value:(20+i%8)+'.'+i%10+'°'};
 });
 return {space,furniture,devices};
}
const spatial=(x,y,z)=>({point:[x,y],z});
export function volume(rings,bottom,top,color,owner){
 const result=[{loops:rings.map(r=>r.map(([x,y])=>spatial(x,y,top))),color,owner}];
 for(const ring of rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  result.push({loops:[[spatial(...a,bottom),spatial(...b,bottom),spatial(...b,top),spatial(...a,top)]],color,owner});
 }
 return result;
}
const colors={'wall-top':'#e2e8eb','wall-side':'#a5b4bc',reveal:'#a9bac4','matte-leaf':'#a3b8c3','light-frame':'#eef2f3','glass-side':'#b3d5df','glass-top':'#d1e4eb','light-window':'#b5d5db',hardware:'#586b77','gate-metal':'#778d9b','gate-panel':'#7a93a0','light-sill':'#e3eaec'};
export function openingFaces(bases,amount=.55){
 const camera=isoCameraFor(0);
 return bases.flatMap(b=>[...projectIsoOpeningStructure(b,camera,true),...projectIsoOpening(b,amount,camera,true).flatMap(p=>p.surfaces)]
  .filter(s=>s.points?.length>=3).map(s=>({loops:[s.points],color:colors[s.material]||'#d5e0e4',owner:b.id,glass:s.material.includes('glass')})));
}
export function buildScene(kind){
 const data=fixture(kind),{space}=data;
 const model=spaceModels({spaces:[space]})[0],pitch=1000/240;
 const openings=geometryOpenings(space,model,5,pitch,1000);
 const roomOpenings=geometryRoomOpeningInputs(openings,model,space.walls,[],1/240,5,pitch,1000);
 const source=createIsoStructuralSource({space:model,walls:space.walls,openCuts:[],openings,partitionCuts:()=>geometryPartitionOpeningCuts(openings),roomOpenings:()=>roomOpenings,cellCm:5,gridPitch:pitch,wallKeyPitch:1/240,coordinateScale:1000,onBuild:()=>{}});
 const physical=source.build();
 const faces=[];
 for(const room of space.rooms)faces.push(...volume([room.poly.map(p=>p.map(v=>v*1000))],-8,0,room.color,room.id));
 for(const polygon of physical.walls)faces.push(...volume(polygon,0,H,'#c3ced4','masonry'));
 for(const shape of data.furniture){
  const parts=FURNITURE_VOLUME_MODELS[shape.symbol];
  if(!parts)throw Error('Missing furniture '+shape.symbol);
  for(const part of parts)for(const face of furnitureVolumeFaces(part,shape.w*1000,shape.h*1000,FURNITURE_HEIGHT_SCALE)){
   faces.push({loops:face.loops.map(loop=>loop.map(([x,y,z])=>({point:furniturePlanPoint(shape,[x,y],1000,1000),z:z*FURNITURE_HEIGHT_SCALE}))),color:face.cap?'#b0c7c8':'#86a4ac',owner:shape.id});
  }
 }
 return {...data,faces,bases:physical.openings,physicalWallComponents:physical.walls.length};
}
