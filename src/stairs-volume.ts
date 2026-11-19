/** UI Lab: derived stair solids; authored dimensions and navigation stay native. */
import { cachedStairRenderGeometry, type Stair } from './stairs';
import { NORM_W } from './canvas-constants';
import { gridVisualUnits } from './grid-scale';
import { isoCameraDepth, isoDisplayWallHeight, projectPlanPoint, unprojectFloorPoint,
  type IsoCamera, type PlanPoint } from './iso-projection';
import type { FurnitureMesh, FurnitureMeshPart } from './iso-lab-furniture';

type Vertex = readonly [number,number,number];
export interface StairVolume {
  mesh: FurnitureMesh; footprint: PlanPoint[]; height: number; hit: string; steps: number;
}
const cache=new WeakMap<object,Map<IsoCamera,StairVolume>>();
const path=(points:readonly PlanPoint[])=>`M ${points.map(p=>p.map(v=>+v.toFixed(5)).join(' ')).join(' L ')} Z`;

export function stairVolume(stair:Stair,cellCm:number,camera:IsoCamera):StairVolume|null {
  if(stair.kind==='straight'&&stair.direction!=='forward')return null;
  const geometry=cachedStairRenderGeometry(stair,cellCm);
  const previous=cache.get(geometry)?.get(camera);if(previous)return previous;
  const height=gridVisualUnits(isoDisplayWallHeight(),cellCm),parts:FurnitureMeshPart[]=[];
  const angle=stair.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const world=(x:number,y:number,z:number):Vertex=>[stair.x*NORM_W+x*c-y*s,stair.y*NORM_W+x*s+y*c,z];
  const add=(name:string,vertices:readonly Vertex[],cap=false)=>{
    const screen=vertices.map(([x,y,z])=>projectPlanPoint([x,y],z,camera));
    const area=screen.reduce((sum,p,i)=>{const q=screen[(i+1)%screen.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(area<=1e-8)return;
    const ink=path(screen.map(p=>unprojectFloorPoint(p,camera)));
    const center = (axis: 0 | 1) => vertices.reduce((sum, p) => sum + p[axis], 0) / vertices.length;
    parts.push({name,top:cap?ink:'',side:cap?'':ink,
      depth:vertices.reduce((sum,[x,y,z])=>sum+isoCameraDepth([x,y],z,camera),0)/vertices.length,
      lightPoint: [center(0), center(1)]});
  };
  let steps:number;
  if(stair.kind==='straight'){
    steps=geometry.treads.length+1;
    const length=stair.length*NORM_W,width=stair.width*NORM_W,dx=length/steps,dz=height/steps;
    for(let i=0;i<steps;i++){
      const x=-length/2+i*dx,next=x+dx,z=(i+1)*dz;
      add(`tread-${i+1}`,[world(x,-width/2,z),world(next,-width/2,z),world(next,width/2,z),world(x,width/2,z)],true);
      add(`riser-${i+1}`,[world(x,width/2,i*dz),world(x,-width/2,i*dz),world(x,-width/2,z),world(x,width/2,z)]);
    }
    // Each flank is one stepped face, without vertical seams between blocks.
    for(const side of [-1,1]){
      const y=side*width/2,profile:Vertex[]=[world(-length/2,y,0),world(length/2,y,0)];
      for(let i=steps-1;i>=0;i--){const x=-length/2+i*dx,z=(i+1)*dz;profile.push(world(x+dx,y,z),world(x,y,z));}
      add(side<0?'left-flank':'right-flank',side<0?profile:profile.reverse());
    }
    add('upper-end',[world(length/2,-width/2,0),world(length/2,width/2,0),world(length/2,width/2,height),world(length/2,-width/2,height)]);
  } else {
    steps=geometry.treads.length;
    const radius=stair.radius*NORM_W,sign=stair.direction==='clockwise'?1:-1;
    const prism=(name:string,raw:PlanPoint[],bottom:number,top:number)=>{
      const area=raw.reduce((sum,p,i)=>{const q=raw[(i+1)%raw.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
      const ring=area>0?raw:[...raw].reverse();
      add(name,ring.map(([x,y])=>world(x,y,top)),true);
      for(let j=0;j<ring.length;j++){const p=ring[j],q=ring[(j+1)%ring.length];
        add(`${name}-side-${j}`,[world(...p,bottom),world(...q,bottom),world(...q,top),world(...p,top)]);}
    };
    for(let i=0;i<steps;i++){
      const point=(k:number,r:number):PlanPoint=>{const a=(i+k)*2*Math.PI/steps*sign;return [Math.cos(a)*r,Math.sin(a)*r];};
      const ring=[...Array.from({length:9},(_,j)=>point(j/8,radius)),...Array.from({length:9},(_,j)=>point(1-j/8,radius*.18))];
      prism(`tread-${i+1}`,ring,Math.max(0,(i+.8)*height/steps),(i+1)*height/steps);
    }
    prism('centre-post',Array.from({length:32},(_,i)=>[Math.cos(i*Math.PI/16)*radius*.18,Math.sin(i*Math.PI/16)*radius*.18]),0,height);
  }
  parts.sort((a,b)=>a.depth-b.depth);
  const footprint=geometry.outline.map(p=>[p[0],p[1]] as PlanPoint);
  const points=[...footprint,...footprint.map(p=>unprojectFloorPoint(projectPlanPoint(p,height,camera),camera))];
  const left=Math.min(...points.map(p=>p[0]))-1,top=Math.min(...points.map(p=>p[1]))-1;
  const lightBox=[left,top,Math.max(...points.map(p=>p[0]))-left+1,Math.max(...points.map(p=>p[1]))-top+1] as const;
  const result={mesh:{parts,shadow:path(footprint),lightBox},footprint,height,steps,hit:parts.map(p=>p.top+' '+p.side).join(' ')};
  let cameras=cache.get(geometry);if(!cameras){cameras=new Map();cache.set(geometry,cameras);}cameras.set(camera,result);
  return result;
}
