import {
  ISO_CAMERA,
  ISO_OVERLAY_VISUAL_OFFSET,
  ISO_WALL_HEIGHT,
  projectPlanPoint,
  type IsoCamera,
  type PlanPoint,
  type ScenePoint,
} from './iso-projection';

export const ISO_OVERLAY_SAFETY_GAP_CSS_PX = 4;
export const ISO_OVERLAY_MAX_NUDGE_CSS_PX = 48;

export type IsoRaisedOverlayKind = 'device' | 'room-label' | 'opening-lock';
export type IsoFloorOverlayKind = 'vacuum' | 'vacuum-trail' | 'glow' | 'room-fill'
  | 'room-hover' | 'sunlight' | 'decor' | 'furniture' | 'backdrop';
export type IsoOverlayKind = IsoRaisedOverlayKind | IsoFloorOverlayKind;
export type IsoOverlayPlane = 'floor' | 'raised';

export interface IsoOverlayRoom {
  id: string;
  outer: readonly PlanPoint[];
  holes?: readonly (readonly PlanPoint[])[];
  /** A cached, proven inner control point is preferred when the host has one. */
  safePoint?: PlanPoint;
}

/** A projected, canonical physical-wall surface. No union is done per marker. */
export interface IsoWallSilhouette {
  outer: readonly ScenePoint[];
  holes?: readonly (readonly ScenePoint[])[];
}

export interface IsoOverlayOwner {
  id: string;
  area: number;
  safePoint: PlanPoint | null;
}

export interface IsoOverlayOwnerInput {
  kind: IsoRaisedOverlayKind;
  floorAnchor: PlanPoint;
  rooms: readonly IsoOverlayRoom[];
  /** Device binding, room label owner, or the room selected by opening-host geometry. */
  preferredRoomId?: string | null;
  /** Internal fast path for room rows already normalised by isoOverlayRooms(). */
  roomsValidated?: boolean;
}

export interface IsoOverlayPlacementInput extends IsoOverlayOwnerInput {
  showBorders: boolean;
  wallSilhouettes: readonly IsoWallSilhouette[];
  /** Internal fast path for silhouettes produced by the cached structural scene. */
  wallGeometryValidated?: boolean;
  /** Half-size of the floor-parallel plate in plan units. */
  plateHalfSize: PlanPoint;
  wallHeight?: number;
  visualOffset?: number;
  /** Uniform viewBox units represented by one CSS pixel at the current viewport. */
  sceneUnitsPerCssPixel?: number;
  safetyGapCssPx?: number;
  maxNudgeCssPx?: number;
  filtersSupported?: boolean;
  hovered?: boolean;
  focused?: boolean;
  selected?: boolean;
  camera?: IsoCamera;
}

export interface IsoOverlayTetherGeometry {
  from: ScenePoint;
  to: ScenePoint;
  visible: boolean;
  length: number;
  angleDeg: number;
}

export interface IsoOverlayPlacement {
  plane: IsoOverlayPlane;
  owner: IsoOverlayOwner | null;
  /** This is always the input logical point; runtime nudge never mutates it. */
  floorAnchor: PlanPoint;
  floorScene: ScenePoint;
  raisedScene: ScenePoint;
  visualScene: ScenePoint;
  plate: readonly ScenePoint[];
  nudgeScene: ScenePoint;
  nudgeCss: ScenePoint;
  nudgeDistanceCss: number;
  nudged: boolean;
  nearWallBefore: boolean;
  nearWallAfter: boolean;
  cleared: boolean;
  capped: boolean;
  grounding: { center: ScenePoint; visible: boolean };
  tether: IsoOverlayTetherGeometry;
  status: 'ok' | 'degraded';
  reason: 'invalid-wall-geometry' | 'missing-owner' | 'invalid-safe-point'
    | 'owner-boundary' | 'nudge-cap' | null;
}

const EPS = 1e-9;

const finitePoint = (point: readonly number[]): boolean =>
  point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

function ringArea(ring: readonly (readonly number[])[]): number {
  let area = 0;
  for (let index = 0; index < ring.length; index++) {
    const point = ring[index], next = ring[(index + 1) % ring.length];
    area += point[0] * next[1] - next[0] * point[1];
  }
  return area / 2;
}

function validRing(ring: readonly (readonly number[])[]): boolean {
  return ring.length >= 3 && ring.every(finitePoint) && Math.abs(ringArea(ring)) > EPS;
}

function pointSegmentDistance(
  point: readonly number[], start: readonly number[], end: readonly number[],
): number {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx
      + (point[1] - start[1]) * dy) / lengthSquared))
    : 0;
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy);
}

function pointOnRing(
  point: readonly number[], ring: readonly (readonly number[])[], epsilon = 1e-7,
): boolean {
  for (let index = 0; index < ring.length; index++) {
    if (pointSegmentDistance(point, ring[index], ring[(index + 1) % ring.length]) <= epsilon)
      return true;
  }
  return false;
}

function pointInRing(point: readonly number[], ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index], b = ring[previous];
    if ((a[1] > point[1]) !== (b[1] > point[1])
        && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

function roomArea(room: IsoOverlayRoom): number {
  return Math.max(0, Math.abs(ringArea(room.outer))
    - (room.holes || []).reduce((sum, hole) => sum + Math.abs(ringArea(hole)), 0));
}

function validRoom(room: IsoOverlayRoom): boolean {
  return !!room.id && validRing(room.outer) && (room.holes || []).every(validRing)
    && roomArea(room) > EPS;
}

function pointStrictlyInRoom(point: PlanPoint, room: IsoOverlayRoom): boolean {
  if (!validRoom(room) || pointOnRing(point, room.outer) || !pointInRing(point, room.outer))
    return false;
  for (const hole of room.holes || []) {
    if (pointOnRing(point, hole) || pointInRing(point, hole)) return false;
  }
  return true;
}

function roomBoundaryDistance(point: PlanPoint, room: IsoOverlayRoom): number {
  let distance = Infinity;
  for (const ring of [room.outer, ...(room.holes || [])]) {
    for (let index = 0; index < ring.length; index++)
      distance = Math.min(distance, pointSegmentDistance(point, ring[index], ring[(index + 1) % ring.length]));
  }
  return distance;
}

/** Deterministic fallback when the host cannot provide its cached visual centre. */
export function isoRoomSafePoint(room: IsoOverlayRoom): PlanPoint | null {
  if (!validRoom(room)) return null;
  if (room.safePoint && pointStrictlyInRoom(room.safePoint, room))
    return [room.safePoint[0], room.safePoint[1]];

  const xs = room.outer.map((point) => point[0]);
  const ys = room.outer.map((point) => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const candidates: PlanPoint[] = [
    [(minX + maxX) / 2, (minY + maxY) / 2],
    [xs.reduce((sum, value) => sum + value, 0) / xs.length,
      ys.reduce((sum, value) => sum + value, 0) / ys.length],
  ];
  for (let index = 0; index < room.outer.length; index++) {
    const before = room.outer[(index + room.outer.length - 1) % room.outer.length];
    const point = room.outer[index], after = room.outer[(index + 1) % room.outer.length];
    candidates.push([(before[0] + point[0] + after[0]) / 3,
      (before[1] + point[1] + after[1]) / 3]);
  }

  let best: PlanPoint | null = null;
  let bestClearance = -Infinity;
  const consider = (candidate: PlanPoint): void => {
    if (!pointStrictlyInRoom(candidate, room)) return;
    const clearance = roomBoundaryDistance(candidate, room);
    if (clearance > bestClearance + EPS) {
      best = candidate;
      bestClearance = clearance;
    }
  };
  candidates.forEach(consider);
  // A bounded grid also covers concave rooms and rooms with holes without any
  // random sampling. Hosts should normally supply their cached inner point.
  const steps = 16;
  for (let xIndex = 1; xIndex < steps; xIndex++) {
    for (let yIndex = 1; yIndex < steps; yIndex++) {
      consider([
        minX + ((maxX - minX) * xIndex) / steps,
        minY + ((maxY - minY) * yIndex) / steps,
      ]);
    }
  }
  return best;
}

const stableIdCompare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function resolveIsoOverlayOwner(input: IsoOverlayOwnerInput): IsoOverlayOwner | null {
  if (!finitePoint(input.floorAnchor)) return null;
  const rooms = input.roomsValidated ? input.rooms : input.rooms.filter(validRoom);
  const preferred = input.preferredRoomId
    ? rooms.find((room) => room.id === input.preferredRoomId) || null
    : null;
  let room: IsoOverlayRoom | null = null;
  if (input.kind === 'device') {
    if (preferred && pointStrictlyInRoom(input.floorAnchor, preferred)) room = preferred;
    if (!room) {
      room = rooms.filter((candidate) => pointStrictlyInRoom(input.floorAnchor, candidate))
        .sort((a, b) => roomArea(a) - roomArea(b) || stableIdCompare(a.id, b.id))[0] || null;
    }
  } else {
    // Room labels and lock badges inherit their owner from room/host geometry;
    // a saved label may legitimately lie outside that room.
    room = preferred;
  }
  return room ? {
    id: room.id,
    area: roomArea(room),
    safePoint: input.roomsValidated && room.safePoint
      ? [room.safePoint[0], room.safePoint[1]] : isoRoomSafePoint(room),
  } : null;
}

export function isoOverlayPlane(kind: IsoOverlayKind, showBorders: boolean): IsoOverlayPlane {
  return showBorders && (kind === 'device' || kind === 'room-label' || kind === 'opening-lock')
    ? 'raised' : 'floor';
}

export function buildIsoPlatePolygon(
  center: PlanPoint,
  halfSize: PlanPoint,
  zUnits: number,
  camera: IsoCamera = ISO_CAMERA,
  sceneOffset: ScenePoint = [0, 0],
): readonly ScenePoint[] {
  if (!finitePoint(center) || !finitePoint(halfSize) || halfSize[0] < 0 || halfSize[1] < 0
      || !Number.isFinite(zUnits) || !finitePoint(sceneOffset))
    throw new Error('invalid isometric overlay plate');
  return ([
    [center[0] - halfSize[0], center[1] - halfSize[1]],
    [center[0] + halfSize[0], center[1] - halfSize[1]],
    [center[0] + halfSize[0], center[1] + halfSize[1]],
    [center[0] - halfSize[0], center[1] + halfSize[1]],
  ] as PlanPoint[]).map((point) => {
    const projected = projectPlanPoint(point, zUnits, camera);
    return [projected[0] + sceneOffset[0], projected[1] + sceneOffset[1]] as ScenePoint;
  });
}

function orientation(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(
  a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
): boolean {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  if (((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS))
      && ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))) return true;
  return Math.abs(o1) <= EPS && pointSegmentDistance(c, a, b) <= EPS
    || Math.abs(o2) <= EPS && pointSegmentDistance(d, a, b) <= EPS
    || Math.abs(o3) <= EPS && pointSegmentDistance(a, c, d) <= EPS
    || Math.abs(o4) <= EPS && pointSegmentDistance(b, c, d) <= EPS;
}

function segmentDistance(
  a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

function pointInSilhouette(point: ScenePoint, silhouette: IsoWallSilhouette): boolean {
  if (!pointInRing(point, silhouette.outer)) return false;
  return !(silhouette.holes || []).some((hole) => pointInRing(point, hole));
}

type Bounds = readonly [minX: number, minY: number, maxX: number, maxY: number];
const silhouetteBoundsCache = new WeakMap<IsoWallSilhouette, Bounds | null>();

function ringBounds(ring: readonly (readonly number[])[]): Bounds | null {
  if (!ring.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of ring) {
    if (!finitePoint(point)) return null;
    minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]);
  }
  return [minX, minY, maxX, maxY];
}

function silhouetteBounds(silhouette: IsoWallSilhouette, cache: boolean): Bounds | null {
  if (!cache) return ringBounds(silhouette.outer);
  if (silhouetteBoundsCache.has(silhouette)) return silhouetteBoundsCache.get(silhouette) ?? null;
  const bounds = ringBounds(silhouette.outer);
  silhouetteBoundsCache.set(silhouette, bounds);
  return bounds;
}

function boundsNear(a: Bounds, b: Bounds, gap: number): boolean {
  return a[0] <= b[2] + gap && a[2] >= b[0] - gap
    && a[1] <= b[3] + gap && a[3] >= b[1] - gap;
}

function plateNearSilhouette(
  plate: readonly ScenePoint[], plateBounds: Bounds,
  silhouette: IsoWallSilhouette, gap: number, cacheBounds: boolean,
): boolean {
  const wallBounds = silhouetteBounds(silhouette, cacheBounds);
  if (!wallBounds || !boundsNear(plateBounds, wallBounds, gap)) return false;
  if (plate.some((point) => pointInSilhouette(point, silhouette))) return true;
  if (silhouette.outer.some((point) => pointInRing(point, plate))) return true;
  for (const wallRing of [silhouette.outer, ...(silhouette.holes || [])]) {
    for (let plateIndex = 0; plateIndex < plate.length; plateIndex++) {
      const plateNext = (plateIndex + 1) % plate.length;
      for (let wallIndex = 0; wallIndex < wallRing.length; wallIndex++) {
        const wallNext = (wallIndex + 1) % wallRing.length;
        if (segmentDistance(plate[plateIndex], plate[plateNext],
          wallRing[wallIndex], wallRing[wallNext]) <= gap + EPS) return true;
      }
    }
  }
  return false;
}

function validSilhouette(silhouette: IsoWallSilhouette): boolean {
  return validRing(silhouette.outer) && (silhouette.holes || []).every(validRing);
}

/** A straight nudge must never cut through a concavity or an island hole. */
function segmentStrictlyInRoom(start: PlanPoint, end: PlanPoint, room: IsoOverlayRoom): boolean {
  if (!pointStrictlyInRoom(start, room) || !pointStrictlyInRoom(end, room)) return false;
  for (const ring of [room.outer, ...(room.holes || [])]) {
    for (let index = 0; index < ring.length; index++) {
      if (segmentsIntersect(start, end, ring[index], ring[(index + 1) % ring.length]))
        return false;
    }
  }
  return true;
}

function tetherGeometry(
  from: ScenePoint, to: ScenePoint, visible: boolean,
): IsoOverlayTetherGeometry {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  return { from, to, visible, length: Math.hypot(dx, dy), angleDeg: Math.atan2(dy, dx) * 180 / Math.PI };
}

/**
 * Resolve one overlay without mutating its saved coordinate. Collision data is
 * already projected/cached structural data, so HA and interaction updates do
 * not repeat wall unions.
 */
export function resolveIsoOverlayPlacement(input: IsoOverlayPlacementInput): IsoOverlayPlacement {
  const camera = input.camera || ISO_CAMERA;
  const wallHeight = input.wallHeight ?? ISO_WALL_HEIGHT;
  const visualOffset = input.visualOffset ?? ISO_OVERLAY_VISUAL_OFFSET;
  const unitsPerPixel = input.sceneUnitsPerCssPixel ?? 1;
  const safetyGap = input.safetyGapCssPx ?? ISO_OVERLAY_SAFETY_GAP_CSS_PX;
  const maxNudge = input.maxNudgeCssPx ?? ISO_OVERLAY_MAX_NUDGE_CSS_PX;
  if (!finitePoint(input.floorAnchor) || !finitePoint(input.plateHalfSize)
      || input.plateHalfSize[0] < 0 || input.plateHalfSize[1] < 0
      || !Number.isFinite(wallHeight) || wallHeight < 0
      || !Number.isFinite(visualOffset) || visualOffset < 0
      || !Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0
      || !Number.isFinite(safetyGap) || safetyGap < 0
      || !Number.isFinite(maxNudge) || maxNudge < 0)
    throw new Error('invalid isometric overlay input');

  const floorAnchor: PlanPoint = [input.floorAnchor[0], input.floorAnchor[1]];
  const floorScene = projectPlanPoint(floorAnchor, 0, camera);
  const plane = isoOverlayPlane(input.kind, input.showBorders);
  if (plane === 'floor') {
    const tether = tetherGeometry(floorScene, floorScene, false);
    return {
      plane, owner: null, floorAnchor, floorScene, raisedScene: floorScene,
      visualScene: floorScene, plate: [], nudgeScene: [0, 0], nudgeCss: [0, 0],
      nudgeDistanceCss: 0, nudged: false, nearWallBefore: false, nearWallAfter: false,
      cleared: true, capped: false,
      grounding: { center: floorScene, visible: false }, tether,
      status: 'ok', reason: null,
    };
  }

  const raisedHeight = wallHeight + visualOffset;
  const raisedScene = projectPlanPoint(floorAnchor, raisedHeight, camera);
  const owner = resolveIsoOverlayOwner(input);
  const geometryValid = input.wallGeometryValidated ?? input.wallSilhouettes.every(validSilhouette);
  const gapUnits = safetyGap * unitsPerPixel;
  const basePlate = buildIsoPlatePolygon(floorAnchor, input.plateHalfSize,
    raisedHeight, camera);
  const isNear = (plate: readonly ScenePoint[]): boolean => {
    const bounds = ringBounds(plate);
    return !!bounds && input.wallSilhouettes.some((wall) =>
      plateNearSilhouette(plate, bounds, wall, gapUnits, input.wallGeometryValidated === true));
  };
  const nearWallBefore = geometryValid ? isNear(basePlate) : true;

  let distanceCss = 0;
  let nudgeScene: ScenePoint = [0, 0];
  let capped = false;
  let status: IsoOverlayPlacement['status'] = geometryValid ? 'ok' : 'degraded';
  let reason: IsoOverlayPlacement['reason'] = geometryValid ? null : 'invalid-wall-geometry';

  if (geometryValid && nearWallBefore) {
    if (!owner) {
      status = 'degraded';
      reason = 'missing-owner';
    } else if (!owner.safePoint) {
      status = 'degraded';
      reason = 'invalid-safe-point';
    } else {
      const ownerRoom = input.rooms.find((room) => room.id === owner.id) || null;
      const safeScene = projectPlanPoint(owner.safePoint, raisedHeight, camera);
      const dx = safeScene[0] - raisedScene[0], dy = safeScene[1] - raisedScene[1];
      const length = Math.hypot(dx, dy);
      if (length <= EPS) {
        status = 'degraded';
        reason = 'invalid-safe-point';
      } else {
        const ux = dx / length, uy = dy / length;
        // The visual point may approach the proven inner control point but
        // must never run past it and leave the owning-room direction again.
        const searchLimitCss = Math.min(maxNudge, length / unitsPerPixel);
        const collidesAt = (candidateCss: number): boolean => {
          const offset: ScenePoint = [ux * candidateCss * unitsPerPixel,
            uy * candidateCss * unitsPerPixel];
          return isNear(basePlate.map((point) =>
            [point[0] + offset[0], point[1] + offset[1]] as ScenePoint));
        };
        let clearAt: number | null = null;
        let previous = 0;
        let ownerBoundary = false;
        const samples = Math.ceil(searchLimitCss);
        for (let sample = 1; sample <= samples; sample++) {
          const candidate = Math.min(searchLimitCss, sample);
          const ratio = candidate * unitsPerPixel / length;
          const candidatePlan: PlanPoint = [
            floorAnchor[0] + (owner.safePoint[0] - floorAnchor[0]) * ratio,
            floorAnchor[1] + (owner.safePoint[1] - floorAnchor[1]) * ratio,
          ];
          if (!ownerRoom || !segmentStrictlyInRoom(floorAnchor, candidatePlan, ownerRoom)) {
            ownerBoundary = true;
            break;
          }
          if (!collidesAt(candidate)) { clearAt = candidate; break; }
          previous = candidate;
        }
        if (clearAt !== null) {
          let low = previous, high = clearAt;
          for (let iteration = 0; iteration < 28; iteration++) {
            const middle = (low + high) / 2;
            if (collidesAt(middle)) low = middle;
            else high = middle;
          }
          distanceCss = high;
        } else {
          distanceCss = previous;
          capped = true;
          status = 'degraded';
          reason = ownerBoundary ? 'owner-boundary' : 'nudge-cap';
        }
        nudgeScene = [ux * distanceCss * unitsPerPixel, uy * distanceCss * unitsPerPixel];
      }
    }
  }

  const visualScene: ScenePoint = [raisedScene[0] + nudgeScene[0], raisedScene[1] + nudgeScene[1]];
  const plate = buildIsoPlatePolygon(floorAnchor, input.plateHalfSize,
    raisedHeight, camera, nudgeScene);
  const nearWallAfter = geometryValid ? isNear(plate) : true;
  const nudged = distanceCss > EPS;
  const tetherVisible = nudged || nearWallBefore || nearWallAfter
    || !!input.hovered || !!input.focused || !!input.selected;
  return {
    plane, owner, floorAnchor, floorScene, raisedScene, visualScene, plate,
    nudgeScene,
    nudgeCss: [nudgeScene[0] / unitsPerPixel, nudgeScene[1] / unitsPerPixel],
    nudgeDistanceCss: distanceCss,
    nudged, nearWallBefore, nearWallAfter,
    cleared: !nearWallAfter, capped,
    grounding: { center: floorScene, visible: input.filtersSupported !== false },
    tether: tetherGeometry(floorScene, visualScene, tetherVisible),
    status, reason,
  };
}
