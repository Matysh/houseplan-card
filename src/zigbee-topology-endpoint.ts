import type { ZigbeePixelPoint } from './zigbee-topology-geometry';

/** LED endpoints use the painted path, never the hidden icon's saved position. */
export const ZIGBEE_LED_HALO_RADIUS = 7;
export interface ZigbeeLedPaint {
  d: string;
  transform: string;
  thickness: number;
  outline: string;
  core: string;
  opacity: number;
  dash: string | null;
  hollow: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  scaleX: number;
  scaleY: number;
}
export type ZigbeeEndpoint = ZigbeePixelPoint & { width: number; height: number; led?: ZigbeeLedPaint };
type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
type Layer = { left: number; top: number; width: number; height: number };

/** SVG path units → the overlay's local CSS units, including both live cameras. */
export function zigbeeLedProjection(matrix: Matrix, layer: Layer, width: number, height: number) {
  const scaleX = layer.width / width, scaleY = layer.height / height;
  const values = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f,
    layer.left, layer.top, width, height, scaleX, scaleY];
  if (!values.every(Number.isFinite) || width <= 0 || height <= 0 || scaleX <= 0 || scaleY <= 0
      || matrix.a * matrix.d - matrix.b * matrix.c === 0) return null;
  const local = { a: matrix.a / scaleX, b: matrix.b / scaleY,
    c: matrix.c / scaleX, d: matrix.d / scaleY,
    e: (matrix.e - layer.left) / scaleX, f: (matrix.f - layer.top) / scaleY };
  return { ...local, scaleX, scaleY,
    transform: `matrix(${local.a} ${local.b} ${local.c} ${local.d} ${local.e} ${local.f})` };
}

/** The directional local distance whose screen projection clears the small halo. */
export function zigbeeEndpointClearance(point: ZigbeeEndpoint, toward?: ZigbeePixelPoint): number {
  if (!point.led) return Math.max(point.width, point.height) * .61 + 3;
  const dx = toward ? toward.x - point.x : 1, dy = toward ? toward.y - point.y : 0;
  const length = Math.hypot(dx, dy);
  const scale = length ? Math.hypot(dx * point.led.scaleX, dy * point.led.scaleY) / length
    : Math.max(point.led.scaleX, point.led.scaleY);
  return (ZIGBEE_LED_HALO_RADIUS + 3) / scale;
}

export function readZigbeeLedEndpoint(path: SVGPathElement, layer: HTMLElement): ZigbeeEndpoint | null {
  if (!path.isConnected || !path.getClientRects().length) return null;
  const body = path.closest('[data-led-strip]');
  const outline = body?.querySelector<SVGPathElement>('.led-outline');
  const core = body?.querySelector<SVGPathElement>('.led-core');
  if (!outline || !core || getComputedStyle(path).visibility === 'hidden') return null;
  const d = path.getAttribute('d'), thickness = Number(outline.getAttribute('stroke-width'));
  const matrix = path.getScreenCTM();
  if (!d || !matrix || !Number.isFinite(thickness) || thickness <= 0) return null;
  const projection = zigbeeLedProjection(matrix, layer.getBoundingClientRect(), layer.clientWidth, layer.clientHeight);
  if (!projection) return null;
  const length = path.getTotalLength();
  if (!Number.isFinite(length) || length <= 0) return null;
  const anchor = path.getPointAtLength(length / 2);
  const box = path.getBBox(), pad = thickness * 2;
  const x = projection.a * anchor.x + projection.c * anchor.y + projection.e;
  const y = projection.b * anchor.x + projection.d * anchor.y + projection.f;
  if (![x, y, box.x, box.y, box.width, box.height].every(Number.isFinite)) return null;
  return { x, y, width: ZIGBEE_LED_HALO_RADIUS * 2, height: ZIGBEE_LED_HALO_RADIUS * 2,
    led: { d, transform: projection.transform, thickness,
      outline: outline.getAttribute('stroke') || '#1c2530', core: core.getAttribute('stroke') || '#919ba5',
      opacity: Number(core.getAttribute('stroke-opacity') ?? 1), dash: core.getAttribute('stroke-dasharray'),
      hollow: !!outline.parentElement?.hasAttribute('mask'),
      bounds: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 },
      scaleX: projection.scaleX, scaleY: projection.scaleY } };
}
