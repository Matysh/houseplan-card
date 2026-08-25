/**
 * Persisted identity for contour-wall atoms (ADR 282, Stage 1).
 *
 * The editor still renders through the legacy `walls[]` projection.  This
 * module is the single structural-write barrier which owns the canonical v8
 * catalogue and regenerates that projection.  It is deliberately DOM-free so
 * the frontend and migration contracts can be exercised as pure tests.
 */

import { canonicalizeConfigGeometryInPlace } from './coordinate-canonicalization';
import { roomPoly } from './logic';
import { sanitizeOpenSpans } from './open-spans';
import { GRID_STEP_N } from './space-geometry';
import {
  atomicPolyForRoom, thicknessCmAt, wallAngleMatches, wallKey, type WallEntry,
} from './wall-thickness';
import type { OpeningCfg, WallSegmentEntry } from './types';

export const WALL_SEGMENT_MODEL_VERSION = 8;
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

type Point = [number, number];
type Atom = {
  key: string;
  a: Point;
  b: Point;
  owners: Set<string>;
  preferredIds: Set<string>;
  preferredCarriers: Map<string, { a: Point; b: Point }>;
  parentKeys: Set<string>;
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

const openingHostCounts = (openings: readonly OpeningCfg[]): Map<string, number> => {
  const result = new Map<string, number>();
  for (const opening of openings) {
    if (opening.host?.kind !== 'wall') continue;
    result.set(opening.host.id, (result.get(opening.host.id) || 0) + 1);
  }
  return result;
};

const buildAtoms = (space: any): { atoms: Atom[]; rooms: any[] } => {
  const rooms = Array.isArray(space.rooms) ? space.rooms : [];
  const cuts = sanitizeOpenSpans(space.open_spans).map((entry) => [
    entry.a[0], entry.a[1], entry.b[0], entry.b[1],
  ]);
  const byKey = new Map<string, Atom>();
  const nextRooms: any[] = [];
  for (const rawRoom of rooms) {
    const id = String(rawRoom?.id || '');
    const original = roomPoly(rawRoom);
    if (!id || !original || original.length < 3) throw new WallSegmentModelError('invalid-room', id);
    const atomic = atomicPolyForRoom(rooms, id, cuts, GRID_STEP_N, 1, space.walls || []);
    if (!atomic || atomic.poly.length < 3) throw new WallSegmentModelError('invalid-room', id);
    const oldIds = Array.isArray(rawRoom.wall_ids) ? rawRoom.wall_ids : [];
    const indexedLineageIsValid = oldIds.length === original.length;
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
          preferredCarriers: new Map(), parentKeys: new Set(),
        };
        byKey.set(key, atom);
      }
      atom.owners.add(id);
      if (atom.owners.size > 2) throw new WallSegmentModelError('third-owner', key);
      const preferred = indexedLineageIsValid ? oldIds[atomic.parent[index]] : undefined;
      if (typeof preferred === 'string' && preferred) {
        atom.preferredIds.add(preferred);
        atom.preferredCarriers.set(preferred, {
          a: point(original[atomic.parent[index]]),
          b: point(original[(atomic.parent[index] + 1) % original.length]),
        });
      }
      const parent = atomic.parent[index];
      atom.parentKeys.add(wallKey(
        original[parent], original[(parent + 1) % original.length], GRID_STEP_N,
      ));
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

const assignLineage = (
  space: any, atoms: Atom[], old: Map<string, WallSegmentEntry>, initialMigration: boolean,
): void => {
  const oldByKey = new Map([...old.values()].map((segment) => [atomKey(segment.a, segment.b), segment]));
  const hostCounts = openingHostCounts(space.openings || []);
  const proposed = new Map<Atom, WallSegmentEntry>();
  for (const atom of atoms) {
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

const hostRoomOpenings = (space: any, segments: readonly WallSegmentEntry[]): void => {
  const openings: OpeningCfg[] = Array.isArray(space.openings) ? space.openings : [];
  for (const opening of openings) {
    if (opening.host?.kind === 'partition') continue;
    const centre = [Number(opening.x), Number(opening.y)];
    if (!centre.every(Number.isFinite)) throw new WallSegmentModelError('opening-host', opening.id);
    const eligible = (segment: WallSegmentEntry): boolean => {
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
    if (candidates.length !== 1) throw new WallSegmentModelError('opening-host', opening.id);
    const host = candidates[0];
    opening.host = {
      kind: 'wall', id: host.id,
      t: Math.max(0, Math.min(1, projectT(centre, host.a, host.b))),
    };
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

const migrateSpace = (space: any, initialMigration: boolean): number => {
  const old = oldSegmentMap(space);
  const { atoms, rooms } = buildAtoms(space);
  assignLineage(space, atoms, old, initialMigration);
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
  migrateDraftSegments(space, initialMigration);
  hostRoomOpenings(space, segments);
  return segments.reduce((count, segment) => count + (old.has(segment.id) ? 0 : 1), 0);
};

/** Pure, atomic structural candidate. Read paths must never call this helper. */
export function commitWallSegmentModel<T>(input: T): WallSegmentCommitResult<T> {
  const before = JSON.stringify(input);
  const config: any = clone(input);
  canonicalizeConfigGeometryInPlace(config);
  let migratedSegments = 0;
  const initialMigration = Number(config?.model_version || 0) < WALL_SEGMENT_MODEL_VERSION;
  for (const space of Array.isArray(config?.spaces) ? config.spaces : []) {
    migratedSegments += migrateSpace(space, initialMigration);
  }
  config.model_version = WALL_SEGMENT_MODEL_VERSION;
  canonicalizeConfigGeometryInPlace(config);
  return { config, changed: before !== JSON.stringify(config), migratedSegments };
}

/** In-place adapter for the already-pure Optimize candidate. */
export function commitWallSegmentModelInPlace<T>(input: T): WallSegmentCommitResult<T> {
  const result = commitWallSegmentModel(input);
  const target: any = input;
  for (const key of Object.keys(target || {})) delete target[key];
  Object.assign(target, result.config);
  return { ...result, config: input };
}
