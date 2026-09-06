/**
 * The furniture library of the decor layer (docs/FURNITURE.md).
 *
 * Pure geometry and pure data: no Lit, no DOM, no `hass`. Everything here is
 * unit-testable, and the card only turns the output into one `<path>`.
 *
 * WHY OUR OWN SYMBOLS AND NOT AN ICON SET. Every general-purpose icon pack —
 * mdi included, and it is already in this bundle — draws a PICTOGRAM: a sofa
 * seen from the front, inside a 24x24 square. A plan is drawn from ABOVE and
 * to SCALE: a sofa is a 2.2 x 0.9 m rectangle with a back along one long
 * side. Putting a 24x24 pictogram into that rectangle stretches a drawing
 * that was never meant to be stretched, and the result reads as an icon lying
 * on the floor, not as a piece of furniture. The primary library is therefore
 * generated from House Plan's own top-view SVG pack. A small compatibility
 * set that is absent from the pack stays expressed as unit-box primitives.
 * Both forms resolve to one path plus its native coordinate box; the renderer
 * scales that box to the stored real-world size. The renderer keeps the
 * configured decor stroke stable through that local non-uniform transform,
 * while `furniturePlanScreenScale` restores the outer physical plan zoom.
 *
 * THE CONVENTION EVERY SYMBOL OBEYS:
 *   - x points right and y points DOWN (SVG); generated art keeps its native
 *     viewBox while legacy primitives use `0..1 x 0..1`;
 *   - `y = 0` is the BACK of the object — the side that goes against a wall.
 *     That is what makes the wall magnet meaningful: a sofa's back, a bed's
 *     headboard, a wardrobe's rear panel and a worktop's edge all mean the
 *     same thing to the furniture wall-placement helper;
 *   - nothing is filled. The card strokes the whole symbol in the decor
 *     colour, so a plan stays a drawing (owner: «символы рисуются линейно»).
 */

import { NORM_W, GRID_PITCH, CANVAS_LIMIT } from './space-geometry';
import { GENERATED_FURNITURE_CATALOG } from './furniture-plan-catalog.generated';
import { FURNITURE_ART_RUNTIME, type FurnitureArtHost } from './furniture-art-runtime';

/** Groups the palette shows, in the order it shows them. */
export const FURNITURE_GROUPS = ['furniture', 'appliance', 'sanitary', 'other'] as const;
export type FurnitureGroup = (typeof FURNITURE_GROUPS)[number];

/**
 * A drawing primitive in the unit box. Deliberately tiny — four shapes are
 * enough for a plan symbol, and each one maps to a couple of path commands,
 * so a symbol costs a few dozen bytes in the bundle instead of a kilobyte of
 * Inkscape output.
 *
 *   ['r', x, y, w, h]                 rectangle
 *   ['l', x1, y1, x2, y2]             line
 *   ['e', cx, cy, rx, ry]             ellipse
 *   ['p', x1, y1, x2, y2, ...]        open polyline (2 points or more)
 */
export type Prim =
  | ['r', number, number, number, number]
  | ['l', number, number, number, number]
  | ['e', number, number, number, number]
  | ['p', ...number[]];

export interface FurnitureSymbol {
  /** Stable id — it is what the config stores and what `data-symbol` carries. */
  id: string;
  group: FurnitureGroup;
  /** Category tile in the two-level editor palette. */
  category: string;
  /** Default REAL size in centimetres: width ALONG the back edge x depth. */
  w: number;
  h: number;
  /** Legacy drawing retained for symbols absent from the designer pack. */
  g?: Prim[];
  /** Designer symbol: its drawing lives in the lazy artwork chunk (#474). */
  designer?: true;
}

export interface FurnitureGraphic {
  d: string;
  viewW: number;
  viewH: number;
}

// The outline every boxy symbol starts from, named once so the table reads.
const box = (): Prim => ['r', 0, 0, 1, 1];

/**
 * The library. Sizes are the ones a European flat actually has; they are
 * DEFAULTS, not limits — the palette lets the user type over both numbers
 * before placing, and the corner handles change them afterwards.
 */
const LEGACY_FURNITURE: FurnitureSymbol[] = [
  // ------------------------------- мебель --------------------------------
  { id: 'sofa', group: 'furniture', category: 'sofa', w: 220, h: 90, g: [
    box(),
    ['l', 0.09, 0.26, 0.91, 0.26],   // the back cushion
    ['l', 0.09, 0.26, 0.09, 1],      // armrests
    ['l', 0.91, 0.26, 0.91, 1],
    ['l', 0.5, 0.26, 0.5, 1],        // two seats
  ] },
  { id: 'armchair', group: 'furniture', category: 'armchair', w: 90, h: 85, g: [
    box(),
    ['l', 0.14, 0.28, 0.86, 0.28],
    ['l', 0.14, 0.28, 0.14, 1],
    ['l', 0.86, 0.28, 0.86, 1],
  ] },
  { id: 'coffee_table', group: 'furniture', category: 'coffee_table', w: 110, h: 60, g: [
    box(), ['r', 0.08, 0.14, 0.84, 0.72],
  ] },
  { id: 'table_dining', group: 'furniture', category: 'dining_table', w: 140, h: 80, g: [
    box(), ['r', 0.06, 0.11, 0.88, 0.78],
  ] },
  { id: 'table_round', group: 'furniture', category: 'dining_table', w: 120, h: 120, g: [
    ['e', 0.5, 0.5, 0.5, 0.5], ['e', 0.5, 0.5, 0.41, 0.41],
  ] },
  { id: 'chair', group: 'furniture', category: 'chair', w: 45, h: 45, g: [
    ['r', 0, 0, 1, 0.18],            // the back
    ['r', 0.06, 0.18, 0.88, 0.8],    // the seat
  ] },
  { id: 'desk', group: 'furniture', category: 'work_table', w: 120, h: 60, g: [
    box(),
    ['r', 0.63, 0.07, 0.31, 0.86],   // the drawer pedestal
    ['l', 0.63, 0.5, 0.94, 0.5],
  ] },
  { id: 'bed_double', group: 'furniture', category: 'bed', w: 160, h: 200, g: [
    box(),
    ['r', 0, 0, 1, 0.07],            // the headboard, i.e. the back
    ['r', 0.06, 0.1, 0.4, 0.15],     // two pillows
    ['r', 0.54, 0.1, 0.4, 0.15],
    ['l', 0, 0.33, 1, 0.33],         // the turned-down blanket
  ] },
  { id: 'bed_single', group: 'furniture', category: 'bed', w: 90, h: 200, g: [
    box(),
    ['r', 0, 0, 1, 0.07],
    ['r', 0.15, 0.1, 0.7, 0.15],
    ['l', 0, 0.33, 1, 0.33],
  ] },
  { id: 'nightstand', group: 'furniture', category: 'nightstand', w: 45, h: 40, g: [
    box(), ['r', 0.12, 0.14, 0.76, 0.33], ['r', 0.12, 0.53, 0.76, 0.33],
  ] },
  { id: 'wardrobe', group: 'furniture', category: 'wardrobe', w: 100, h: 60, g: [
    box(),
    ['l', 0, 0.72, 1, 0.72],         // the hanging rail
    ['l', 0.5, 0.72, 0.5, 1],        // the doors meet here
  ] },
  { id: 'bookshelf', group: 'furniture', category: 'wardrobe', w: 80, h: 30, g: [
    box(), ['l', 0.34, 0, 0.34, 1], ['l', 0.67, 0, 0.67, 1],
  ] },

  // ------------------------------- техника -------------------------------
  { id: 'fridge', group: 'appliance', category: 'fridge', w: 60, h: 65, g: [
    box(),
    ['l', 0, 0.36, 1, 0.36],         // freezer / fridge
    ['l', 0.83, 0.44, 0.83, 0.64],   // the handle
  ] },
  { id: 'stove', group: 'appliance', category: 'cooktop', w: 60, h: 60, g: [
    box(),
    ['e', 0.29, 0.31, 0.15, 0.15], ['e', 0.71, 0.31, 0.15, 0.15],
    ['e', 0.29, 0.71, 0.15, 0.15], ['e', 0.71, 0.71, 0.15, 0.15],
  ] },
  { id: 'dishwasher', group: 'appliance', category: 'dishwasher', w: 60, h: 60, g: [
    box(),
    ['r', 0.1, 0.12, 0.8, 0.76],
    ['e', 0.5, 0.5, 0.27, 0.27], ['e', 0.5, 0.5, 0.13, 0.13],  // plates
  ] },
  { id: 'washer', group: 'appliance', category: 'washer', w: 60, h: 60, g: [
    box(),
    ['l', 0.08, 0.17, 0.92, 0.17],   // the control panel
    ['e', 0.5, 0.57, 0.3, 0.3], ['e', 0.5, 0.57, 0.14, 0.14],  // the drum
  ] },
  { id: 'dryer', group: 'appliance', category: 'dryer', w: 60, h: 60, g: [
    box(),
    ['l', 0.08, 0.17, 0.92, 0.17],
    ['e', 0.5, 0.57, 0.3, 0.3],
    ['p', 0.36, 0.5, 0.5, 0.64, 0.64, 0.5],  // the chevron that is not a drum
  ] },
  { id: 'tv', group: 'appliance', category: 'tv', w: 120, h: 30, g: [
    ['r', 0, 0, 1, 0.42],            // the screen, seen edge-on
    ['l', 0.5, 0.42, 0.5, 0.72],
    ['l', 0.3, 0.72, 0.7, 0.72],     // the stand
  ] },
  { id: 'ac', group: 'appliance', category: 'air_conditioner', w: 90, h: 25, g: [
    box(), ['l', 0.05, 0.55, 0.95, 0.55], ['l', 0.05, 0.79, 0.95, 0.79],
  ] },
  { id: 'water_heater', group: 'appliance', category: 'boiler', w: 45, h: 45, g: [
    ['e', 0.5, 0.5, 0.5, 0.5], ['e', 0.5, 0.5, 0.31, 0.31],
  ] },

  // ----------------------------- сантехника ------------------------------
  { id: 'toilet', group: 'sanitary', category: 'toilet', w: 40, h: 70, g: [
    ['r', 0.06, 0, 0.88, 0.2],       // the cistern, against the wall
    ['e', 0.5, 0.58, 0.37, 0.35],    // the bowl
    ['e', 0.5, 0.58, 0.22, 0.2],
  ] },
  { id: 'bathtub', group: 'sanitary', category: 'bathtub', w: 170, h: 75, g: [
    box(),
    ['r', 0.05, 0.11, 0.77, 0.78],
    ['e', 0.89, 0.5, 0.045, 0.1],    // the drain end
  ] },
  { id: 'shower', group: 'sanitary', category: 'shower', w: 90, h: 90, g: [
    box(),
    ['l', 0, 0, 1, 1], ['l', 1, 0, 0, 1],   // the tray, as every plan draws it
    ['e', 0.5, 0.5, 0.08, 0.08],
  ] },
  { id: 'sink', group: 'sanitary', category: 'sink', w: 60, h: 45, g: [
    box(),
    ['e', 0.5, 0.6, 0.34, 0.3],
    ['e', 0.5, 0.15, 0.07, 0.07],    // the tap
  ] },
  { id: 'kitchen_sink', group: 'sanitary', category: 'kitchen_sink', w: 80, h: 60, g: [
    box(),
    ['r', 0.06, 0.24, 0.44, 0.64],
    ['r', 0.54, 0.24, 0.4, 0.64],
    ['e', 0.5, 0.12, 0.06, 0.06],
  ] },
  { id: 'bidet', group: 'sanitary', category: 'bidet', w: 40, h: 55, g: [
    ['e', 0.5, 0.5, 0.44, 0.5], ['e', 0.5, 0.5, 0.26, 0.3],
  ] },

  // ------------------------------- прочее --------------------------------
  { id: 'stairs', group: 'other', category: 'stairs', w: 100, h: 280, g: [
    box(),
    ['l', 0, 0.111, 1, 0.111], ['l', 0, 0.222, 1, 0.222], ['l', 0, 0.333, 1, 0.333],
    ['l', 0, 0.444, 1, 0.444], ['l', 0, 0.556, 1, 0.556], ['l', 0, 0.667, 1, 0.667],
    ['l', 0, 0.778, 1, 0.778], ['l', 0, 0.889, 1, 0.889],
    ['l', 0.5, 0.93, 0.5, 0.06],               // the "up" arrow
    ['p', 0.38, 0.16, 0.5, 0.06, 0.62, 0.16],
  ] },
  { id: 'fireplace', group: 'other', category: 'fireplace', w: 120, h: 40, g: [
    box(), ['p', 0.22, 1, 0.22, 0.42, 0.78, 0.42, 0.78, 1],
  ] },
  { id: 'plant', group: 'other', category: 'plant', w: 40, h: 40, g: [
    ['e', 0.5, 0.5, 0.22, 0.22],
    ['l', 0.5, 0.28, 0.5, 0.02], ['l', 0.5, 0.72, 0.5, 0.98],
    ['l', 0.28, 0.5, 0.02, 0.5], ['l', 0.72, 0.5, 0.98, 0.5],
    ['l', 0.34, 0.34, 0.13, 0.13], ['l', 0.66, 0.66, 0.87, 0.87],
    ['l', 0.66, 0.34, 0.87, 0.13], ['l', 0.34, 0.66, 0.13, 0.87],
  ] },
  { id: 'rug', group: 'other', category: 'rug', w: 200, h: 140, g: [
    box(), ['r', 0.06, 0.09, 0.88, 0.82],
  ] },
];

const RETAINED_IDS = new Set([
  'fridge', 'dishwasher', 'washer', 'dryer', 'ac', 'water_heater',
  'shower', 'sink', 'stairs', 'fireplace', 'plant', 'rug',
]);

/** Complete public library: 44 designer symbols plus the 12 useful existing
 * symbols for which the pack intentionally has no top-view replacement. */
export const FURNITURE: FurnitureSymbol[] = [
  ...GENERATED_FURNITURE_CATALOG.map((symbol) => ({
    id: symbol.id,
    group: symbol.group as FurnitureGroup,
    category: symbol.category,
    w: symbol.w,
    h: symbol.h,
    designer: true as const,
  })),
  ...LEGACY_FURNITURE.filter((symbol) => RETAINED_IDS.has(symbol.id)),
];

const BY_ID = new Map(FURNITURE.map((s) => [s.id, s]));

/** The symbol with this id, or null. An unknown id is DATA, not a crash: a
 *  plan written by a newer card must still validate, save and simply render
 *  nothing in an older one. */
export function furnitureSymbol(id: string | null | undefined): FurnitureSymbol | null {
  return (id && BY_ID.get(id)) || null;
}

/** Designer symbol whose drawing is lazy (#474); legacy symbols draw eagerly. */
export function furnitureArtIsLazy(id: string): boolean {
  return BY_ID.get(id)?.designer === true;
}

/** The symbols of one group, in table order. */
export function furnitureOfGroup(group: FurnitureGroup): FurnitureSymbol[] {
  return FURNITURE.filter((s) => s.group === group);
}

/** Default real size (cm) of a symbol; an unknown id falls back to 60 x 60 —
 *  a box the user can immediately resize rather than an error. */
export function furnitureDefaultCm(id: string): { w: number; h: number } {
  const s = furnitureSymbol(id);
  return s ? { w: s.w, h: s.h } : { w: 60, h: 60 };
}

// ------------------------- centimetres <-> the canvas -----------------------

/**
 * Real centimetres -> a NORMALISED size on the canvas, through the space's
 * `cell_cm` — the one scale this card has (`_cmToUnits` and `segmentCm` are
 * the same conversion in render units). Kept pure and parameterised so a test
 * can state the arithmetic without a card.
 */
export function cmToNorm(cm: number, cellCm: number,
                         gridPitch: number = GRID_PITCH, normW: number = NORM_W): number {
  const c = Number(cellCm) > 0 ? Number(cellCm) : 5;
  return ((Number(cm) || 0) / c) * gridPitch / normW;
}

/** ...and back, for the size fields and the live badges. */
export function normToCm(v: number, cellCm: number,
                         gridPitch: number = GRID_PITCH, normW: number = NORM_W): number {
  const c = Number(cellCm) > 0 ? Number(cellCm) : 5;
  return (((Number(v) || 0) * normW) / gridPitch) * c;
}

/** A piece may not be smaller than a stroke or larger than the canvas guard.
 *  Both are garbage insurance, not opinions about furniture. */
export const FURN_MIN_N = 0.0005;   // half of a 1000-unit pixel
export const FURN_MAX_N = CANVAS_LIMIT;

export function clampFurnSize(n: number): number {
  if (!Number.isFinite(n)) return FURN_MIN_N;
  return Math.max(FURN_MIN_N, Math.min(FURN_MAX_N, n));
}

/** Real-size bounds for the palette's two fields: 1 cm ... 100 m. */
export const FURN_MIN_CM = 1;
export const FURN_MAX_CM = 10000;

export function clampFurnCm(cm: number): number {
  if (!Number.isFinite(cm)) return FURN_MIN_CM;
  return Math.max(FURN_MIN_CM, Math.min(FURN_MAX_CM, cm));
}

// ------------------------------ the drawing --------------------------------

const num = (v: number): string => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

/**
 * The symbol as ONE `d` string, in a box `w x h` whose top-left is `(0,0)`.
 *
 * One path per piece, not one element per primitive: the whole symbol then
 * takes a single stroke, a single pointer target and a single `data-symbol`,
 * and the decor layer's DOM does not grow by ten nodes per sofa.
 */
function primitivePathD(s: FurnitureSymbol, w: number, h: number): string {
  if (!s.g || !(w > 0) || !(h > 0)) return '';
  const X = (v: number) => num(v * w);
  const Y = (v: number) => num(v * h);
  const out: string[] = [];
  for (const p of s.g) {
    if (p[0] === 'r') {
      const [, x, y, pw, ph] = p;
      out.push(`M${X(x)} ${Y(y)}H${X(x + pw)}V${Y(y + ph)}H${X(x)}Z`);
    } else if (p[0] === 'l') {
      const [, x1, y1, x2, y2] = p;
      out.push(`M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}`);
    } else if (p[0] === 'e') {
      const [, cx, cy, rx, ry] = p;
      // two half-arcs: a full ellipse cannot be one A command
      out.push(`M${X(cx - rx)} ${Y(cy)}`
        + `A${num(rx * w)} ${num(ry * h)} 0 0 1 ${X(cx + rx)} ${Y(cy)}`
        + `A${num(rx * w)} ${num(ry * h)} 0 0 1 ${X(cx - rx)} ${Y(cy)}Z`);
    } else {
      const pts = p.slice(1) as number[];
      if (pts.length < 4) continue;
      let d = `M${X(pts[0])} ${Y(pts[1])}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${X(pts[i])} ${Y(pts[i + 1])}`;
      out.push(d);
    }
  }
  return out.join('');
}

/** Native one-path artwork and its coordinate box. The renderer scales this
 * box non-uniformly to the user's stored dimensions; the furniture stroke
 * helpers below separate that local scale from the outer plan camera. */
export function furnitureGraphic(id: string, host?: FurnitureArtHost): FurnitureGraphic | null {
  const symbol = furnitureSymbol(id);
  if (!symbol) return null;
  // Designer artwork is lazy (#474): `undefined` while the chunk is pending or
  // settled into fallback renders the piece as an unknown symbol — nothing —
  // and a host passed here is re-rendered once the runtime settles.
  if (symbol.designer) return FURNITURE_ART_RUNTIME.art(id, host) ?? null;
  const d = primitivePathD(symbol, 1, 1);
  return d ? { d, viewW: 1, viewH: 1 } : null;
}

/** Compatibility helper for callers that only need a path string. Designer
 * artwork remains in its native viewBox; use `furnitureGraphic` when sizing it. */
export function furniturePathD(id: string, w: number, h: number): string {
  const symbol = furnitureSymbol(id);
  if (!symbol || !(w > 0) || !(h > 0)) return '';
  if (symbol.designer) return FURNITURE_ART_RUNTIME.art(id)?.d || '';
  return primitivePathD(symbol, w, h);
}

/**
 * Uniform plan-user-unit -> CSS-pixel scale of the SVG viewport.
 *
 * Furniture artwork uses a local non-uniform transform for independent width
 * and depth. `vector-effect=non-scaling-stroke` correctly rejects that local
 * transform, but it also rejects the outer SVG viewBox camera. Supplying this
 * one outer scale as the path's stroke width restores the physical zoom while
 * keeping horizontal, vertical and diagonal artwork strokes equally thick.
 *
 * Invalid/zero layout is transient during first mount. Returning 1 is the
 * finite old-behaviour fallback; ResizeObserver requests the measured render
 * before the boot veil reveals the plan.
 */
export function furniturePlanScreenScale(
  viewportWidth: unknown,
  viewportHeight: unknown,
  viewBoxWidth: unknown,
  viewBoxHeight: unknown,
): number {
  const viewportW = Number(viewportWidth);
  const viewportH = Number(viewportHeight);
  const viewW = Number(viewBoxWidth);
  const viewH = Number(viewBoxHeight);
  if (![viewportW, viewportH, viewW, viewH].every((value) => Number.isFinite(value) && value > 0))
    return 1;
  const scale = Math.min(viewportW / viewW, viewportH / viewH);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** Physical furniture stroke expressed in CSS pixels for a non-scaling path. */
export function furnitureStrokePx(
  strokeUnits: unknown,
  planScreenScale: unknown,
  fallbackStrokeUnits = 1,
): number {
  const rawStroke = Number(strokeUnits);
  const fallback = Number(fallbackStrokeUnits);
  const stroke = Number.isFinite(rawStroke) && rawStroke > 0
    ? rawStroke
    : Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
  const rawScale = Number(planScreenScale);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const result = stroke * scale;
  return Number.isFinite(result) && result > 0 ? result : stroke;
}

/**
 * The four corners of a rotated box, world units, in the order the frame
 * draws them: NW, NE, SE, SW. Pure, so the frame, the gestures and the tests
 * all agree on where a corner is.
 */
export function furnitureCorners(
  x: number, y: number, w: number, h: number, angle: number,
): number[][] {
  const cx = x + w / 2, cy = y + h / 2;
  const a = ((Number(angle) || 0) * Math.PI) / 180;
  const cs = Math.cos(a), sn = Math.sin(a);
  const rot = (px: number, py: number): number[] => {
    const ux = px - cx, uy = py - cy;
    return [cx + ux * cs - uy * sn, cy + ux * sn + uy * cs];
  };
  return [rot(x, y), rot(x + w, y), rot(x + w, y + h), rot(x, y + h)];
}

/**
 * Resize by a dragged corner about the OPPOSITE one — the backdrop frame's
 * rule, but with WIDTH AND DEPTH INDEPENDENT.
 *
 * Why not uniform: a picture has one true aspect ratio and stretching it is a
 * lie, which is why the backdrop scales uniformly. Furniture is the opposite
 * case — the ratio is a fact about THIS sofa, and the next one is 1.8 m long
 * with the same 0.9 m depth. A uniform handle would force the user to make a
 * bed deeper in order to make it wider, i.e. to state something false about
 * the room. So both axes move, and the two live badges say what they became.
 *
 * `sgx/sgy` are the dragged corner as signs (+1 = the high side of the axis).
 * `px/py` is the pointer. `step > 0` quantises each dimension to the grid —
 * on an unrotated piece whose fixed corner sits on a node that also puts the
 * dragged corner on a node, which is what "snap to the grid" has to mean
 * here. The UI always passes a positive grid step; zero remains useful only
 * for pure geometry callers that intentionally request no quantisation.
 */
export function furnitureResize(
  orig: { x: number; y: number; w: number; h: number; angle?: number },
  sgx: number, sgy: number, px: number, py: number, step = 0, minSize = 1e-6,
): { x: number; y: number; w: number; h: number } {
  const a = ((Number(orig.angle) || 0) * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);          // local +x in world
  const vx = -Math.sin(a), vy = Math.cos(a);         // local +y in world
  const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
  // the fixed corner = the one opposite the dragged one
  const fLocalX = sgx > 0 ? -orig.w / 2 : orig.w / 2;
  const fLocalY = sgy > 0 ? -orig.h / 2 : orig.h / 2;
  const fx = cx + fLocalX * ux + fLocalY * vx;
  const fy = cy + fLocalX * uy + fLocalY * vy;
  // the pointer, expressed along the piece's own axes from that fixed corner
  const rx = px - fx, ry = py - fy;
  let w = (rx * ux + ry * uy) * (sgx > 0 ? 1 : -1);
  let h = (rx * vx + ry * vy) * (sgy > 0 ? 1 : -1);
  if (step > 0) {
    w = Math.round(w / step) * step;
    h = Math.round(h / step) * step;
  }
  w = Math.max(minSize, w);
  h = Math.max(minSize, h);
  // rebuild the centre from the fixed corner, then the UNROTATED top-left
  const ncx = fx + (sgx > 0 ? w / 2 : -w / 2) * ux + (sgy > 0 ? h / 2 : -h / 2) * vx;
  const ncy = fy + (sgx > 0 ? w / 2 : -w / 2) * uy + (sgy > 0 ? h / 2 : -h / 2) * vy;
  return { x: ncx - w / 2, y: ncy - h / 2, w, h };
}

export interface FurnitureTransformBox {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  flip_h?: boolean;
  flip_v?: boolean;
}

export interface FurnitureResizeResult extends FurnitureTransformBox {
  flip_h?: boolean;
  flip_v?: boolean;
}

/**
 * #383 — continuous furniture-only resize.
 *
 * `sgx`/`sgy` name the dragged local edge (-1, 0 or +1). Zero keeps that
 * axis byte-for-byte, which is how the four new middle handles work. Unlike
 * the legacy shared decor helper this function never snaps to the grid and a
 * signed pointer distance may cross the fixed opposite edge. The sign is
 * projected into flip flags; the returned extents remain strictly positive.
 */
export function resizeFurnitureTransform(
  orig: FurnitureTransformBox,
  sgx: number,
  sgy: number,
  px: number,
  py: number,
  keepAspect: boolean,
  minSize: number,
): FurnitureResizeResult {
  const minimum = Number.isFinite(minSize) && minSize > 0 ? minSize : 1e-6;
  const a = ((Number(orig.angle) || 0) * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const vx = -Math.sin(a), vy = Math.cos(a);
  const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
  const flx = sgx > 0 ? -orig.w / 2 : sgx < 0 ? orig.w / 2 : 0;
  const fly = sgy > 0 ? -orig.h / 2 : sgy < 0 ? orig.h / 2 : 0;
  const fx = cx + flx * ux + fly * vx;
  const fy = cy + flx * uy + fly * vy;
  const rx = px - fx, ry = py - fy;
  const rawW = sgx
    ? (rx * ux + ry * uy) * (sgx > 0 ? 1 : -1)
    : orig.w;
  const rawH = sgy
    ? (rx * vx + ry * vy) * (sgy > 0 ? 1 : -1)
    : orig.h;
  let w = sgx ? Math.abs(rawW) : orig.w;
  let h = sgy ? Math.abs(rawH) : orig.h;

  if (keepAspect && sgx && sgy) {
    const kx = w / Math.max(orig.w, minimum);
    const ky = h / Math.max(orig.h, minimum);
    // Follow whichever local pointer axis has moved farther from the original
    // scale. Equal deltas deliberately prefer width for deterministic ties.
    const scale = Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky;
    const floor = Math.max(minimum / orig.w, minimum / orig.h);
    const safeScale = Math.max(floor, Number.isFinite(scale) ? scale : floor);
    w = orig.w * safeScale;
    h = orig.h * safeScale;
  }
  w = Math.max(minimum, Number.isFinite(w) ? w : minimum);
  h = Math.max(minimum, Number.isFinite(h) ? h : minimum);

  const crossX = !!sgx && rawW < 0;
  const crossY = !!sgy && rawH < 0;
  const dirX = sgx ? (sgx > 0 ? 1 : -1) * (crossX ? -1 : 1) : 0;
  const dirY = sgy ? (sgy > 0 ? 1 : -1) * (crossY ? -1 : 1) : 0;
  const ncx = fx + dirX * (w / 2) * ux + dirY * (h / 2) * vx;
  const ncy = fy + dirX * (w / 2) * uy + dirY * (h / 2) * vy;
  const flipH = !!orig.flip_h !== crossX;
  const flipV = !!orig.flip_v !== crossY;
  return {
    x: ncx - w / 2,
    y: ncy - h / 2,
    w,
    h,
    ...(Number(orig.angle) ? { angle: Number(orig.angle) } : {}),
    ...(flipH ? { flip_h: true } : {}),
    ...(flipV ? { flip_v: true } : {}),
  };
}

/** Furniture is free by default; Shift snaps to world-space 45° bearings. */
export function furnitureRotationAngle(
  angle0: number,
  pointerStartDeg: number,
  pointerDeg: number,
  snap45: boolean,
): number {
  let angle = Number(angle0) + (Number(pointerDeg) - Number(pointerStartDeg));
  if (![angle, pointerStartDeg, pointerDeg].every(Number.isFinite)) angle = 0;
  if (snap45) {
    const steps = angle / 45;
    // Keep the exact half-step deterministic on both sides of zero. Native
    // Math.round(-0.5) returns -0, which would make symmetric drags snap in
    // different directions.
    angle = (steps < 0 ? -Math.round(Math.abs(steps)) : Math.round(steps)) * 45;
  }
  angle = ((angle % 360) + 360) % 360;
  return angle > 180 ? angle - 360 : angle;
}

/** One canonical transform for visible art, selection halo and future consumers. */
export function furnitureRenderTransform(
  shape: FurnitureTransformBox,
  canvasW: number,
  canvasH: number,
  artW: number,
  artH: number,
): string {
  const x = shape.x * canvasW, y = shape.y * canvasH;
  const w = shape.w * canvasW, h = shape.h * canvasH;
  const cx = x + w / 2, cy = y + h / 2;
  const tx = x + (shape.flip_h ? w : 0);
  const ty = y + (shape.flip_v ? h : 0);
  const sx = (shape.flip_h ? -1 : 1) * w / artW;
  const sy = (shape.flip_v ? -1 : 1) * h / artH;
  const angle = Number(shape.angle) || 0;
  return `${angle ? `rotate(${angle} ${cx} ${cy}) ` : ''}`
    + `translate(${tx} ${ty}) scale(${sx} ${sy})`;
}

/** Signed m/ft property field -> centimetres; null keeps invalid drafts visible. */
export function furnitureSignedFieldCm(
  value: unknown,
  imperial: boolean,
  maxCm: number,
  minCm = 0.1,
): number | null {
  if (typeof value === 'string' && !value.trim()) return null;
  const shown = Number(value);
  if (!Number.isFinite(shown) || shown === 0) return null;
  const cm = shown * (imperial ? 30.48 : 100);
  const magnitude = Math.abs(cm);
  if (magnitude < minCm || magnitude > maxCm) return null;
  return cm;
}

/** Positive stored centimetres + one flag -> a lossless-enough signed m/ft field. */
export function furnitureSignedFieldValue(
  cm: number,
  flipped: boolean,
  imperial: boolean,
): string {
  const shown = Math.abs(Number(cm)) / (imperial ? 30.48 : 100);
  // Six decimals keep the physical 0.1 cm minimum representable in both
  // metres (0.001) and feet (~0.003281) without filling ordinary values with
  // trailing zeroes.
  const rounded = Number(shown.toFixed(6));
  return String(flipped ? -rounded : rounded);
}
