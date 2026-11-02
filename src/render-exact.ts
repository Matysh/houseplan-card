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
export const add=(a:Exact,b:Exact)=>!a.n?b:!b.n?a:a.d===b.d?exact(a.n+b.n,a.d):exact(a.n*b.d+b.n*a.d,a.d*b.d);
export const sub=(a:Exact,b:Exact)=>!b.n?a:a.d===b.d?exact(a.n-b.n,a.d):exact(a.n*b.d-b.n*a.d,a.d*b.d);
export const mul=(a:Exact,b:Exact)=>{const g=gcd(a.n,b.d),h=gcd(b.n,a.d);return exact((a.n/g)*(b.n/h),(a.d/h)*(b.d/g));};
export const div=(a:Exact,b:Exact)=>mul(a,exact(b.d,b.n));
export const neg=(a:Exact):Exact=>({n:-a.n,d:a.d});
export const cmp=(a:Exact,b:Exact)=>{const n=a.n*b.d-b.n*a.d;return n<0n?-1:n>0n?1:0;};
export const eq=(a:Exact,b:Exact)=>a.n===b.n&&a.d===b.d;
export const pointEq=(a:ExactPoint,b:ExactPoint)=>eq(a[0],b[0])&&eq(a[1],b[1]);
export const pointCmp=(a:ExactPoint,b:ExactPoint)=>cmp(a[0],b[0])||cmp(a[1],b[1]);
export const pointAdd=(a:ExactPoint,b:ExactPoint):ExactPoint=>[add(a[0],b[0]),add(a[1],b[1])];
export const pointSub=(a:ExactPoint,b:ExactPoint):ExactPoint=>[sub(a[0],b[0]),sub(a[1],b[1])];
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
