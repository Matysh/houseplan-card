import { commitWallSegmentModel } from './wall-segment-model';
import { GRID_STEP_N } from './space-geometry';
import { wallKey, type WallEntry } from './wall-thickness';
import type { OpeningCfg } from './types';

/** Frozen correspondence between user-facing Resize runs and stored atoms. */
export interface ResizeAtomProjection {
  source: number[][];
  atoms: Array<{ corner: number } | { run: number; point: number[] }>;
  epsilon: number;
}
export interface ResizeAtomSegment { a: number[]; b: number[]; cm: number }
export interface ResizeAtomContour { id: string; poly: number[][]; wall_ids: string[] }
export interface ResizeAtomContext {
  rooms: Map<string, ResizeAtomProjection>; catalogue: Map<string, ResizeAtomSegment>; consumers: ResizeAtomContour[];
}

/** Copy just the changed-ID owner closure once, never retaining mutable snapshot arrays. */
export function prepareResizeAtomContext(
  rooms: readonly { id: string; poly: number[][]; wall_ids?: string[] }[],
  segments: readonly (ResizeAtomSegment & { id: string })[], changedIds: readonly string[],
): ResizeAtomContext | null {
  const affectedIds = new Set(rooms.filter(room => changedIds.includes(room.id))
    .flatMap(room => Array.isArray(room.wall_ids) ? room.wall_ids : []));
  const catalogue = new Map(segments.map(segment => [segment.id, {
    a: [...segment.a], b: [...segment.b], cm: segment.cm,
  }]));
  if (catalogue.size !== segments.length) return null;
  const consumers = rooms.filter(room => Array.isArray(room.wall_ids)
    && room.wall_ids.some(id => affectedIds.has(id))).map(room => ({
    id: room.id, poly: room.poly.map(p => [...p]), wall_ids: [...room.wall_ids!],
  }));
  return { rooms: new Map(), catalogue, consumers };
}

/** Propose each atom by stored ID; shared owners must agree in either orientation. */
export function projectResizeAtomCatalogue(
  source: readonly ResizeAtomContour[], targets: ReadonlyMap<string, number[][]>,
  catalogue: ReadonlyMap<string, ResizeAtomSegment>, epsilon: number,
): Map<string, { a: number[]; b: number[] }> | null {
  const result = new Map<string, { a: number[]; b: number[] }>();
  for (const room of source) {
    const target = targets.get(room.id);
    if (!target) continue;
    if (target.length !== room.poly.length || target.length !== room.wall_ids.length
        || !target.every(finitePoint)) return null;
    for (let i = 0; i < target.length; i++) {
      const id = room.wall_ids[i], j = (i + 1) % target.length, segment = catalogue.get(id);
      if (!segment) return null;
      const forward = near(segment.a, room.poly[i], epsilon) && near(segment.b, room.poly[j], epsilon);
      const reverse = near(segment.b, room.poly[i], epsilon) && near(segment.a, room.poly[j], epsilon);
      if (forward === reverse) return null;
      const proposed = { a: [...target[forward ? i : j]], b: [...target[forward ? j : i]] };
      const prior = result.get(id);
      if (prior && (!near(prior.a, proposed.a, epsilon) || !near(prior.b, proposed.b, epsilon))) return null;
      result.set(id, proposed);
    }
  }
  return result;
}

/** Synchronise compatibility consumers of changed authoritative atoms. */
export function projectResizeAtomConsumers(
  consumers: readonly ResizeAtomContour[], catalogue: ReadonlyMap<string, ResizeAtomSegment>,
  updates: ReadonlyMap<string, { a: number[]; b: number[] }>, moving: ReadonlySet<string>, epsilon: number,
): Map<string, number[][]> | null {
  const result = new Map<string, number[][]>();
  for (const room of consumers) {
    if (!room.wall_ids.some(id => updates.has(id))) continue;
    if (room.poly.length !== room.wall_ids.length || room.poly.length < 3) return null;
    const starts: number[][] = [], ends: number[][] = [];
    for (let i = 0; i < room.poly.length; i++) {
      const id = room.wall_ids[i], segment = catalogue.get(id), j = (i + 1) % room.poly.length;
      if (!segment) return null;
      const forward = near(segment.a, room.poly[i], epsilon) && near(segment.b, room.poly[j], epsilon);
      const reverse = near(segment.b, room.poly[i], epsilon) && near(segment.a, room.poly[j], epsilon);
      if (forward === reverse) return null;
      const next = updates.get(id) || segment;
      starts.push([...(forward ? next.a : next.b)]); ends.push([...(forward ? next.b : next.a)]);
    }
    for (let i = 0; i < room.poly.length; i++) {
      const previous = (i - 1 + room.poly.length) % room.poly.length;
      if (!near(starts[i], ends[previous], epsilon)) return null;
      if (moving.has(room.id) || near(starts[i], room.poly[i], epsilon)) continue;
      const a = room.poly[previous], b = room.poly[(i + 1) % room.poly.length], p = room.poly[i], n = starts[i];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const onInterior = (q: number[]) => length > epsilon
        && Math.abs((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) <= epsilon * length
        && (q[0] - a[0]) * dx + (q[1] - a[1]) * dy > epsilon * length
        && (q[0] - b[0]) * dx + (q[1] - b[1]) * dy < -epsilon * length;
      if (!onInterior(p) || !onInterior(n)
          || catalogue.get(room.wall_ids[previous])?.cm !== catalogue.get(room.wall_ids[i])?.cm) return null;
    }
    result.set(room.id, starts);
  }
  return result;
}
const finitePoint = (p: readonly number[]): boolean => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const near = (a: readonly number[], b: readonly number[], eps: number): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps;

/** An unchanged owner's real corner can separate two shared side-wall atoms.
 * Keep that corner fixed: this is a structural split, not consumer motion.
 * Only overlapping, same-carrier changes qualify; malformed/ambiguous IDs,
 * displaced carriers and conflicting derived vertices still refuse.
 */
function hasResizeAtomCornerSplit(
  context: ResizeAtomContext, updates: ReadonlyMap<string, { a: number[]; b: number[] }>,
  moving: ReadonlySet<string>, epsilon: number,
): boolean {
  let split = false;
  for (const room of context.consumers) {
    if (moving.has(room.id)) continue;
    if (room.poly.length < 3 || room.poly.length !== room.wall_ids.length) return false;
    const starts: number[][] = [], ends: number[][] = [];
    for (let i = 0; i < room.poly.length; i++) {
      const a = room.poly[i], b = room.poly[(i + 1) % room.poly.length];
      const old = context.catalogue.get(room.wall_ids[i]);
      if (!old) return false;
      const forward = near(old.a, a, epsilon) && near(old.b, b, epsilon);
      const reverse = near(old.b, a, epsilon) && near(old.a, b, epsilon);
      if (forward === reverse) return false;
      const next = updates.get(room.wall_ids[i]) || old;
      const start = forward ? next.a : next.b, end = forward ? next.b : next.a;
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const t = (p: number[]) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length);
      if (!(length > epsilon) || !finitePoint(start) || !finitePoint(end)
          || [start, end].some(p => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) > epsilon * length)
          || t(end) - t(start) <= epsilon / length
          || Math.min(1, t(end)) - Math.max(0, t(start)) <= epsilon / length) return false;
      starts.push(start); ends.push(end);
    }
    for (let i = 0; i < room.poly.length; i++) {
      const previous = (i - 1 + room.poly.length) % room.poly.length;
      const a = room.poly[previous], p = room.poly[i], b = room.poly[(i + 1) % room.poly.length];
      if (near(starts[i], p, epsilon) && near(ends[previous], p, epsilon)) continue;
      const corner = Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]))
        > epsilon * (Math.hypot(p[0] - a[0], p[1] - a[1]) + Math.hypot(b[0] - p[0], b[1] - p[1]));
      if (corner) {
        if (!near(starts[i], p, epsilon) && !near(ends[previous], p, epsilon)) return false;
        split = true;
      } else if (!near(starts[i], ends[previous], epsilon)
          || context.catalogue.get(room.wall_ids[previous])?.cm !== context.catalogue.get(room.wall_ids[i])?.cm) return false;
    }
  }
  return split;
}

/** Complete the stored candidate before physical/junction proof and paint.
 * The ordinary path preserves every atom. Only a proven real corner split
 * crosses the existing structural barrier on the frozen owner closure; no fallback
 * moves an unchanged owner's corner or bypasses a failed ID correspondence.
 */
export function projectResizeStoredAtoms<T extends {
  id: string; rooms: Array<{ id: string; poly: number[][]; wall_ids?: string[] }>;
  wall_segments?: Array<ResizeAtomSegment & { id: string }>;
  walls?: WallEntry[]; openings?: OpeningCfg[]; cell_cm?: number;
}>(space: T, context: ResizeAtomContext, moving: ReadonlySet<string>, epsilon: number): T | null {
  const targets = new Map(space.rooms.filter(room => moving.has(room.id)).map(room => [room.id, room.poly]));
  const updates = projectResizeAtomCatalogue(context.consumers, targets, context.catalogue, epsilon);
  if (!updates) return null;
  const polygons = projectResizeAtomConsumers(context.consumers, context.catalogue, updates, moving, epsilon);
  const segments = (space.wall_segments || []).map(segment => ({ ...segment, ...(updates.get(segment.id) || {}) }));
  if (polygons) return { ...space, ...(space.wall_segments ? { wall_segments: segments } : {}),
    rooms: space.rooms.map(room => ({ ...room, poly: polygons.get(room.id) || room.poly })) };
  if (!hasResizeAtomCornerSplit(context, updates, moving, epsilon)) return null;
  try {
    const owners = new Set(context.consumers.map(room => room.id));
    const ids = new Set(context.consumers.flatMap(room => room.wall_ids));
    const localRooms = space.rooms.filter(room => owners.has(room.id));
    const localSegments = segments.filter(segment => ids.has(segment.id));
    // Authoritative carriers provide local thickness hints, including non-default
    // cm on new split children. Zero-thickness atoms remain in the catalogue.
    const walls: WallEntry[] = localSegments.filter(segment => segment.cm > 0).map(segment => ({
      key: wallKey(segment.a, segment.b, GRID_STEP_N), a: segment.a, b: segment.b, cm: segment.cm,
    }));
    const openings = (space.openings || []).filter(opening => opening.host?.kind === 'wall' && ids.has(opening.host.id));
    const candidate = { id: space.id, cell_cm: space.cell_cm, rooms: localRooms, walls, openings,
      wall_segments: localSegments };
    const materialized = commitWallSegmentModel({ spaces: [candidate] }).config.spaces[0];
    const replacement = new Map(materialized.wall_segments.map(segment => [segment.id, segment]));
    const original = new Map((space.wall_segments || []).map(segment => [segment.id, segment]));
    // A local unchanged atom can also serve an owner outside the closure.
    // That owner's carrier/ID must remain byte-identical, never be repaired.
    for (const room of space.rooms) if (!owners.has(room.id)) for (const id of room.wall_ids || []) {
      if (ids.has(id) && JSON.stringify(replacement.get(id)) !== JSON.stringify(original.get(id))) return null;
    }
    const retained = (space.wall_segments || []).flatMap(segment => {
      if (!ids.has(segment.id)) return [segment];
      const next = replacement.get(segment.id);
      replacement.delete(segment.id);
      return next ? [next] : [];
    });
    const roomsById = new Map(materialized.rooms.map(room => [room.id, room]));
    const openingsById = new Map(materialized.openings.map(opening => [opening.id, opening]));
    // Keep the proven legacy rekey ledger (including exact multiplicity).
    // Only local structural ownership/hosts cross the split barrier here;
    // the ordinary write barrier later derives the canonical walls projection.
    return { ...space, rooms: space.rooms.map(room => roomsById.get(room.id) || room),
      ...(space.openings ? { openings: space.openings.map(opening => openingsById.get(opening.id) || opening) } : {}),
      wall_segments: [...retained, ...replacement.values()] };
  } catch { return null; }
}

/** Every original vertex has exactly one oriented run/corner owner. */
export function prepareResizeAtomProjection(
  stored: readonly number[][], contour: readonly number[][], epsilon: number,
): ResizeAtomProjection | null {
  if (stored.length < 3 || contour.length < 3 || !Number.isFinite(epsilon) || epsilon <= 0
      || !stored.every(finitePoint) || !contour.every(finitePoint)) return null;
  const source = contour.map(p => [p[0], p[1]]), corners: number[] = [];
  for (const p of source) {
    const matches = stored.flatMap((q, i) => near(p, q, epsilon) ? [i] : []);
    if (matches.length !== 1) return null;
    corners.push(matches[0]);
  }
  const atoms: ResizeAtomProjection['atoms'] = new Array(stored.length);
  let visited = 0;
  for (let run = 0; run < source.length; run++) {
    const next = (run + 1) % source.length, a = source[run], b = source[next];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length <= epsilon) return null;
    let index = corners[run], lastT = -epsilon;
    while (index !== corners[next]) {
      if (atoms[index] || ++visited > stored.length) return null;
      const p = stored[index], t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length);
      if (Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) > epsilon * length
          || t < lastT || t < -epsilon / length || t >= 1) return null;
      atoms[index] = index === corners[run] ? { corner: run } : { run, point: [p[0], p[1]] };
      lastT = t; index = (index + 1) % stored.length;
    }
  }
  return visited === stored.length ? { source, atoms, epsilon } : null;
}

/** Rigid-run atoms translate; changing-length run breakpoints stay fixed. */
export function applyResizeAtomProjection(
  projection: ResizeAtomProjection, target: readonly number[][],
): number[][] | null {
  const { source, atoms, epsilon } = projection;
  if (target.length !== source.length || !target.every(finitePoint)) return null;
  const result = atoms.map(atom => {
    if ('corner' in atom) return [target[atom.corner][0], target[atom.corner][1]];
    const i = atom.run, j = (i + 1) % source.length;
    const a = [target[i][0] - source[i][0], target[i][1] - source[i][1]];
    const b = [target[j][0] - source[j][0], target[j][1] - source[j][1]];
    return near(a, b, epsilon) ? [atom.point[0] + a[0], atom.point[1] + a[1]] : [...atom.point];
  });
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i], run = 'corner' in atom ? atom.corner : atom.run, next = (run + 1) % target.length;
    const a = target[run], b = target[next], p = result[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length);
    if (!(length > epsilon) || !finitePoint(p)
        || Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) > epsilon * length
        || t < -epsilon / length || t >= 1
        || near(p, result[(i + 1) % result.length], epsilon)) return null;
  }
  return result;
}
