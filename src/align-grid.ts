/**
 * «Выровнять всё по сетке» / «Align everything to the grid» — docs/CANVAS.md §9.
 *
 * WHY THIS IS AN ACTION AND NOT A MIGRATION
 * -----------------------------------------
 * Every gesture in the editor now lands on the grid, but plans drawn before
 * that contract existed (and imported plans) may hold coordinates between
 * the nodes. The repair stays explicit and previewable because:
 *
 *  1. It moves the user's data without asking. A house plan is a drawing; the
 *     card has no mandate to redraw it on a version bump.
 *  2. A silent migration is unattributable. When a room looks 3 cm wrong the
 *     owner cannot tell whether the card did it or they did.
 *
 * Intentional off-grid placement is no longer a supported product state
 * (UX-05). The button is the repair path for legacy/imported data: it first
 * says how many elements it will move and by how much at most, and only then
 * writes once, in a single config+layout operation.
 *
 * WALL-BOUND VS GRID-BOUND (the contract this file implements)
 * -----------------------------------------------------------
 * Room vertices, decor geometry, device markers and room labels are GRID-BOUND:
 * they are rounded to the nearest node. Openings are WALL-BOUND: a door that
 * sits on a grid node but half a metre off its wall is broken geometry, so an
 * opening is re-projected onto the nearest wall and its offset ALONG that wall
 * is snapped to the same step. On an axis-aligned wall with grid-aligned
 * corners the two rules agree exactly.
 *
 * THE REPORT IS A PROMISE, SO IT IS AN UPPER BOUND (AUD-158B1-01)
 * --------------------------------------------------------------
 * The confirmation is the only safety gate in front of an action with no undo.
 * A number that is merely typical of what happens is worse than no number at
 * all, so the maximum is measured on the geometry that is actually written
 * back. Two things used to make it a sample instead of a bound:
 *
 *  * a rect was measured by its origin and its far corner only. The far corner
 *    is then pushed out again by the minimum-size correction, and the other two
 *    corners — the ones that carry the X error of one side together with the Y
 *    error of the other — were never looked at, understating an ordinary box by
 *    up to √2 and a box thinner than one step by much more.
 *  * the single NORMALISED maximum was turned into centimetres by the caller,
 *    through the `cell_cm` of the FIRST space. Two floors drawn at 5 cm and at
 *    100 cm per cell made that promise twenty times too small.
 *
 * So displacement is accumulated in CENTIMETRES, every space through its own
 * `cell_cm`, and the report says which space the maximum belongs to.
 *
 * AN OPENING ALSO CARRIES AN ANGLE (AUD-158B1-02)
 * ----------------------------------------------
 * The batch rewrites `angle` as well as `x`/`y`. A window whose centre is
 * already on its wall but whose stored angle is wrong is therefore a real
 * correction — yet it used to come back inside `changed:false`, so the dialog
 * said there was nothing to do and the fix could never be applied. The angle is
 * part of the diff now, and displacement is measured on the opening's ENDS, so
 * turning it is not free in the report either.
 */

import { GRID_N, GRID_STEP_N } from './space-geometry';
import { snapToWall } from './logic';

/** Anything closer than this to a node already counts as being on it. */
const EPS = GRID_STEP_N * 1e-6;
/** How far an opening may be from a wall and still be re-projected onto it. */
const WALL_TOL = GRID_STEP_N * 6;
/** What one cell is worth when a space does not say — the card's own default. */
const DEFAULT_CELL_CM = 5;

/** Round a NORMALISED coordinate to the nearest grid node, idempotently.
 *  A value already on a node is returned UNCHANGED (bit for bit), so a second
 *  run of the alignment writes nothing at all. */
export function snapN(v: number): number {
  if (!Number.isFinite(v)) return v;
  const s = Math.round(v / GRID_STEP_N) * GRID_STEP_N;
  return Math.abs(s - v) <= EPS ? v : s;
}

export interface AlignReport {
  /** Elements whose coordinates the run would change. */
  moved: number;
  /** Elements examined (rooms, decor shapes, openings, markers, labels). */
  total: number;
  /** Largest displacement in NORMALISED units (1 = the plan's width). */
  maxShift: number;
  /** The same maximum in CENTIMETRES — every space through its own `cell_cm`,
   *  because a normalised number means nothing until it meets a scale. This is
   *  the number the confirmation promises, and it is an upper bound. */
  maxShiftCm: number;
  /** Which space holds that maximum (`''` when nothing moves). */
  maxSpace: string;
  /** Openings whose stored `angle` is corrected — possibly without moving. */
  rotated: number;
}

export interface AlignResult {
  spaces: any[];
  layout: Record<string, any>;
  report: AlignReport;
  changed: boolean;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

/** The displacement of an axis-aligned box: the largest of its FOUR corners,
 *  measured against the box that is really written back (minimum-size
 *  correction included). The worst corner combines the largest X error of
 *  either side with the largest Y error of either side — which is why the two
 *  that were never measured are exactly the two that can be the worst. */
const boxShift = (
  x: number, y: number, w: number, h: number,
  nx: number, ny: number, nw: number, nh: number,
): number => Math.hypot(
  Math.max(Math.abs(nx - x), Math.abs((nx + nw) - (x + w))),
  Math.max(Math.abs(ny - y), Math.abs((ny + nh) - (y + h))),
);

/** The displacement of an opening, measured on its two ENDS so that turning it
 *  in place is not free. An opening is a symmetric segment on its wall: 180°
 *  apart is the same segment, so the pairing of ends that gives the smaller
 *  answer is the true one — a flipped angle is a rewrite, not a move. */
const openingShift = (
  x: number, y: number, a: number, len: number,
  nx: number, ny: number, na: number,
): number => {
  const h = Math.max(Number(len) || 0, 0) / 2;
  const R = Math.PI / 180;
  const ux = Math.cos(a * R) * h, uy = Math.sin(a * R) * h;
  const vx = Math.cos(na * R) * h, vy = Math.sin(na * R) * h;
  const same = Math.max(dist(x + ux, y + uy, nx + vx, ny + vy),
                        dist(x - ux, y - uy, nx - vx, ny - vy));
  const flip = Math.max(dist(x + ux, y + uy, nx - vx, ny - vy),
                        dist(x - ux, y - uy, nx + vx, ny + vy));
  return Math.min(same, flip);
};

const cellCmOf = (sp: any): number => {
  const v = Number(sp?.cell_cm);
  return v > 0 ? v : DEFAULT_CELL_CM;
};

/**
 * The whole batch, as a pure function: give it the spaces and the layout, get
 * back new ones plus the report the confirmation dialog shows. Nothing here
 * touches the network, so the dialog can call it twice — once to preview, once
 * to write — and be certain the numbers it promised are the numbers it did.
 */
export function alignAllToGrid(
  spacesIn: any[], layoutIn: Record<string, any>,
): AlignResult {
  const spaces = JSON.parse(JSON.stringify(spacesIn || []));
  const layout: Record<string, any> = JSON.parse(JSON.stringify(layoutIn || {}));
  let moved = 0, total = 0, maxShift = 0, maxShiftCm = 0, maxSpace = '', rotated = 0;

  // a marker or a room label names its space; the scale of THAT space is the
  // one its centimetres are in
  const cellById: Record<string, number> = {};
  let cellWorst = DEFAULT_CELL_CM;
  for (const sp of spaces) {
    const c = cellCmOf(sp);
    if (sp?.id != null) cellById[String(sp.id)] = c;
    if (c > cellWorst) cellWorst = c;
  }

  /** Record one element. `d` is normalised, `cellCm` turns it into the
   *  centimetres of its own space. `forced` is for a change that is real
   *  without being a displacement — an opening's angle. */
  const note = (d: number, cellCm: number, spaceId: string, forced = false): void => {
    if (!(d > EPS) && !forced) return;
    moved++;
    if (d > maxShift) maxShift = d;
    const cm = d * GRID_N * cellCm;
    if (cm > maxShiftCm) { maxShiftCm = cm; maxSpace = spaceId; }
  };

  for (const sp of spaces) {
    const cell = cellCmOf(sp);
    const sid = sp?.id != null ? String(sp.id) : '';

    // ---- rooms: every vertex to the nearest node ----------------------
    for (const r of sp.rooms || []) {
      total++;
      let d = 0;
      if (r.poly?.length) {
        r.poly = r.poly.map((p: number[]) => {
          const q = [snapN(p[0]), snapN(p[1])];
          d = Math.max(d, dist(p[0], p[1], q[0], q[1]));
          return q;
        });
      } else if (r.x != null && r.y != null) {
        // a rect keeps its far corner on the grid too, hence w/h are snapped
        // as corners and not as sizes (a snapped size on an off-grid origin
        // would leave the other side between the nodes).
        const x0 = r.x, y0 = r.y, w0 = r.w || 0, h0 = r.h || 0;
        const x2 = snapN(x0 + w0), y2 = snapN(y0 + h0);
        const nx = snapN(x0), ny = snapN(y0);
        const nw = Math.max(GRID_STEP_N, x2 - nx), nh = Math.max(GRID_STEP_N, y2 - ny);
        d = boxShift(x0, y0, w0, h0, nx, ny, nw, nh);
        r.x = nx; r.y = ny; r.w = nw; r.h = nh;
      }
      note(d, cell, sid);
    }

    // ---- decor ---------------------------------------------------------
    for (const sh of sp.decor || []) {
      total++;
      let d = 0;
      if (sh.kind === 'line') {
        const a = [snapN(sh.x1), snapN(sh.y1)], b = [snapN(sh.x2), snapN(sh.y2)];
        d = Math.max(dist(sh.x1, sh.y1, a[0], a[1]), dist(sh.x2, sh.y2, b[0], b[1]));
        sh.x1 = a[0]; sh.y1 = a[1]; sh.x2 = b[0]; sh.y2 = b[1];
      } else {
        const nx = snapN(sh.x), ny = snapN(sh.y);
        if (sh.w != null && sh.h != null) {
          const x2 = snapN(sh.x + sh.w), y2 = snapN(sh.y + sh.h);
          const nw = Math.max(GRID_STEP_N, x2 - nx), nh = Math.max(GRID_STEP_N, y2 - ny);
          d = boxShift(sh.x, sh.y, sh.w, sh.h, nx, ny, nw, nh);
          sh.w = nw; sh.h = nh;
        } else {
          d = dist(sh.x, sh.y, nx, ny);
        }
        sh.x = nx; sh.y = ny;
      }
      note(d, cell, sid);
    }

    // ---- openings: wall-bound, snapped ALONG the (already aligned) wall --
    // The very same helper the live editor uses, so the button cannot disagree
    // with the drag. A stray opening with no wall within WALL_TOL is left
    // exactly where it is rather than teleported across the plan.
    for (const o of sp.openings || []) {
      total++;
      const q = snapToWall([o.x, o.y], sp.rooms || [], WALL_TOL,
        { step: GRID_STEP_N, length: Number(o.length) || 0 });
      if (!q) continue;
      // the angle is rewritten too, so it belongs in the diff: an opening
      // already on its wall with a wrong angle is a correction that must be
      // offerable, not a silent no-op (AUD-158B1-02)
      const raw = Number(o.angle);
      const turned = !(Number.isFinite(raw) && raw === q.angle);
      const d = openingShift(o.x, o.y, Number.isFinite(raw) ? raw : q.angle,
        Number(o.length) || 0, q.x, q.y, q.angle);
      o.x = q.x; o.y = q.y; o.angle = q.angle;
      if (turned) rotated++;
      note(d, cell, sid, turned);
    }
  }

  // ---- layout: device markers AND room labels (rl_<id>) ----------------
  for (const [k, v] of Object.entries(layout)) {
    if (!v || typeof v !== 'object') continue;
    const p: any = v;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
    total++;
    const nx = snapN(p.x), ny = snapN(p.y);
    const d = dist(p.x, p.y, nx, ny);
    layout[k] = { ...p, x: nx, y: ny };
    // an entry whose space is gone still moves, and the promise must not
    // shrink because of it: the largest scale on the plan is the safe one
    const sid = typeof p.s === 'string' ? p.s : '';
    note(d, cellById[sid] ?? cellWorst, sid);
  }

  return {
    spaces, layout,
    report: { moved, total, maxShift, maxShiftCm, maxSpace, rotated },
    changed: moved > 0,
  };
}
