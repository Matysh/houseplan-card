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
