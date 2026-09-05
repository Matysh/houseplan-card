export type ZigbeePixelPoint = { x: number; y: number };

export type ZigbeeArrowGeometry = {
  tip: ZigbeePixelPoint;
  points: [ZigbeePixelPoint, ZigbeePixelPoint, ZigbeePixelPoint];
};

/** A screen-pixel arrowhead whose tip stops before the destination marker or bubble. */
export function zigbeeArrowGeometry(
  origin: ZigbeePixelPoint,
  neighbor: ZigbeePixelPoint,
  originClearance: number,
  neighborClearance: number,
  direction: 'toward-neighbor' | 'toward-origin',
  preferredLength = 9,
  preferredHalfWidth = 4.5,
): ZigbeeArrowGeometry | null {
  const dx = neighbor.x - origin.x;
  const dy = neighbor.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const usable = distance - Math.max(0, originClearance) - Math.max(0, neighborClearance);
  if (!Number.isFinite(distance) || distance <= 0 || usable < 4) return null;
  const ux = dx / distance;
  const uy = dy / distance;
  const towardNeighbor = direction === 'toward-neighbor';
  const tip = towardNeighbor
    ? { x: neighbor.x - ux * Math.max(0, neighborClearance),
      y: neighbor.y - uy * Math.max(0, neighborClearance) }
    : { x: origin.x + ux * Math.max(0, originClearance),
      y: origin.y + uy * Math.max(0, originClearance) };
  const length = Math.min(preferredLength, Math.max(4, usable * 0.45));
  const halfWidth = Math.min(preferredHalfWidth, length * 0.5);
  const backSign = towardNeighbor ? -1 : 1;
  const base = { x: tip.x + ux * length * backSign, y: tip.y + uy * length * backSign };
  const nx = -uy;
  const ny = ux;
  return {
    tip,
    points: [
      tip,
      { x: base.x + nx * halfWidth, y: base.y + ny * halfWidth },
      { x: base.x - nx * halfWidth, y: base.y - ny * halfWidth },
    ],
  };
}
