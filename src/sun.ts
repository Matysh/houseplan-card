/**
 * Sun on the plan — pure logic only (docs/SUN.md).
 *
 * Angles, the day phase palette, exterior-wall detection, window light
 * wedges and their clipping, and the settings
 * inheritance. Coordinates are render units (NORM_W-scaled canvas,
 * y grows DOWNWARD), same as the card's space model. Nothing here
 * touches Lit, the DOM or `hass` beyond a plain state object.
 */
import { intersection } from 'polyclip-ts';
import { pointInPolygon, lerpColor } from './logic';

// ---------------- angles ----------------

/** Normalise any angle in degrees to [0, 360). */
export function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * The sun's bearing on the CANVAS: 0 = up, clockwise (docs/SUN.md).
 * `north_deg` is how far true north is rotated clockwise from "canvas up".
 */
export function planSunAngle(azimuth: number, northDeg: number): number {
  return norm360(azimuth - northDeg);
}

/** Unit vector TOWARD the sun on the canvas (x right, y down). */
export function sunDirOnPlan(azimuth: number, northDeg: number): [number, number] {
  const a = (planSunAngle(azimuth, northDeg) * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

// ---------------- day phase (bg_mode: 'daynight') ----------------

export type DayCyclePhase = 'dawn' | 'day' | 'dusk' | 'night';
export type DayCycleSource = 'sun' | 'clock';

export interface DayCyclePalette {
  top: string;
  bottom: string;
  horizon: string;
  sun: string;
  vignette: string;
  outlineNear: string;
  outlineMid: string;
  outlineFar: string;
}

/** Exact visual tokens approved in issue #146. One table feeds every surface. */
export const DAY_CYCLE_PALETTES: Readonly<Record<DayCyclePhase, Readonly<DayCyclePalette>>> =
  Object.freeze({
    dawn: Object.freeze({
      top: '#aabdd1', bottom: '#e8c8b7',
      horizon: 'rgba(255,201,156,.56)', sun: 'rgba(255,188,125,.78)',
      vignette: 'rgba(65,72,99,.21)',
      outlineNear: 'rgba(74,57,61,.25)', outlineMid: 'rgba(255,238,224,.40)',
      outlineFar: 'rgba(255,224,202,.18)',
    }),
    day: Object.freeze({
      top: '#dce9ef', bottom: '#cbdce3',
      horizon: 'rgba(255,245,220,.45)', sun: 'rgba(255,239,190,.72)',
      vignette: 'rgba(65,91,105,.16)',
      outlineNear: 'rgba(45,62,71,.28)', outlineMid: 'rgba(255,255,255,.42)',
      outlineFar: 'rgba(255,255,255,.20)',
    }),
    dusk: Object.freeze({
      top: '#48536c', bottom: '#9a7380',
      horizon: 'rgba(242,156,114,.34)', sun: 'rgba(255,167,113,.55)',
      vignette: 'rgba(20,26,44,.39)',
      outlineNear: 'rgba(238,219,225,.40)', outlineMid: 'rgba(229,207,218,.26)',
      outlineFar: 'rgba(215,190,205,.12)',
    }),
    night: Object.freeze({
      top: '#111a27', bottom: '#1f2f3e',
      horizon: 'rgba(79,120,151,.16)', sun: 'rgba(169,208,231,0)',
      vignette: 'rgba(3,8,14,.58)',
      outlineNear: 'rgba(218,238,249,.56)', outlineMid: 'rgba(174,215,238,.30)',
      outlineFar: 'rgba(136,194,226,.14)',
    }),
  });

export interface DayCycleSun {
  azimuth: number;
  elevation: number;
  rising: boolean;
}

export interface DayCycleState {
  phase: DayCyclePhase;
  source: DayCycleSource;
  sunX: number;
  sunY: number;
  sunOpacity: number;
}

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Strict environment sample. Window rays deliberately keep using sunStateOf(). */
export function dayCycleSunOf(hass: any): DayCycleSun | null {
  const attrs = hass?.states?.['sun.sun']?.attributes;
  if (!attrs || !finiteNumber(attrs.azimuth) || !finiteNumber(attrs.elevation)
      || typeof attrs.rising !== 'boolean') return null;
  return {
    azimuth: norm360(attrs.azimuth),
    elevation: attrs.elevation,
    rising: attrs.rising,
  };
}

/** Owner-approved real-sun thresholds. Exact -6 is night; exact +6 is day. */
export function dayCyclePhaseFromSun(sun: Pick<DayCycleSun, 'elevation' | 'rising'>): DayCyclePhase {
  if (sun.elevation <= -6) return 'night';
  if (sun.elevation >= 6) return 'day';
  return sun.rising ? 'dawn' : 'dusk';
}

/** Fixed browser-local fallback schedule from the issue attachment. */
export function dayCyclePhaseFromMinutes(minutes: number): DayCyclePhase {
  const m = ((Math.floor(Number(minutes) || 0) % 1440) + 1440) % 1440;
  if (m >= 300 && m < 480) return 'dawn';
  if (m >= 480 && m < 1080) return 'day';
  if (m >= 1080 && m < 1260) return 'dusk';
  return 'night';
}

export function localDayCycleMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Hemisphere-independent east -> centre -> west projection of real azimuth. */
export function dayCyclePositionFromSun(sun: DayCycleSun): Pick<DayCycleState, 'sunX' | 'sunY' | 'sunOpacity'> {
  const phase = dayCyclePhaseFromSun(sun);
  const azimuthRad = (sun.azimuth * Math.PI) / 180;
  return {
    sunX: 50 - Math.sin(azimuthRad) * 42,
    sunY: 78 - (clamp(sun.elevation, 0, 90) / 90) * 64,
    sunOpacity: phase === 'night' ? 0 : clamp((sun.elevation + 6) / 12, 0, 1),
  };
}

/** Decorative 05:00 -> 13:00 -> 21:00 fallback arc from the prototype. */
export function dayCyclePositionFromMinutes(minutes: number): Pick<DayCycleState, 'sunX' | 'sunY' | 'sunOpacity'> {
  const m = ((Math.floor(Number(minutes) || 0) % 1440) + 1440) % 1440;
  if (m < 300 || m >= 1260) return { sunX: 50, sunY: 78, sunOpacity: 0 };
  const progress = (m - 300) / 960;
  const dawnRamp = (m - 300) / 120;
  const duskRamp = (1260 - m) / 120;
  return {
    sunX: 8 + progress * 84,
    sunY: 78 - Math.sin(progress * Math.PI) * 64,
    sunOpacity: Math.max(0.18, Math.min(dawnRamp, duskRamp, 1)),
  };
}

/** One atomic snapshot for phase and decorative light. */
export function resolveDayCycle(hass: any, now: Date | number = new Date()): DayCycleState {
  const sun = dayCycleSunOf(hass);
  if (sun) {
    return {
      phase: dayCyclePhaseFromSun(sun),
      source: 'sun',
      ...dayCyclePositionFromSun(sun),
    };
  }
  const minutes = typeof now === 'number' ? now : localDayCycleMinutes(now);
  return {
    phase: dayCyclePhaseFromMinutes(minutes),
    source: 'clock',
    ...dayCyclePositionFromMinutes(minutes),
  };
}

/** Stable enough for the fallback ticker; avoids a Lit update when nothing moved. */
export function dayCycleFingerprint(state: DayCycleState): string {
  return `${state.source}|${state.phase}|${state.sunX.toFixed(2)}|${state.sunY.toFixed(2)}|`
    + state.sunOpacity.toFixed(3);
}

export interface DayPhase {
  /** Stage background color for the current elevation. */
  bg: string;
  /** How much the PLAN itself dims (0..0.1 — readability first). */
  planDim: number;
  /** 1 = golden hour / horizon, 0 = plain daylight. Drives wedge color. */
  warmth: number;
}

/** elevation° → color stops; piecewise-linear between neighbours. */
const BG_STOPS: [number, string][] = [
  [-90, '#070c14'], // deep night
  [-12, '#070c14'],
  [-4, '#131a28'],  // dusk cools down
  [0, '#4a3527'],   // warm band right at the horizon
  [10, '#e8ddcf'],  // morning light — warm and bright on the way to white
  [30, '#ffffff'],  // plain day: the brightest moment is white (owner 2026-08-03)
  [90, '#ffffff'],
];

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Background, plan dim and warmth for a sun elevation (docs/SUN.md). */
export function dayPhase(elevation: number): DayPhase {
  const e = Math.min(90, Math.max(-90, Number(elevation) || 0));
  let bg = BG_STOPS[BG_STOPS.length - 1][1];
  for (let i = 1; i < BG_STOPS.length; i++) {
    const [e0, c0] = BG_STOPS[i - 1];
    const [e1, c1] = BG_STOPS[i];
    if (e <= e1) {
      bg = lerpColor(c0, c1, (e - e0) / (e1 - e0));
      break;
    }
  }
  return {
    bg,
    // full 10% below ~-6°, gone above +10° — a slow dusk, not a switch
    planDim: clamp01((10 - e) / 16) * 0.1,
    warmth: e < 0 ? 1 : clamp01(1 - e / 10),
  };
}

// ---------------- exterior walls & windows ----------------

export interface SunRoom { id: string; poly: number[][] }
/** A window opening in render units: centre, wall angle°, full length. */
export interface SunWindow { id: string; x: number; y: number; angle: number; length: number }

/**
 * Is the wall stretch at `mid` with outward normal `n` exterior — i.e. is
 * there NO room just outside it? Probes one point `probe` units out.
 */
export function isExteriorWall(mid: number[], n: number[], rooms: SunRoom[], probe = 6): boolean {
  const p = [mid[0] + n[0] * probe, mid[1] + n[1] * probe];
  return !rooms.some((r) => r.poly.length >= 3 && pointInPolygon(p, r.poly));
}

/**
 * The wall a window sits on: probe both sides of the window centre. Exactly
 * one side inside a room → exterior wall; the outward normal points to the
 * empty side and the room on the other side hosts the wedge. Both sides in
 * rooms (interior walls, open/virtual boundaries) or neither (a window not
 * on any boundary) → null: this window never casts light (docs/SUN.md).
 */
export function windowWallInfo(
  win: { x: number; y: number; angle: number },
  rooms: SunRoom[],
  probe = 6,
): { normal: [number, number]; roomId: string } | null {
  const rad = (win.angle * Math.PI) / 180;
  // perpendicular to the wall (the wall runs along `angle`)
  const n: [number, number] = [Math.sin(rad), -Math.cos(rad)];
  const roomAt = (side: 1 | -1): SunRoom | null => {
    const p = [win.x + n[0] * probe * side, win.y + n[1] * probe * side];
    return rooms.find((r) => r.poly.length >= 3 && pointInPolygon(p, r.poly)) || null;
  };
  const plus = roomAt(1);
  const minus = roomAt(-1);
  if (plus && minus) return null; // interior wall (incl. open boundaries)
  if (!plus && !minus) return null; // not on any room's wall
  return plus
    ? { normal: [-n[0], -n[1]], roomId: plus.id! }
    : { normal: n, roomId: minus!.id };
}

/**
 * How square the sun has to be to a wall before that wall's windows cast
 * anything: the cosine of the angle of incidence, i.e. `outward normal · dir
 * to the sun`. 0.05 is ~87.1°, so the sun has to clear the plane of the wall
 * by ~2.9° — the same order as the 3° elevation threshold, and for the same
 * reason: below it there is no light worth painting. Glass agrees (Fresnel
 * reflects almost everything at that incidence), and so does the geometry —
 * the shaft's perpendicular depth is `len · cos`, so under this threshold the
 * whole wedge is a sliver thinner than the wall it came through, drawn with a
 * gradient axis shorter than a pixel (DEV-EB173-01).
 */
export const RAY_MIN_COS = 0.05;

/** Does the sun actually shine INTO this window right now? (A sun grazing
 * along the wall does not count — see RAY_MIN_COS, which also swallows the
 * sin/cos float dust of the right-angle directions.) */
export function windowLit(normal: number[], sunDir: number[], elevation: number): boolean {
  return elevation > 0 && normal[0] * sunDir[0] + normal[1] * sunDir[1] > RAY_MIN_COS;
}

// ---------------- wedge geometry ----------------

/**
 * Wedge length in WINDOW LENGTHS: longest (~1.75) at sunrise/sunset, shortest
 * (~0.56) at the zenith. `0.56 + 1.19·(1 − e/90)^1.6` — long low shafts, short
 * noon pools, smooth in between (docs/SUN.md). Owner 2026-08-04: «лучи от
 * солнца сделать короче на 30%» — the whole curve is the old
 * `0.8 + 1.7·(1 − e/90)^1.6` scaled by RAY_LENGTH_K, so the "low sun reaches
 * further" shape is untouched.
 */
export const RAY_LENGTH_K = 0.7;

export function rayLength(elevation: number): number {
  const e = Math.min(90, Math.max(0, elevation));
  return RAY_LENGTH_K * (0.8 + 1.7 * Math.pow(1 - e / 90, 1.6));
}

/**
 * The unclipped wedge: the window span a-b extruded along `dir` by the SAME
 * `len` at both ends. An honest parallelogram — every ray through the opening
 * travels exactly the wedge's reach, so the promised "30 % shorter" holds for
 * each side of every wedge, at any sun angle.
 *
 * Its far edge is parallel to the WALL, and that is not a compromise: it is
 * the iso-alpha line of the gradient the card actually draws. For parallel
 * rays the distance travelled from the source span is `depth / cos`, an affine
 * function of the point whose level sets are lines PARALLEL TO THE WALL, so
 * the fade must run along the wall's NORMAL (see `SunRay.normal/depth` and
 * docs/SUN.md), not along `dir`. With that axis all three invariants hold at
 * once: the whole source span sits at offset 0 (peak alpha end to end), the
 * alpha at any point depends only on how far its own ray has travelled, and
 * the wedge's far edge coincides with the gradient's end — a bright kerb is
 * impossible by construction.
 *
 * The previous attempt (DEV-EB173-01) kept the gradient along `dir` from the
 * span's midpoint and bent the GEOMETRY to match, extruding the two ends by
 * different amounts. At a grazing sun that put one end of the glass itself at
 * offset 0.88 — fully transparent before the shaft even started — and made
 * the long side 88 % longer than the nominal reach instead of 30 % shorter.
 *
 * The two SIDES stay razor-sharp on purpose — owner 2026-08-04: «с лучами
 * солнца ты сделал фигню — не надо размывать их боковые грани». A shaft of
 * light through a window HAS crisp sides; only its reach fades.
 */
export function rayQuad(a: number[], b: number[], dir: number[], len: number): number[][] {
  return [
    [a[0], a[1]],
    [b[0], b[1]],
    [b[0] + dir[0] * len, b[1] + dir[1] * len],
    [a[0] + dir[0] * len, a[1] + dir[1] * len],
  ];
}

/** Clip a wedge by the room outline. Returns outer rings (may be several). */
export function clipToRoom(quad: number[][], room: number[][]): number[][][] {
  try {
    const res = intersection(
      [[...quad.map((p) => [p[0], p[1]]), [quad[0][0], quad[0][1]]]] as any,
      [[...room.map((p) => [p[0], p[1]]), [room[0][0], room[0][1]]]] as any,
    );
    const out: number[][][] = [];
    for (const poly of res as any) {
      const ring = poly?.[0];
      if (!Array.isArray(ring) || ring.length < 4) continue;
      out.push(ring.slice(0, ring.length - 1).map((p: number[]) => [p[0], p[1]]));
    }
    return out;
  } catch {
    return []; // a degenerate clip draws nothing rather than everything
  }
}

export interface SunRay {
  openingId: string;
  roomId: string;
  /** Clipped wedge outline(s), render units. */
  polys: number[][][];
  /** Optional even-odd polygons after physical-obstacle subtraction. */
  paths?: string[];
  /** Room-side opening corners (the bright end of the gradient). */
  a: number[];
  b: number[];
  /** Direction the light travels (AWAY from the sun), unit vector. */
  dir: [number, number];
  /** Wedge reach in render units: how far along `dir` every ray travels. */
  len: number;
  /**
   * INWARD wall normal (unit) — the axis of the fade. The distance a point
   * has travelled from the source span is the same affine function of the point as
   * its depth under the wall, so the gradient's iso-alpha lines are parallel
   * to the wall and its axis is this normal (docs/SUN.md, DEV-EB173-01).
   */
  normal: [number, number];
  /**
   * Length of that axis: `len · (dir·normal)` — the perpendicular depth a ray
   * reaches after travelling `len`. A point `source + dir·u` therefore lands
   * at offset `u/len`: the source span is all at 0, the far edge all at 1.
   */
  depth: number;
}

/**
 * All wedges of a space for one sun position. Pure and deterministic — the
 * card memoises the result on (azimuth, elevation, config rev) and reuses
 * it across hass ticks (docs/SUN.md). Mutual shading of building wings is
 * NOT considered (documented limit).
 *
 * `innerByRoom` (optional): when wall thickness is set, clip wedges to each
 * room's inner contour. `wallDepthByOpening` moves the full window span from
 * the wall centreline to its room-side face, so the two side rays start at the
 * opening's two inner corners (docs/WALL-THICKNESS.md §5).
 */
export function computeSunRays(
  rooms: SunRoom[],
  windows: SunWindow[],
  azimuth: number,
  elevation: number,
  northDeg: number,
  innerByRoom?: Record<string, number[][]>,
  wallDepthByOpening?: Record<string, number>,
): SunRay[] {
  if (!(elevation > 0)) return [];
  const toSun = sunDirOnPlan(azimuth, northDeg);
  const away: [number, number] = [-toSun[0], -toSun[1]];
  const k = rayLength(elevation);
  const out: SunRay[] = [];
  for (const w of windows) {
    if (!(w.length > 0)) continue;
    const info = windowWallInfo(w, rooms);
    if (!info || !windowLit(info.normal, toSun, elevation)) continue;
    const room = rooms.find((r) => r.id === info.roomId);
    if (!room) continue;
    const clipPoly = (innerByRoom && innerByRoom[info.roomId]) || room.poly;
    const rad = (w.angle * Math.PI) / 180;
    const half = w.length / 2;
    const normal: [number, number] = [-info.normal[0], -info.normal[1]];
    const d = Math.max(0, wallDepthByOpening?.[w.id] || 0);
    // A wall grows ±½ from its centreline. Start the whole light span on the
    // room-side face: its endpoints are the two inner corners of the opening,
    // independent of the sun's incidence angle.
    const sourceX = w.x + normal[0] * d / 2;
    const sourceY = w.y + normal[1] * d / 2;
    const hx = Math.cos(rad) * half;
    const hy = Math.sin(rad) * half;
    const a = [sourceX - hx, sourceY - hy];
    const b = [sourceX + hx, sourceY + hy];
    const len = k * w.length;
    const polys = clipToRoom(rayQuad(a, b, away, len), clipPoly);
    if (!polys.length) continue;
    // inward normal + how deep the ray gets: cos of the incidence angle,
    // which windowLit() has already found to be above RAY_MIN_COS
    const cos = away[0] * normal[0] + away[1] * normal[1];
    out.push({ openingId: w.id, roomId: info.roomId, polys, a, b, dir: away, len,
      normal, depth: len * cos });
  }
  return out;
}

// ---------------- wedge dressing ----------------

/**
 * Peak wedge opacity (owner 2026-08-03: «лучи поярче, иногда плохо видны» —
 * raised from 0.18). Two overlapping wedges still stay under a readable
 * ceiling on white paper AND on the dark glow canvas (docs/SUN.md).
 */
export const RAY_MAX_ALPHA = 0.3;

/**
 * The elevation threshold, degrees. Below it there are NO rays at all, above
 * it they are at FULL strength — the owner's 2026-08-03 contract replacing
 * the old gradual ramp-in. The switch itself is not instant: the card fades
 * the whole layer in/out over RAY_FADE_MS (CSS, not geometry).
 */
export const RAY_ELEVATION_MIN = 3;

/** Duration of that fade, ms — «ровно 2 секунды» (mirrored in styles.ts). */
export const RAY_FADE_MS = 2000;

/** Are the wedges present at this elevation at all? (The hard 3° threshold.) */
export function raysVisible(elevation: number): boolean {
  return Number(elevation) >= RAY_ELEVATION_MIN;
}

/** Full-strength wedge opacity. Weather deliberately plays no part. */
export function rayPeakAlpha(): number {
  return RAY_MAX_ALPHA;
}

/** Wedge opacity: nothing below the threshold, full strength above it. */
export function rayAlpha(elevation: number): number {
  return raysVisible(elevation) ? rayPeakAlpha() : 0;
}

/** Wedge color: warm orange at the horizon → neutral daylight. */
export function rayColor(warmth: number): string {
  return lerpColor('#ffe9c2', '#ff9a45', clamp01(warmth));
}

/**
 * Where the shaft is already fully dissolved, as a fraction of its own length.
 * Owner 2026-08-04: «проверить, чтобы они всегда плавно рассеивались (сейчас
 * есть ощущение, что они упираются во что-то невидимое)». The old gradient ran
 * to alpha 0 exactly AT the far edge, so any wedge that ended in mid-air still
 * carried a sliver of colour up to its last pixel — and the eye reads the
 * straight line of a polygon edge long before the alpha reaches zero. The last
 * visible light now sits at 85 % of the length; the remaining 15 % is empty.
 */
export const RAY_FADE_END = 0.85;

/**
 * Gradient stops along the shaft: `[offset 0..1, share of the peak alpha]`.
 * Convex ease-out — bright at the inner opening, half gone by a third of the way,
 * a whisper at two thirds, nothing from RAY_FADE_END on. Consumed by the card
 * as SVG <stop>s over the FULL wedge length, so the geometry and the gradient
 * always describe the same shaft (docs/SUN.md).
 *
 * This gradient is the ONLY thing that dissolves a wedge: the falloff runs
 * along the ray, from the inner opening inward, and the sides of the shaft keep the
 * hard edge light actually has (owner 2026-08-04: «не надо размывать их
 * боковые грани»). No blur is involved anywhere.
 */
export function rayStops(): [number, number][] {
  return [
    [0, 1],
    [0.26, 0.86],
    [0.46, 0.6],
    [0.64, 0.32],
    [0.77, 0.1],
    [RAY_FADE_END, 0],
    [1, 0],
  ];
}

// ---------------- the rim (owner 2026-08-04) ----------------

/**
 * The rim: «тонкая (1px) чёрная граница по бокам светящегося сектора, которая
 * также плавно уходит в ноль вместе с самим градиентом».
 *
 * Why at all: painting light means ADDING luminance, and white paper has none
 * left to give (the analysis kept in legacy/docs/SUN-CONTRAST.md). The owner rejected
 * the «shade instead of light» model that analysis proposed and asked for the
 * cheap half of it instead — light is invisible on white, but its BOUNDARY is
 * not. One hairline along each side of the shaft gives the wedge a "beam"
 * reading on paper without touching the fill, the geometry or anything a dark
 * scene already gets right.
 *
 * Contract (docs/SUN.md, «The rim»):
 *
 * - only the two SIDE edges — the ones running from the inner opening corners
 *   along `dir`. Never the source edge (a-b) and never the far edge: those are
 *   not boundaries of the beam, they are its source and its end;
 * - one screen pixel at any zoom (`vector-effect: non-scaling-stroke`);
 * - black, and it dies EXACTLY with the fill: same gradient axis (the wall's
 *   inward normal, `depth` long), same normalised curve `rayStops()`, same
 *   `RAY_FADE_END` — so no rim can outlive the light it outlines;
 * - clipped by the room like the wedge itself, which here is free: the
 *   segments are cut out of the ALREADY clipped polygons (`rayRimEdges`),
 *   so no `clip-path` enters the sun layer (docs/SUN.md keeps that promise).
 */

/**
 * Peak rim opacity at the inner opening. Visually tuned on the
 * demo rig at both extremes: it has to make the shaft legible on white paper
 * (the whole point) yet not read as an ink outline over the dark glow canvas.
 * Below ~0.3 the line disappears on paper at kiosk scale; above ~0.5 it turns
 * into a drawn contour on a night scene.
 */
export const RIM_MAX_ALPHA = 0.42;

/** The rim is black — the one thing white paper still has room for. */
export const RIM_COLOR = '#000000';

/** Peak rim opacity; weather deliberately plays no part. */
export function rimPeakAlpha(): number {
  return RIM_MAX_ALPHA;
}

/**
 * Rim gradient stops — the SAME normalised curve as the fill, by identity and
 * not by copy: «прозрачность гаснет ВМЕСТЕ с заливкой ... ровно по той же
 * кривой и тому же порогу». Only the peak alpha and the colour differ.
 */
export function rimStops(): [number, number][] {
  return rayStops();
}

/**
 * The two side edges of a wedge, cut to exactly what the room left of it.
 *
 * The clipped polygons already contain those edges: a boundary segment belongs
 * to a side iff both of its endpoints lie on that side's line (through `a`,
 * resp. `b`, along `dir`). Collinear pieces — polyclip readily splits an edge
 * at a touching vertex, and an L-shaped room can cut a side into several
 * stretches — are projected onto `dir` and merged, so an unclipped wedge
 * yields exactly two segments and a clipped one the fewest that cover it.
 *
 * `eps` is in render units (the canvas is NORM_W = 1000 wide), comfortably
 * above polyclip's rounding and far below anything the eye could see.
 */
export function rayRimEdges(ray: SunRay, eps = 1e-4): number[][][] {
  const [dx, dy] = ray.dir;
  const nx = -dy;
  const ny = dx;
  const out: number[][][] = [];
  for (const src of [ray.a, ray.b]) {
    const spans: [number, number][] = [];
    for (const poly of ray.polys) {
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        // off the side's line? then this boundary edge is the source, the far
        // edge, or a wall the room cut the wedge with — not a side of the beam
        if (Math.abs((p[0] - src[0]) * nx + (p[1] - src[1]) * ny) > eps) continue;
        if (Math.abs((q[0] - src[0]) * nx + (q[1] - src[1]) * ny) > eps) continue;
        const up = (p[0] - src[0]) * dx + (p[1] - src[1]) * dy;
        const uq = (q[0] - src[0]) * dx + (q[1] - src[1]) * dy;
        if (Math.abs(uq - up) <= eps) continue; // degenerate sliver
        spans.push(up < uq ? [up, uq] : [uq, up]);
      }
    }
    spans.sort((s, t) => s[0] - t[0]);
    const merged: [number, number][] = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1] + eps) last[1] = Math.max(last[1], s[1]);
      else merged.push([s[0], s[1]]);
    }
    for (const [u0, u1] of merged) {
      out.push([
        [src[0] + dx * u0, src[1] + dy * u0],
        [src[0] + dx * u1, src[1] + dy * u1],
      ]);
    }
  }
  return out;
}

/**
 * Day/night sky: how far the painted sky may drift from the real sun before
 * the card stops gliding and simply JUMPS to the right colour.
 *
 * The stage colour is delivered by a 45 s CSS transition, and a transition only
 * advances while the card is actually painting. A card that was not painting —
 * a background tab, another dashboard view, a sleeping wall tablet — comes back
 * with a stale sky and then crawls toward the truth 45 s at a time, which is
 * exactly the owner's 2026-08-04 report («цвет фона не меняется сам с течением
 * времени суток, только после обновления страницы»: a reload paints the right
 * colour outright, because a freshly mounted element has nothing to transition
 * FROM). The sun never moves more than ~1° between two `sun.sun` updates (HA
 * refreshes the position every 4 minutes by day), so a gap this big can only
 * mean "we were not watching" — catch up at once, then breathe again.
 */
export const SKY_SNAP_DEG = 3;

/** Should the sky jump rather than glide from `prev`° to `next`°? */
export function skyNeedsSnap(prev: number | null, next: number): boolean {
  return prev === null || !Number.isFinite(prev)
    || Math.abs(next - prev) >= SKY_SNAP_DEG;
}

/**
 * Sky granularity: the elevation the background is computed from, rounded to
 * 0.1°. Finer than the eye can tell on a 45 s glide, and it keeps `dayPhase`
 * (and therefore the style attribute lit has to commit) from churning on every
 * hass tick while the ray GEOMETRY keeps its own, coarser memo.
 */
export function skyElevation(elevation: number): number {
  return Math.round((Number(elevation) || 0) * 10) / 10;
}

// ---------------- settings inheritance (global → space) ----------------

const intDeg = (v: any): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 359 ? v : null;

/** Effective compass: the space override wins, null = feature inert. */
export function northDegOf(settings: any, spaceSettings: any): number | null {
  const sp = intDeg(spaceSettings?.north_deg);
  if (sp !== null) return sp;
  return intDeg(settings?.north_deg);
}

export type BgMode = 'static' | 'daynight';

/** Effective background mode; anything unknown falls back to 'static'. */
export function bgModeOf(settings: any, spaceSettings: any): BgMode {
  const pick = (v: any): BgMode | null => (v === 'static' || v === 'daynight' ? v : null);
  return pick(spaceSettings?.bg_mode) ?? pick(settings?.bg_mode) ?? 'static';
}

/** Effective «sun in the windows» flag; default OFF (docs/SUN.md). */
export function sunRaysOn(settings: any, spaceSettings: any): boolean {
  const sp = spaceSettings?.sun_rays;
  if (typeof sp === 'boolean') return sp;
  return settings?.sun_rays === true;
}

/** Read sun.sun out of a hass-like object; null when absent/garbage. */
export function sunStateOf(hass: any): { azimuth: number; elevation: number } | null {
  const attrs = hass?.states?.['sun.sun']?.attributes;
  const az = Number(attrs?.azimuth);
  const el = Number(attrs?.elevation);
  return Number.isFinite(az) && Number.isFinite(el) ? { azimuth: az, elevation: el } : null;
}
