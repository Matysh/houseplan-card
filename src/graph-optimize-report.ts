/** Persisted model-11 effects, measured after the graph has accepted or refused targets. */
import { graphIndex, edgeKey } from './plan-graph';
import { cmp, decodePoint, pointToNumbers } from './plan-exact';
import { LATTICE_NOISE_STEPS, type LatticeSpaceReport } from './coordinate-canonicalization';
import { classifyNearAxisSegment } from './near-axis';
import type { OptimizeReport } from './plan-optimizer';

const NOISE = LATTICE_NOISE_STEPS / 240;
const cellOf = (space: any): number => Number(space?.cell_cm) > 0 ? Number(space.cell_cm) : 5;
const distance = (a: readonly number[], b: readonly number[]): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const byId = (items: any[] = []): Map<string, any> => new Map(items.map(item => [item.id, item]));

/** Numeric targets keep frozen graph bindings; their coordinates are not authority. */
function numericalNodes(space: any): Map<string, number[]> {
  const index = graphIndex(space.plan_graph), result = new Map<string, number[]>();
  const rooms = byId(space.rooms);
  for (const cycle of space.plan_graph.rooms) cycle.edges.forEach((reference: any, i: number) => {
    const edge = index.edges.get(edgeKey(reference))!;
    const point = rooms.get(cycle.room)?.poly?.[i];
    if (point) result.set(reference.reverse ? edge.to : edge.from, point);
  });
  for (const partition of space.partitions || []) {
    const edge = index.edges.get('partition:' + partition.id);
    if (!edge) continue;
    if (!result.has(edge.from)) result.set(edge.from, partition.a);
    if (!result.has(edge.to)) result.set(edge.to, partition.b);
  }
  return result;
}

/** Count only proposed near-axis walls that really became axis-aligned in the graph. */
export function measureGraphStraightening(before: any, proposed: any, written: any): {
  wallsStraightened: number; maxStraightenShiftCm: number; maxStraightenSpace: string;
} {
  const old = numericalNodes(before), target = numericalNodes(proposed);
  const index = graphIndex(written.plan_graph);
  let wallsStraightened = 0, maxStraightenShiftCm = 0;
  for (const edge of before.plan_graph.edges) {
    const a = old.get(edge.from), b = old.get(edge.to);
    const ta = target.get(edge.from), tb = target.get(edge.to);
    if (!a || !b || !ta || !tb || !classifyNearAxisSegment(a, b)) continue;
    const axis = ta[0] === tb[0] ? 0 : ta[1] === tb[1] ? 1 : -1;
    if (axis !== 0 && axis !== 1) continue;
    const wa = index.points.get(edge.from), wb = index.points.get(edge.to);
    if (!wa || !wb || cmp(wa[axis], wb[axis]) !== 0) continue;
    const na = pointToNumbers(wa), nb = pointToNumbers(wb);
    // Rejected off-grid dependent targets must not borrow another accepted move's report.
    if (distance(ta, na) > NOISE || distance(tb, nb) > NOISE) continue;
    const shift = Math.max(distance(a, na), distance(b, nb));
    if (!(shift > NOISE)) continue;
    wallsStraightened++;
    maxStraightenShiftCm = Math.max(maxStraightenShiftCm, shift * 240 * cellOf(written));
  }
  return { wallsStraightened, maxStraightenShiftCm,
    maxStraightenSpace: maxStraightenShiftCm ? String(written.id || '') : '' };
}

/** Match stable identities, never array indices or proximity. Deleted elements do not move. */
export function measureGraphOptimizeEffects(
  beforeSpaces: any[], afterSpaces: any[], beforeLayout: Record<string, any>, afterLayout: Record<string, any>,
): Pick<OptimizeReport, 'moved' | 'total' | 'maxShift' | 'maxShiftCm' | 'maxSpace' | 'rotated'
  | 'coordsCanonicalized' | 'latticeCoordinatesCanonicalized' | 'latticeCoordinatesFar'
  | 'latticeMaxShift' | 'latticeMaxShiftCm' | 'latticeSpaces' | 'openingParametersCanonicalized'
  | 'currentPositionsMoved' | 'archivedPositionsMoved'> {
  let moved = 0, total = 0, maxShift = 0, maxShiftCm = 0, maxSpace = '', rotated = 0;
  let latticeCoordinatesCanonicalized = 0, latticeCoordinatesFar = 0, latticeMaxShift = 0, latticeMaxShiftCm = 0;
  let openingParametersCanonicalized = 0, currentPositionsMoved = 0, archivedPositionsMoved = 0;
  const latticeSpaces = new Map<string, LatticeSpaceReport>(), spaces = byId(beforeSpaces);
  const farBySpace = new Map<string, number>();
  const cells = new Map(beforeSpaces.map(space => [String(space.id), cellOf(space)]));
  const worstCell = Math.max(5, ...cells.values());
  const note = (shift: number, space: any, absentSpace = ''): boolean => {
    total++;
    if (!(shift > NOISE)) return false;
    moved++;
    maxShift = Math.max(maxShift, shift);
    const cm = shift * 240 * (space ? cellOf(space) : worstCell);
    if (cm > maxShiftCm) { maxShiftCm = cm; maxSpace = String(space?.id || absentSpace); }
    return true;
  };
  const coordinate = (a: number, b: number, space: any, changed = a !== b): void => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const far = Math.abs(a * 240 - Math.round(a * 240)) >= LATTICE_NOISE_STEPS;
    if (far) {
      latticeCoordinatesFar++;
      if (space?.id) farBySpace.set(String(space.id), (farBySpace.get(String(space.id)) || 0) + 1);
    }
    const shift = Math.abs(b - a);
    if (!changed || shift > NOISE) return;
    latticeCoordinatesCanonicalized++;
    latticeMaxShift = Math.max(latticeMaxShift, shift);
    const cm = shift * 240 * (space ? cellOf(space) : worstCell);
    latticeMaxShiftCm = Math.max(latticeMaxShiftCm, cm);
    if (!space?.id) return;
    const id = String(space.id);
    const row = latticeSpaces.get(id) || { spaceId: id, space: String(space.title || id),
      canonicalized: 0, far: 0, maxShift: 0, maxShiftCm: 0 };
    row.canonicalized++; row.maxShift = Math.max(row.maxShift, shift); row.maxShiftCm = Math.max(row.maxShiftCm, cm);
    latticeSpaces.set(id, row);
  };
  const points = (a: number[][], b: number[][], space: any): number => {
    let shift = 0;
    a.forEach((p, i) => {
      if (!b[i]) return;
      shift = Math.max(shift, distance(p, b[i]));
      p.forEach((value, axis) => coordinate(value, b[i][axis], space));
    });
    return shift;
  };
  for (const next of afterSpaces) {
    const before = spaces.get(next.id);
    if (!before) continue;
    const index = graphIndex(next.plan_graph);
    for (const node of before.plan_graph.nodes) {
      const written = index.nodes.get(node.id);
      if (!written) continue;
      const a = decodePoint(node.p), b = decodePoint(written.p), na = pointToNumbers(a), nb = pointToNumbers(b);
      note(distance(na, nb), before);
      na.forEach((value, axis) => coordinate(value, nb[axis], before, cmp(a[axis], b[axis]) !== 0));
    }
    const openings = byId(next.openings);
    for (const opening of before.openings || []) {
      const written = openings.get(opening.id);
      if (!written) continue;
      const ends = (item: any): number[][] => {
        const angle = (Number(item.angle) || 0) * Math.PI / 180, half = Number(item.length) / 2;
        const dx = Math.cos(angle) * half, dy = Math.sin(angle) * half;
        return [[item.x + dx, item.y + dy], [item.x - dx, item.y - dy]];
      };
      const a = ends(opening), b = ends(written);
      const shift = Math.min(Math.max(distance(a[0], b[0]), distance(a[1], b[1])),
        Math.max(distance(a[0], b[1]), distance(a[1], b[0])));
      const turned = opening.angle !== written.angle;
      if (turned) rotated++;
      note(shift, before);
      if (shift <= NOISE && !turned && !same(opening.host?.tq, written.host?.tq)) openingParametersCanonicalized++;
      coordinate(opening.x, written.x, before); coordinate(opening.y, written.y, before);
    }
    const columns = byId(next.wall_columns);
    for (const column of before.wall_columns || []) {
      const written = columns.get(column.id);
      if (written) note(points([column.center], [written.center], before), before);
    }
    const decor = byId(next.decor);
    for (const shape of before.decor || []) {
      if (shape.kind === 'furniture' || shape.kind === 'image') continue;
      const written = decor.get(shape.id);
      if (!written) continue;
      const corners = (item: any): number[][] => item.kind === 'line'
        ? [[item.x1, item.y1], [item.x2, item.y2]]
        : item.w != null && item.h != null
          ? [[item.x, item.y], [item.x + item.w, item.y], [item.x, item.y + item.h], [item.x + item.w, item.y + item.h]]
          : [[item.x, item.y]];
      const a = corners(shape), b = corners(written);
      note(Math.max(...a.map((point, i) => distance(point, b[i]))), before);
      const fields = shape.kind === 'line' ? ['x1', 'y1', 'x2', 'y2']
        : shape.w != null && shape.h != null ? ['x', 'y', 'w', 'h'] : ['x', 'y'];
      for (const field of fields) coordinate(shape[field], written[field], before);
    }
  }
  for (const [id, before] of Object.entries(beforeLayout || {})) {
    const written = afterLayout[id];
    if (!written || !Number.isFinite(before?.x) || !Number.isFinite(before?.y)) continue;
    const space = spaces.get(before.s);
    const didMove = note(points([[before.x, before.y]], [[written.x, written.y]], space), space, String(before.s || ''));
    if (didMove) { if (before.s && !space) archivedPositionsMoved++; else currentPositionsMoved++; }
  }
  for (const [id, row] of latticeSpaces) row.far = farBySpace.get(id) || 0;
  return { moved, total, maxShift, maxShiftCm, maxSpace, rotated, coordsCanonicalized: 0,
    latticeCoordinatesCanonicalized, latticeCoordinatesFar, latticeMaxShift, latticeMaxShiftCm,
    latticeSpaces: [...latticeSpaces.values()], openingParametersCanonicalized,
    currentPositionsMoved, archivedPositionsMoved };
}
