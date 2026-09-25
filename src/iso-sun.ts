/**
 * #649 п.2 (docs/SUN.md «2.5D», docs/ISOMETRIC.md Stage 6): soft window light
 * along the real sun in the 2.5D View. Flat keeps `computeSunRays()` untouched;
 * this is the only light renderer of the 2.5D floor.
 *
 * Numbers are the designer lab (sketch 07, `lightMode: 'sun'`, slider 72 %)
 * converted from its SVG units into H, the 2.5D wall height (lab H = 218.8).
 * The same exterior windows, wall faces, room contours and occluders as the
 * Flat rays feed it, so both views agree on WHERE light can fall.
 */
import { svg, nothing, type TemplateResult } from 'lit';
import { sunDirOnPlan, windowLit, windowWallInfo, type SunRoom, type SunWindow } from './sun';
import { directionalOccluders, floorMinusBodies, geometryOuterRings } from './physical-geometry';
import { intersection } from 'polyclip-ts';

/** Lab `min(910, max(215, 408·(0.55 + 1.4·(1 − e/90)^1.6)))` in wall heights. */
export const ISO_SUN_LENGTH = Object.freeze({ base: 408 / 218.8, min: 215 / 218.8, max: 910 / 218.8 });
export const ISO_SUN_BLUR = 14 / 218.8;
export const ISO_SUN_STREAK = Object.freeze({ inset: 4 / 218.8, width: 4 / 218.8, reach: 0.85 });
export const ISO_SUN_SILL = Object.freeze({ width: 16 / 218.8, blur: 5 / 218.8, opacity: 0.6 });

export type IsoSunStop = readonly [offset: number, color: string, opacity: number];
export const ISO_SUN_STOPS_DARK_FLOOR: readonly IsoSunStop[] = Object.freeze([
  [0, '#ffe9b4', 0.62], [0.3, '#fff0cb', 0.38], [0.65, '#fff6e0', 0.12], [1, '#fff8e8', 0],
]);
export const ISO_SUN_STOPS_LIGHT_FLOOR: readonly IsoSunStop[] = Object.freeze([
  [0, '#e2b95e', 0.46], [0.3, '#e9c97e', 0.3], [0.65, '#f0dcaa', 0.1], [1, '#f4e6c4', 0],
]);
export const ISO_SUN_STREAK_STOPS: readonly IsoSunStop[] = Object.freeze([
  [0, '#ecc46a', 0.8], [0.55, '#f1d48f', 0.35], [1, '#f7e6bf', 0],
]);

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
  polys: number[][][];
}

export interface IsoSunInput {
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
  for (const w of input.windows) {
    if (!(w.length > 0)) continue;
    const info = windowWallInfo(w, input.rooms);
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
    const quad = [a, b, [b[0] + shift[0], b[1] + shift[1]], [a[0] + shift[0], a[1] + shift[1]]];
    let polys = intersectRings(quad, clip);
    if (polys.length && input.occluders?.length) {
      const shadows = directionalOccluders(input.occluders, away, travel);
      polys = polys.flatMap((poly) => geometryOuterRings(floorMinusBodies(poly, shadows)));
    }
    if (!polys.length) continue;
    out.push({
      openingId: w.id, roomId: info.roomId, lightFloor: !!input.lightFloorRooms?.has(info.roomId),
      a, b, shift, normal, depth, clip, polys,
    });
  }
  return out;
}

const pts = (ring: readonly (readonly number[])[]): string => ring.map((p) => `${p[0]},${p[1]}`).join(' ');
const stopsSvg = (stops: readonly IsoSunStop[]) => stops.map(([o, c, a]) => svg`<stop
  offset="${o}" stop-color="${c}" stop-opacity="${a}"></stop>`);

/**
 * The 2.5D light layer. It sits where the Flat `.sunlayer` sits (floor group,
 * above room fills and Glow) and keeps its fade classes.
 */
export function renderIsoSunWash(
  beams: readonly IsoSunBeam[], wallHeight: number, out: boolean, opacity: number,
): TemplateResult | typeof nothing {
  if (!beams.length) return nothing;
  const blur = ISO_SUN_BLUR * wallHeight;
  const sillBlur = ISO_SUN_SILL.blur * wallHeight;
  const inset = ISO_SUN_STREAK.inset * wallHeight;
  return svg`<defs>
      <filter id="hp-iso-sun-blur" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="${blur}"></feGaussianBlur></filter>
      <filter id="hp-iso-sill-blur" x="-50%" y="-200%" width="200%" height="500%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="${sillBlur}"></feGaussianBlur></filter>
      ${beams.map((beam, i) => {
        const mx = (beam.a[0] + beam.b[0]) / 2;
        const my = (beam.a[1] + beam.b[1]) / 2;
        const ex = mx + beam.normal[0] * beam.depth;
        const ey = my + beam.normal[1] * beam.depth;
        return svg`<linearGradient id="hp-iso-sun-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}" x2="${ex}" y2="${ey}">
            ${stopsSvg(beam.lightFloor ? ISO_SUN_STOPS_LIGHT_FLOOR : ISO_SUN_STOPS_DARK_FLOOR)}</linearGradient>
          ${beam.lightFloor ? svg`<linearGradient id="hp-iso-sun-edge-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}" x2="${mx + (ex - mx) * ISO_SUN_STREAK.reach}" y2="${my + (ey - my) * ISO_SUN_STREAK.reach}">
            ${stopsSvg(ISO_SUN_STREAK_STOPS)}</linearGradient>` : nothing}
          <clipPath id="hp-iso-sun-clip-${i}"><polygon points="${pts(beam.clip)}"></polygon></clipPath>`;
      })}
    </defs>
    <g class="sunlayer iso-sunwash hp-view-only-layer ${out ? 'out' : ''}" opacity="${opacity}">
      ${beams.map((beam, i) => {
        const length = Math.hypot(beam.b[0] - beam.a[0], beam.b[1] - beam.a[1]) || 1;
        const streaks = beam.lightFloor ? [inset / length, 1 - inset / length] : [];
        return svg`<g class="iso-sunbeam" data-opening=${beam.openingId} data-floor=${beam.lightFloor ? 'light' : 'dark'}
            clip-path="url(#hp-iso-sun-clip-${i})">
          ${beam.polys.map((poly) => svg`<polygon class="iso-sun-fill" points="${pts(poly)}"
            fill="url(#hp-iso-sun-${i})" filter="url(#hp-iso-sun-blur)"></polygon>`)}
          ${streaks.map((t) => {
            const x = beam.a[0] + (beam.b[0] - beam.a[0]) * t;
            const y = beam.a[1] + (beam.b[1] - beam.a[1]) * t;
            return svg`<line class="iso-sun-streak" x1="${x}" y1="${y}"
              x2="${x + beam.shift[0] * ISO_SUN_STREAK.reach}" y2="${y + beam.shift[1] * ISO_SUN_STREAK.reach}"
              stroke="url(#hp-iso-sun-edge-${i})" stroke-width="${ISO_SUN_STREAK.width * wallHeight}"
              stroke-linecap="round"></line>`;
          })}
          <line class="iso-sun-sill" x1="${beam.a[0]}" y1="${beam.a[1]}" x2="${beam.b[0]}" y2="${beam.b[1]}"
            stroke="${beam.lightFloor ? '#efd493' : '#fff3cf'}" stroke-width="${ISO_SUN_SILL.width * wallHeight}"
            opacity="${ISO_SUN_SILL.opacity}" filter="url(#hp-iso-sill-blur)"></line>
        </g>`;
      })}
    </g>`;
}
