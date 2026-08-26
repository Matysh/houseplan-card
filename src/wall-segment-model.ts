/**
 * Persisted identity for contour-wall atoms (ADR 282, Stage 1).
 *
 * The editor still renders through the legacy `walls[]` projection.  This
 * module is the single structural-write barrier which owns the canonical v8
 * catalogue and regenerates that projection.  It is deliberately DOM-free so
 * the frontend and migration contracts can be exercised as pure tests.
 */

import {
  canonicalizeConfigGeometryInPlace, LATTICE_NOISE_STEPS,
} from './coordinate-canonicalization';
import { roomPoly, samePoint } from './logic';
import { resolveOpenCuts, sanitizeOpenSpans } from './open-spans';
import { GRID_STEP_N } from './space-geometry';
import {
  atomicPolyForRoom, thicknessCmAt, wallAngleMatches, wallKey, type WallEntry,
} from './wall-thickness';
import type { OpeningCfg, WallOpeningHost, WallSegmentEntry } from './types';

export const WALL_SEGMENT_MODEL_VERSION = 9;
const EPS = 1e-9;

export type WallSegmentModelBlocker =
  | 'invalid-room'
  | 'zero-length'
  | 'third-owner'
  | 'duplicate-id'
  | 'thickness-conflict'
  | 'opening-host';

export class WallSegmentModelError extends Error {
  constructor(public readonly reason: WallSegmentModelBlocker, detail = '') {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'WallSegmentModelError';
  }
}

export interface WallSegmentCommitResult<T = any> {
  config: T;
  changed: boolean;
  migratedSegments: number;
}

export interface WallSegmentCommitOptions {
  /** Atom-key → existing ID, supplied only by a proven local topology edit. */
  lineageHints?: ReadonlyMap<string, string>;
  lineageSpaceId?: string;
}

type Point = [number, number];
type Atom = {
  key: string;
  a: Point;
  b: Point;
  owners: Set<string>;
  preferredIds: Set<string>;
  positionalIds: Set<string>;
  preferredCarriers: Map<string, { a: Point; b: Point }>;
  parentKeys: Set<string>;
  zeroWall: boolean;
  id?: string;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const finitePoint = (value: unknown): value is number[] => (
  Array.isArray(value) && value.length >= 2
  && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))
);
const point = (value: number[]): Point => [Number(value[0]), Number(value[1])];
const pointKey = (value: number[]): string => (
  `${Number(value[0]).toFixed(12)},${Number(value[1]).toFixed(12)}`
);
const atomKey = (a: number[], b: number[]): string => {
  const ka = pointKey(a), kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};
const canonicalSpan = (a: number[], b: number[]): [Point, Point] => (
  pointKey(a) <= pointKey(b) ? [point(a), point(b)] : [point(b), point(a)]
);
const lengthOf = (a: number[], b: number[]): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Remove zero-length adjacent draft edges without moving identity to a
 * neighbouring carrier.  The caller owns whole-record validation; this pure
 * write-boundary helper owns the index relationship between points and
 * segments (#314).
 */
export const sanitizeRoomDraftPath = (draft: any): {
  points: number[][];
  segments: Array<{ id?: string; cm: number; [key: string]: any }>;
} => {
  const points: number[][] = [[Number(draft.points[0][0]), Number(draft.points[0][1])]];
  const segments: Array<{ id?: string; cm: number; [key: string]: any }> = [];
  for (let index = 1; index < draft.points.length; index++) {
    const next = [Number(draft.points[index][0]), Number(draft.points[index][1])];
    if (samePoint(points[points.length - 1], next)) continue;
    points.push(next);
    const source = draft.segments?.[index - 1];
    segments.push({
      ...(source && typeof source === 'object' ? source : {}),
      cm: Number.isFinite(Number(source?.cm))
        ? Math.max(0, Math.min(100, Number(source.cm))) : 15,
    });
  }
  return { points, segments };
};

/** Unique authored/derived contour coordinates that are materially off-grid. */
export const wallModelOffGridValueCount = (
  space: any, additionalPoints: readonly (readonly number[])[] = [],
): number => {
  const values = new Set<string>();
  const inspect = (value: unknown): void => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    const steps = number / GRID_STEP_N;
    if (Math.abs(steps - Math.round(steps)) >= LATTICE_NOISE_STEPS)
      values.add(number.toFixed(12));
  };
  for (const room of Array.isArray(space?.rooms) ? space.rooms : []) {
    for (const point of roomPoly(room) || []) {
      inspect(point[0]);
      inspect(point[1]);
    }
  }
  for (const collection of [space?.wall_segments, space?.walls]) {
    for (const segment of Array.isArray(collection) ? collection : []) {
      inspect(segment?.a?.[0]); inspect(segment?.a?.[1]);
      inspect(segment?.b?.[0]); inspect(segment?.b?.[1]);
    }
  }
  for (const additionalPoint of additionalPoints) {
    inspect(additionalPoint?.[0]); inspect(additionalPoint?.[1]);
  }
  return values.size;
};
const projectT = (p: number[], a: number[], b: number[]): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const den = dx * dx + dy * dy;
  return den > EPS * EPS ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den : 0;
};
const distanceToSegment = (p: number[], a: number[], b: number[]): number => {
  const t = Math.max(0, Math.min(1, projectT(p, a, b)));
  return Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * t), p[1] - (a[1] + (b[1] - a[1]) * t));
};
const collinearOverlap = (
  a: number[], b: number[], c: number[], d: number[], epsilon = EPS,
): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len <= epsilon) return 0;
  const cross = (p: number[]) => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
  if (cross(c) > epsilon || cross(d) > epsilon) return 0;
  const tc = projectT(c, a, b), td = projectT(d, a, b);
  return Math.max(0, Math.min(1, Math.max(tc, td)) - Math.max(0, Math.min(tc, td))) * len;
};

/* Small synchronous SHA-256: structural commits are synchronous gestures, so
 * WebCrypto's Promise API cannot be the source of migration identity. */
const sha256 = (text: string): Uint8Array => {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const size = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(size);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(size - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(size - 4, bitLength >>> 0, false);
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  for (let offset = 0; offset < size; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < h.length; i++) outView.setUint32(i * 4, h[i], false);
  return out;
};

const base32 = (bytes: Uint8Array): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
};

export const deterministicWallSegmentId = (
  spaceId: string, a: number[], b: number[], ownerIds: readonly string[], salt = '',
): string => {
  const [ca, cb] = canonicalSpan(a, b);
  const seed = `${spaceId}|${pointKey(ca)}|${pointKey(cb)}|${[...ownerIds].sort().join(',')}${salt}`;
  return `wall-${base32(sha256(seed)).slice(0, 20)}`;
};

let fallbackIdSequence = 0;

/** IDs created after v8 materialisation must never be derived from geometry. */
const freshWallSegmentId = (used: Set<string>): string => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const uuid = globalThis.crypto?.randomUUID?.();
    const entropy = uuid || base32(sha256(
      `${Date.now()}|${fallbackIdSequence++}|${Math.random()}`,
    )).slice(0, 26);
    const id = `wall-${entropy}`;
    if (!used.has(id)) return id;
  }
  throw new WallSegmentModelError('duplicate-id', 'id factory exhausted');
};

const nonCatalogIds = (space: any): Set<string> => {
  const result = new Set<string>();
  for (const collection of [
    space.rooms, space.openings, space.decor, space.room_drafts,
    space.partitions, space.wall_columns,
  ]) {
    for (const item of Array.isArray(collection) ? collection : []) {
      if (typeof item?.id === 'string' && item.id) result.add(item.id);
    }
  }
  for (const draft of Array.isArray(space.room_drafts) ? space.room_drafts : []) {
    for (const segment of Array.isArray(draft?.segments) ? draft.segments : []) {
      if (typeof segment?.id === 'string' && segment.id) result.add(segment.id);
    }
  }
  return result;
};

const oldSegmentMap = (space: any): Map<string, WallSegmentEntry> => {
  const result = new Map<string, WallSegmentEntry>();
  for (const segment of Array.isArray(space?.wall_segments) ? space.wall_segments : []) {
    if (!segment || typeof segment.id !== 'string' || !finitePoint(segment.a) || !finitePoint(segment.b)) continue;
    if (result.has(segment.id)) throw new WallSegmentModelError('duplicate-id', segment.id);
    result.set(segment.id, segment as WallSegmentEntry);
  }
  return result;
};

const translatedSegmentDelta = (
  a: number[], b: number[], previous: WallSegmentEntry,
): [number, number] | null => {
  const matches = (pa: number[], pb: number[]): [number, number] | null => {
    const dx = a[0] - pa[0], dy = a[1] - pa[1];
    return Math.abs((b[0] - pb[0]) - dx) <= EPS
      && Math.abs((b[1] - pb[1]) - dy) <= EPS ? [dx, dy] : null;
  };
  return matches(previous.a, previous.b) || matches(previous.b, previous.a);
};

const openingHostCounts = (openings: readonly OpeningCfg[]): Map<string, number> => {
  const result = new Map<string, number>();
  for (const opening of openings) {
    if (opening.host?.kind !== 'wall') continue;
    result.set(opening.host.id, (result.get(opening.host.id) || 0) + 1);
  }
  return result;
};

const buildAtoms = (
  space: any, old: ReadonlyMap<string, WallSegmentEntry>,
): { atoms: Atom[]; rooms: any[] } => {
  const rooms = Array.isArray(space.rooms) ? space.rooms : [];
  const explicitLegacyCuts = sanitizeOpenSpans(space.open_spans).map((entry) => [
    entry.a[0], entry.a[1], entry.b[0], entry.b[1],
  ]);
  const legacyCuts = explicitLegacyCuts.length ? explicitLegacyCuts : resolveOpenCuts(
    rooms, null, 1, GRID_STEP_N * 0.04, true,
  );
  // Since v9 every bodyless contour atom is authoritative in wall_segments.
  // Feed its CURRENT carrier back into atomisation on every structural write:
  // a partial zero run must survive after the deprecated open_spans/open_to
  // projection has been removed, while Resize must not leave its old endpoint
  // behind as a phantom breakpoint.
  const canonicalZeroCuts: number[][] = [];
  for (const room of rooms) {
    const poly = roomPoly(room);
    const ids = Array.isArray(room?.wall_ids) ? room.wall_ids : [];
    if (!poly || ids.length !== poly.length) continue;
    for (let index = 0; index < ids.length; index++) {
      const previous = typeof ids[index] === 'string' ? old.get(ids[index]) : null;
      if (Number(previous?.cm) !== 0) continue;
      canonicalZeroCuts.push([
        poly[index][0], poly[index][1],
        poly[(index + 1) % poly.length][0], poly[(index + 1) % poly.length][1],
      ]);
    }
  }
  const cuts = [...canonicalZeroCuts, ...legacyCuts];
  // #316 §3.1: a legacy open_spans/open_to cut never zeroes the atom that
  // carries an existing contour opening — if a door stands inside a former
  // "border", the wall under it was real and stays real. The zero run
  // continues on both sides, so the opening's edges become atom boundaries.
  const legacyEraOpenings: OpeningCfg[] = legacyCuts.length
    ? ((Array.isArray(space.openings) ? space.openings : []) as OpeningCfg[])
      .filter((opening) => opening.host?.kind !== 'partition'
        && [Number(opening.x), Number(opening.y)].every(Number.isFinite)
        && Number.isFinite(Number(opening.angle))
        && Number(opening.length) > 0
        // Only an opening that actually stands on a legacy cut changes the
        // atomization; unrelated openings must not churn the catalogue.
        && legacyCuts.some((cut) => distanceToSegment(
          [Number(opening.x), Number(opening.y)],
          [cut[0], cut[1]], [cut[2], cut[3]],
        ) <= GRID_STEP_N * 0.04))
    : [];
  const openingEdgeBreaks: WallEntry[] = legacyEraOpenings.map((opening) => {
    const rad = (Number(opening.angle) * Math.PI) / 180;
    const dir = [Math.cos(rad), Math.sin(rad)];
    const half = Number(opening.length) / 2;
    const centre = [Number(opening.x), Number(opening.y)];
    return {
      a: [centre[0] - dir[0] * half, centre[1] - dir[1] * half],
      b: [centre[0] + dir[0] * half, centre[1] + dir[1] * half],
    } as WallEntry;
  });
  const atomCarriesOpening = (a: number[], b: number[]): boolean => (
    legacyEraOpenings.some((opening) => {
      const centre = [Number(opening.x), Number(opening.y)];
      if (!wallAngleMatches(a, b, Number(opening.angle))) return false;
      if (distanceToSegment(centre, a, b) > GRID_STEP_N * 0.02) return false;
      const span = lengthOf(a, b);
      const tc = projectT(centre, a, b) * span;
      const half = Number(opening.length) / 2;
      return tc + half >= -EPS && tc - half <= span + EPS;
    })
  );
  const byKey = new Map<string, Atom>();
  const nextRooms: any[] = [];
  for (const rawRoom of rooms) {
    const id = String(rawRoom?.id || '');
    const original = roomPoly(rawRoom);
    if (!id || !original || original.length < 3) throw new WallSegmentModelError('invalid-room', id);
    const atomic = atomicPolyForRoom(
      rooms, id, cuts, GRID_STEP_N, 1,
      [...(space.walls || []), ...openingEdgeBreaks],
    );
    if (!atomic || atomic.poly.length < 3) throw new WallSegmentModelError('invalid-room', id);
    const oldIds = Array.isArray(rawRoom.wall_ids) ? rawRoom.wall_ids : [];
    const indexedLineageIsValid = oldIds.length === original.length;
    let rigidDelta: [number, number] | null = null;
    let rigidIndexedLineage = indexedLineageIsValid;
    if (rigidIndexedLineage) {
      for (let index = 0; index < original.length; index++) {
        const previous = old.get(oldIds[index]);
        const delta = previous
          ? translatedSegmentDelta(original[index], original[(index + 1) % original.length], previous)
          : null;
        if (!delta || (rigidDelta && (
          Math.abs(delta[0] - rigidDelta[0]) > EPS
          || Math.abs(delta[1] - rigidDelta[1]) > EPS
        ))) {
          rigidIndexedLineage = false;
          break;
        }
        rigidDelta = delta;
      }
    }
    const wallIds: string[] = [];
    for (let index = 0; index < atomic.poly.length; index++) {
      const a = atomic.poly[index], b = atomic.poly[(index + 1) % atomic.poly.length];
      if (lengthOf(a, b) <= EPS) throw new WallSegmentModelError('zero-length', id);
      const key = atomKey(a, b);
      let atom = byKey.get(key);
      if (!atom) {
        const [ca, cb] = canonicalSpan(a, b);
        atom = {
          key, a: ca, b: cb, owners: new Set(), preferredIds: new Set(),
          positionalIds: new Set(),
          preferredCarriers: new Map(), parentKeys: new Set(), zeroWall: false,
        };
        byKey.set(key, atom);
      }
      atom.owners.add(id);
      if (atom.owners.size > 2) throw new WallSegmentModelError('third-owner', key);
      const preferred = indexedLineageIsValid ? oldIds[atomic.parent[index]] : undefined;
      if (typeof preferred === 'string' && preferred) {
        const previous = old.get(preferred);
        // An index is a strong hint only while it still names the same
        // physical carrier. During a room split an edge can keep its ordinal
        // but become the new divider; a promoted draft ID on that divider must
        // outrank the stale ordinal. Pure rigid moves retain the ordinal as a
        // fallback because none of their old carriers overlap new geometry.
        if (rigidIndexedLineage || !previous
            || collinearOverlap(a, b, previous.a, previous.b) > EPS)
          atom.preferredIds.add(preferred);
        else atom.positionalIds.add(preferred);
        atom.preferredCarriers.set(preferred, {
          a: point(original[atomic.parent[index]]),
          b: point(original[(atomic.parent[index] + 1) % original.length]),
        });
      }
      const parent = atomic.parent[index];
      atom.parentKeys.add(wallKey(
        original[parent], original[(parent + 1) % original.length], GRID_STEP_N,
      ));
      const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const coveredBy = (list: number[][]): boolean => list.some((cut) => distanceToSegment(
        midpoint, [cut[0], cut[1]], [cut[2], cut[3]],
      ) <= GRID_STEP_N * 0.04);
      // Canonical cm:0 atoms stay zero; a LEGACY cut spares the atom that
      // carries an opening (#316 §3.1).
      atom.zeroWall ||= coveredBy(canonicalZeroCuts)
        || (coveredBy(legacyCuts) && !atomCarriesOpening(a, b));
      wallIds.push(key); // replaced with stable ids after lineage resolution
    }
    // Re-add the owned field last on every pass.  Several legacy maintenance
    // helpers legitimately rebuild `open_to`; without this normalization the
    // semantic object is identical but JSON key order oscillates forever and
    // Optimize can never become byte-idempotent.
    const nextRoom = { ...rawRoom };
    delete nextRoom.wall_ids;
    nextRooms.push({
      ...nextRoom,
      poly: atomic.poly.map((p) => [p[0], p[1]]),
      wall_ids: wallIds,
    });
  }
  return { atoms: [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)), rooms: nextRooms };
};

/**
 * Preserve ordinal carrier identity for an operation that kept every edited
 * room's coarse topology. Atom counts must agree edge-by-edge; otherwise the
 * ordinary split/merge lineage rules remain authoritative.
 */
export const fixedTopologyWallLineageHints = (
  baselineSpace: any, beforeRooms: readonly any[], editedSpace: any,
): Map<string, string> => {
  const hints = new Map<string, string>();
  const baselineRooms = new Map((baselineSpace?.rooms || []).map((room: any) => [room.id, room]));
  const sourceRooms = new Map((beforeRooms || []).map((room: any) => [room.id, room]));
  const { rooms: editedRooms } = buildAtoms(editedSpace, oldSegmentMap(baselineSpace));
  for (const editedRoom of editedRooms) {
    const source: any = sourceRooms.get(editedRoom.id);
    const baseline: any = baselineRooms.get(editedRoom.id);
    const sourcePoly = roomPoly(source), editedRaw = (editedSpace.rooms || [])
      .find((room: any) => room.id === editedRoom.id);
    const editedRawPoly = roomPoly(editedRaw), baselinePoly = roomPoly(baseline);
    if (!sourcePoly || !editedRawPoly || !baselinePoly
        || sourcePoly.length !== editedRawPoly.length
        || baselinePoly.length !== baseline?.wall_ids?.length
        || editedRoom.poly.length !== editedRoom.wall_ids.length) continue;
    for (let edge = 0; edge < sourcePoly.length; edge++) {
      const orderedPieces = (poly: number[][], ids: string[], a: number[], b: number[]) => {
        const pieces: Array<{ start: number; id: string }> = [];
        for (let index = 0; index < poly.length; index++) {
          const pa = poly[index], pb = poly[(index + 1) % poly.length];
          if (distanceToSegment(pa, a, b) > EPS || distanceToSegment(pb, a, b) > EPS) continue;
          const start = projectT(pa, a, b), end = projectT(pb, a, b);
          if (start < -EPS || end > 1 + EPS || end <= start + EPS) continue;
          pieces.push({ start, id: ids[index] });
        }
        return pieces.sort((left, right) => left.start - right.start);
      };
      const oldPieces = orderedPieces(
        baselinePoly, baseline.wall_ids,
        sourcePoly[edge], sourcePoly[(edge + 1) % sourcePoly.length],
      );
      const newPieces = orderedPieces(
        editedRoom.poly, editedRoom.wall_ids,
        editedRawPoly[edge], editedRawPoly[(edge + 1) % editedRawPoly.length],
      );
      if (!oldPieces.length || oldPieces.length !== newPieces.length) continue;
      for (let index = 0; index < oldPieces.length; index++) {
        const existing = hints.get(newPieces[index].id);
        if (existing && existing !== oldPieces[index].id)
          throw new WallSegmentModelError('duplicate-id', newPieces[index].id);
        hints.set(newPieces[index].id, oldPieces[index].id);
      }
    }
  }
  return hints;
};

const assignLineage = (
  space: any, atoms: Atom[], old: Map<string, WallSegmentEntry>, initialMigration: boolean,
  lineageHints?: ReadonlyMap<string, string>,
): void => {
  const oldByKey = new Map([...old.values()].map((segment) => [atomKey(segment.a, segment.b), segment]));
  const hostCounts = openingHostCounts(space.openings || []);
  const proposed = new Map<Atom, WallSegmentEntry>();
  for (const atom of atoms) {
    const hintedId = lineageHints?.get(atom.key);
    if (hintedId) {
      const hinted = old.get(hintedId);
      if (!hinted) throw new WallSegmentModelError('duplicate-id', hintedId);
      proposed.set(atom, hinted);
      continue;
    }
    if (atom.preferredIds.size > 1) {
      throw new WallSegmentModelError('duplicate-id', [...atom.preferredIds].sort().join(','));
    }
    const preferredId = [...atom.preferredIds][0];
    const preferred = preferredId ? old.get(preferredId) : undefined;
    if (preferred) { proposed.set(atom, preferred); continue; }
    // Promotion from a persisted draft/partition supplies an ID which is not
    // in the old contour catalogue yet. Treat its old carrier exactly like a
    // contour split so only one child inherits it.
    const carrier = preferredId ? atom.preferredCarriers.get(preferredId) : undefined;
    if (preferredId && carrier) {
      proposed.set(atom, { id: preferredId, a: carrier.a, b: carrier.b, cm: 0 });
      continue;
    }
    const exact = oldByKey.get(atom.key);
    if (exact) { proposed.set(atom, exact); continue; }
    const overlaps = [...old.values()].filter((segment) => (
      collinearOverlap(atom.a, atom.b, segment.a, segment.b) > EPS
    ));
    // Geometry proves split/merge lineage more strongly than a stale edge
    // index.  Positional preference is the rigid-move fallback only when the
    // edited segment no longer overlaps its previous coordinates at all.
    const candidates = [...new Map(overlaps
      .map((item) => [item.id, item])).values()];
    candidates.sort((left, right) => (
      (hostCounts.get(right.id) || 0) - (hostCounts.get(left.id) || 0)
      || lengthOf(right.a, right.b) - lengthOf(left.a, left.b)
      || left.id.localeCompare(right.id)
    ));
    if (candidates[0]) proposed.set(atom, candidates[0]);
    else if (atom.positionalIds.size === 1) {
      const positional = old.get([...atom.positionalIds][0]);
      if (positional) proposed.set(atom, positional);
    }
  }
  const byId = new Map<string, Atom[]>();
  for (const [atom, segment] of proposed) {
    const list = byId.get(segment.id) || [];
    list.push(atom);
    byId.set(segment.id, list);
  }
  for (const [id, candidates] of byId) {
    const oldSegment = old.get(id) || proposed.get(candidates[0]);
    if (!oldSegment) throw new WallSegmentModelError('duplicate-id', id);
    const midpoint = [
      (oldSegment.a[0] + oldSegment.b[0]) / 2,
      (oldSegment.a[1] + oldSegment.b[1]) / 2,
    ];
    candidates.sort((left, right) => {
      const midpointLeft = distanceToSegment(midpoint, left.a, left.b) <= EPS ? 0 : 1;
      const midpointRight = distanceToSegment(midpoint, right.a, right.b) <= EPS ? 0 : 1;
      if (midpointLeft !== midpointRight) return midpointLeft - midpointRight;
      const oldALeft = distanceToSegment(oldSegment.a, left.a, left.b) <= EPS ? 0 : 1;
      const oldARight = distanceToSegment(oldSegment.a, right.a, right.b) <= EPS ? 0 : 1;
      return oldALeft - oldARight || left.key.localeCompare(right.key);
    });
    candidates[0].id = id;
  }
  const used = nonCatalogIds(space);
  for (const atom of atoms) {
    if (!atom.id) continue;
    if (used.has(atom.id)) throw new WallSegmentModelError('duplicate-id', atom.id);
    used.add(atom.id);
  }
  const unassigned = atoms.filter((atom) => !atom.id);
  if (initialMigration) {
    // A truncated-digest collision is resolved by full-digest order, then the
    // documented -2/-3 suffix. This is deterministic even if room order is not.
    const seeds = unassigned.map((atom) => {
      const [ca, cb] = canonicalSpan(atom.a, atom.b);
      const seed = `${String(space.id || '')}|${pointKey(ca)}|${pointKey(cb)}|${[...atom.owners].sort().join(',')}`;
      const digest = base32(sha256(seed));
      return { atom, seed, digest, base: `wall-${digest.slice(0, 20)}` };
    }).sort((left, right) => left.digest.localeCompare(right.digest) || left.atom.key.localeCompare(right.atom.key));
    const fullDigests = new Map<string, string>();
    for (const entry of seeds) {
      const previousSeed = fullDigests.get(entry.digest);
      if (previousSeed && previousSeed !== entry.seed)
        throw new WallSegmentModelError('duplicate-id', entry.digest);
      fullDigests.set(entry.digest, entry.seed);
      let suffix = 1;
      let id = entry.base;
      while (used.has(id)) id = `${entry.base}-${++suffix}`;
      entry.atom.id = id;
      used.add(id);
    }
  } else {
    for (const atom of unassigned) {
      atom.id = freshWallSegmentId(used);
      used.add(atom.id);
    }
  }
};

/** Resolve one contour-opening owner using the same fail-closed rule as the
 * structural writer. UI gestures use this before entering the v9 barrier, so
 * the live candidate never contains a stale/missing host during a valid move. */
export const resolveRoomOpeningHost = (
  opening: OpeningCfg, segments: readonly WallSegmentEntry[],
): WallOpeningHost | null => {
  if (opening.host?.kind === 'partition') return null;
  const centre = [Number(opening.x), Number(opening.y)];
  if (!centre.every(Number.isFinite)) return null;
  const eligible = (segment: WallSegmentEntry): boolean => {
    if (!(Number(segment.cm) > 0)) return false;
    const t = projectT(centre, segment.a, segment.b);
    const span = lengthOf(segment.a, segment.b);
    const half = Number(opening.length) / 2;
    return t >= -EPS && t <= 1 + EPS
      && distanceToSegment(centre, segment.a, segment.b) <= GRID_STEP_N * 0.02
      && wallAngleMatches(segment.a, segment.b, Number(opening.angle))
      && Number.isFinite(half) && half >= 0
      && t * span - half >= -EPS && t * span + half <= span + EPS;
  };
  const current = opening.host?.kind === 'wall'
    ? segments.find((segment) => segment.id === opening.host!.id)
    : null;
  const candidates = current && eligible(current) ? [current] : segments.filter(eligible);
  if (candidates.length !== 1) return null;
  const host = candidates[0];
  return {
    kind: 'wall', id: host.id,
    t: Math.max(0, Math.min(1, projectT(centre, host.a, host.b))),
  };
};

/** #316 §3.2/§3.3: deterministic migration-time host resolution. Returns null
 * only when the space has no usable carrier at all — the opening then persists
 * unhosted (§3.3) instead of blocking the migration. */
const migrateRoomOpeningHost = (
  opening: OpeningCfg, segments: readonly WallSegmentEntry[],
): WallOpeningHost | null => {
  const centre = [Number(opening.x), Number(opening.y)];
  if (!centre.every(Number.isFinite)) return null;
  const half = Number(opening.length) / 2;
  const eligible = segments.filter((segment) => {
    if (!(Number(segment.cm) > 0)) return false;
    const t = projectT(centre, segment.a, segment.b);
    const span = lengthOf(segment.a, segment.b);
    return t >= -EPS && t <= 1 + EPS
      && distanceToSegment(centre, segment.a, segment.b) <= GRID_STEP_N * 0.02
      && wallAngleMatches(segment.a, segment.b, Number(opening.angle))
      && Number.isFinite(half) && half >= 0
      && t * span - half >= -EPS && t * span + half <= span + EPS;
  });
  // §3.2 tie-break: current host → distance → thicker cm → smaller id.
  const pick = (candidates: readonly WallSegmentEntry[]): WallSegmentEntry | null => {
    if (!candidates.length) return null;
    const current = opening.host?.kind === 'wall'
      ? candidates.find((segment) => segment.id === opening.host!.id) : null;
    if (current) return current;
    return [...candidates].sort((x, y) => (
      distanceToSegment(centre, x.a, x.b) - distanceToSegment(centre, y.a, y.b)
      || Number(y.cm) - Number(x.cm)
      || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)
    ))[0];
  };
  // §3.3 degraded pool: angle- and capacity-compatible positive walls at any
  // distance, nearest first.
  const degraded = segments.filter((segment) => (
    Number(segment.cm) > 0
    && wallAngleMatches(segment.a, segment.b, Number(opening.angle))
    && Number.isFinite(half) && half >= 0
    && lengthOf(segment.a, segment.b) + EPS >= Number(opening.length)
  ));
  const host = pick(eligible) ?? pick(degraded);
  if (!host) return null;
  return {
    kind: 'wall', id: host.id,
    t: Math.max(0, Math.min(1, projectT(centre, host.a, host.b))),
  };
};

const hostRoomOpenings = (
  space: any, segments: readonly WallSegmentEntry[], initialMigration: boolean,
): void => {
  const openings: OpeningCfg[] = Array.isArray(space.openings) ? space.openings : [];
  for (const opening of openings) {
    if (opening.host?.kind === 'partition') continue;
    // #316 §3.3: an unhosted opening is a valid degraded v9 state — inert in
    // the physics, rendered by its own x/y. A later write keeps it and may
    // self-heal it when a unique carrier appears; it never blocks the write.
    if (!opening.host && !initialMigration) {
      const healed = resolveRoomOpeningHost(opening, segments);
      if (healed) opening.host = healed;
      continue;
    }
    const host = resolveRoomOpeningHost(opening, segments)
      ?? (initialMigration ? migrateRoomOpeningHost(opening, segments) : null);
    if (host) { opening.host = host; continue; }
    // #316 §3.4: the initial migration never throws over an opening; a
    // post-v9 write that LOST a carrier keeps the fail-closed refusal.
    if (initialMigration) { delete opening.host; continue; }
    throw new WallSegmentModelError('opening-host', opening.id);
  }
};

const migrateDraftSegments = (space: any, initialMigration: boolean): void => {
  const used = new Set<string>();
  for (const collection of [
    space.rooms, space.openings, space.decor, space.room_drafts, space.partitions,
    space.wall_columns, space.wall_segments,
  ]) {
    for (const item of Array.isArray(collection) ? collection : []) {
      if (typeof item?.id === 'string' && item.id) used.add(item.id);
    }
  }
  for (const draft of Array.isArray(space.room_drafts) ? space.room_drafts : []) {
    const segments = Array.isArray(draft.segments) ? draft.segments : [];
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      if (typeof segment.id === 'string' && segment.id) {
        if (used.has(segment.id)) throw new WallSegmentModelError('duplicate-id', segment.id);
        used.add(segment.id);
        continue;
      }
      const a = draft.points?.[index], b = draft.points?.[index + 1];
      if (!finitePoint(a) || !finitePoint(b)) throw new WallSegmentModelError('zero-length', draft.id);
      if (initialMigration) {
        const base = deterministicWallSegmentId(
          String(space.id || ''), a, b, [`draft:${String(draft.id || '')}`],
        );
        let suffix = 1;
        segment.id = base;
        while (used.has(segment.id)) segment.id = `${base}-${++suffix}`;
      } else segment.id = freshWallSegmentId(used);
      used.add(segment.id);
    }
  }
};

const resolvedThicknessCm = (
  space: any, atom: Atom, previous: WallSegmentEntry | undefined,
): number => {
  if (atom.zeroWall) return 0;
  const walls: WallEntry[] = Array.isArray(space.walls) ? space.walls : [];
  const ownKey = wallKey(atom.a, atom.b, GRID_STEP_N);
  const candidates = walls.filter((wall) => {
    if (!(Number(wall.cm) > 0)) return false;
    if (wall.key === ownKey || atom.parentKeys.has(wall.key)) return true;
    if (!finitePoint(wall.a) || !finitePoint(wall.b)) return false;
    return collinearOverlap(atom.a, atom.b, wall.a, wall.b) >= lengthOf(atom.a, atom.b) - EPS;
  }).map((wall) => Math.max(1, Math.min(100, Number(wall.cm))));
  const unique = new Set(candidates.map((cm) => cm.toFixed(9)));
  if (unique.size > 1) throw new WallSegmentModelError('thickness-conflict', atom.key);
  if (candidates.length) return candidates[0];
  const resolved = thicknessCmAt(walls, atom.a, atom.b, GRID_STEP_N, 1);
  if (resolved > 0) return resolved;
  return Number(previous?.cm) > 0 ? Number(previous!.cm) : 0;
};

const migrateSpace = (
  space: any, initialMigration: boolean, lineageHints?: ReadonlyMap<string, string>,
): number => {
  const old = oldSegmentMap(space);
  const { atoms, rooms } = buildAtoms(space, old);
  assignLineage(space, atoms, old, initialMigration, lineageHints);
  const segments = atoms.map((atom): WallSegmentEntry => {
    const previous = atom.id ? old.get(atom.id) : undefined;
    const cm = resolvedThicknessCm(space, atom, previous);
    return {
      ...(previous || {}), id: atom.id!, a: [...atom.a], b: [...atom.b], cm,
    };
  });
  const idByKey = new Map(atoms.map((atom) => [atom.key, atom.id!]));
  for (const room of rooms) room.wall_ids = room.wall_ids.map((key: string) => idByKey.get(key)!);
  space.rooms = rooms;
  space.wall_segments = segments;
  space.walls = segments.filter((segment) => segment.cm > 0).map((segment) => ({
    key: wallKey(segment.a, segment.b, GRID_STEP_N),
    cm: segment.cm, a: [...segment.a], b: [...segment.b],
  }));
  if (!space.walls.length) delete space.walls;
  delete space.open_spans;
  for (const room of space.rooms) delete room.open_to;
  migrateDraftSegments(space, initialMigration);
  hostRoomOpenings(space, segments, initialMigration);
  return segments.reduce((count, segment) => count + (old.has(segment.id) ? 0 : 1), 0);
};

/** Pure, atomic structural candidate. Read paths must never call this helper. */
export function commitWallSegmentModel<T>(
  input: T, options: WallSegmentCommitOptions = {},
): WallSegmentCommitResult<T> {
  const before = JSON.stringify(input);
  const config: any = clone(input);
  canonicalizeConfigGeometryInPlace(config);
  let migratedSegments = 0;
  const initialMigration = Number(config?.model_version || 0) < WALL_SEGMENT_MODEL_VERSION;
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    const hints = options.lineageSpaceId === String(space?.id || '')
      ? options.lineageHints : undefined;
    migratedSegments += migrateSpace(space, initialMigration, hints);
  }
  config.model_version = WALL_SEGMENT_MODEL_VERSION;
  canonicalizeConfigGeometryInPlace(config);
  return { config, changed: before !== JSON.stringify(config), migratedSegments };
}

const isRecord = (value: unknown): value is Record<string, any> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

/**
 * Adopt an already validated candidate without invalidating references held by
 * an active editor gesture.  The editor historically mutates the current
 * space and its id-bearing children in place; replacing the complete config
 * after the identity barrier would leave those references attached to a
 * detached document until the next interaction.
 */
export function adoptWallSegmentModelCandidateInPlace<T>(target: T, candidate: T): T {
  const adopt = (current: any, next: any): any => {
    if (Array.isArray(current) && Array.isArray(next)) {
      const currentById = new Map<string, any>();
      for (const item of current) {
        if (isRecord(item) && typeof item.id === 'string' && item.id)
          currentById.set(item.id, item);
      }
      const adopted = next.map((item, index) => {
        if (isRecord(item) && typeof item.id === 'string' && item.id) {
          const existing = currentById.get(item.id);
          return existing ? adopt(existing, item) : clone(item);
        }
        return index < current.length ? adopt(current[index], item) : clone(item);
      });
      current.splice(0, current.length, ...adopted);
      return current;
    }
    if (isRecord(current) && isRecord(next)) {
      const entries = Object.entries(next).map(([key, value]) => [
        key,
        key in current ? adopt(current[key], value) : clone(value),
      ] as const);
      // Reinsert in candidate order as well as adopting candidate values.
      // JSON byte idempotence is part of Optimize and history snapshots; an
      // in-place adapter must not retain stale property order from its target.
      for (const key of Object.keys(current)) delete current[key];
      for (const [key, value] of entries) current[key] = value;
      return current;
    }
    return clone(next);
  };
  return adopt(target, candidate);
}

/** In-place adapter for the already-pure Optimize candidate. */
export function commitWallSegmentModelInPlace<T>(input: T): WallSegmentCommitResult<T> {
  const result = commitWallSegmentModel(input);
  adoptWallSegmentModelCandidateInPlace(input, result.config);
  return { ...result, config: input };
}
