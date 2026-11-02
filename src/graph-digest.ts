/** Diagnostic structural digest, never client write authority. */
import type { PlanGraph } from './plan-graph';
import { compareCodePoints } from './codepoint-order';
import { sha256 } from './sha256';
const order = compareCodePoints;
function floatHex(value: number): string {
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, value === 0 ? 0 : value, false);
  return Array.from(new Uint8Array(data.buffer), b => b.toString(16).padStart(2, '0')).join('');
}
export function graphDigestBytes(graph: PlanGraph): string {
  return JSON.stringify([
    graph.nodes.slice().sort((a,b)=>order(a.id,b.id)).map(n=>[n.id,n.p]),
    graph.edges.slice().sort((a,b)=>order(a.kind+':'+a.id,b.kind+':'+b.id))
      .map(e=>[e.kind,e.id,e.from,e.to,floatHex(e.cm)]),
    graph.rooms.slice().sort((a,b)=>order(a.room,b.room))
      .map(r=>[r.room,r.edges.map(e=>[e.kind,e.id,e.reverse])]),
    graph.dependencies.slice().sort((a,b)=>order(a.node,b.node))
      .map(d=>[d.node,d.kind,d.refs.map(r=>[r.from,r.to]),d.parameters]),
  ]);
}
export function graphDigest(graph: PlanGraph): string {
  return Array.from(sha256(graphDigestBytes(graph)), b => b.toString(16).padStart(2,'0')).join('');
}
