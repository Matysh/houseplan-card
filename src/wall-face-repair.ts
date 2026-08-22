import {
  buildWallFaceGraph, findWallFaceAtPoint,
  type WallGraphFace, type WallGraphSourceSegment,
} from './wall-face-graph';

export interface WallFaceRepairProposal {
  sourceKey: string;
  endpoint: 'a' | 'b';
  from: [number, number];
  to: [number, number];
  targetSourceKey: string;
  targetKind: 'endpoint' | 'line';
  distance: number;
}

export type WallFaceRepairResult =
  | { kind: 'none' }
  | { kind: 'ambiguous'; proposals: WallFaceRepairProposal[] }
  | { kind: 'repair'; proposal: WallFaceRepairProposal; face: WallGraphFace };

export interface WallFaceRepairOptions {
  maxDistance: number;
  epsilon?: number;
  gridStep?: number;
  point?: readonly number[];
  requiredSourceKey?: string;
}

export interface WallRepairHostedOpening {
  host?: { kind?: string; id?: string };
}

/** A hosted opening makes its persisted partition endpoint immovable. */
export function repairMovesHostedPartition(
  proposal: Pick<WallFaceRepairProposal, 'sourceKey'>,
  openings: readonly WallRepairHostedOpening[],
): boolean {
  if (!proposal.sourceKey.startsWith('static:partition|')) return false;
  const id = proposal.sourceKey.slice('static:partition|'.length).split('|')[0];
  return !!id && openings.some((opening) =>
    opening.host?.kind === 'partition' && opening.host.id === id);
}

const movable = (source: WallGraphSourceSegment): boolean => !source.key.startsWith('static:room|');

function projection(
  point: readonly number[], target: WallGraphSourceSegment,
): { point: [number, number]; t: number; distance: number } | null {
  const dx = target.b[0] - target.a[0];
  const dy = target.b[1] - target.a[1];
  const length2 = dx * dx + dy * dy;
  if (!(length2 > 0)) return null;
  const t = ((point[0] - target.a[0]) * dx + (point[1] - target.a[1]) * dy) / length2;
  const projected: [number, number] = [target.a[0] + dx * t, target.a[1] + dy * t];
  return { point: projected, t, distance: Math.hypot(projected[0] - point[0], projected[1] - point[1]) };
}

function pointOrder(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function gridError(point: readonly number[], step: number): number {
  if (!(step > 0)) return 0;
  return Math.hypot(point[0] - Math.round(point[0] / step) * step,
    point[1] - Math.round(point[1] / step) * step);
}

function stableEndpointMover<T extends {
  source: WallGraphSourceSegment; point: readonly number[]; endpoint: 'a' | 'b';
}>(
  left: T,
  right: T,
  gridStep: number,
): T {
  if (movable(left.source) !== movable(right.source)) return movable(left.source) ? left : right;
  const leftError = gridError(left.point, gridStep);
  const rightError = gridError(right.point, gridStep);
  if (Math.abs(leftError - rightError) > 1e-9) return leftError > rightError ? left : right;
  // Geometry, not record order or id, determines which side moves.
  return pointOrder(left.point, right.point) > 0 ? left : right;
}

function proposalKey(proposal: WallFaceRepairProposal): string {
  return [proposal.from[0], proposal.from[1], proposal.to[0], proposal.to[1], proposal.targetKind]
    .map((value) => typeof value === 'number' ? value.toFixed(6) : value).join('|');
}

function applyProposal(
  sources: readonly WallGraphSourceSegment[], proposal: WallFaceRepairProposal,
): WallGraphSourceSegment[] {
  return sources.map((source) => {
    if (source.key !== proposal.sourceKey) return source;
    return {
      ...source,
      [proposal.endpoint]: [...proposal.to] as [number, number],
    };
  });
}

/** Find exactly one one-endpoint repair that produces the requested bounded face. */
export function planWallFaceRepair(
  sources: readonly WallGraphSourceSegment[], options: WallFaceRepairOptions,
): WallFaceRepairResult {
  const epsilon = options.epsilon ?? 0.001;
  if (!(options.maxDistance >= 0) || (!options.point && !options.requiredSourceKey)) return { kind: 'none' };
  const proposals = new Map<string, WallFaceRepairProposal>();
  const endpoints = sources.flatMap((source) => ([
    { source, endpoint: 'a' as const, point: source.a },
    { source, endpoint: 'b' as const, point: source.b },
  ]));

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const left = endpoints[i];
      const right = endpoints[j];
      if (left.source === right.source) continue;
      const distance = Math.hypot(left.point[0] - right.point[0], left.point[1] - right.point[1]);
      if (!(distance > epsilon) || distance > options.maxDistance) continue;
      const mover = stableEndpointMover(left, right, options.gridStep || 0);
      const target = mover === left ? right : left;
      if (!movable(mover.source)) continue;
      const proposal: WallFaceRepairProposal = {
        sourceKey: mover.source.key, endpoint: mover.endpoint,
        from: [mover.point[0], mover.point[1]], to: [target.point[0], target.point[1]],
        targetSourceKey: target.source.key, targetKind: 'endpoint', distance,
      };
      proposals.set(proposalKey(proposal), proposal);
    }
  }

  for (const mover of endpoints) {
    if (!movable(mover.source)) continue;
    for (const target of sources) {
      if (target === mover.source) continue;
      const hit = projection(mover.point, target);
      if (!hit || hit.t <= epsilon || hit.t >= 1 - epsilon
          || !(hit.distance > epsilon) || hit.distance > options.maxDistance) continue;
      const proposal: WallFaceRepairProposal = {
        sourceKey: mover.source.key, endpoint: mover.endpoint,
        from: [mover.point[0], mover.point[1]], to: hit.point,
        targetSourceKey: target.key, targetKind: 'line', distance: hit.distance,
      };
      proposals.set(proposalKey(proposal), proposal);
    }
  }

  const successful: Array<{ proposal: WallFaceRepairProposal; face: WallGraphFace }> = [];
  for (const proposal of proposals.values()) {
    const graph = buildWallFaceGraph(applyProposal(sources, proposal), epsilon);
    const face = options.point
      ? findWallFaceAtPoint(graph, options.point, epsilon)
      : graph.faces.find((candidate) => !options.requiredSourceKey
          || candidate.sourceKeys.includes(options.requiredSourceKey)) || null;
    if (face) successful.push({ proposal, face });
  }
  successful.sort((left, right) => left.proposal.distance - right.proposal.distance
    || proposalKey(left.proposal).localeCompare(proposalKey(right.proposal)));
  if (!successful.length) return { kind: 'none' };
  const identities = new Set(successful.map((item) =>
    `${proposalKey(item.proposal)}|${item.face.key}`));
  if (identities.size > 1) {
    return { kind: 'ambiguous', proposals: successful.map((item) => item.proposal) };
  }
  return { kind: 'repair', ...successful[0] };
}
