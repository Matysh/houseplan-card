/** A host may span collinear atoms; its complete footprint can protect a seam. */
import { edgeKey, type GraphEdge, type GraphIndex } from './plan-graph';
import { cmp, decodeRational, div, exact, mul, parseDecimal, pointAt, squaredDistance } from './plan-exact';

export function graphSeamCrossedByOpening(
  node:string,incident:readonly GraphEdge[],index:Pick<GraphIndex,'points'|'edges'>,openings:readonly any[],
):boolean {
  const keys=new Set(incident.map(edgeKey)),point=index.points.get(node)!;
  return openings.some(opening=>{
    if(!opening.host||!keys.has(edgeKey(opening.host)))return false;
    if(!Number.isFinite(opening.length)||opening.length<=0)return true;
    const edge=index.edges.get(edgeKey(opening.host))!;
    const t=opening.host.tq?decodeRational(opening.host.tq):parseDecimal(opening.host.t);
    const center=pointAt(index.points.get(edge.from)!,index.points.get(edge.to)!,t);
    const half=div(parseDecimal(opening.length),exact(2n));
    return cmp(squaredDistance(center,point),mul(half,half))<0;
  });
}
