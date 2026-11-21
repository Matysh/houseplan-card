/** Shared #1451 volume renderer. Saved decor remains a flat, editable box. */
import type { FurnitureTransformBox } from './furniture';
import type {DecorFurniture} from './editors/decor/types';
import {workstationParts} from './iso-lab-workstation';
import {FURNITURE_VOLUME_RUNTIME} from './furniture-volume-runtime';
import type {FurniturePart} from './furniture-volume-types';
export type {FurniturePart} from './furniture-volume-types';
import { ISO_WALL_HEIGHT, isoRotationBasis, projectPlanPoint, unprojectFloorPoint,
  type IsoCamera, type PlanPoint } from './iso-projection';

const part = (name: string, x: number, y: number, w: number, h: number,
  bottom: number, top: number, radius = .06): FurniturePart =>
  ({ name, x, y, w, h, bottom, top, radius });
/** Heights come only from the generated annotated-SVG registry. */
export function furnitureParts(symbol: string): readonly FurniturePart[] | null {
  return FURNITURE_VOLUME_RUNTIME.parts(symbol);
}

/** Applies the native decor flip -> centered rotation contract without modifying it. */
export function furniturePlanPoint(shape: FurnitureTransformBox, point: PlanPoint,
  canvasW: number, canvasH: number): PlanPoint {
  const w=shape.w*canvasW, h=shape.h*canvasH;
  const x=((shape.flip_h ? 1-point[0] : point[0])-.5)*w;
  const y=((shape.flip_v ? 1-point[1] : point[1])-.5)*h;
  const angle=(Number(shape.angle)||0)*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle);
  return [(shape.x+shape.w/2)*canvasW+x*c-y*s,
    (shape.y+shape.h/2)*canvasH+x*s+y*c];
}

export function furnitureFootprint(p: FurniturePart, w: number, h: number): PlanPoint[] {
  if(p.profile==='polygon')return p.points!.map(([x,y])=>[x,y]);
  if(p.profile==='ellipse')return Array.from({length:32},(_,i)=>{
    const a=i*Math.PI/16;return [p.x+p.w/2+Math.cos(a)*p.w/2,p.y+p.h/2+Math.sin(a)*p.h/2];
  });
  const r=Math.min(p.radius*Math.min(w,h),p.w*w/2,p.h*h/2), rx=r/w, ry=r/h;
  const corners=[[p.x+p.w-rx,p.y+ry,-90],[p.x+p.w-rx,p.y+p.h-ry,0],
    [p.x+rx,p.y+p.h-ry,90],[p.x+rx,p.y+ry,180]];
  return corners.flatMap(([x,y,start]) => Array.from({length:9},(_,i) => {
    const a=(start+i*90/8)*Math.PI/180;
    return [x+rx*Math.cos(a),y+ry*Math.sin(a)] as PlanPoint;
  }));
}

const path = (points: readonly PlanPoint[]) =>
  points.length ? `M${points.map(p=>p.map(v=>Number(v.toFixed(4))).join(',')).join(' L')} Z` : '';

type VolumeVertex = readonly [number,number,number];
export interface FurnitureVolumeFace { cap: boolean; loops: VolumeVertex[][]; ring?:number; edge?:number; edgeCount?:number; }
/** Closed profile extrusion, with explicit through-hole walls. Coordinates stay local. */
export function furnitureVolumeFaces(p: FurniturePart, w: number, h: number, heightScale: number): FurnitureVolumeFace[] {
  const plane=p.plane||'xy',height=p.top-p.bottom;
  const iu=p.inset?(plane==='yz'?p.inset[1]/p.h:p.inset[0]/p.w):0;
  const iv=p.inset?(plane==='xy'?p.inset[1]/p.h:p.inset[2]/height):0;
  function profile(inner=false):PlanPoint[]{
    const left=inner?iu:0,up=inner?iv:0,right=1-left,down=1-up;
    if(p.profile==='polygon')return p.points!.map(([x,y])=>[(x-p.x)/p.w,(y-p.y)/p.h]);
    if(p.profile==='ellipse')return Array.from({length:32},(_,i)=>[.5+Math.cos(i*Math.PI/16)*(.5-left),.5+Math.sin(i*Math.PI/16)*(.5-up)]);
    const widthU=plane==='yz'?p.h*h:p.w*w,widthV=plane==='xy'?p.h*h:height*heightScale;
    const r=Math.min(p.radius*Math.min(w,h),widthU/2,widthV/2);
    const rx=Math.max(0,r/widthU-(inner?iu:0));
    const ry=Math.max(0,r/widthV-(inner?iv:0));
    if(rx===0||ry===0)return [[left,up],[right,up],[right,down],[left,down]];
    return [[right-rx,up+ry,-90],[right-rx,down-ry,0],[left+rx,down-ry,90],[left+rx,up+ry,180]]
      .flatMap(([x,y,start])=>Array.from({length:9},(_,i)=>{const a=(start+i*90/8)*Math.PI/180;return [x+rx*Math.cos(a),y+ry*Math.sin(a)] as PlanPoint;}));
  }
  // Capsule corners can share a vertex. Zero-length edges would split the
  // visible side into fragments and leave seams in the continuous band.
  const clean=(loop:PlanPoint[])=>loop.filter((p,i)=>{
    const previous=loop[(i+loop.length-1)%loop.length];
    return Math.hypot(p[0]-previous[0],p[1]-previous[1])>1e-10;
  });
  const outer=clean(profile()),inner=p.hole?clean(p.hole.map(([x,y])=>[(x-p.x)/p.w,(y-p.y)/p.h] as PlanPoint)).reverse():p.inset?clean(profile(true)).reverse():null;
  if(plane==='xz'){outer.reverse();inner?.reverse();}
  function vertex([u,v]:PlanPoint,far:boolean):VolumeVertex{
    if(plane==='xz')return [p.x+u*p.w,p.y+(far?p.h:0),p.bottom+v*height];
    if(plane==='yz')return [p.x+(far?p.w:0),p.y+u*p.h,p.bottom+v*height];
    const s=far?(p.topScale??1):(p.baseScale??1),offset=far?(p.topOffset??[0,0]):[0,0];
    return [p.x+(.5+(u-.5)*s+offset[0])*p.w,p.y+(.5+(v-.5)*s+offset[1])*p.h,far?p.top:p.bottom];
  }
  const loops=inner?[outer,inner]:[outer];
  const faces:FurnitureVolumeFace[]=[
    {cap:true,loops:loops.map(l=>l.map(p=>vertex(p,true)))},
    {cap:true,loops:loops.map(l=>l.slice().reverse().map(p=>vertex(p,false)))}];
  for(const [ring,loop] of loops.entries())for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length];
    faces.push({cap:false,ring,edge:i,edgeCount:loop.length,loops:[[vertex(a,false),vertex(b,false),vertex(b,true),vertex(a,true)]]});
  }
  return faces;
}

export interface FurnitureMeshPart { name: string; top: string; side: string; depth: number; lightPoint: PlanPoint; }
export interface FurnitureMesh { parts: FurnitureMeshPart[]; shadow: string; lightBox: readonly [number,number,number,number]; }
interface FurnitureVolume { mesh:FurnitureMesh; footprint:PlanPoint[]; height:number; }

/** Cutaway walls are intentionally low; furniture keeps recognisable proportions. */
export const FURNITURE_HEIGHT_SCALE = ISO_WALL_HEIGHT / 150;

export function furnitureViewDepth(shape: FurnitureTransformBox, canvasW: number, canvasH: number, camera: IsoCamera): number {
  const [cos,sin]=isoRotationBasis(camera);
  const [x,y]=furniturePlanPoint(shape,[.5,.5],canvasW,canvasH);
  return x*sin+y*cos;
}

export function tvCabinetSurfaceCm(): number {
  return furnitureParts('cabinet_tv')?.find(part => part.name === 'console-top')?.top ?? 0;
}

type FurnitureSubject = FurnitureTransformBox & Pick<DecorFurniture,'symbol'|'workstation'>;
const meshCache = new WeakMap<FurnitureSubject,{camera:IsoCamera; key:string; volume:FurnitureVolume}>();

export function furnitureMesh(shape: FurnitureSubject,
  canvasW: number, canvasH: number, camera: IsoCamera, visualScale=1, liftCm=0): FurnitureMesh | null {
  return furnitureVolume(shape,canvasW,canvasH,camera,visualScale,liftCm)?.mesh ?? null;
}

export function furnitureVolume(shape: FurnitureSubject,
  canvasW: number, canvasH: number, camera: IsoCamera, visualScale=1, liftCm=0): FurnitureVolume | null {
  const base=furnitureParts(shape.symbol);
  if (!base || ![shape.x,shape.y,shape.w,shape.h,Number(shape.angle ?? 0),canvasW,canvasH,visualScale,liftCm].every(Number.isFinite)
    || shape.w<=0 || shape.h<=0 || canvasW<=0 || canvasH<=0 || visualScale<=0) return null;
  const key = [shape.symbol,shape.workstation,shape.x,shape.y,shape.w,shape.h,shape.angle,shape.flip_h,shape.flip_v,
    canvasW,canvasH,visualScale,liftCm].join('|');
  const cached = meshCache.get(shape);
  if (cached?.camera === camera && cached.key === key) return cached.volume;
  const parts=shape.workstation ? workstationParts(shape,base,furnitureParts('computer') || []) : base;
  const [cos,sin]=isoRotationBasis(camera), scale=FURNITURE_HEIGHT_SCALE*visualScale;
  const lift = liftCm * scale;
  const elevation=(90-camera.tiltDeg)*Math.PI/180;
  const transform=(p:PlanPoint) => furniturePlanPoint(shape,p,canvasW,canvasH);
  // These paths live inside the existing floor matrix. Inverting that matrix
  // once lets z remain vertical on screen at every camera turn.
  const atHeight=(p:PlanPoint,z:number) => unprojectFloorPoint(projectPlanPoint(p,z+lift,camera),camera);
  const meshes=parts.map(p => {
    const center=transform([p.x+p.w/2,p.y+p.h/2]);
    const depth=(center[0]*sin+center[1]*cos)*Math.cos(elevation)+((p.bottom+p.top)/2*scale+lift)*Math.sin(elevation);
    if(p.profile||p.plane||p.inset||p.baseScale||p.topScale){
      const caps:string[]=[],sides:string[]=[];
      const bands=new Map<number,{count:number;edges:Map<number,PlanPoint[]>}>();
      for(const face of furnitureVolumeFaces(p,shape.w*canvasW,shape.h*canvasH,scale)){
        const loops=face.loops.map(loop=>{
          const vertices=loop.map(([x,y,z])=>atHeight(transform([x,y]),z*scale));
          return vertices;
        });
        const projected=loops[0].map(v=>projectPlanPoint(v,0,camera));
        const area=projected.reduce((sum,a,i)=>{const b=projected[(i+1)%projected.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
        if(area*(!!shape.flip_h!==!!shape.flip_v?-1:1)>1e-8){
          if(face.cap)caps.push(loops.map(path).join(' '));
          else {if(!bands.has(face.ring!))bands.set(face.ring!,{count:face.edgeCount!,edges:new Map()});bands.get(face.ring!)!.edges.set(face.edge!,loops[0]);}
        }
      }
      // Merge neighbouring visible strips: curved sides have no sampling seams.
      for(const {count,edges} of bands.values()){
        if(edges.size===count){
          const all=Array.from({length:count},(_,i)=>edges.get(i)!);
          sides.push(path(all.map(q=>q[0]))+' '+path(all.map(q=>q[3]).reverse()));continue;
        }
        for(const [start] of edges){
          if(edges.has((start+count-1)%count))continue;
          const run:PlanPoint[][]=[];let i=start;
          do{run.push(edges.get(i)!);i=(i+1)%count;}while(edges.has(i)&&i!==start);
          sides.push(path([run[0][0],...run.map(q=>q[1]),...run.slice().reverse().map(q=>q[2]),run[0][3]]));
        }
      }
      return {part:p,name:p.name,top:caps.join(' '),side:sides.join(' '),depth};
    }
    let footprint=furnitureFootprint(p,shape.w*canvasW,shape.h*canvasH).map(transform);
    if (!!shape.flip_h !== !!shape.flip_v) footprint=footprint.reverse();
    const top=footprint.map(v=>atHeight(v,p.top*scale));
    const bottom=footprint.map(v=>atHeight(v,p.bottom*scale));
    const visible=footprint.map((a,i) => {
      const b=footprint[(i+1)%footprint.length];
      return (b[1]-a[1])*sin-(b[0]-a[0])*cos > 1e-8;
    });
    // A convex rounded footprint has one continuous front band. Joining it
    // avoids vertical seams at every sample along its rounded corners.
    const start=visible.findIndex((v,i)=>v&&!visible[(i+visible.length-1)%visible.length]);
    const edge:number[]=[];
    if(start>=0){ let i=start; edge.push(i); do {
      i=(i+1)%visible.length; edge.push(i);
    } while(visible[i]&&i!==start); }
    return {part:p,name:p.name,top:path(top),side:path([...edge.map(i=>top[i]),...edge.slice().reverse().map(i=>bottom[i])]),
      depth};
  }).sort((a,b)=>a.depth-b.depth);
  // A cushion lies on its support even when its center is farther from the
  // camera. Center depth alone would paint the mattress over the pillows.
  const supports=(a:FurniturePart,b:FurniturePart) => a.top<=b.bottom+1e-8
    && a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
  const ordered:FurnitureMeshPart[]=[];
  while(meshes.length){
    const ready=meshes.findIndex(m=>!meshes.some(other=>other!==m && supports(other.part,m.part)));
    const [{part:source,...mesh}]=meshes.splice(ready<0?0:ready,1);
    ordered.push({...mesh, lightPoint: transform([source.x + source.w / 2, source.y + source.h / 2])});
  }
  // One compound silhouette avoids doubled opacity where parts overlap. Vertical
  // profiles cast their floor footprint, not an ellipse in the wrong plane.
  const shadow=parts.some(p=>p.profile)?parts.map(p=>{
    const footprint=p.plane&&p.plane!=='xy'?{...p,profile:'rect' as const,points:undefined,radius:0}:p;
    return path(furnitureFootprint(footprint,shape.w*canvasW,shape.h*canvasH).map(transform));
  }).join(' '):path(furnitureFootprint(part('shadow',.03,.03,.94,.94,0,0,.08),shape.w*canvasW,shape.h*canvasH).map(transform));
  const footprint = ([[0,0],[1,0],[1,1],[0,1]] as const).map(transform);
  const localHeight = Math.max(...parts.map(p=>p.top))*scale;
  const height = localHeight + lift;
  const corners = [...(lift ? footprint.map(p=>atHeight(p,0)) : footprint),...footprint.map(p=>atHeight(p,localHeight))];
  const xs=corners.map(p=>p[0]), ys=corners.map(p=>p[1]);
  const left=Math.min(...xs)-1, top=Math.min(...ys)-1;
  const lightBox = [left,top,Math.max(...xs)-left+1,Math.max(...ys)-top+1] as const;
  const volume = {mesh:{parts:ordered,shadow,lightBox},footprint,height};
  meshCache.set(shape,{camera,key,volume});
  return volume;
}
