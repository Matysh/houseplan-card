import { projectPlanPoint, type PlanPoint } from './iso-projection';
import type { CameraState, CameraViewBox } from './viewport-transition';

export interface RoomFitBounds extends CameraViewBox {}

export interface RoomFitGeometry {
  floor: readonly (readonly number[])[];
  wall?: readonly (readonly number[])[];
  projection: 'flat' | 'iso';
  wallHeight?: number;
  floorDepth?: number;
  padding?: number;
}

export interface RoomFitTargetInput {
  bounds: RoomFitBounds;
  baseFit: CameraViewBox;
  stageWidth: number;
  stageHeight: number;
  minZoom: number;
  maxZoom: number;
  safeFraction?: number;
}

export interface RoomFitGestureCandidate {
  pointerId: number;
  spaceId: string;
  roomId: string;
}

export type DoubleFitPointerModality = 'mouse' | 'touch' | 'pen';

export interface DoubleFitPointerCandidate {
  pointerId: number;
  spaceId: string;
  modality: DoubleFitPointerModality;
  x: number;
  y: number;
}

export interface DoubleFitTapSequence {
  at: number;
  spaceId: string;
  modality: DoubleFitPointerModality;
}

export type PlanGestureOwner =
  | { kind: 'background' }
  | { kind: 'room'; roomId: string }
  | { kind: 'interactive' }
  | { kind: 'outside' };

export interface DoubleFitPointerDownInput {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  spaceId: string;
  mode: string;
  owner: PlanGestureOwner;
  blocked: boolean;
  x: number;
  y: number;
}

export interface DoubleFitPointerUpInput {
  pointerId: number;
  spaceId: string;
  mode: string;
  owner: PlanGestureOwner;
  blocked: boolean;
  x: number;
  y: number;
  now: number;
}

export interface DoubleFitResult {
  sequence: DoubleFitTapSequence | null;
  trigger: boolean;
}

interface DoubleFitPointerEventLike {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  clientX: number;
  clientY: number;
  composedPath: () => readonly unknown[];
}

interface RoomFitPathNode {
  matches?: (selector: string) => boolean;
  getAttribute?: (name: string) => string | null;
}

const ROOM_FIT_INTERACTIVE_OWNER = [
  '.dev', '.vacpuck', '.oplock', '.op-hit', '.opening', '.rlgo',
  'a', 'button', 'input', 'select', 'textarea',
  '[contenteditable]:not([contenteditable="false"])',
  '[data-room-fit-block]', '[role="link"]', '[role="button"]',
].join(',');

export const DOUBLE_FIT_WINDOW_MS = 350;
/** Existing kiosk clean-tap / stage pan-lock boundary. */
export const STAGE_TAP_DISTANCE_PX = 8;

const pathMatches = (node: RoomFitPathNode, selector: string): boolean => {
  try {
    return typeof node?.matches === 'function' && node.matches(selector);
  } catch {
    return false;
  }
};

/**
 * One browser-path authority for room fit and the free-background shortcut.
 * The first independently interactive owner wins; only a path which reaches
 * this card's stage without one is free background.
 */
export function planGestureOwnerFromPath(path: readonly unknown[]): PlanGestureOwner {
  for (const raw of path) {
    const node = raw as RoomFitPathNode;
    if (pathMatches(node, '.roomlabel[data-id]')) {
      const roomId = node.getAttribute?.('data-id');
      return roomId ? { kind: 'room', roomId } : { kind: 'interactive' };
    }
    if (pathMatches(node, ROOM_FIT_INTERACTIVE_OWNER)) return { kind: 'interactive' };
    if (pathMatches(node, '[data-hp="room"][data-id]')) {
      const roomId = node.getAttribute?.('data-id');
      return roomId ? { kind: 'room', roomId } : { kind: 'interactive' };
    }
    if (pathMatches(node, '.stage')) return { kind: 'background' };
  }
  return { kind: 'outside' };
}

/**
 * Resolve the browser-painted room owner. The first independently interactive
 * node in the composed path wins; the room label itself is the one deliberate
 * role=button exception because it maps back to the same room command.
 */
export function roomFitOwnerFromPath(path: readonly unknown[]): string | null {
  const owner = planGestureOwnerFromPath(path);
  return owner.kind === 'room' ? owner.roomId : null;
}

const pointerModality = (value: string): DoubleFitPointerModality | null =>
  value === 'mouse' || value === 'touch' || value === 'pen' ? value : null;

export function beginDoubleFitPointer(
  input: DoubleFitPointerDownInput,
): DoubleFitPointerCandidate | null {
  const modality = pointerModality(input.pointerType);
  if (!modality || input.mode !== 'view' || input.owner.kind !== 'background'
      || input.blocked || !input.isPrimary || input.button !== 0
      || !Number.isFinite(input.x) || !Number.isFinite(input.y)) return null;
  return {
    pointerId: input.pointerId,
    spaceId: input.spaceId,
    modality,
    x: input.x,
    y: input.y,
  };
}

/** Pure release arbitration. Invalid input always disarms the previous tap. */
export function completeDoubleFitPointer(
  sequence: DoubleFitTapSequence | null,
  candidate: DoubleFitPointerCandidate | null,
  input: DoubleFitPointerUpInput,
): DoubleFitResult {
  if (!candidate || input.mode !== 'view' || input.owner.kind !== 'background'
      || input.blocked || candidate.pointerId !== input.pointerId
      || candidate.spaceId !== input.spaceId
      || !Number.isFinite(input.x) || !Number.isFinite(input.y)
      || !Number.isFinite(input.now)
      || Math.abs(input.x - candidate.x) + Math.abs(input.y - candidate.y)
        >= STAGE_TAP_DISTANCE_PX) {
    return { sequence: null, trigger: false };
  }

  const elapsed = sequence ? input.now - sequence.at : Number.POSITIVE_INFINITY;
  if (sequence && sequence.spaceId === input.spaceId
      && sequence.modality === candidate.modality
      && elapsed >= 0 && elapsed <= DOUBLE_FIT_WINDOW_MS) {
    return { sequence: null, trigger: true };
  }
  return {
    sequence: { at: input.now, spaceId: input.spaceId, modality: candidate.modality },
    trigger: false,
  };
}

/** Per-card owner of the two transient halves; no timers, renders or writes. */
export class DoubleFitGestureRecognizer {
  private pointer: DoubleFitPointerCandidate | null = null;
  private sequence: DoubleFitTapSequence | null = null;

  clear(): void {
    this.pointer = null;
    this.sequence = null;
  }

  clearOutside(event: DoubleFitPointerEventLike): void {
    let owner: PlanGestureOwner = { kind: 'outside' };
    try { owner = planGestureOwnerFromPath(event.composedPath()); } catch { /* fail closed */ }
    if (owner.kind === 'outside') this.clear();
  }

  pointerDown(event: DoubleFitPointerEventLike, spaceId: string, enabled: boolean): void {
    let owner: PlanGestureOwner = { kind: 'outside' };
    try { owner = planGestureOwnerFromPath(event.composedPath()); } catch { /* fail closed */ }
    this.pointer = beginDoubleFitPointer({
      pointerId: event.pointerId, pointerType: event.pointerType,
      isPrimary: event.isPrimary, button: event.button, spaceId,
      mode: enabled ? 'view' : 'blocked', owner, blocked: !enabled,
      x: event.clientX, y: event.clientY,
    });
    if (!this.pointer) this.sequence = null;
  }

  pointerUp(
    event: DoubleFitPointerEventLike,
    spaceId: string,
    enabled: boolean,
    blocked: boolean,
    now = Date.now(),
  ): boolean {
    let owner: PlanGestureOwner = { kind: 'outside' };
    try { owner = planGestureOwnerFromPath(event.composedPath()); } catch { /* fail closed */ }
    const result = completeDoubleFitPointer(this.sequence, this.pointer, {
      pointerId: event.pointerId, spaceId, mode: enabled ? 'view' : 'blocked', owner,
      blocked: blocked || !enabled, x: event.clientX, y: event.clientY, now,
    });
    this.pointer = null;
    this.sequence = result.sequence;
    return result.trigger;
  }
}

export function acceptedRoomFitGesture(
  candidate: RoomFitGestureCandidate | null,
  pointerId: number,
  spaceId: string,
  upRoomId: string | null,
  blocked: boolean,
): string | null {
  if (!candidate || blocked || candidate.pointerId !== pointerId
      || candidate.spaceId !== spaceId || candidate.roomId !== upRoomId) return null;
  return candidate.roomId;
}

const finitePoint = (point: readonly number[]): point is readonly [number, number] =>
  point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

export function validRoomFitBounds(value: RoomFitBounds | null | undefined): value is RoomFitBounds {
  return !!value && Number.isFinite(value.x) && Number.isFinite(value.y)
    && Number.isFinite(value.w) && value.w > 0
    && Number.isFinite(value.h) && value.h > 0;
}

/** Finite AABB of exact render vertices. Invalid vertices fail the whole input. */
export function roomFitPointBounds(
  points: readonly (readonly number[])[], padding = 0,
): RoomFitBounds | null {
  if (!points.length || !Number.isFinite(padding) || padding < 0
      || !points.every(finitePoint)) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    x: minX - padding,
    y: minY - padding,
    w: width + padding * 2,
    h: height + padding * 2,
  };
}

/**
 * Bounds of the same floor/wall vertices the renderer consumes. Isometric
 * bounds are built after projecting every exact vertex, never by projecting a
 * plan-space rectangle around them.
 */
export function roomFitGeometryBounds(input: RoomFitGeometry): RoomFitBounds | null {
  const floor = input.floor;
  const wall = input.wall || [];
  const padding = input.padding ?? 0;
  if (!floor.length || !floor.every(finitePoint) || !wall.every(finitePoint)
      || !Number.isFinite(padding) || padding < 0) return null;
  if (input.projection === 'flat') {
    return roomFitPointBounds([...floor, ...wall], padding);
  }

  const wallHeight = input.wallHeight ?? 0;
  const floorDepth = input.floorDepth ?? 0;
  if (!Number.isFinite(wallHeight) || wallHeight < 0
      || !Number.isFinite(floorDepth) || floorDepth < 0) return null;
  try {
    const points: PlanPoint[] = [];
    for (const point of floor) {
      const plan: PlanPoint = [point[0], point[1]];
      points.push(projectPlanPoint(plan, 0));
      if (floorDepth > 0) points.push(projectPlanPoint(plan, -floorDepth));
    }
    for (const point of wall) {
      const plan: PlanPoint = [point[0], point[1]];
      points.push(projectPlanPoint(plan, 0));
      if (wallHeight > 0) points.push(projectPlanPoint(plan, wallHeight));
    }
    return roomFitPointBounds(points, padding);
  } catch {
    return null;
  }
}

/** Exact 10%-safe camera target expressed in the card's existing zoom model. */
export function roomFitCameraTarget(input: RoomFitTargetInput): CameraState | null {
  const safe = input.safeFraction ?? 0.8;
  const { bounds, baseFit, stageWidth, stageHeight, minZoom, maxZoom } = input;
  if (!validRoomFitBounds(bounds) || !validRoomFitBounds(baseFit)
      || !Number.isFinite(stageWidth) || stageWidth <= 0
      || !Number.isFinite(stageHeight) || stageHeight <= 0
      || !Number.isFinite(minZoom) || minZoom <= 0
      || !Number.isFinite(maxZoom) || maxZoom < minZoom
      || !Number.isFinite(safe) || safe <= 0 || safe > 1) return null;
  const aspect = stageWidth / stageHeight;
  const requiredWidth = Math.max(bounds.w / safe, (bounds.h / safe) * aspect);
  if (!Number.isFinite(requiredWidth) || requiredWidth <= 0) return null;
  const zoom = Math.min(maxZoom, Math.max(minZoom, baseFit.w / requiredWidth));
  const width = baseFit.w / zoom;
  const height = width / aspect;
  const centerX = bounds.x + bounds.w / 2;
  const centerY = bounds.y + bounds.h / 2;
  return {
    zoom,
    viewBox: {
      x: centerX - width / 2,
      y: centerY - height / 2,
      w: width,
      h: height,
    },
  };
}

/** A clamp frame covering both the painted and target cameras without moving either. */
export function roomFitClampFrame(
  baseFit: CameraViewBox,
  current: CameraViewBox,
  target: CameraViewBox,
  bounds: RoomFitBounds,
): CameraViewBox {
  const rects = [baseFit, current, target, bounds];
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x, y, w: right - x, h: bottom - y };
}
