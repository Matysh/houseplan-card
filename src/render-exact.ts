/** Unbounded derived arithmetic, never a persisted GraphPoint codec.
 * A dyadic offset intersection can exceed the graph's integer budget without
 * representing a larger or less valid physical coordinate.
 */
import {gcd,toNumber} from './plan-exact';
export {toNumber};
export type {Exact,ExactPoint} from './plan-exact';
import type {Exact,ExactPoint} from './plan-exact';
export function exact(n:bigint,d=1n):Exact {
  if(!d)throw new Error('render-exact:zero-denominator');
  if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};
}
export const ZERO=exact(0n),ONE=exact(1n);
export const add=(a:Exact,b:Exact)=>exact(a.n*b.d+b.n*a.d,a.d*b.d);
export const sub=(a:Exact,b:Exact)=>exact(a.n*b.d-b.n*a.d,a.d*b.d);
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
export const pointAt=(a:ExactPoint,b:ExactPoint,t:Exact):ExactPoint=>[add(a[0],mul(sub(b[0],a[0]),t)),add(a[1],mul(sub(b[1],a[1]),t))];
export function intersection(a:ExactPoint,b:ExactPoint,c:ExactPoint,d:ExactPoint){
  const ab=pointSub(b,a),cd=pointSub(d,c),den=cross(ab,cd);if(!den.n)return null;
  const t=div(cross(pointSub(c,a),cd),den),u=div(cross(pointSub(c,a),ab),den);
  return{p:pointAt(a,b,t),t,u};
}
