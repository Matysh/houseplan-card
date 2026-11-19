/** Local #1451 visibility in the common projection. Remove only the portions
 * hidden by a nearer opaque face; never change plan coordinates or leaf poses.
 * A single average depth cannot order an open leaf crossing a long wall. */
import { isoFloorMatrix, projectPlanPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import type { IsoDeviceFace, IsoDeviceSurface, IsoOverlayPlacement } from './iso-overlays';
import type { IsoWallDepthQueueEntry } from './iso-scene-geometry';

type Point = [number,number];
type Polygon = Point[][];
type Multi = Polygon[];
type Plane = [number,number,number];
type Face = { entry: IsoWallDepthQueueEntry; geom: Multi; plane: Plane; bounds: number[]; opaque: boolean };
type ClipCoordinates = { point: (p: Point) => Point; height: (z: number) => number };
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
  // The extended clip edges can split a disjoint polygon into strips before
  // the last edge proves there was no intersection. Keep the original in
  // that case so later occluders do not process those artificial fragments.
  return inside.length ? out : [[subject]];
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
const path=(geom:Multi, restore?: (p: Point) => Point)=>geom.flatMap(poly=>poly.map(ring=>
  `M ${ring.map(p=>(restore ? restore(p) : p).map(v=>Number(v.toFixed(4))).join(' ')).join(' ')} Z`)).join(' ');

function faceOf(entry:IsoWallDepthQueueEntry,camera:IsoCamera, coordinates?: ClipCoordinates):Face|null {
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
  if (coordinates) {
    vertices = vertices.map(([x,y,z]) => [...coordinates.point([x,y]), coordinates.height(z)]);
    geom = geom.map(poly => poly.map(ring => ring.map(coordinates.point)));
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
interface FurnitureVisibility {clip:string | null; frontGlass:number[]}
let masks = new WeakMap<readonly PlanPoint[],{height:number; result:FurnitureVisibility}>();
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
  // Cut each occluder out of the same visible set. Unlike an even-odd
  // compound of overlapping silhouettes, the clip never reopens an overlap.
  const [x0,y0,x1,y1] = box;
  let visible: Multi = [[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]]];
  for (const [cover] of opaque) visible = visible.flatMap(([ring]) => subtractConvex(ring, cover));
  const result = {clip: opaque.length ? path(visible) : null, frontGlass};
  masks.set(footprint,{height,result});
  return result;
}

let deviceMasks=new WeakMap<IsoOverlayPlacement,IsoOverlayPlacement['wallMask']>();
let deviceQueue:readonly IsoWallDepthQueueEntry[]|undefined,deviceCamera:IsoCamera|undefined;
let deviceFaces:(Face|null)[]=[];
/** Glass occupies the wall-cut band. Solid faces additionally compare their
 * actual surface depth, so a wall behind a cap never cuts into its top. */
export function deviceWallOcclusion(queue:readonly IsoWallDepthQueueEntry[],camera:IsoCamera,
  placement:IsoOverlayPlacement,height:number):IsoOverlayPlacement['wallMask'] {
  const size=placement.deviceSize;
  if(!size)return undefined;
  if(queue!==deviceQueue||camera!==deviceCamera){
    deviceQueue=queue;deviceCamera=camera;deviceFaces=queue.map(entry=>faceOf(entry,camera));deviceMasks=new WeakMap();
  }
  if(deviceMasks.has(placement))return deviceMasks.get(placement);
  const lift=projectPlanPoint([0,0],0,camera)[1]-projectPlanPoint([0,0],1,camera)[1];
  const bottom=height-size*.24/lift,[cx,cy]=placement.visualScene,r=size*5,covered:Multi=[];
  const nearby:Face[]=[];
  for(const face of deviceFaces){
    if(!face?.opaque)continue;
    const [x0,y0,x1,y1]=face.bounds;
    if(x1<cx-r||x0>cx+r||y1<cy-r||y0>cy+r)continue;
    nearby.push(face);
    for(const [ring] of face.geom){
      const clipped=halfPlane(ring,[face.plane[0],face.plane[1],face.plane[2]-bottom]);
      if(clipped.length){if(area(clipped)<0)clipped.reverse();covered.push([clipped]);}
    }
  }
  const mask=path(covered);
  if(!mask){deviceMasks.set(placement,undefined);return undefined;}
  const [a,b,c,d]=isoFloorMatrix(camera),det=a*d-b*c,[x,y]=placement.visualScene;
  let lastFaces:readonly IsoDeviceFace[]|undefined,lastBody={body:'',occluded:''};
  const bodyMask=(faces:readonly IsoDeviceFace[])=>{
    if(faces===lastFaces)return lastBody;
    const caps:Point[][]=[],sides:{ring:Point[];plane:Plane}[]=[];
    for(const face of faces){
      const {left:l,right:r,top:t,bottom:bt,rx,ry}=face,cap:Point[]=[];
      // Match the real rounded DOM face, including fitted numeric pills and
      // badges. All coordinates come from the existing cached measure batch.
      for(let corner=0;corner<4;corner++)for(let step=0;step<=16;step++){
        const angle=(-90+corner*90+step*90/16)*Math.PI/180;
        const px=(corner<2?r-rx:l+rx)+Math.cos(angle)*rx;
        const py=(corner===0||corner===3?t+ry:bt-ry)+Math.sin(angle)*ry;
        cap.push([cx+(a*px+c*py)*size,cy+(b*px+d*py)*size]);
      }
      caps.push(cap);
      for(let i=0;i<cap.length;i++){
        const p=cap[i],q=cap[(i+1)%cap.length];
        if(q[0]>=p[0]-1e-8)continue; // only camera-facing vertical sides
        const lowP:Point=[p[0],p[1]+size*.24],lowQ:Point=[q[0],q[1]+size*.24];
        const plane=heightPlane([[...p,height],[...q,height],[...lowQ,bottom]]);
        if(plane)sides.push({ring:[p,q,lowQ,lowP],plane});
      }
    }
    const hidden:Multi=[];
    for(const side of sides)for(const wall of nearby){
      const delta=wall.plane.map((n,i)=>n-side.plane[i]) as Plane;
      for(const [ring] of wall.geom){
        let overlap=halfPlane(ring,[delta[0],delta[1],delta[2]-DEPTH_EPS]);
        const sign=Math.sign(area(side.ring));
        for(let i=0;i<side.ring.length&&overlap.length;i++){
          const p=side.ring[i],q=side.ring[(i+1)%side.ring.length];
          overlap=halfPlane(overlap,[(p[1]-q[1])*sign,(q[0]-p[0])*sign,(p[0]*q[1]-q[0]*p[1])*sign]);
        }
        if(!overlap.length)continue;
        // The cap is nearer than every side, including another badge's side.
        let visible:Multi=[[overlap]];
        for(const cap of caps)visible=visible.flatMap(poly=>subtractConvex(poly[0],cap));
        hidden.push(...visible);
      }
    }
    const solid:Multi=[...caps.map(cap=>[cap]),...sides.map(side=>[side.ring])];
    for(const geom of [solid,hidden])for(const [ring] of geom)if(area(ring)<0)ring.reverse();
    lastFaces=faces;return lastBody={body:path(solid),occluded:path(hidden)};
  };
  const glassMasks=new WeakMap<readonly IsoDeviceSurface[],string>();
  const structureFaces=deviceFaces;
  const glassMask=(surfaces:readonly IsoDeviceSurface[]):string=>{
    const cached=glassMasks.get(surfaces);if(cached!==undefined)return cached;
    const hidden:Multi=[];
    for(const surface of surfaces){
      const vertices=surface.map(([x,y,drop])=>[...projectPlanPoint([x,y],height,camera),height-drop/lift]);
      const ring=vertices.map(p=>[p[0],p[1]] as Point),plane=heightPlane(vertices);
      if(!plane)continue;
      const sign=Math.sign(area(ring));
      const bounds=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
      for(const wall of structureFaces){
        if(!wall?.opaque||wall.bounds[2]<bounds[0]||wall.bounds[0]>bounds[2]||wall.bounds[3]<bounds[1]||wall.bounds[1]>bounds[3])continue;
        const delta=wall.plane.map((n,i)=>n-plane[i]) as Plane;
        for(const [wallRing] of wall.geom){
          let overlap=halfPlane(wallRing,[delta[0],delta[1],delta[2]-DEPTH_EPS]);
          for(let i=0;i<ring.length&&overlap.length;i++){
            const p=ring[i],q=ring[(i+1)%ring.length];
            overlap=halfPlane(overlap,[(p[1]-q[1])*sign,(q[0]-p[0])*sign,(p[0]*q[1]-q[0]*p[1])*sign]);
          }
          if(overlap.length){if(area(overlap)<0)overlap.reverse();hidden.push([overlap]);}
        }
      }
    }
    const origin=projectPlanPoint([0,0],height,camera);
    const local=hidden.map(poly=>poly.map(ring=>ring.map(p=>{
      const x=p[0]-origin[0],y=p[1]-origin[1];return [(d*x-c*y)/det,(-b*x+a*y)/det] as Point;
    })));
    const result=path(local);glassMasks.set(surfaces,result);return result;
  };
  const result={path:mask,bodyMask,glassMask,transform:`matrix(${d/det/size} ${-b/det/size} ${-c/det/size} ${a/det/size} ${.5-(d*x-c*y)/det/size} ${.5-(-b*x+a*y)/det/size})`};
  deviceMasks.set(placement,result);return result;
}

let lastKey='',lastResult:readonly IsoWallDepthQueueEntry[]=[];
export function clipIsoOpeningDepthQueue(entries:readonly IsoWallDepthQueueEntry[],camera:IsoCamera,scale = 1):readonly IsoWallDepthQueueEntry[] {
  const key=JSON.stringify(camera)+`:${scale}:`+entries.map(e=>e.layer==='opening'
    ? [e.surface.id,e.surface.kind,e.surface.material,e.surface.leaf,e.surface.d].join(':')
    : e.layer+e.face.d).join('|');
  if(key===lastKey)return lastResult;
  // Resolve coincident edges in the same physical coordinate system for
  // coarse and fine grids. Subpixel differences otherwise create fragments.
  const [x0,y0]=projectPlanPoint([0,0],0,camera);
  const normalize = (value: number) => Math.round(value / scale * 1e6) / 1e6;
  const coordinates: ClipCoordinates = {
    point: ([x,y]) => [normalize(x-x0), normalize(y-y0)],
    height: normalize,
  };
  const restore = ([x,y]:Point): Point => [x*scale+x0,y*scale+y0];
  const faces=entries.map(e=>faceOf(e,camera,coordinates));
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
    const d=path(visible,restore);
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
