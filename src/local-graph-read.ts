/** Read-only closure of an already accepted graph, never an editable draft. */
import type { PlanGraph } from './plan-graph';

export function localGraphRead(
  graph: PlanGraph | undefined, roomIds: ReadonlySet<string>,
  wallIds: ReadonlySet<string>, partitionIds: ReadonlySet<string>,
): PlanGraph | undefined {
  if (!graph) return undefined;
  const rooms = graph.rooms.filter(room => roomIds.has(room.room));
  const keys = new Set(rooms.flatMap(room => room.edges.map(edge => `${edge.kind}:${edge.id}`)));
  const edges = graph.edges.filter(edge => keys.has(`${edge.kind}:${edge.id}`)
    || (edge.kind === 'wall' ? wallIds : partitionIds).has(edge.id));
  const nodes = new Set(edges.flatMap(edge => [edge.from, edge.to]));
  return { ...graph, rooms, edges, nodes: graph.nodes.filter(node => nodes.has(node.id)),
    dependencies: graph.dependencies.filter(dependency => nodes.has(dependency.node)
      && dependency.refs.every(ref => nodes.has(ref.from) && nodes.has(ref.to))) };
}
