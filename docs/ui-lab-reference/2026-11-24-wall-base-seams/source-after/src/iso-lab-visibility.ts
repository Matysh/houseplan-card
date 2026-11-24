/** Local #1451 visibility in the common projection. Remove only the portions
 * hidden by a nearer opaque face; never change plan coordinates or leaf poses.
 * A single average depth cannot order an open leaf crossing a long wall. */
import { isoFloorMatrix, isoHeightLift, isoProjectedDepth, projectPlanPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import type { IsoDeviceFace, IsoDeviceOcclusion, IsoDeviceSurface, IsoDeviceWallMask, IsoOverlayPlacement } from './iso-overlays';
import type { IsoWallDepthQueueEntry } from './iso-scene-geometry';
import { union } from 'polyclip-ts';
import { lruRead, lruWrite } from './card-runtime';

type Point = [number,number];
type Polygon = Point[][];
type Multi = Polygon[];
type Plane = [number,number,number];
type Face = { entry: IsoWallDepthQueueEntry; geom: Multi; plane: Plane; bounds: number[]; opaque: boolean };
type ClipCoordinates = {
  point: (p: Point) => Point;
  height: (z: number) => number;
  vertex: (p: Point) => Point;
  depth: (z: number) => number;
};
// Keep calculations at full precision. Rounding a face before comparing it
// with its own height plane creates false self-occlusion at shared edges.
const DEPTH_EPS=1e-5;

function depthClipCoordinates(camera: IsoCamera, scale: number) {
  const [x0,y0] = projectPlanPoint([0,0],0,camera);
  const snap = (value: number) => Math.round(value * 1e6) / 1e6;
  const vertex = ([x,y]:Point):Point => [(x-x0)/scale,(y-y0)/scale];
  const coordinates: ClipCoordinates = {
    point: p => vertex(p).map(snap) as Point,
    height: z => snap(z/scale),
    vertex,
    depth: z => z/scale,
  };
  const restore = ([x,y]:Point):Point => [x*scale+x0,y*scale+y0];
  return {coordinates,restore};
}

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

function depthPaintContours(geom: Multi): Multi {
  if (geom.length < 2) return geom;
  // These are working partitions of one physical face. Merge them before
  // SVG paints their shared edges. Snap only in normalized paint coordinates.
  const vertices = geom.flat(2);
  const snap = ([x,y]:Point):Point => [Number(x.toFixed(6)), Number(y.toFixed(6))];
  const edgeEpsilon = 1e-9;
  const snapped = geom.map(poly => poly.map(ring => ring.flatMap((start, index) => {
    const end = ring[(index+1)%ring.length];
    const dx = end[0]-start[0], dy = end[1]-start[1];
    const length = Math.hypot(dx,dy);
    if (length <= edgeEpsilon) return [snap(start)];
    // Split the long side of each T-junction before snapping. Rounding a
    // short edge and its unsplit neighbour independently opens a thin gap.
    const splits: {distance: number; point: Point}[] = [];
    for (const point of vertices) {
      const x = point[0]-start[0], y = point[1]-start[1];
      const distance = (x*dx+y*dy)/length;
      if (distance <= edgeEpsilon || distance >= length-edgeEpsilon) continue;
      if (Math.abs(x*dy-y*dx) > length*edgeEpsilon) continue;
      splits.push({distance, point});
    }
    return [snap(start), ...splits.sort((a,b) => a.distance-b.distance).map(({point}) => snap(point))];
  })));
  try {
    const contours = union(snapped);
    if (!contours.length) return geom;
    return contours.map(([outer,...holes]) => [outer,...holes.filter(hole => {
      const perimeter = hole.reduce((sum, [x,y], i) => {
        const [nextX,nextY] = hole[(i+1)%hole.length];
        return sum + Math.hypot(nextX-x,nextY-y);
      },0);
      // Intersections that straddle a rounding grid line can leave a zero-
      // width hole after SVG path rounding. Genuine cutouts survive this.
      return Math.abs(area(hole)) > perimeter * 1e-6;
    })]);
  } catch {
    // A numerically degenerate union must not remove the face or stop paint.
    return geom;
  }
}

function faceOf(entry:IsoWallDepthQueueEntry,camera:IsoCamera, coordinates?: ClipCoordinates):Face|null {
  let geom:Multi,vertices:number[][],opaque=true;
  if(entry.layer==='wall-top') {
    const f=entry.face;if(!f.projectedRings||f.height===undefined)return null;
    geom=[f.projectedRings.map(r=>r.map(p=>[p[0],p[1]] as Point))];
    vertices=geom[0][0].map(p=>[...p,f.height!]);
  } else if(entry.layer==='wall-side') {
    const f=entry.face;if(f.height===undefined)return null;
    geom=[[f.points.map(p=>[p[0],p[1]] as Point)]];
    vertices=geom[0][0].map((p,i)=>[...p,i<2?(f.baseHeight ?? 0):f.height!]);
  } else {
    const s=entry.surface;if(!s.points)return null;
    vertices=s.points.map(p=>[...projectPlanPoint(p.point,p.z,camera),p.z]);
    geom=[[vertices.map(p=>[p[0],p[1]] as Point)]];
    opaque=!['glass-side','glass-top','glass-over-fabric','light-window'].includes(s.material);
  }
  if (camera.perspective) {
    vertices = vertices.map(([x,y,z]) => [x,y,isoProjectedDepth([x,y],z,camera)]);
  }
  if (coordinates) {
    // Keep the perspective plane coefficients independent of polygon snapping.
    // Rounding even a tiny sliver's vertices can tilt a coplanar face.
    vertices = vertices.map(([x,y,z]) => camera.perspective
      ? [...coordinates.vertex([x,y]), coordinates.depth(z)]
      : [...coordinates.point([x,y]), coordinates.height(z)]);
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
  const lift = isoHeightLift(camera,1);
  const top = Math.min(...footprint.map(p=>projectPlanPoint(p,height,camera)[1]));
  const box = [left-2,top-2,right+2,Math.max(...points.map(p=>p[1]))+2];
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

const DEVICE_OCCLUSION_SCENE_CACHE_LIMIT = 4;
const DEVICE_WALL_MASK_CACHE_LIMIT = 512;
const DEVICE_GLASS_MASK_CACHE_LIMIT = 4;
type DeviceOcclusionScene = { faces: Face[]; masks: Map<string, IsoDeviceWallMask> };
const deviceOcclusionScenes = new Map<string, DeviceOcclusionScene>();
let lastDeviceOcclusionScene: {
  queue: readonly IsoWallDepthQueueEntry[];
  camera: IsoCamera;
  scene: DeviceOcclusionScene;
} | undefined;

function deviceOcclusionScene(queue: readonly IsoWallDepthQueueEntry[], camera: IsoCamera): DeviceOcclusionScene {
  if (lastDeviceOcclusionScene?.queue === queue && lastDeviceOcclusionScene.camera === camera) {
    return lastDeviceOcclusionScene.scene;
  }
  // The painters can reconstruct the same occluders after a zoom or floor
  // change. Use the coordinates, heights and cut kind read by the mask.
  const opaque = queue.filter(entry => !transparentSurface(entry));
  const key = JSON.stringify([camera, opaque.map(entry => {
    if (entry.layer === 'wall-top') return [entry.layer, entry.face.projectedRings, entry.face.height];
    if (entry.layer === 'wall-side') return [entry.layer, entry.face.points, entry.face.baseHeight, entry.face.height];
    return [entry.layer, entry.surface.kind, entry.surface.points];
  })]);
  const cached = lruRead(deviceOcclusionScenes, key);
  const scene = cached.hit ? cached.value : {
    faces: opaque.map(entry => faceOf(entry, camera)).filter((face): face is Face => face !== null),
    masks: new Map<string, IsoDeviceWallMask>(),
  };
  if (!cached.hit) lruWrite(deviceOcclusionScenes, key, scene, DEVICE_OCCLUSION_SCENE_CACHE_LIMIT);
  lastDeviceOcclusionScene = {queue, camera, scene};
  return scene;
}
const noDeviceOcclusion: IsoDeviceOcclusion = {occluded:'',cut:''};

function wallCutAtHeight({entry}:Face,height:number):boolean {
  return entry.layer==='wall-top' ? entry.face.height===height
    : entry.layer==='opening' && entry.surface.kind==='opening-lintel-top' && entry.surface.points?.[0]?.z===height;
}

function wallCutRing(ring:Point[],[left,top,right,bottom]:number[]):Point[] {
  const horizontal=halfPlane(halfPlane(ring,[1,0,-left]),[-1,0,right]);
  return halfPlane(halfPlane(horizontal,[0,1,-top]),[0,-1,bottom]);
}

function deviceOccluder(wall: Face, ring: Point[], plane: Plane, margin=0): Multi {
  const delta=wall.plane.map((n,i)=>n-plane[i]) as Plane;
  const sign=Math.sign(area(ring));
  const result: Multi=[];
  for(const [wallRing] of wall.geom) {
    let overlap=halfPlane(wallRing,[delta[0],delta[1],delta[2]-DEPTH_EPS]);
    for(let i=0;i<ring.length&&overlap.length;i++) {
      const p=ring[i],q=ring[(i+1)%ring.length];
      const padding=margin ? margin*Math.hypot(q[0]-p[0],q[1]-p[1]) : 0;
      overlap=halfPlane(overlap,[(p[1]-q[1])*sign,(q[0]-p[0])*sign,(p[0]*q[1]-q[0]*p[1])*sign+padding]);
    }
    if(overlap.length) {
      if(area(overlap)<0)overlap.reverse();
      result.push([overlap]);
    }
  }
  return result;
}

/** A near opaque cut hides the body; a side wall leaves residual visibility.
 * Limit body occlusion to its measured extruded faces and preserve the caps. */
export function deviceWallOcclusion(queue:readonly IsoWallDepthQueueEntry[],camera:IsoCamera,
  placement:IsoOverlayPlacement,height:number):IsoOverlayPlacement['wallMask'] {
  const size=placement.deviceSize;
  if(!size)return undefined;
  const {faces:structureFaces,masks:deviceMasks} = deviceOcclusionScene(queue, camera);
  if (!structureFaces.length) return undefined;
  // A new placement object can describe the same measured device. Membership
  // and labels are irrelevant to its projection and physical occlusion.
  const [cx,cy] = placement.visualScene;
  const floorAnchor: PlanPoint = [placement.floorAnchor[0], placement.floorAnchor[1]];
  const key = JSON.stringify([cx,cy,floorAnchor,size,height]);
  const cached = lruRead(deviceMasks, key);
  if (cached.hit) return cached.value;
  const lift=isoHeightLift(camera,1),r=size*5;
  const minBodyDepth=isoProjectedDepth([cx,cy-r],height,camera)-size*.24/lift;
  const nearby:Face[]=[];
  for(const face of structureFaces){
    const [x0,y0,x1,y1]=face.bounds;
    if(x1<cx-r||x0>cx+r||y1<cy-r||y0>cy+r)continue;
    if(face.geom.some(([ring])=>ring.some(p=>at(face.plane,p)>minBodyDepth))) nearby.push(face);
  }
  const [a,b,c,d]=isoFloorMatrix(camera),det=a*d-b*c;
  let lastFaces:readonly IsoDeviceFace[]|undefined,lastBody=noDeviceOcclusion,lastFacesKey='';
  const bodyMask=(faces:readonly IsoDeviceFace[])=>{
    if(!nearby.length)return noDeviceOcclusion;
    if(faces===lastFaces)return lastBody;
    const facesKey = JSON.stringify(faces.map(({left,top,right,bottom,rx,ry,angle}) =>
      [left,top,right,bottom,rx,ry,angle ?? 0]));
    if (facesKey === lastFacesKey) {
      lastFaces = faces;
      return lastBody;
    }
    const caps:Point[][]=[],sides:{ring:Point[];plane:Plane}[]=[];
    for(const face of faces){
      const {left:l,right:r,top:t,bottom:bt,rx,ry,angle:turn=0}=face,cap:Point[]=[];
      const cos=Math.cos(turn),sin=Math.sin(turn),ox=(l+r)/2,oy=(t+bt)/2;
      // Match the real rounded DOM face, including fitted numeric pills and
      // badges. All coordinates come from the existing cached measure batch.
      for(let corner=0;corner<4;corner++)for(let step=0;step<=16;step++){
        const angle=(-90+corner*90+step*90/16)*Math.PI/180;
        const px=(corner<2?r-rx:l+rx)+Math.cos(angle)*rx;
        const py=(corner===0||corner===3?t+ry:bt-ry)+Math.sin(angle)*ry;
        const u=ox+cos*(px-ox)-sin*(py-oy),v=oy+sin*(px-ox)+cos*(py-oy);
        cap.push([cx+(a*u+c*v)*size,cy+(b*u+d*v)*size]);
      }
      caps.push(cap);
      for(let i=0;i<cap.length;i++){
        const p=cap[i],q=cap[(i+1)%cap.length];
        if(q[0]>=p[0]-1e-8)continue; // only camera-facing vertical sides
        const lowP:Point=[p[0],p[1]+size*.24],lowQ:Point=[q[0],q[1]+size*.24];
        const pDepth=isoProjectedDepth(p,height,camera),qDepth=isoProjectedDepth(q,height,camera);
        const plane=heightPlane([[...p,pDepth],[...q,qDepth],[...lowQ,qDepth-size*.24/lift]]);
        if(plane)sides.push({ring:[p,q,lowQ,lowP],plane});
      }
    }
    const hidden:Multi=[],cut:Multi=[];
    for(const side of sides)for(const wall of nearby){
      const top=masonrySurface(wall.entry)==='top';
      // Include the painted edge at the rounded body perimeter. Padding the
      // body leaves the wall silhouette and nearby status indicators intact.
      let visible=deviceOccluder(wall,side.ring,side.plane,top ? size*.025 : 0);
      // The device cap is nearer than every device side, including another badge's side.
      for(const cap of caps)visible=visible.flatMap(poly=>subtractConvex(poly[0],cap));
      (top ? cut : hidden).push(...visible);
    }
    lastFaces=faces;
    lastFacesKey=facesKey;
    return lastBody={occluded:path(hidden),cut:path(cut)};
  };
  const glassMasks = new Map<string, IsoDeviceOcclusion>();
  const glassMask=(surfaces:readonly IsoDeviceSurface[],origin=floorAnchor):IsoDeviceOcclusion=>{
    const [anchorX,anchorY]=origin;
    const glassKey = JSON.stringify([anchorX,anchorY,surfaces]);
    const cachedGlass = lruRead(glassMasks, glassKey);
    if (cachedGlass.hit) return cachedGlass.value;
    const hidden:Multi=[],cut:Multi=[];
    const levelCuts=new Set<Face>();
    const envelope=[Infinity,Infinity,-Infinity,-Infinity],margin=size*.12;
    for(const surface of surfaces){
      const vertices=surface.map(([x,y,drop])=>{
        const u=x-anchorX,v=y-anchorY;
        // The SVG is embedded in the marker's local affine frame at the
        // projected anchor. Its vertices must follow that same paint transform.
        const point:Point=[cx+a*u+c*v,cy+b*u+d*v];
        return [...point,isoProjectedDepth([point[0],point[1]-drop],height,camera)-drop/lift];
      });
      const ring=vertices.map(p=>[p[0],p[1]] as Point),plane=heightPlane(vertices);
      if(!plane)continue;
      const bounds=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
      envelope[0]=Math.min(envelope[0],bounds[0]);envelope[1]=Math.min(envelope[1],bounds[1]);
      envelope[2]=Math.max(envelope[2],bounds[2]);envelope[3]=Math.max(envelope[3],bounds[3]);
      for(const wall of structureFaces){
        if(wallCutAtHeight(wall,height)){
          if(wall.bounds[2]>=bounds[0]-margin&&wall.bounds[0]<=bounds[2]+margin&&
            wall.bounds[3]>=bounds[1]-margin&&wall.bounds[1]<=bounds[3]+margin)levelCuts.add(wall);
          continue;
        }
        const stroke=size*.025;
        if(wall.bounds[2]<bounds[0]-stroke||wall.bounds[0]>bounds[2]+stroke
          ||wall.bounds[3]<bounds[1]-stroke||wall.bounds[1]>bounds[3]+stroke)continue;
        // Include the rim stroke outside the side polygon in the wall cut.
        (masonrySurface(wall.entry)==='top' ? cut : hidden).push(...deviceOccluder(wall,ring,plane,stroke));
      }
    }
    // The upper/lower glass rims are CSS strokes beyond their side polygons.
    // Include their paint in the same level cut.
    const bounds=envelope.map((n,i)=>n+(i<2?-margin:margin));
    for(const wall of levelCuts)for(const [ring] of wall.geom){
      const cover=wallCutRing(ring,bounds);
      if(cover.length){
        if(area(cover)<0)cover.reverse();
        cut.push([cover]);
      }
    }
    const local=([x,y]:Point):Point=>[anchorX+(d*(x-cx)-c*(y-cy))/det,anchorY+(-b*(x-cx)+a*(y-cy))/det];
    const result={occluded:path(hidden,local),cut:path(cut,local)};
    lruWrite(glassMasks, glassKey, result, DEVICE_GLASS_MASK_CACHE_LIMIT);
    return result;
  };
  const result={bodyMask,glassMask,transform:`matrix(${d/det/size} ${-b/det/size} ${-c/det/size} ${a/det/size} ${.5-(d*cx-c*cy)/det/size} ${.5-(-b*cx+a*cy)/det/size})`};
  lruWrite(deviceMasks, key, result, DEVICE_WALL_MASK_CACHE_LIMIT);
  return result;
}

let lastKey='',lastResult:readonly IsoWallDepthQueueEntry[]=[];
export function clipIsoOpeningDepthQueue(entries:readonly IsoWallDepthQueueEntry[],camera:IsoCamera,scale = 1):readonly IsoWallDepthQueueEntry[] {
  const key=JSON.stringify(camera)+`:${scale}:`+entries.map(e=>e.layer==='opening'
    ? [e.surface.id,e.surface.kind,e.surface.material,e.surface.leaf,e.surface.d].join(':')
    : e.layer+e.face.d).join('|');
  if(key===lastKey)return lastResult;
  // Resolve coincident edges in the same physical coordinate system for
  // coarse and fine grids. Subpixel differences otherwise create fragments.
  const {coordinates,restore}=depthClipCoordinates(camera,scale);
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
        &&other.geom.every(([ring])=>ring.every(point=>Math.abs(at(delta,point))<DEPTH_EPS)))
        delta=[0,0,1];
      const region=nearerRegion(overlap,delta);if(region.length<3)continue;
      for(const poly of other.geom) {
        const nearer=halfPlane(poly[0],[delta[0],delta[1],delta[2]-DEPTH_EPS]);
        if(nearer.length) visible=visible.flatMap(part=>subtractConvex(part[0],nearer));
      }
    }
    if(!visible.length)return [];
    const d=path(entry.layer === 'opening' && !masonrySurface(entry)
      ? depthPaintContours(visible) : visible,restore);
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

/** Opacity is a material property, independent of the physical wall model. */
export interface IsoMasonryOpacity { side: number; top: number }

export function masonrySurface(entry: IsoWallDepthQueueEntry): keyof IsoMasonryOpacity | undefined {
  if (entry.layer === 'wall-side' || (entry.layer === 'opening' && entry.surface.material === 'wall-side')) return 'side';
  if (entry.layer === 'wall-top' || (entry.layer === 'opening' && entry.surface.material === 'wall-top')) return 'top';
  return undefined;
}

export interface IsoDepthFurniture {
  footprint: readonly PlanPoint[];
  height: number;
}

type DepthSurface = Pick<Face, 'geom' | 'plane' | 'bounds' | 'opaque'>;
export interface IsoDepthFragment {
  index: number;
  d: string;
}

type RankedFragment = {index:number; rank:number; geom:Multi};

/** Paint a surface only once whenever the actual overlapping pixels admit a
 * whole-surface order. A rank change caused by an unrelated furniture envelope
 * is not a material edge. Only genuine order cycles retain partitioned paint. */
function coalesceDepthPaint(fragments: RankedFragment[], faces:(DepthSurface|null)[]): RankedFragment[] {
  const groups = new Map<number,RankedFragment[]>();
  for(const fragment of fragments) {
    const group=groups.get(fragment.index);
    if(group)group.push(fragment); else groups.set(fragment.index,[fragment]);
  }
  const ids=[...groups.keys()], edges=new Map(ids.map(id=>[id,new Set<number>()]));
  const geometry=new Map(ids.map(id=>[id,groups.get(id)!.flatMap(part=>part.geom)]));
  const intersection=(subject:Point[],clip:Point[]):Point[]=>{
    const sign=Math.sign(area(clip)); let inside=subject;
    for(let i=0;i<clip.length&&inside.length;i++) {
      const a=clip[i],b=clip[(i+1)%clip.length];
      if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-7)continue;
      inside=halfPlane(inside,[(a[1]-b[1])*sign,(b[0]-a[0])*sign,(a[0]*b[1]-b[0]*a[1])*sign]);
    }
    return inside;
  };
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++) {
    const left=ids[i],right=ids[j],a=faces[left]!,b=faces[right]!;
    if(Math.min(a.bounds[2],b.bounds[2])-Math.max(a.bounds[0],b.bounds[0])<1e-6 ||
       Math.min(a.bounds[3],b.bounds[3])-Math.max(a.bounds[1],b.bounds[1])<1e-6)continue;
    const delta=b.plane.map((n,k)=>n-a.plane[k]) as Plane;
    let nearer=false,farther=false,overlaps=false;
    for(const [subject] of geometry.get(left)!)for(const [clip] of geometry.get(right)!) {
      const overlap=intersection(subject,clip);
      if(!overlap.length)continue;
      overlaps=true;
      const depths=overlap.map(point=>at(delta,point));
      if(Math.max(...depths)>DEPTH_EPS)nearer=true;
      if(Math.min(...depths)<-DEPTH_EPS)farther=true;
    }
    if(overlaps&&!nearer&&!farther)nearer=true; // stable order on coincident planes
    if(nearer)edges.get(left)!.add(right);
    if(farther)edges.get(right)!.add(left);
  }
  // Collapse strongly connected components; their internal rank order remains
  // authoritative, while unrelated walls/furniture need no artificial cuts.
  let serial=0;
  const numbers=new Map<number,number>(),low=new Map<number,number>(),stack:number[]=[],active=new Set<number>();
  const components:number[][]=[];
  const visit=(id:number)=>{
    numbers.set(id,serial);low.set(id,serial++);stack.push(id);active.add(id);
    for(const next of edges.get(id)!) {
      if(!numbers.has(next)){visit(next);low.set(id,Math.min(low.get(id)!,low.get(next)!));}
      else if(active.has(next))low.set(id,Math.min(low.get(id)!,numbers.get(next)!));
    }
    if(low.get(id)!==numbers.get(id))return;
    const component:number[]=[];let next:number;
    do {next=stack.pop()!;active.delete(next);component.push(next);} while(next!==id);
    components.push(component);
  };
  for(const id of ids)if(!numbers.has(id))visit(id);
  // Tarjan emits sink components first; the painter needs far to near.
  return components.reverse().flatMap(component=>component.length===1
    ? [{index:component[0],rank:0,geom:geometry.get(component[0])!}]
    : component.flatMap(id=>groups.get(id)!).sort((a,b)=>b.rank-a.rank||a.index-b.index));
}

function furnitureDepthSurface(item: IsoDepthFurniture, camera: IsoCamera, coordinates: ClipCoordinates): DepthSurface | null {
  const points = item.footprint.map(p => projectPlanPoint(p, 0, camera)).sort((a,b) => a[0]-b[0]);
  const left = points[0], right = points[points.length-1];
  if (!left || !right || right[0] - left[0] < 1e-7) return null;
  const floorY = (x: number) => {
    const atX = points.filter(p => Math.abs(p[0]-x) < 1e-7);
    return atX.reduce((sum, p) => sum+p[1], 0)/atX.length;
  };
  const lift = isoHeightLift(camera,1);
  const minY = Math.min(...item.footprint.map(p => projectPlanPoint(p,item.height,camera)[1])) - 2;
  const maxY = Math.max(...points.map(p => p[1])) + 2;
  const [x0,y0] = coordinates.point([left[0]-2,minY]);
  const [x1,y1] = coordinates.point([right[0]+2,maxY]);
  const [a,b] = coordinates.point([left[0],floorY(left[0])]);
  const [c,d] = coordinates.point([right[0],floorY(right[0])]);
  if (c === a) return null;
  const slope = (d-b)/(c-a);
  return {
    bounds:[x0,y0,x1,y1], geom:[[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]]],
    plane:[slope/lift,-1/lift,(b-slope*a)/lift],
    // The real SVG has holes and irregular outlines within this envelope.
    // It participates in depth order without cutting away any background.
    opaque:false,
  };
}

let transparentKey = '';
let transparentResult: readonly IsoDepthFragment[] = [];

/**
 * Transparent surfaces can reveal an opaque surface farther away. Sort by
 * depth at the same projected pixel, not by a wall's midpoint: a slanted
 * face can pass from behind to in front of another face in a single frame.
 * Opaque faces discard covered fragments. Translucent faces only partition
 * them by the number of nearer layers, so higher ranks paint first.
 */
export function composeIsoTranslucentStructure(
  queue: readonly IsoWallDepthQueueEntry[], camera: IsoCamera, scale: number,
  masonry: IsoMasonryOpacity, furniture: readonly IsoDepthFurniture[],
): readonly IsoDepthFragment[] {
  const key = JSON.stringify([camera,scale,masonry,furniture.map(({footprint,height})=>[footprint,height]),
    queue.map(entry => entry.layer === 'opening' ? [entry.surface.material,entry.surface.kind,entry.surface.d]
      : [entry.layer,entry.face.d])]);
  if (key === transparentKey) return transparentResult;
  const {coordinates,restore} = depthClipCoordinates(camera,scale);
  const masonryKinds = queue.map(masonrySurface);
  const faces: (DepthSurface | null)[] = [...queue.map((entry,index) => {
    const kind = masonryKinds[index];
    if (kind && masonry[kind] === 0) return null;
    const face = faceOf(entry,camera,coordinates);
    if (face && kind) face.opaque = masonry[kind] === 1;
    return face;
  }), ...furniture.map(item => furnitureDepthSurface(item,camera,coordinates))];
  const result: RankedFragment[] = [];
  for (const [index,face] of faces.entries()) {
    if (!face) continue;
    let visible = new Map<number, Multi>([[0,face.geom]]);
    for (const [otherIndex,other] of faces.entries()) {
      if (index === otherIndex || !other || !visible.size) continue;
      const a = face.bounds, b = other.bounds;
      const overlap = [Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
      if (overlap[2]-overlap[0]<1e-6 || overlap[3]-overlap[1]<1e-6) continue;
      let delta = other.plane.map((n,k) => n-face.plane[k]) as Plane;
      const coplanar = other.geom.every(([ring]) => ring.every(point => Math.abs(at(delta,point)) < DEPTH_EPS));
      // Prefer an opening reveal to its coplanar structural cut end. Other
      // coincident faces keep their original stable order. Duplicate masonry
      // in the same plane is one material, so it never darkens itself.
      if (coplanar) {
        const current = queue[index], next = queue[otherIndex];
        const reveal = next?.layer === 'opening' && next.surface.kind === 'jamb-reveal';
        const currentReveal = current?.layer === 'opening' && current.surface.kind === 'jamb-reveal';
        if (current?.layer === 'wall-side' && reveal) delta = [0,0,1];
        else if (currentReveal && next?.layer === 'wall-side') continue;
        else if (otherIndex > index) delta = [0,0,1];
        else continue;
      }
      const duplicateMasonry = coplanar && masonryKinds[index] !== undefined
        && masonryKinds[index] === masonryKinds[otherIndex];
      for (const [ring] of other.geom) {
        const cover = halfPlane(ring,[delta[0],delta[1],delta[2]-DEPTH_EPS]);
        if (!cover.length) continue;
        const next = new Map<number,Multi>();
        const add = (rank:number, polygons:Multi) => {
          if (!polygons.length) return;
          const existing = next.get(rank);
          if (existing) existing.push(...polygons);
          else next.set(rank,polygons);
        };
        for (const [rank,polygons] of visible) {
          for (const [subject] of polygons) {
            const outside = subtractConvex(subject,cover);
            add(rank,outside);
            if (outside.length === 1 && outside[0][0] === subject) continue;
            if (other.opaque || duplicateMasonry) continue;
            // Clip the current subject to the same convex cover for the
            // portion visible through this pane or wall.
            const sign = Math.sign(area(cover));
            let inside = subject;
            for (let i = 0; i < cover.length && inside.length; i++) {
              const p = cover[i], q = cover[(i+1)%cover.length];
              inside = halfPlane(inside,[(p[1]-q[1])*sign,(q[0]-p[0])*sign,(p[0]*q[1]-q[0]*p[1])*sign]);
            }
            if (inside.length) add(rank+1,[[inside]]);
          }
        }
        visible = next;
      }
    }
    for (const [rank,geom] of visible) {
      // A depth rank remains independent, but its working partitions must
      // paint as one sheet so transparency is applied once at shared edges.
      result.push({index,rank,geom});
    }
  }
  transparentKey = key;
  transparentResult = coalesceDepthPaint(result,faces).map(({index,geom})=>({index,d:path(depthPaintContours(geom),restore)}));
  return transparentResult;
}
