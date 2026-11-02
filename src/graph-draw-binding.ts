/** Convert a known native snap reference into an exact drawing command target. */
import type { PlanGraph, TargetPointRef, GraphEdgeRef } from './plan-graph';
import type { PlanSnapCandidate } from './plan-snap-overlay';
import * as Q from './plan-exact';
let sequence=0;
function allocated(kind:'node'|'edge',seed:string|undefined,edge:GraphEdgeRef):string{
  if(seed===undefined){
    const uuid=globalThis.crypto?.randomUUID?.();
    return 'draw-'+kind+'-'+(uuid||Date.now().toString(36)+'-'+(++sequence).toString(36)+'-'+Math.random().toString(36).slice(2));
  }
  let hash=0xcbf29ce484222325n;
  for(const byte of new TextEncoder().encode(JSON.stringify([seed,kind,edge.kind,edge.id])))
    hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);
  return 'draw-'+kind+'-'+hash.toString(16).padStart(16,'0');
}
function authoredPoint(point:readonly number[]):Q.ExactPoint{
  const raw=Q.readSourcePoint(point);
  const axis=(q:Q.Exact,n:number):Q.Exact=>{
    const grid=Q.exact(Q.nearestInteger(Q.mul(q,Q.exact(240n))),240n);
    return Q.toNumber(grid)===n?grid:q;
  };
  return[axis(raw[0],point[0]),axis(raw[1],point[1])];
}
function sameProjection(point:readonly number[],expected:readonly number[]):boolean{
  const roundoff=Number.EPSILON*32*Math.max(1,...point.map(Math.abs),...expected.map(Math.abs));
  return Math.abs(point[0]-expected[0])<=roundoff&&Math.abs(point[1]-expected[1])<=roundoff;
}
/** Keys are presentation-only. Retain the returned target for gesture/history replay. */
export function graphDrawTargetRef(
  graph:PlanGraph|undefined|null,candidate:PlanSnapCandidate|null|undefined,namespaceSeed?:string,
):TargetPointRef|undefined{
  if(!graph||graph.version!==1||!candidate||!Array.isArray(candidate.point)||!candidate.point.every(Number.isFinite))return undefined;
  if(candidate.kind==='endpoint'){
    if(!candidate.node)return undefined;
    const node=graph.nodes.find(n=>n.id===candidate.node);if(!node)return undefined;
    const p=Q.pointToNumbers(Q.decodePoint(node.p)).map(n=>n*1000);
    return sameProjection(candidate.point,p)?{kind:'existing-node',node:node.id}:undefined;
  }
  const reference=candidate.segment.graphEdge;if(!reference)return undefined;
  const edge=graph.edges.find(e=>e.kind===reference.kind&&e.id===reference.id);if(!edge)return undefined;
  const from=graph.nodes.find(n=>n.id===edge.from),to=graph.nodes.find(n=>n.id===edge.to);
  if(!from||!to)return undefined;
  const a=Q.decodePoint(from.p),b=Q.decodePoint(to.p),point=authoredPoint([candidate.point[0]/1000,candidate.point[1]/1000]);
  const t=Q.projectParameter(point,a,b);
  if(!sameProjection(candidate.point,Q.pointToNumbers(Q.pointAt(a,b,t)).map(n=>n*1000)))return undefined;
  if(Q.cmp(t,Q.ZERO)<=0){
    return sameProjection(candidate.point,Q.pointToNumbers(a).map(n=>n*1000))?{kind:'existing-node',node:from.id}:undefined;
  }
  if(Q.cmp(t,Q.ONE)>=0){
    return sameProjection(candidate.point,Q.pointToNumbers(b).map(n=>n*1000))?{kind:'existing-node',node:to.id}:undefined;
  }
  return{kind:'on-edge',node:allocated('node',namespaceSeed,reference),edge:{...reference},t:Q.encodeRational(t),
    splitIds:[allocated('edge',namespaceSeed,reference)]};
}
