import { GRID_N, NORM_W } from './canvas-constants';
import type { FurnitureWallSurface } from './furniture-wall-surface';
import type { Stair } from './stairs';
import { defaultStair, normalizeStairAngle } from './stairs-editor-model';

// #676: the editing layer works on an oriented box — centre, length along the
// local rise axis (+x), width along local +y, angle — in plan units. A spiral
// stair is the circle inscribed in the square box of side 2r. Only the lazy
// editor chunk imports this module: the eager View bundle keeps its budget.

/** Smallest length, width or radius of a stair: one tread (#676). */
export const STAIR_MIN_CM = 30;
/** Same ceiling furniture uses; larger is a typo, not a staircase (#676). */
export const STAIR_MAX_CM = 10000;
/** A stair edge this close to parallel with a wall face may snap flush (#676). */
export const STAIR_MAGNET_ANGLE_DEG = 5;

const cmToNorm = (cm: number, cellCm: number): number => (
  Number(cm) / ((Number(cellCm) > 0 ? Number(cellCm) : 5) * GRID_N)
);

const normToCm = (value: number, cellCm: number): number => (
  Number(value) * (Number(cellCm) > 0 ? Number(cellCm) : 5) * GRID_N
);

export interface StairBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
}

/** A resize or edge handle in the stair's own frame: -1 | 0 | 1 per axis. */
export interface StairHandleSign {
  sx: -1 | 0 | 1;
  sy: -1 | 0 | 1;
}

export interface StairHandle extends StairHandleSign {
  point: [number, number];
  /** World bearing of the handle's outward direction, degrees, 0 = +x, clockwise on screen. */
  normalDeg: number;
}

/** One side of the box (a tangent of the circle) with its outward normal. */
export interface StairEdge extends StairHandleSign {
  mid: [number, number];
  dir: [number, number];
  normal: [number, number];
}

const axes = (angle: number): { u: [number, number]; v: [number, number] } => {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  return { u: [cosine, sine], v: [-sine, cosine] };
};

export function stairBox(stair: Stair, scale = NORM_W): StairBox {
  const size = stair.kind === 'spiral'
    ? [stair.radius * 2 * scale, stair.radius * 2 * scale]
    : [stair.length * scale, stair.width * scale];
  return { cx: stair.x * scale, cy: stair.y * scale, w: size[0], h: size[1], angle: stair.angle };
}

export function applyStairBox(stair: Stair, box: StairBox, scale = NORM_W): Stair {
  const base = { ...stair, x: box.cx / scale, y: box.cy / scale, angle: normalizeStairAngle(box.angle) };
  if (stair.kind === 'spiral') return { ...base, radius: Math.min(box.w, box.h) / 2 / scale } as Stair;
  return { ...base, length: box.w / scale, width: box.h / scale } as Stair;
}

/** Sides of the box in world units. A spiral stair uses the world axes. */
export function stairEdges(stair: Stair, scale = NORM_W): StairEdge[] {
  const box = stairBox(stair, scale);
  const { u, v } = stair.kind === 'spiral' ? axes(0) : axes(box.angle);
  const edge = (sx: -1 | 0 | 1, sy: -1 | 0 | 1): StairEdge => {
    const normal: [number, number] = sx
      ? [sx * u[0], sx * u[1]] : [sy * v[0], sy * v[1]];
    const dir: [number, number] = sx ? [v[0], v[1]] : [u[0], u[1]];
    const half = sx ? box.w / 2 : box.h / 2;
    return {
      sx, sy, dir, normal,
      mid: [box.cx + normal[0] * half, box.cy + normal[1] * half],
    };
  };
  return [edge(1, 0), edge(-1, 0), edge(0, 1), edge(0, -1)];
}

const bearingOf = (x: number, y: number): number => {
  const degrees = Math.atan2(y, x) * 180 / Math.PI;
  return ((degrees % 360) + 360) % 360;
};

/** Resize handles: eight for a box, four axis tangents for a circle. */
export function stairHandles(stair: Stair, scale = NORM_W): StairHandle[] {
  const box = stairBox(stair, scale);
  const { u, v } = stair.kind === 'spiral' ? axes(0) : axes(box.angle);
  const signs: StairHandleSign[] = stair.kind === 'spiral'
    ? [{ sx: 1, sy: 0 }, { sx: 0, sy: 1 }, { sx: -1, sy: 0 }, { sx: 0, sy: -1 }]
    : [
      { sx: -1, sy: -1 }, { sx: 1, sy: -1 }, { sx: 1, sy: 1 }, { sx: -1, sy: 1 },
      { sx: 0, sy: -1 }, { sx: 1, sy: 0 }, { sx: 0, sy: 1 }, { sx: -1, sy: 0 },
    ];
  return signs.map(({ sx, sy }) => {
    const lx = sx * box.w / 2, ly = sy * box.h / 2;
    const nx = sx * u[0] + sy * v[0], ny = sx * u[1] + sy * v[1];
    return {
      sx, sy,
      point: [box.cx + lx * u[0] + ly * v[0], box.cy + lx * u[1] + ly * v[1]],
      normalDeg: bearingOf(nx, ny),
    };
  });
}

/** The rotation stem: from the top edge's midpoint outward by `arm` units. */
export function stairRotateHandle(
  stair: Stair, arm: number, scale = NORM_W,
): { from: [number, number]; to: [number, number] } {
  const box = stairBox(stair, scale);
  const { v } = axes(box.angle);
  const from: [number, number] = [box.cx - v[0] * box.h / 2, box.cy - v[1] * box.h / 2];
  return { from, to: [from[0] - v[0] * arm, from[1] - v[1] * arm] };
}

export type ResizeCursor = 'ew' | 'ns' | 'nwse' | 'nesw';

/**
 * CSS cursor for a handle by the world bearing of its outward normal: eight
 * 45° sectors, so a rotated stair still shows the arrow that matches the
 * direction the handle actually moves in (#676 К2).
 */
export function resizeCursor(normalDeg: number): ResizeCursor {
  const sector = ((Math.round(normalizeStairAngle(normalDeg) / 45) % 8) + 8) % 8;
  if (sector === 0 || sector === 4) return 'ew';
  if (sector === 2 || sector === 6) return 'ns';
  return sector === 1 || sector === 5 ? 'nwse' : 'nesw';
}

export const stairMinN = (cellCm: number): number => cmToNorm(STAIR_MIN_CM, cellCm);

/**
 * Drag-to-draw (#676 К1). `a` and `b` are plan units. A drag shorter than
 * `clickUnits` on both axes is a click and places the default stair at `a`.
 * The dominant drag axis is the rise axis, the ascent points from a to b, and
 * equal extents prefer x.
 */
export function draftStair(
  kind: Stair['kind'], a: readonly number[], b: readonly number[],
  cellCm: number, id: string, clickUnits: number, scale = NORM_W,
): Stair {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) < clickUnits) return defaultStair(kind, a[0], a[1], cellCm, id);
  const minUnits = stairMinN(cellCm) * scale;
  if (kind === 'spiral') {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    const radius = Math.max(minUnits, side) / 2;
    const cx = a[0] + Math.sign(dx || 1) * side / 2;
    const cy = a[1] + Math.sign(dy || 1) * side / 2;
    return {
      id, kind, x: cx / scale, y: cy / scale, angle: 0,
      direction: 'clockwise', radius: radius / scale, target_space_id: null,
    };
  }
  const alongX = Math.abs(dx) >= Math.abs(dy);
  const angle = alongX ? (dx >= 0 ? 0 : 180) : (dy >= 0 ? 90 : 270);
  const length = Math.max(minUnits, alongX ? Math.abs(dx) : Math.abs(dy));
  const width = Math.max(minUnits, alongX ? Math.abs(dy) : Math.abs(dx));
  return {
    id, kind, x: (a[0] + dx / 2) / scale, y: (a[1] + dy / 2) / scale, angle,
    direction: 'forward', length: length / scale, width: width / scale, target_space_id: null,
  };
}

/** Which edges of a drawn draft face the drag end `b` (they receive the resize magnet). */
export function draftLeadingHandle(stair: Stair, a: readonly number[], b: readonly number[]): StairHandleSign {
  const { u, v } = stair.kind === 'spiral' ? axes(0) : axes(stair.angle);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const along = dx * u[0] + dy * u[1];
  const across = dx * v[0] + dy * v[1];
  const sign = (value: number): -1 | 0 | 1 => (Math.abs(value) < 1e-9 ? 0 : value > 0 ? 1 : -1);
  return { sx: sign(along), sy: sign(across) };
}

/**
 * Resize about the opposite side (#676 К4): the anchor never moves, sizes
 * never drop below `minUnits`, and a pointer dragged past the anchor is
 * clamped instead of mirroring the stair. Corner drags with `keepAspect`
 * follow the axis that moved farther, like furniture.
 */
export function resizeStair(
  stair: Stair, handle: StairHandleSign, point: readonly number[],
  options: { minUnits: number; keepAspect?: boolean }, scale = NORM_W,
): Stair {
  const box = stairBox(stair, scale);
  const minimum = Math.max(options.minUnits, 1e-6);
  const { u, v } = stair.kind === 'spiral' ? axes(0) : axes(box.angle);
  const lx = (point[0] - box.cx) * u[0] + (point[1] - box.cy) * u[1];
  const ly = (point[0] - box.cx) * v[0] + (point[1] - box.cy) * v[1];
  let w = handle.sx ? Math.max(minimum, handle.sx * lx + box.w / 2) : box.w;
  let h = handle.sy ? Math.max(minimum, handle.sy * ly + box.h / 2) : box.h;
  if (stair.kind === 'spiral') {
    // A circle stays a circle: the dragged tangent sets the diameter.
    const side = handle.sx ? w : h;
    w = side;
    h = side;
  } else if (options.keepAspect && handle.sx && handle.sy) {
    const kx = w / box.w, ky = h / box.h;
    const factor = Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky;
    const floor = Math.max(minimum / box.w, minimum / box.h);
    const safe = Math.max(floor, factor);
    w = box.w * safe;
    h = box.h * safe;
  }
  // The anchor side stays: the centre moves by half the growth toward the handle.
  // A spiral handle grows the perpendicular size about the centre, so it has no shift.
  const shiftX = handle.sx ? handle.sx * (w - box.w) / 2 : 0;
  const shiftY = handle.sy ? handle.sy * (h - box.h) / 2 : 0;
  return applyStairBox(stair, {
    cx: box.cx + shiftX * u[0] + shiftY * v[0],
    cy: box.cy + shiftX * u[1] + shiftY * v[1],
    w, h, angle: box.angle,
  }, scale);
}

export interface EdgeSnap {
  /** Signed travel along the edge's outward normal that lays it on the face. */
  offset: number;
  /** Signed rotation, degrees, that makes the edge exactly parallel to the face. */
  angleDelta: number;
  stableId: string;
  face: { a: readonly [number, number]; b: readonly [number, number] };
}

/** Signed distance from the edge midpoint to the face line along the edge's outward normal. */
const offsetToFaceLine = (edge: StairEdge, a: readonly [number, number], dir: readonly [number, number]): number => {
  const along = (edge.mid[0] - a[0]) * dir[0] + (edge.mid[1] - a[1]) * dir[1];
  const foot = [a[0] + dir[0] * along, a[1] + dir[1] * along];
  return (foot[0] - edge.mid[0]) * edge.normal[0] + (foot[1] - edge.mid[1]) * edge.normal[1];
};

const unit = (x: number, y: number): [number, number] | null => {
  const length = Math.hypot(x, y);
  return length > 1e-9 ? [x / length, y / length] : null;
};

/**
 * Faces of independent physical bodies (partitions, columns) with their
 * outward normals (#676). The furniture magnet keeps these faces two-sided and
 * picks a side from the intent point; a stair edge needs the exposed side
 * only, otherwise a stair straddling a thin wall would snap to the face hidden
 * inside the masonry. The winding of the body polygon says which side is out.
 */
export function physicalStairSurfaces(bodies: readonly number[][][]): FurnitureWallSurface[] {
  const out: FurnitureWallSurface[] = [];
  for (const body of bodies || []) {
    if (!Array.isArray(body) || body.length < 3) continue;
    const points = body.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (points.length < 3) continue;
    let area = 0;
    for (let index = 0; index < points.length; index++) {
      const a = points[index], b = points[(index + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (Math.abs(area) < 1e-12) continue;
    for (let index = 0; index < points.length; index++) {
      const a = points[index], b = points[(index + 1) % points.length];
      const dir = unit(b[0] - a[0], b[1] - a[1]);
      if (!dir) continue;
      // Positive signed area: the interior lies to the left of every directed
      // edge, so the outward normal is the right-hand perpendicular.
      const normal: [number, number] = area > 0
        ? [dir[1] + 0, -dir[0] + 0] : [-dir[1] + 0, dir[0] + 0]; // `+ 0` folds -0 away
      out.push({
        a: [a[0], a[1]], b: [b[0], b[1]], axisA: [a[0], a[1]], axisB: [b[0], b[1]],
        normal, owner: 'physical',
        stableId: `stair-physical:${a[0].toFixed(6)},${a[1].toFixed(6)}|${b[0].toFixed(6)},${b[1].toFixed(6)}`,
      });
    }
  }
  return out;
}

/**
 * The nearest physical wall face a side may lie flush on (#676 К3/К4): parallel
 * within `angleTolDeg`, within `reach` along the side's outward normal, the
 * side's midpoint projecting onto the face segment (extended by `reach`), and —
 * for a one-sided room face — looking at the stair, never through the masonry.
 */
export function snapEdgeToFaces(
  edge: StairEdge, surfaces: readonly FurnitureWallSurface[], reach: number,
  angleTolDeg = STAIR_MAGNET_ANGLE_DEG,
): EdgeSnap | null {
  const cosTol = Math.cos(angleTolDeg * Math.PI / 180);
  let best: EdgeSnap | null = null;
  for (const surface of surfaces) {
    const a = surface?.a, b = surface?.b;
    if (!a || !b || ![a[0], a[1], b[0], b[1]].every(Number.isFinite)) continue;
    const dir = unit(b[0] - a[0], b[1] - a[1]);
    if (!dir) continue;
    const dot = dir[0] * edge.dir[0] + dir[1] * edge.dir[1];
    if (Math.abs(dot) < cosTol) continue;
    if (surface.normal) {
      const facing = surface.normal[0] * edge.normal[0] + surface.normal[1] * edge.normal[1];
      if (!(facing < 0)) continue;
    }
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along = (edge.mid[0] - a[0]) * dir[0] + (edge.mid[1] - a[1]) * dir[1];
    if (along < -reach || along > length + reach) continue;
    const offset = offsetToFaceLine(edge, a, dir);
    if (Math.abs(offset) > reach) continue;
    // Signed angle from the edge direction to the face direction, folded to (-90, 90].
    const faceDir: [number, number] = dot < 0 ? [-dir[0], -dir[1]] : dir;
    const cross = edge.dir[0] * faceDir[1] - edge.dir[1] * faceDir[0];
    const angleDelta = Math.atan2(cross, Math.abs(dot)) * 180 / Math.PI;
    const stableId = typeof surface.stableId === 'string' ? surface.stableId : '';
    if (!best || Math.abs(offset) < Math.abs(best.offset) - 1e-9
        || (Math.abs(Math.abs(offset) - Math.abs(best.offset)) <= 1e-9
          && stableId.localeCompare(best.stableId) < 0)) {
      best = { offset, angleDelta, stableId, face: { a, b } };
    }
  }
  return best;
}

/**
 * Move magnet (#676 К3): the side closest to a parallel face lands flush on it;
 * a straight stair also turns by at most `angleTolDeg` to be exactly parallel.
 */
export function magnetStairMove(
  stair: Stair, surfaces: readonly FurnitureWallSurface[], reach: number,
  angleTolDeg = STAIR_MAGNET_ANGLE_DEG, scale = NORM_W,
): Stair {
  let best: { edge: StairEdge; snap: EdgeSnap } | null = null;
  for (const edge of stairEdges(stair, scale)) {
    const snap = snapEdgeToFaces(edge, surfaces, reach, angleTolDeg);
    if (snap && (!best || Math.abs(snap.offset) < Math.abs(best.snap.offset))) best = { edge, snap };
  }
  if (!best) return stair;
  let next = stair;
  let edge = best.edge;
  let offset = best.snap.offset;
  if (stair.kind === 'straight' && Math.abs(best.snap.angleDelta) > 1e-9) {
    // Turn first, then measure the same side against the same face again.
    next = { ...stair, angle: normalizeStairAngle(stair.angle + best.snap.angleDelta) } as Stair;
    edge = stairEdges(next, scale).find((item) => item.sx === best!.edge.sx && item.sy === best!.edge.sy)!;
    const { a, b } = best.snap.face;
    offset = offsetToFaceLine(edge, a, unit(b[0] - a[0], b[1] - a[1])!);
  }
  return {
    ...next,
    x: next.x + edge.normal[0] * offset / scale,
    y: next.y + edge.normal[1] * offset / scale,
  } as Stair;
}

/**
 * Resize magnet (#676 К4): each dragged side lands flush on a parallel face by
 * growing or shrinking the stair about the anchor; the angle never changes.
 */
export function magnetStairResize(
  stair: Stair, handle: StairHandleSign, surfaces: readonly FurnitureWallSurface[],
  reach: number, minUnits: number, angleTolDeg = STAIR_MAGNET_ANGLE_DEG, scale = NORM_W,
): Stair {
  let next = stair;
  for (const axis of ['x', 'y'] as const) {
    const sx = axis === 'x' ? handle.sx : 0;
    const sy = axis === 'y' ? handle.sy : 0;
    if (!sx && !sy) continue;
    const edge = stairEdges(next, scale).find((item) => item.sx === sx && item.sy === sy)!;
    const snap = snapEdgeToFaces(edge, surfaces, reach, angleTolDeg);
    if (!snap) continue;
    const box = stairBox(next, scale);
    const grown = axis === 'x' ? box.w + snap.offset : box.h + snap.offset;
    if (grown < minUnits) continue;
    const { u, v } = next.kind === 'spiral' ? axes(0) : axes(box.angle);
    const half = snap.offset / 2;
    const shift: [number, number] = sx
      ? [sx * half * u[0], sx * half * u[1]] : [sy * half * v[0], sy * half * v[1]];
    next = applyStairBox(next, {
      cx: box.cx + shift[0], cy: box.cy + shift[1],
      w: next.kind === 'spiral' ? grown : axis === 'x' ? grown : box.w,
      h: next.kind === 'spiral' ? grown : axis === 'y' ? grown : box.h,
      angle: box.angle,
    }, scale);
  }
  return next;
}

/** Dialog field (cm, or inches when imperial) → cm within the stair bounds; null rejects. */
export function stairFieldToCm(raw: string | number, imperial: boolean): number | null {
  const value = typeof raw === 'number' ? raw : parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const cm = imperial ? value * 2.54 : value;
  return cm >= STAIR_MIN_CM && cm <= STAIR_MAX_CM ? cm : null;
}

/** Stored normalized size ↔ dialog field, exact when the field was not edited. */
export function stairFieldOf(sizeN: number, cellCm: number, imperial: boolean): string {
  const cm = normToCm(sizeN, cellCm);
  const shown = imperial ? cm / 2.54 : cm;
  return String(Math.round(shown * 100) / 100);
}

export function stairSizeFromField(
  raw: string, previousField: string, previousN: number, cellCm: number, imperial: boolean,
): number | null {
  if (raw === previousField) return previousN;
  const cm = stairFieldToCm(raw, imperial);
  return cm == null ? null : cmToNorm(cm, cellCm);
}
