/** A read projection of an accepted graph. No migration, snapping or ID allocation. */
import { decodePoint, pointToNumbers } from './plan-exact';
import type { PlanGraph } from './plan-graph';
import { annotateGraphOpeningRuns } from './graph-opening-run';

interface GraphView {
  rooms: Map<string, { poly: number[][]; wall_ids: string[] }>;
  wall_segments: any[];
  partitions: any[];
}
// Graph reducers replace their graph. HA state ticks and metadata edits reuse it.
const cache = new WeakMap<PlanGraph, GraphView>();
export function graphViewSpace<T extends Record<string, any>>(space: T): T {
  const graph = space.plan_graph as PlanGraph | undefined;
  if (!graph) return space;
  let view = cache.get(graph);
  if (!view) {
    const points = new Map(graph.nodes.map(node => [node.id, pointToNumbers(decodePoint(node.p))]));
    const edges = new Map(graph.edges.map(edge => [`${edge.kind}:${edge.id}`, edge]));
    const rooms = new Map(graph.rooms.map(room => [room.room, {
      poly: room.edges.map(ref => {
        const edge = edges.get(`${ref.kind}:${ref.id}`)!;
        return points.get(ref.reverse ? edge.to : edge.from)!.slice();
      }), wall_ids: room.edges.map(ref => ref.id),
    }]));
    const segment = (edge: PlanGraph['edges'][number]) => ({ ...edge.props, id: edge.id,
      a: points.get(edge.from)!.slice(), b: points.get(edge.to)!.slice(), cm: edge.cm });
    view = { rooms, wall_segments: graph.edges.filter(edge => edge.kind === 'wall').map(segment),
      partitions: graph.edges.filter(edge => edge.kind === 'partition').map(segment) };
    annotateGraphOpeningRuns(graph,view.wall_segments,'wall');
    annotateGraphOpeningRuns(graph,view.partitions,'partition');
    cache.set(graph, view);
  }
  const metadata = new Map((space.rooms || []).map((room: any) => [room.id, room]));
  return { ...space,
    rooms: [...view.rooms].map(([id, geometry]) => {
      const { poly: _poly, x: _x, y: _y, w: _w, h: _h, wall_ids: _ids, ...rest } = metadata.get(id) as any || { id };
      return { ...rest, ...geometry };
    }), wall_segments: view.wall_segments, partitions: view.partitions,
  };
}
