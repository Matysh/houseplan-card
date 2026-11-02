/** Rebase the first explicit graph edit onto the server's own legacy migration.
 * This is a graph-record delta, never an adapter from changed float carriers.
 */
import { commitWallSegmentModel } from './wall-segment-model';
import type { PlanGraph, GraphPatch, GraphEdgeRef } from './plan-graph';
import type { ServerConfig } from './types';
import { contentFingerprint } from './visual-continuity';

export interface LegacyGraphChange {
  version: 1;
  spaces: Array<{ space_id: string; base: PlanGraph; patch: GraphPatch }>;
}
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const edgeKey = (edge: GraphEdgeRef): string => edge.kind + ':' + edge.id;

function difference<T, R>(before: readonly T[], after: readonly T[],
  key: (value: T) => string, removed: (value: T) => R): { set: T[]; remove: R[] } {
  const previous = new Map(before.map(value => [key(value), value]));
  const next = new Set(after.map(key));
  return {
    set: after.filter(value => !previous.has(key(value))
      || contentFingerprint(previous.get(key(value))) !== contentFingerprint(value))
      .sort((a, b) => compare(key(a), key(b))),
    remove: before.filter(value => !next.has(key(value)))
      .sort((a, b) => compare(key(a), key(b))).map(removed),
  };
}

export function graphPatch(before: PlanGraph, after: PlanGraph): GraphPatch {
  return {
    nodes: difference(before.nodes, after.nodes, n => n.id, n => n.id),
    edges: difference(before.edges, after.edges, edgeKey, e => ({kind:e.kind,id:e.id})),
    rooms: difference(before.rooms, after.rooms, r => r.room, r => r.room),
    dependencies: difference(before.dependencies, after.dependencies, d => d.node, d => d.node),
  };
}

export function legacyGraphWriteChange(accepted: ServerConfig | null | undefined,
  candidate: ServerConfig): LegacyGraphChange | undefined {
  if (!accepted || Number(accepted.model_version || 0) >= 11 || Number(candidate.model_version) !== 11)
    return undefined;
  const baseline = commitWallSegmentModel(accepted).config;
  const previous = new Map(baseline.spaces.map(s => [String(s.id), s]));
  const spaces: LegacyGraphChange['spaces'] = [];
  for (const space of candidate.spaces) {
    const source = previous.get(String(space.id));
    // New/deleted floors are independently checked against the submitted
    // namespace by the ordinary config writer. Existing floors get a delta.
    if (!source?.plan_graph || !space.plan_graph) continue;
    spaces.push({space_id:String(space.id),base:source.plan_graph,
      patch:graphPatch(source.plan_graph,space.plan_graph)});
  }
  return {version:1,spaces};
}
