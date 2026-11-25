/**
 * #649 п.2 (docs/SUN.md «2.5D», docs/ISOMETRIC.md Stage 6): soft window light
 * along the real sun. The 3D light field uses the resulting world-space footprint.
 *
 * Numbers are the designer lab (sketch 07, `lightMode: 'sun'`, slider 72 %)
 * converted from its SVG units into H, the 2.5D wall height (lab H = 218.8).
 * The same exterior windows, wall faces, room contours and occluders as the
 * Flat rays feed it, so both views agree on WHERE light can fall.
 */
import { sunDirOnPlan, windowLit, windowWallInfo, type SunRoom, type SunWindow } from './sun';
import { directionalOccluders, floorMinusBodies, geometryOuterRings } from './physical-geometry';
import { intersection } from 'polyclip-ts';
import { resolveSunAccess, type SunAccess } from './sun-access';

/** Lab `min(910, max(215, 408·(0.55 + 1.4·(1 − e/90)^1.6)))` in wall heights. */
export const ISO_SUN_LENGTH = Object.freeze({ base: 408 / 218.8, min: 215 / 218.8, max: 910 / 218.8 });
/** Depth of the light along the inward window normal, in plan units. */
export function isoSunDepth(elevation: number, wallHeight: number): number {
  const e = Math.min(90, Math.max(0, elevation));
  const k = ISO_SUN_LENGTH.base * (0.55 + 1.4 * Math.pow(1 - e / 90, 1.6));
  return wallHeight * Math.min(ISO_SUN_LENGTH.max, Math.max(ISO_SUN_LENGTH.min, k));
}

export interface IsoSunBeam {
  openingId: string;
  roomId: string;
  lightFloor: boolean;
  /** Inner-face corners of the opening. */
  a: [number, number];
  b: [number, number];
  /** Parallelogram offset: `a + shift` is the far corner (along the sun). */
  shift: [number, number];
  /** Inward normal and depth L: the gradient axis. */
  normal: [number, number];
  depth: number;
  clip: number[][];
  clipPolys?: number[][][];
  polys: number[][][];
}

export interface IsoSunInput {
  access?: SunAccess;
  rooms: SunRoom[];
  windows: SunWindow[];
  azimuth: number;
  elevation: number;
  northDeg: number;
  wallHeight: number;
  innerByRoom?: Record<string, number[][]>;
  wallDepthByOpening?: Record<string, number>;
  occluders?: number[][][];
  lightFloorRooms?: ReadonlySet<string>;
}

function intersectRings(a: number[][], b: number[][]): number[][][] {
  try {
    const close = (ring: number[][]) => [[...ring.map((p): [number, number] => [p[0], p[1]]), [ring[0][0], ring[0][1]] as [number, number]]];
    return intersection(close(a), close(b))
      .map((poly) => poly[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 4)
      .map((ring) => ring.slice(0, -1).map((p) => [p[0], p[1]]));
  } catch {
    return [];
  }
}

/** Pure geometry of every lit window's soft beam (ТЗ #649 п.2). */
export function computeIsoSunBeams(input: IsoSunInput): IsoSunBeam[] {
  if (!(input.elevation > 0) || !(input.wallHeight > 0)) return [];
  const toSun = sunDirOnPlan(input.azimuth, input.northDeg);
  const away: [number, number] = [-toSun[0], -toSun[1]];
  const depth = isoSunDepth(input.elevation, input.wallHeight);
  const out: IsoSunBeam[] = [];
  const access = input.access ?? resolveSunAccess(input.rooms);
  for (const w of input.windows) {
    if (!(w.length > 0)) continue;
    const info = windowWallInfo(w, input.rooms, 6, access);
    if (!info || !windowLit(info.normal, toSun, input.elevation)) continue;
    const room = input.rooms.find((r) => r.id === info.roomId);
    if (!room) continue;
    const clip = input.innerByRoom?.[info.roomId] || room.poly;
    const normal: [number, number] = [-info.normal[0], -info.normal[1]];
    const cos = away[0] * normal[0] + away[1] * normal[1];
    if (!(cos > 0)) continue;
    const rad = (w.angle * Math.PI) / 180;
    const hx = Math.cos(rad) * w.length / 2;
    const hy = Math.sin(rad) * w.length / 2;
    const d = Math.max(0, input.wallDepthByOpening?.[w.id] || 0) / 2;
    const cx = w.x + normal[0] * d;
    const cy = w.y + normal[1] * d;
    const a: [number, number] = [cx - hx, cy - hy];
    const b: [number, number] = [cx + hx, cy + hy];
    // Travel along the sun until the light is `depth` deep under the wall.
    const travel = depth / cos;
    const shift: [number, number] = [away[0] * travel, away[1] * travel];
    const intervals = w.mask ?? [[0, 1]];
    const masked = !(intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === 1);
    // Keep the parent eligibility, gradient, depth and outer streak anchors.
    // Only its permitted aperture shares create illuminated geometry.
    let polys = intervals.flatMap(([lo, hi]) => {
      if (![lo, hi].every(Number.isFinite) || lo < 0 || hi > 1 || !(hi > lo)) return [];
      const start = lo === 0 ? a : [a[0] + 2 * hx * lo, a[1] + 2 * hy * lo];
      const end = hi === 1 ? b : [a[0] + 2 * hx * hi, a[1] + 2 * hy * hi];
      return intersectRings([start, end, [end[0] + shift[0], end[1] + shift[1]],
        [start[0] + shift[0], start[1] + shift[1]]], clip);
    });
    if (polys.length && input.occluders?.length) {
      const shadows = directionalOccluders(input.occluders, away, travel);
      polys = polys.flatMap((poly) => geometryOuterRings(floorMinusBodies(poly, shadows)));
    }
    if (!polys.length) continue;
    out.push({
      openingId: w.id, roomId: info.roomId, lightFloor: !!input.lightFloorRooms?.has(info.roomId),
      a, b, shift, normal, depth, clip, polys,
      // Clip sill glow/blur and original outer streaks too; no new streaks
      // are invented at an internal shade boundary.
      ...(masked ? { clipPolys: polys } : {}),
    });

  }
  return out;
}
