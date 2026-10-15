import { nothing, svg, type TemplateResult } from 'lit';
import { cancelHouseplanPointerMove, flushHouseplanPointerMove, queueHouseplanPointerMove } from './pointer-move-queue';
import { clampCanvasN, fitInSquare, NORM_W, planRect, PLAN_SCALE_MAX, PLAN_SCALE_MIN, type Rect } from './space-geometry';
import { normalizeAngle, resizeDecorBox, resizedBoxTopLeft, type DecorBox } from './editors/decor/geometry';
import type { SpaceGeometryState } from './geometry-history-state';

export interface BackdropPlan {
  plan_url?: string; plan_aspect?: number;
  plan_x?: number; plan_y?: number; plan_scale?: number;
  plan_scale_x?: number; plan_scale_y?: number; plan_angle?: number;
}
type BackdropParams = { dx: number; dy: number; sx: number; sy: number; angle: number };
type BackdropDrag = {
  kind: 'move' | 'scale' | 'rotate'; pid: number; sx: number; sy: number;
  base: Rect; p0: BackdropParams; fx: number; fy: number; sgx: number; sgy: number;
  rect0: DecorBox; before: SpaceGeometryState | null; moved: boolean;
};

/** Fourteen purposes, not a card-shaped compatibility facade. */
export interface BackdropFrameGesturePort {
  readonly queueTarget: object;
  plan(): BackdropPlan | null;
  mode(): string;
  tool(): string;
  point(event: MouseEvent): number[];
  snap(point: number[]): number[];
  gridPitch(): number;
  snapshot(): SpaceGeometryState | null;
  record(key: 'history.backdrop_transform', before: SpaceGeometryState | null): void;
  save(): void;
  toast(key: 'decor.backdrop_reset_done'): void;
  configChanged(): void;
  publish(phase: 'begin' | 'move' | 'end'): void;
  formatLength(a: number[], b: number[]): string;
}

export class BackdropFrameGestureRuntime {
  private drag: BackdropDrag | null = null;
  public constructor(private readonly port: BackdropFrameGesturePort) {}
  public get active(): boolean { return this.drag !== null; }
  public owns(pid: number): boolean { return this.drag?.pid === pid; }
  public get before(): SpaceGeometryState | null { return this.drag?.before ?? null; }
  public get base(): Rect | null {
    const plan = this.port.plan();
    return plan?.plan_url ? { ...fitInSquare(plan.plan_aspect, NORM_W) } : null;
  }
  public get rect(): (Rect & { angle?: number }) | null {
    const plan = this.port.plan();
    return plan?.plan_url ? planRect(plan, NORM_W) : null;
  }
  public get params(): BackdropParams {
    const plan = this.port.plan();
    const dx = Number(plan?.plan_x), dy = Number(plan?.plan_y);
    const legacy = Number(plan?.plan_scale);
    const sx = Number(plan?.plan_scale_x), sy = Number(plan?.plan_scale_y);
    const baseScale = Number.isFinite(legacy) && legacy > 0 ? legacy : 1;
    return { dx: Number.isFinite(dx) ? dx : 0, dy: Number.isFinite(dy) ? dy : 0,
      sx: Number.isFinite(sx) && sx > 0 ? sx : baseScale,
      sy: Number.isFinite(sy) && sy > 0 ? sy : baseScale, angle: normalizeAngle(plan?.plan_angle) };
  }
  public get frameActive(): boolean {
    return this.port.mode() === 'decor' && !!this.rect && this.port.tool() === 'backdrop';
  }
  public get movable(): boolean {
    return this.port.mode() === 'decor' && this.port.tool() === 'backdrop' && !!this.rect;
  }
  public get transformed(): boolean {
    if (this.port.mode() !== 'decor' || !this.rect) return false;
    const p = this.params;
    return p.dx !== 0 || p.dy !== 0 || p.sx !== 1 || p.sy !== 1 || p.angle !== 0;
  }
  public get live(): { x: number; y: number; text: string } | null {
    if (!this.drag) return null;
    const r = this.rect;
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2,
      text: `${this.port.formatLength([0, 0], [r.w, 0])} × ${this.port.formatLength([0, 0], [0, r.h])}` } : null;
  }
  public apply(dx: number, dy: number, sx: number, sy: number, angle: number): void {
    const plan = this.port.plan();
    if (!plan) return;
    plan.plan_x = Number(clampCanvasN(dx).toFixed(6));
    plan.plan_y = Number(clampCanvasN(dy).toFixed(6));
    delete plan.plan_scale;
    plan.plan_scale_x = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, sx)).toFixed(6));
    plan.plan_scale_y = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, sy)).toFixed(6));
    const a = normalizeAngle(angle);
    if (a) plan.plan_angle = Number(a.toFixed(2));
    else delete plan.plan_angle;
    this.port.configChanged();
    this.port.publish('move');
  }
  public begin(ev: PointerEvent, corner?: number[], rotate = false): boolean {
    const base = this.base, r = this.rect;
    if (!base || !r) return false;
    const p = this.port.point(ev), sgx = corner ? corner[0] : 0, sgy = corner ? corner[1] : 0;
    this.drag = { kind: rotate ? 'rotate' : corner ? 'scale' : 'move', pid: ev.pointerId,
      sx: p[0], sy: p[1], base, p0: this.params,
      fx: sgx > 0 ? r.x : r.x + r.w, fy: sgy > 0 ? r.y : r.y + r.h,
      sgx, sgy, rect0: { x: r.x, y: r.y, w: r.w, h: r.h, angle: r.angle },
      before: this.port.snapshot(), moved: false };
    try { (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId); } catch { /* inactive pointer */ }
    this.port.publish('begin');
    return true;
  }
  public move(ev: PointerEvent): void {
    queueHouseplanPointerMove(this.port.queueTarget, 'backdrop', () => this.moveNow(ev));
  }
  private moveNow(ev: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const p = this.port.point(ev), b = d.base;
    if (d.kind === 'move') {
      const x0 = d.rect0.x, y0 = d.rect0.y;
      const at = this.port.snap([x0 + (p[0] - d.sx), y0 + (p[1] - d.sy)]);
      const changed = Math.abs(at[0] - x0) > 1e-9 || Math.abs(at[1] - y0) > 1e-9;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this.apply((at[0] - b.x) / NORM_W, (at[1] - b.y) / NORM_W, d.p0.sx, d.p0.sy, d.p0.angle);
      return;
    }
    if (d.kind === 'rotate') {
      const cx = d.rect0.x + d.rect0.w / 2, cy = d.rect0.y + d.rect0.h / 2;
      const a0 = Math.atan2(d.sy - cy, d.sx - cx) * 180 / Math.PI;
      let angle = d.p0.angle + (Math.atan2(p[1] - cy, p[0] - cx) * 180 / Math.PI - a0);
      if (!ev.shiftKey) angle = Math.round(angle / 5) * 5;
      angle = normalizeAngle(angle);
      const changed = Math.abs(angle - d.p0.angle) > 1e-9;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this.apply(d.p0.dx, d.p0.dy, d.p0.sx, d.p0.sy, angle);
      return;
    }
    const box = resizeDecorBox(d.rect0, d.sgx, d.sgy, p[0], p[1], !ev.shiftKey,
      this.port.gridPitch(), Math.min(b.w, b.h) * PLAN_SCALE_MIN);
    const sx = box.w / Math.max(1e-9, b.w), sy = box.h / Math.max(1e-9, b.h);
    const changed = Math.abs(sx - d.p0.sx) > 1e-9 || Math.abs(sy - d.p0.sy) > 1e-9
      || Math.abs(box.x - d.rect0.x) > 1e-9 || Math.abs(box.y - d.rect0.y) > 1e-9;
    if (!changed && !d.moved) return;
    d.moved ||= changed;
    const topLeft = resizedBoxTopLeft(box, d.p0.angle, (point) => this.port.snap(point));
    this.apply((topLeft[0] - b.x) / NORM_W, (topLeft[1] - b.y) / NORM_W, sx, sy, d.p0.angle);
  }
  /** State-only reset, including its accepted queue/publication asymmetry. */
  public reset(): void { this.drag = null; }
  public cancel(): void {
    cancelHouseplanPointerMove(this.port.queueTarget, 'backdrop');
    this.reset(); this.port.publish('end');
  }
  public resetTransform(): void {
    const plan = this.port.plan();
    if (!plan) return;
    const before = this.port.snapshot();
    delete plan.plan_x; delete plan.plan_y; delete plan.plan_scale;
    delete plan.plan_scale_x; delete plan.plan_scale_y; delete plan.plan_angle;
    this.drag = null;
    this.port.record('history.backdrop_transform', before);
    this.port.save(); this.port.toast('decor.backdrop_reset_done'); this.port.publish('end');
  }
  public end(): void {
    flushHouseplanPointerMove(this.port.queueTarget, 'backdrop');
    const d = this.drag;
    this.drag = null;
    if (d?.moved) { this.port.record('history.backdrop_transform', d.before); this.port.save(); }
    this.port.publish('end');
  }
  public renderFrame(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const r = this.rect;
    if (!this.frameActive || !r) return nothing;
    const hr = Math.max(view.w, view.h) * 0.02, kr = hr / 4;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, angle = normalizeAngle(r.angle), arm = hr * 2.2;
    const corners: [number, number, string][] = [[-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw']];
    return svg`<g class="bdframe" transform=${angle ? `rotate(${angle} ${cx} ${cy})` : nothing}>
      <rect class="bdbox" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"></rect>
      <line class="dtstem" x1="${cx}" y1="${r.y}" x2="${cx}" y2="${r.y - arm}"></line>
      <circle class="bdhandle dtrot" cx="${cx}" cy="${r.y - arm}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => {
          e.stopPropagation(); e.preventDefault(); this.begin(e, undefined, true);
        }}></circle>
      <circle class="bdknob" cx="${cx}" cy="${r.y - arm}" r="${kr.toFixed(2)}"></circle>
      ${corners.map(([sx, sy, cur]) => {
        const cx = sx < 0 ? r.x : r.x + r.w, cy = sy < 0 ? r.y : r.y + r.h;
        return svg`<circle
          class="bdhandle bd-${cur}" data-corner="${sx + ',' + sy}"
          cx="${cx}" cy="${cy}" r="${hr.toFixed(1)}"
          @pointerdown=${(e: PointerEvent) => {
            e.stopPropagation(); e.preventDefault(); this.begin(e, [sx, sy]);
          }}></circle><circle class="bdknob" cx="${cx}" cy="${cy}" r="${kr.toFixed(2)}"></circle>`;
      })}
    </g>` as unknown as TemplateResult;
  }
}
