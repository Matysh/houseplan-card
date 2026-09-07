import { transformSvgPath, type PdfAffine, type PdfVectorOp } from './svg-path';

/**
 * VMware Clarity Assets `compass-line.svg`, pinned at
 * bf6bdd0dd3f247f1a320d44d13fecdeda18c071c.
 * Copyright (c) 2018 VMware, Inc.; distributed under the MIT License.
 * See THIRD_PARTY_NOTICES.md for the complete notice.
 */
export const PDF_COMPASS_PATHS = [
  'M20.82,15.31h0L10.46,9c-.46-.26-1.11.37-.86.84l6.15,10.56,10.56,6.15a.66.66,0,0,0,.84-.86Zm-4,4,3-3,4.55,7.44Z',
  'M18,2A16,16,0,1,0,34,18,16,16,0,0,0,18,2Zm1,29.95V29.53H17v2.42A14,14,0,0,1,4.05,19H6.47V17H4.05A14,14,0,0,1,17,4.05V6.47h2V4.05A14,14,0,0,1,31.95,17H29.53v2h2.42A14,14,0,0,1,19,31.95Z',
] as const;

export const PDF_COMPASS_VIEWBOX_SIZE = 36;
const VIEWBOX_CENTER = PDF_COMPASS_VIEWBOX_SIZE / 2;
// The canonical needle points north-west. Rotate that diagonal to page-up first.
const CANONICAL_NORTH_OFFSET_DEG = 45;

export interface PdfCompassPlacement {
  centerX: number;
  centerY: number;
  size: number;
  /** 0 = page-up, 90 = right, 180 = down, 270 = left. */
  northDeg: number;
}

const stableTrig = (value: number): number => {
  if (Math.abs(value) < 1e-12) return 0;
  if (Math.abs(value - 1) < 1e-12) return 1;
  if (Math.abs(value + 1) < 1e-12) return -1;
  return value;
};

/** Deterministic viewBox-to-page transform preserving the square aspect ratio. */
export function pdfCompassTransform(placement: PdfCompassPlacement): PdfAffine {
  const { centerX, centerY, size, northDeg } = placement;
  if (![centerX, centerY, size, northDeg].every(Number.isFinite) || size <= 0) {
    throw new RangeError('PDF compass placement must contain finite coordinates and a positive size');
  }
  const normalizedNorth = ((northDeg % 360) + 360) % 360;
  const radians = (normalizedNorth + CANONICAL_NORTH_OFFSET_DEG) * Math.PI / 180;
  const scale = size / PDF_COMPASS_VIEWBOX_SIZE;
  const cosine = stableTrig(Math.cos(radians));
  const sine = stableTrig(Math.sin(radians));
  const a = scale * cosine, b = scale * sine;
  const c = -scale * sine, d = scale * cosine;
  return {
    a, b, c, d,
    e: centerX - a * VIEWBOX_CENTER - c * VIEWBOX_CENTER,
    f: centerY - b * VIEWBOX_CENTER - d * VIEWBOX_CENTER,
  };
}

/** Both canonical filled subpaths transformed into page-coordinate PDF operations. */
export function pdfCompassOps(placement: PdfCompassPlacement): PdfVectorOp[] {
  const transform = pdfCompassTransform(placement);
  return PDF_COMPASS_PATHS.flatMap((path) => transformSvgPath(path, transform));
}
