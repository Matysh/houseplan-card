/**
 * Equal-spacing magnet of the device editor (#873, docs/CANVAS.md §9.3).
 *
 * A ROW is a run of markers on one plan line — the same y (`h`) or the same
 * x (`v`), equal within 1e-6 plan units, never an angle — with one step
 * d > 0, and no other marker of that line within 2d past either end. Its two
 * TARGETS lie one step past the ends: E + d·u. A target counts only when the
 * card's own grid rounding leaves it in place (a node) and it is on the
 * canvas, so the shown point is exactly the stored one and both gaps stay
 * equal after saving.
 *
 * The pull is measured in CSS px from the raw (unrounded) point: the same at
 * every zoom. A held target stays until the pointer leaves `SPACING_R_OUT`;
 * otherwise the nearest target within `SPACING_R_IN` wins, ties broken by a
 * stable key — axis, line coordinate, position along the line — never by the
 * order of the markers or of the DOM.
 *
 * One final point drives the preview, the hint and the write: the captured
 * target, else the ordinary grid point. The hint is the set of rows whose
 * target IS that point — with or without a capture.
 *
 * Everything here lives for one gesture (`DeviceDragState.spacing`): markers
 * are fixed when it starts, the index is built once on its first move, and a
 * move scans the ready targets once — at most 2N, never pairs of markers.
 */
import { clampCanvasR } from './space-geometry';

/** Line and step tolerance, plan units. */
export const SPACING_EPS = 1e-6;
/** Capture and release radii, CSS px (r_out > r_in). */
export const SPACING_R_IN = 6;
export const SPACING_R_OUT = 10;

export interface SpacingMarker { x: number; y: number }
/** A grid-rounded point: what the card stores (`p`) and where it is drawn. */
export interface SpacingPlaced<P> { p: P; x: number; y: number }

export interface SpacingTarget<P = unknown> {
  /** `h` — a horizontal row (one y), `v` — a vertical one. */
  axis: 'h' | 'v';
  /** The shared coordinate of the row: y of an `h` row, x of a `v` row. */
  line: number;
  /** The target point as rounded by the card: a node, bit-exact. */
  x: number;
  y: number;
  p: P;
  d: number;
  /** Along-axis ends of the reference gap (the far end of the row), then of the new gap. */
  gaps: [number, number][];
}

/** The fields of a device item read here. */
export interface SpacingDevice {
  id: string;
  space: string;
  hidden?: boolean;
  bindingStatus?: { kind: string } | null;
}

/**
 * Contract 1: the markers of the moving one's space the editor draws as an
 * ordinary marker, minus the moving one. Hidden (also as a ghost under «show
 * hidden»), HA-disabled and LED-strip markers do not take part; virtual and
 * unavailable ones do.
 */
export const spacingMarkers = <D extends SpacingDevice>(
  devices: readonly D[], moving: D, leds: { has(id: string): boolean }, pos: (d: D) => SpacingMarker,
): SpacingMarker[] => devices
  .filter((d) => d.space === moving.space && d.id !== moving.id && !d.hidden && !leds.has(d.id)
    && d.bindingStatus?.kind !== 'ha_disabled')
  .map(pos);

/**
 * Every target of every row, in the stable order of contract 6 — axis, line
 * coordinate, position along the line — whatever the order of the markers.
 * O(N log N).
 */
export function spacingTargets<P>(
  markers: readonly SpacingMarker[],
  place: (x: number, y: number) => SpacingPlaced<P>,
): SpacingTarget<P>[] {
  const out: SpacingTarget<P>[] = [];
  for (const axis of ['h', 'v'] as const) {
    const u = axis === 'h' ? 'x' : 'y';
    const o = axis === 'h' ? 'y' : 'x';
    const byLine = [...markers].sort((a, b) => a[o] - b[o]);
    for (let i = 0, j = 0; i < byLine.length; i = j) {
      j = i + 1;
      while (j < byLine.length && byLine[j][o] - byLine[i][o] <= SPACING_EPS) j++;
      const c = byLine.slice(i, j).map((m) => m[u]).sort((a, b) => a - b);
      const line = byLine[i][o];
      const add = (end: number, d: number, ref: [number, number]) => {
        const t = end + d;
        const q = axis === 'h' ? place(t, line) : place(line, t);
        // the line coordinate is a marker's: off the canvas the rounding would move it too
        if (Math.abs(q[u] - t) > SPACING_EPS || Math.abs(q[o] - line) > SPACING_EPS || clampCanvasR(t) !== t) return;
        out.push({ ...q, axis, line, d: Math.abs(d), gaps: [ref, [end, t]] });
      };
      for (let s = 0; s + 1 < c.length; s++) {
        const d = c[s + 1] - c[s];
        // a row starts only where the step does not continue to the left
        if (!(d > SPACING_EPS) || (s > 0 && Math.abs(c[s] - c[s - 1] - d) <= SPACING_EPS)) continue;
        let e = s + 1;
        while (e + 1 < c.length && Math.abs(c[e + 1] - c[e] - d) <= SPACING_EPS) e++;
        if ((s > 0 && c[s] - c[s - 1] <= 2 * d + SPACING_EPS)
          || (e + 1 < c.length && c[e + 1] - c[e] <= 2 * d + SPACING_EPS)) continue;
        add(c[s], -d, [c[e - 1], c[e]]);
        add(c[e], d, [c[s], c[s + 1]]);
      }
    }
  }
  return out;
}

/**
 * One shown row. A gap path is in the row's own frame — x along the row, y
 * across it — which a `v` row maps onto the plan by swapping x and y; the
 * label point is in plan units. `font` — 12 CSS px in plan units.
 */
export interface SpacingRow {
  axis: 'h' | 'v'; text: string; fits: boolean; font: number; gaps: { d: string; mid: number[] }[];
}

/**
 * The hint as drawn: per gap a dimension line from centre to centre, moved
 * off the row's axis (up for `h`, left for `v`) 12 CSS px past the marker
 * shells, with 4 px ticks at the centres; the label sits on an `h` line and
 * left of a `v` one. Both gaps have the one length `fmt(d)`; a label that
 * does not fit is hidden on both.
 */
export function spacingRows(magnet: SpacingMagnet<unknown> | null | undefined, fmt: (d: number) => string): SpacingRow[] {
  const px = magnet?.scale ?? 0;
  return px > 0 ? magnet!.hint.map((t) => {
    const text = fmt(t.d);
    const at = t.line - magnet!.clear - 12 / px;
    const k = 4 / px;
    return {
      axis: t.axis, text, fits: t.d * px >= text.length * 7 + 24, font: 12 / px,
      gaps: t.gaps.map(([a, b]) => ({
        d: `M${a} ${at - k}V${at + k}M${a} ${at}H${b}M${b} ${at - k}V${at + k}`,
        mid: t.axis === 'h' ? [(a + b) / 2, at] : [at - 6 / px, (a + b) / 2],
      })),
    };
  }) : [];
}

/** The magnet of one gesture. */
export class SpacingMagnet<P> {
  private targets?: SpacingTarget<P>[];
  private held?: SpacingTarget<P> | null;
  /** Rows whose target is the final point; empty — no hint. */
  hint: SpacingTarget<P>[] = [];
  /** CSS px per plan unit at the last move: offsets and label fit. */
  scale = 0;
  /** Work counters: index builds, queries, targets visited. */
  builds = 0;
  queries = 0;
  visited = 0;

  constructor(
    private readonly markers: readonly SpacingMarker[],
    private readonly place: (x: number, y: number) => SpacingPlaced<P>,
    /** Half the marker shell, plan units: the dimension line clears it. */
    readonly clear = 0,
  ) {}

  /** The one final point for a raw point; `px`/`py` — CSS px per plan unit. */
  resolve(x: number, y: number, px: number, py: number): P {
    if (!this.targets) {
      this.builds++;
      this.targets = spacingTargets(this.markers, this.place);
    }
    this.queries++;
    this.scale = px;
    const grid = this.place(x, y);
    let best: SpacingTarget<P> | null = null;
    let bestPx = SPACING_R_IN + 1e-9;
    let keep = false;
    const near: SpacingTarget<P>[] = [];
    const onGrid: SpacingTarget<P>[] = [];
    for (const t of this.targets) {
      this.visited++;
      const dist = Math.hypot((t.x - x) * px, (t.y - y) * py);
      if (dist <= SPACING_R_OUT) {
        near.push(t);
        keep ||= t === this.held;
      }
      // strictly nearer by more than noise: an equal distance keeps the earlier, stable key
      if (dist < bestPx - 1e-9) {
        best = t;
        bestPx = dist;
      }
      // targets and the grid point are rounded by one function: the same node is bit-identical
      if (t.x === grid.x && t.y === grid.y) onGrid.push(t);
    }
    if (!keep) this.held = best;
    const held = this.held;
    this.hint = held ? near.filter((t) => t.x === held.x && t.y === held.y) : onGrid;
    return held ? held.p : grid.p;
  }
}
