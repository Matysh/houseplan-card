import type { GraphDependency, GraphIndex, GraphOperation, PlanGraph } from './plan-graph';
import { type Exact, type ExactPoint, ZERO, ONE, cmp, encodeRational,
  orientation, pointEq, projectParameter } from './plan-exact';

/** Select owns one node; other nodes are fixed ends, not affine followers.
 * Rebind still-valid carrier constraints to those fixed points, or retire a
 * carrier that the gesture bends. Generic graph operations retain their DAG
 * propagation contract. The graph/index and affected list are frozen once. */
export class NodeMoveDependencies {
  private readonly affected: GraphDependency[];

  constructor(graph: PlanGraph, private readonly index: GraphIndex, private readonly moved: string) {
    this.affected = graph.dependencies.filter(d => d.node !== moved && d.refs.some(ref =>
      ref.from === moved || ref.to === moved || this.hasCarrier(ref, moved)));
  }

  /** A named carrier may be split, but must remain a connected straight run
   * through the dependent. Coordinate coincidence cannot bridge detached IDs.
   * Strictly increasing exact parameters exclude backtracking and cycles. */
  hasCarrier(ref: { from: string; to: string }, via: string, target?: ExactPoint): boolean {
    const point = (id: string) => id === this.moved && target ? target : this.index.points.get(id)!;
    const a = point(ref.from), b = point(ref.to);
    if (pointEq(a, b)) return false;
    const parameters = new Map<string, Exact | null>();
    const parameter = (id: string): Exact | null => {
      if (parameters.has(id)) return parameters.get(id)!;
      const p = point(id), t = projectParameter(p, a, b);
      const value = orientation(a, b, p).n === 0n && cmp(t, ZERO) >= 0 && cmp(t, ONE) <= 0 ? t : null;
      parameters.set(id, value); return value;
    };
    const reaches = (from: string, to: string): boolean => {
      const end = parameter(to), start = parameter(from);
      if (!start || !end || cmp(start, end) > 0) return false;
      const pending = [from], seen = new Set<string>();
      while (pending.length) {
        const id = pending.pop()!;
        if (id === to) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        const t = parameter(id)!;
        for (const edge of this.index.incident.get(id) || []) {
          const next = edge.from === id ? edge.to : edge.from, nt = parameter(next);
          if (nt && cmp(nt, t) > 0 && cmp(nt, end) <= 0) pending.push(next);
        }
      }
      return false;
    };
    return reaches(ref.from, via) && reaches(via, ref.to);
  }

  operations(target: ExactPoint): GraphOperation[] {
    const point = (id: string) => id === this.moved ? target : this.index.points.get(id)!;
    return this.affected.flatMap((dependency): GraphOperation[] => {
      if (!dependency.refs.every(ref => this.hasCarrier(ref, dependency.node, target)))
        return [{ kind: 'retire-dependency', node: dependency.node }];
      const parameters = dependency.refs.map(ref => encodeRational(projectParameter(
        point(dependency.node), point(ref.from), point(ref.to))));
      return JSON.stringify(parameters) === JSON.stringify(dependency.parameters) ? []
        : [{ kind: 'set-dependency', dependency: { ...dependency, parameters } }];
    });
  }
}
