/**
 * The moon behind the plan (#661; with any background since #718): pure
 * astronomy, visibility rules, the status line and the phase mask. No DOM, no
 * Lit — the lazy `moon-runtime` chunk renders from these, unit tests call them
 * directly.
 *
 * Home Assistant publishes no moon altitude, so the card computes it from
 * `hass.config.latitude/longitude` and the browser clock: the short Meeus
 * series (as in SunCalc) plus the topocentric parallax, without refraction.
 * Checked against JPL Horizons (airless) on the twelve points of the issue:
 * altitude within 1.5°, illumination within 2.5 percentage points.
 */
import type { DayCyclePhase, DayCycleSource } from './sun';

/**
 * C1: the same 3° as the window rays (`RAY_ELEVATION_MIN`), so both lights
 * obey one horizon. A literal, not an import: every name the lazy chunk takes
 * from the initial graph is one more export there (test/moon.test.mjs pins it).
 */
export const MOON_ELEVATION_MIN = 3;
/** C1: a thinner crescent reads as a scratch on a wall tablet. */
export const MOON_MIN_ILLUMINATION = 0.03;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const OBLIQUITY = RAD * 23.4397;
const EARTH_RADIUS_KM = 6378.14;
const SUN_DISTANCE_KM = 149_598_000;

const daysSinceJ2000 = (date: Date): number => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;

const rightAscension = (l: number, b: number): number =>
  Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));

const declination = (l: number, b: number): number =>
  Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));

interface Equatorial { ra: number; dec: number; dist: number }

/** Geocentric moon: the short Meeus series, degrees per day as in SunCalc. */
function moonCoords(d: number): Equatorial {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385_001 - 20_905 * Math.cos(M) };
}

function sunCoords(d: number): Equatorial {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  return { ra: rightAscension(L, 0), dec: declination(L, 0), dist: SUN_DISTANCE_KM };
}

export interface MoonPosition {
  /** Topocentric altitude, degrees, airless (no refraction). */
  altitude: number;
  /** Degrees clockwise from north. */
  azimuth: number;
}

/** C2: topocentric altitude/azimuth; the parallax `h − π·cos h` matters by the horizon. */
export function moonPosition(date: Date, latitude: number, longitude: number): MoonPosition {
  const d = daysSinceJ2000(date);
  const phi = RAD * latitude;
  const c = moonCoords(d);
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * longitude - c.ra;
  const geocentric = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  const parallax = Math.asin(EARTH_RADIUS_KM / c.dist);
  const altitude = geocentric - parallax * Math.cos(geocentric);
  const south = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
  return {
    altitude: altitude / RAD,
    azimuth: (((south / RAD + 180) % 360) + 360) % 360,
  };
}

export interface MoonIllumination {
  /** Illuminated fraction k, 0…1, from the Sun–Moon elongation. */
  fraction: number;
  /** Growing towards full; by the sign of the bright limb's position angle. */
  waxing: boolean;
}

/** C2: `k = (1 + cos i) / 2`; independent of where on Earth the plan is. */
export function moonIllumination(date: Date): MoonIllumination {
  const d = daysSinceJ2000(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const elongation = Math.acos(Math.sin(s.dec) * Math.sin(m.dec)
    + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(s.dist * Math.sin(elongation), m.dist - s.dist * Math.cos(elongation));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { fraction: (1 + Math.cos(inc)) / 2, waxing: angle < 0 };
}

/** C1 thresholds on an already computed sky: the environment phase, 3° and 3 %. */
export function moonShownAt(phase: DayCyclePhase, altitude: number, fraction: number): boolean {
  return phase !== 'day' && altitude >= MOON_ELEVATION_MIN && fraction >= MOON_MIN_ILLUMINATION;
}

export interface MoonView {
  visible: boolean;
  /** Illuminated fraction quantised to 0.01: the render changes only with the fingerprint (C3). */
  k: number;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * C1 (#718 K1): the card is the gate for the rest — a View surface, any
 * background; `phase` is `resolveDayCycle` whether or not an environment is
 * drawn. `settings` are the global settings, `config` is `hass.config`.
 */
export function moonView(settings: unknown, phase: DayCyclePhase, config: unknown, now: Date): MoonView {
  const { fraction } = moonIllumination(now);
  const k = Math.round(fraction * 100) / 100;
  const { latitude, longitude } = (config ?? {}) as { latitude?: unknown; longitude?: unknown };
  if ((settings as { moon?: unknown } | null | undefined)?.moon !== true
      || !finite(latitude) || !finite(longitude)) return { visible: false, k };
  return { visible: moonShownAt(phase, moonPosition(now, latitude, longitude).altitude, fraction), k };
}

/** #718 K7: why the moon is or is not shown — the first reason that holds, in this order. */
export type MoonStatusReason = 'shown' | 'no_home' | 'day_sun' | 'day_clock' | 'low' | 'new';

/** The reason with its numbers already rounded: the dialog only puts them into the text. */
export interface MoonStatus {
  reason: MoonStatusReason;
  /** Moon altitude, whole degrees (`shown`, `low`). */
  alt?: number;
  /** Illuminated share, whole per cent (`shown`, `new`). */
  pct?: number;
  /** The `sun.sun` elevation, whole degrees (`day_sun`). */
  sun?: number;
}

/** The sky the status is judged on, as ready numbers (AC9). */
export interface MoonSky {
  /** Finite `hass.config.latitude/longitude`. */
  home: boolean;
  phase: DayCyclePhase;
  source: DayCycleSource;
  /** `sun.sun` elevation; null without it. */
  sun: number | null;
  altitude: number;
  fraction: number;
}

/**
 * #718 K7/K8: no home, day, below 3°, under 3 % — the first that holds; else
 * shown, decided by the same `moonShownAt` as the element. A hidden reason
 * never shows the threshold it missed: «at 3°, shows from 3°» reads as a bug,
 * so its number stops at 2.
 */
export function moonStatusOf(sky: MoonSky): MoonStatus {
  if (!sky.home) return { reason: 'no_home' };
  if (sky.phase === 'day') return sky.source === 'sun' ? { reason: 'day_sun', sun: Math.round(sky.sun ?? 0) } : { reason: 'day_clock' };
  const alt = Math.round(sky.altitude);
  const pct = Math.round(sky.fraction * 100);
  if (moonShownAt(sky.phase, sky.altitude, sky.fraction)) return { reason: 'shown', alt, pct };
  return sky.altitude < MOON_ELEVATION_MIN ? { reason: 'low', alt: Math.min(alt, 2) } : { reason: 'new', pct: Math.min(pct, 2) };
}

/**
 * #718 K7: the status for `hass.config` and a day-cycle sample taken at `now`,
 * as if the switch were on — the moon no longer depends on the background, so
 * one status serves the whole installation. `sun` is the `sun.sun` elevation.
 */
export function moonStatus(
  config: unknown, state: { phase: DayCyclePhase; source: DayCycleSource }, sun: number | null, now: Date,
): MoonStatus {
  const { latitude, longitude } = (config ?? {}) as { latitude?: unknown; longitude?: unknown };
  const home = finite(latitude) && finite(longitude);
  return moonStatusOf({
    home, phase: state.phase, source: state.source, sun,
    altitude: home ? moonPosition(now, latitude, longitude).altitude : 0,
    fraction: moonIllumination(now).fraction,
  });
}

/** C3: equal fingerprint → no re-render. The lit side is fixed, so k is all the shape. */
export function moonFingerprint(view: MoonView): string {
  return `${view.visible ? 1 : 0}|${view.k.toFixed(2)}`;
}

/** Disc of the designer's pack: `viewBox 0 0 512 512`, centre 256, radius 240. */
export const MOON_BOX = 512;
export const MOON_R = 240;
/** Below this the terminator is feathered in the mask; a full disc keeps the art's own edge. */
export const MOON_SHARP_FROM = 0.995;

/**
 * C5, owner 2026-09-29: the lit side is always the LEFT one, in both
 * hemispheres; waning runs the waxing states backwards. The lit region is the
 * left half of the box (its outer arc runs along the box, r 256, never along
 * the limb, so the art keeps its anti-aliased edge) plus or minus the
 * terminator half-ellipse `R × R·|2k−1|`: bulging right when k > 0.5.
 */
export function moonPhasePath(k: number): string {
  const c = MOON_BOX / 2;
  const top = c - MOON_R;
  const bottom = c + MOON_R;
  const rx = MOON_R * Math.abs(2 * Math.min(1, Math.max(0, k)) - 1);
  const terminator = rx < 0.5
    ? `L${c} ${top}`
    : `A${rx.toFixed(2)} ${MOON_R} 0 0 ${k > 0.5 ? 0 : 1} ${c} ${top}`;
  return `M${c} 0A${c} ${c} 0 0 0 ${c} ${MOON_BOX}L${c} ${bottom}${terminator}L${c} 0Z`;
}
