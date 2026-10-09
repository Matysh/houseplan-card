/** Select-only exact boundary reuse for a successful union/difference baseline.
 * The caller must certify canonical contents (including mutation checks) of
 * before/current/baselineResult, and exact identity of the fixed operands.
 * Array shape below is only defensive validation, never that provenance proof.
 *
 * The global changed-boundary rectangle must miss every fixed component bbox.
 * Outside it the winding delta is zero; inside it the fixed operands are empty.
 * Exact axis subdivisions expose shared edges without snapping any coordinate.
 * We also prove input ring ownership, reject new crossings, and validate the
 * ACTUAL output containment tree: a fixed cut may split one input component,
 * so input ownership alone cannot certify which output outer owns each hole.
 * Any uncertainty returns null; the caller must execute the full boolean.
 */
import type { Geom } from './wall-boolean-cache';

type Point = [number, number];
type Ring = Point[];
type Multi = Ring[][];
type Box = [number, number, number, number];
type Edge = { a: Point; b: Point; owner: string | null };
type Edges = Map<string, Edge>;
type AxisIndex = { vertical: Map<number, Set<number>>; horizontal: Map<number, Set<number>> };
type Predicates = {
  orientation(a: Point, b: Point, p: Point): number;
  on(p: Point, a: Point, b: Point): boolean;
};
type Prepared = {
  before: Multi;
  baselineResult: Multi;
  blockerBoxes: Box[];
  oldVertices: Map<string, Point>;
  baselineSigns: number[][];
};
export type PreparedWallBoundarySplice = (current: Geom) => Multi | null;

const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];
const pointKey = (point: Point): string => JSON.stringify(point);
const edgeKey = (a: Point, b: Point): string => JSON.stringify([a, b]);
const copy = (geometry: Multi): Multi => geometry.map(poly => poly.map(ring =>
  ring.map((p): Point => [p[0], p[1]])));
const asMulti = (geometry: Geom): Multi => !geometry.length ? []
  : typeof geometry[0][0][0] === 'number' ? [geometry as Ring[]] : geometry as Multi;
const bounds = (points: Point[]): Box | null => {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]);
    box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]);
  }
  return box.every(Number.isFinite) ? box : null;
};
const touches = (a: Box, b: Box): boolean =>
  a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const validMulti = (value: unknown): value is Multi => Array.isArray(value)
  && value.every(poly => Array.isArray(poly) && poly.length > 0
    && poly.every(ring => Array.isArray(ring) && ring.length >= 4
      && ring.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
      && same(ring[0], ring[ring.length - 1])));

function areaSign(ring: Ring): number {
  const parts = ring.flatMap(point => point.map(value => {
    const [mantissa, exponent = '0'] = value.toString().split('e');
    const dot = mantissa.indexOf('.');
    return { coefficient: BigInt(mantissa.replace('.', '')),
      power: Number(exponent) - (dot < 0 ? 0 : mantissa.length - dot - 1) };
  }));
  const power = Math.min(...parts.map(part => part.power));
  const coordinates = parts.map(part => part.coefficient * 10n ** BigInt(part.power - power));
  let sum = 0n;
  for (let i = 2; i < coordinates.length; i += 2)
    sum += coordinates[i - 2] * coordinates[i + 1] - coordinates[i] * coordinates[i - 1];
  return sum > 0n ? 1 : sum < 0n ? -1 : 0;
}

function axisIndex(geometries: Multi[]): AxisIndex {
  const vertical = new Map<number, Set<number>>(), horizontal = new Map<number, Set<number>>();
  for (const geometry of geometries) for (const poly of geometry) for (const ring of poly) for (const p of ring) {
    if (!vertical.has(p[0])) vertical.set(p[0], new Set());
    if (!horizontal.has(p[1])) horizontal.set(p[1], new Set());
    vertical.get(p[0])!.add(p[1]); horizontal.get(p[1])!.add(p[0]);
  }
  return { vertical, horizontal };
}

function splitEdges(geometry: Multi, index: AxisIndex): Edges | null {
  const edges: Edges = new Map();
  for (let pi = 0; pi < geometry.length; pi++) for (let ri = 0; ri < geometry[pi].length; ri++) {
    const ring = geometry[pi][ri], owner = `${pi}:${ri}`;
    for (let n = 1; n < ring.length; n++) {
      const a = ring[n - 1], b = ring[n];
      if (same(a, b)) continue;
      const dimension = a[0] === b[0] ? 1 : a[1] === b[1] ? 0 : -1;
      const points = [a];
      if (dimension === 0 || dimension === 1) {
        const choices = dimension ? index.vertical.get(a[0])! : index.horizontal.get(a[1])!;
        const lo = Math.min(a[dimension], b[dimension]), hi = Math.max(a[dimension], b[dimension]);
        const inside = [...choices].filter(value => value > lo && value < hi).sort((x, y) => x - y);
        if (a[dimension] > b[dimension]) inside.reverse();
        for (const value of inside) points.push(dimension ? [a[0], value] : [value, a[1]]);
      }
      points.push(b);
      for (let j = 1; j < points.length; j++) {
        const key = edgeKey(points[j - 1], points[j]);
        if (edges.has(key)) return null;
        edges.set(key, { a: points[j - 1], b: points[j], owner });
      }
    }
  }
  return edges;
}

function trimAxisSubdivisions(ring: Ring): Ring | null {
  const points = ring.slice(0, -1);
  let changed = true;
  while (changed && points.length > 3) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) {
        points.splice(i, 1); changed = true; break;
      }
    }
  }
  if (points.length < 3) return null;
  let start = 0;
  for (let i = 1; i < points.length; i++) if (points[i][0] < points[start][0]
      || (points[i][0] === points[start][0] && points[i][1] < points[start][1])) start = i;
  const result = [...points.slice(start), ...points.slice(0, start)].map((point): Point => [point[0], point[1]]);
  result.push([result[0][0], result[0][1]]);
  return result;
}

function stableOperandOwners(before: Multi, current: Multi, oldEdges: Edges, newEdges: Edges): boolean {
  if (before.length !== current.length) return false;
  const oldByNew = new Map<string, string>(), seenOld = new Set<string>();
  for (const [key, next] of newEdges) {
    const previous = oldEdges.get(key);
    if (!previous) continue;
    if (next.owner === null || previous.owner === null) return false;
    if (oldByNew.has(next.owner) && oldByNew.get(next.owner) !== previous.owner) return false;
    oldByNew.set(next.owner, previous.owner);
  }
  for (let pi = 0; pi < current.length; pi++) {
    const outerOwner = oldByNew.get(`${pi}:0`);
    if (outerOwner === undefined) return false;
    const [oldPi, oldRi] = outerOwner.split(':').map(Number);
    if (oldRi !== 0 || current[pi].length !== before[oldPi].length) return false;
    for (let ri = 0; ri < current[pi].length; ri++) {
      const owner = oldByNew.get(`${pi}:${ri}`);
      if (owner === undefined || seenOld.has(owner)) return false;
      const [ownerPi, ownerRi] = owner.split(':').map(Number);
      if (ownerPi !== oldPi || (ri === 0) !== (ownerRi === 0)) return false;
      seenOld.add(owner);
    }
  }
  return seenOld.size === before.reduce((sum, poly) => sum + poly.length, 0);
}

function exactPredicates(points: Point[]): Predicates {
  // polyclip reads Number.toString() decimals through BigNumber. Match those
  // exact semantics, including scientific notation; never use an epsilon.
  const parts = new Map<number, { coefficient: bigint; power: number }>();
  let power = Infinity;
  for (const point of points) for (const value of point) if (!parts.has(value)) {
    const [mantissa, exponent = '0'] = value.toString().split('e'), dot = mantissa.indexOf('.');
    const part = { coefficient: BigInt(mantissa.replace('.', '')),
      power: Number(exponent) - (dot < 0 ? 0 : mantissa.length - dot - 1) };
    parts.set(value, part); power = Math.min(power, part.power);
  }
  const scaled = new Map([...parts].map(([value, part]) =>
    [value, part.coefficient * 10n ** BigInt(part.power - power)]));
  const orientation = (a: Point, b: Point, p: Point): number => {
    const ax = scaled.get(a[0])!, ay = scaled.get(a[1])!;
    const determinant = (scaled.get(b[0])! - ax) * (scaled.get(p[1])! - ay)
      - (scaled.get(b[1])! - ay) * (scaled.get(p[0])! - ax);
    return determinant > 0n ? 1 : determinant < 0n ? -1 : 0;
  };
  const on = (p: Point, a: Point, b: Point): boolean =>
    p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  return { orientation, on };
}

function safeAddedEdges(added: Array<[string, Edge]>, resultEdges: Edges, predicates: Predicates): boolean {
  const retained = [...resultEdges.values()].filter(edge => edge.owner !== null)
    .map(edge => ({ ...edge, box: bounds([edge.a, edge.b])! }));
  const { orientation: orient, on } = predicates;
  for (const [, next] of added) {
    const box = bounds([next.a, next.b])!;
    for (const old of retained) {
      if (!touches(box, old.box)) continue;
      const a = next.a, b = next.b, c = old.a, d = old.b;
      const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
      if (o1 * o2 < 0 && o3 * o4 < 0) return false;
      if (!o1 && !o2) {
        const axis = a[0] === b[0] ? 1 : 0;
        const lo = Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
        const hi = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis]));
        if (lo < hi) return false;
      }
      const contacts: Array<[number, Point, Point, Point]> = [[o1, c, a, b], [o2, d, a, b], [o3, a, c, d], [o4, b, c, d]];
      for (const [orientation, point, x, y] of contacts)
        if (!orientation && on(point, x, y)
          && !((same(point, a) || same(point, b)) && (same(point, c) || same(point, d)))) return false;
    }
  }
  return true;
}

function validOutputHierarchy(result: Multi, predicates: Predicates): boolean {
  const rings = result.flatMap((poly, pi) => poly.map((ring, ri) => ({ ring, pi, ri, box: bounds(ring)! })));
  const containers = rings.map(() => new Set<number>());
  const { orientation: orient, on } = predicates;
  for (let i = 0; i < rings.length; i++) for (let j = 0; j < rings.length; j++) {
    if (i === j) continue;
    const p = rings[i].ring[0], other = rings[j];
    if (p[0] < other.box[0] || p[0] > other.box[2] || p[1] < other.box[1] || p[1] > other.box[3]) continue;
    let winding = 0;
    for (let n = 1; n < other.ring.length; n++) {
      const a = other.ring[n - 1], b = other.ring[n], orientation = orient(a, b, p);
      if (!orientation && on(p, a, b)) return false;
      if (a[1] <= p[1] && b[1] > p[1] && orientation > 0) winding++;
      else if (a[1] > p[1] && b[1] <= p[1] && orientation < 0) winding--;
    }
    if (winding) containers[i].add(j);
  }
  for (let i = 0; i < rings.length; i++) {
    const parents = [...containers[i]].filter(candidate =>
      ![...containers[i]].some(other => other !== candidate && containers[other].has(candidate)));
    if (parents.length > 1) return false;
    const ring = rings[i], parent = parents.length ? rings[parents[0]] : null;
    if (ring.ri === 0) { if (parent && parent.ri === 0) return false; }
    else if (!parent || parent.ri !== 0 || parent.pi !== ring.pi) return false;
  }
  return true;
}

function splice(current: Geom, prepared: Prepared): Multi | null {
  if (!validMulti(current)) return null;
  const { before, baselineResult, blockerBoxes, oldVertices, baselineSigns } = prepared;
  // Refusal-only prefilter: raw vertex changes can overestimate changed material.
  // They never certify reuse; the split-edge rectangle below remains mandatory.
  const newVertices = new Map(current.flat(2).map(point => [pointKey(point), point]));
  const unshared = [...oldVertices].filter(([key]) => !newVertices.has(key)).map(([, point]) => point)
    .concat([...newVertices].filter(([key]) => !oldVertices.has(key)).map(([, point]) => point));
  const vertexBox = bounds(unshared);
  if (vertexBox && blockerBoxes.some(blocker => touches(vertexBox, blocker))) return null;
  const index = axisIndex([before, current, baselineResult]);
  const oldEdges = splitEdges(before, index), newEdges = splitEdges(current, index);
  const resultEdges = splitEdges(baselineResult, index);
  if (!oldEdges || !newEdges || !resultEdges) return null;
  if (!stableOperandOwners(before, current, oldEdges, newEdges)) return null;
  const removed = [...oldEdges].filter(([key]) => !newEdges.has(key));
  const added = [...newEdges].filter(([key]) => !oldEdges.has(key));
  if (!removed.length && !added.length) return copy(baselineResult);
  // Per-edge separation is insufficient: changed edges can enclose a fixed
  // operand without touching it. One GLOBAL support box excludes that case.
  const changedBox = bounds([...removed, ...added].flatMap(([, edge]) => [edge.a, edge.b]));
  if (!changedBox || blockerBoxes.some(blocker => touches(changedBox, blocker))) return null;
  for (const [key] of removed) {
    if (!resultEdges.has(key)) return null;
    resultEdges.delete(key);
  }
  for (const [key, edge] of added) {
    if (resultEdges.has(key)) return null;
    resultEdges.set(key, { ...edge, owner: null });
  }
  const predicates = exactPredicates([...resultEdges.values()].flatMap(edge => [edge.a, edge.b]));
  if (!safeAddedEdges(added, resultEdges, predicates)) return null;
  const outgoing = new Map<string, Edge>(), incoming = new Set<string>();
  for (const edge of resultEdges.values()) {
    const a = pointKey(edge.a), b = pointKey(edge.b);
    if (outgoing.has(a) || incoming.has(b)) return null;
    outgoing.set(a, edge); incoming.add(b);
  }
  if (outgoing.size !== incoming.size || [...outgoing.keys()].some(key => !incoming.has(key))) return null;
  const result: Array<Array<Ring | null>> = baselineResult.map(poly => poly.map(() => null));
  const owners = new Set<string>();
  while (outgoing.size) {
    const first = outgoing.keys().next().value as string, ring: Ring = [], labels = new Set<string>();
    let cursor = first;
    do {
      const edge = outgoing.get(cursor);
      if (!edge) return null;
      outgoing.delete(cursor); ring.push(edge.a);
      if (edge.owner !== null) labels.add(edge.owner);
      cursor = pointKey(edge.b);
    } while (cursor !== first);
    ring.push(ring[0]);
    if (labels.size !== 1) return null;
    const owner = [...labels][0];
    if (owners.has(owner)) return null;
    owners.add(owner);
    const [pi, ri] = owner.split(':').map(Number), normalized = trimAxisSubdivisions(ring);
    if (!normalized) return null;
    const sign = areaSign(normalized);
    if (!sign || sign !== baselineSigns[pi][ri]) return null;
    result[pi][ri] = normalized;
  }
  if (result.some(poly => poly.some(ring => ring === null))) return null;
  const complete = result as Multi;
  if (!validOutputHierarchy(complete, predicates)) return null;
  return complete;
}

/** Prepare only immutable frozen-baseline data. Copies are private to the
 * returned closure; neither later caller mutations nor returned result arrays
 * can change its proof inputs. Every current candidate still runs all geometric
 * separation, edge ownership, crossing and actual output nesting checks. */
export function prepareWallBoundarySplice(before: Geom, fixedOperands: readonly Geom[], baselineResult: Geom): PreparedWallBoundarySplice | null {
  try {
    if (!validMulti(before) || !validMulti(baselineResult)) return null;
    const blockerBoxes: Box[] = [];
    for (const operand of fixedOperands) {
      const geometry = asMulti(operand);
      if (!validMulti(geometry)) return null;
      for (const polygon of geometry) blockerBoxes.push(bounds(polygon.flat())!);
    }
    const frozenBefore = copy(before), frozenResult = copy(baselineResult);
    const prepared: Prepared = {
      before: frozenBefore, baselineResult: frozenResult, blockerBoxes,
      oldVertices: new Map(frozenBefore.flat(2).map(point => [pointKey(point), point])),
      baselineSigns: frozenResult.map(polygon => polygon.map(areaSign)),
    };
    return current => {
      try { return splice(current, prepared); }
      catch { return null; }
    };
  } catch { return null; }
}

export function spliceWallBooleanBoundary(before: Geom, current: Geom, fixedOperands: readonly Geom[], baselineResult: Geom): Multi | null {
  return prepareWallBoundarySplice(before, fixedOperands, baselineResult)?.(current) ?? null;
}
