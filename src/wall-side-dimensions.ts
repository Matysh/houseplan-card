/** Editor-only read model. Geometry and material ownership come from the
 * canonical, uncut masonry producer; openings never become dimension stops. */
export type DimensionPoint = readonly [number, number];
export type DimensionSide = -1 | 1;
export interface DimensionCarrier {
  id: string; a: DimensionPoint; b: DimensionPoint; cm: number;
  /** Stable graph-node IDs keep a side from flipping across a vertical pose. */
  ends?:readonly [string,string];
}
export interface DimensionMaterial {
  owners: readonly string[]; poly: readonly (readonly number[])[];
}
export interface DimensionInterval {
  id: string; carrier: string; side: DimensionSide; order: number;
  source: 'physical' | 'boundary' | 'axis' | 'unavailable';
  from: DimensionPoint | null; to: DimensionPoint | null;
  normal: DimensionPoint; lengthCm: number | null;
  /** A known saved endpoint may locate an unavailable notice, never a rail. */
  anchor?: DimensionPoint;
  /** Projection on the bounded carrier, in geometry units, not screen pixels. */
  low: number; high: number;
}
export interface DimensionGeometry {
  carriers: readonly DimensionCarrier[];
  /** Finite neighbor axes identify transverse endpoint supports, not lengths. */
  supports?: readonly DimensionCarrier[];
  geometry: readonly (readonly (readonly (readonly number[])[])[])[];
  materials: readonly DimensionMaterial[];
  perUnitCm: number; epsilon: number;
}
type Range = [number, number];
const dot = (a: readonly number[], b: readonly number[]): number => a[0]*b[0]+a[1]*b[1];
const minus = (a: readonly number[], b: readonly number[]): DimensionPoint => [a[0]-b[0],a[1]-b[1]];
const validPoint = (p: readonly number[]): boolean => Number.isFinite(p[0]) && Number.isFinite(p[1]);
const pointOrder = (a: DimensionPoint,b: DimensionPoint): number => a[0]-b[0] || a[1]-b[1];

function mergedRanges(ranges: Range[], epsilon: number): Range[] {
  ranges.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  const out: Range[]=[];
  for (const [low,high] of ranges) {
    if (!(high-low>epsilon)) continue;
    const last=out[out.length-1];
    if (last && low<=last[1]+epsilon) last[1]=Math.max(last[1],high);
    else out.push([low,high]);
  }
  return out;
}

/** Intersect one finite material polygon with the face's supporting line.
 * No infinite offset-line intersections or nearest-room attribution. Direct
 * masonry materials are convex; split convex pieces remain separate inputs. */
function materialRange(poly: DimensionMaterial['poly'], origin: DimensionPoint,
  tangent: DimensionPoint, normal: DimensionPoint, offset: number, epsilon: number): Range | null {
  const values: number[]=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length];
    if(!validPoint(a)||!validPoint(b)) return null;
    const pa=minus(a,origin),pb=minus(b,origin);
    const da=dot(pa,normal)-offset,db=dot(pb,normal)-offset;
    if(Math.abs(da)<=epsilon) values.push(dot(pa,tangent));
    if((da < -epsilon && db > epsilon)||(db < -epsilon && da > epsilon)) {
      const t=da/(da-db);
      values.push(dot(pa,tangent)+(dot(pb,tangent)-dot(pa,tangent))*t);
    }
  }
  return values.length ? [Math.min(...values),Math.max(...values)] : null;
}

function containsMaterial(point:DimensionPoint,poly:DimensionMaterial['poly'],epsilon:number):boolean {
  let positive=false,negative=false;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const cross=dx*(point[1]-a[1])-dy*(point[0]-a[0]),bound=epsilon*Math.hypot(dx,dy);
    if(cross>bound)positive=true;else if(cross < -bound)negative=true;
    if(positive&&negative)return false;
  }
  return poly.length>=3;
}

/** Build both sides of each explicitly bounded carrier. Internal arrangement
 * atoms merge, while gaps at real solid junctions remain separate intervals. */
export function resolveWallSideDimensions(input: DimensionGeometry): DimensionInterval[] {
  const {perUnitCm}=input;
  const epsilon=Number.isFinite(input.epsilon)&&input.epsilon>0 ? input.epsilon : 1e-9;
  const edges: Array<readonly [readonly number[],readonly number[]]>=[];
  for(const polygon of input.geometry) for(const ring of polygon) {
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length];
      if(validPoint(a)&&validPoint(b)&&Math.hypot(b[0]-a[0],b[1]-a[1])>epsilon) edges.push([a,b]);
    }
  }
  const intervals: DimensionInterval[]=[];
  const seen=new Set<string>();
  for(const carrier of [...input.carriers].sort((a,b)=>a.id.localeCompare(b.id))) {
    if(seen.has(carrier.id)) continue;
    seen.add(carrier.id);
    const direction=carrier.ends?carrier.ends[0].localeCompare(carrier.ends[1]):pointOrder(carrier.a,carrier.b);
    const [a,b]=direction<=0 ? [carrier.a,carrier.b] : [carrier.b,carrier.a];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(!validPoint(a)||!validPoint(b)||!(length>epsilon)||!(perUnitCm>0)||!Number.isFinite(perUnitCm)) {
      for(const side of [-1,1] as const)intervals.push({id:JSON.stringify([carrier.id,side,'unavailable']),
        carrier:carrier.id,side,order:0,source:'unavailable',from:null,to:null,normal:[0,side],
        lengthCm:null,low:0,high:0,...(validPoint(a)?{anchor:a}:validPoint(b)?{anchor:b}:{})});
      continue;
    }
    const u: DimensionPoint=[(b[0]-a[0])/length,(b[1]-a[1])/length], n: DimensionPoint=[-u[1],u[0]];
    const half=Number.isFinite(carrier.cm)&&carrier.cm>0 ? carrier.cm/perUnitCm/2 : 0;
    const owned=input.materials.filter(material=>material.owners.includes(carrier.id));
    for(const side of [-1,1] as const) {
      const offset=half*side, normal: DimensionPoint=[n[0]*side,n[1]*side];
      const ownedRanges=mergedRanges(owned.flatMap(material=>{
        const range=materialRange(material.poly,a,u,n,offset,epsilon);
        return range ? [range] : [];
      }),epsilon);
      const originalRanges=ownedRanges.map(range=>[...range] as Range);
      // A continuing facade has no boolean vertex at a T junction. Bound the
      // selected source by the real cross-section of its endpoint support,
      // not the artificial axis seam between two material owners. Collinear
      // neighbors are deliberately excluded: their far end is not this wall.
      const endpointSupport=(point:DimensionPoint,at:number):Range[]=>{
        return (input.supports||[]).flatMap(other=>{
          if(other.id===carrier.id)return [];
          const d=minus(other.b,other.a),size=Math.hypot(...d);
          if(!(size>epsilon)||!(other.cm>0)||Math.abs(u[0]*d[1]-u[1]*d[0])<=1e-10*size)return [];
          const v=minus(point,other.a),t=dot(v,d)/(size*size);
          if(!(t>=-epsilon/size&&t<=1+epsilon/size&&Math.abs(v[0]*d[1]-v[1]*d[0])<=epsilon*size))return [];
          if(!input.materials.some(m=>m.owners.includes(other.id)))return [];
          const h=other.cm/perUnitCm/2,limit=4*Math.max(half,h),dir:DimensionPoint=[d[0]/size,d[1]/size],normal:DimensionPoint=[-dir[1],dir[0]];
          // A T support ends on the axis, while its face continues through
          // the joint's masonry to the exterior rail. Only a bounded local
          // section is used as a clipping plane. The final interval MUST
          // still be an actual union edge overlapping this owner's material;
          // a bevel/short support can never be extended to an infinite apex.
          const section=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>[
            point[0]+dir[0]*limit*x+normal[0]*h*y,point[1]+dir[1]*limit*x+normal[1]*h*y]);
          const range=materialRange(section,a,u,n,offset,epsilon);
          return range&&range[0]<=at+epsilon&&range[1]>=at-epsilon
            ? [[Math.max(at-limit,range[0]),Math.min(at+limit,range[1])] as Range]:[];
        });
      };
      if(ownedRanges.length) {
        const start=endpointSupport(a,0),end=endpointSupport(b,length);
        if(start.length)ownedRanges[0][0]=Math.min(ownedRanges[0][0],...start.map(r=>r[0]));
        if(end.length)ownedRanges[ownedRanges.length-1][1]=Math.max(ownedRanges[ownedRanges.length-1][1],...end.map(r=>r[1]));
      }
      const ranges: Range[]=[];
      if(half>epsilon) for(const [p,q] of edges) {
        const delta=minus(q,p),edgeLength=Math.hypot(...delta);
        if(Math.abs(u[0]*delta[1]-u[1]*delta[0])>epsilon*edgeLength) continue;
        if(Math.abs(dot(minus(p,a),n)-offset)>epsilon) continue;
        const x=dot(minus(p,a),u),y=dot(minus(q,a),u),low=Math.min(x,y),high=Math.max(x,y);
        if(!originalRanges.some(own=>Math.min(high,own[1])-Math.max(low,own[0])>epsilon))continue;
        for(const own of ownedRanges) {
          const clipped: Range=[Math.max(low,own[0]),Math.min(high,own[1])];
          if(clipped[1]-clipped[0]>epsilon) ranges.push(clipped);
        }
      }
      const physical=mergedRanges(ranges,epsilon);
      let boundary:Range[]=[];
      if(!half) {
        const occupied=mergedRanges(input.materials.flatMap(material=>{
          const range=materialRange(material.poly,a,u,n,0,epsilon);
          return range?[[Math.max(0,range[0]),Math.min(length,range[1])] as Range]:[];
        }),epsilon);
        if(occupied.length>1&&occupied[0][0]<=epsilon&&occupied[occupied.length-1][1]>=length-epsilon)
          boundary=occupied.slice(0,-1).flatMap((range,index)=>occupied[index+1][0]-range[1]>epsilon
            ? [[range[1],occupied[index+1][0]] as Range]:[]);
      }
      // Absence of a proved face is not permission to invent physical corners.
      // Both axis fallbacks keep their side identity even when numbers coincide.
      const displayed=physical.length ? physical : boundary.length ? boundary : [[0,length] as Range];
      for(const [order,[low,high]] of displayed.entries()) {
        const physicalFace=physical.length>0;
        const faceOffset=physicalFace ? offset : 0;
        const from:DimensionPoint=[a[0]+u[0]*low+n[0]*faceOffset,a[1]+u[1]*low+n[1]*faceOffset];
        const to:DimensionPoint=[a[0]+u[0]*high+n[0]*faceOffset,a[1]+u[1]*high+n[1]*faceOffset];
        const support=(point:DimensionPoint,at:number):readonly string[]=>{
          const owners=new Set<string>();
          for(const material of input.materials)if(containsMaterial(point,material.poly,epsilon))
            for(const owner of material.owners)if(owner!==carrier.id)owners.add(owner);
          return owners.size?[...owners].sort():[at<length/2?'start':'end'];
        };
        // Coordinates and ordinal positions change during a drag. Finite
        // construction supports keep a surviving interval's identity instead.
        const id=JSON.stringify([carrier.id,side,support(from,low),support(to,high)]);
        intervals.push({id,carrier:carrier.id,side,order,
          source:physicalFace?'physical':boundary.length?'boundary':'axis',
          from,to,
          normal,lengthCm:(high-low)*perUnitCm,low,high});
      }
    }
  }
  return intervals;
}

/** Gesture filter: compare raw physical values, then add opposite intervals
 * with positive overlap exactly once. Added unchanged intervals never expand
 * the set transitively. Selection intentionally does not use this filter. */
export function changedWallSideDimensions(before: readonly DimensionInterval[],
  candidate: readonly DimensionInterval[], epsilonCm: number): DimensionInterval[] {
  const previous=new Map(before.map(interval=>[interval.id,interval]));
  const changed=candidate.filter(interval=>{
    const old=previous.get(interval.id);
    if(!old || old.source!==interval.source) return true;
    if(old.lengthCm===null || interval.lengthCm===null) return old.lengthCm!==interval.lengthCm;
    return Math.abs(old.lengthCm-interval.lengthCm)>epsilonCm;
  });
  const wanted=new Set(changed.map(interval=>interval.id));
  for(const interval of changed) for(const opposite of candidate) {
    if(interval.carrier!==opposite.carrier || interval.side===opposite.side) continue;
    // Fractions avoid treating centimetres as geometry units after calibration.
    const span=Math.max(interval.high-interval.low,opposite.high-opposite.low);
    const perUnit=interval.lengthCm && interval.high>interval.low ? interval.lengthCm/(interval.high-interval.low) : 1;
    if(span>0 && Math.min(interval.high,opposite.high)-Math.max(interval.low,opposite.low)>epsilonCm/perUnit)
      wanted.add(opposite.id);
  }
  return candidate.filter(interval=>wanted.has(interval.id));
}
