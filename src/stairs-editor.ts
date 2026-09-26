import { html, nothing, svg, type TemplateResult } from 'lit';
import { resizeFurnitureTransform } from './furniture';
import { FURN_WALL_CELLS, snapFurnitureToWall } from './furniture-placement';
import {
  furnitureWallSurfacesFor, type FurnitureWallSurfaceSource,
} from './furniture-wall-surface';
import { strictNumber, type MarkupTool } from './card-runtime';
import type { EditorToolbarGroup } from './editor-secondary';
import type { I18nKey } from './i18n';
import { clampCanvasN, NORM_W } from './space-geometry';
import {
  convertStairKind, defaultStair, normalizeStairAngle, snapStairToStairs,
  stairPhysicalSizeCm, stairTargetState, STAIR_MIN_N,
} from './stairs-editor-model';
import {
  cachedStairRenderGeometry, MAX_STAIRS_PER_SPACE, stairList, type Stair,
} from './stairs';
import type { SpaceModel } from './types';
import { cmToField, fieldToCm } from './wall-thickness';

type StairDialog = {
  id: string;
  kind: Stair['kind'];
  length: string;
  width: string;
  radius: string;
  angle: string;
  direction: Stair['direction'];
  targetSpaceId: string;
};

type StairDrag = {
  pid: number;
  id: string;
  mode: 'move' | 'resize' | 'rotate';
  resizeX: -1 | 0 | 1;
  resizeY: -1 | 0 | 1;
  start: number[];
  original: Stair;
  before: unknown;
  moved: boolean;
};

/** Narrow internal seam owned by HouseplanCard. The cast at construction keeps
 * these implementation details private to the card while this module keeps the
 * stairs feature out of the already size-limited card core. */
export interface StairEditorHostPort {
  hass: unknown;
  _mode: 'view' | 'plan' | 'devices' | 'decor';
  _tool: MarkupTool;
  _curSpaceCfg: unknown;
  _cfgEpoch: number;
  _cleanFloorCache: Map<unknown, unknown>;
  _modelCache: unknown;
  _gridPitch: number;
  _cellCm: number;
  _imperial: boolean;
  _model: SpaceModel[];
  _space: string;
  _hasFixedFloor: boolean;
  _suppressClick: boolean;
  requestUpdate(): void;
  _showToast(message: string): void;
  _t(key: I18nKey, vars?: Record<string, string | number>): string;
  _geometrySnapshot(): unknown;
  _recordGeometry(name: string, before: unknown): void;
  _saveConfigDebounced(): void;
  _cmToUnits(cm: number): number;
  _svgPoint(event: MouseEvent): number[];
  _tabClick(spaceId: string): void;
  _activateMarkupTool(tool: MarkupTool): void;
}

export class StairEditorRuntime {
  private preset: Stair['kind'] = 'straight';
  private selectedId: string | null = null;
  private dialog: StairDialog | null = null;
  private drag: StairDrag | null = null;

  public constructor(private readonly owner: StairEditorHostPort) {}

  public get selected(): string | null { return this.selectedId; }
  public get dialogOpen(): boolean { return this.dialog !== null; }
  public get dragging(): boolean { return this.drag !== null; }

  public clearSelection(): void {
    this.selectedId = null;
    this.owner.requestUpdate();
  }

  public selectionKey(): string | null {
    return this.selectedId ? `selection:stair:${this.selectedId}` : null;
  }

  private get stairs(): Stair[] {
    return stairList((this.owner._curSpaceCfg as { stairs?: unknown } | null)?.stairs);
  }

  private write(stairs: Stair[]): void {
    const space = this.owner._curSpaceCfg as { stairs?: Stair[] } | null;
    if (!space) return;
    if (stairs.length) space.stairs = stairs;
    else delete space.stairs;
    this.owner._cfgEpoch++;
    this.owner._cleanFloorCache.clear();
    this.owner._modelCache = null;
    this.owner.requestUpdate();
  }

  private withMagnet(stair: Stair, center: readonly number[]): Stair {
    let cx = center[0], cy = center[1], angle = stair.angle;
    const depth = (stair.kind === 'straight' ? stair.width : stair.radius * 2) * NORM_W;
    const wall = snapFurnitureToWall(
      cx, cy, depth,
      furnitureWallSurfacesFor(this.owner as unknown as FurnitureWallSurfaceSource),
      this.owner._gridPitch * FURN_WALL_CELLS, 0, [cx, cy],
    );
    if (wall) {
      cx = wall.cx;
      cy = wall.cy;
      if (stair.kind === 'straight') angle = wall.angle;
    }

    const moved = { ...stair, x: cx / NORM_W, y: cy / NORM_W, angle } as Stair;
    [cx, cy] = snapStairToStairs(
      moved, [cx, cy], this.stairs, this.owner._gridPitch * FURN_WALL_CELLS,
    );
    return {
      ...stair, x: clampCanvasN(cx / NORM_W), y: clampCanvasN(cy / NORM_W), angle,
    } as Stair;
  }

  public activatePlacement(kind: Stair['kind']): void {
    this.preset = kind;
    this.selectedId = null;
    this.owner._activateMarkupTool('stairs');
  }

  public placeAt(point: number[]): void {
    const space = this.owner._curSpaceCfg as { stairs?: Stair[] } | null;
    if (!space || this.stairs.length >= MAX_STAIRS_PER_SPACE) {
      this.owner._showToast(this.owner._t('toast.physical_limit'));
      return;
    }
    const before = this.owner._geometrySnapshot();
    const id = `stair-${crypto.randomUUID?.()
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
    const stair = this.withMagnet(
      defaultStair(this.preset, point[0], point[1], this.owner._cellCm, id), point,
    );
    this.write([...this.stairs, stair]);
    this.selectedId = id;
    this.owner._recordGeometry(this.owner._t('history.stair_add'), before);
    this.owner._saveConfigDebounced();
  }

  private openDialog(stair: Stair): void {
    const sizes = stairPhysicalSizeCm(stair, this.owner._cellCm);
    this.dialog = {
      id: stair.id,
      kind: stair.kind,
      length: cmToField(stair.kind === 'straight' ? sizes[0] : 100, this.owner._imperial),
      width: cmToField(stair.kind === 'straight' ? sizes[1] : 100, this.owner._imperial),
      radius: cmToField(stair.kind === 'spiral' ? sizes[0] : 90, this.owner._imperial),
      angle: String(stair.angle),
      direction: stair.direction,
      targetSpaceId: stair.target_space_id || '',
    };
    this.owner.requestUpdate();
  }

  private updateDialog(patch: Partial<StairDialog>): void {
    if (!this.dialog) return;
    this.dialog = { ...this.dialog, ...patch };
    this.owner.requestUpdate();
  }

  private saveDialog(): void {
    const dialog = this.dialog;
    const current = this.stairs.find((item) => item.id === dialog?.id);
    if (!dialog || !current) return;
    const lengthCm = fieldToCm(dialog.length, this.owner._imperial);
    const widthCm = fieldToCm(dialog.width, this.owner._imperial);
    const radiusCm = fieldToCm(dialog.radius, this.owner._imperial);
    const angle = strictNumber(dialog.angle);
    if (angle == null || (dialog.kind === 'straight'
      ? !(lengthCm && widthCm) : !radiusCm)) return;
    const before = this.owner._geometrySnapshot();
    let next = convertStairKind(current, dialog.kind);
    if (next.kind === 'straight') next = {
      ...next,
      length: Math.max(STAIR_MIN_N, this.owner._cmToUnits(lengthCm!) / NORM_W),
      width: Math.max(STAIR_MIN_N, this.owner._cmToUnits(widthCm!) / NORM_W),
      direction: dialog.direction === 'backward' ? 'backward' : 'forward',
    };
    else next = {
      ...next,
      radius: Math.max(STAIR_MIN_N, this.owner._cmToUnits(radiusCm!) / NORM_W),
      direction: dialog.direction === 'counterclockwise' ? 'counterclockwise' : 'clockwise',
    };
    next = {
      ...next,
      angle: normalizeStairAngle(angle),
      target_space_id: dialog.targetSpaceId || null,
    } as Stair;
    this.write(this.stairs.map((item) => item.id === next.id ? next : item));
    this.owner._recordGeometry(this.owner._t('history.stair_edit'), before);
    this.owner._saveConfigDebounced();
    this.dialog = null;
  }

  private delete(id: string): void {
    const before = this.owner._geometrySnapshot();
    this.write(this.stairs.filter((item) => item.id !== id));
    this.selectedId = null;
    this.dialog = null;
    this.owner._recordGeometry(this.owner._t('history.stair_delete'), before);
    this.owner._saveConfigDebounced();
  }

  public deleteSelected(): boolean {
    if (!this.selectedId) return false;
    this.delete(this.selectedId);
    return true;
  }

  private pointerDown(
    event: PointerEvent,
    stair: Stair,
    mode: 'move' | 'resize' | 'rotate',
    resizeX: -1 | 0 | 1 = 1,
    resizeY: -1 | 0 | 1 = 1,
  ): void {
    if (this.owner._mode !== 'plan'
      || (this.owner._tool !== 'select' && this.owner._tool !== 'stairs')) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedId = stair.id;
    this.drag = {
      pid: event.pointerId,
      id: stair.id,
      mode,
      resizeX,
      resizeY,
      start: this.owner._svgPoint(event as unknown as MouseEvent),
      original: structuredClone(stair),
      before: this.owner._geometrySnapshot(),
      moved: false,
    };
    try { (event.currentTarget as Element).setPointerCapture(event.pointerId); }
    catch { /* synthetic event */ }
    this.owner.requestUpdate();
  }

  public pointerMove(event: PointerEvent): boolean {
    const drag = this.drag;
    if (!drag || drag.pid !== event.pointerId) return false;
    const point = this.owner._svgPoint(event as unknown as MouseEvent);
    let next: Stair = { ...drag.original };
    if (drag.mode === 'move') {
      const center = [
        drag.original.x * NORM_W + point[0] - drag.start[0],
        drag.original.y * NORM_W + point[1] - drag.start[1],
      ];
      next = this.withMagnet(next, center);
    } else if (drag.mode === 'rotate') {
      next.angle = normalizeStairAngle(
        Math.atan2(point[1] - next.y * NORM_W, point[0] - next.x * NORM_W)
          * 180 / Math.PI + 90,
      );
      if (event.shiftKey) next.angle = Math.round(next.angle / 45) * 45;
    } else if (next.kind === 'spiral') {
      next.radius = Math.max(STAIR_MIN_N,
        Math.hypot(point[0] - next.x * NORM_W, point[1] - next.y * NORM_W) / NORM_W);
    } else {
      const resized = resizeFurnitureTransform({
        x: (next.x - next.length / 2) * NORM_W,
        y: (next.y - next.width / 2) * NORM_W,
        w: next.length * NORM_W,
        h: next.width * NORM_W,
        angle: next.angle,
      }, drag.resizeX, drag.resizeY, point[0], point[1], false, STAIR_MIN_N * NORM_W);
      next = {
        ...next,
        x: (resized.x + resized.w / 2) / NORM_W,
        y: (resized.y + resized.h / 2) / NORM_W,
        length: resized.w / NORM_W,
        width: resized.h / NORM_W,
      };
    }
    drag.moved ||= Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) > 0.5;
    this.write(this.stairs.map((item) => item.id === next.id ? next : item));
    return true;
  }

  private endDrag(event: PointerEvent, cancelled: boolean): boolean {
    const drag = this.drag;
    if (!drag || drag.pid !== event.pointerId) return false;
    if (cancelled) {
      this.write(this.stairs.map((item) => item.id === drag.id ? drag.original : item));
    } else if (drag.moved) {
      this.owner._recordGeometry(this.owner._t('history.stair_move'), drag.before);
      this.owner._saveConfigDebounced();
    }
    this.drag = null;
    return true;
  }

  public pointerUp(event: PointerEvent): boolean {
    return this.endDrag(event, false);
  }

  public pointerCancel(event: PointerEvent): boolean {
    return this.endDrag(event, true);
  }

  public undoActiveDrag(): boolean {
    if (!this.drag) return false;
    const drag = this.drag;
    this.write(this.stairs.map((item) => item.id === drag.id ? drag.original : item));
    this.drag = null;
    return true;
  }

  public escape(): boolean {
    if (this.undoActiveDrag()) return true;
    if (!this.selectedId) return false;
    this.selectedId = null;
    this.owner.requestUpdate();
    return true;
  }

  public beforeModeChange(mode: StairEditorHostPort['_mode']): void {
    if (mode !== this.owner._mode) this.undoActiveDrag();
  }

  public afterModeChange(): void {
    if (this.owner._mode !== 'plan') this.selectedId = null;
  }

  public clearGesture(): void {
    this.drag = null;
    this.selectedId = null;
  }

  public toolbarGroup(): EditorToolbarGroup {
    return {
      id: 'stairs',
      label: this.owner._t('markup.stairs'),
      icon: 'mdi:stairs',
      activeItemId: this.owner._tool === 'stairs' ? this.preset : undefined,
      items: [{
        id: 'straight',
        label: this.owner._t('stairs.straight'),
        icon: 'mdi:stairs',
        role: 'tool',
        invoke: () => this.activatePlacement('straight'),
      }, {
        id: 'spiral',
        label: this.owner._t('stairs.spiral'),
        icon: 'mdi:rotate-orbit',
        role: 'tool',
        invoke: () => this.activatePlacement('spiral'),
      }],
    };
  }

  public renderLayer(): TemplateResult {
    const spaceIds = new Set(this.owner._model.map((item) => item.id));
    const items = this.stairs.map((stair) => {
      const geometry = cachedStairRenderGeometry(stair, this.owner._cellCm);
      const outline = geometry.outline.map((point) => point.join(',')).join(' ');
      const selected = this.owner._mode === 'plan'
        && (this.owner._tool === 'select' || this.owner._tool === 'stairs')
        && this.selectedId === stair.id;
      const targetState = stairTargetState(
        stair, this.owner._space, spaceIds, this.owner._hasFixedFloor,
      );
      const inputEnabled = this.owner._mode === 'plan'
        && (this.owner._tool === 'select' || this.owner._tool === 'stairs');
      const select = (event: Event): void => {
        if (this.owner._mode === 'plan') {
          event.stopPropagation();
          this.selectedId = stair.id;
          this.owner.requestUpdate();
        }
      };
      const resizeHandles = stair.kind === 'spiral'
        ? [{ point: [stair.x * NORM_W + stair.radius * NORM_W, stair.y * NORM_W], sx: 1, sy: 1 }]
        : [
          { point: geometry.outline[0], sx: -1, sy: -1 },
          { point: geometry.outline[1], sx: 1, sy: -1 },
          { point: geometry.outline[2], sx: 1, sy: 1 },
          { point: geometry.outline[3], sx: -1, sy: 1 },
          { point: geometry.outline[0].map((value, axis) =>
            (value + geometry.outline[1][axis]) / 2), sx: 0, sy: -1 },
          { point: geometry.outline[1].map((value, axis) =>
            (value + geometry.outline[2][axis]) / 2), sx: 1, sy: 0 },
          { point: geometry.outline[2].map((value, axis) =>
            (value + geometry.outline[3][axis]) / 2), sx: 0, sy: 1 },
          { point: geometry.outline[3].map((value, axis) =>
            (value + geometry.outline[0][axis]) / 2), sx: -1, sy: 0 },
        ];
      const bearing = stair.angle * Math.PI / 180;
      const outer = (stair.kind === 'spiral' ? stair.radius : stair.width / 2) * NORM_W;
      const rotatePoint = [
        stair.x * NORM_W + Math.sin(bearing) * (outer + this.owner._gridPitch * 2),
        stair.y * NORM_W - Math.cos(bearing) * (outer + this.owner._gridPitch * 2),
      ];
      return svg`<g class="hp-stair ${selected ? 'selected' : ''} ${inputEnabled ? 'input-enabled' : ''}"
        data-hp="stair" data-id=${stair.id} data-kind=${stair.kind}
        data-target-state=${targetState}
        role="img"
        aria-label=${this.owner._t('markup.stairs')}
        @dblclick=${(event: MouseEvent) => {
          event.stopPropagation();
          if (this.owner._mode === 'plan') this.openDialog(stair);
        }}>
        <polygon class="hp-stair-outline" points=${outline}></polygon>
        <polygon class="hp-stair-hit" points=${outline}
          @pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'move')}
          @click=${select}></polygon>
        ${geometry.treads.map((line) => svg`<line class="hp-stair-tread"
          x1=${line.a[0]} y1=${line.a[1]} x2=${line.b[0]} y2=${line.b[1]}></line>`)}
        <path class="hp-stair-arrow" d=${geometry.arrowPath}></path>
        ${selected ? svg`
          ${resizeHandles.map((handle) => svg`<circle class="hp-stair-handle hp-stair-resize"
            cx=${handle.point[0]} cy=${handle.point[1]} r=${this.owner._gridPitch * 0.65}
            @pointerdown=${(event: PointerEvent) => this.pointerDown(
              event, stair, 'resize', handle.sx as -1 | 0 | 1, handle.sy as -1 | 0 | 1,
            )}></circle>`)}
          <line class="hp-stair-rotate-leader" x1=${stair.x * NORM_W} y1=${stair.y * NORM_W}
            x2=${rotatePoint[0]} y2=${rotatePoint[1]}></line>
          <circle class="hp-stair-handle hp-stair-rotate"
            cx=${rotatePoint[0]} cy=${rotatePoint[1]} r=${this.owner._gridPitch * 0.65}
            @pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'rotate')}></circle>
        ` : nothing}
      </g>`;
    });
    return svg`<g class="hp-stairs-layer">${items}</g>` as unknown as TemplateResult;
  }

  public renderDialog(): TemplateResult | typeof nothing {
    const dialog = this.dialog;
    const current = this.stairs.find((item) => item.id === dialog?.id);
    if (!dialog || !current) return nothing;
    const targetState = stairTargetState(
      { ...current, target_space_id: dialog.targetSpaceId || null } as Stair,
      this.owner._space, new Set(this.owner._model.map((item) => item.id)),
      this.owner._hasFixedFloor,
    );
    const directionOptions: ReadonlyArray<readonly [string, I18nKey]> = dialog.kind === 'straight'
      ? [['forward', 'stairs.forward'], ['backward', 'stairs.backward']] as const
      : [['clockwise', 'stairs.clockwise'], ['counterclockwise', 'stairs.counterclockwise']] as const;
    const field = (key: 'length' | 'width' | 'radius', label: I18nKey) => html`
      <label>${this.owner._t(label)}</label>
      <div class="row"><input class="namein tempin" type="number" min="0.01" step="any"
        .value=${dialog[key]}
        @input=${(event: Event) => this.updateDialog({
          [key]: (event.target as HTMLInputElement).value,
        })}><span class="opl">${this.owner._t(
          this.owner._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm',
        )}</span></div>`;
    return html`<hp-dialog .hass=${this.owner.hass} data-kind="stairs" wide
      .title=${this.owner._t('stairs.properties')} icon="mdi:stairs"
      @hp-close=${() => this.closeDialog()}>
      <div class="body">
        <label>${this.owner._t('stairs.type')}</label>
        <select class="areasel"
          @change=${(event: Event) => {
            const kind = (event.target as HTMLSelectElement).value as Stair['kind'];
            const converted = convertStairKind(current, kind);
            const sizes = stairPhysicalSizeCm(converted, this.owner._cellCm);
            this.updateDialog({
              kind,
              length: cmToField(kind === 'straight' ? sizes[0] : 100, this.owner._imperial),
              width: cmToField(kind === 'straight' ? sizes[1] : 100, this.owner._imperial),
              radius: cmToField(kind === 'spiral' ? sizes[0] : 90, this.owner._imperial),
              direction: converted.direction,
            });
          }}>
          <option value="straight" ?selected=${dialog.kind === 'straight'}>${this.owner._t('stairs.straight')}</option>
          <option value="spiral" ?selected=${dialog.kind === 'spiral'}>${this.owner._t('stairs.spiral')}</option>
        </select>
        ${dialog.kind === 'straight'
          ? html`${field('length', 'stairs.length')}${field('width', 'stairs.width')}`
          : field('radius', 'stairs.radius')}
        <label>${this.owner._t('stairs.rotation')}</label>
        <input class="namein tempin" type="number" step="any" .value=${dialog.angle}
          @input=${(event: Event) => this.updateDialog({
            angle: (event.target as HTMLInputElement).value,
          })}>
        <label>${this.owner._t('stairs.direction')}</label>
        <div class="segmented">${directionOptions.map(([value, key]) => html`
          <button class="btn ${dialog.direction === value ? 'on' : ''}"
            @click=${() => this.updateDialog({
              direction: value as Stair['direction'],
            })}>${this.owner._t(key)}</button>`)}</div>
        <label>${this.owner._t('stairs.target')}</label>
        <select class="areasel"
          @change=${(event: Event) => this.updateDialog({
            targetSpaceId: (event.target as HTMLSelectElement).value,
          })}>
          <option value="" ?selected=${dialog.targetSpaceId === ''}>${this.owner._t('stairs.no_target')}</option>
          ${this.owner._model.filter((item) => item.id !== this.owner._space).map((item) => html`
            <option value=${item.id} ?selected=${dialog.targetSpaceId === item.id}>${item.title}</option>`)}
        </select>
        ${targetState !== 'active' ? html`<p class="hint warn">${this.owner._t(
          targetState === 'fixed' ? 'stairs.fixed_floor' : 'stairs.target_warning',
        )}</p>` : nothing}
      </div>
      <div class="row dialog-action-footer" slot="footer">
        <button class="btn danger" data-hp="dialog-confirm" @click=${() => this.delete(dialog.id)}>
          <ha-icon icon="mdi:delete-outline"></ha-icon>${this.owner._t('btn.delete')}</button>
        <span class="spacer"></span>
        <button class="btn ghost" data-hp="dialog-cancel"
          @click=${() => this.closeDialog()}>${this.owner._t('btn.cancel')}</button>
        <button class="btn on" data-hp="dialog-confirm" @click=${() => this.saveDialog()}>
          <ha-icon icon="mdi:check"></ha-icon>${this.owner._t('btn.save')}</button>
      </div>
    </hp-dialog>`;
  }

  private closeDialog(): void {
    this.dialog = null;
    this.owner.requestUpdate();
  }
}
