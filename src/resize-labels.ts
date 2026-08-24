/**
 * Screen-space projection for the live Resize measurements (#300).
 *
 * The pointer path must stay free of DOM measurements.  Callers pass the
 * viewport size cached by the stage ResizeObserver; this module then keeps the
 * area badge clear of the zoom-dependent room-settings button with pure math.
 */

export type ResizePoint = [number, number];

export interface ResizeLabelView {
  x: number;
  y: number;
  w: number;
  h: number;
  stageWidth: number;
  stageHeight: number;
}

export interface ResizeAreaPlacementInput {
  poly: number[][];
  edge: number;
  text: string;
  view: ResizeLabelView;
  gearCenter: number[];
  gearWidthPx: number;
  gearHeightPx: number;
}

export interface ResizeAreaPlacement {
  anchor: ResizePoint;
  offsetXPx: number;
  offsetYPx: number;
  tangentOffsetPx: number;
  side: 'left' | 'right' | 'above' | 'below';
  leader: { a: ResizePoint; b: ResizePoint };
}

const EPS = 1e-9;
const AREA_NORMAL_PX = 28;
const LEADER_PX = 12;
const COLLISION_GAP_PX = 4;

const signedArea = (poly: number[][]): number => {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

/** Unit normal pointing into the room, independent of polygon winding. */
export function resizeInwardNormal(poly: number[][], edge: number): ResizePoint {
  const a = poly[edge];
  const b = poly[(edge + 1) % poly.length];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  return signedArea(poly) >= 0
    ? [-dy / length, dx / length]
    : [dy / length, -dx / length];
}

/** The two side walls whose clear lengths remain useful during the drag. */
export function resizeMeasuredEdges(poly: number[][], movingEdge: number): [number, number] {
  const n = poly.length;
  return [(movingEdge - 1 + n) % n, (movingEdge + 1) % n];
}

const toScreen = (p: number[], view: ResizeLabelView): ResizePoint => [
  ((p[0] - view.x) / Math.max(EPS, view.w)) * view.stageWidth,
  ((p[1] - view.y) / Math.max(EPS, view.h)) * view.stageHeight,
];

const overlaps = (
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean => Math.abs(ax - bx) * 2 < aw + bw + COLLISION_GAP_PX * 2
  && Math.abs(ay - by) * 2 < ah + bh + COLLISION_GAP_PX * 2;

/**
 * Place one area badge on the room side of the moving wall.  If the nominal
 * position hits the room-settings button, search outwards along the wall in
 * stable 4 px steps.  The smaller screen coordinate wins equal distances.
 */
export function placeResizeAreaLabel(input: ResizeAreaPlacementInput): ResizeAreaPlacement {
  const { poly, edge, text, view } = input;
  const a = poly[edge];
  const b = poly[(edge + 1) % poly.length];
  const anchor: ResizePoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const normal = resizeInwardNormal(poly, edge);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const tangent: ResizePoint = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const anchorScreen = toScreen(anchor, view);
  const gearScreen = toScreen(input.gearCenter, view);
  const labelWidth = Math.max(34, text.length * 7.2 + 12);
  const labelHeight = 18;
  // Opposite-owner badges must clear each other even before gear avoidance.
  // On a vertical wall their text width is the limiting dimension; on a
  // horizontal wall it is the fixed badge height.
  const normalDistancePx = Math.abs(normal[0]) >= Math.abs(normal[1])
    ? Math.max(AREA_NORMAL_PX, labelWidth / 2 + COLLISION_GAP_PX)
    : Math.max(AREA_NORMAL_PX, labelHeight / 2 + COLLISION_GAP_PX);
  const nominalX = anchorScreen[0] + normal[0] * normalDistancePx;
  const nominalY = anchorScreen[1] + normal[1] * normalDistancePx;
  const collides = (shift: number): boolean => overlaps(
    nominalX + tangent[0] * shift,
    nominalY + tangent[1] * shift,
    labelWidth,
    labelHeight,
    gearScreen[0],
    gearScreen[1],
    input.gearWidthPx,
    input.gearHeightPx,
  );

  let tangentOffsetPx = 0;
  if (collides(0)) {
    // Pick the sign that moves the dominant screen coordinate towards the
    // smaller value first. This makes equal-distance choices deterministic.
    const dominant = Math.abs(tangent[0]) >= Math.abs(tangent[1]) ? tangent[0] : tangent[1];
    const firstSign = dominant > 0 ? -1 : 1;
    const limit = Math.max(view.stageWidth, view.stageHeight, 64);
    for (let distance = 4; distance <= limit; distance += 4) {
      const first = distance * firstSign;
      if (!collides(first)) { tangentOffsetPx = first; break; }
      const second = -first;
      if (!collides(second)) { tangentOffsetPx = second; break; }
    }
  }

  const offsetXPx = normal[0] * normalDistancePx + tangent[0] * tangentOffsetPx;
  const offsetYPx = normal[1] * normalDistancePx + tangent[1] * tangentOffsetPx;
  const screenLength = Math.hypot(offsetXPx, offsetYPx) || 1;
  const leaderDxPx = (offsetXPx / screenLength) * LEADER_PX;
  const leaderDyPx = (offsetYPx / screenLength) * LEADER_PX;
  const leaderB: ResizePoint = [
    anchor[0] + leaderDxPx * view.w / Math.max(1, view.stageWidth),
    anchor[1] + leaderDyPx * view.h / Math.max(1, view.stageHeight),
  ];
  const side = Math.abs(normal[0]) >= Math.abs(normal[1])
    ? (normal[0] < 0 ? 'left' : 'right')
    : (normal[1] < 0 ? 'above' : 'below');

  return {
    anchor,
    offsetXPx,
    offsetYPx,
    tangentOffsetPx,
    side,
    leader: { a: anchor, b: leaderB },
  };
}
