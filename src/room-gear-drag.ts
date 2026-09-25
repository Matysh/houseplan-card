import { pointInPolygon, pointOnBoundary, poleOfInaccessibility, roomPoly } from './logic';
import type { RoomCfg, SpaceModel } from './types';

export type RoomGearPoint = [number, number];

/** A click stays a click until the pointer travels more than three CSS pixels. */
export const ROOM_GEAR_DRAG_THRESHOLD_PX = 3;

const finitePoint = (point: readonly number[] | null | undefined): point is readonly [number, number] =>
  !!point && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

export function roomGearPointAllowed(
  point: readonly number[] | null | undefined,
  polygon: readonly number[][] | null | undefined,
): point is readonly [number, number] {
  if (!finitePoint(point) || !polygon?.length) return false;
  const candidate = [point[0], point[1]];
  return pointInPolygon(candidate, polygon as number[][])
    || pointOnBoundary(candidate, polygon as number[][]);
}

export function roomGearAutoCenter(
  room: RoomCfg,
  polygonOverride?: number[][] | null,
): RoomGearPoint | null {
  const polygon = polygonOverride ?? roomPoly(room);
  if (!polygon?.length) return null;
  const point = poleOfInaccessibility(polygon);
  return finitePoint(point) ? [point[0], point[1]] : null;
}

export function resolveRoomGearCenter(
  room: RoomCfg,
  temporary: readonly number[] | null | undefined,
  polygonOverride?: number[][] | null,
): { point: RoomGearPoint | null; usedTemporary: boolean } {
  const polygon = polygonOverride ?? roomPoly(room);
  if (roomGearPointAllowed(temporary, polygon)) {
    return { point: [temporary[0], temporary[1]], usedTemporary: true };
  }
  return { point: roomGearAutoCenter(room, polygon), usedTemporary: false };
}

export function roomGearDragMoved(
  startClient: readonly [number, number],
  currentClient: readonly [number, number],
): boolean {
  return Math.abs(currentClient[0] - startClient[0])
    + Math.abs(currentClient[1] - startClient[1]) > ROOM_GEAR_DRAG_THRESHOLD_PX;
}

const interpolate = (
  start: readonly [number, number], target: readonly [number, number], t: number,
): RoomGearPoint => [
  start[0] + (target[0] - start[0]) * t,
  start[1] + (target[1] - start[1]) * t,
];

const parameterOnSegment = (
  point: readonly number[], start: readonly [number, number], target: readonly [number, number],
): number => {
  const dx = target[0] - start[0];
  const dy = target[1] - start[1];
  const denom = dx * dx + dy * dy;
  if (denom <= 1e-18) return 0;
  return ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denom;
};

/** Parameters where the drag segment meets one polygon edge. */
const segmentEdgeParameters = (
  start: readonly [number, number], target: readonly [number, number],
  a: readonly number[], b: readonly number[],
): number[] => {
  const rx = target[0] - start[0];
  const ry = target[1] - start[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const qpx = a[0] - start[0];
  const qpy = a[1] - start[1];
  const cross = rx * sy - ry * sx;
  const qpr = qpx * ry - qpy * rx;
  const eps = 1e-9;
  if (Math.abs(cross) <= eps) {
    if (Math.abs(qpr) > eps) return [];
    return [parameterOnSegment(a, start, target), parameterOnSegment(b, start, target)]
      .filter((t) => t >= -eps && t <= 1 + eps)
      .map((t) => Math.max(0, Math.min(1, t)));
  }
  const t = (qpx * sy - qpy * sx) / cross;
  const u = (qpx * ry - qpy * rx) / cross;
  return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps
    ? [Math.max(0, Math.min(1, t))]
    : [];
};

/**
 * Move along the pointer path only while it remains in the room.
 *
 * Testing the target alone is insufficient for a concave room: two allowed
 * points may have a segment that crosses a cut-out. Polygon-edge parameters
 * split the path into intervals, so the first outside interval is also the
 * exact first boundary where the button must stop.
 */
export function clampRoomGearPointAlongPath(
  start: readonly [number, number],
  target: readonly [number, number],
  polygon: readonly number[][],
): RoomGearPoint {
  if (!finitePoint(start) || !finitePoint(target) || polygon.length < 3) return [start[0], start[1]];
  if (start[0] === target[0] && start[1] === target[1]) return [start[0], start[1]];
  const parameters = [0, 1];
  for (let index = 0; index < polygon.length; index += 1) {
    parameters.push(...segmentEdgeParameters(
      start, target, polygon[index], polygon[(index + 1) % polygon.length],
    ));
  }
  parameters.sort((a, b) => a - b);
  const unique = parameters.filter((value, index) =>
    index === 0 || Math.abs(value - parameters[index - 1]) > 1e-8);
  for (let index = 0; index < unique.length - 1; index += 1) {
    const from = unique[index];
    const to = unique[index + 1];
    if (to - from <= 1e-8) continue;
    const midpoint = interpolate(start, target, (from + to) / 2);
    if (!roomGearPointAllowed(midpoint, polygon)) return interpolate(start, target, from);
  }
  return roomGearPointAllowed(target, polygon)
    ? [target[0], target[1]]
    : [start[0], start[1]];
}

type RoomGearDragState = {
  key: string;
  roomId: string;
  pointerId: number;
  pointerType: string;
  source: Element | null;
  startClient: [number, number];
  beforeTemporary: RoomGearPoint | null;
  current: RoomGearPoint;
  moved: boolean;
};

export interface RoomGearDragPort {
  mode: () => string;
  spaceId: () => string;
  currentRoom: (roomId: string) => RoomCfg | undefined;
  planPoint: (event: PointerEvent) => number[];
  queueMove: (run: () => void) => void;
  flushMove: () => void;
  cancelMove: () => void;
  requestUpdate: () => void;
  openRoom: (room: RoomCfg) => void;
}

const capturePointer = (event: PointerEvent): void => {
  try {
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
  } catch {
    /* an inactive synthetic pointer must not kill a drag */
  }
};

/** Session-only owner of the draggable Room settings capsule (#645). */
export class RoomGearDragController {
  public readonly positions = new Map<string, RoomGearPoint>();
  public drag: RoomGearDragState | null = null;
  private readonly planKeys = new Map<string, string>();
  private suppressClickUntil = 0;

  public constructor(private readonly input: RoomGearDragPort) {}

  public key(roomId: string, spaceId = this.input.spaceId()): string {
    return `${spaceId}\u0000${roomId}`;
  }

  public adoptPlan(space: SpaceModel): void {
    const identity = `${space.bg?.href || ''}\u0000${space.vb.join(',')}`;
    const previous = this.planKeys.get(space.id);
    const prefix = `${space.id}\u0000`;
    if (previous !== undefined && previous !== identity) {
      for (const key of this.positions.keys()) if (key.startsWith(prefix)) this.positions.delete(key);
      if (this.drag?.key.startsWith(prefix)) this.clearDrag(false);
    }
    this.planKeys.set(space.id, identity);
    const roomIds = new Set(space.rooms.flatMap((room) => room.id ? [room.id] : []));
    for (const key of this.positions.keys()) {
      if (key.startsWith(prefix) && !roomIds.has(key.slice(prefix.length))) this.positions.delete(key);
    }
  }

  public center(
    room: RoomCfg, polygonOverride?: number[][] | null, spaceId = this.input.spaceId(),
  ): RoomGearPoint | null {
    if (!room.id) return null;
    const key = this.key(room.id, spaceId);
    const temporary = this.positions.get(key);
    const resolved = resolveRoomGearCenter(room, temporary, polygonOverride);
    if (temporary && !resolved.usedTemporary) this.positions.delete(key);
    return resolved.point;
  }

  /**
   * Resolve against a transient geometry preview without pruning the saved
   * session position. A cancelled preview must not become a permanent move.
   */
  public previewCenter(
    room: RoomCfg, polygonOverride?: number[][] | null, spaceId = this.input.spaceId(),
  ): RoomGearPoint | null {
    if (!room.id) return null;
    return resolveRoomGearCenter(
      room, this.positions.get(this.key(room.id, spaceId)), polygonOverride,
    ).point;
  }

  public dragging(key: string): boolean { return this.drag?.key === key; }

  public reset(): void {
    this.finish(true);
    this.positions.clear();
    this.planKeys.clear();
    this.suppressClickUntil = 0;
  }

  public cancelForMultitouch(): boolean {
    if (this.drag?.pointerType !== 'touch') return false;
    return this.finish(true);
  }

  public pointerDown(event: PointerEvent, room: RoomCfg): void {
    if (this.input.mode() !== 'plan' || !room.id || event.button !== 0
        || (event.pointerType === 'touch' && event.isPrimary === false)) return;
    event.stopPropagation();
    this.suppressClickUntil = 0;
    if (this.drag) this.finish(true);
    const polygon = roomPoly(room);
    const current = this.center(room, polygon);
    if (!current || !polygon) return;
    const key = this.key(room.id);
    const before = this.positions.get(key);
    this.drag = {
      key, roomId: room.id, pointerId: event.pointerId, pointerType: event.pointerType,
      source: event.currentTarget as Element | null,
      startClient: [event.clientX, event.clientY],
      beforeTemporary: before ? [before[0], before[1]] : null,
      current: [current[0], current[1]], moved: false,
    };
    capturePointer(event);
    this.input.requestUpdate();
  }

  public pointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    event.preventDefault();
    const client: [number, number] = [event.clientX, event.clientY];
    const target = this.input.planPoint(event);
    this.input.queueMove(() => {
      const active = this.drag;
      if (!active || active.pointerId !== event.pointerId) return;
      if (!active.moved && !roomGearDragMoved(active.startClient, client)) return;
      const room = this.input.currentRoom(active.roomId);
      const polygon = room && roomPoly(room);
      if (!room || !polygon || !roomGearPointAllowed(active.current, polygon)) {
        this.finish(true);
        return;
      }
      active.moved = true;
      active.current = clampRoomGearPointAlongPath(
        active.current, [target[0], target[1]], polygon,
      );
      this.positions.set(active.key, active.current);
      this.input.requestUpdate();
    });
  }

  public pointerUp(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    this.input.flushMove();
    this.finish(false);
  }

  public pointerCancel(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    this.finish(true);
  }

  public click(event: MouseEvent, room: RoomCfg): void {
    event.stopPropagation();
    if (event.detail !== 0 && performance.now() <= this.suppressClickUntil) {
      this.suppressClickUntil = 0;
      event.preventDefault();
      return;
    }
    this.suppressClickUntil = 0;
    this.input.openRoom(room);
  }

  private finish(cancelled: boolean): boolean {
    const drag = this.drag;
    if (!drag) return false;
    this.input.cancelMove();
    if (cancelled) {
      if (drag.beforeTemporary) this.positions.set(drag.key, drag.beforeTemporary);
      else this.positions.delete(drag.key);
    } else if (drag.moved) {
      this.suppressClickUntil = performance.now() + 700;
    }
    this.drag = null;
    this.releasePointer(drag);
    this.input.requestUpdate();
    return true;
  }

  private clearDrag(restore: boolean): void {
    const drag = this.drag;
    if (!drag) return;
    this.input.cancelMove();
    if (restore) {
      if (drag.beforeTemporary) this.positions.set(drag.key, drag.beforeTemporary);
      else this.positions.delete(drag.key);
    }
    this.drag = null;
    this.releasePointer(drag);
  }

  private releasePointer(drag: RoomGearDragState): void {
    try {
      if (drag.source?.hasPointerCapture?.(drag.pointerId)) {
        drag.source.releasePointerCapture(drag.pointerId);
      }
    } catch {
      /* a browser-owned terminal pointer must not turn cancellation into an error */
    }
  }
}
