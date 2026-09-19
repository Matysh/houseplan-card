import {
  ISO_CAMERA,
  ISO_OVERLAY_VISUAL_OFFSET,
  ISO_WALL_HEIGHT,
  projectPlanPoint,
  unprojectFloorPoint,
  type IsoCamera,
  type PlanPoint,
  type ScenePoint,
} from './iso-projection';

export const ISO_OVERLAY_SAFETY_GAP_CSS_PX = 4;
export const ISO_OVERLAY_MAX_NUDGE_CSS_PX = 48;
// 48 / 2^14 < 0.003 CSS px: well below raster precision, without paying for
// the former 28 exact wall tests per raised overlay on every zoom level.
const ISO_OVERLAY_NUDGE_SEARCH_ITERATIONS = 14;

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
  /** Half-size of the invisible floor-parallel safety footprint in plan units. */
  footprintHalfSize: PlanPoint;
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
  /** Internal scene-builder fast path; arbitrary callers still resolve safely. */
  ownerAlreadyResolved?: boolean;
  resolvedOwner?: IsoOverlayOwner | null;
  /** Internal zoom fast path. The hint is accepted only after an exact safety check. */
  nudgeHintCss?: number;
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
  /** Invisible collision/fit footprint; never render it as a surface. */
  footprint: readonly ScenePoint[];
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
    | 'owner-boundary' | 'nudge-cap' | 'overlay-collision' | null;
}

export type IsoOverlayCollisionKind = Exclude<IsoRaisedOverlayKind, 'room-label'>;

export interface IsoOverlayCollisionItem {
  id: string;
  kind: IsoOverlayCollisionKind;
  placement: IsoOverlayPlacement;
  /** Axis-aligned screen-facing half-size in scene units. */
  screenHalfSize: PlanPoint;
  /** Previous exact result as an upper bound; every nearer event is still checked. */
  nudgeHintCss?: ScenePoint;
}

export interface IsoOverlayCollisionInput {
  items: readonly IsoOverlayCollisionItem[];
  rooms: readonly IsoOverlayRoom[];
  wallSilhouettes: readonly IsoWallSilhouette[];
  sceneUnitsPerCssPixel: number;
  visualOffset?: number;
  safetyGapCssPx?: number;
  maxNudgeCssPx?: number;
  camera?: IsoCamera;
}

export interface IsoOverlayCollisionResult {
  placements: ReadonlyMap<string, IsoOverlayPlacement>;
  residualPairs: readonly (readonly [string, string])[];
}

const EPS = 1e-9;

/** Stable identity shared by the pure resolver and the render-scene maps. */
export const isoOverlayCollisionKey = (
  kind: IsoOverlayCollisionKind, id: string,
): string => `${kind}\u0000${id}`;

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

function pointStrictlyInValidatedRoom(point: PlanPoint, room: IsoOverlayRoom): boolean {
  if (pointOnRing(point, room.outer) || !pointInRing(point, room.outer)) return false;
  for (const hole of room.holes || []) {
    if (pointOnRing(point, hole) || pointInRing(point, hole)) return false;
  }
  return true;
}

function pointStrictlyInRoom(point: PlanPoint, room: IsoOverlayRoom): boolean {
  return validRoom(room) && pointStrictlyInValidatedRoom(point, room);
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

export function buildIsoFootprintPolygon(
  center: PlanPoint,
  halfSize: PlanPoint,
  zUnits: number,
  camera: IsoCamera = ISO_CAMERA,
  sceneOffset: ScenePoint = [0, 0],
): readonly ScenePoint[] {
  if (!finitePoint(center) || !finitePoint(halfSize) || halfSize[0] < 0 || halfSize[1] < 0
      || !Number.isFinite(zUnits) || !finitePoint(sceneOffset))
    throw new Error('invalid isometric overlay footprint');
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

function axisAlignedRoomBox(room: IsoOverlayRoom): Bounds | null {
  if (room.outer.length !== 4 || (room.holes?.length || 0) !== 0) return null;
  const bounds = ringBounds(room.outer);
  if (!bounds) return null;
  const corners = new Set(room.outer.map((point) => {
    const x = Math.abs(point[0] - bounds[0]) <= EPS ? 0
      : Math.abs(point[0] - bounds[2]) <= EPS ? 1 : -1;
    const y = Math.abs(point[1] - bounds[1]) <= EPS ? 0
      : Math.abs(point[1] - bounds[3]) <= EPS ? 1 : -1;
    return x < 0 || y < 0 ? '' : `${x}:${y}`;
  }));
  return corners.size === 4 && !corners.has('') ? bounds : null;
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

function segmentBoundsNear(
  bounds: Bounds, a: readonly number[], b: readonly number[], gap: number,
): boolean {
  return Math.min(a[0], b[0]) <= bounds[2] + gap
    && Math.max(a[0], b[0]) >= bounds[0] - gap
    && Math.min(a[1], b[1]) <= bounds[3] + gap
    && Math.max(a[1], b[1]) >= bounds[1] - gap;
}

function footprintNearSilhouette(
  footprint: readonly ScenePoint[], footprintBounds: Bounds,
  silhouette: IsoWallSilhouette, gap: number, cacheBounds: boolean,
): boolean {
  const wallBounds = silhouetteBounds(silhouette, cacheBounds);
  if (!wallBounds || !boundsNear(footprintBounds, wallBounds, gap)) return false;
  if (footprint.some((point) => pointInSilhouette(point, silhouette))) return true;
  if (silhouette.outer.some((point) =>
    point[0] >= footprintBounds[0] && point[0] <= footprintBounds[2]
      && point[1] >= footprintBounds[1] && point[1] <= footprintBounds[3]
      && pointInRing(point, footprint))) return true;
  for (const wallRing of [silhouette.outer, ...(silhouette.holes || [])]) {
    for (let footprintIndex = 0; footprintIndex < footprint.length; footprintIndex++) {
      const footprintNext = (footprintIndex + 1) % footprint.length;
      for (let wallIndex = 0; wallIndex < wallRing.length; wallIndex++) {
        const wallNext = (wallIndex + 1) % wallRing.length;
        if (!segmentBoundsNear(footprintBounds, wallRing[wallIndex], wallRing[wallNext], gap))
          continue;
        if (segmentDistance(footprint[footprintIndex], footprint[footprintNext],
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
  return segmentBetweenStrictRoomPoints(start, end, room);
}

function segmentBetweenStrictRoomPoints(
  start: PlanPoint, end: PlanPoint, room: IsoOverlayRoom,
): boolean {
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
  if (!finitePoint(input.floorAnchor) || !finitePoint(input.footprintHalfSize)
      || input.footprintHalfSize[0] < 0 || input.footprintHalfSize[1] < 0
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
      visualScene: floorScene, footprint: [], nudgeScene: [0, 0], nudgeCss: [0, 0],
      nudgeDistanceCss: 0, nudged: false, nearWallBefore: false, nearWallAfter: false,
      cleared: true, capped: false,
      grounding: { center: floorScene, visible: false }, tether,
      status: 'ok', reason: null,
    };
  }

  // Stage 4 keeps the canonical floor anchor and collision footprint, but the
  // screen-facing content sits just above the floor instead of on a tall
  // wall-height mast. The wall height is still validated because the same
  // placement consumes wall silhouettes built from that physical height.
  const raisedHeight = visualOffset;
  const raisedScene = projectPlanPoint(floorAnchor, raisedHeight, camera);
  const owner = input.ownerAlreadyResolved
    ? input.resolvedOwner ?? null
    : resolveIsoOverlayOwner(input);
  const geometryValid = input.wallGeometryValidated ?? input.wallSilhouettes.every(validSilhouette);
  const gapUnits = safetyGap * unitsPerPixel;
  const baseFootprint = buildIsoFootprintPolygon(floorAnchor, input.footprintHalfSize,
    raisedHeight, camera);
  const isNear = (footprint: readonly ScenePoint[]): boolean => {
    const bounds = ringBounds(footprint);
    return !!bounds && input.wallSilhouettes.some((wall) =>
      footprintNearSilhouette(footprint, bounds, wall, gapUnits,
        input.wallGeometryValidated === true));
  };
  const nearWallBefore = geometryValid ? isNear(baseFootprint) : true;

  let distanceCss = 0;
  let nudgeScene: ScenePoint = [0, 0];
  let knownNearWallAfter: boolean | null = null;
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
        const searchRatio = searchLimitCss * unitsPerPixel / length;
        const searchEndPlan: PlanPoint = [
          floorAnchor[0] + (owner.safePoint[0] - floorAnchor[0]) * searchRatio,
          floorAnchor[1] + (owner.safePoint[1] - floorAnchor[1]) * searchRatio,
        ];
        // The structural scene may contain hundreds of faces. Only silhouettes
        // intersecting the complete swept footprint envelope can affect this nudge;
        // filter them once instead of repeating the whole-scene scan for every
        // coarse and binary probe.
        const maxOffset: ScenePoint = [
          ux * searchLimitCss * unitsPerPixel,
          uy * searchLimitCss * unitsPerPixel,
        ];
        const sweptBounds = ringBounds([
          ...baseFootprint,
          ...baseFootprint.map((point) => [
            point[0] + maxOffset[0], point[1] + maxOffset[1],
          ] as ScenePoint),
        ]);
        const nearbyWalls = sweptBounds
          ? input.wallSilhouettes.filter((wall) => {
            const wallBounds = silhouetteBounds(wall, input.wallGeometryValidated === true);
            return !!wallBounds && boundsNear(sweptBounds, wallBounds, gapUnits);
          })
          : input.wallSilhouettes;
        const pathSafeToLimit = !!ownerRoom
          && segmentStrictlyInRoom(floorAnchor, searchEndPlan, ownerRoom);
        const collidesAt = (candidateCss: number): boolean => {
          const offset: ScenePoint = [ux * candidateCss * unitsPerPixel,
            uy * candidateCss * unitsPerPixel];
          const footprint = baseFootprint.map((point) =>
            [point[0] + offset[0], point[1] + offset[1]] as ScenePoint);
          const bounds = ringBounds(footprint);
          return !!bounds && nearbyWalls.some((wall) =>
            footprintNearSilhouette(footprint, bounds, wall, gapUnits,
              input.wallGeometryValidated === true));
        };
        const hint = input.nudgeHintCss;
        if (Number.isFinite(hint) && hint! >= 0 && hint! <= searchLimitCss) {
          const ratio = hint! * unitsPerPixel / length;
          const hintPlan: PlanPoint = [
            floorAnchor[0] + (owner.safePoint[0] - floorAnchor[0]) * ratio,
            floorAnchor[1] + (owner.safePoint[1] - floorAnchor[1]) * ratio,
          ];
          if ((pathSafeToLimit
              || !!ownerRoom && segmentStrictlyInRoom(floorAnchor, hintPlan, ownerRoom))
              && !collidesAt(hint!)) {
            // A wheel step changes only the CSS/scene scale. Reusing the last
            // distance after proving it still clear avoids another 1 px scan
            // plus binary search for every raised marker.
            distanceCss = hint!;
            knownNearWallAfter = false;
          }
        }
        if (knownNearWallAfter === null) {
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
            if (!pathSafeToLimit
                && (!ownerRoom || !segmentStrictlyInRoom(floorAnchor, candidatePlan, ownerRoom))) {
              ownerBoundary = true;
              break;
            }
            if (!collidesAt(candidate)) { clearAt = candidate; break; }
            previous = candidate;
          }
          if (clearAt !== null) {
            let low = previous, high = clearAt;
            for (let iteration = 0; iteration < ISO_OVERLAY_NUDGE_SEARCH_ITERATIONS; iteration++) {
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
        }
        nudgeScene = [ux * distanceCss * unitsPerPixel, uy * distanceCss * unitsPerPixel];
      }
    }
  }

  const visualScene: ScenePoint = [raisedScene[0] + nudgeScene[0], raisedScene[1] + nudgeScene[1]];
  const footprint = buildIsoFootprintPolygon(floorAnchor, input.footprintHalfSize,
    raisedHeight, camera, nudgeScene);
  const nearWallAfter = geometryValid ? knownNearWallAfter ?? isNear(footprint) : true;
  const nudged = distanceCss > EPS;
  // Ownership remains encoded by the immutable anchor and invisible bounded
  // footprint. Stage 4 deliberately removes the visible ground dot and long
  // tether which made the architectural view look like a debug overlay.
  const tetherVisible = false;
  return {
    plane, owner, floorAnchor, floorScene, raisedScene, visualScene, footprint,
    nudgeScene,
    nudgeCss: [nudgeScene[0] / unitsPerPixel, nudgeScene[1] / unitsPerPixel],
    nudgeDistanceCss: distanceCss,
    nudged, nearWallBefore, nearWallAfter,
    cleared: !nearWallAfter, capped,
    grounding: { center: floorScene, visible: false },
    tether: tetherGeometry(floorScene, visualScene, tetherVisible),
    status, reason,
  };
}

const ISO_OVERLAY_GROUP_CELL_CSS_PX = 64;

/** Candidate displacement together with its stable distance ordering. */
interface GroupOffset { readonly offset: ScenePoint; readonly distance: number }

type BoundaryCandidateMap = {
  readonly points: Map<number | string, ScenePoint>;
  readonly pending: ScenePoint[];
};

function createBoundaryCandidates(): BoundaryCandidateMap {
  return { points: new Map(), pending: [] };
}

function boundaryCandidateKey(x: number, y: number): number | string {
  // Production is bounded by 48 CSS px. Keep that hot path on V8's numeric
  // Map representation; the string fallback preserves the helper's general
  // finite-input contract without admitting packed-key collisions.
  if (Number.isInteger(x) && Number.isInteger(y)
      && x >= -32768 && x <= 32767 && y >= -32768 && y <= 32767)
    return (x + 32768) * 65536 + y + 32768;
  return `${x}:${y}`;
}

/**
 * Add both sides of a continuous boundary to the integer CSS-pixel lattice.
 * The exact geometry still decides whether a point is legal; these neighbours
 * merely make a sub-4 px slit observable without scanning the whole disk.
 */
function addBoundaryCandidate(
  candidates: BoundaryCandidateMap, point: ScenePoint, maxNudge: number,
): void {
  const axisNeighbours = (value: number): readonly number[] => {
    const floor = Math.floor(value), ceil = Math.ceil(value);
    return floor === ceil ? [floor - 1, floor, floor + 1] : [floor, ceil];
  };
  const xs = axisNeighbours(point[0]), ys = axisNeighbours(point[1]);
  for (const candidateY of ys) {
    for (const candidateX of xs) {
      if (candidateX * candidateX + candidateY * candidateY > maxNudge * maxNudge + EPS)
        continue;
      const key = boundaryCandidateKey(candidateX, candidateY);
      if (!candidates.points.has(key)) {
        const point: ScenePoint = [candidateX, candidateY];
        candidates.points.set(key, point);
        candidates.pending.push(point);
      }
    }
  }
}

/** Liang-Barsky clipping keeps work proportional to the visible boundary. */
function clipBoundarySegment(
  start: ScenePoint, end: ScenePoint, limit: number,
): readonly [ScenePoint, ScenePoint] | null {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  let from = 0, to = 1;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) <= EPS) return q >= 0;
    const ratio = q / p;
    if (p < 0) {
      if (ratio > to) return false;
      if (ratio > from) from = ratio;
    } else {
      if (ratio < from) return false;
      if (ratio < to) to = ratio;
    }
    return true;
  };
  if (!clip(-dx, start[0] + limit) || !clip(dx, limit - start[0])
      || !clip(-dy, start[1] + limit) || !clip(dy, limit - start[1])) return null;
  return [
    [start[0] + dx * from, start[1] + dy * from],
    [start[0] + dx * to, start[1] + dy * to],
  ];
}

function addBoundaryRectangle(
  candidates: BoundaryCandidateMap, bounds: Bounds, maxNudge: number,
): void {
  addBoundaryCandidate(candidates,
    [bounds[0], Math.max(bounds[1], Math.min(0, bounds[3]))], maxNudge);
  addBoundaryCandidate(candidates,
    [bounds[2], Math.max(bounds[1], Math.min(0, bounds[3]))], maxNudge);
  addBoundaryCandidate(candidates,
    [Math.max(bounds[0], Math.min(0, bounds[2])), bounds[1]], maxNudge);
  addBoundaryCandidate(candidates,
    [Math.max(bounds[0], Math.min(0, bounds[2])), bounds[3]], maxNudge);
  addBoundaryCandidate(candidates, [bounds[0], bounds[1]], maxNudge);
  addBoundaryCandidate(candidates, [bounds[2], bounds[1]], maxNudge);
  addBoundaryCandidate(candidates, [bounds[2], bounds[3]], maxNudge);
  addBoundaryCandidate(candidates, [bounds[0], bounds[3]], maxNudge);
}

function addBoundaryRectangleIntersections(
  candidates: BoundaryCandidateMap, left: Bounds, right: Bounds, maxNudge: number,
): void {
  // Only intersections of FINITE rectangle edges are critical. Combining
  // every X with every unrelated Y forms an artificial O(n²) interior grid;
  // on the 200-device benchmark it produced almost five thousand candidates
  // for one overlay although the corresponding edge segments never met.
  const addIntersections = (vertical: Bounds, horizontal: Bounds): void => {
    for (const x of [vertical[0], vertical[2]]) {
      if (x < horizontal[0] - EPS || x > horizontal[2] + EPS) continue;
      for (const y of [horizontal[1], horizontal[3]]) {
        if (y >= vertical[1] - EPS && y <= vertical[3] + EPS)
          addBoundaryCandidate(candidates, [x, y], maxNudge);
      }
    }
  };
  addIntersections(left, right);
  addIntersections(right, left);
}

function addBoundaryRectangleEvents(
  candidates: BoundaryCandidateMap, rectangles: readonly Bounds[], maxNudge: number,
): void {
  for (const bounds of rectangles) addBoundaryRectangle(candidates, bounds, maxNudge);
  for (let left = 0; left < rectangles.length; left++) {
    for (let right = left + 1; right < rectangles.length; right++) {
      addBoundaryRectangleIntersections(
        candidates, rectangles[left], rectangles[right], maxNudge,
      );
    }
  }
}

/**
 * Pure boundary-event generator kept public for the bounded-search contract.
 * Production and unit tests share this implementation; legality is still
 * decided later by the exact room, wall, footprint and overlap predicates.
 */
export function buildIsoOverlayBoundaryCandidates(
  rectangles: readonly Bounds[], maxNudge: number,
): readonly ScenePoint[] {
  if (!(maxNudge >= 0) || !Number.isFinite(maxNudge))
    throw new Error('invalid isometric overlay boundary input');
  const candidates = createBoundaryCandidates();
  addBoundaryRectangleEvents(candidates, rectangles, maxNudge);
  return Object.freeze(sortedBoundaryCandidates(candidates).map(({ offset }) =>
    Object.freeze(offset) as ScenePoint));
}

function addCriticalBoundarySegment(
  candidates: BoundaryCandidateMap, start: ScenePoint, end: ScenePoint, maxNudge: number,
): void {
  const clipped = clipBoundarySegment(start, end, maxNudge + 2);
  if (!clipped) return;
  const dx = clipped[1][0] - clipped[0][0], dy = clipped[1][1] - clipped[0][1];
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared > EPS
    ? Math.max(0, Math.min(1, -(clipped[0][0] * dx + clipped[0][1] * dy) / lengthSquared))
    : 0;
  addBoundaryCandidate(candidates, clipped[0], maxNudge);
  addBoundaryCandidate(candidates, clipped[1], maxNudge);
  addBoundaryCandidate(candidates, [
    clipped[0][0] + dx * ratio, clipped[0][1] + dy * ratio,
  ], maxNudge);
}

function addCriticalBoundaryRectangle(
  candidates: BoundaryCandidateMap, bounds: Bounds, maxNudge: number,
): void {
  const corners: readonly ScenePoint[] = [
    [bounds[0], bounds[1]], [bounds[2], bounds[1]],
    [bounds[2], bounds[3]], [bounds[0], bounds[3]],
  ];
  for (let index = 0; index < corners.length; index++)
    addCriticalBoundarySegment(candidates,
      corners[index], corners[(index + 1) % corners.length], maxNudge);
}

type BoundarySegment = readonly [start: ScenePoint, end: ScenePoint];

function addBoundarySegmentRectangleIntersection(
  candidates: BoundaryCandidateMap, segment: BoundarySegment,
  bounds: Bounds, maxNudge: number,
): void {
  const [start, end] = segment;
  const dx = end[0] - start[0], dy = end[1] - start[1];
  if (Math.abs(dx) > EPS) {
    for (const x of [bounds[0], bounds[2]]) {
      const ratio = (x - start[0]) / dx;
      if (ratio < -EPS || ratio > 1 + EPS) continue;
      const y = start[1] + dy * ratio;
      if (y >= bounds[1] - EPS && y <= bounds[3] + EPS)
        addBoundaryCandidate(candidates, [x, y], maxNudge);
    }
  }
  if (Math.abs(dy) > EPS) {
    for (const y of [bounds[1], bounds[3]]) {
      const ratio = (y - start[1]) / dy;
      if (ratio < -EPS || ratio > 1 + EPS) continue;
      const x = start[0] + dx * ratio;
      if (x >= bounds[0] - EPS && x <= bounds[2] + EPS)
        addBoundaryCandidate(candidates, [x, y], maxNudge);
    }
  }
}

function addBoundarySegmentRectangleIntersections(
  candidates: BoundaryCandidateMap, segment: BoundarySegment,
  rectangles: readonly Bounds[], maxNudge: number,
): void {
  for (const bounds of rectangles)
    addBoundarySegmentRectangleIntersection(candidates, segment, bounds, maxNudge);
}

function addBoundaryLineIntersection(
  candidates: BoundaryCandidateMap, left: BoundarySegment,
  right: BoundarySegment, maxNudge: number,
): void {
  const [a, b] = left, [c, d] = right;
  const ab: ScenePoint = [b[0] - a[0], b[1] - a[1]];
  const cd: ScenePoint = [d[0] - c[0], d[1] - c[1]];
  const denominator = ab[0] * cd[1] - ab[1] * cd[0];
  if (Math.abs(denominator) <= EPS) return;
  const ac: ScenePoint = [c[0] - a[0], c[1] - a[1]];
  const ratio = (ac[0] * cd[1] - ac[1] * cd[0]) / denominator;
  const otherRatio = (ac[0] * ab[1] - ac[1] * ab[0]) / denominator;
  if (ratio < -EPS || ratio > 1 + EPS
      || otherRatio < -EPS || otherRatio > 1 + EPS) return;
  const point: ScenePoint = [a[0] + ab[0] * ratio, a[1] + ab[1] * ratio];
  if (Math.hypot(point[0], point[1]) <= maxNudge + 2)
    addBoundaryCandidate(candidates, point, maxNudge);
}

/**
 * Boundary of one wall edge dilated by the complete overlay footprint and the
 * safety gap. The two parallel support segments are exact critical events for
 * the straight part of the Minkowski boundary; the final polygon predicate
 * still decides legality around vertices and concavities.
 */
type WallBoundaryEdge = {
  readonly tangent: ScenePoint;
  readonly normal: ScenePoint;
  readonly tangentMin: number;
  readonly tangentMax: number;
  readonly normalOffset: number;
};

const wallBoundaryEdgeCache = new WeakMap<IsoWallSilhouette, readonly WallBoundaryEdge[]>();

function wallBoundaryEdges(wall: IsoWallSilhouette): readonly WallBoundaryEdge[] {
  const cached = wallBoundaryEdgeCache.get(wall);
  if (cached) return cached;
  const result: WallBoundaryEdge[] = [];
  for (const ring of [wall.outer, ...(wall.holes || [])]) {
    for (let index = 0; index < ring.length; index++) {
      const wallStart = ring[index], wallEnd = ring[(index + 1) % ring.length];
      const edgeX = wallEnd[0] - wallStart[0], edgeY = wallEnd[1] - wallStart[1];
      const edgeLength = Math.hypot(edgeX, edgeY);
      if (edgeLength <= EPS) continue;
      const tangent: ScenePoint = [edgeX / edgeLength, edgeY / edgeLength];
      const normal: ScenePoint = [-tangent[1], tangent[0]];
      const tangentStart = wallStart[0] * tangent[0] + wallStart[1] * tangent[1];
      const tangentEnd = wallEnd[0] * tangent[0] + wallEnd[1] * tangent[1];
      result.push({
        tangent, normal,
        tangentMin: Math.min(tangentStart, tangentEnd),
        tangentMax: Math.max(tangentStart, tangentEnd),
        normalOffset: wallStart[0] * normal[0] + wallStart[1] * normal[1],
      });
    }
  }
  wallBoundaryEdgeCache.set(wall, result);
  return result;
}

function addExpandedWallBoundarySegments(
  candidates: BoundaryCandidateMap, wall: IsoWallSilhouette,
  footprint: readonly ScenePoint[], gapUnits: number, unitsPerPixel: number,
  maxNudge: number, rectangles: readonly Bounds[], segments?: BoundarySegment[],
): void {
  for (const edge of wallBoundaryEdges(wall)) {
      const { tangent, normal } = edge;
      const dot = (point: readonly number[], axis: ScenePoint): number =>
        point[0] * axis[0] + point[1] * axis[1];
      let footprintTangentMin = Infinity, footprintTangentMax = -Infinity;
      let footprintNormalMin = Infinity, footprintNormalMax = -Infinity;
      for (const point of footprint) {
        const tangentOffset = dot(point, tangent), normalOffset = dot(point, normal);
        footprintTangentMin = Math.min(footprintTangentMin, tangentOffset);
        footprintTangentMax = Math.max(footprintTangentMax, tangentOffset);
        footprintNormalMin = Math.min(footprintNormalMin, normalOffset);
        footprintNormalMax = Math.max(footprintNormalMax, normalOffset);
      }
      const tangentMin = edge.tangentMin - footprintTangentMax - gapUnits;
      const tangentMax = edge.tangentMax - footprintTangentMin + gapUnits;
      const normalOffsets = [
        edge.normalOffset - gapUnits - footprintNormalMax,
        edge.normalOffset + gapUnits - footprintNormalMin,
      ];
      for (const normalOffset of normalOffsets) {
        const toPoint = (tangentOffset: number): ScenePoint => [
          (tangent[0] * tangentOffset + normal[0] * normalOffset) / unitsPerPixel,
          (tangent[1] * tangentOffset + normal[1] * normalOffset) / unitsPerPixel,
        ];
        const clipped = clipBoundarySegment(
          toPoint(tangentMin), toPoint(tangentMax), maxNudge + 2,
        );
        if (!clipped) continue;
        segments?.push(clipped);
        addCriticalBoundarySegment(candidates, clipped[0], clipped[1], maxNudge);
        addBoundarySegmentRectangleIntersections(
          candidates, clipped, rectangles, maxNudge,
        );
      }
  }
}

function addBoundaryCircle(
  candidates: BoundaryCandidateMap, radius: number,
): void {
  if (radius <= EPS) {
    addBoundaryCandidate(candidates, [0, 0], radius);
    return;
  }
  // Enumerate the one-dimensional integer neighbourhood of the rim. This is
  // O(radius), unlike the forbidden O(radius²) disk scan, and preserves exact
  // nearest lattice points such as (29, -38) near a 48 px cap.
  for (let x = Math.ceil(-radius); x <= Math.floor(radius); x++) {
    const y = Math.sqrt(Math.max(0, radius * radius - x * x));
    addBoundaryCandidate(candidates, [x, y], radius);
    addBoundaryCandidate(candidates, [x, -y], radius);
  }
}

function sortedBoundaryCandidates(candidates: BoundaryCandidateMap): GroupOffset[] {
  return [...candidates.points.values()].map((offset) => ({
    offset, distance: Math.hypot(offset[0], offset[1]),
  })).sort((a, b) => a.distance - b.distance
    || a.offset[1] - b.offset[1] || a.offset[0] - b.offset[0]);
}

/**
 * Snap a continuous boundary event back to the exact integer-pixel result.
 * The bounded 9x9 neighbourhood replaces the old complete 7,238-point disk.
 */
function localRefinementOffsets(
  around: ScenePoint, maxNudge: number, reach = 4,
): readonly GroupOffset[] {
  const offsets: GroupOffset[] = [];
  for (let y = Math.floor(around[1] - reach); y <= Math.ceil(around[1] + reach); y++) {
    for (let x = Math.floor(around[0] - reach); x <= Math.ceil(around[0] + reach); x++) {
      const distance = Math.hypot(x, y);
      if (distance <= maxNudge + EPS) offsets.push({ offset: [x, y], distance });
    }
  }
  offsets.sort((a, b) => a.distance - b.distance
    || a.offset[1] - b.offset[1] || a.offset[0] - b.offset[0]);
  return offsets;
}

function overlayRootBounds(
  item: IsoOverlayCollisionItem, center: ScenePoint,
): Bounds {
  return [
    center[0] - item.screenHalfSize[0],
    center[1] - item.screenHalfSize[1],
    center[0] + item.screenHalfSize[0],
    center[1] + item.screenHalfSize[1],
  ];
}

function expandedBounds(bounds: Bounds, gap: number): Bounds {
  return [bounds[0] - gap, bounds[1] - gap, bounds[2] + gap, bounds[3] + gap];
}

function overlapPenalty(a: Bounds, b: Bounds, gap: number): number {
  const x = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + gap;
  const y = Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + gap;
  return x > EPS && y > EPS ? x * y : 0;
}

function raisedSceneToPlan(
  point: ScenePoint, visualOffset: number, camera: IsoCamera,
): PlanPoint {
  const tilt = camera.tiltDeg * Math.PI / 180;
  return unprojectFloorPoint([
    point[0],
    point[1] + visualOffset * camera.zScale * Math.sin(tilt),
  ], camera);
}

function placementAtGroupOffset(
  base: IsoOverlayPlacement,
  offsetCss: ScenePoint,
  unitsPerPixel: number,
  residual: boolean,
): IsoOverlayPlacement {
  const nudgeScene: ScenePoint = [
    offsetCss[0] * unitsPerPixel,
    offsetCss[1] * unitsPerPixel,
  ];
  if (!residual
      && Math.abs(nudgeScene[0] - base.nudgeScene[0]) <= EPS
      && Math.abs(nudgeScene[1] - base.nudgeScene[1]) <= EPS) return base;
  const delta: ScenePoint = [
    nudgeScene[0] - base.nudgeScene[0],
    nudgeScene[1] - base.nudgeScene[1],
  ];
  const visualScene: ScenePoint = [
    base.raisedScene[0] + nudgeScene[0],
    base.raisedScene[1] + nudgeScene[1],
  ];
  const nudgeDistanceCss = Math.hypot(offsetCss[0], offsetCss[1]);
  return {
    ...base,
    visualScene,
    footprint: base.footprint.map((point) => [
      point[0] + delta[0], point[1] + delta[1],
    ] as ScenePoint),
    nudgeScene,
    nudgeCss: offsetCss,
    nudgeDistanceCss,
    nudged: nudgeDistanceCss > EPS,
    capped: base.capped || residual,
    status: residual ? 'degraded' : base.status,
    reason: residual ? 'overlay-collision' : base.reason,
    tether: tetherGeometry(base.floorScene, visualScene, false),
  };
}

type AcceptedOverlay = {
  key: string;
  bounds: Bounds;
};

/**
 * Resolve device/lock collisions after each item has independently cleared
 * wall geometry. Room labels deliberately do not enter this pass. Earlier
 * items are the ones with the smaller already-required wall displacement;
 * ties use kind/id, never HA registry or render order.
 */
export function resolveIsoOverlayCollisions(
  input: IsoOverlayCollisionInput,
): IsoOverlayCollisionResult {
  const unitsPerPixel = input.sceneUnitsPerCssPixel;
  const maxNudge = input.maxNudgeCssPx ?? ISO_OVERLAY_MAX_NUDGE_CSS_PX;
  const safetyGap = input.safetyGapCssPx ?? ISO_OVERLAY_SAFETY_GAP_CSS_PX;
  const visualOffset = input.visualOffset ?? ISO_OVERLAY_VISUAL_OFFSET;
  const camera = input.camera || ISO_CAMERA;
  if (!(unitsPerPixel > 0) || !Number.isFinite(unitsPerPixel)
      || !(maxNudge >= 0) || !Number.isFinite(maxNudge)
      || !(safetyGap >= 0) || !Number.isFinite(safetyGap)) {
    throw new Error('invalid isometric overlay collision input');
  }
  const gapUnits = safetyGap * unitsPerPixel;
  const cellUnits = ISO_OVERLAY_GROUP_CELL_CSS_PX * unitsPerPixel;
  const rooms = new Map(input.rooms.filter(validRoom).map((room) => [room.id, room]));
  const roomBounds = new Map([...rooms].map(([id, room]) => [
    id, ringBounds(room.outer as readonly ScenePoint[]),
  ]));
  const axisAlignedRoomBoxes = new Map([...rooms].flatMap(([id, room]) => {
    const bounds = axisAlignedRoomBox(room);
    return bounds ? [[id, bounds] as const] : [];
  }));
  const wallsValid = input.wallSilhouettes.every(validSilhouette);
  const wallRows = input.wallSilhouettes.map((wall) => ({
    wall, bounds: silhouetteBounds(wall, true),
  }));
  const accepted: AcceptedOverlay[] = [];
  const cells = new Map<number | string, number[]>();
  const placements = new Map<string, IsoOverlayPlacement>();
  const residualPairs: Array<readonly [string, string]> = [];
  const stableItems = [...input.items].sort((a, b) =>
    a.placement.nudgeDistanceCss - b.placement.nudgeDistanceCss
    || isoOverlayCollisionKey(a.kind, a.id).localeCompare(isoOverlayCollisionKey(b.kind, b.id)));
  const rot = camera.rotDeg * Math.PI / 180;
  const tilt = camera.tiltDeg * Math.PI / 180;
  const inverseX = 1 / camera.xyScale;
  const inverseY = 1 / (camera.xyScale * Math.cos(tilt));
  const cosRot = Math.cos(rot), sinRot = Math.sin(rot);

  const cellRange = (bounds: Bounds): readonly [number, number, number, number] => [
    Math.floor(bounds[0] / cellUnits), Math.floor(bounds[1] / cellUnits),
    Math.floor(bounds[2] / cellUnits), Math.floor(bounds[3] / cellUnits),
  ];
  const nearby = (bounds: Bounds): number[] => {
    const [minX, minY, maxX, maxY] = cellRange(expandedBounds(bounds, gapUnits));
    const result = new Set<number>();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (const index of cells.get(boundaryCandidateKey(x, y)) || []) result.add(index);
      }
    }
    return [...result].sort((a, b) => a - b);
  };
  const addAccepted = (value: AcceptedOverlay): void => {
    const index = accepted.push(value) - 1;
    const [minX, minY, maxX, maxY] = cellRange(value.bounds);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = boundaryCandidateKey(x, y);
        const list = cells.get(key) || [];
        list.push(index);
        cells.set(key, list);
      }
    }
  };

  for (const item of stableItems) {
    const key = isoOverlayCollisionKey(item.kind, item.id);
    const base = item.placement;
    const baseOffsetCss: ScenePoint = [
      base.nudgeScene[0] / unitsPerPixel,
      base.nudgeScene[1] / unitsPerPixel,
    ];
    const baseFootprint = base.footprint.map((point) => [
      point[0] - base.nudgeScene[0], point[1] - base.nudgeScene[1],
    ] as ScenePoint);
    const ownerRoom = base.owner ? rooms.get(base.owner.id) || null : null;
    const currentPlan = raisedSceneToPlan(base.visualScene, visualOffset, camera);
    const baseFootprintBounds = ringBounds(baseFootprint);
    const wallCandidates = wallsValid && baseFootprint.length
      ? wallRows.filter(({ bounds: wallBounds }) => {
        if (!wallBounds) return false;
        const radius = maxNudge * unitsPerPixel;
        return !!baseFootprintBounds && boundsNear(expandedBounds(baseFootprintBounds, radius),
          wallBounds, gapUnits);
      })
      : wallRows;

    /**
     * Дешёвая половина кандидата: где он окажется и с кем столкнётся.
     *
     * Порядок половин — не стиль, а цена (#583 перед бетой .5). Проверка
     * комнаты и силуэтов стен строит трансформированный footprint и гоняет
     * полигон против каждой стены-кандидата; на плотной группе полный обход
     * диска в 7238 смещений делал это тысячи раз за один проход, и групповой
     * резолвер стоил ~755 мс на вызов. Сначала считается то, что стоит
     * обращения к сетке ячеек, и только у смещения, способного УЛУЧШИТЬ
     * результат, проверяется допустимость.
     */
    /**
     * Соседи, до которых вообще можно дотянуться в пределах 48 px.
     *
     * Прежде каждое смещение спрашивало сетку ячеек заново: Set, разбор ключей
     * и сортировка массива на каждого из 7238 кандидатов. Диапазон досягаемости
     * известен заранее — он не зависит от смещения, — поэтому список строится
     * один раз на элемент, и внутренний цикл остаётся арифметикой.
     */
    const reachIndices = nearby(expandedBounds(
      overlayRootBounds(item, base.raisedScene), maxNudge * unitsPerPixel,
    ));
    const conflictsAt = (bounds: Bounds): { conflicts: number[]; penalty: number } => {
      const conflicts: number[] = [];
      let penalty = 0;
      for (const index of reachIndices) {
        const value = overlapPenalty(bounds, accepted[index].bounds, gapUnits);
        if (value > EPS) { conflicts.push(index); penalty += value; }
      }
      return { conflicts, penalty };
    };

    const candidateShape = (offsetCss: ScenePoint): {
      offsetScene: ScenePoint;
      sameAsBase: boolean;
      visualScene: ScenePoint;
      bounds: Bounds;
      conflicts: readonly number[];
      penalty: number;
    } | null => {
      const distance = Math.hypot(offsetCss[0], offsetCss[1]);
      if (distance > maxNudge + EPS) return null;
      const offsetScene: ScenePoint = [
        offsetCss[0] * unitsPerPixel, offsetCss[1] * unitsPerPixel,
      ];
      const sameAsBase = Math.abs(offsetScene[0] - base.nudgeScene[0]) <= EPS
        && Math.abs(offsetScene[1] - base.nudgeScene[1]) <= EPS;
      const visualScene: ScenePoint = [
        base.raisedScene[0] + offsetScene[0],
        base.raisedScene[1] + offsetScene[1],
      ];
      const bounds = overlayRootBounds(item, visualScene);
      const { conflicts, penalty } = conflictsAt(bounds);
      return { offsetScene, sameAsBase, visualScene, bounds, conflicts, penalty };
    };

    /** Дорогая половина: комната владельца, кладка и непрерывность пути. */
    /**
     * Прямоугольник комнаты владельца — дешёвый отказ до полигонов (#583 перед
     * бетой .5). Замер на `large-house-isometric-v1`: из 2 523 652 просмотренных
     * смещений 1 911 721 доходило до проверки комнаты и кладки, и именно она
     * съедала 8.5 из 9.6 секунд группового прохода. Подавляющее большинство
     * этих точек лежит ВНЕ комнаты — узнать это можно сравнением четырёх чисел,
     * а не обходом колец полигона и силуэтов стен.
    */
    const ownerBox = ownerRoom ? roomBounds.get(ownerRoom.id) || null : null;
    const ownerAxisBox = ownerRoom ? axisAlignedRoomBoxes.get(ownerRoom.id) || null : null;
    const currentStrictlyInOwner = !!ownerRoom
      && (ownerAxisBox
        ? currentPlan[0] > ownerAxisBox[0] + EPS
          && currentPlan[0] < ownerAxisBox[2] - EPS
          && currentPlan[1] > ownerAxisBox[1] + EPS
          && currentPlan[1] < ownerAxisBox[3] - EPS
        : pointStrictlyInValidatedRoom(currentPlan, ownerRoom));

    /**
     * Широкая фаза по стенам — то, чего требовал §6.4 ТЗ и чего не было.
     *
     * Замер на `large-house-isometric-v1`: 1 742 740 проверок footprint против
     * 41 841 466 пар «кандидат × стена», 6.4 с из 8.9 с прохода. Стен в радиусе
     * 48 px около двух десятков, но для КОНКРЕТНОГО смещения близка одна-две.
     * Стены раскладываются по тем же ячейкам, что и принятые оверлеи, и каждый
     * кандидат смотрит только свои ячейки.
     */
    const wallCells = new Map<number | string, number[]>();
    for (let index = 0; index < wallCandidates.length; index++) {
      const wallBounds = wallCandidates[index].bounds;
      if (!wallBounds) continue;
      const [minX, minY, maxX, maxY] = cellRange(expandedBounds(wallBounds, gapUnits));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const key = boundaryCandidateKey(x, y);
          const list = wallCells.get(key) || [];
          list.push(index);
          wallCells.set(key, list);
        }
      }
    }
    // Пометки поколения вместо Set на каждого кандидата: аллокация в этом цикле
    // стоит дороже самой проверки.
    const wallSeen = new Int32Array(wallCandidates.length);
    let wallSeenGeneration = 0;
    const translatedFootprint = baseFootprint.map(() => [0, 0] as [number, number]);
    const footprintAt = (offset: ScenePoint): readonly ScenePoint[] => {
      for (let index = 0; index < baseFootprint.length; index++) {
        translatedFootprint[index][0] = baseFootprint[index][0] + offset[0];
        translatedFootprint[index][1] = baseFootprint[index][1] + offset[1];
      }
      return translatedFootprint;
    };
    const firstWallNear = (
      bounds: Bounds, footprint: () => readonly ScenePoint[],
    ): number | undefined => {
      const minX = Math.floor((bounds[0] - gapUnits) / cellUnits);
      const minY = Math.floor((bounds[1] - gapUnits) / cellUnits);
      const maxX = Math.floor((bounds[2] + gapUnits) / cellUnits);
      const maxY = Math.floor((bounds[3] + gapUnits) / cellUnits);
      wallSeenGeneration += 1;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          for (const index of wallCells.get(boundaryCandidateKey(x, y)) || []) {
            if (wallSeen[index] === wallSeenGeneration) continue;
            wallSeen[index] = wallSeenGeneration;
            if (footprintNearSilhouette(
              footprint(), bounds, wallCandidates[index].wall, gapUnits, true,
            )) return index;
          }
        }
      }
      return undefined;
    };

    const INSPECTION_ALLOWED = -2;
    const INSPECTION_ROOM = -1;
    const inspectCandidate = (shape: {
      offsetScene: ScenePoint; sameAsBase: boolean; visualScene: ScenePoint;
    }): number => {
      if (shape.sameAsBase) return INSPECTION_ALLOWED;
      if (!wallsValid || !ownerRoom) return INSPECTION_ROOM;
      const sceneDx = shape.visualScene[0] - base.visualScene[0];
      const sceneDy = shape.visualScene[1] - base.visualScene[1];
      const rx = sceneDx * inverseX, ry = sceneDy * inverseY;
      const planX = currentPlan[0] + rx * cosRot + ry * sinRot;
      const planY = currentPlan[1] - rx * sinRot + ry * cosRot;
      if (ownerBox && (planX < ownerBox[0] || planX > ownerBox[2]
        || planY < ownerBox[1] || planY > ownerBox[3]))
        return INSPECTION_ROOM;
      if (ownerAxisBox) {
        if (!(planX > ownerAxisBox[0] + EPS && planX < ownerAxisBox[2] - EPS
            && planY > ownerAxisBox[1] + EPS && planY < ownerAxisBox[3] - EPS))
          return INSPECTION_ROOM;
      } else {
        const plan: PlanPoint = [planX, planY];
        if (!pointStrictlyInValidatedRoom(plan, ownerRoom))
          return INSPECTION_ROOM;
        if (currentStrictlyInOwner
            && !segmentBetweenStrictRoomPoints(currentPlan, plan, ownerRoom))
          return INSPECTION_ROOM;
      }
      if (!baseFootprintBounds) return INSPECTION_ROOM;
      const footprintBounds: Bounds = [
        baseFootprintBounds[0] + shape.offsetScene[0],
        baseFootprintBounds[1] + shape.offsetScene[1],
        baseFootprintBounds[2] + shape.offsetScene[0],
        baseFootprintBounds[3] + shape.offsetScene[1],
      ];
      let footprint: readonly ScenePoint[] | null = null;
      const wall = firstWallNear(
        footprintBounds, () => footprint ||= footprintAt(shape.offsetScene),
      );
      return wall === undefined ? INSPECTION_ALLOWED : wall;
    };
    const candidateAllowed = (shape: {
      offsetScene: ScenePoint; sameAsBase: boolean; visualScene: ScenePoint;
    }): boolean => inspectCandidate(shape) === INSPECTION_ALLOWED;

    const candidate = (offsetCss: ScenePoint): {
      placement: IsoOverlayPlacement;
      bounds: Bounds;
      conflicts: readonly number[];
      penalty: number;
    } | null => {
      const shape = candidateShape(offsetCss);
      if (!shape || !candidateAllowed(shape)) return null;
      return {
        placement: placementAtGroupOffset(base, offsetCss, unitsPerPixel, false),
        bounds: shape.bounds, conflicts: shape.conflicts, penalty: shape.penalty,
      };
    };

    const baseCandidate = candidate(baseOffsetCss);
    let best = baseCandidate;
    let bestFromHint = false;
    if (!best || best.conflicts.length) {
      const hinted = item.nudgeHintCss ? candidate(item.nudgeHintCss) : null;
      if (hinted && !hinted.conflicts.length) {
        best = hinted;
        bestFromHint = true;
      }
    }
    if (!baseCandidate || baseCandidate.conflicts.length) {
      /**
       * A nearest free point must touch the boundary of the forbidden union.
       * Enumerate those one-dimensional boundaries instead of the 7238 points
       * in the complete 48 px disk. The 1 px neighbours added by the helper
       * preserve the old integer result even when a legal slit is narrower
       * than the former 4 px coarse grid.
       */
      const boundaryCandidates = createBoundaryCandidates();
      const overlayBoundaryRectangles: Bounds[] = [];
      const boundaryRectangles: Bounds[] = [];
      const boundarySegments: BoundarySegment[] = [];
      const expandedOverlayBoundaries = new Set<number>();
      const encounteredOverlayBoundaries = new Set<number>(baseCandidate?.conflicts || []);
      const addOverlayBoundary = (index: number): void => {
        if (expandedOverlayBoundaries.has(index)) return;
        expandedOverlayBoundaries.add(index);
        const obstacle = accepted[index].bounds;
        const rectangle: Bounds = [
          (obstacle[0] - item.screenHalfSize[0] - gapUnits - base.raisedScene[0])
            / unitsPerPixel,
          (obstacle[1] - item.screenHalfSize[1] - gapUnits - base.raisedScene[1])
            / unitsPerPixel,
          (obstacle[2] + item.screenHalfSize[0] + gapUnits - base.raisedScene[0])
            / unitsPerPixel,
          (obstacle[3] + item.screenHalfSize[1] + gapUnits - base.raisedScene[1])
            / unitsPerPixel,
        ];
        overlayBoundaryRectangles.push(rectangle);
        boundaryRectangles.push(rectangle);
      };

      const footprintBounds = baseFootprintBounds;
      const expandedWalls = new Set<number>();
      const pendingWalls = new Set<number>();
      const addWallBoundary = (index: number): void => {
        if (expandedWalls.has(index) || !footprintBounds) return;
        expandedWalls.add(index);
        const { wall, bounds: wallBounds } = wallCandidates[index];
        if (wallBounds) {
          const expandedWallBounds: Bounds = [
            (wallBounds[0] - gapUnits - footprintBounds[2]) / unitsPerPixel,
            (wallBounds[1] - gapUnits - footprintBounds[3]) / unitsPerPixel,
            (wallBounds[2] + gapUnits - footprintBounds[0]) / unitsPerPixel,
            (wallBounds[3] + gapUnits - footprintBounds[1]) / unitsPerPixel,
          ];
          boundaryRectangles.push(expandedWallBounds);
          addCriticalBoundaryRectangle(boundaryCandidates, expandedWallBounds, maxNudge);
        }
        addExpandedWallBoundarySegments(
          boundaryCandidates, wall, baseFootprint, gapUnits, unitsPerPixel,
          maxNudge, overlayBoundaryRectangles, boundarySegments,
        );
      };

      let fallbackAdded = false;
      let roomBoundaryWitness = false;
      const addFallbackBoundaries = (): void => {
        if (fallbackAdded) return;
        fallbackAdded = true;
        addBoundaryCircle(boundaryCandidates, maxNudge);
        if (!ownerRoom) return;
        for (const ring of [ownerRoom.outer, ...(ownerRoom.holes || [])]) {
          for (let index = 0; index < ring.length; index++) {
            const startScene = projectPlanPoint(ring[index], visualOffset, camera);
            const endScene = projectPlanPoint(ring[(index + 1) % ring.length], visualOffset, camera);
            const boundary: BoundarySegment = [[
              (startScene[0] - base.raisedScene[0]) / unitsPerPixel,
              (startScene[1] - base.raisedScene[1]) / unitsPerPixel,
            ], [
              (endScene[0] - base.raisedScene[0]) / unitsPerPixel,
              (endScene[1] - base.raisedScene[1]) / unitsPerPixel,
            ]];
            addCriticalBoundarySegment(
              boundaryCandidates, boundary[0], boundary[1], maxNudge,
            );
            const clipped = clipBoundarySegment(
              boundary[0], boundary[1], maxNudge + 2,
            );
            if (clipped) boundarySegments.push(clipped);
          }
        }
      };

      let processedRectangles = 0;
      let processedOverlayRectangles = 0;
      let processedSegments = 0;
      const refreshBoundaryEvents = (): void => {
        for (let index = processedRectangles; index < boundaryRectangles.length; index++) {
          addBoundaryRectangleEvents(
            boundaryCandidates, [boundaryRectangles[index]], maxNudge,
          );
          for (let previous = 0; previous < index; previous++)
            addBoundaryRectangleIntersections(
              boundaryCandidates, boundaryRectangles[previous],
              boundaryRectangles[index], maxNudge,
            );
        }
        // Concave silhouettes and the safety-gap rounding meet where finite
        // boundary segments cross. Exact polygons still make the final call.
        for (let index = processedSegments; index < boundarySegments.length; index++) {
          for (let previous = 0; previous < index; previous++)
            addBoundaryLineIntersection(
              boundaryCandidates, boundarySegments[previous],
              boundarySegments[index], maxNudge,
            );
        }
        for (let index = processedOverlayRectangles;
          index < overlayBoundaryRectangles.length; index++) {
          for (let segment = 0; segment < processedSegments; segment++)
            addBoundarySegmentRectangleIntersection(
              boundaryCandidates, boundarySegments[segment],
              overlayBoundaryRectangles[index], maxNudge,
            );
        }
        for (let index = processedSegments; index < boundarySegments.length; index++)
          addBoundarySegmentRectangleIntersections(
            boundaryCandidates, boundarySegments[index],
            overlayBoundaryRectangles, maxNudge,
          );
        processedRectangles = boundaryRectangles.length;
        processedOverlayRectangles = overlayBoundaryRectangles.length;
        processedSegments = boundarySegments.length;
      };

      const evaluateNewCandidates = (): void => {
        const entries = boundaryCandidates.pending.splice(0)
          .map((offset) => ({
            offset, distance: Math.hypot(offset[0], offset[1]),
          }))
          .sort((a, b) => a.distance - b.distance
            || a.offset[1] - b.offset[1] || a.offset[0] - b.offset[0]);
        let wallWitness: {
          index: number; freePriority: number; score: number; distance: number;
        } | null = null;
        for (const entry of entries) {
          const bestFreeDistance = best && !best.conflicts.length
            ? best.placement.nudgeDistanceCss : Infinity;
          if (entry.distance > maxNudge + EPS || entry.distance > bestFreeDistance + EPS) break;
          const offset = entry.offset;
          if (Math.abs(offset[0] - baseOffsetCss[0]) <= EPS
              && Math.abs(offset[1] - baseOffsetCss[1]) <= EPS) continue;
          const shape = candidateShape(offset);
          if (!shape) continue;
          for (const conflictIndex of shape.conflicts) {
            if (!expandedOverlayBoundaries.has(conflictIndex))
              encounteredOverlayBoundaries.add(conflictIndex);
          }
          const canWin = !best || !shape.conflicts.length
            || best.conflicts.length && shape.penalty < best.penalty - EPS;
          if (!canWin) continue;
          const inspection = inspectCandidate(shape);
          if (inspection !== INSPECTION_ALLOWED) {
            if (inspection >= 0) {
              const wallIndex = inspection;
              if (expandedWalls.has(wallIndex)) continue;
              const witness = {
                index: wallIndex,
                freePriority: shape.conflicts.length ? 1 : 0,
                score: shape.conflicts.length ? shape.penalty : entry.distance,
                distance: entry.distance,
              };
              if (!wallWitness
                  || witness.freePriority < wallWitness.freePriority
                  || witness.freePriority === wallWitness.freePriority
                    && (witness.score < wallWitness.score - EPS
                      || Math.abs(witness.score - wallWitness.score) <= EPS
                        && (witness.distance < wallWitness.distance - EPS
                          || Math.abs(witness.distance - wallWitness.distance) <= EPS
                            && witness.index < wallWitness.index))) wallWitness = witness;
            } else if (inspection === INSPECTION_ROOM) roomBoundaryWitness = true;
            continue;
          }
          if (shape.conflicts.length) {
            if (!best || best.conflicts.length && shape.penalty < best.penalty - EPS) {
              best = {
                placement: placementAtGroupOffset(base, offset, unitsPerPixel, false),
                bounds: shape.bounds, conflicts: shape.conflicts, penalty: shape.penalty,
              };
              bestFromHint = false;
            }
            continue;
          }
          const bestOffset = best?.placement.nudgeCss;
          const wins = !best || best.conflicts.length
            || entry.distance < best.placement.nudgeDistanceCss - EPS
            || Math.abs(entry.distance - best.placement.nudgeDistanceCss) <= EPS
              && !!bestOffset && (offset[1] < bestOffset[1] - EPS
                || Math.abs(offset[1] - bestOffset[1]) <= EPS
                  && offset[0] < bestOffset[0] - EPS);
          if (wins) {
            best = {
              placement: placementAtGroupOffset(base, offset, unitsPerPixel, false),
              bounds: shape.bounds, conflicts: shape.conflicts, penalty: shape.penalty,
            };
            bestFromHint = false;
          }
        }
        if (wallWitness) pendingWalls.add(wallWitness.index);
      };

      while (true) {
        let changed = false;
        if (encounteredOverlayBoundaries.size) {
          const next = [...encounteredOverlayBoundaries].sort((a, b) => a - b);
          encounteredOverlayBoundaries.clear();
          next.forEach(addOverlayBoundary);
          changed = true;
        }
        if (pendingWalls.size) {
          const next = [...pendingWalls].sort((a, b) => a - b);
          pendingWalls.clear();
          next.forEach(addWallBoundary);
          changed = true;
        }
        // A verified hint is an upper bound, not proof of minimality. Room
        // boundaries only need expanding when a nearer overlay event actually
        // reached one; otherwise they cannot bound a better feasible point.
        if (!changed && best && !best.conflicts.length
            && (!bestFromHint || fallbackAdded || !roomBoundaryWitness)) break;
        if (!changed && !fallbackAdded) {
          addFallbackBoundaries();
          changed = true;
        }
        if (!changed) break;
        refreshBoundaryEvents();
        evaluateNewCandidates();
      }
      if (best && !best.conflicts.length) {
        const around = best.placement.nudgeCss;
        for (const entry of localRefinementOffsets(around, maxNudge)) {
          if (entry.distance >= best.placement.nudgeDistanceCss - EPS) break;
          const shape = candidateShape(entry.offset);
          if (!shape || shape.conflicts.length || !candidateAllowed(shape)) continue;
          best = {
            placement: placementAtGroupOffset(base, entry.offset, unitsPerPixel, false),
            bounds: shape.bounds, conflicts: shape.conflicts, penalty: shape.penalty,
          };
        }
      }
    }
    if (!best) {
      const placement = placementAtGroupOffset(base, baseOffsetCss, unitsPerPixel, true);
      const bounds = overlayRootBounds(item, placement.visualScene);
      best = { placement, bounds, conflicts: nearby(bounds), penalty: Infinity };
    } else if (best.conflicts.length) {
      best = { ...best, placement: placementAtGroupOffset(
        base, best.placement.nudgeCss, unitsPerPixel, true,
      ) };
    }
    for (const index of best.conflicts) {
      if (overlapPenalty(best.bounds, accepted[index].bounds, gapUnits) > EPS)
        residualPairs.push(Object.freeze([accepted[index].key, key]));
    }
    placements.set(key, best.placement);
    addAccepted({ key, bounds: best.bounds });
  }
  return {
    placements,
    residualPairs: Object.freeze(residualPairs),
  };
}
