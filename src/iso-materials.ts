/**
 * #649 (docs/ISOMETRIC.md, Stage 6): presentation colours of the 2.5D View
 * that follow the user's data, never the Home Assistant theme.
 *
 * - Walls: the UI Lab's explicit top/side colours follow the space's wall
 *   hatching/fill settings respectively. Single-colour callers retain the
 *   legacy material with darker side faces.
 * - Floor lightness: relative luma of the room floor (its fill composited over
 *   the plan paper) decides the "light floor" variants of tile shadows and
 *   window light (lab: luma > 0.55).
 *
 * Pure: no DOM, no theme input. The card writes the result as CSS variables
 * on the 2.5D stage only; Flat never reads them.
 */

export type Rgb = readonly [number, number, number];

export interface IsoLightFloorMemo {
  readonly key: string;
  readonly rooms: ReadonlySet<string>;
}

/** `#rgb` / `#rrggbb` → 0..255 channels, or null for anything else. */
export function parseHexColor(value: unknown): Rgb | null {
  const text = String(value ?? '').trim();
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(text);
  if (short) return [short[1], short[2], short[3]].map((d) => parseInt(d + d, 16)) as unknown as Rgb;
  const long = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(text);
  return long ? [long[1], long[2], long[3]].map((d) => parseInt(d, 16)) as unknown as Rgb : null;
}

const hex = (rgb: Rgb): string => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c)))
  .toString(16).padStart(2, '0')).join('')}`;
const scale = (rgb: Rgb, k: number): Rgb => [rgb[0] * k, rgb[1] * k, rgb[2] * k];

/** Lab formula (sRGB, not linearised), 0..1. */
export function colorLuma(rgb: Rgb): number {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

export const ISO_LIGHT_FLOOR_LUMA = 0.55;

/** Effective floor colour: `fill` at `opacity` over the paper (null fill = paper). */
export function compositeFloor(fill: Rgb | null, opacity: number, paper: Rgb): Rgb {
  if (!fill) return paper;
  const a = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 1));
  return [0, 1, 2].map((i) => fill[i] * a + paper[i] * (1 - a)) as unknown as Rgb;
}

export function isLightFloor(floor: Rgb): boolean {
  return colorLuma(floor) > ISO_LIGHT_FLOOR_LUMA;
}

/** Per-channel multipliers of the wall faces (ТЗ #649 п.3b). */
export const ISO_WALL_TOP_LO = 0.93;
export const ISO_WALL_SIDE = [0.77, 0.68, 0.6] as const;

export interface IsoWallMaterial {
  topHi: string;
  topLo: string;
  sideHi: string;
  sideMid: string;
  sideLo: string;
}

export function isoWallMaterial(topColor: unknown, sideColor?: unknown, topOpacity = 1): IsoWallMaterial {
  const base = parseHexColor(topColor) ?? [255, 255, 255];
  const side = parseHexColor(sideColor);
  const strength = Number.isFinite(topOpacity) ? Math.min(1, Math.max(0, topOpacity)) : 1;
  const onWhite = (rgb: Rgb) => hex([
    255 + (rgb[0] - 255) * strength,
    255 + (rgb[1] - 255) * strength,
    255 + (rgb[2] - 255) * strength,
  ]);
  return {
    topHi: onWhite(base),
    topLo: onWhite(scale(base, ISO_WALL_TOP_LO)),
    sideHi: hex(side ? scale(side, 1.12) : scale(base, ISO_WALL_SIDE[0])),
    sideMid: hex(side ?? scale(base, ISO_WALL_SIDE[1])),
    sideLo: hex(side ? scale(side, .88) : scale(base, ISO_WALL_SIDE[2])),
  };
}

/** CSS custom properties for the 2.5D stage style attribute. */
export function isoWallMaterialVars(topColor: unknown, sideColor?: unknown, topOpacity = 1): string {
  const m = isoWallMaterial(topColor, sideColor, topOpacity);
  return `--iso-top-hi:${m.topHi};--iso-top-lo:${m.topLo};--iso-side-hi:${m.sideHi};`
    + `--iso-side-mid:${m.sideMid};--iso-side-lo:${m.sideLo}`;
}

/** An adjustable tint over the original white materials. White is a no-op;
 * shading between frames, leaves and reveals remains visible. */
export function isoOpeningMaterialVars(accent: unknown, opacity = 1): Record<string, string> {
  const color = parseHexColor(accent) ?? [255, 255, 255];
  const a = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;
  return Object.fromEntries(Object.entries({
    leaf: '#f1f2ef', frame: '#c2cfd2', edge: '#bec5c5',
    'window-frame': '#f3f4f0', 'door-frame': '#e9ece8', reveal: '#8b8d8c',
    'sill-side': '#e6e8e3', 'sill-top': '#fffefa',
  }).map(([name, base]) => [`--iso-opening-${name}`,
    hex(parseHexColor(base)!.map((channel, i) => channel * (1 - a + a * color[i] / 255)) as unknown as Rgb)]));
}

/** `#hex` or `rgb(a)(r, g, b …)` as computed styles report it; anything else → null. */
export function parseCssColor(value: unknown): Rgb | null {
  const hexRgb = parseHexColor(value);
  if (hexRgb) return hexRgb;
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(String(value ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Rooms whose floor reads as light (ТЗ #649 «Светлый пол»): the resolved room
 * fill at its opacity over the plan paper; a room without a fill is the paper.
 */
export function isoLightFloorRooms(
  fills: ReadonlyMap<string, { color: string; opacity: number } | null>,
  paper: Rgb,
): Set<string> {
  const light = new Set<string>();
  for (const [id, fill] of fills) {
    const floor = compositeFloor(fill ? parseCssColor(fill.color) : null, fill?.opacity ?? 1, paper);
    if (isLightFloor(floor)) light.add(id);
  }
  return light;
}

/**
 * #654: one pure memo boundary for the render hot path. The key contains every
 * observable input (room ids/order, resolved fill and paper), so HA state churn
 * that leaves the floor presentation unchanged reuses the same Set instance.
 */
export function memoIsoLightFloorRooms(
  previous: IsoLightFloorMemo | null,
  fills: ReadonlyMap<string, { color: string; opacity: number } | null>,
  paper: Rgb,
): IsoLightFloorMemo {
  const key = `${paper.join(',')}|${[...fills].map(([id, fill]) =>
    `${id}:${fill?.color ?? ''}:${fill?.opacity ?? ''}`).join('|')}`;
  return previous?.key === key
    ? previous
    : { key, rooms: isoLightFloorRooms(fills, paper) };
}
