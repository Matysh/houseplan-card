import { CANVAS_LIMIT, GRID_PITCH, NORM_W } from '../../canvas-constants';
import type { OpeningCfg, PartitionCfg, RoomCfg, WallSegmentEntry } from '../../types';
import { pointInPolygon, roomPoly } from '../../logic';
import { resolveOpeningDimensions, type OpeningDimension, type OpeningDimensionContext } from '../../opening-dimensions';
import type { OpeningPlacementCore } from '../../opening-placement';
import { materializePartitionOpening, resolvePartitionOpeningCompat, resolvePartitionOpeningStrict } from '../../partition-openings';
import { resolveRoomOpeningHost } from '../../wall-segment-model';

type Segment = { id: string; a: number[]; b: number[] };
const EPS = 1e-8;
const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1]];
const cross = (a: readonly number[], b: readonly number[]) => a[0] * b[1] - a[1] * b[0];
const same = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS;
function pointOn(point: readonly number[], a: readonly number[], b: readonly number[]): boolean {
  const d = sub(b, a), p = sub(point, a), length = Math.hypot(...d);
  return length > EPS && Math.abs(cross(d, p)) / length < EPS
    && p[0] * d[0] + p[1] * d[1] >= -EPS
    && p[0] * d[0] + p[1] * d[1] <= length * length + EPS;
}
function intersects(a: Segment, b: Segment): boolean {
  if ([b.a, b.b].some(p => pointOn(p, a.a, a.b)) || [a.a, a.b].some(p => pointOn(p, b.a, b.b))) return true;
  const d = sub(a.b, a.a), e = sub(b.b, b.a), offset = sub(b.a, a.a), den = cross(d, e);
  if (Math.abs(den) < EPS) return false;
  const t = cross(offset, e) / den, u = cross(offset, d) / den;
  return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS;
}

/** A T/X in the interior also constrains this wall; do not detach it numerically. */
export function freePartitionEnds(wall: PartitionCfg, otherWalls: readonly Segment[]): [boolean, boolean] {
  const others = otherWalls.filter(other => other.id !== wall.id);
  const interior = others.some(other => intersects(wall, other)
    && !pointOn(wall.a, other.a, other.b) && !pointOn(wall.b, other.a, other.b));
  return [wall.a, wall.b].map(end => !interior && !others.some(other => pointOn(end, other.a, other.b))) as [boolean, boolean];
}

/** Change one free end, preserving every hosted opening's distance from the fixed end. */
export function patchPartitionEndpoint(
  wall: PartitionCfg, endpoint: 'a' | 'b', axis: 0 | 1, normalized: number,
  walls: readonly Segment[], openings: readonly OpeningCfg[], cellCm: number,
): { wall: PartitionCfg; openings: OpeningCfg[] } | null {
  if (!Number.isFinite(normalized) || Math.abs(normalized) > CANVAS_LIMIT
    || !freePartitionEnds(wall, walls)[endpoint === 'a' ? 0 : 1]) return null;
  const point = [...wall[endpoint]]; point[axis] = normalized;
  const next = { ...wall, [endpoint]: point };
  const oldLength = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const newLength = Math.hypot(next.b[0] - next.a[0], next.b[1] - next.a[1]);
  if (newLength * NORM_W < GRID_PITCH) return null;
  for (const other of walls.filter(other => other.id !== wall.id)) {
    if (!intersects(next, other)) continue;
    // Only the already connected, stationary endpoint may remain shared.
    const fixed = endpoint === 'a' ? wall.b : wall.a;
    const moving = next[endpoint];
    if (!pointOn(fixed, other.a, other.b) || pointOn(moving, other.a, other.b)
      || [other.a, other.b].some(p => pointOn(p, next.a, next.b) && !same(p, fixed))) return null;
    const offset = sub(other.a, fixed), d = sub(next[endpoint], fixed), e = sub(other.b, other.a);
    if (Math.abs(cross(d, e)) < EPS && Math.abs(cross(offset, d)) < EPS) return null;
  }
  const rendered = { ...next, a: next.a.map(x => x * NORM_W), b: next.b.map(x => x * NORM_W) };
  const updated: OpeningCfg[] = [];
  for (const opening of openings) {
    if (opening.host?.kind !== 'partition' || opening.host.id !== wall.id) { updated.push(opening); continue; }
    const distance = (endpoint === 'a' ? 1 - opening.host.t : opening.host.t) * oldLength;
    const t = endpoint === 'a' ? 1 - distance / newLength : distance / newLength;
    const candidate = { ...opening, host: { ...opening.host, t } };
    const resolved = resolvePartitionOpeningStrict(candidate, [rendered], NORM_W, cellCm, GRID_PITCH).resolved;
    if (!resolved) return null;
    updated.push(materializePartitionOpening(candidate, resolved, NORM_W));
  }
  return { wall: next, openings: updated };
}

export type PropertiesOpeningCore = Pick<OpeningPlacementCore, 'x' | 'y' | 'angle' | 'renderedLength' | 'target' | 'host'>;

export type OpeningSideName = { kind: 'room'; name: string } | { kind: 'outside' } | { kind: 'fallback'; side: 'A' | 'B' };
/** Canonical ownership, or exact legacy boundary containment; never nearest-room guessing. */
export function propertiesContourRooms(wall: WallSegmentEntry, rooms: readonly RoomCfg[]): string[] {
  return rooms.filter(room => {
    if (room.wall_ids?.length) return room.wall_ids.includes(wall.id);
    const poly = roomPoly(room);
    return poly?.some((a, i) => pointOn(wall.a, a, poly[(i + 1) % poly.length])
      && pointOn(wall.b, a, poly[(i + 1) % poly.length]));
  }).map(room => room.name.trim()).filter(Boolean);
}
/** No guessed declension, nearest-room search or conflation of a gate's face with invert. */
export function propertiesOpeningSides(
  core: PropertiesOpeningCore, rooms: readonly RoomCfg[], signs: readonly [number, number] = [-1, 1],
): [OpeningSideName, OpeningSideName] {
  const radians = core.angle * Math.PI / 180;
  const normal = [-Math.sin(radians), Math.cos(radians)];
  const offset = core.target.physicalHalfWidth + GRID_PITCH * .1;
  const owners = signs.map(sign => rooms.filter(room => {
    const poly = roomPoly(room);
    return poly && pointInPolygon([core.x + normal[0]*offset*sign, core.y + normal[1]*offset*sign], poly);
  }));
  const fallback: [OpeningSideName, OpeningSideName] = [{kind:'fallback',side:'A'},{kind:'fallback',side:'B'}];
  if (owners.some(list => list.length > 1 || list.length && !list[0].name?.trim()) || owners.every(list => !list.length)
    || owners[0][0] && owners[1][0] && (owners[0][0].id === owners[1][0].id || owners[0][0].name === owners[1][0].name)) return fallback;
  return owners.map(list => list[0]?.name?.trim() ? {kind:'room',name:list[0].name} : {kind:'outside'}) as [OpeningSideName,OpeningSideName];
}

export function openingPropertiesCore(
  opening: OpeningCfg, partitions: readonly PartitionCfg[], walls: readonly WallSegmentEntry[],
  cellCm: number,
): PropertiesOpeningCore | null {
  const target = opening.host?.kind === 'partition' ? partitions.find(p => p.id === opening.host!.id)
    : walls.find(p => p.id === opening.host?.id);
  if (!target) return null;
  const rendered = { ...target, a: target.a.map(x => x * NORM_W), b: target.b.map(x => x * NORM_W) };
  const resolved = opening.host?.kind === 'partition'
    ? resolvePartitionOpeningCompat(opening, [rendered], NORM_W, cellCm, GRID_PITCH).resolved : null;
  const x = resolved?.center[0] ?? opening.x * NORM_W, y = resolved?.center[1] ?? opening.y * NORM_W;
  return { x, y, angle: resolved?.angle ?? opening.angle, renderedLength: opening.length * NORM_W,
    ...(opening.host?.kind === 'partition' ? { host: opening.host } : {}),
    target: { a: [rendered.a[0], rendered.a[1]], b: [rendered.b[0], rendered.b[1]],
      segmentKey: target.id, sourceOrder: 0, physicalHalfWidth: target.cm / cellCm * GRID_PITCH / 2,
      ...(opening.host?.kind === 'partition' ? { partitionHost: { kind: 'partition' as const, id: target.id } } : {}),
    } };
}

/** Canonical physical references, not a t*L approximation. */
export function selectOpeningReference(core: PropertiesOpeningCore, context: OpeningDimensionContext): OpeningDimension | null {
  const choices = resolveOpeningDimensions(core, context).filter(d => d.distance >= 0 && Number.isFinite(d.distance));
  return choices.sort((a, b) => a.distance - b.distance || String(a.roomId ?? '').localeCompare(String(b.roomId ?? ''))
    || (a.roomSide ?? 0) - (b.roomSide ?? 0) || a.to[0] - b.to[0] || a.to[1] - b.to[1])[0] ?? null;
}

/** Keep the selected physical corner/end even when the opening passes the midpoint. */
export function refreshOpeningReference(
  core: PropertiesOpeningCore, context: OpeningDimensionContext, frozen: OpeningDimension,
): OpeningDimension | null {
  const matching = resolveOpeningDimensions(core, context).filter(d => d.source === frozen.source
    && d.roomId === frozen.roomId && d.roomSide === frozen.roomSide && same(d.to, frozen.to)
    && Math.abs(cross(d.axis, frozen.axis)) < EPS
    && d.axis[0] * frozen.axis[0] + d.axis[1] * frozen.axis[1] > 0);
  return matching.length === 1 ? matching[0] : null;
}

/** Width keeps centre; a gap edit translates along the frozen physical reference. */
export function patchOpeningProperties(
  opening: OpeningCfg, field: 'length' | 'gap', cm: number, core: PropertiesOpeningCore,
  reference: OpeningDimension | null, partitions: readonly PartitionCfg[], walls: readonly WallSegmentEntry[],
  cellCm: number,
): OpeningCfg | null {
  const render = cm / cellCm * GRID_PITCH;
  if (!Number.isFinite(cm) || (field === 'length' ? cm < 20 || cm > 600 : cm < 0)) return null;
  let candidate = { ...opening };
  if (field === 'length') candidate.length = render / NORM_W;
  else {
    if (!reference) return null;
    // The resolver's `from` is the opening edge and `to` is the physical corner.
    const dx = reference.from[0] - reference.to[0], dy = reference.from[1] - reference.to[1];
    const norm = Math.hypot(dx, dy);
    const sign = (core.x - reference.to[0]) * reference.axis[0]
      + (core.y - reference.to[1]) * reference.axis[1] >= 0 ? 1 : -1;
    const ux = norm > EPS ? dx / norm : reference.axis[0] * sign;
    const uy = norm > EPS ? dy / norm : reference.axis[1] * sign;
    const delta = render - reference.distance;
    candidate.x = (core.x + ux * delta) / NORM_W;
    candidate.y = (core.y + uy * delta) / NORM_W;
  }
  if (candidate.host?.kind === 'partition') {
    const dx = core.target.b[0] - core.target.a[0], dy = core.target.b[1] - core.target.a[1];
    const t = ((candidate.x * NORM_W - core.target.a[0]) * dx + (candidate.y * NORM_W - core.target.a[1]) * dy) / (dx * dx + dy * dy);
    candidate.host = { ...candidate.host, t };
    const rendered = partitions.map(p => ({ ...p, a: p.a.map(n => n * NORM_W), b: p.b.map(n => n * NORM_W) }));
    const resolved = resolvePartitionOpeningStrict(candidate, rendered, NORM_W, cellCm, GRID_PITCH).resolved;
    return resolved ? materializePartitionOpening(candidate, resolved, NORM_W) : null;
  }
  const host = resolveRoomOpeningHost(candidate, walls);
  if (!host || host.id !== opening.host?.id) return null;
  candidate.host = host;
  return candidate;
}
