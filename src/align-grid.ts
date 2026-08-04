/**
 * «Выровнять всё по сетке» / «Align everything to the grid» — docs/CANVAS.md §9.
 *
 * WHY THIS IS AN ACTION AND NOT A MIGRATION
 * -----------------------------------------
 * Every gesture in the editor now lands on the grid, but plans drawn before
 * that contract existed may hold coordinates between the nodes. The obvious
 * fix — quietly rounding everything on the next update — is the wrong one:
 *
 *  1. It moves the user's data without asking. A house plan is a drawing; the
 *     card has no mandate to redraw it on a version bump.
 *  2. Some things are off-grid ON PURPOSE — a small decor label nudged next to
 *     an icon, a diagonal wall's window, a plan traced over a photo where the
 *     scale never was a whole number of cells.
 *  3. A silent migration is unattributable. When a room looks 3 cm wrong the
 *     owner cannot tell whether the card did it or they did.
 *
 * So the alignment lives behind an explicit button that first says how many
 * elements it would move and by how much at most, and only then writes — once,
 * in a single config+layout operation.
 *
 * WALL-BOUND VS GRID-BOUND (the contract this file implements)
 * -----------------------------------------------------------
 * Room vertices, decor geometry, device markers and room labels are GRID-BOUND:
 * they are rounded to the nearest node. Openings are WALL-BOUND: a door that
 * sits on a grid node but half a metre off its wall is broken geometry, so an
 * opening is re-projected onto the nearest wall and its offset ALONG that wall
 * is snapped to the same step. On an axis-aligned wall with grid-aligned
 * corners the two rules agree exactly.
 */

import { GRID_STEP_N } from './space-geometry';
import { snapToWall } from './logic';

/** Anything closer than this to a node already counts as being on it. */
const EPS = GRID_STEP_N * 1e-6;
/** How far an opening may be from a wall and still be re-projected onto it. */
const WALL_TOL = GRID_STEP_N * 6;

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
}

export interface AlignResult {
  spaces: any[];
  layout: Record<string, any>;
  report: AlignReport;
  changed: boolean;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

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
  let moved = 0, total = 0, maxShift = 0;
  const note = (d: number) => { if (d > EPS) { moved++; if (d > maxShift) maxShift = d; } };

  for (const sp of spaces) {
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
        const x2 = snapN((r.x || 0) + (r.w || 0));
        const y2 = snapN((r.y || 0) + (r.h || 0));
        const nx = snapN(r.x), ny = snapN(r.y);
        d = Math.max(dist(r.x, r.y, nx, ny), dist(r.x + (r.w || 0), r.y + (r.h || 0), x2, y2));
        r.x = nx; r.y = ny; r.w = Math.max(GRID_STEP_N, x2 - nx); r.h = Math.max(GRID_STEP_N, y2 - ny);
      }
      note(d);
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
        d = dist(sh.x, sh.y, nx, ny);
        if (sh.w != null && sh.h != null) {
          const x2 = snapN(sh.x + sh.w), y2 = snapN(sh.y + sh.h);
          d = Math.max(d, dist(sh.x + sh.w, sh.y + sh.h, x2, y2));
          sh.w = Math.max(GRID_STEP_N, x2 - nx); sh.h = Math.max(GRID_STEP_N, y2 - ny);
        }
        sh.x = nx; sh.y = ny;
      }
      note(d);
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
      const d = dist(o.x, o.y, q.x, q.y);
      o.x = q.x; o.y = q.y; o.angle = q.angle;
      note(d);
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
    note(d);
  }

  return { spaces, layout, report: { moved, total, maxShift }, changed: moved > 0 };
}
