/** Local #1451 visibility in the common projection. Remove only the portions
 * hidden by a nearer opaque face; never change plan coordinates or leaf poses.
 * A single average depth cannot order an open leaf crossing a long wall. */
import { projectPlanPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import type { IsoWallDepthQueueEntry } from './iso-scene-geometry';

type Point = [number,number];
type Polygon = Point[][];
type Multi = Polygon[];
type Plane = [number,number,number];
type Face = { entry: IsoWallDepthQueueEntry; geom: Multi; plane: Plane; bounds: number[]; opaque: boolean };
// Keep calculations at full precision. Rounding a face before comparing it
// with its own height plane creates false self-occlusion at shared edges.
const DEPTH_EPS=1e-5;

function heightPlane(vertices: readonly (readonly number[])[]): Plane | null {
  const p=vertices[0];
  for(let i=1;i<vertices.length-1;i++) {
    const q=vertices[i],r=vertices[i+1],u=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],v=[r[0]-p[0],r[1]-p[1],r[2]-p[2]];
    const det=u[0]*v[1]-u[1]*v[0];
    if(Math.abs(det)<1e-9) continue;
    const a=(u[2]*v[1]-u[1]*v[2])/det,b=(u[0]*v[2]-u[2]*v[0])/det;
    return [a,b,p[2]-a*p[0]-b*p[1]];
  }
  return null;
}
const at=(p:Plane,v:Point)=>p[0]*v[0]+p[1]*v[1]+p[2];
const area=(r:Point[])=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
function halfPlane(ring:Point[],plane:Plane,positive=true):Point[] {
  const out:Point[]=[];
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],da=at(plane,a)*(positive?1:-1),db=at(plane,b)*(positive?1:-1);
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)) {const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out.length>=3&&Math.abs(area(out))>1e-7?out:[];
}
function convex(ring:Point[]):boolean {
  const sign=Math.sign(area(ring));
  return ring.every((a,i)=>{const b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length];
    return ((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))*sign>=-1e-7;});
}
function subtractConvex(subject:Point[],clip:Point[]):Multi {
  const sign=Math.sign(area(clip)),out:Multi=[];let inside=subject;
  for(let i=0;i<clip.length&&inside.length;i++) {
    const a=clip[i],b=clip[(i+1)%clip.length];
    // A slab may close to a triangle with a repeated corner. A zero-length
    // edge has no half-plane: treating it as both inside and outside adds
    // duplicate polygons, which cancel with SVG's even-odd fill rule.
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-7)continue;
    const plane:Plane=[(a[1]-b[1])*sign,(b[0]-a[0])*sign,(a[0]*b[1]-b[0]*a[1])*sign];
    const outside=halfPlane(inside,plane,false);if(outside.length)out.push([outside]);
    inside=halfPlane(inside,plane);
  }
  return out;
}
/** Even-odd vertical slabs turn a wall cap, including courtyard holes, into
 * convex trapezoids. This local display operation never invokes or changes
 * the plan's boolean geometry kernel. */
function convexParts(poly:Polygon):Multi {
  if(poly.length===1&&convex(poly[0]))return [poly];
  const xs=[...new Set(poly.flat().map(p=>p[0]))].sort((a,b)=>a-b),out:Multi=[];
  for(let i=1;i<xs.length;i++) {
    const left=xs[i-1],right=xs[i];if(right-left<1e-7)continue;
    const mid=(left+right)/2,edges:{a:Point;b:Point;y:number}[]=[];
    for(const ring of poly)for(let j=0;j<ring.length;j++) {
      const a=ring[j],b=ring[(j+1)%ring.length];
      if(mid>Math.min(a[0],b[0])&&mid<Math.max(a[0],b[0]))
        edges.push({a,b,y:a[1]+(b[1]-a[1])*(mid-a[0])/(b[0]-a[0])});
    }
    edges.sort((a,b)=>a.y-b.y);
    const y=(edge:typeof edges[number],x:number)=>edge.a[1]+(edge.b[1]-edge.a[1])*(x-edge.a[0])/(edge.b[0]-edge.a[0]);
    for(let j=1;j<edges.length;j+=2) {
      const low=edges[j-1],high=edges[j];
      const ring:Point[]=[[left,y(low,left)],[right,y(low,right)],[right,y(high,right)],[left,y(high,left)]];
      if(Math.abs(area(ring))>1e-7)out.push([ring]);
    }
  }
  return out;
}
const path=(geom:Multi)=>geom.flatMap(poly=>poly.map(ring=>
  `M ${ring.map(p=>p.map(v=>Number(v.toFixed(4))).join(' ')).join(' L ')} Z`)).join(' ');

function faceOf(entry:IsoWallDepthQueueEntry,camera:IsoCamera):Face|null {
  let geom:Multi,vertices:number[][],opaque=true;
  if(entry.layer==='wall-top') {
    const f=entry.face;if(!f.projectedRings||f.height===undefined)return null;
    geom=[f.projectedRings.map(r=>r.map(p=>[p[0],p[1]] as Point))];
    vertices=geom[0][0].map(p=>[...p,f.height!]);
  } else if(entry.layer==='wall-side') {
    const f=entry.face;if(f.height===undefined)return null;
    geom=[[f.points.map(p=>[p[0],p[1]] as Point)]];
    vertices=geom[0][0].map((p,i)=>[...p,i<2?0:f.height!]);
  } else {
    const s=entry.surface;if(!s.points)return null;
    vertices=s.points.map(p=>[...projectPlanPoint(p.point,p.z,camera),p.z]);
    geom=[[vertices.map(p=>[p[0],p[1]] as Point)]];
    opaque=!['glass-side','glass-top','glass-over-fabric','light-window'].includes(s.material);
  }
  const plane=heightPlane(vertices);if(!plane)return null;
  geom=geom.flatMap(convexParts);
  const flat=geom.flat(2);
  return {entry,geom,plane,opaque,bounds:[Math.min(...flat.map(p=>p[0])),Math.min(...flat.map(p=>p[1])),
    Math.max(...flat.map(p=>p[0])),Math.max(...flat.map(p=>p[1]))]};
}

/** Clip a convex screen rectangle to the region where an occluder is nearer.
 * At a common screen pixel the camera ray travels towards increasing Z. */
function nearerRegion(bounds:number[],plane:Plane):Point[] {
  const [x0,y0,x1,y1]=bounds;
  const ring:Point[]=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],out:Point[]=[];
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],da=at(plane,a)-DEPTH_EPS,db=at(plane,b)-DEPTH_EPS;
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)) {const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
}

export function transparentSurface(entry:IsoWallDepthQueueEntry) {
  return entry.layer==='opening' && ['glass-side','glass-top','glass-over-fabric','light-window'].includes(entry.surface.material);
}

let cachedQueue: readonly IsoWallDepthQueueEntry[] | undefined;
let cachedCamera: IsoCamera | undefined;
let cachedFaces: (Face | null)[] = [];
interface FurnitureMask {box:number[]; mask:string; frontGlass:number[]}
let masks = new WeakMap<readonly PlanPoint[],{height:number; result:FurnitureMask}>();
/** At a common screen x, compare floor depth on a line inside the furniture
 * footprint with floor depth reconstructed from each structural face. A long
 * wall can cross the item's screen bounds while standing entirely behind it. */
export function furnitureOcclusion(queue: readonly IsoWallDepthQueueEntry[], camera: IsoCamera,
  footprint: readonly PlanPoint[], height: number) {
  if (queue !== cachedQueue || camera !== cachedCamera) {
    cachedFaces = queue.map(entry=>faceOf(entry,camera));
    cachedQueue = queue; cachedCamera = camera;
    masks = new WeakMap();
  }
  const cached = masks.get(footprint);
  if (cached?.height === height) return cached.result;
  const points = footprint.map(p=>projectPlanPoint(p,0,camera)).sort((a,b)=>a[0]-b[0]);
  const left = points[0][0], right = points[points.length-1][0];
  const edgeY = (x:number) => {
    const edge = points.filter(p=>Math.abs(p[0]-x)<1e-7);
    return edge.reduce((sum,p)=>sum+p[1],0)/edge.length;
  };
  const slope = (edgeY(right)-edgeY(left))/Math.max(right-left,1e-7);
  const intercept = edgeY(left)-slope*left;
  const lift = projectPlanPoint([0,0],0,camera)[1]-projectPlanPoint([0,0],1,camera)[1];
  const box = [left-2,Math.min(...points.map(p=>p[1]))-height*lift-2,right+2,Math.max(...points.map(p=>p[1]))+2];
  const opaque: Multi = [], frontGlass: number[] = [];
  cachedFaces.forEach((face,index)=>{
    if (!face) return;
    const [x0,y0,x1,y1] = face.bounds;
    if (x1<box[0] || y1<box[1] || x0>box[2] || y0>box[3]) return;
    const [a,b,c] = face.plane;
    const plane: Plane = [lift*a-slope,1+lift*b,lift*c-intercept-DEPTH_EPS];
    for (const [ring] of face.geom) {
      const within = halfPlane(halfPlane(ring,[1,0,-box[0]]),[-1,0,box[2]]);
      const near = halfPlane(within,plane);
      if (!near.length) continue;
      if (!face.opaque) { frontGlass.push(index); break; }
      if (area(near)<0) near.reverse();
      opaque.push([near]);
    }
  });
  const result = {box, mask:path(opaque), frontGlass};
  masks.set(footprint,{height,result});
  return result;
}

let lastKey='',lastResult:readonly IsoWallDepthQueueEntry[]=[];
export function clipIsoOpeningDepthQueue(entries:readonly IsoWallDepthQueueEntry[],camera:IsoCamera):readonly IsoWallDepthQueueEntry[] {
  const key=JSON.stringify(camera)+entries.map(e=>e.layer==='opening'
    ? [e.surface.id,e.surface.kind,e.surface.material,e.surface.leaf,e.surface.d].join(':')
    : e.layer+e.face.d).join('|');
  if(key===lastKey)return lastResult;
  const faces=entries.map(e=>faceOf(e,camera));
  const result=entries.flatMap((entry,i)=>{
    // Structural caps share H, the highest plane in this model. Keep their
    // original even-odd contours; their trapezoids are only used as occluders.
    if(entry.layer==='wall-top')return [entry];
    const face=faces[i];if(!face)return [entry];
    let visible=face.geom;
    for(let j=0;j<faces.length&&visible.length;j++) {
      const other=faces[j];if(i===j||!other?.opaque)continue;
      const a=face.bounds,b=other.bounds;
      const overlap=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
      if(overlap[2]-overlap[0]<1e-6||overlap[3]-overlap[1]<1e-6)continue;
      let delta=other.plane.map((n,k)=>n-face.plane[k]) as Plane;
      // The structural cut end and its upper reveal are the same plane.
      // Prefer the reveal finish only in that overlap, from sill upward.
      if(entry.layer==='wall-side'&&other.entry.layer==='opening'
        &&other.entry.surface.kind==='jamb-reveal'
        &&Math.abs(delta[0])<1e-8&&Math.abs(delta[1])<1e-8&&Math.abs(delta[2])<DEPTH_EPS)
        delta=[0,0,1];
      const region=nearerRegion(overlap,delta);if(region.length<3)continue;
      for(const poly of other.geom) {
        const nearer=halfPlane(poly[0],[delta[0],delta[1],delta[2]-DEPTH_EPS]);
        if(nearer.length) visible=visible.flatMap(part=>subtractConvex(part[0],nearer));
      }
    }
    if(!visible.length)return [];
    const d=path(visible);
    return [entry.layer==='opening'?{...entry,surface:{...entry.surface,d}}:{...entry,face:{...entry.face,d}}] as IsoWallDepthQueueEntry[];
  });
  // Transparent faces have already been clipped by every nearer opaque
  // surface. Composite their remaining pixels after the opaque pass: a sill
  // behind glass must be tinted on every sash, regardless of painter slots.
  // The front part of the sill stays white because it clipped the glass.
  lastKey=key;lastResult=Object.freeze([
    ...result.filter(entry=>!transparentSurface(entry)),...result.filter(transparentSurface),
  ]);return lastResult;
}
