/**
 * Lossless explicit-Optimize reconciliation for independent walls and saved
 * wall chains which are physically hidden by canonical room masonry.
 * Runtime renderers never call this module and it never mutates its inputs.
 */
import {
  materializePartitionOpening,
  partitionOpeningHasCompositeRoomWall,
  partitionOpeningJambMargin,
  resolvePartitionOpeningCompat,
  resolvePartitionOpeningStrict,
  type ResolvedPartitionOpening,
} from './partition-openings';
import {
  openingWallIndex,
  normalizeWallIntervals,
  resolveOpeningWallAssociation,
  setWallThickness,
  DRAW_WALL_DEFAULT_CM,
  wallCmToUnits,
  wallIntervals,
  type WallEntry,
  type WallInterval,
} from './wall-thickness';
import type { OpeningCfg, PartitionCfg, RoomDraftCfg, SpaceModel } from './types';

export interface CoincidentPartitionResult {
  walls: WallEntry[];
  partitions: PartitionCfg[];
  openings: OpeningCfg[];
  roomDrafts: RoomDraftCfg[];
  partitionsReconciled: number;
  openingsRehosted: number;
  removedDrafts: number;
}

export interface CoincidentPartitionOptions {
  pitch: number;
  cellCm: number;
  gridPitch: number;
  coordScale: number;
}

interface AxisRange { lo: number; hi: number }
interface AtomicPiece extends AxisRange {
  a: [number, number]; b: [number, number];
  safe: boolean; signature: string; roomIds: string[];
  roomCm: number; finalCm: number;
}
interface PieceRun extends AxisRange {
  a: [number, number]; b: [number, number];
  safe: boolean; signature: string; roomIds: string[]; finalCm: number;
}

const MAX_WALLS = 500;
const MAX_PARTITIONS = 2000;

const finitePoint = (point: readonly number[] | null | undefined): point is readonly [number, number] => (
  !!point && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
);
const comparePoint = (a: readonly number[], b: readonly number[]): number => (
  a[0] - b[0] || a[1] - b[1]
);
const pointAt = (
  origin: readonly number[], ux: number, uy: number, along: number,
): [number, number] => [origin[0] + ux * along, origin[1] + uy * along];
const projection = (
  point: readonly number[], origin: readonly number[], ux: number, uy: number,
): number => (point[0] - origin[0]) * ux + (point[1] - origin[1]) * uy;

const collinearRange = (
  axisA: readonly number[], axisB: readonly number[],
  otherA: readonly number[], otherB: readonly number[], eps: number,
): AxisRange | null => {
  const dx = axisB[0] - axisA[0], dy = axisB[1] - axisA[1];
  const length = Math.hypot(dx, dy);
  if (!(length > eps)) return null;
  const ux = dx / length, uy = dy / length;
  const across = (point: readonly number[]) => Math.abs(
    (point[0] - axisA[0]) * uy - (point[1] - axisA[1]) * ux
  );
  if (across(otherA) > eps || across(otherB) > eps) return null;
  const first = projection(otherA, axisA, ux, uy);
  const second = projection(otherB, axisA, ux, uy);
  const lo = Math.max(0, Math.min(first, second));
  const hi = Math.min(length, Math.max(first, second));
  return hi - lo > eps ? { lo, hi } : null;
};
const rangesOverlap = (first: AxisRange, second: AxisRange, eps: number): boolean => (
  Math.min(first.hi, second.hi) - Math.max(first.lo, second.lo) > eps
);

const rawPartitionKnown = (partition: any): boolean => {
  const known = new Set(['id', 'a', 'b', 'cm']);
  return Object.keys(partition || {}).every((key) => known.has(key));
};

const columnBlocks = (
  partition: PartitionCfg, columns: readonly any[],
  options: CoincidentPartitionOptions, eps: number,
): boolean => {
  const dx = partition.b[0] - partition.a[0], dy = partition.b[1] - partition.a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > eps)) return true;
  const ux = dx / length, uy = dy / length;
  const wallHalf = wallCmToUnits(partition.cm, options.cellCm, options.gridPitch) / 2;
  return columns.some((column) => {
    const centre = column?.center;
    if (!finitePoint(centre)) return true;
    const along = projection(centre, partition.a, ux, uy);
    const across = Math.abs(
      (centre[0] - partition.a[0]) * uy - (centre[1] - partition.a[1]) * ux
    );
    const radius = wallCmToUnits(Number(column.cm), options.cellCm, options.gridPitch)
      * (column.shape === 'square' ? Math.SQRT1_2 : 0.5);
    if (!Number.isFinite(radius) || !(radius > 0)) return true;
    return along >= -radius - eps && along <= length + radius + eps
      && across <= wallHalf + radius + eps;
  });
};

const openingGeometry = (
  opening: OpeningCfg, partitions: readonly PartitionCfg[],
  options: CoincidentPartitionOptions,
): { center: [number, number]; angle: number; length: number } | null => {
  if (opening.host) {
    const resolved = resolvePartitionOpeningCompat(
      opening, partitions, options.coordScale, options.cellCm, options.gridPitch,
    ).resolved;
    return resolved ? { center: resolved.center, angle: resolved.angle, length: resolved.length } : null;
  }
  const x = Number(opening.x) * options.coordScale;
  const y = Number(opening.y) * options.coordScale;
  const angle = Number(opening.angle);
  const length = Number(opening.length) * options.coordScale;
  return [x, y, angle, length].every(Number.isFinite) && length > 0
    ? { center: [x, y], angle, length } : null;
};
const openingsOverlap = (
  first: { center: [number, number]; angle: number; length: number },
  second: { center: [number, number]; angle: number; length: number }, eps: number,
): boolean => {
  const rad = first.angle * Math.PI / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);
  const otherRad = second.angle * Math.PI / 180;
  const vx = Math.cos(otherRad), vy = Math.sin(otherRad);
  if (Math.abs(ux * vy - uy * vx) > 1e-6) return false;
  const dx = second.center[0] - first.center[0], dy = second.center[1] - first.center[1];
  if (Math.abs(dx * uy - dy * ux) > eps) return false;
  const along = dx * ux + dy * uy;
  return Math.max(-first.length / 2, along - second.length / 2)
    < Math.min(first.length / 2, along + second.length / 2) - eps;
};

const scaledPartition = (partition: PartitionCfg, scale: number): PartitionCfg => ({
  ...partition,
  a: [partition.a[0] * scale, partition.a[1] * scale],
  b: [partition.b[0] * scale, partition.b[1] * scale],
});
const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};
const residualId = (
  sourceId: string, a: readonly number[], b: readonly number[], occupied: Set<string>,
): string => {
  const token = fnv1a(`${sourceId}|${a[0].toFixed(9)},${a[1].toFixed(9)}`
    + `|${b[0].toFixed(9)},${b[1].toFixed(9)}`);
  const suffix = `~r-${token}`;
  const base = `${sourceId.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
  let candidate = base;
  for (let index = 2; occupied.has(candidate); index++) {
    const extra = `-${index}`;
    candidate = `${base.slice(0, 64 - extra.length)}${extra}`;
  }
  occupied.add(candidate);
  return candidate;
};
const mergePieces = (pieces: AtomicPiece[], eps: number): PieceRun[] => {
  const runs: PieceRun[] = [];
  for (const piece of pieces) {
    const previous = runs[runs.length - 1];
    if (previous && Math.abs(previous.hi - piece.lo) <= eps
        && previous.safe === piece.safe
        && (!piece.safe || previous.signature === piece.signature)) {
      previous.hi = piece.hi;
      previous.b = piece.b;
      continue;
    }
    runs.push({
      lo: piece.lo, hi: piece.hi, a: piece.a, b: piece.b,
      safe: piece.safe, signature: piece.signature,
      roomIds: piece.roomIds, finalCm: piece.finalCm,
    });
  }
  return runs;
};

/** Point count and closure are deliberately irrelevant. */
const redundantDraftIds = (
  rawDrafts: readonly RoomDraftCfg[], modelDrafts: readonly RoomDraftCfg[],
  intervals: readonly WallInterval[], eps: number,
): Set<string> => {
  const rawById = new Map(rawDrafts.map((draft) => [draft.id, draft]));
  const out = new Set<string>();
  for (const draft of modelDrafts) {
    const raw = rawById.get(draft.id);
    if (!raw || !Array.isArray(draft.points) || draft.points.length < 2
        || draft.segments.length !== draft.points.length - 1) continue;
    let safe = true;
    for (let index = 0; index + 1 < draft.points.length && safe; index++) {
      const a = draft.points[index], b = draft.points[index + 1];
      const cm = Number(draft.segments[index]?.cm);
      if (!finitePoint(a) || !finitePoint(b) || !(cm > 0)) { safe = false; break; }
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(length > eps)) { safe = false; break; }
      const coverage = intervals.flatMap((interval) => {
        const effectiveCm = interval.cm > 0 ? interval.cm : DRAW_WALL_DEFAULT_CM;
        if (interval.open || (interval.kind !== 'outer' && interval.kind !== 'shared')
            || effectiveCm + eps < cm) return [];
        const range = collinearRange(a, b, interval.a, interval.b, eps);
        return range ? [range] : [];
      }).sort((first, second) => first.lo - second.lo || first.hi - second.hi);
      let reached = 0;
      for (const range of coverage) {
        if (range.lo > reached + eps) break;
        reached = Math.max(reached, range.hi);
        if (reached >= length - eps) break;
      }
      if (reached < length - eps) safe = false;
    }
    if (safe) out.add(draft.id);
  }
  return out;
};

export function reconcileCoincidentPartitions(
  rawSpace: any,
  model: Pick<SpaceModel, 'rooms' | 'partitions' | 'room_drafts' | 'wall_columns'>,
  wallsInput: WallEntry[] | null | undefined,
  openCuts: number[][],
  options: CoincidentPartitionOptions,
): CoincidentPartitionResult {
  const walls0 = wallsInput || [];
  const partitions0 = (Array.isArray(rawSpace?.partitions) ? rawSpace.partitions : []) as PartitionCfg[];
  const openings0 = (Array.isArray(rawSpace?.openings) ? rawSpace.openings : []) as OpeningCfg[];
  const roomDrafts0 = (Array.isArray(rawSpace?.room_drafts)
    ? rawSpace.room_drafts : []) as RoomDraftCfg[];
  const empty = {
    walls: walls0, partitions: partitions0, openings: openings0, roomDrafts: roomDrafts0,
    partitionsReconciled: 0, openingsRehosted: 0, removedDrafts: 0,
  };
  if (!partitions0.length && !roomDrafts0.length) return empty;

  const eps = Math.max(options.gridPitch * 0.0002, 1e-9);
  let walls = walls0;
  let partitions = partitions0;
  let openings = openings0;
  const initialIntervals = wallIntervals(
    model.rooms, walls, openCuts,
    options.pitch, options.cellCm, options.gridPitch, options.coordScale,
  );
  const removedDraftIds = redundantDraftIds(
    roomDrafts0, model.room_drafts, initialIntervals, eps,
  );
  const roomDrafts = roomDrafts0.filter((draft) => !removedDraftIds.has(draft.id));
  let partitionsReconciled = 0;
  let openingsRehosted = 0;

  const modelById = new Map(model.partitions.map((partition) => [partition.id, partition]));
  for (const rawPartition of [...partitions0].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!partitions.some((item) => item.id === rawPartition.id)) continue;
    if (!rawPartitionKnown(rawPartition)) continue;
    const source = modelById.get(rawPartition.id);
    if (!source || !finitePoint(source.a) || !finitePoint(source.b)
        || !Number.isFinite(source.cm) || !(source.cm > 0)) continue;

    const [origin, end] = comparePoint(source.a, source.b) <= 0
      ? [[source.a[0], source.a[1]], [source.b[0], source.b[1]]]
      : [[source.b[0], source.b[1]], [source.a[0], source.a[1]]];
    const dx = end[0] - origin[0], dy = end[1] - origin[1];
    const length = Math.hypot(dx, dy);
    if (!(length > eps)) continue;
    const ux = dx / length, uy = dy / length;

    const intervals = wallIntervals(
      model.rooms, walls, openCuts,
      options.pitch, options.cellCm, options.gridPitch, options.coordScale,
    );
    const intervalRanges = intervals.flatMap((interval) => {
      if (interval.open || (interval.kind !== 'outer' && interval.kind !== 'shared')) return [];
      const range = collinearRange(origin, end, interval.a, interval.b, eps);
      return range ? [{ interval, range }] : [];
    });
    if (!intervalRanges.length) continue;

    const hosted = openings.filter((opening) => opening.host?.kind === 'partition'
      && opening.host.id === source.id);
    const resolvedHosted = hosted.map((opening) => ({
      opening,
      resolved: resolvePartitionOpeningCompat(
        opening, model.partitions,
        options.coordScale, options.cellCm, options.gridPitch,
      ).resolved,
    }));
    if (resolvedHosted.some((item) => !item.resolved)) continue;

    const structuralBreakpoints = [0, length];
    for (const { range } of intervalRanges) structuralBreakpoints.push(range.lo, range.hi);
    const breakpoints = structuralBreakpoints.slice();
    const openingRanges = new Map<string, AxisRange>();
    for (const { opening, resolved } of resolvedHosted) {
      const centre = projection(resolved!.center, origin, ux, uy);
      const range = { lo: centre - resolved!.length / 2, hi: centre + resolved!.length / 2 };
      openingRanges.set(opening.id, range);
      breakpoints.push(Math.max(0, range.lo), Math.min(length, range.hi));
    }
    const sortedBreakpoints = [...new Set(breakpoints
      .filter((value) => Number.isFinite(value) && value >= -eps && value <= length + eps)
      .map((value) => Math.max(0, Math.min(length, value)).toFixed(9)))]
      .map(Number).sort((a, b) => a - b);

    const currentModelPartitions = partitions.map((partition) => scaledPartition(
      partition, options.coordScale,
    ));
    const otherPartitions = currentModelPartitions.filter((item) => item.id !== source.id);
    const activeDrafts = model.room_drafts.filter((draft) => !removedDraftIds.has(draft.id));
    const pieces: AtomicPiece[] = [];
    for (let index = 0; index + 1 < sortedBreakpoints.length; index++) {
      const lo = sortedBreakpoints[index], hi = sortedBreakpoints[index + 1];
      if (!(hi - lo > eps)) continue;
      const a = pointAt(origin, ux, uy, lo), b = pointAt(origin, ux, uy, hi);
      const owners = intervalRanges.filter(({ range }) => (
        range.lo <= lo + eps && range.hi >= hi - eps
      )).map(({ interval }) => interval);
      const byRoom = new Map<string, WallInterval>();
      for (const owner of owners) byRoom.set(owner.roomId, owner);
      const solid = [...byRoom.values()];
      const kinds = new Set(solid.map((owner) => owner.kind));
      const cms = new Set(solid.map((owner) => (
        owner.cm > 0 ? owner.cm : DRAW_WALL_DEFAULT_CM
      )));
      const kind = solid[0]?.kind;
      const roomIds = [...byRoom.keys()].sort();
      const proofOk = kinds.size === 1 && cms.size === 1
        && ((kind === 'outer' && roomIds.length === 1)
          || (kind === 'shared' && roomIds.length === 2));
      const piecePartition: PartitionCfg = { id: source.id, a, b, cm: source.cm };
      const blockedByPartition = otherPartitions.some((other) => (
        !!collinearRange(a, b, other.a, other.b, eps)
      ));
      const blockedByDraft = activeDrafts.some((draft) => draft.points.some((point, at) => (
        at + 1 < draft.points.length
        && !!collinearRange(a, b, point, draft.points[at + 1], eps)
      )));
      const safe = proofOk && !blockedByPartition && !blockedByDraft
        && !columnBlocks(piecePartition, model.wall_columns, options, eps);
      const roomCm = proofOk
        ? (solid[0].cm > 0 ? solid[0].cm : DRAW_WALL_DEFAULT_CM)
        : 0;
      const finalCm = proofOk ? Math.max(roomCm, source.cm) : source.cm;
      pieces.push({
        lo, hi, a, b, safe,
        signature: safe ? `${kind}|${roomIds.join(',')}|${finalCm}` : '',
        roomIds, roomCm, finalCm,
      });
    }
    if (!pieces.some((piece) => piece.safe)) continue;

    const rehosted = new Map<string, { resolved: ResolvedPartitionOpening; signature: string }>();
    for (const { opening, resolved } of resolvedHosted) {
      const range = openingRanges.get(opening.id)!;
      const crossesStructural = structuralBreakpoints.some((point) => (
        point > range.lo + eps && point < range.hi - eps
      ));
      const touched = pieces.filter((piece) => rangesOverlap(piece, range, eps));
      const signatures = new Set(touched.filter((piece) => piece.safe)
        .map((piece) => piece.signature));
      const canRehost = !crossesStructural && touched.length > 0
        && touched.every((piece) => piece.safe) && signatures.size === 1
        && partitionOpeningHasCompositeRoomWall(resolved!, intervals, eps);
      if (canRehost) {
        rehosted.set(opening.id, { resolved: resolved!, signature: [...signatures][0] });
        continue;
      }
      const jamb = partitionOpeningJambMargin(source, options.cellCm, options.gridPitch);
      const protectedRange = { lo: range.lo - jamb, hi: range.hi + jamb };
      for (const piece of pieces) {
        if (rangesOverlap(piece, protectedRange, eps)) {
          piece.safe = false;
          piece.signature = '';
        }
      }
    }

    // A later unsafe hosted opening can invalidate an earlier tentative
    // conversion on the same atomic pieces. Re-check to a fixed point and
    // protect every invalidated opening's jambs for residual re-hosting.
    let rehostInvalidated = true;
    while (rehostInvalidated) {
      rehostInvalidated = false;
      for (const [openingId, item] of [...rehosted.entries()]) {
        const range = openingRanges.get(openingId)!;
        const touched = pieces.filter((piece) => rangesOverlap(piece, range, eps));
        if (touched.length > 0 && touched.every((piece) => piece.safe)
            && touched.every((piece) => piece.signature === item.signature)) continue;
        rehosted.delete(openingId);
        const jamb = partitionOpeningJambMargin(source, options.cellCm, options.gridPitch);
        const protectedRange = { lo: range.lo - jamb, hi: range.hi + jamb };
        for (const piece of pieces) {
          if (rangesOverlap(piece, protectedRange, eps)) {
            piece.safe = false;
            piece.signature = '';
          }
        }
        rehostInvalidated = true;
      }
    }

    const runs = mergePieces(pieces, eps);
    const safeRuns = runs.filter((run) => run.safe);
    const residualRuns = runs.filter((run) => !run.safe);
    if (!safeRuns.length) continue;
    if (partitions.length - 1 + residualRuns.length > MAX_PARTITIONS) continue;

    let nextWalls = walls;
    for (const run of safeRuns) {
      const [runA, runB] = comparePoint(source.a, source.b) <= 0
        ? [run.a, run.b] : [run.b, run.a];
      nextWalls = setWallThickness(
        nextWalls, runA, runB, run.finalCm, options.pitch, options.coordScale,
      );
    }
    nextWalls = normalizeWallIntervals(
      model.rooms, nextWalls, openCuts,
      options.pitch, options.cellCm, options.gridPitch, options.coordScale,
    );
    if (nextWalls.length > MAX_WALLS) continue;

    const occupied = new Set(partitions.map((item) => item.id));
    occupied.delete(source.id);
    const nextResiduals: PartitionCfg[] = residualRuns.map((run, index) => {
      const a = [run.a[0] / options.coordScale, run.a[1] / options.coordScale];
      const b = [run.b[0] / options.coordScale, run.b[1] / options.coordScale];
      const id = index === 0 ? source.id : residualId(source.id, a, b, occupied);
      occupied.add(id);
      return { id, a, b, cm: source.cm };
    });
    const sourceIndex = partitions.findIndex((item) => item.id === source.id);
    const nextPartitions = partitions.slice();
    nextPartitions.splice(sourceIndex, 1, ...nextResiduals);
    const nextModelPartitions = nextPartitions.map((partition) => scaledPartition(
      partition, options.coordScale,
    ));

    const openingReplacement = new Map<string, OpeningCfg>();
    let residualBindingsOk = true;
    for (const { opening, resolved } of resolvedHosted) {
      const converted = rehosted.get(opening.id);
      if (converted) {
        const materialized = materializePartitionOpening(
          opening, converted.resolved, options.coordScale,
        );
        const { host: _host, ...ordinary } = materialized;
        openingReplacement.set(opening.id, ordinary as OpeningCfg);
        continue;
      }
      const range = openingRanges.get(opening.id)!;
      const residualIndex = residualRuns.findIndex((run) => (
        run.lo <= range.lo + eps && run.hi >= range.hi - eps
      ));
      const residual = nextResiduals[residualIndex];
      const residualModel = residual && nextModelPartitions.find((item) => item.id === residual.id);
      if (!residual || !residualModel) { residualBindingsOk = false; break; }
      const residualDx = residualModel.b[0] - residualModel.a[0];
      const residualDy = residualModel.b[1] - residualModel.a[1];
      const residualLength = Math.hypot(residualDx, residualDy);
      const centre = projection(
        resolved!.center, residualModel.a, residualDx / residualLength, residualDy / residualLength,
      );
      const rebound = {
        ...materializePartitionOpening(opening, resolved!, options.coordScale),
        host: { kind: 'partition' as const, id: residual.id, t: centre / residualLength },
      };
      if (!resolvePartitionOpeningStrict(
        rebound, nextModelPartitions,
        options.coordScale, options.cellCm, options.gridPitch,
      ).resolved) { residualBindingsOk = false; break; }
      openingReplacement.set(opening.id, rebound);
    }
    if (!residualBindingsOk) continue;

    const nextOpenings = openings.map((opening) => openingReplacement.get(opening.id) || opening);
    const convertedOpenings = [...rehosted.keys()].map((id) => openingReplacement.get(id)!);
    const convertedGeometry = convertedOpenings.map((opening) => openingGeometry(
      opening, nextModelPartitions, options,
    ));
    if (convertedGeometry.some((geometry) => !geometry)) continue;
    let overlap = false;
    for (let first = 0; first < convertedGeometry.length; first++) {
      for (let second = first + 1; second < convertedGeometry.length; second++) {
        if (openingsOverlap(convertedGeometry[first]!, convertedGeometry[second]!, eps)) overlap = true;
      }
    }
    const convertedIds = new Set(convertedOpenings.map((opening) => opening.id));
    for (const opening of nextOpenings) {
      if (convertedIds.has(opening.id)) continue;
      const geometry = openingGeometry(opening, nextModelPartitions, options);
      if (geometry && convertedGeometry.some((candidate) => openingsOverlap(candidate!, geometry, eps))) {
        overlap = true;
      }
    }
    if (overlap) continue;

    const index = openingWallIndex(
      model.rooms, nextWalls, openCuts,
      options.pitch, options.cellCm, options.gridPitch, options.coordScale,
    );
    const associationsOk = [...rehosted.entries()].every(([openingId, item]) => {
      const replacement = openingReplacement.get(openingId)!;
      const association = resolveOpeningWallAssociation(index, {
        x: replacement.x * options.coordScale,
        y: replacement.y * options.coordScale,
        angle: replacement.angle,
        length: replacement.length * options.coordScale,
      }, true);
      const full = [association.negative, association.positive]
        .filter((side): side is NonNullable<typeof association.negative> => !!side?.full);
      const expected = item.signature.split('|')[1].split(',');
      const associated = new Set(full.map((side) => side.roomId));
      return full.length === expected.length && associated.size === expected.length
        && expected.every((roomId) => associated.has(roomId));
    });
    if (!associationsOk) continue;

    walls = nextWalls;
    partitions = nextPartitions;
    openings = nextOpenings;
    partitionsReconciled += safeRuns.length;
    openingsRehosted += rehosted.size;
  }

  return {
    walls, partitions, openings, roomDrafts,
    partitionsReconciled, openingsRehosted, removedDrafts: removedDraftIds.size,
  };
}
