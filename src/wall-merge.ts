/**
 * Merging collinear wall segments (issue #229).
 *
 * A straight wall drawn in five clicks is stored as five records with four
 * seams. The seams are invisible until the first interaction, and then every
 * one of them gets in the way: selection grabs a piece, dragging breaks the
 * wall in half, thickness has to be set per fragment.
 *
 * Room walls already collapse like this — `normalizeWallIntervals` compacts
 * "every maximal solid run of one thickness". Independent partitions never
 * did. This module gives them the same rule.
 *
 * Everything here is pure: the rules are provable by unit tests, without a
 * browser and without a config store. docs/specs/229-merge-collinear-partitions.md
 */

import type { OpeningCfg, PartitionCfg, WallColumnCfg } from './types';
import { materializePartitionOpening, resolvePartitionOpeningCompat } from './partition-openings';

/** Collinearity, as a fraction of one grid pitch (spec §8.3). */
export const EPS_ANGLE = 0.02;
/** Two ends count as one point below this, also in grid pitches (spec §8.3). */
export const EPS_JOIN = 0.05;

export interface MergeGeometry {
  /** Every room outline, in the same coordinates as the partitions. */
  roomPolygons?: readonly (readonly (readonly number[])[])[];
  columns?: readonly WallColumnCfg[];
  /** Saved unfinished contours: only their endpoints anchor a junction. */
  draftEnds?: readonly (readonly number[])[];
}

export interface MergeOptions {
  /** One grid pitch in the coordinates used by the partitions. */
  pitch: number;
  geometry?: MergeGeometry;
  /**
   * Ids of the partitions the caller has just drawn. When given, merging is
   * confined to the connected component that contains at least one of them —
   * drawing fixes its own seam, `Optimise plans` sweeps what has piled up
   * (spec §8.6). Omit to consider every partition, which is what the
   * optimiser does.
   */
  seedIds?: readonly string[];
}

/**
 * How a position along one merged partition maps onto the survivor.
 *
 * Both are straight and collinear, so the mapping is linear: a point at `t`
 * of the old record sits at `base + t * span` of the new one. `span` is
 * negative when the survivor runs the other way — the old record's start
 * became the far end.
 */
export interface MergedOpeningMove {
  /** Host before the merge. */
  fromId: string;
  /** Host after the merge; equal to `fromId` when that record survived. */
  toId: string;
  base: number;
  span: number;
}

/** Position of `t` (0..1 along the old host) on the surviving partition. */
export function remapHostT(t: number, move: MergedOpeningMove): number {
  const mapped = move.base + t * move.span;
  return Math.min(1, Math.max(0, mapped));
}

export interface MergeResult {
  partitions: PartitionCfg[];
  /** How many records disappeared into a neighbour. */
  merged: number;
  /** What has to happen to every opening hosted by a merged partition. */
  openingMoves: MergedOpeningMove[];
}

const finite = (p: unknown): p is number[] => Array.isArray(p) && p.length >= 2
  && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distance from a point to a segment — a junction is a side, not just a corner. */
function distToSegment(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

/**
 * Does anything else meet this point, so the node has a reason to stay?
 *
 * The four reasons of spec §8.2, all measured with the same EPS_JOIN: a third
 * partition, a room edge, a column, the end of a saved draft. A room counts by
 * its SIDE, not only by its corners — a partition meeting the middle of a room
 * wall is an ordinary T-junction (docs/specs/141-wall-junctions.md).
 */
export function junctionAt(
  point: readonly number[],
  partitions: readonly PartitionCfg[],
  exclude: ReadonlySet<string>,
  geometry: MergeGeometry | undefined,
  join: number,
): boolean {
  for (const other of partitions) {
    if (!other || exclude.has(other.id) || !finite(other.a) || !finite(other.b)) continue;
    if (dist(point, other.a) <= join || dist(point, other.b) <= join) return true;
  }
  for (const polygon of geometry?.roomPolygons || []) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      if (finite(a) && finite(b) && distToSegment(point, a, b) <= join) return true;
    }
  }
  for (const column of geometry?.columns || []) {
    if (finite(column?.center) && dist(point, column.center) <= join) return true;
  }
  for (const end of geometry?.draftEnds || []) {
    if (finite(end) && dist(point, end) <= join) return true;
  }
  return false;
}

interface Pair { i: number; j: number; at: number[]; }

/** The two records share an end, run the same way and carry the same thickness. */
function pairAt(
  p: PartitionCfg, q: PartitionCfg, angle: number, join: number,
): number[] | null {
  if (p.cm !== q.cm) return null;
  const pd = [p.b[0] - p.a[0], p.b[1] - p.a[1]];
  const qd = [q.b[0] - q.a[0], q.b[1] - q.a[1]];
  const pl = Math.hypot(pd[0], pd[1]), ql = Math.hypot(qd[0], qd[1]);
  if (!(pl > 0) || !(ql > 0)) return null;
  const cross = Math.abs((pd[0] / pl) * (qd[1] / ql) - (pd[1] / pl) * (qd[0] / ql));
  if (cross > angle) return null;
  for (const [u, v] of [[p.a, q.a], [p.a, q.b], [p.b, q.a], [p.b, q.b]] as const) {
    if (dist(u, v) <= join) return [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  }
  return null;
}

/**
 * Merge every collinear neighbour pair that has no reason to keep its node.
 *
 * Runs to a fixed point: three segments in a row become one record, not two.
 * The surviving id is the one that comes first in the array — any rule would
 * do as long as it is deterministic and independent of when a piece was drawn.
 */
export function mergeCollinearPartitions(
  input: readonly PartitionCfg[], options: MergeOptions,
): MergeResult {
  const pitch = Number(options.pitch) > 0 ? Number(options.pitch) : 1;
  const join = EPS_JOIN * pitch;
  const angle = EPS_ANGLE;
  const moves = new Map<string, MergedOpeningMove>();
  let list = (input || []).filter((p): p is PartitionCfg =>
    !!p && typeof p.id === 'string' && finite(p.a) && finite(p.b));
  if (list.length < 2) return { partitions: [...(input || [])], merged: 0, openingMoves: [] };

  const seeds = options.seedIds && options.seedIds.length
    ? new Set(options.seedIds) : null;
  let merged = 0;

  for (let guard = 0; guard < list.length + 1; guard++) {
    let pair: Pair | null = null;
    for (let i = 0; i < list.length && !pair; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const at = pairAt(list[i], list[j], angle, join);
        if (!at) continue;
        // Confine the sweep to what the new chain touches (spec §8.6).
        if (seeds && !seeds.has(list[i].id) && !seeds.has(list[j].id)) continue;
        if (junctionAt(at, list, new Set([list[i].id, list[j].id]), options.geometry, join)) continue;
        pair = { i, j, at };
        break;
      }
    }
    if (!pair) break;

    const first = list[pair.i], second = list[pair.j];
    // Far ends: the two points that are NOT the shared joint.
    const ends = [first.a, first.b, second.a, second.b]
      .filter((p) => dist(p, pair!.at) > join);
    let a = ends[0] ?? first.a;
    let b = ends[ends.length - 1] ?? second.b;
    if (ends.length < 2) { a = first.a; b = second.b; }
    // Canonical direction: the lexicographically smaller end starts the record.
    // Without it the same physical wall comes out as a->b or b->a depending on
    // the order of the input, and every host.t along it flips with it.
    if (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1])) { const t = a; a = b; b = t; }
    const survivor: PartitionCfg = { ...first, a: [a[0], a[1]], b: [b[0], b[1]] };
    const newLength = dist(a, b);

    // An opening keeps its place in the plan, not its fraction. Both records
    // are collinear with the survivor, so projecting their ends onto its axis
    // gives the exact linear map (spec §8.4).
    const ux = newLength > 0 ? (b[0] - a[0]) / newLength : 0;
    const uy = newLength > 0 ? (b[1] - a[1]) / newLength : 0;
    const alongAxis = (p: readonly number[]) =>
      newLength > 0 ? ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / newLength : 0;
    for (const source of [first, second]) {
      const base = alongAxis(source.a);
      const span = alongAxis(source.b) - base;
      // A record already carrying moves from an earlier round is re-based, so
      // an opening never has to be walked through the chain of merges.
      for (const [id, previous] of moves) {
        if (previous.toId !== source.id) continue;
        moves.set(id, {
          fromId: previous.fromId, toId: survivor.id,
          base: base + previous.base * span, span: previous.span * span,
        });
      }
      moves.set(source.id, { fromId: source.id, toId: survivor.id, base, span });
    }
    if (seeds) { seeds.add(survivor.id); }
    list = list.filter((_, index) => index !== pair!.i && index !== pair!.j);
    list.splice(pair.i, 0, survivor);
    merged++;
  }

  return { partitions: list, merged, openingMoves: [...moves.values()] };
}

/**
 * Move every opening whose host disappeared onto the record that survived.
 *
 * Two things have to happen together, which is why they live in one function:
 * the authoritative `host` reference and the legacy `x/y/angle` projection an
 * older reader still draws from (docs/CONFIG-COMPATIBILITY.md, #132). The
 * projection is not merely a cache here: merging canonicalises the direction
 * of the survivor, so a wall stored right-to-left comes back left-to-right and
 * the stored angle turns 180 degrees with it.
 *
 * Returns how many openings were re-hosted.
 */
export function applyOpeningMoves(
  openings: readonly OpeningCfg[] | null | undefined,
  partitions: readonly PartitionCfg[],
  openingMoves: readonly MergedOpeningMove[],
  ctx: { coordScale: number; cellCm: number; gridPitch: number },
): number {
  if (!openings?.length || !openingMoves.length) return 0;
  const moves = new Map(openingMoves.map((move) => [move.fromId, move]));
  let moved = 0;
  for (const opening of openings) {
    const host = (opening as any)?.host;
    if (!host || host.kind !== 'partition') continue;
    const move = moves.get(host.id);
    if (!move) continue;
    (opening as any).host = { ...host, id: move.toId, t: remapHostT(host.t, move) };
    moved++;
    const resolved = resolvePartitionOpeningCompat(
      opening, partitions, ctx.coordScale, ctx.cellCm, ctx.gridPitch,
    ).resolved;
    if (resolved) Object.assign(
      opening, materializePartitionOpening(opening, resolved, ctx.coordScale),
    );
  }
  return moved;
}
