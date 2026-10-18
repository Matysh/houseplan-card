/** The transient body-move/column-rotation owner; persistence stays with the editor. */
import { CANVAS_LIMIT, NORM_W } from './canvas-constants';
import type { SpaceGeometryState } from './geometry-history-state';
import {
  canonicalColumnAngle, columnBody, partitionBody, pointInPhysicalBody, sameColumnPlacement,
} from './physical-geometry';
import { materializePartitionOpening, resolvePartitionOpeningCompat } from './partition-openings';
import {
  cancelHouseplanPointerMove, flushHouseplanPointerMove, queueHouseplanPointerMove,
} from './pointer-move-queue';
import type { OpeningCfg, PartitionCfg, SpaceModel, WallColumnCfg } from './types';

type PhysicalKind = 'partition' | 'column';
type PhysicalSelection = { kind: PhysicalKind; id: string };
type StoredGeometry = {
  partitions?: PartitionCfg[]; wall_columns?: WallColumnCfg[]; openings?: OpeningCfg[];
};

export interface PhysicalBodyGesturePort {
  /** Opaque identity shared with the editor's existing microtask queue. */
  queueTarget: object;
  space(): SpaceModel | null;
  storedGeometry(): StoredGeometry | null;
  units(): { cellCm: number; gridPitch: number };
  point(event: MouseEvent): number[];
  snap(point: number[]): number[];
  snapshot(): SpaceGeometryState | null;
  commit(key: 'history.physical_move' | 'history.physical_edit', before: SpaceGeometryState | null): void;
  select(selection: PhysicalSelection): boolean | void;
  openDialog(kind: PhysicalKind, id: string): void;
  toast(key: 'toast.column_duplicate'): void;
  publish(phase: 'begin' | 'move' | 'end'): void;
  now(): number;
}

export interface PhysicalBodyDrag extends PhysicalSelection {
  pid: number; start: number[]; startClient: number[];
  before: SpaceGeometryState | null; moved: boolean;
  base: PartitionCfg | WallColumnCfg; delta: number[];
}

export interface PhysicalBodyRotation {
  pid: number; id: string; center: number[]; startAngle: number;
  baseAngle: number; angle: number; before: SpaceGeometryState | null; moved: boolean;
}

const capturePointer = (ev: PointerEvent): void => {
  try { (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId); } catch {}
};

export class PhysicalBodyGestureRuntime {
  private _drag: PhysicalBodyDrag | null = null;
  private _rotation: PhysicalBodyRotation | null = null;
  private lastTap: (PhysicalSelection & { at: number }) | null = null;
  private pickCycle: { signature: string; index: number; x: number; y: number; at: number } | null = null;

  constructor(private readonly port: PhysicalBodyGesturePort) {}

  get drag(): PhysicalBodyDrag | null { return this._drag; }
  get rotation(): PhysicalBodyRotation | null { return this._rotation; }
  get active(): boolean { return !!(this._drag || this._rotation); }
  owns(pid: number): boolean { return this._drag?.pid === pid || this._rotation?.pid === pid; }

  begin(ev: PointerEvent, kind: PhysicalKind, id: string): void {
    const model = this.port.space();
    if (!model) return;
    ev.stopPropagation();
    const point = this.port.point(ev);
    const { cellCm, gridPitch } = this.port.units();
    const candidates: PhysicalSelection[] = [];
    for (const column of [...model.wall_columns].reverse()) {
      if (pointInPhysicalBody(point, columnBody(column, cellCm, gridPitch)))
        candidates.push({ kind: 'column', id: column.id });
    }
    for (const partition of [...model.partitions].reverse()) {
      const body = partitionBody(partition.a, partition.b, partition.cm, cellCm, gridPitch);
      if (body && pointInPhysicalBody(point, body))
        candidates.push({ kind: 'partition', id: partition.id });
    }
    if (!candidates.some((item) => item.kind === kind && item.id === id)) candidates.unshift({ kind, id });
    const signature = candidates.map((item) => `${item.kind}:${item.id}`).sort().join('|');
    const now = this.port.now(), cycle = this.pickCycle;
    const repeat = candidates.length > 1 && cycle?.signature === signature
      && now - cycle.at > 380 && now - cycle.at <= 1200
      && Math.hypot(ev.clientX - cycle.x, ev.clientY - cycle.y) <= 10;
    const index = repeat ? (cycle.index + 1) % candidates.length
      : Math.max(0, candidates.findIndex((item) => item.kind === kind && item.id === id));
    this.pickCycle = { signature, index, x: ev.clientX, y: ev.clientY, at: now };
    ({ kind, id } = candidates[index]);
    const base = kind === 'partition'
      ? model.partitions.find((item) => item.id === id)
      : model.wall_columns.find((item) => item.id === id);
    if (!base) return;
    if (this.port.select({ kind, id }) === false) return;
    capturePointer(ev);
    this._drag = {
      pid: ev.pointerId, kind, id, start: this.port.point(ev),
      startClient: [ev.clientX, ev.clientY], before: this.port.snapshot(), moved: false,
      base: JSON.parse(JSON.stringify(base)), delta: [0, 0],
    };
    this.port.publish('begin');
  }

  move(ev: PointerEvent): void {
    ev.stopPropagation();
    queueHouseplanPointerMove(this.port.queueTarget, 'physical', () => this.moveNow(ev));
  }

  private moveNow(ev: PointerEvent): void {
    const drag = this._drag;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.stopPropagation();
    const raw = this.port.point(ev);
    const anchor = drag.kind === 'partition'
      ? (drag.base as PartitionCfg).a : (drag.base as WallColumnCfg).center;
    const target = this.port.snap([
      anchor[0] + raw[0] - drag.start[0], anchor[1] + raw[1] - drag.start[1],
    ]);
    const points = drag.kind === 'partition'
      ? [(drag.base as PartitionCfg).a, (drag.base as PartitionCfg).b]
      : [(drag.base as WallColumnCfg).center];
    const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
    const delta = [
      Math.max(-CANVAS_LIMIT * NORM_W - Math.min(...xs),
        Math.min(CANVAS_LIMIT * NORM_W - Math.max(...xs), target[0] - anchor[0])),
      Math.max(-CANVAS_LIMIT * NORM_W - Math.min(...ys),
        Math.min(CANVAS_LIMIT * NORM_W - Math.max(...ys), target[1] - anchor[1])),
    ];
    this._drag = {
      ...drag, delta,
      moved: drag.moved || Math.hypot(
        ev.clientX - drag.startClient[0], ev.clientY - drag.startClient[1],
      ) >= 5,
    };
    this.port.publish('move');
  }

  end(ev: PointerEvent): void {
    flushHouseplanPointerMove(this.port.queueTarget, 'physical');
    const drag = this._drag;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.stopPropagation();
    this._drag = null;
    this.port.publish('end');
    if (!drag.moved) {
      this.registerTap(drag.kind, drag.id);
      return;
    }
    const model = this.port.space(), stored = this.port.storedGeometry();
    if (!stored || !model) return;
    const { cellCm, gridPitch } = this.port.units();
    if (drag.kind === 'partition') {
      const partition = stored.partitions?.find((item) => item.id === drag.id);
      const base = drag.base as PartitionCfg;
      if (partition) {
        const moved: PartitionCfg = {
          ...base,
          a: [base.a[0] + drag.delta[0], base.a[1] + drag.delta[1]],
          b: [base.b[0] + drag.delta[0], base.b[1] + drag.delta[1]],
        };
        partition.a = [moved.a[0] / NORM_W, moved.a[1] / NORM_W];
        partition.b = [moved.b[0] / NORM_W, moved.b[1] / NORM_W];
        for (const opening of stored.openings || []) {
          if (opening.host?.kind !== 'partition' || opening.host.id !== drag.id) continue;
          const resolved = resolvePartitionOpeningCompat(
            opening, [moved], NORM_W, cellCm, gridPitch,
          ).resolved;
          if (resolved) Object.assign(opening, materializePartitionOpening(opening, resolved, NORM_W));
        }
      }
    } else {
      const column = stored.wall_columns?.find((item) => item.id === drag.id);
      const base = drag.base as WallColumnCfg;
      const candidate: WallColumnCfg = {
        ...base, center: [base.center[0] + drag.delta[0], base.center[1] + drag.delta[1]],
      };
      if (model.wall_columns.some((item) => item.id !== drag.id
          && sameColumnPlacement(item, candidate, gridPitch * 0.02))) {
        this.port.toast('toast.column_duplicate');
        return;
      }
      if (column) column.center = [
        (base.center[0] + drag.delta[0]) / NORM_W,
        (base.center[1] + drag.delta[1]) / NORM_W,
      ];
    }
    this.port.commit('history.physical_move', drag.before);
  }

  private registerTap(kind: PhysicalKind, id: string): void {
    const now = this.port.now();
    const twice = this.lastTap?.kind === kind && this.lastTap.id === id
      && now - this.lastTap.at <= 360;
    this.lastTap = { kind, id, at: now };
    if (twice) {
      this.lastTap = null;
      this.port.openDialog(kind, id);
    }
  }

  cancel(): void {
    cancelHouseplanPointerMove(this.port.queueTarget, 'physical');
    cancelHouseplanPointerMove(this.port.queueTarget, 'physical-rotate');
    this.reset();
    this.port.publish('end');
  }

  /** State-only resets preserve the old callers' queue/publication asymmetry. */
  resetMove(): void { this._drag = null; }
  reset(): void { this._drag = null; this._rotation = null; }

  rotateBegin(ev: PointerEvent, column: WallColumnCfg): void {
    if (column.shape !== 'square' || !this.port.space()) return;
    ev.preventDefault();
    ev.stopPropagation();
    capturePointer(ev);
    const point = this.port.point(ev);
    this.port.select({ kind: 'column', id: column.id });
    this._rotation = {
      pid: ev.pointerId, id: column.id, center: [...column.center],
      startAngle: Math.atan2(point[1] - column.center[1], point[0] - column.center[0]) * 180 / Math.PI,
      baseAngle: canonicalColumnAngle(column.angle), angle: canonicalColumnAngle(column.angle),
      before: this.port.snapshot(), moved: false,
    };
    this.port.publish('begin');
  }

  rotateMove(ev: PointerEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    queueHouseplanPointerMove(this.port.queueTarget, 'physical-rotate', () => this.rotateMoveNow(ev));
  }

  private rotateMoveNow(ev: PointerEvent): void {
    const drag = this._rotation;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.preventDefault();
    ev.stopPropagation();
    const point = this.port.point(ev);
    const pointerAngle = Math.atan2(point[1] - drag.center[1], point[0] - drag.center[0]) * 180 / Math.PI;
    const raw = drag.baseAngle + pointerAngle - drag.startAngle;
    const angle = canonicalColumnAngle(ev.shiftKey ? raw : Math.round(raw / 5) * 5);
    this._rotation = { ...drag, angle, moved: drag.moved || Math.abs(raw - drag.baseAngle) >= 0.5 };
    this.port.publish('move');
  }

  rotateEnd(ev: PointerEvent): void {
    flushHouseplanPointerMove(this.port.queueTarget, 'physical-rotate');
    const drag = this._rotation;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.preventDefault();
    ev.stopPropagation();
    this._rotation = null;
    this.port.publish('end');
    const model = this.port.space(), geometry = this.port.storedGeometry();
    if (!drag.moved || !geometry || !model) return;
    const current = model.wall_columns.find((column) => column.id === drag.id);
    if (!current || current.shape !== 'square') return;
    const candidate: WallColumnCfg = { ...current, angle: drag.angle };
    if (model.wall_columns.some((column) => column.id !== drag.id
        && sameColumnPlacement(column, candidate, this.port.units().gridPitch * 0.02))) {
      this.port.toast('toast.column_duplicate');
      return;
    }
    const stored = geometry.wall_columns?.find((column) => column.id === drag.id);
    if (!stored) return;
    Object.assign(stored, { angle: drag.angle });
    this.port.commit('history.physical_edit', drag.before);
  }
}
