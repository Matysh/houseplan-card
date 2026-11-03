/** Unbounded derived arithmetic, never a persisted GraphPoint codec.
 * A dyadic offset intersection can exceed the graph's integer budget without
 * representing a larger or less valid physical coordinate.
 */
import {gcd,toNumber as exactToNumber} from './plan-exact';
export type {Exact,ExactPoint} from './plan-exact';
import type {Exact,ExactPoint} from './plan-exact';
// Derived rationals are immutable values. AABB queries and tracing repeatedly
// ask for their same rounded projection; never redo arbitrary-precision
// correctly-rounded division for a value already projected once.
const numbers=new WeakMap<Exact,number>();
export function toNumber(value:Exact):number {
  let number=numbers.get(value);
  if(number===undefined){number=exactToNumber(value);numbers.set(value,number);}
  return number;
}
export function exact(n:bigint,d=1n):Exact {
  if(!d)throw new Error('render-exact:zero-denominator');
  if(!n)return{n:0n,d:1n};
  if(d===1n)return{n,d};
  if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};
}
export const ZERO=exact(0n),ONE=exact(1n);
export function add(a:Exact,b:Exact):Exact {
  if(!a.n)return b;if(!b.n)return a;
  if(a.d===b.d)return exact(a.n+b.n,a.d);
  // Reduced inputs need cancellation only against the common denominator,
  // not a second gcd over the entire multiplied numerator and denominator.
  const g=gcd(a.d,b.d),ad=a.d/g,bd=b.d/g,n=a.n*bd+b.n*ad;
  if(!n)return ZERO;
  const h=gcd(n,g);return{n:n/h,d:ad*(b.d/h)};
}
export const sub=(a:Exact,b:Exact)=>add(a,neg(b));
export const mul=(a:Exact,b:Exact):Exact=>{
  if(!a.n||!b.n)return ZERO;
  const g=gcd(a.n,b.d),h=gcd(b.n,a.d);
  // Cross cancellation is already a proof that the product is reduced.
  return{n:(a.n/g)*(b.n/h),d:(a.d/h)*(b.d/g)};
};
export const div=(a:Exact,b:Exact)=>{
  if(!b.n)throw new Error('render-exact:zero-denominator');
  return mul(a,b.n<0n?{n:-b.d,d:-b.n}:{n:b.d,d:b.n});
};
export const neg=(a:Exact):Exact=>({n:-a.n,d:a.d});
export const cmp=(a:Exact,b:Exact)=>{const n=a.n*b.d-b.n*a.d;return n<0n?-1:n>0n?1:0;};
export const eq=(a:Exact,b:Exact)=>a.n===b.n&&a.d===b.d;
export const pointEq=(a:ExactPoint,b:ExactPoint)=>eq(a[0],b[0])&&eq(a[1],b[1]);
export const pointCmp=(a:ExactPoint,b:ExactPoint)=>cmp(a[0],b[0])||cmp(a[1],b[1]);
export const pointAdd=(a:ExactPoint,b:ExactPoint):ExactPoint=>[add(a[0],b[0]),add(a[1],b[1])];
export const pointSub=(a:ExactPoint,b:ExactPoint):ExactPoint=>[sub(a[0],b[0]),sub(a[1],b[1])];
export function midpoint(a:ExactPoint,b:ExactPoint):ExactPoint {
  const halfSum=(x:Exact,y:Exact):Exact=>{
    const sum=add(x,y);return sum.n%2n?{n:sum.n,d:sum.d*2n}:{n:sum.n/2n,d:sum.d};
  };
  return[halfSum(a[0],b[0]),halfSum(a[1],b[1])];
}
/** Positive scalar multiple of b-a, for angle/infinitesimal predicates only. */
export function integerDirection(a:ExactPoint,b:ExactPoint):ExactPoint {
  const dx=b[0].n*a[0].d-a[0].n*b[0].d,dy=b[1].n*a[1].d-a[1].n*b[1].d;
  return[exact(dx*b[1].d*a[1].d),exact(dy*b[0].d*a[0].d)];
}
export const cross=(a:ExactPoint,b:ExactPoint)=>sub(mul(a[0],b[1]),mul(a[1],b[0]));
export const orientation=(a:ExactPoint,b:ExactPoint,c:ExactPoint)=>cross(pointSub(b,a),pointSub(c,a));
const sign=(n:bigint)=>n<0n?-1:n>0n?1:0;
/** Predicate-only determinants need no fraction reduction or temporary points.
 * Every denominator is positive, so clearing them preserves the exact sign. */
export const crossSign=(a:ExactPoint,b:ExactPoint)=>sign(a[0].n*b[1].n*a[1].d*b[0].d-a[1].n*b[0].n*a[0].d*b[1].d);
export function orientationSign(a:ExactPoint,b:ExactPoint,c:ExactPoint):number {
 const x1=b[0].n*a[0].d-a[0].n*b[0].d,y1=b[1].n*a[1].d-a[1].n*b[1].d;
 const x2=c[0].n*a[0].d-a[0].n*c[0].d,y2=c[1].n*a[1].d-a[1].n*c[1].d;
 return sign(x1*y2*b[1].d*c[0].d-y1*x2*b[0].d*c[1].d);
}
export const pointAt=(a:ExactPoint,b:ExactPoint,t:Exact):ExactPoint=>[add(a[0],mul(sub(b[0],a[0]),t)),add(a[1],mul(sub(b[1],a[1]),t))];
export function intersection(a:ExactPoint,b:ExactPoint,c:ExactPoint,d:ExactPoint){
  const ab=pointSub(b,a),cd=pointSub(d,c),den=cross(ab,cd);if(!den.n)return null;
  const t=div(cross(pointSub(c,a),cd),den),u=div(cross(pointSub(c,a),ab),den);
  return{p:pointAt(a,b,t),t,u};
}
/** Homogeneous line intersection: integer determinants, only the two final
 * coordinates are reduced. Callers still decide exact segment membership. */
export function lineIntersection(a:ExactPoint,b:ExactPoint,c:ExactPoint,d:ExactPoint):ExactPoint|null {
  const point=(p:ExactPoint):[bigint,bigint,bigint]=>p[0].d===p[1].d
    ?[p[0].n,p[1].n,p[0].d]:[p[0].n*p[1].d,p[1].n*p[0].d,p[0].d*p[1].d];
  const cross=(u:bigint[],v:bigint[])=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const p=cross(cross(point(a),point(b)),cross(point(c),point(d)));
  return p[2]?[exact(p[0],p[2]),exact(p[1],p[2])]:null;
}
