/**
 * Sun on the plan — pure logic only (docs/SUN.md).
 *
 * Angles, the day phase palette, exterior-wall detection, window light
 * wedges and their clipping, the cloud factor and the settings
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

/** Does the sun actually shine INTO this window right now? (A grazing sun
 * exactly along the wall does not count — hence the epsilon, which also
 * swallows the sin/cos float dust of the right-angle directions.) */
export function windowLit(normal: number[], sunDir: number[], elevation: number): boolean {
  return elevation > 0 && normal[0] * sunDir[0] + normal[1] * sunDir[1] > 1e-9;
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

/** The unclipped wedge: window span a-b extruded by `len` along `dir`. */
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
  /** Window span endpoints (the bright end of the gradient). */
  a: number[];
  b: number[];
  /** Direction the light travels (AWAY from the sun), unit vector. */
  dir: [number, number];
  /** Wedge reach in render units (the gradient's fade distance). */
  len: number;
}

/**
 * All wedges of a space for one sun position. Pure and deterministic — the
 * card memoises the result on (azimuth, elevation, config rev) and reuses
 * it across hass ticks (docs/SUN.md). Mutual shading of building wings is
 * NOT considered (documented limit).
 */
export function computeSunRays(
  rooms: SunRoom[],
  windows: SunWindow[],
  azimuth: number,
  elevation: number,
  northDeg: number,
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
    const rad = (w.angle * Math.PI) / 180;
    const hx = (Math.cos(rad) * w.length) / 2;
    const hy = (Math.sin(rad) * w.length) / 2;
    const a = [w.x - hx, w.y - hy];
    const b = [w.x + hx, w.y + hy];
    const len = k * w.length;
    const polys = clipToRoom(rayQuad(a, b, away, len), room.poly);
    if (!polys.length) continue;
    out.push({ openingId: w.id, roomId: info.roomId, polys, a, b, dir: away, len });
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

/**
 * Full-strength wedge opacity for the current cloud cover — elevation plays
 * no part. The card feeds this into the gradient and lets CSS fade the layer,
 * so a wedge dissolving at the threshold keeps its colour while it goes.
 */
export function rayPeakAlpha(cloud = 1): number {
  return RAY_MAX_ALPHA * clamp01(cloud);
}

/** Wedge opacity: nothing below the threshold, full strength above it. */
export function rayAlpha(elevation: number, cloud = 1): number {
  return raysVisible(elevation) ? rayPeakAlpha(cloud) : 0;
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
 * Convex ease-out — bright at the glass, half gone by a third of the way,
 * a whisper at two thirds, nothing from RAY_FADE_END on. Consumed by the card
 * as SVG <stop>s over the FULL wedge length, so the geometry and the gradient
 * always describe the same shaft (docs/SUN.md).
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

/**
 * Blur radius (render units) that feathers a wedge's own edges. The wedge is a
 * polygon: without this its SIDES are razor-sharp lines across the floor, and
 * where the room outline clips it — an opposite wall, an L-corner, an OPEN
 * boundary with no wall drawn at all — the shaft is chopped at whatever alpha
 * it still had. Blurring the wedge and only then clipping it to the room keeps
 * the light inside the walls (it never leaks through them) while the visible
 * kerb becomes a soft ramp: light landing ON the wall, not a cut-out shape.
 */
export function raySoftness(len: number): number {
  return Math.max(3, Math.min(18, len * 0.07));
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

// ---------------- cloud cover ----------------

/** weather.* state → wedge opacity multiplier (docs/SUN.md table). */
const CLOUD_FACTORS: Record<string, number> = {
  'clear': 1, 'sunny': 1, 'clear-night': 1, 'windy': 1, 'exceptional': 1,
  'partlycloudy': 0.7, 'windy-variant': 0.7,
  'cloudy': 0.4,
  'overcast': 0.25, 'fog': 0.25,
  'rainy': 0, 'pouring': 0, 'snowy': 0, 'snowy-rainy': 0,
  'hail': 0, 'lightning': 0, 'lightning-rainy': 0,
};

/**
 * Cloud multiplier for a weather entity state. Unset entity, unknown state
 * or a dead sensor → 1: a broken weather sensor must not kill the sun.
 */
export function cloudFactor(state: string | null | undefined): number {
  if (!state) return 1;
  const f = CLOUD_FACTORS[String(state).toLowerCase()];
  return f === undefined ? 1 : f;
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

/** The optional weather entity (GLOBAL settings only). */
export function weatherEntityOf(settings: any): string | null {
  const v = settings?.weather_entity;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Read sun.sun out of a hass-like object; null when absent/garbage. */
export function sunStateOf(hass: any): { azimuth: number; elevation: number } | null {
  const attrs = hass?.states?.['sun.sun']?.attributes;
  const az = Number(attrs?.azimuth);
  const el = Number(attrs?.elevation);
  return Number.isFinite(az) && Number.isFinite(el) ? { azimuth: az, elevation: el } : null;
}
