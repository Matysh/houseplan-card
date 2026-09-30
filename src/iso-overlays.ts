import {
  ISO_CAMERA,
  ISO_OVERLAY_VISUAL_OFFSET,
  projectPlanPoint,
  type IsoCamera,
  type PlanPoint,
  type ScenePoint,
} from './iso-projection';

export type IsoRaisedOverlayKind = 'device' | 'room-label' | 'opening-lock';
export type IsoFloorOverlayKind = 'vacuum' | 'vacuum-trail' | 'glow' | 'room-fill'
  | 'room-hover' | 'sunlight' | 'decor' | 'furniture' | 'backdrop';
export type IsoOverlayKind = IsoRaisedOverlayKind | IsoFloorOverlayKind;
export type IsoOverlayPlane = 'floor' | 'raised';

export interface IsoOverlayRoom {
  id: string;
  outer: readonly PlanPoint[];
  holes?: readonly (readonly PlanPoint[])[];
}

/** A projected, canonical physical-wall surface. No union is done per marker. */
export interface IsoWallSilhouette {
  outer: readonly ScenePoint[];
  holes?: readonly (readonly ScenePoint[])[];
}

export interface IsoOverlayOwner {
  id: string;
  area: number;
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
  /** Half-size of the invisible floor-parallel footprint in plan units. */
  footprintHalfSize: PlanPoint;
  visualOffset?: number;
  filtersSupported?: boolean;
  hovered?: boolean;
  focused?: boolean;
  selected?: boolean;
  camera?: IsoCamera;
  /** Internal scene-builder fast path; arbitrary callers still resolve safely. */
  ownerAlreadyResolved?: boolean;
  resolvedOwner?: IsoOverlayOwner | null;
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
  /** This is always the input logical point; the raised visual never mutates it. */
  floorAnchor: PlanPoint;
  floorScene: ScenePoint;
  raisedScene: ScenePoint;
  visualScene: ScenePoint;
  /** Invisible fit footprint; never render it as a surface. */
  footprint: readonly ScenePoint[];
  grounding: { center: ScenePoint; visible: boolean };
  tether: IsoOverlayTetherGeometry;
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
  if (!validRoom(room)) return false;
  if (pointOnRing(point, room.outer) || !pointInRing(point, room.outer)) return false;
  for (const hole of room.holes || []) {
    if (pointOnRing(point, hole) || pointInRing(point, hole)) return false;
  }
  return true;
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
  return room ? { id: room.id, area: roomArea(room) } : null;
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

function tetherGeometry(
  from: ScenePoint, to: ScenePoint, visible: boolean,
): IsoOverlayTetherGeometry {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  return { from, to, visible, length: Math.hypot(dx, dy), angleDeg: Math.atan2(dy, dx) * 180 / Math.PI };
}

/**
 * Resolve one overlay without mutating its saved coordinate. Since #713 a
 * raised root is its floor anchor shifted straight up by `visualOffset`; #714
 * removed the #651 placement search, so walls and neighbours never move it.
 */
export function resolveIsoOverlayPlacement(input: IsoOverlayPlacementInput): IsoOverlayPlacement {
  const camera = input.camera || ISO_CAMERA;
  const visualOffset = input.visualOffset ?? ISO_OVERLAY_VISUAL_OFFSET;
  if (!finitePoint(input.floorAnchor) || !finitePoint(input.footprintHalfSize)
      || input.footprintHalfSize[0] < 0 || input.footprintHalfSize[1] < 0
      || !Number.isFinite(visualOffset) || visualOffset < 0)
    throw new Error('invalid isometric overlay input');

  const floorAnchor: PlanPoint = [input.floorAnchor[0], input.floorAnchor[1]];
  const floorScene = projectPlanPoint(floorAnchor, 0, camera);
  const plane = isoOverlayPlane(input.kind, input.showBorders);
  if (plane === 'floor') {
    return {
      plane, owner: null, floorAnchor, floorScene, raisedScene: floorScene,
      visualScene: floorScene, footprint: [],
      grounding: { center: floorScene, visible: false },
      tether: tetherGeometry(floorScene, floorScene, false),
    };
  }

  // The canonical floor anchor and footprint stay; the screen-facing content
  // stands `visualOffset` above the floor (#713: the wall top for tiles and
  // lock badges, 0 for room names).
  const raisedScene = projectPlanPoint(floorAnchor, visualOffset, camera);
  const owner = input.ownerAlreadyResolved
    ? input.resolvedOwner ?? null
    : resolveIsoOverlayOwner(input);
  const footprint = buildIsoFootprintPolygon(floorAnchor, input.footprintHalfSize,
    visualOffset, camera);
  // Ownership remains encoded by the immutable anchor and invisible bounded
  // footprint. Stage 4 deliberately removes the visible ground dot and long
  // tether which made the architectural view look like a debug overlay.
  const tetherVisible = false;
  return {
    plane, owner, floorAnchor, floorScene, raisedScene, visualScene: raisedScene, footprint,
    grounding: { center: floorScene, visible: false },
    tether: tetherGeometry(floorScene, raisedScene, tetherVisible),
  };
}
