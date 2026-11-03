/** Render-only planar arrangement. No storage snapping or polygon boolean library.
 * Offsets enter once as exact IEEE754 dyadics; every later predicate is rational.
 */
import * as Q from './render-exact';
import {registerExactPaintRing} from './polygon-paint';
export type Point = Q.ExactPoint;
export type Polygon = Point[];
type Box = [number,number,number,number];
export const pointKey=(p:Point):string=>p.map(q=>q.n+'/'+q.d).join(',');
export const pointNumbers=(p:Point):number[]=>p.map(Q.toNumber);
export function binary64(value:number):Q.Exact {
  if(!Number.isFinite(value))throw new Error('wall-arrangement:nonfinite');
  if(value===0)return Q.ZERO;
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);
  const bits=view.getBigUint64(0,false),negative=bits>>63n,exponent=Number((bits>>52n)&2047n);
  const fraction=bits&((1n<<52n)-1n),mantissa=exponent?(1n<<52n)|fraction:fraction;
  const shift=(exponent?exponent-1023:-1022)-52;
  const n=negative?-mantissa:mantissa;
  return shift>=0?Q.exact(n<<BigInt(shift)):Q.exact(n,1n<<BigInt(-shift));
}
export const numericPoint=(p:readonly number[]):Point=>[binary64(p[0]),binary64(p[1])];
export function area(poly:Polygon):Q.Exact {
  return poly.reduce((a,p,i)=>Q.add(a,Q.cross(p,poly[(i+1)%poly.length])),Q.ZERO);
}
export function clean(poly:Polygon):Polygon {
  const result=poly.filter((p,i)=>!i||!Q.pointEq(p,poly[i-1]));
  if(result.length>1&&Q.pointEq(result[0],result[result.length-1]))result.pop();
  if(result.length<3||!area(result).n)return [];
  // The arrangement may split one straight facade at many material endpoints.
  // Keep exact coverage, but do not hand all those internal events to SVG,
  // clean-floor booleans and every other downstream consumer as real corners.
  return result.filter((p,i)=>{
    const a=result[(i+result.length-1)%result.length],b=result[(i+1)%result.length];
    return Q.orientationSign(a,p,b)!==0||Q.cmp(Q.sub(p[0],a[0]),Q.ZERO)*Q.cmp(Q.sub(p[0],b[0]),Q.ZERO)>0
      ||Q.cmp(Q.sub(p[1],a[1]),Q.ZERO)*Q.cmp(Q.sub(p[1],b[1]),Q.ZERO)>0;
  });
}
export function polygon(points:readonly (readonly number[])[]):Polygon {
  const result=clean(points.map(numericPoint));
  return area(result).n<0n?result.reverse():result;
}
export const bounds=(poly:Polygon):Box=>{
  const box:Box=[Infinity,Infinity,-Infinity,-Infinity];
  for(const point of poly){const p=pointNumbers(point);box[0]=Math.min(box[0],p[0]);box[1]=Math.min(box[1],p[1]);box[2]=Math.max(box[2],p[0]);box[3]=Math.max(box[3],p[1]);}
  return box;
};
const overlaps=(a:Box,b:Box)=>a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3];
interface Tree<T>{box:Box;items?:T[];left?:Tree<T>;right?:Tree<T>}
export function tree<T>(items:T[],box:(item:T)=>Box):Tree<T>|undefined {
  if(!items.length)return undefined;
  const bound:Box=[Infinity,Infinity,-Infinity,-Infinity];
  for(const item of items){const b=box(item);bound[0]=Math.min(bound[0],b[0]);bound[1]=Math.min(bound[1],b[1]);bound[2]=Math.max(bound[2],b[2]);bound[3]=Math.max(bound[3],b[3]);}
  if(items.length<=8)return{box:bound,items};
  const axis=bound[2]-bound[0]>=bound[3]-bound[1]?0:1;
  const sorted=items.slice().sort((a,b)=>box(a)[axis]+box(a)[axis+2]-box(b)[axis]-box(b)[axis+2]);
  const mid=sorted.length>>1;
  return{box:bound,left:tree(sorted.slice(0,mid),box),right:tree(sorted.slice(mid),box)};
}
export function query<T>(node:Tree<T>|undefined,box:Box,out:T[]=[]):T[]{
  if(!node||!overlaps(node.box,box))return out;
  if(node.items)out.push(...node.items);else{query(node.left,box,out);query(node.right,box,out);}
  return out;
}
const sign=(q:Q.Exact)=>q.n<0n?-1:q.n>0n?1:0;
/** Winding at p + epsilon*d, epsilon positive infinitesimal; no sample epsilon. */
export function contains(poly:Polygon,p:Point,d:Point=[Q.ZERO,Q.ZERO]):boolean {
  let winding=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const ay=Q.cmp(a[1],p[1])||-sign(d[1]),by=Q.cmp(b[1],p[1])||-sign(d[1]);
    if(!((ay<=0&&by>0)||(by<=0&&ay>0)))continue;
    const side=Q.orientationSign(a,b,p)||Q.crossSign(Q.integerDirection(a,b),d);
    if(ay<=0&&by>0&&side>0)winding++;
    if(by<=0&&ay>0&&side<0)winding--;
  }
  return winding!==0;
}
/** Classify both sides of one boundary with shared exact predicates. */
function containsSides(poly:Polygon,p:Point,d:Point):[boolean,boolean] {
  let left=0,right=0;const dy=sign(d[1]);
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ay=Q.cmp(a[1],p[1]),by=Q.cmp(b[1],p[1]);
    const la=ay||-dy,lb=by||-dy,ra=ay||dy,rb=by||dy;
    if(!((la<=0&&lb>0)||(lb<=0&&la>0)||(ra<=0&&rb>0)||(rb<=0&&ra>0)))continue;
    const side=Q.orientationSign(a,b,p),offset=side?0:Q.crossSign(Q.integerDirection(a,b),d);
    const ls=side||offset,rs=side||-offset;
    if(la<=0&&lb>0&&ls>0)left++;if(lb<=0&&la>0&&ls<0)left--;
    if(ra<=0&&rb>0&&rs>0)right++;if(rb<=0&&ra>0&&rs<0)right--;
  }
  return[left!==0,right!==0];
}
/** Exact convex half-plane clipping; used for local caps and owner cuts only. */
export function clip(poly:Polygon,a:Point,b:Point,inside:boolean):Polygon {
  const signs=poly.map(p=>Q.orientationSign(a,b,p));
  const accepted=signs.map(sign=>inside?sign>=0:sign<=0);
  if(accepted.every(Boolean))return poly;
  if(!accepted.some(Boolean))return [];
  const out:Polygon=[];
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],ip=accepted[i],iq=accepted[(i+1)%poly.length];
    if(ip)out.push(p);
    if(ip!==iq){const hit=Q.lineIntersection(a,b,p,q);if(!hit)throw new Error('wall-arrangement:parallel-clip');out.push(hit);}
  }
  return clean(out);
}
export function subtractConvex(subject:Polygon,cut:Polygon):Polygon[]{
  if(!subject.length||!cut.length||!overlaps(bounds(subject),bounds(cut)))return subject.length?[subject]:[];
  const mask=area(cut).n<0n?cut.slice().reverse():cut;
  const out:Polygon[]=[];let remainder=subject;
  for(let i=0;i<mask.length&&remainder.length;i++){
    const a=mask[i],b=mask[(i+1)%mask.length],outside=clip(remainder,a,b,false);
    if(outside.length)out.push(outside);
    remainder=clip(remainder,a,b,true);
  }
  return out;
}
export function angleCompare(a:Point,b:Point):number {
  const half=(v:Point)=>v[1].n>0n||!v[1].n&&v[0].n>=0n?0:1;
  return half(a)-half(b)||-Q.crossSign(a,b);
}
interface Segment {a:Point;b:Point;box:Box;cuts:Map<string,Point>;index:number}
/** Union membership of analytic domains; intersections node boundary segments,
 * not offset polygons passed through a repair/union/difference pipeline. */
export function arrangeExact(input:Polygon[]):Polygon[][] {
  const polys=input.filter(p=>p.length>=3),segments:Segment[]=[];
  const keys=new WeakMap<Point,string>();
  const keyOf=(point:Point):string=>{let key=keys.get(point);if(key===undefined){key=pointKey(point);keys.set(point,key);}return key;};
  const groups=new Map<string,Map<string,{point:Point;delta:number}>>();
  // Collinear boundaries share an exact line and interval sweep. This removes
  // duplicates before broad-phase intersections, including room-owner repeats.
  for(const poly of polys)for(let i=0;i<poly.length;i++){
    let a=poly[i],b=poly[(i+1)%poly.length];if(Q.pointEq(a,b))continue;
    if(Q.pointCmp(a,b)>0)[a,b]=[b,a];
    const dx=Q.sub(b[0],a[0]),dy=Q.sub(b[1],a[1]);
    const slope=dx.n?Q.div(dy,dx):null;
    const intercept=slope?Q.sub(a[1],Q.mul(slope,a[0])):null;
    const line=slope?'s:'+slope.n+'/'+slope.d+':'+intercept!.n+'/'+intercept!.d:'x:'+a[0].n+'/'+a[0].d;
    // Keep disjoint intervals disjoint; line endpoints alone must not bridge gaps.
    const group=groups.get(line)||new Map<string,{point:Point;delta:number}>();
    for(const[point,delta]of [[a,1],[b,-1]] as const){
      const key=keyOf(point),event=group.get(key)||{point,delta:0};event.delta+=delta;group.set(key,event);
    }
    groups.set(line,group);
  }
  for(const group of groups.values()){
    const events=[...group.values()].sort((a,b)=>Q.pointCmp(a.point,b.point));let active=0;
    for(let i=0;i+1<events.length;i++){
      active+=events[i].delta;if(!active)continue;
      const a=events[i].point,b=events[i+1].point;
      segments.push({a,b,box:bounds([a,b]),cuts:new Map([[keyOf(a),a],[keyOf(b),b]]),index:segments.length});
    }
  }
  const segmentTree=tree(segments,s=>s.box);
  for(const a of segments)for(const b of query(segmentTree,a.box)){
    if(b.index<=a.index||!overlaps(a.box,b.box))continue;
    if(Q.pointEq(a.a,b.a)||Q.pointEq(a.a,b.b)||Q.pointEq(a.b,b.a)||Q.pointEq(a.b,b.b))continue;
    const ca=Q.orientationSign(a.a,a.b,b.a),cb=Q.orientationSign(a.a,a.b,b.b);
    if(ca&&ca===cb)continue;
    const ac=Q.orientationSign(b.a,b.b,a.a),ad=Q.orientationSign(b.a,b.b,a.b);
    if(ac&&ac===ad)continue;
    // Shared endpoints are already noded. Collinear spans were split by the
    // line sweep; neither case needs an intersection or fraction reduction.
    if(!ca&&!cb)continue;
    const hit=!ca?b.a:!cb?b.b:!ac?a.a:!ad?a.b:Q.lineIntersection(a.a,a.b,b.a,b.b);
    if(hit&&Q.pointCmp(hit,a.a)>=0&&Q.pointCmp(hit,a.b)<=0&&Q.pointCmp(hit,b.a)>=0&&Q.pointCmp(hit,b.b)<=0){
      a.cuts.set(keyOf(hit),hit);b.cuts.set(keyOf(hit),hit);
    }
  }
  const boxes=new Map(polys.map(p=>[p,bounds(p)]));
  const polyTree=tree(polys,p=>boxes.get(p)!),atomic=new Map<string,[Point,Point]>();
  for(const segment of segments){
    const points=[...segment.cuts.values()].sort(Q.pointCmp);
    for(let i=0;i+1<points.length;i++)atomic.set(keyOf(points[i])+'|'+keyOf(points[i+1]),[points[i],points[i+1]]);
  }
  const edges:Array<{a:Point;b:Point;used:boolean}>=[];
  for(const[a,b]of atomic.values()){
    const mid=Q.midpoint(a,b),delta=Q.integerDirection(a,b),left:Point=[Q.neg(delta[1]),delta[0]];
    // A conservative segment box contains its exact midpoint. Reusing the
    // endpoint projections avoids arbitrary-precision rounding of every new
    // midpoint; all membership decisions below remain exact.
    const pointBox=bounds([a,b]),candidates=query(polyTree,pointBox).filter(p=>overlaps(boxes.get(p)!,pointBox));
    let l=false,r=false;
    for(const poly of candidates){const sides=containsSides(poly,mid,left);l||=sides[0];r||=sides[1];if(l&&r)break;}
    if(l!==r)edges.push({a:l?a:b,b:l?b:a,used:false});
  }
  const outgoing=new Map<string,typeof edges>();
  for(const e of edges){const key=keyOf(e.a),list=outgoing.get(key)||[];list.push(e);outgoing.set(key,list);}
  for(const list of outgoing.values())list.sort((a,b)=>angleCompare(Q.integerDirection(a.a,a.b),Q.integerDirection(b.a,b.b)));
  const rings:Polygon[]=[];
  for(const start of edges){
    if(start.used)continue;
    const ring:Polygon=[];let edge=start;
    do{
      if(edge.used)throw new Error('wall-arrangement:open-cycle');
      edge.used=true;ring.push(edge.a);
      const choices=outgoing.get(keyOf(edge.b));
      if(!choices?.length)throw new Error('wall-arrangement:open-boundary');
      const reverse=Q.integerDirection(edge.b,edge.a);
      let index=choices.findIndex(e=>angleCompare(Q.integerDirection(e.a,e.b),reverse)>=0)-1;
      if(index<0)index=choices.length-1;
      edge=choices[index];
    }while(edge!==start);
    const cleaned=clean(ring);if(cleaned.length)rings.push(cleaned);
  }
  const areas=new Map(rings.map(r=>[r,area(r)]));
  const outer=rings.filter(r=>areas.get(r)!.n>0n),holes=rings.filter(r=>areas.get(r)!.n<0n);
  const polygons=outer.map(r=>[r]);
  for(const hole of holes){
    const p=Q.midpoint(hole[0],hole[1]),v=Q.integerDirection(hole[0],hole[1]),right:Point=[v[1],Q.neg(v[0])];
    const owner=outer.map((ring,i)=>({ring,i})).filter(({ring})=>contains(ring,p,right))
      .sort((a,b)=>Q.cmp(areas.get(a.ring)!,areas.get(b.ring)!))[0];
    if(!owner)throw new Error('wall-arrangement:orphan-hole');
    polygons[owner.i].push(hole);
  }
  return polygons;
}
export function arrange(input:Polygon[]):number[][][][] {
  return arrangeExact(input).map(p=>p.map(r=>{
    const ring=r.map(pointNumbers),closed=[...ring,ring[0].slice()];
    registerExactPaintRing(closed,area(ring.map(numericPoint)).n!==0n);return closed;
  }));
}

/** Independent physical components cannot blank each other on a failed pass.
 * Bbox connectivity is a conservative superset; coupled material is never
 * guessed apart. A partial result is explicitly unfit for a physical write.
 */
export function arrangeComponents(polys:Polygon[]):{geom:number[][][][];failures:number}{
  const boxes=polys.map(bounds),parents=polys.map((_,i)=>i),items=polys.map((_,i)=>i);
  const find=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const index=tree(items,i=>boxes[i]);
  for(const i of items)for(const j of query(index,boxes[i]))if(j>i&&overlaps(boxes[i],boxes[j]))parents[find(j)]=find(i);
  const groups=new Map<number,Polygon[]>();
  for(const i of items){const id=find(i),list=groups.get(id)||[];list.push(polys[i]);groups.set(id,list);}
  const geom:number[][][][]=[];let failures=0;
  for(const group of groups.values())try{geom.push(...arrange(group));}catch{failures++;}
  return{geom,failures};
}
